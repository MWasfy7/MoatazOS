import { buildDecisionSequence, type DeterministicDecisionSnapshot } from "@/lib/decisionEngine";
import { buildLeadLossReport, type LeadLossCase } from "@/lib/leadLossReport";
import { FUTURE_EVENT_TOLERANCE_MS, stableHash, type NormalizedSalesEvent } from "@/lib/realInput";
import type {
  BaselinePeriod, CommandQueueItem, DoctrineItem, EvidenceContract, ExperimentCandidate,
  MetricValue, OperatorOpportunity, OperatorPattern, OperatorProfile, OperatorSession, OverrideRecord,
  PerformanceLedger, PostDecisionObservation, QuickCaptureInput, QueueExplanation, QueueReasonCode, SanitizedOperatorExport,
  TrialSignal, TrialSignalKind,
} from "./types";
import { snapshotRecommendation } from "./types";

const DAY = 86_400_000;
export const FUTURE_EVIDENCE_TOLERANCE_MS = FUTURE_EVENT_TOLERANCE_MS;
const URGENCY_FRESHNESS_MS = 7 * DAY;

export function createOperatorSession(
  operatorId: string,
  opportunities: readonly OperatorOpportunity[],
  generatedAt: string,
): OperatorSession {
  const preparedOpportunities = opportunities.map((opportunity) => prepareOpportunity(opportunity, generatedAt));
  const baseline: BaselinePeriod = {
    status: "OBSERVATION_PERIOD", startedAt: generatedAt, minimumDays: 7, observedDays: 1,
    comparisonLanguage: "ASSOCIATED_IMPROVEMENT_OBSERVED",
  };
  const session: OperatorSession = {
    sessionId: `operator-run-${stableHash(`runtime|${generatedAt}|${opportunities.length}`)}`,
    operatorId, generatedAt,
    opportunities: preparedOpportunities,
    queue: buildCommandQueue(preparedOpportunities, generatedAt),
    overrides: [], observations: [], patterns: [], doctrine: initialDoctrine(generatedAt), experiments: [],
    performance: emptyPerformance(), operatorProfile: emptyProfile(operatorId), baseline,
    trialSignals: [trialSignal("QUEUE_OPENED", generatedAt, [], undefined)],
  };
  return recalculate(session);
}

export function opportunitiesFromEvents(events: readonly NormalizedSalesEvent[]): OperatorOpportunity[] {
  const groups = new Map<string, NormalizedSalesEvent[]>();
  for (const event of events) {
    const key = `${event.organizationId}|${event.salesFloorId}|${event.leadId}`;
    groups.set(key, [...(groups.get(key) ?? []), { ...event, metadata: { ...event.metadata } }]);
  }
  return [...groups.entries()].map(([identity, grouped]) => {
    const sorted = grouped.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId));
    const opportunityId = `opportunity-${stableHash(identity)}`;
    return {
      opportunityId,
      displayLabel: `Lead ${stableHash(identity)}`,
      events: sorted,
      decision: buildDecisionSequence(sorted),
    };
  });
}

export function buildCommandQueue(opportunities: readonly OperatorOpportunity[], asOf: string): CommandQueueItem[] {
  return opportunities.map((opportunity) => queueItem(prepareOpportunity(opportunity, asOf), asOf)).sort((a, b) => b.priority - a.priority || a.queueItemId.localeCompare(b.queueItemId));
}

