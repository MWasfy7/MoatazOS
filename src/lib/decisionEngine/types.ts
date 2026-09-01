import type { DecisionState } from "@/lib/types";

export type EvidenceSignalType =
  | "BUYER_REQUEST"
  | "BUYER_EXPLICIT_PAUSE"
  | "TIMING_SIGNAL"
  | "BUDGET_SIGNAL"
  | "PROPERTY_REQUIREMENT"
  | "OBJECTION"
  | "BUYER_INITIATED_REENGAGEMENT"
  | "REP_CONTACT"
  | "PROMISED_FOLLOWUP"
  | "PROCUREMENT_SIGNAL"
  | "CONTRADICTION"
  | "UNKNOWN";

export type SignalConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface BoundedEvidencePointer {
  eventId: string;
  excerpt: string;
  start: number;
  end: number;
}

export interface EvidenceSignal {
  signalId: string;
  type: EvidenceSignalType;
  sourceRefs: string[];
  evidencePointer: BoundedEvidencePointer;
  confidence: SignalConfidence;
  extractorVersion: string;
  occurredAt: string;
  uncertaintyReason?: string;
  rejectionReason?: string;
}

export interface ExtractionResult {
  signals: EvidenceSignal[];
  extractorVersion: string;
  rejectedEventCount: number;
}

export type DecisionReasonCode =
  | "BUYER_EXPLICIT_PAUSE_ACTIVE"
  | "BUYER_DIRECT_REQUEST"
  | "BUYER_REENGAGED_AFTER_RESTRAINT"
  | "PROCUREMENT_INTENT_PRESENT"
  | "CONFLICTING_CRM_AND_CONVERSATION"
  | "WEAK_OR_CONTEXT_ONLY_EVIDENCE"
  | "SILENCE_IS_NOT_REJECTION"
  | "EXTRACTOR_UNCERTAINTY";

export type ReevaluationCondition =
  | "NEW_BUYER_REQUEST"
  | "BUYER_INITIATED_REENGAGEMENT"
  | "VALIDATED_CONTEXT_CHANGE"
  | "CONTRADICTION_RESOLVED"
  | "ADDITIONAL_DECISION_GRADE_EVIDENCE";

export type DecisionUncertaintyCode =
  | "CRM_CONVERSATION_CONFLICT"
  | "OUTBOUND_WITHOUT_BUYER_RESPONSE"
  | "NO_DECISION_GRADE_BUYER_EVIDENCE"
  | "SOURCE_EVENT_UNCLASSIFIED";

export interface HistoricalPolicyFinding {
  kind: "CHASING_AFTER_EXPLICIT_PAUSE";
  sourceRefs: string[];
  summary: string;
}

export interface DeterministicDecisionSnapshot {
  snapshotId: string;
  priorSnapshotId?: string;
  decisionState: DecisionState;
  effectiveAt: string;
  reasonCodes: DecisionReasonCode[];
  evidenceRefs: string[];
  uncertainty: DecisionUncertaintyCode[];
  reevaluationConditions: ReevaluationCondition[];
  policyVersion: string;
  extractorVersion: string;
  historicalFindings: HistoricalPolicyFinding[];
}

export interface DecisionSequence {
  extraction: ExtractionResult;
  snapshots: DeterministicDecisionSnapshot[];
  current: DeterministicDecisionSnapshot;
}
