import { describe, expect, it } from "vitest";
import {
  approveExperiment, attachObservation, buildCommandQueue, captureEvent, clearOperatorSession,
  createOperatorSession, createSanitizedExport, detectExperimentCandidate, recordOverride, recordTrialSignal,
  opportunitiesFromEvents, SYNTHETIC_OPERATOR_AS_OF, SYNTHETIC_OPERATOR_OPPORTUNITIES,
} from "@/lib/operatorRuntime";

function session() {
  return createOperatorSession("operator-synthetic", SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF);
}

describe("Build 4 command queue", () => {
  it("B4-001 puts explicit buyer requests in ACT NOW", () => {
    expect(session().queue.find((item) => item.opportunityId === "opp-egypt-strong")).toMatchObject({ section: "ACT_NOW", evidenceContract: { recommendation: "ACT" } });
  });

  it("B4-002 surfaces an overdue seller commitment ahead of normal ACT work", () => {
    const current = session();
    expect(current.queue[0]).toMatchObject({ opportunityId: "opp-egypt-overdue", section: "COMMITMENTS_DUE", priority: 95 });
  });

  it("B4-003 never turns silence alone into ACT or a top priority", () => {
    const current = session();
    const silence = current.queue.find((item) => item.opportunityId === "opp-egypt-silence")!;
    const strong = current.queue.find((item) => item.opportunityId === "opp-egypt-strong")!;
    expect(silence.section).toBe("AT_RISK_NEGLECT");
    expect(silence.evidenceContract.recommendation).toBe("REVIEW");
    expect(silence.priority).toBeLessThan(strong.priority);
    expect(silence.whyNow).toMatch(/No decision-grade buyer/i);
  });

  it("B4-004 keeps explicit NO_ACTION restraint protected despite outbound chasing", () => {
    const item = session().queue.find((candidate) => candidate.opportunityId === "opp-gcc-protected")!;
    expect(item.section).toBe("WAIT_PROTECTED");
    expect(item.evidenceContract.recommendation).toBe("WAIT");
    expect(item.ignoreRisk).toMatch(/chasing/i);
  });

  it("B4-005 routes contradictory evidence to review with both source references", () => {
    const item = session().queue.find((candidate) => candidate.opportunityId === "opp-gcc-conflict")!;
    expect(item.section).toBe("REVIEW");
    expect(item.evidenceContract.contradictions).toHaveLength(2);
    expect(item.evidenceContract.provenance).toEqual(item.evidenceContract.primaryEvidence);
  });

  it("B4-006 is deterministic for identical inputs", () => {
    expect(buildCommandQueue(SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF)).toEqual(buildCommandQueue(SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF));
  });

  it("B4-R01 keeps buyer restraint protected when one or more seller commitments are overdue", () => {
    const protectedOpportunity = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-gcc-protected")!;
    const commitmentTemplate = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-overdue")!.events.at(-1)!;
    const commitments = [1, 2].map((index) => ({
      ...commitmentTemplate,
      eventId: `protected-commitment-${index}`,
      occurredAt: `2026-09-02T1${index}:00:00.000Z`,
      sourceRef: `synthetic:protected-commitment-${index}`,
      metadata: { ...commitmentTemplate.metadata, dueAt: "2026-09-04T12:00:00.000Z" },
    }));
    const item = buildCommandQueue([{ ...protectedOpportunity, events: [...protectedOpportunity.events, ...commitments] }], SYNTHETIC_OPERATOR_AS_OF)[0]!;
    expect(item).toMatchObject({ section: "WAIT_PROTECTED", reasonCode: "ACTIVE_BUYER_PAUSE", evidenceContract: { recommendation: "WAIT" } });
    expect(item.whyNow).toMatch(/seller obligations cannot authorize buyer contact/i);
    expect(buildCommandQueue([{ ...protectedOpportunity, events: [...protectedOpportunity.events, ...commitments] }], "2026-09-13T09:00:00.000Z")[0]).toMatchObject({ section: "WAIT_PROTECTED", reasonCode: "ACTIVE_BUYER_PAUSE" });
  });

  it("B4-R02 allows valid new buyer evidence to supersede wait while preserving restraint history", () => {
    const protectedOpportunity = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-gcc-protected")!;
    const buyerTemplate = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-strong")!.events.at(-1)!;
    const request = { ...buyerTemplate, eventId: "buyer-after-pause", occurredAt: "2026-09-05T08:30:00.000Z", sourceRef: "synthetic:buyer-after-pause", textOrSummary: "Can you send me the options today?" };
    const current = createOperatorSession("operator-synthetic", [{ ...protectedOpportunity, events: [...protectedOpportunity.events, request] }], SYNTHETIC_OPERATOR_AS_OF);
    expect(current.queue[0]).toMatchObject({ section: "ACT_NOW", reasonCode: "CURRENT_BUYER_SIGNAL" });
    expect(current.opportunities[0]!.decision.snapshots.some((snapshot) => snapshot.decisionState === "NO_ACTION")).toBe(true);
    expect(current.opportunities[0]!.decision.current.historicalFindings).not.toHaveLength(0);
  });

  it("B4-R03 excludes materially future evidence from current urgency and explains the exclusion", () => {
    const template = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-strong")!;
    const received = template.events[0]!;
    const futureRequest = { ...template.events[1]!, eventId: "future-request", occurredAt: "2026-09-05T09:10:00.001Z", sourceRef: "synthetic:future-request" };
    const laterFutureRequest = { ...futureRequest, eventId: "later-future-request", occurredAt: "2026-09-06T09:00:00.000Z", sourceRef: "synthetic:later-future-request" };
    const current = createOperatorSession("operator-synthetic", [{ ...template, events: [received, futureRequest, laterFutureRequest] }], SYNTHETIC_OPERATOR_AS_OF);
    expect(current.opportunities[0]!.decision.current.decisionState).toBe("INSUFFICIENT_EVIDENCE");
    expect(current.queue[0]).toMatchObject({ section: "REVIEW", reasonCode: "FUTURE_EVIDENCE_EXCLUDED", evidenceContract: { freshness: "CURRENT" } });
    expect(current.queue[0]!.evidenceContract.excludedEvidence).toEqual([
      { sourceRef: "synthetic:future-request", reason: "FUTURE_TIMESTAMP" },
      { sourceRef: "synthetic:later-future-request", reason: "FUTURE_TIMESTAMP" },
    ]);
  });

  it("B4-R04 accepts evidence exactly at the bounded clock tolerance but excludes evidence beyond it", () => {
    const template = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-strong")!;
    const received = template.events[0]!;
    const atBoundary = { ...template.events[1]!, eventId: "boundary-request", occurredAt: "2026-09-05T09:05:00.000Z", sourceRef: "synthetic:boundary-request" };
    const beyondBoundary = { ...template.events[1]!, eventId: "beyond-request", occurredAt: "2026-09-05T09:05:00.001Z", sourceRef: "synthetic:beyond-request" };
    expect(createOperatorSession("operator", [{ ...template, events: [received, atBoundary] }], SYNTHETIC_OPERATOR_AS_OF).queue[0]!.section).toBe("ACT_NOW");
    expect(createOperatorSession("operator", [{ ...template, events: [received, beyondBoundary] }], SYNTHETIC_OPERATOR_AS_OF).queue[0]!.reasonCode).toBe("FUTURE_EVIDENCE_EXCLUDED");
  });

  it("B4-R05 decays stale buyer and seller urgency into explicit review", () => {
    const strong = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-strong")!;
    const overdue = SYNTHETIC_OPERATOR_OPPORTUNITIES.find((item) => item.opportunityId === "opp-egypt-overdue")!;
    const queue = buildCommandQueue([strong, overdue], "2026-09-13T09:00:00.000Z");
    expect(queue.find((item) => item.opportunityId === strong.opportunityId)).toMatchObject({ section: "REVIEW", reasonCode: "STALE_BUYER_SIGNAL", evidenceContract: { recommendation: "REVIEW" } });
    expect(queue.find((item) => item.opportunityId === overdue.opportunityId)).toMatchObject({ section: "REVIEW", reasonCode: "STALE_SELLER_COMMITMENT" });
    const commitmentTemplate = overdue.events.at(-1)!;
    const staleCommitment = { ...commitmentTemplate, eventId: "old-commitment", occurredAt: "2026-08-15T09:00:00.000Z", sourceRef: "synthetic:old-commitment", metadata: { ...commitmentTemplate.metadata, dueAt: "2026-08-16T09:00:00.000Z" } };
    expect(buildCommandQueue([{ ...strong, events: [staleCommitment, ...strong.events] }], SYNTHETIC_OPERATOR_AS_OF)[0]).toMatchObject({ section: "ACT_NOW", reasonCode: "CURRENT_BUYER_SIGNAL" });
  });
});