function queueItem(opportunity: OperatorOpportunity, asOf: string): CommandQueueItem {
  const snapshot = opportunity.decision.current;
  const eligibleEvents = opportunity.events.filter((event) => isEvidenceUsableAt(event.occurredAt, asOf));
  const overdueCommitment = latestEvent(eligibleEvents, ["PROMISED_FOLLOWUP", "SELLER_COMMITMENT"]);
  const fulfilled = latestEvent(eligibleEvents, ["COMMITMENT_COMPLETED"]);
  const commitmentDueAt = overdueCommitment?.metadata.dueAt ?? overdueCommitment?.occurredAt;
  const isOverdue = Boolean(overdueCommitment && commitmentDueAt && validTime(commitmentDueAt) && Date.parse(commitmentDueAt) < Date.parse(asOf) && (!fulfilled || fulfilled.occurredAt < overdueCommitment.occurredAt));
  const isStaleCommitment = Boolean(isOverdue && commitmentDueAt && Date.parse(asOf) - Date.parse(commitmentDueAt) > URGENCY_FRESHNESS_MS);
  const latestObserved = eligibleEvents.filter(isMeaningfulLeadEngagement).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).at(-1);
  const ageDays = latestObserved ? Math.max(0, (Date.parse(asOf) - Date.parse(latestObserved.occurredAt)) / DAY) : null;
  const contract = evidenceContract(snapshot, opportunity.events, asOf);
  const hasFutureExclusions = contract.excludedEvidence.length > 0;
  let section: CommandQueueItem["section"];
  let reasonCode: CommandQueueItem["reasonCode"];
  let priority: number;

  if (snapshot.decisionState === "NO_ACTION") {
    section = "WAIT_PROTECTED"; reasonCode = isOverdue ? "ACTIVE_BUYER_PAUSE_WITH_OVERDUE_COMMITMENT" : "ACTIVE_BUYER_PAUSE"; priority = 20;
  } else if (isOverdue && !isStaleCommitment) {
    section = "COMMITMENTS_DUE"; reasonCode = "OVERDUE_SELLER_COMMITMENT"; priority = 95;
  } else if (snapshot.decisionState === "NEXT_STEP_READY" && contract.freshness === "CURRENT") {
    section = "ACT_NOW"; reasonCode = "CURRENT_BUYER_SIGNAL"; priority = 90;
  } else if (isStaleCommitment) {
    section = "REVIEW"; reasonCode = "STALE_SELLER_COMMITMENT"; priority = 55;
  } else if (snapshot.decisionState === "NEXT_STEP_READY") {
    section = "REVIEW"; reasonCode = "STALE_BUYER_SIGNAL"; priority = 50;
  } else if (snapshot.decisionState === "CONTRADICTORY_EVIDENCE") {
    section = "REVIEW"; reasonCode = "CONTRADICTORY_EVIDENCE"; priority = 70;
  } else {
    section = ageDays !== null && ageDays >= 3 ? "AT_RISK_NEGLECT" : "REVIEW";
    reasonCode = hasFutureExclusions ? "FUTURE_EVIDENCE_EXCLUDED" : section === "AT_RISK_NEGLECT" ? "AGING_EVIDENCE_GAP" : "INSUFFICIENT_EVIDENCE";
    priority = section === "AT_RISK_NEGLECT" ? 35 : 40;
  }

  const explanations = queueExplanations(reasonCode, commitmentDueAt, snapshot.effectiveAt);
  const { whyHere, whyNow, recommendation, ignoreRisk } = explanations.en;
  return {
    queueItemId: `queue-${stableHash(`${opportunity.opportunityId}|${snapshot.snapshotId}|${section}`)}`,
    opportunityId: opportunity.opportunityId, displayLabel: opportunity.displayLabel, section, priority,
    whyHere, whyNow, reasonCode, whatChanged: snapshot.priorSnapshotId ? `Decision lineage advanced from ${snapshot.priorSnapshotId}.` : "This is the first bounded snapshot in the current lineage.",
    recommendation, ignoreRisk, reevaluateWhen: [...snapshot.reevaluationConditions], evidenceContract: contract, explanations,
  };
}

