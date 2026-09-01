import { describe, expect, it } from "vitest";
import type { NormalizedSalesEvent } from "@/lib/realInput";
import {
  buildDecisionSequence,
  DECISION_ENGINE_FIXTURES,
  EXTRACTOR_VERSION,
  extractEvidence,
  POLICY_VERSION,
  type EvidenceSignalType,
} from "@/lib/decisionEngine";

describe("S2 bounded evidence extraction", () => {
  it("S2-001 emits versioned signals with mandatory provenance and bounded pointers", () => {
    const result = extractEvidence(DECISION_ENGINE_FIXTURES.directRequest);
    expect(result.extractorVersion).toBe(EXTRACTOR_VERSION);
    for (const signal of result.signals) {
      expect(signal.signalId).toMatch(/^signal-/);
      expect(signal.sourceRefs.length).toBeGreaterThan(0);
      expect(signal.evidencePointer.excerpt.length).toBeLessThanOrEqual(160);
      expect(signal.evidencePointer.end).toBe(signal.evidencePointer.excerpt.length);
      expect(signal.occurredAt).toBeTruthy();
    }
  });

  it("S2-002 extracts a direct attributable buyer request", () => {
    expect(extractEvidence(DECISION_ENGINE_FIXTURES.directRequest).signals).toContainEqual(expect.objectContaining({ type: "BUYER_REQUEST", confidence: "HIGH" }));
  });

  it("S2-003 extracts an explicit buyer pause without treating it as rejection", () => {
    const signals = extractEvidence(DECISION_ENGINE_FIXTURES.explicitPause).signals;
    expect(signals).toContainEqual(expect.objectContaining({ type: "BUYER_EXPLICIT_PAUSE" }));
    expect(signals.map((signal) => signal.type)).not.toContain("OBJECTION");
  });

  it("S2-004 extracts rep contact only from attributable outbound rep activity", () => {
    const signals = extractEvidence(DECISION_ENGINE_FIXTURES.silence).signals;
    expect(signals.filter((signal) => signal.type === "REP_CONTACT")).toHaveLength(2);
    expect(signals.some((signal) => signal.type === "BUYER_REQUEST")).toBe(false);
  });

  it("S2-005 preserves Arabic evidence text byte-for-byte in its pointer", () => {
    const signal = extractEvidence(DECISION_ENGINE_FIXTURES.arabicRequest).signals.find((item) => item.type === "BUYER_REQUEST");
    expect(signal?.evidencePointer.excerpt).toBe("ممكن تبعت تفاصيل الوحدة وخطة السداد؟");
  });

  it("S2-006 detects CRM and conversation contradiction with both source references", () => {
    const signal = extractEvidence(DECISION_ENGINE_FIXTURES.contradiction).signals.find((item) => item.type === "CONTRADICTION");
    expect(signal?.sourceRefs).toEqual(["synthetic:crm-closed-001", "synthetic:request-after-close-001"]);
  });

  it("S2-007 converts extractor failure into UNKNOWN with explicit rejection reason", () => {
    const result = extractEvidence(DECISION_ENGINE_FIXTURES.extractorFailure);
    expect(result.rejectedEventCount).toBe(1);
    expect(result.signals).toContainEqual(expect.objectContaining({ type: "UNKNOWN", confidence: "LOW", rejectionReason: "Missing source provenance." }));
  });

  it("S2-008 never lets buyer-only classes originate from rep text", () => {
    const repRequest = [{ ...DECISION_ENGINE_FIXTURES.silence[0], textOrSummary: "Please send the proposal", eventType: "BUYER_REQUEST" }];
    const types = extractEvidence(repRequest).signals.map((signal) => signal.type);
    expect(types).not.toContain("BUYER_REQUEST");
    expect(types).toContain("REP_CONTACT");
  });

  it("S2-009 composes every bounded signal type without adding an unbounded class", () => {
    const events: NormalizedSalesEvent[] = [
      buyer("all-pause", "2026-08-24T08:00:00.000Z", "BUYER_EXPLICIT_PAUSE", "Not now; wait until next month."),
      buyer("all-request", "2026-08-24T09:00:00.000Z", "BUYER_REQUEST", "Please send the villa details. My budget is 4m EGP and it looks too expensive."),
      buyer("all-reengage", "2026-08-24T10:00:00.000Z", "BUYER_REENGAGEMENT", "I am back and ready to continue."),
      buyer("all-procurement", "2026-08-24T11:00:00.000Z", "PROCUREMENT_SIGNAL", "Procurement and legal review can start."),
      rep("all-rep", "2026-08-24T12:00:00.000Z", "I will follow up and will send the document."),
      buyer("all-unknown", "2026-08-24T13:00:00.000Z", "MESSAGE", "A bounded but unmatched statement."),
      { ...rep("all-crm", "2026-08-24T07:00:00.000Z", "Closed lost in CRM."), channel: "CRM", crmStage: "Closed Lost" },
    ];
    const actual = new Set(extractEvidence(events).signals.map((signal) => signal.type));
    const expected = new Set<EvidenceSignalType>([
      "BUYER_REQUEST", "BUYER_EXPLICIT_PAUSE", "TIMING_SIGNAL", "BUDGET_SIGNAL", "PROPERTY_REQUIREMENT", "OBJECTION",
      "BUYER_INITIATED_REENGAGEMENT", "REP_CONTACT", "PROMISED_FOLLOWUP", "PROCUREMENT_SIGNAL", "CONTRADICTION", "UNKNOWN",
    ]);
    expect(actual).toEqual(expected);
  });

  it("S2-010 returns byte-identical signal identities for byte-identical input", () => {
    const first = extractEvidence(DECISION_ENGINE_FIXTURES.directRequest);
    const second = extractEvidence(DECISION_ENGINE_FIXTURES.directRequest);
    expect(first).toEqual(second);
  });

  it("S2-025 masks PII in bounded excerpts without changing source linkage", () => {
    const event = buyer("pii-001", "2026-08-24T08:00:00.000Z", "BUYER_REQUEST", "Please send details to buyer@example.test or +20 100 111 2233");
    const signal = extractEvidence([event]).signals.find((item) => item.type === "BUYER_REQUEST");
    expect(signal?.evidencePointer.excerpt).toContain("[EMAIL REDACTED]");
    expect(signal?.evidencePointer.excerpt).toContain("[PHONE REDACTED ••33]");
    expect(signal?.sourceRefs).toEqual(["test:pii-001"]);
  });
});

