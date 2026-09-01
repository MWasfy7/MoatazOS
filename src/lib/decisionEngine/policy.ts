import type { NormalizedSalesEvent } from "@/lib/realInput";
import { stableHash } from "@/lib/realInput";
import { extractEvidence, EXTRACTOR_VERSION } from "./extractor";
import type {
  DecisionReasonCode,
  DecisionSequence,
  DecisionUncertaintyCode,
  DeterministicDecisionSnapshot,
  EvidenceSignal,
  HistoricalPolicyFinding,
  ReevaluationCondition,
} from "./types";

export const POLICY_VERSION = "salesos-policy-v0.1.0";
const MATERIAL_BOUNDARIES = new Set(["BUYER_REQUEST", "BUYER_EXPLICIT_PAUSE", "BUYER_INITIATED_REENGAGEMENT", "PROCUREMENT_SIGNAL", "CONTRADICTION"]);

export function buildDecisionSequence(events: readonly NormalizedSalesEvent[]): DecisionSequence {
  const extraction = extractEvidence(events);
  const validTimes = events.map((event) => event.occurredAt).filter((value) => !Number.isNaN(Date.parse(value))).sort();
  const boundaryTimes = unique(
    extraction.signals
      .filter((signal) => MATERIAL_BOUNDARIES.has(signal.type) && !Number.isNaN(Date.parse(signal.occurredAt)))
      .map((signal) => signal.occurredAt),
  );
  const effectiveBoundaries = boundaryTimes.length > 0 ? boundaryTimes : [validTimes.at(-1) ?? "UNAVAILABLE"];
  const snapshots: DeterministicDecisionSnapshot[] = [];

  for (const effectiveAt of effectiveBoundaries) {
    const availableSignals = extraction.signals.filter((signal) => signal.occurredAt === "UNAVAILABLE" || effectiveAt === "UNAVAILABLE" || signal.occurredAt <= effectiveAt);
    const snapshot = evaluateSignals(availableSignals, effectiveAt, snapshots.at(-1)?.snapshotId);
    const previous = snapshots.at(-1);
    if (!previous || previous.snapshotId !== snapshot.snapshotId) snapshots.push(snapshot);
  }

  const current = snapshots.at(-1) ?? evaluateSignals(extraction.signals, validTimes.at(-1) ?? "UNAVAILABLE");
  return deepFreeze({ extraction, snapshots, current });
}