function queueExplanations(reason: QueueReasonCode, commitmentDueAt?: string, effectiveAt?: string): Record<"en" | "ar", QueueExplanation> {
  const due = commitmentDueAt ?? "an unverified time";
  const effective = effectiveAt ?? "an unverified time";
  const values: Record<QueueReasonCode, Record<"en" | "ar", QueueExplanation>> = {
    CURRENT_BUYER_SIGNAL: {
      en: { whyHere: "Current decision-grade buyer evidence supports a bounded next step.", whyNow: `The current decision became effective at ${effective}.`, recommendation: "Review the evidence-backed next step and execute it outside SalesOS if appropriate.", ignoreRisk: "A current attributable buyer request may remain unanswered." },
      ar: { whyHere: "تدعم أدلة حديثة ومنسوبة إلى المشتري خطوة تالية محدودة.", whyNow: `أصبح القرار الحالي سارياً في ${effective}.`, recommendation: "راجع الخطوة المدعومة بالأدلة ونفّذها خارج SalesOS إذا كانت مناسبة.", ignoreRisk: "قد يبقى طلب حالي منسوب إلى المشتري بلا استجابة." },
    },
    OVERDUE_SELLER_COMMITMENT: {
      en: { whyHere: "An attributable seller commitment is overdue.", whyNow: `The commitment due at ${due} has no later completion record.`, recommendation: "Complete or explicitly reclassify the promised commitment.", ignoreRisk: "A documented seller commitment remains unmet." },
      ar: { whyHere: "يوجد التزام منسوب إلى المندوب تجاوز موعده.", whyNow: `لا يوجد سجل إنجاز لاحق للالتزام المستحق في ${due}.`, recommendation: "أنجز الالتزام الموعود أو أعد تصنيفه بوضوح.", ignoreRisk: "يبقى التزام موثّق على المندوب دون إنجاز." },
    },
    ACTIVE_BUYER_PAUSE: {
      en: { whyHere: "An attributable buyer pause is active.", whyNow: "No valid buyer-initiated reengagement has replaced the restraint.", recommendation: "Wait and preserve the restraint boundary.", ignoreRisk: "Ignoring this recommendation may create observable chasing." },
      ar: { whyHere: "لا يزال طلب تريث منسوب إلى المشتري سارياً.", whyNow: "لم تحل عودة صالحة بدأها المشتري محل قيد التريث.", recommendation: "انتظر وحافظ على حدود عدم التواصل.", ignoreRisk: "قد يؤدي تجاهل التوصية إلى ملاحقة ملحوظة." },
    },
    ACTIVE_BUYER_PAUSE_WITH_OVERDUE_COMMITMENT: {
      en: { whyHere: "The buyer pause remains active and a seller commitment is overdue.", whyNow: `The commitment due at ${due} needs administrative reconciliation, but it cannot authorize buyer contact.`, recommendation: "Preserve the pause; reclassify or reconcile the seller commitment without contacting the buyer.", ignoreRisk: "Contact risks chasing; ignoring the seller obligation hides an unresolved commitment." },
      ar: { whyHere: "لا يزال تريث المشتري سارياً ويوجد التزام على المندوب تجاوز موعده.", whyNow: `يحتاج الالتزام المستحق في ${due} إلى تسوية إدارية، لكنه لا يسمح بالتواصل مع المشتري.`, recommendation: "احترم التريث وأعد تصنيف الالتزام أو سوّه إدارياً من دون التواصل مع المشتري.", ignoreRisk: "التواصل قد يصبح ملاحقة، وتجاهل التزام المندوب يخفي التزاماً غير محسوم." },
    },
    CONTRADICTORY_EVIDENCE: {
      en: { whyHere: "Attributable sources conflict, so a single action is not supported.", whyNow: "The contradiction remains unresolved in the current snapshot.", recommendation: "Review source provenance and resolve the contradiction before acting.", ignoreRisk: "A decision could be based on the wrong source state." },
      ar: { whyHere: "تتعارض مصادر قابلة للإسناد، لذلك لا تدعم إجراءً واحداً.", whyNow: "لا يزال التعارض بلا حل في اللقطة الحالية.", recommendation: "راجع مصدر الأدلة واحسم التعارض قبل التحرك.", ignoreRisk: "قد يُبنى القرار على حالة مصدر خاطئة." },
    },
    AGING_EVIDENCE_GAP: {
      en: { whyHere: "The opportunity lacks decision-grade evidence and has an aging observation window.", whyNow: "No decision-grade buyer request, pause, or resolved contradiction is established.", recommendation: "Review the evidence gap; do not manufacture urgency from silence.", ignoreRisk: "The evidence gap remains unresolved; silence itself is not treated as risk proof." },
      ar: { whyHere: "تفتقر الفرصة إلى أدلة بمستوى القرار وقد طال عمر نافذة الملاحظة.", whyNow: "لا يوجد طلب أو تريث من المشتري أو تعارض محلول بمستوى القرار.", recommendation: "راجع فجوة الأدلة ولا تصنع استعجالاً من الصمت.", ignoreRisk: "تبقى فجوة الأدلة بلا حل، ولا يُعامل الصمت كدليل خطر." },
    },
    INSUFFICIENT_EVIDENCE: {
      en: { whyHere: "Available evidence is insufficient for ACT or WAIT.", whyNow: "No decision-grade buyer request, pause, or resolved contradiction is established.", recommendation: "Capture or review evidence; do not manufacture urgency from silence.", ignoreRisk: "The evidence gap remains unresolved; silence itself is not treated as risk proof." },
      ar: { whyHere: "الأدلة المتاحة غير كافية للتحرك أو الانتظار.", whyNow: "لا يوجد طلب أو تريث من المشتري أو تعارض محلول بمستوى القرار.", recommendation: "سجّل الأدلة أو راجعها ولا تصنع استعجالاً من الصمت.", ignoreRisk: "تبقى فجوة الأدلة بلا حل، ولا يُعامل الصمت كدليل خطر." },
    },
    STALE_BUYER_SIGNAL: {
      en: { whyHere: "Decision-grade buyer evidence exists, but it is stale for present urgency.", whyNow: "The evidence is more than seven days old and must be revalidated before an immediate action recommendation.", recommendation: "Revalidate the buyer signal; do not preserve ACT NOW indefinitely.", ignoreRisk: "A stale signal may no longer describe the buyer's current request." },
      ar: { whyHere: "توجد أدلة للمشتري بمستوى القرار لكنها قديمة ولا تبرر استعجالاً حالياً.", whyNow: "مر أكثر من سبعة أيام على الدليل ويجب التحقق منه قبل توصية فورية.", recommendation: "تحقق من إشارة المشتري من جديد ولا تُبقِ التحرك الفوري إلى ما لا نهاية.", ignoreRisk: "قد لا تصف الإشارة القديمة طلب المشتري الحالي." },
    },
    STALE_SELLER_COMMITMENT: {
      en: { whyHere: "A seller commitment remains unresolved, but its urgency window is stale.", whyNow: "The commitment is more than seven days overdue and requires revalidation rather than permanent urgency.", recommendation: "Review and reclassify the stale obligation without inferring permission to contact the buyer.", ignoreRisk: "The unresolved obligation remains visible without manufacturing current urgency." },
      ar: { whyHere: "يبقى التزام على المندوب غير محسوم لكن نافذة استعجاله قديمة.", whyNow: "تجاوز الالتزام سبعة أيام ويحتاج مراجعة بدلاً من استعجال دائم.", recommendation: "راجع الالتزام القديم وأعد تصنيفه من دون استنتاج إذن بالتواصل مع المشتري.", ignoreRisk: "يبقى الالتزام غير المحسوم ظاهراً من دون صناعة استعجال حالي." },
    },
    FUTURE_EVIDENCE_EXCLUDED: {
      en: { whyHere: "Materially future-dated evidence was excluded from the current decision.", whyNow: "Future evidence cannot create present urgency and remains non-actionable until the runtime clock reaches it.", recommendation: "Correct or verify the timestamp before using the evidence.", ignoreRisk: "An unverified timestamp remains excluded and cannot support urgency." },
      ar: { whyHere: "تم استبعاد دليل مؤرخ في المستقبل بفارق جوهري من القرار الحالي.", whyNow: "لا ينشئ الدليل المستقبلي استعجالاً حالياً ويبقى غير قابل للاستخدام حتى يحين وقته.", recommendation: "صحح التاريخ أو تحقّق منه قبل استخدام الدليل.", ignoreRisk: "يبقى التاريخ غير المتحقق منه مستبعداً ولا يدعم الاستعجال." },
    },
  };
  return values[reason];
}