describe("S2 deterministic policy engine", () => {
  it("S2-011 maps explicit pause to NO_ACTION", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.explicitPause).current).toMatchObject({ decisionState: "NO_ACTION", reasonCodes: ["BUYER_EXPLICIT_PAUSE_ACTIVE"] });
  });

  it("S2-012 maps direct buyer request to NEXT_STEP_READY", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.directRequest).current).toMatchObject({ decisionState: "NEXT_STEP_READY", reasonCodes: ["BUYER_DIRECT_REQUEST"] });
  });

  it("S2-013 treats silence after rep contact as insufficient, never rejection", () => {
    const current = buildDecisionSequence(DECISION_ENGINE_FIXTURES.silence).current;
    expect(current.decisionState).toBe("INSUFFICIENT_EVIDENCE");
    expect(current.reasonCodes).toContain("SILENCE_IS_NOT_REJECTION");
    expect(current.decisionState).not.toBe("NO_ACTION");
  });

  it("S2-014 keeps weak context evidence INSUFFICIENT_EVIDENCE", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.weakEvidence).current).toMatchObject({ decisionState: "INSUFFICIENT_EVIDENCE", reasonCodes: ["WEAK_OR_CONTEXT_ONLY_EVIDENCE"] });
  });

  it("S2-015 maps conflicting CRM and conversation to CONTRADICTORY_EVIDENCE", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.contradiction).current).toMatchObject({ decisionState: "CONTRADICTORY_EVIDENCE", reasonCodes: ["CONFLICTING_CRM_AND_CONVERSATION"] });
  });

  it("S2-016 produces a new immutable snapshot after buyer reengagement", () => {
    const sequence = buildDecisionSequence(DECISION_ENGINE_FIXTURES.reengagementAfterChasing);
    expect(sequence.snapshots).toHaveLength(2);
    expect(sequence.snapshots[0]?.decisionState).toBe("NO_ACTION");
    expect(sequence.current.decisionState).toBe("NEXT_STEP_READY");
    expect(sequence.current.snapshotId).not.toBe(sequence.snapshots[0]?.snapshotId);
    expect(sequence.current.priorSnapshotId).toBe(sequence.snapshots[0]?.snapshotId);
  });

  it("S2-017 preserves chasing history after the decision later changes", () => {
    const current = buildDecisionSequence(DECISION_ENGINE_FIXTURES.reengagementAfterChasing).current;
    expect(current.historicalFindings).toContainEqual(expect.objectContaining({ kind: "CHASING_AFTER_EXPLICIT_PAUSE" }));
    expect(current.historicalFindings[0]?.sourceRefs).toEqual(["synthetic:pause-002", "synthetic:chase-001"]);
  });

  it("S2-018 maps Arabic direct request identically to English semantics", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.arabicRequest).current.decisionState).toBe("NEXT_STEP_READY");
  });

  it("S2-019 fails extractor uncertainty to INSUFFICIENT rather than invented evidence", () => {
    const current = buildDecisionSequence(DECISION_ENGINE_FIXTURES.extractorFailure).current;
    expect(current.decisionState).toBe("INSUFFICIENT_EVIDENCE");
    expect(current.reasonCodes).toContain("EXTRACTOR_UNCERTAINTY");
    expect(current.evidenceRefs).toEqual([]);
  });

  it("S2-020 carries policy/extractor versions and content-derived identity", () => {
    const current = buildDecisionSequence(DECISION_ENGINE_FIXTURES.directRequest).current;
    expect(current.policyVersion).toBe(POLICY_VERSION);
    expect(current.extractorVersion).toBe(EXTRACTOR_VERSION);
    expect(current.snapshotId).toMatch(/^decision-/);
  });

  it("S2-021 is deterministic across repeated evaluation", () => {
    expect(buildDecisionSequence(DECISION_ENGINE_FIXTURES.reengagementAfterChasing)).toEqual(buildDecisionSequence(DECISION_ENGINE_FIXTURES.reengagementAfterChasing));
  });

  it("S2-022 freezes snapshots, arrays, signals, and lineage", () => {
    const sequence = buildDecisionSequence(DECISION_ENGINE_FIXTURES.reengagementAfterChasing);
    expect(Object.isFrozen(sequence)).toBe(true);
    expect(Object.isFrozen(sequence.snapshots)).toBe(true);
    expect(Object.isFrozen(sequence.current)).toBe(true);
    expect(Object.isFrozen(sequence.current.reasonCodes)).toBe(true);
    expect(Object.isFrozen(sequence.extraction.signals)).toBe(true);
  });

  it("S2-023 includes state-specific reevaluation conditions without contact authority", () => {
    const pause = buildDecisionSequence(DECISION_ENGINE_FIXTURES.explicitPause).current;
    expect(pause.reevaluationConditions).toContain("BUYER_INITIATED_REENGAGEMENT");
    expect(JSON.stringify(pause)).not.toMatch(/SEND_MESSAGE|CALL_BUYER|SCHEDULE_MEETING/);
  });

  it("S2-024 keeps decision evidence references inside extracted provenance", () => {
    for (const fixture of Object.values(DECISION_ENGINE_FIXTURES)) {
      const sequence = buildDecisionSequence(fixture);
      const extractedRefs = new Set(sequence.extraction.signals.flatMap((signal) => signal.sourceRefs));
      expect(sequence.current.evidenceRefs.every((ref) => extractedRefs.has(ref))).toBe(true);
      expect(sequence.current.effectiveAt).toBeTruthy();
    }
  });
});

const core = {
  organizationId: "org-test",
  salesFloorId: "floor-test",
  leadId: "lead-test",
  channel: "WHATSAPP" as const,
  metadata: {},
};

function buyer(eventId: string, occurredAt: string, eventType: string, textOrSummary: string): NormalizedSalesEvent {
  return { ...core, actorId: "buyer-test", actorRole: "BUYER", eventId, occurredAt, eventType, direction: "INBOUND", sourceRef: `test:${eventId}`, textOrSummary };
}

function rep(eventId: string, occurredAt: string, textOrSummary: string): NormalizedSalesEvent {
  return { ...core, actorId: "rep-test", actorRole: "REP", eventId, occurredAt, eventType: "MESSAGE", direction: "OUTBOUND", sourceRef: `test:${eventId}`, textOrSummary };
}