function evaluateSignals(signals: readonly EvidenceSignal[], effectiveAt: string, priorSnapshotId?: string): DeterministicDecisionSnapshot {
  const contradiction = lastOfType(signals, "CONTRADICTION");
  const pause = lastOfType(signals, "BUYER_EXPLICIT_PAUSE");
  const request = lastOfType(signals, "BUYER_REQUEST");
  const reengagement = lastOfType(signals, "BUYER_INITIATED_REENGAGEMENT");
  const procurement = lastOfType(signals, "PROCUREMENT_SIGNAL");
  const activation = latest([request, reengagement, procurement]);
  const historicalFindings = chasingFindings(signals);

  let decisionState: DeterministicDecisionSnapshot["decisionState"];
  let reasonCodes: DecisionReasonCode[];
  let evidenceRefs: string[];
  let uncertainty: DecisionUncertaintyCode[];
  let reevaluationConditions: ReevaluationCondition[];

  if (contradiction) {
    decisionState = "CONTRADICTORY_EVIDENCE";
    reasonCodes = ["CONFLICTING_CRM_AND_CONVERSATION"];
    evidenceRefs = contradiction.sourceRefs;
    uncertainty = ["CRM_CONVERSATION_CONFLICT"];
    reevaluationConditions = ["CONTRADICTION_RESOLVED", "VALIDATED_CONTEXT_CHANGE"];
  } else if (pause && (!activation || compareOccurredAt(pause, activation) >= 0)) {
    decisionState = "NO_ACTION";
    reasonCodes = ["BUYER_EXPLICIT_PAUSE_ACTIVE"];
    evidenceRefs = pause.sourceRefs;
    uncertainty = [];
    reevaluationConditions = ["NEW_BUYER_REQUEST", "BUYER_INITIATED_REENGAGEMENT", "VALIDATED_CONTEXT_CHANGE"];
  } else if (activation) {
    decisionState = "NEXT_STEP_READY";
    reasonCodes = activation.type === "BUYER_INITIATED_REENGAGEMENT"
      ? ["BUYER_REENGAGED_AFTER_RESTRAINT"]
      : activation.type === "PROCUREMENT_SIGNAL"
        ? ["PROCUREMENT_INTENT_PRESENT"]
        : ["BUYER_DIRECT_REQUEST"];
    evidenceRefs = activation.sourceRefs;
    uncertainty = [];
    reevaluationConditions = ["VALIDATED_CONTEXT_CHANGE", "ADDITIONAL_DECISION_GRADE_EVIDENCE"];
  } else {
    decisionState = "INSUFFICIENT_EVIDENCE";
    const hasRepContact = signals.some((signal) => signal.type === "REP_CONTACT");
    const hasUnknown = signals.some((signal) => signal.type === "UNKNOWN");
    reasonCodes = [hasRepContact ? "SILENCE_IS_NOT_REJECTION" : "WEAK_OR_CONTEXT_ONLY_EVIDENCE"];
    if (hasUnknown) reasonCodes.push("EXTRACTOR_UNCERTAINTY");
    evidenceRefs = unique(signals.filter((signal) => signal.type !== "UNKNOWN").flatMap((signal) => signal.sourceRefs));
    uncertainty = [
      hasRepContact ? "OUTBOUND_WITHOUT_BUYER_RESPONSE" : "NO_DECISION_GRADE_BUYER_EVIDENCE",
    ];
    if (hasUnknown) uncertainty.push("SOURCE_EVENT_UNCLASSIFIED");
    reevaluationConditions = ["NEW_BUYER_REQUEST", "ADDITIONAL_DECISION_GRADE_EVIDENCE", "VALIDATED_CONTEXT_CHANGE"];
  }

  const signalIds = signals.map((signal) => signal.signalId).sort();
  const snapshotId = `decision-${stableHash([POLICY_VERSION, decisionState, effectiveAt, ...signalIds].join("|"))}`;
  return deepFreeze({
    snapshotId,
    priorSnapshotId,
    decisionState,
    effectiveAt,
    reasonCodes,
    evidenceRefs: unique(evidenceRefs),
    uncertainty,
    reevaluationConditions,
    policyVersion: POLICY_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    historicalFindings,
  });
}

function chasingFindings(signals: readonly EvidenceSignal[]): HistoricalPolicyFinding[] {
  const findings: HistoricalPolicyFinding[] = [];
  for (const pause of signals.filter((signal) => signal.type === "BUYER_EXPLICIT_PAUSE")) {
    const nextBuyerActivation = signals.find((signal) =>
      ["BUYER_REQUEST", "BUYER_INITIATED_REENGAGEMENT", "PROCUREMENT_SIGNAL"].includes(signal.type) && compareOccurredAt(signal, pause) > 0,
    );
    const contacts = signals.filter((signal) =>
      signal.type === "REP_CONTACT" && compareOccurredAt(signal, pause) > 0 && (!nextBuyerActivation || compareOccurredAt(signal, nextBuyerActivation) < 0),
    );
    if (contacts.length > 0) {
      findings.push({
        kind: "CHASING_AFTER_EXPLICIT_PAUSE",
        sourceRefs: unique([...pause.sourceRefs, ...contacts.flatMap((contact) => contact.sourceRefs)]),
        summary: "Rep contact occurred after an attributable buyer pause and before buyer-initiated reengagement.",
      });
    }
  }
  return findings;
}

function lastOfType(signals: readonly EvidenceSignal[], type: EvidenceSignal["type"]): EvidenceSignal | undefined {
  return [...signals].reverse().find((signal) => signal.type === type);
}

function latest(signals: Array<EvidenceSignal | undefined>): EvidenceSignal | undefined {
  return signals.filter((signal): signal is EvidenceSignal => Boolean(signal)).sort(compareOccurredAt).at(-1);
}

function compareOccurredAt(a: EvidenceSignal, b: EvidenceSignal): number {
  return Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.signalId.localeCompare(b.signalId);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}