export function evidenceContract(snapshot: DeterministicDecisionSnapshot, events: readonly NormalizedSalesEvent[], asOf: string): EvidenceContract {
  const provenance = unique(events.filter((event) => snapshot.evidenceRefs.includes(event.sourceRef)).map((event) => event.sourceRef));
  const contradictions = snapshot.decisionState === "CONTRADICTORY_EVIDENCE" ? [...snapshot.evidenceRefs] : [];
  const missing = snapshot.decisionState === "INSUFFICIENT_EVIDENCE" ? ["Decision-grade attributable buyer evidence"] : [];
  const effective = Date.parse(snapshot.effectiveAt);
  const freshness = Number.isNaN(effective) || effective > Date.parse(asOf) + FUTURE_EVIDENCE_TOLERANCE_MS ? "UNKNOWN" : Date.parse(asOf) - effective > URGENCY_FRESHNESS_MS ? "STALE" : "CURRENT";
  const snapshotRecommendationValue = snapshotRecommendation(snapshot);
  return {
    recommendation: freshness === "STALE" && snapshotRecommendationValue === "ACT" ? "REVIEW" : snapshotRecommendationValue, primaryEvidence: [...snapshot.evidenceRefs], provenance,
    freshness, contradictions, missingInformation: missing, uncertainty: [...snapshot.uncertainty],
    governingPolicy: snapshot.policyVersion, reevaluationConditions: [...snapshot.reevaluationConditions],
    excludedEvidence: events.filter((event) => isMateriallyFuture(event.occurredAt, asOf)).map((event) => ({ sourceRef: event.sourceRef, reason: "FUTURE_TIMESTAMP" as const })),
  };
}

export function captureEvent(session: OperatorSession, input: QuickCaptureInput): OperatorSession {
  const opportunity = session.opportunities.find((item) => item.opportunityId === input.opportunityId);
  if (!opportunity || !validTime(input.occurredAt)) return session;
  const eventId = `capture-${stableHash(`${session.sessionId}|${input.opportunityId}|${input.kind}|${input.occurredAt}|${session.opportunities.reduce((n, item) => n + item.events.length, 0)}`)}`;
  const event: NormalizedSalesEvent = {
    organizationId: opportunity.events[0]?.organizationId ?? "operator-session",
    salesFloorId: opportunity.events[0]?.salesFloorId ?? "operator-session",
    leadId: opportunity.events[0]?.leadId ?? opportunity.opportunityId,
    actorId: input.operatorId, actorRole: "REP", eventId, occurredAt: new Date(input.occurredAt).toISOString(),
    channel: "OTHER", eventType: input.kind, direction: "INTERNAL",
    sourceRef: `operator-session:${session.sessionId}:${eventId}`,
    textOrSummary: input.note?.trim() || input.kind.replaceAll("_", " ").toLowerCase(),
    metadata: {
      evidenceOrigin: "OPERATOR_ENTERED",
      sourceClassification: "MANUAL_QUICK_CAPTURE",
      observedActorRole: buyerReportedCapture(input.kind) ? "BUYER_REPORTED_BY_OPERATOR" : "OPERATOR",
    },
  };
  const opportunities = session.opportunities.map((item) => item.opportunityId === input.opportunityId
    ? prepareOpportunity({ ...item, events: [...item.events, event] }, session.generatedAt)
    : item);
  return recalculate({
    ...session,
    opportunities,
    queue: buildCommandQueue(opportunities, session.generatedAt),
    trialSignals: [...session.trialSignals, trialSignal("QUICK_CAPTURE", event.occurredAt, session.trialSignals, input.opportunityId)],
  });
}

export function recordOverride(session: OperatorSession, opportunityId: string, operatorDecision: OverrideRecord["operatorDecision"], overrideReason: string, intendedAction: string, occurredAt: string): OperatorSession {
  const opportunity = session.opportunities.find((item) => item.opportunityId === opportunityId);
  const queueItem = session.queue.find((item) => item.opportunityId === opportunityId);
  if (!opportunity || !queueItem || !overrideReason.trim() || !intendedAction.trim() || !validTime(occurredAt)) return session;
  const snapshot = opportunity.decision.current;
  const record: OverrideRecord = {
    overrideId: `override-${stableHash(`${session.sessionId}|${snapshot.snapshotId}|${occurredAt}|${session.overrides.length}`)}`,
    opportunityId, snapshotId: snapshot.snapshotId, salesosRecommendation: snapshotRecommendation(snapshot),
    evidenceContract: cloneContract(queueItem.evidenceContract), operatorDecision, overrideReason: overrideReason.trim(),
    intendedAction: intendedAction.trim(), occurredAt: new Date(occurredAt).toISOString(), policyVersion: snapshot.policyVersion,
  };
  return recalculate({
    ...session,
    overrides: [...session.overrides, record],
    trialSignals: [...session.trialSignals, trialSignal("RECOMMENDATION_OVERRIDDEN", record.occurredAt, session.trialSignals, opportunityId)],
  });
}

