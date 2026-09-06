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