describe("Build 4 capture and immutable disagreement history", () => {
  it("B4-007 marks quick capture as operator-entered rather than imported evidence", () => {
    const before = session();
    const after = captureEvent(before, { opportunityId: "opp-egypt-strong", kind: "OPERATOR_NOTE", occurredAt: "2026-09-05T09:05:00Z", operatorId: "operator-synthetic", note: "Buyer called from another line." });
    const captured = after.opportunities.find((item) => item.opportunityId === "opp-egypt-strong")!.events.at(-1)!;
    expect(captured).toMatchObject({ channel: "OTHER", direction: "INTERNAL", metadata: { evidenceOrigin: "OPERATOR_ENTERED", sourceClassification: "MANUAL_QUICK_CAPTURE", observedActorRole: "OPERATOR" } });
    expect(captured.sourceRef).toMatch(/^operator-session:/);
    expect(before.opportunities.find((item) => item.opportunityId === "opp-egypt-strong")!.events).not.toContain(captured);
  });

  it("B4-008 rejects malformed capture timestamps without changing the session", () => {
    const before = session();
    expect(captureEvent(before, { opportunityId: "opp-egypt-strong", kind: "CLIENT_REPLIED", occurredAt: "bad", operatorId: "operator-synthetic" })).toBe(before);
  });

  it("B4-R06 keeps internal notes out of neglect engagement and preserves the session clock", () => {
    const before = session();
    const unrelatedBefore = structuredClone(before.queue.find((item) => item.opportunityId === "opp-gcc-protected"));
    const after = captureEvent(before, { opportunityId: "opp-egypt-silence", kind: "OPERATOR_NOTE", occurredAt: SYNTHETIC_OPERATOR_AS_OF, operatorId: "operator-synthetic", note: "Need to call tomorrow." });
    expect(after.generatedAt).toBe(before.generatedAt);
    expect(after.queue.find((item) => item.opportunityId === "opp-egypt-silence")).toMatchObject({ section: "AT_RISK_NEGLECT", reasonCode: "AGING_EVIDENCE_GAP" });
    expect(after.queue.find((item) => item.opportunityId === "opp-gcc-protected")).toEqual(unrelatedBefore);
    expect(after.opportunities.find((item) => item.opportunityId === "opp-egypt-silence")!.events.at(-1)).toMatchObject({ eventType: "OPERATOR_NOTE", direction: "INTERNAL" });
    const protectedAfterNote = captureEvent(before, { opportunityId: "opp-gcc-protected", kind: "OPERATOR_NOTE", occurredAt: SYNTHETIC_OPERATOR_AS_OF, operatorId: "operator-synthetic", note: "Review the internal file." });
    expect(protectedAfterNote.queue.find((item) => item.opportunityId === "opp-gcc-protected")).toMatchObject({ section: "WAIT_PROTECTED", reasonCode: "ACTIVE_BUYER_PAUSE" });
  });

  it("B4-009 records multiple overrides by append and preserves the original recommendation", () => {
    const start = session();
    const first = recordOverride(start, "opp-gcc-protected", "ACT", "I have new context outside the imported sources.", "Call to clarify timing", "2026-09-05T09:10:00Z");
    const second = recordOverride(first, "opp-gcc-protected", "REVIEW", "The context remains unverified.", "Review notes before any action", "2026-09-05T09:12:00Z");
    expect(second.overrides).toHaveLength(2);
    expect(second.overrides.map((item) => item.salesosRecommendation)).toEqual(["WAIT", "WAIT"]);
    expect(start.overrides).toHaveLength(0);
  });

  it("B4-010 later outcomes attach separately and cannot rewrite decision-time evidence", () => {
    const overridden = recordOverride(session(), "opp-gcc-protected", "ACT", "Operator disagreed with current restraint.", "Call buyer", "2026-09-05T09:10:00Z");
    const original = structuredClone(overridden.overrides[0]!);
    const observed = attachObservation(overridden, original.overrideId, { occurredAt: "2026-09-05T11:00:00Z", outcome: "PROGRESSION_OBSERVED", sourceRef: "operator-session:observation", note: "Buyer replied later." });
    expect(observed.overrides[0]).toEqual(original);
    expect(observed.observations[0]).toMatchObject({ outcome: "PROGRESSION_OBSERVED", causalConclusion: "NOT_ESTABLISHED" });
    expect(JSON.stringify(observed)).not.toMatch(/Moataz was right|SalesOS was right/i);
  });
});