export function recordTrialSignal(
  session: OperatorSession,
  kind: Exclude<TrialSignalKind, "QUEUE_OPENED" | "RECOMMENDATION_OVERRIDDEN" | "QUICK_CAPTURE">,
  occurredAt: string,
  opportunityId?: string,
  note?: string,
): OperatorSession {
  if (!validTime(occurredAt)) return session;
  if (opportunityId && !session.opportunities.some((item) => item.opportunityId === opportunityId)) return session;
  return recalculate({
    ...session,
    trialSignals: [...session.trialSignals, trialSignal(kind, occurredAt, session.trialSignals, opportunityId, note)],
  });
}

export function attachObservation(session: OperatorSession, overrideId: string, observation: Omit<PostDecisionObservation, "observationId" | "overrideId" | "causalConclusion">): OperatorSession {
  if (!session.overrides.some((item) => item.overrideId === overrideId) || !validTime(observation.occurredAt)) return session;
  const next: PostDecisionObservation = {
    ...observation, overrideId, causalConclusion: "NOT_ESTABLISHED",
    observationId: `observation-${stableHash(`${overrideId}|${observation.occurredAt}|${session.observations.length}`)}`,
  };
  return recalculate({ ...session, observations: [...session.observations, next] });
}

export function detectExperimentCandidate(session: OperatorSession, title: string, evidenceRefs: readonly string[]): OperatorSession {
  const sampleSize = evidenceRefs.length;
  const pattern: OperatorPattern = {
    patternId: `pattern-${stableHash(`${title}|${evidenceRefs.join("|")}`)}`, title,
    maturity: sampleSize < 3 ? "HYPOTHESIS" : "EXPERIMENT_CANDIDATE", sampleSize,
    evidenceRefs: [...evidenceRefs], limitation: "Observed association only; causation and repeatability are not established.",
  };
  if (session.patterns.some((item) => item.patternId === pattern.patternId)) return session;
  const experiments = pattern.maturity === "EXPERIMENT_CANDIDATE" ? [...session.experiments, {
    experimentId: `experiment-${stableHash(pattern.patternId)}`, observedPattern: title,
    currentDoctrineId: "DOC-EVIDENCE-FIRST", possibleContradiction: "Observed operator pattern may differ from current bounded guidance.",
    relevantSample: sampleSize, evidenceLimitations: pattern.limitation,
    proposedExperiment: "Run an operator-approved bounded comparison without autonomous customer action.",
    successCriterion: "Predeclared observable progression is present in the minimum sample.",
    failureCriterion: "The effect is absent, contradictory, or not observable.", minimumObservation: Math.max(5, sampleSize), status: "CANDIDATE" as const,
  }] : session.experiments;
  return recalculate({ ...session, patterns: [...session.patterns, pattern], experiments });
}

export function approveExperiment(session: OperatorSession, experimentId: string): OperatorSession {
  return recalculate({ ...session, experiments: session.experiments.map((item) => item.experimentId === experimentId ? { ...item, status: "APPROVED" } : item) });
}

export function createSanitizedExport(session: OperatorSession): SanitizedOperatorExport {
  const counts = { ACT_NOW: 0, COMMITMENTS_DUE: 0, REVIEW: 0, WAIT_PROTECTED: 0, AT_RISK_NEGLECT: 0 };
  session.queue.forEach((item) => { counts[item.section] += 1; });
  const leadLoss = session.leadLossReport;
  return {
    schemaVersion: "salesos-operator-export-v1", runId: session.sessionId, timestamp: session.generatedAt,
    policyVersions: unique(session.opportunities.map((item) => item.decision.current.policyVersion)),
    extractorVersions: unique(session.opportunities.map((item) => item.decision.current.extractorVersion)),
    commandQueueSummary: counts, decisionDiscipline: cloneMetrics(session.performance.decisionDiscipline),
    leadLossSummary: leadLoss ? {
      leadsReceived: pickMetric(leadLoss.leadsReceived), untouchedLeads: pickMetric(leadLoss.untouchedLeads),
      chasingViolations: pickMetric(leadLoss.chasingViolations), contradictoryEvidence: pickMetric(leadLoss.contradictoryEvidence),
    } : undefined,
    unresolvedContradictions: session.opportunities.filter((item) => item.decision.current.decisionState === "CONTRADICTORY_EVIDENCE").length,
    trialSummary: trialSummary(session.trialSignals),
    limitations: ["Descriptive operator-session evidence only; no causal, ROI, conversion-uplift, or correctness claim.", "Raw events, identities, notes, phone numbers, emails, and source references are excluded."],
    insufficientEvidence: session.opportunities.filter((item) => item.decision.current.decisionState === "INSUFFICIENT_EVIDENCE").map(() => "An opportunity remains insufficient; identifying details are suppressed."),
  };
}

