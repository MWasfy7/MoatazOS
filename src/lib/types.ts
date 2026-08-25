/**
 * MoatazOS M0 — SalesOS Decision Card domain model.
 *
 * This is an evidence-first, execution-free product. Every type here
 * is deliberately shaped so that the UI layer CANNOT accidentally
 * expose an action affordance: there is no "send", "call", "schedule",
 * "approve", or "override" field anywhere in this model, and none
 * should ever be added. If a future change needs one, it belongs in a
 * BACKEND_REQUEST-style proposal, not a quiet addition here.
 *
 * All data on screen is synthetic/fixture-driven in this milestone.
 * Nothing here talks to a network, a database, or a real buyer.
 */

// ---------------------------------------------------------------------------
// Decision state
// ---------------------------------------------------------------------------

/**
 * The four — and only four — bounded decision states this product
 * may render. NO_ACTION is a protected restraint state, not an
 * absence of a feature. NEXT_STEP_READY names a bounded *class* of
 * next step; it is not permission to execute anything.
 */
export type DecisionState =
  | "NO_ACTION"
  | "NEXT_STEP_READY"
  | "INSUFFICIENT_EVIDENCE"
  | "CONTRADICTORY_EVIDENCE";

export const DECISION_STATES: readonly DecisionState[] = [
  "NO_ACTION",
  "NEXT_STEP_READY",
  "INSUFFICIENT_EVIDENCE",
  "CONTRADICTORY_EVIDENCE",
] as const;

/**
 * A bounded, named class of next step. Deliberately NOT an
 * imperative action ("Send message") — a description of what kind of
 * move current evidence supports, decided and performed by the human
 * seller, never by this product.
 */
export type NextStepClass =
  | "RESPOND_TO_BUYER_REQUEST"
  | "PROVIDE_REQUESTED_INFORMATION"
  | "QUALIFY_STATED_REQUIREMENT"
  | "PREPARE_BUYER_REQUESTED_PROPOSAL_REVIEW"
  | "SUPPORT_BUYER_INITIATED_COMMERCIAL_REVIEW";

// ---------------------------------------------------------------------------
// Freshness — metadata only, never mutates the pinned decision
// ---------------------------------------------------------------------------

export type FreshnessState =
  | "CURRENT"
  | "NEW_EVIDENCE_PENDING"
  | "REEVALUATION_ELIGIBLE"
  | "REEVALUATION_IN_PROGRESS"
  | "NEW_SNAPSHOT_AVAILABLE"
  | "SUPERSEDED"
  | "STALE_CONTEXT"
  | "INTEGRITY_BLOCKED";

export type NoActionReasonCode =
  | "BUYER_EXPLICIT_PAUSE"
  | "NO_DECISION_GRADE_SIGNAL"
  | "TIMING_NOT_READY"
  | "RECENT_CONTACT_AWAIT_RESPONSE"
  | "CONTRADICTORY_SIGNAL"
  | "INSUFFICIENT_EVIDENCE"
  | "BUYER_BOUNDARY"
  | "OTHER_VALIDATED";

export type ReengagementConditionClass =
  | "NEW_BUYER_MESSAGE"
  | "BUYER_REQUEST"
  | "VERIFIED_TIMING_CHANGE"
  | "PROCUREMENT_EVENT"
  | "MATERIAL_CONTEXT_CORRECTION"
  | "POLICY_DEFINED_WAIT_ELAPSED";

export type RestraintBehaviorState =
  | "RESTRAINT_PENDING"
  | "RESTRAINT_RESPECTED"
  | "CHASING_VIOLATION"
  | "NOT_OBSERVABLE";

export type NoActionUncertaintyState = "OBSERVABLE" | "INCOMPLETE_EVIDENCE";

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type EvidenceGroup = "validated" | "contradictory" | "pending" | "excluded";

export interface EvidenceItem {
  id: string;
  /** A short, bounded, human-readable label — never a raw buyer message. */
  label: string;
  group: EvidenceGroup;
  /** Which snapshot this evidence item belongs to (integrity check target). */
  snapshotId: string;
  /** Optional note on why an item was excluded/rejected. */
  exclusionReason?: string;
}

/**
 * A single attributable, validated buyer or delegate signal. Seller
 * activity, CRM stage, manager opinion, read receipts, and generic
 * sentiment are explicitly NOT buyer signals and must never be
 * modeled as one.
 */
export interface BuyerSignal {
  id: string;
  label: string;
  /** Who produced this signal — always the buyer or an explicit delegate. */
  attributedTo: "buyer" | "buyer_delegate";
  validated: boolean;
  snapshotId: string;
}

// ---------------------------------------------------------------------------
// Why-this-decision conditions
// ---------------------------------------------------------------------------

export type ConditionStatus = "satisfied" | "unsatisfied" | "contradicted" | "unresolved";

export interface DecisionCondition {
  id: string;
  /** Product-level condition description — never a raw model threshold. */
  label: string;
  status: ConditionStatus;
}

// ---------------------------------------------------------------------------
// Contradiction (for CONTRADICTORY_EVIDENCE)
// ---------------------------------------------------------------------------

export interface ContradictionSide {
  label: string;
  evidenceIds: string[];
}