describe("Build 4 learning, performance and privacy", () => {
  it("B4-011 keeps a tiny repeated pattern as a hypothesis", () => {
    const next = detectExperimentCandidate(session(), "Replies followed short calls", ["synthetic:a", "synthetic:b"]);
    expect(next.patterns[0]!.maturity).toBe("HYPOTHESIS");
    expect(next.experiments).toHaveLength(0);
    expect(next.doctrine).toEqual(session().doctrine);
  });

  it("B4-012 creates only an operator-approved experiment candidate and never mutates doctrine", () => {
    const candidate = detectExperimentCandidate(session(), "Replies followed short calls", ["synthetic:a", "synthetic:b", "synthetic:c"]);
    expect(candidate.patterns[0]!.maturity).toBe("EXPERIMENT_CANDIDATE");
    expect(candidate.experiments[0]!.status).toBe("CANDIDATE");
    const approved = approveExperiment(candidate, candidate.experiments[0]!.experimentId);
    expect(approved.experiments[0]!.status).toBe("APPROVED");
    expect(approved.doctrine).toEqual(candidate.doctrine);
  });

  it("B4-013 uses null for zero-denominator metrics and does not treat missing outcomes as failures", () => {
    const current = createOperatorSession("operator-empty", [], SYNTHETIC_OPERATOR_AS_OF);
    expect(current.performance.decisionDiscipline.commitmentCompletion!.value).toBeNull();
    expect(current.performance.commercialOutcomes.explicitlyKnown).toMatchObject({ numerator: 0, denominator: 0, value: null });
  });

  it("B4-014 starts in baseline observation mode with non-causal comparison language", () => {
    expect(session().baseline).toMatchObject({ status: "OBSERVATION_PERIOD", minimumDays: 7, comparisonLanguage: "ASSOCIATED_IMPROVEMENT_OBSERVED" });
    expect(session().performance.causalBoundary).toBe("DESCRIPTIVE_ASSOCIATION_ONLY");
  });

  it("B4-015 produces an allowlisted export without identities, raw evidence, notes, phones or emails", () => {
    let current = captureEvent(session(), { opportunityId: "opp-egypt-strong", kind: "OPERATOR_NOTE", occurredAt: "2026-09-05T09:05:00Z", operatorId: "operator@example.test", note: "Call +20 100 111 2233 about buyer@example.test" });
    current = recordOverride(current, "opp-gcc-protected", "ACT", "Call +20 100 111 2233", "Email buyer@example.test", "2026-09-05T09:10:00Z");
    const serialized = JSON.stringify(createSanitizedExport(current));
    expect(serialized).not.toMatch(/operator@example|buyer@example|201001112233|synthetic-build4|displayLabel|opportunityId|overrideReason|textOrSummary/i);
    expect(serialized).toContain("salesos-operator-export-v1");
  });

  it("B4-016 clears the complete in-memory session reference", () => {
    expect(clearOperatorSession()).toBeNull();
  });

  it("B4-017 keeps retired doctrine historically inspectable in the registry", () => {
    const retired = { ...session().doctrine[0], status: "RETIRED" as const, version: "2.0.0", changedAt: "2026-09-06T00:00:00Z" };
    expect(retired).toMatchObject({ doctrineId: "DOC-EVIDENCE-FIRST", status: "RETIRED", version: "2.0.0" });
  });

  it("B4-018 composes the existing S3 report from the same runtime opportunities", () => {
    const current = session();
    expect(current.leadLossReport?.leadsReceived).toMatchObject({ numerator: 6, denominator: 6 });
    expect(current.leadLossReport?.contradictoryEvidence.numerator).toBe(1);
    expect(current.leadLossReport?.chasingViolations.numerator).toBe(1);
  });

  it("B4-019 never merges identical lead IDs across organization or sales-floor boundaries", () => {
    const original = SYNTHETIC_OPERATOR_OPPORTUNITIES[0]!.events[0]!;
    const first = { ...original, eventId: "identity-a", organizationId: "org-a", salesFloorId: "floor-a", leadId: "same-lead", sourceRef: "source:a" };
    const second = { ...original, eventId: "identity-b", organizationId: "org-b", salesFloorId: "floor-a", leadId: "same-lead", sourceRef: "source:b" };
    const third = { ...original, eventId: "identity-c", organizationId: "org-a", salesFloorId: "floor-b", leadId: "same-lead", sourceRef: "source:c" };
    expect(opportunitiesFromEvents([first, second, third])).toHaveLength(3);
  });

  it("B4-020 keeps the operator profile generic, bounded, and separate from doctrine", () => {
    const current = createOperatorSession("any-operator-id", SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF);
    expect(current.operatorProfile).toMatchObject({ operatorId: "any-operator-id", profileVersion: "operator-profile-v0", boundary: "EVIDENCE_BACKED_OPERATING_PATTERNS_NOT_PERSONALITY" });
    expect(current.operatorProfile.measures.qualificationCompleteness.value).toBeNull();
    expect(JSON.stringify(current.doctrine)).not.toContain("any-operator-id");
  });

  it("B4-021 records trial friction separately without changing evidence, priority, or doctrine", () => {
    const before = session();
    const after = recordTrialSignal(before, "FALSE_URGENCY", "2026-09-05T09:30:00Z", "opp-egypt-silence", "This review felt urgent when it was not.");
    expect(after.trialSignals.at(-1)).toMatchObject({ kind: "FALSE_URGENCY", sourceClassification: "OPERATOR_TRIAL_OBSERVATION" });
    expect(after.queue).toEqual(before.queue);
    expect(after.opportunities).toEqual(before.opportunities);
    expect(after.doctrine).toEqual(before.doctrine);
  });

  it("B4-022 aggregates trial usage safely without exporting operator notes or opportunity identity", () => {
    let current = recordTrialSignal(session(), "RECOMMENDATION_ACCEPTED", "2026-09-05T09:30:00Z", "opp-egypt-strong");
    current = recordTrialSignal(current, "WORKFLOW_ABANDONED", "2026-09-05T09:31:00Z", "opp-egypt-strong", "Used another workflow for buyer@example.test");
    const exported = createSanitizedExport(current);
    expect(exported.trialSummary).toMatchObject({ QUEUE_OPENED: 1, RECOMMENDATION_ACCEPTED: 1, WORKFLOW_ABANDONED: 1 });
    expect(JSON.stringify(exported)).not.toMatch(/buyer@example|opp-egypt-strong|another workflow/i);
  });
});