export function exportAsMarkdown(value: SanitizedOperatorExport): string {
  return [
    `# SalesOS operator snapshot`, ``, `Run: ${value.runId}`, `Timestamp: ${value.timestamp}`,
    `Policy: ${value.policyVersions.join(", ")}`, `Extractor: ${value.extractorVersions.join(", ")}`,
    ``, `## Command Queue`, ...Object.entries(value.commandQueueSummary).map(([key, count]) => `- ${key}: ${count}`),
    ``, `## Decision discipline`, ...Object.entries(value.decisionDiscipline).map(([key, metric]) => `- ${key}: ${metric.numerator} / ${metric.denominator}${metric.value === null ? " (insufficient evidence)" : ""}`),
    ``, `## Unresolved contradictions`, `${value.unresolvedContradictions}`,
    ``, `## Seven-day trial signals`, ...Object.entries(value.trialSummary).map(([key, count]) => `- ${key}: ${count}`),
    ``, `## Limitations`, ...value.limitations.map((item) => `- ${item}`),
    ``, `## Insufficient evidence`, ...(value.insufficientEvidence.length ? value.insufficientEvidence.map((item) => `- ${item}`) : ["- None in the current bounded decision set."]),
  ].join("\n");
}

export function clearOperatorSession(): null { return null; }

function trialSignal(kind: TrialSignalKind, occurredAt: string, existing: readonly TrialSignal[], opportunityId?: string, note?: string): TrialSignal {
  return {
    signalId: `trial-${stableHash(`${kind}|${occurredAt}|${existing.length}`)}`,
    kind,
    occurredAt: new Date(occurredAt).toISOString(),
    opportunityId,
    note: note?.trim() || undefined,
    sourceClassification: "OPERATOR_TRIAL_OBSERVATION",
  };
}

function trialSummary(signals: readonly TrialSignal[]): Record<TrialSignalKind, number> {
  const summary: Record<TrialSignalKind, number> = {
    QUEUE_OPENED: 0, RECOMMENDATION_ACCEPTED: 0, RECOMMENDATION_OVERRIDDEN: 0, QUICK_CAPTURE: 0,
    INCORRECT_PRIORITY: 0, FALSE_URGENCY: 0, MISSED_IMPORTANT_OPPORTUNITY: 0, NO_ACTION_USEFUL: 0,
    MISSED_COMMITMENT: 0, WORKFLOW_ABANDONED: 0, FEATURE_IGNORED: 0,
  };
  signals.forEach((signal) => { summary[signal.kind] += 1; });
  return summary;
}

function recalculate(session: OperatorSession): OperatorSession {
  const performanceLedger = performance(session);
  return {
    ...session,
    performance: performanceLedger,
    operatorProfile: profile(session, performanceLedger),
    leadLossReport: buildLeadLossReport(buildReportCases(session.opportunities, session.generatedAt), session.generatedAt),
  };
}

function performance(session: OperatorSession): PerformanceLedger {
  const opps = session.opportunities;
  const usableEvents = opps.flatMap((item) => item.events).filter((event) => isEvidenceUsableAt(event.occurredAt, session.generatedAt));
  const outcomes = usableEvents.filter((event) => ["EOI", "RESERVATION", "CLOSE"].includes(event.eventType));
  const act = session.queue.filter((item) => item.evidenceContract.recommendation === "ACT");
  const supported = session.queue.filter((item) => item.evidenceContract.primaryEvidence.length > 0);
  const chasing = opps.filter((item) => item.decision.current.historicalFindings.length > 0 || observableChasingRefs(item.events.filter((event) => isEvidenceUsableAt(event.occurredAt, session.generatedAt))).length > 0);
  const metric = (numerator: number, denominator: number, statement: string): MetricValue => ({ numerator, denominator, value: denominator === 0 ? null : numerator / denominator, statement });
  return {
    decisionDiscipline: {
      nextStepSecured: metric(usableEvents.filter((event) => event.eventType === "MEETING_SCHEDULED").length, act.length, "Observed next steps secured over evidence-backed ACT opportunities."),
      strongSignalResponseLatency: metric(0, 0, "Response latency requires an attributable strong signal followed by an observable outbound response."),
      evidenceSupported: metric(supported.length, session.queue.length, "Share of queue recommendations with attributable primary evidence."),
      overrides: metric(session.overrides.length, session.queue.length, "Recorded material disagreements per current queue item."),
      observableChasing: metric(chasing.length, opps.length, "Observable chasing findings; not a personality or fault score."),
      commitmentCompletion: metric(usableEvents.filter((event) => event.eventType === "COMMITMENT_COMPLETED").length, usableEvents.filter((event) => ["PROMISED_FOLLOWUP", "SELLER_COMMITMENT"].includes(event.eventType)).length, "Observed completed commitments over recorded commitments."),
    },
    pipelineProgression: {
      nextStepReady: metric(act.length, opps.length, "Current opportunities with evidence-backed next-step readiness."),
      qualifiedToMeeting: metric(0, 0, "Qualified-to-meeting progression is reported only when both stages are explicitly observed."),
      meetingToMeaningfulNextStep: metric(0, 0, "Meeting progression requires explicit meeting and next-step records."),
      stalledReactivated: metric(opps.filter((item) => item.decision.current.reasonCodes.includes("BUYER_REENGAGED_AFTER_RESTRAINT")).length, opps.filter((item) => item.decision.snapshots.some((snapshot) => snapshot.decisionState === "NO_ACTION")).length, "Observed buyer-initiated reengagement over previously restrained opportunities."),
      unresolved: metric(opps.filter((item) => ["INSUFFICIENT_EVIDENCE", "CONTRADICTORY_EVIDENCE"].includes(item.decision.current.decisionState)).length, opps.length, "Current unresolved evidence states."),
      ambiguousTime: metric(0, 0, "Time in ambiguity needs a complete observation interval; it is not inferred from missing events."),
    },
    commercialOutcomes: {
      explicitlyKnown: metric(outcomes.length, opps.length, "Explicitly captured EOI, reservation, or close events only; missing outcomes are not failures."),
      eoi: metric(outcomes.filter((event) => event.eventType === "EOI").length, opps.length, "Explicitly recorded EOI only."),
      reservations: metric(outcomes.filter((event) => event.eventType === "RESERVATION").length, opps.length, "Explicitly recorded reservations only."),
      closes: metric(outcomes.filter((event) => event.eventType === "CLOSE").length, opps.length, "Explicitly recorded closes only."),
      dealValue: metric(0, 0, "Deal value is unavailable unless explicitly captured as a commercial outcome."),
      commission: metric(0, 0, "Commission is unavailable unless explicitly captured."),
      concessions: metric(usableEvents.filter((event) => event.eventType === "CONCESSION").length, opps.length, "Explicit concession records only; no commercial judgment is inferred."),
    },
    learning: {
      disagreements: metric(session.overrides.length, session.queue.length, "Recorded operator disagreements; no winner is inferred."),
      experimentCandidates: metric(session.experiments.filter((item) => item.status === "CANDIDATE").length, session.patterns.length, "Observed patterns eligible for operator review, not doctrine mutation."),
      completedExperiments: metric(session.experiments.filter((item) => item.status === "COMPLETED").length, session.experiments.filter((item) => item.status !== "CANDIDATE").length, "Completed operator-approved experiments over activated experiments."),
      doctrineChangesEarned: metric(0, session.experiments.filter((item) => item.status === "COMPLETED").length, "Doctrine changes require completed validated experiments and explicit review."),
    },
    causalBoundary: "DESCRIPTIVE_ASSOCIATION_ONLY",
  };
}