export interface Contradiction {
  id: string;
  conflictClass: string;
  sideA: ContradictionSide;
  sideB: ContradictionSide;
  /** What remains true despite the conflict. */
  establishedDespiteConflict: string[];
  /** What cannot currently be concluded because of the conflict. */
  cannotConclude: string[];
  /** Evidence classes that, if validated, would resolve this — never a resolution mechanism. */
  resolutionEvidenceClasses: string[];
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export type HistoryEventKind =
  | "decision_recorded"
  | "restraint_upheld"
  | "chasing_violation"
  | "reevaluation_completed"
  | "snapshot_superseded";

export interface HistoryEvent {
  id: string;
  kind: HistoryEventKind;
  occurredAt: string; // ISO 8601, fixture-authored, never system-clock-generated
  decisionState: DecisionState;
  /** Bounded, human-readable description. Read-only, append-only. */
  summary: string;
  snapshotId: string;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface Provenance {
  snapshotId: string;
  eventSetId: string;
  fixtureId: string;
  generatedAt: string;
  /** A short, non-technical explanation of what produced this snapshot. */
  source: string;
}

// ---------------------------------------------------------------------------
// The immutable Decision Snapshot
// ---------------------------------------------------------------------------

interface DecisionSnapshotBase {
  opportunityId: string;
  snapshotId: string;
  eventSetId: string;
  fixtureId: string;
  buyerAlias: string;
  decisionState: DecisionState;
  freshness: FreshnessState;
  provenance: Provenance;
  evidence: EvidenceItem[];
  buyerSignals: BuyerSignal[];
  conditions: DecisionCondition[];
  history: HistoryEvent[];
  /** Present only when freshness indicates a newer snapshot exists. */
  newerSnapshotId?: string;
  /** Reevaluation eligibility metadata — never auto-applied. */
  reevaluationEligible?: boolean;
  reevaluationReason?: string;
}

export interface NoActionSnapshot extends DecisionSnapshotBase {
  decisionState: "NO_ACTION";
  restraint: {
    reasonCode?: NoActionReasonCode;
    reason: string;
    summary?: string;
    doNotDoBehaviors: string[];
    reengagementConditions: Array<string | {
      class: ReengagementConditionClass;
      summary: string;
    }>;
    behavior?: {
      state: RestraintBehaviorState;
      observationWindow: string;
      summary: string;
    };
    uncertainty?: {
      state: NoActionUncertaintyState;
      summary: string;
    };
  };
}

export interface NextStepReadySnapshot extends DecisionSnapshotBase {
  decisionState: "NEXT_STEP_READY";
  nextStep: {
    stepClass: NextStepClass;
    whyNowEvidenceIds: string[];
    buyerSignalClass: string;
    restraintChecks: string[];
  };
  contradictions: Contradiction[];
}

export interface InsufficientEvidenceSnapshot extends DecisionSnapshotBase {
  decisionState: "INSUFFICIENT_EVIDENCE";
  insufficiency: {
    known: string[];
    missing: string[];
    unknownEvidenceClasses: string[];
    strongerReviewWouldRequire: string[];
  };
}

export interface ContradictoryEvidenceSnapshot extends DecisionSnapshotBase {
  decisionState: "CONTRADICTORY_EVIDENCE";
  contradictions: Contradiction[];
}

export type DecisionSnapshot =
  | NoActionSnapshot
  | NextStepReadySnapshot
  | InsufficientEvidenceSnapshot
  | ContradictoryEvidenceSnapshot;

// ---------------------------------------------------------------------------
// Opportunity (Command Center list item)
// ---------------------------------------------------------------------------

export interface Opportunity {
  opportunityId: string;
  buyerAlias: string;
  currentSnapshotId: string;
  decisionState: DecisionState;
  freshness: FreshnessState;
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

export interface IntegrityCheckResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verifies that every piece of evidence/signal/history attached to a
 * snapshot actually belongs to that exact snapshot's identity triple
 * (opportunityId + snapshotId + eventSetId). If ANY item's snapshotId
 * disagrees, this fails closed — the caller must render an
 * integrity-blocked state, never a plausible partial decision.
 */
export function checkSnapshotIntegrity(snapshot: DecisionSnapshot): IntegrityCheckResult {
  const mismatchedEvidence = snapshot.evidence.find((item) => item.snapshotId !== snapshot.snapshotId);
  if (mismatchedEvidence) {
    return { ok: false, reason: `evidence item ${mismatchedEvidence.id} belongs to a different snapshot` };
  }
  const mismatchedSignal = snapshot.buyerSignals.find((item) => item.snapshotId !== snapshot.snapshotId);
  if (mismatchedSignal) {
    return { ok: false, reason: `buyer signal ${mismatchedSignal.id} belongs to a different snapshot` };
  }
  if (snapshot.provenance.snapshotId !== snapshot.snapshotId) {
    return { ok: false, reason: "provenance snapshotId does not match the decision snapshot" };
  }
  if (snapshot.provenance.eventSetId !== snapshot.eventSetId) {
    return { ok: false, reason: "provenance eventSetId does not match the decision snapshot" };
  }
  return { ok: true };
}