function profile(session: OperatorSession, ledger: PerformanceLedger): OperatorProfile {
  const metric = (group: Record<string, MetricValue>, key: string) => group[key] ?? { numerator: 0, denominator: 0, value: null, statement: "Insufficient observable evidence." };
  return {
    operatorId: session.operatorId,
    profileVersion: "operator-profile-v0",
    boundary: "EVIDENCE_BACKED_OPERATING_PATTERNS_NOT_PERSONALITY",
    patterns: session.patterns.map((pattern) => ({ ...pattern, evidenceRefs: [...pattern.evidenceRefs] })),
    measures: {
      nextStepSecuredRate: metric(ledger.decisionDiscipline, "nextStepSecured"),
      strongSignalResponseLatency: metric(ledger.decisionDiscipline, "strongSignalResponseLatency"),
      commitmentCompletion: metric(ledger.decisionDiscipline, "commitmentCompletion"),
      observableChasing: metric(ledger.decisionDiscipline, "observableChasing"),
      unresolvedOpportunities: metric(ledger.pipelineProgression, "unresolved"),
      overrideFrequency: metric(ledger.decisionDiscipline, "overrides"),
      qualificationCompleteness: { numerator: 0, denominator: 0, value: null, statement: "Qualification completeness requires an explicit qualification contract." },
      stageProgression: metric(ledger.pipelineProgression, "qualifiedToMeeting"),
      concessionBehavior: metric(ledger.commercialOutcomes, "concessions"),
    },
  };
}

function buildReportCases(opportunities: readonly OperatorOpportunity[], asOf?: string): LeadLossCase[] {
  return opportunities.map((item) => {
    const validEvents = item.events.filter((event) => validTime(event.occurredAt) && (!asOf || isEvidenceUsableAt(event.occurredAt, asOf)));
    const observedThrough = [...validEvents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).at(-1)?.occurredAt ?? "UNAVAILABLE";
    const sourcePairs = new Map<string, "CRM_CSV" | "WHATSAPP_EXPORT">();
    validEvents.forEach((event) => {
      if (event.channel === "CRM") sourcePairs.set(event.sourceRef, "CRM_CSV");
      if (event.channel === "WHATSAPP") sourcePairs.set(event.sourceRef, "WHATSAPP_EXPORT");
    });
    return {
      caseId: item.opportunityId,
      leadId: validEvents[0]?.leadId ?? item.opportunityId,
      buyerAlias: item.displayLabel,
      opportunityId: item.opportunityId,
      assignedRepId: validEvents.find((event) => event.actorRole === "REP")?.actorId,
      events: validEvents,
      decision: item.decision,
      freshness: { state: "CURRENT", observedThrough },
      sources: [...sourcePairs].map(([sourceRef, sourceType]) => ({ sourceRef, sourceType })),
      restraintObservation: item.decision.current.decisionState === "NO_ACTION" ? {
        state: observableChasingRefs(validEvents).length ? "CHASING_VIOLATION" : "NOT_OBSERVABLE",
        window: observedThrough,
        sourceRefs: observableChasingRefs(validEvents),
      } : undefined,
      managerReviewHistory: [],
    };
  });
}

function initialDoctrine(at: string): DoctrineItem[] {
  return [{
    doctrineId: "DOC-EVIDENCE-FIRST", title: "Evidence before action", description: "Material ACT or WAIT guidance requires attributable bounded evidence.",
    version: "1.0.0", status: "ACTIVE", evidenceRequirement: "Attributable source evidence plus explicit uncertainty and reevaluation conditions.",
    rationale: "Fail closed when evidence cannot support a bounded recommendation.", source: "SalesOS product safety boundary", scope: "SALESOS_CORE", createdAt: at, changedAt: at,
  }, {
    doctrineId: "DOC-SILENCE", title: "Silence is not intent", description: "Silence alone does not establish urgency, rejection, or readiness.",
    version: "1.0.0", status: "ACTIVE", evidenceRequirement: "New attributable buyer or validated context evidence.",
    rationale: "Absence of a response is ambiguous.", source: "SalesOS deterministic policy", scope: "SALESOS_CORE", createdAt: at, changedAt: at,
  }];
}

function emptyPerformance(): PerformanceLedger { return { decisionDiscipline: {}, pipelineProgression: {}, commercialOutcomes: {}, learning: {}, causalBoundary: "DESCRIPTIVE_ASSOCIATION_ONLY" }; }
function emptyProfile(operatorId: string): OperatorProfile { return { operatorId, profileVersion: "operator-profile-v0", boundary: "EVIDENCE_BACKED_OPERATING_PATTERNS_NOT_PERSONALITY", patterns: [], measures: { nextStepSecuredRate: emptyMetric(), strongSignalResponseLatency: emptyMetric(), commitmentCompletion: emptyMetric(), observableChasing: emptyMetric(), unresolvedOpportunities: emptyMetric(), overrideFrequency: emptyMetric(), qualificationCompleteness: emptyMetric(), stageProgression: emptyMetric(), concessionBehavior: emptyMetric() } }; }
function emptyMetric(): MetricValue { return { numerator: 0, denominator: 0, value: null, statement: "Insufficient observable evidence." }; }
function cloneOpportunity(item: OperatorOpportunity): OperatorOpportunity { return { ...item, events: item.events.map((event) => ({ ...event, metadata: { ...event.metadata } })), decision: item.decision }; }
function cloneContract(value: EvidenceContract): EvidenceContract { return { ...value, primaryEvidence: [...value.primaryEvidence], provenance: [...value.provenance], contradictions: [...value.contradictions], missingInformation: [...value.missingInformation], uncertainty: [...value.uncertainty], reevaluationConditions: [...value.reevaluationConditions], excludedEvidence: value.excludedEvidence.map((item) => ({ ...item })) }; }
function cloneMetrics(value: Record<string, MetricValue>): Record<string, MetricValue> { return Object.fromEntries(Object.entries(value).map(([key, metric]) => [key, { ...metric }])); }
function pickMetric(metric: { numerator: number; denominator: number }) { return { numerator: metric.numerator, denominator: metric.denominator }; }
function latestEvent(events: readonly NormalizedSalesEvent[], types: readonly string[]) { return [...events].filter((event) => types.includes(event.eventType)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).at(-1); }
function prepareOpportunity(item: OperatorOpportunity, asOf: string): OperatorOpportunity {
  const cloned = cloneOpportunity(item);
  const usableEvents = cloned.events.filter((event) => isEvidenceUsableAt(event.occurredAt, asOf));
  return { ...cloned, decision: buildDecisionSequence(usableEvents) };
}
function isMateriallyFuture(occurredAt: string, asOf: string): boolean {
  return validTime(occurredAt) && validTime(asOf) && Date.parse(occurredAt) > Date.parse(asOf) + FUTURE_EVIDENCE_TOLERANCE_MS;
}
function isEvidenceUsableAt(occurredAt: string, asOf: string): boolean { return validTime(occurredAt) && !isMateriallyFuture(occurredAt, asOf); }
function isMeaningfulLeadEngagement(event: NormalizedSalesEvent): boolean {
  return event.direction !== "INTERNAL" && event.eventType !== "OPERATOR_NOTE";
}
function buyerReportedCapture(kind: QuickCaptureInput["kind"]): boolean { return ["CLIENT_CALLED", "CLIENT_REPLIED", "CLIENT_REQUESTED_OPTIONS", "CLIENT_POSTPONED", "BUDGET_CLARIFIED", "PARTNER_APPROVAL_REQUIRED", "OBJECTION", "EXPLICIT_REJECTION", "NEW_TIMELINE", "EOI", "RESERVATION"].includes(kind); }
function observableChasingRefs(events: readonly NormalizedSalesEvent[]): string[] {
  const ordered = [...events].filter((event) => validTime(event.occurredAt)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const pause = ordered.findLast((event) => event.eventType === "BUYER_EXPLICIT_PAUSE" && ["BUYER", "BUYER_DELEGATE"].includes(event.actorRole));
  if (!pause) return [];
  const reengagement = ordered.find((event) => event.occurredAt > pause.occurredAt && ["BUYER_REQUEST", "BUYER_REENGAGEMENT", "PROCUREMENT_SIGNAL"].includes(event.eventType) && ["BUYER", "BUYER_DELEGATE"].includes(event.actorRole));
  const contacts = ordered.filter((event) => event.actorRole === "REP" && event.direction === "OUTBOUND" && event.occurredAt > pause.occurredAt && (!reengagement || event.occurredAt < reengagement.occurredAt));
  return contacts.length ? unique([pause.sourceRef, ...contacts.map((event) => event.sourceRef)]) : [];
}
function validTime(value: string) { return !Number.isNaN(Date.parse(value)); }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
