/**
 * ECHO — Conversational Gateway domain model.
 *
 * WHY THIS EXISTS
 * ---------------
 * SalesOS (src/lib/decisionEngine) is a fail-closed *adjudicator*: an
 * utterance that matches no bounded class becomes UNKNOWN, and UNKNOWN
 * terminates in INSUFFICIENT_EVIDENCE. That is correct when the subject
 * under judgement is buyer evidence and the cost of guessing is a wrong
 * commercial decision.
 *
 * It is catastrophic when the subject under judgement is *a person
 * talking*. Applied to speech, "no bounded class matched" becomes
 * "I need a clearer bounded instruction", and every casual, emotional,
 * elliptical or code-switched turn is rejected.
 *
 * This module is the correction. It is a GATEWAY, not an adjudicator:
 * it runs BEFORE any bounded-action validator and decides whether an
 * utterance needs to reach one at all. Most speech does not.
 *
 * It imports nothing from SalesOS and SalesOS imports nothing from it.
 */

// ---------------------------------------------------------------------------
// The six classes. Collapsing these into "bounded task vs invalid task"
// is the root architectural defect this taxonomy exists to prevent.
// ---------------------------------------------------------------------------

export type UtteranceClass =
  /** Social, emotional, or expressive. No task is implied and none is required. */
  | "CONVERSATION"
  /** Seeks information. Answerable from state or knowledge; never needs a task. */
  | "QUESTION"
  /** Resumes an existing thread. Meaning lives in dialogue state, not in the words. */
  | "CONTINUATION"
  /** A directive whose effects are local and reversible. */
  | "COMMAND"
  /** A directive that reaches a tool, a side effect, or the outside world. */
  | "ACTION_REQUEST"
  /** An effectful directive whose target cannot be resolved. The ONLY class
   *  permitted to block on clarification. */
  | "AMBIGUOUS_HIGH_RISK";

// ---------------------------------------------------------------------------
// Response mode — what ECHO does with the turn
// ---------------------------------------------------------------------------

export type ResponseMode =
  /** Talk. No executable task is required for this turn to be well handled. */
  | "RESPOND"
  /** Proceed; intent is unambiguous. */
  | "ACT"
  /** Proceed on the dominant reading, stating the assumption in one line. */
  | "ACT_WITH_ASSUMPTION"
  /** Two materially different readings; offer a short A/B and keep talking. */
  | "OFFER_CHOICE"
  /** Stop and ask. Reachable from AMBIGUOUS_HIGH_RISK and nowhere else. */
  | "REQUEST_CLARIFICATION";

/**
 * Risk is a property of the *effect*, not of the parse. A perfectly
 * understood "delete production" is high risk; a barely parseable
 * "yalla kammel" is not. Conflating the two is what produces the bug.
 */
export type RiskTier = "REVERSIBLE" | "IRREVERSIBLE";

// ---------------------------------------------------------------------------
// Dialogue state — the memory that makes "it", "that" and "continue" mean something
// ---------------------------------------------------------------------------

/** Something that can be the target of a pronoun or an implicit continuation. */
export interface SubjectRef {
  id: string;
  label: string;
  /** Monotonic turn index at which this subject was last touched. */
  lastTouchedTurn: number;
}

/** A unit of work already under way. "Continue" resolves here first. */
export interface ThreadRef {
  id: string;
  label: string;
  /** True when the thread was left incomplete and can be picked back up. */
  resumable: boolean;
}

/** An offer ECHO already made and is waiting on. Bare assent resolves here. */
export interface PendingProposal {
  id: string;
  label: string;
  riskTier: RiskTier;
}

export interface DialogueState {
  /** Monotonic index of the current turn. */
  turn: number;
  /** Candidate pronoun referents. Order does not matter; recency does. */
  recentSubjects: readonly SubjectRef[];
  /** What we were doing. Absent on a genuinely cold start. */
  activeThread?: ThreadRef;
  /** An outstanding offer awaiting yes/no. */
  pendingProposal?: PendingProposal;
}

export const EMPTY_DIALOGUE_STATE: DialogueState = Object.freeze({
  turn: 0,
  recentSubjects: Object.freeze([]) as readonly SubjectRef[],
});

// ---------------------------------------------------------------------------
// Referent resolution
// ---------------------------------------------------------------------------

export type ReferentResolution =
  /** Exactly one reading, or one clearly dominant reading. */
  | { status: "RESOLVED"; subject: SubjectRef | ThreadRef | PendingProposal; basis: ResolutionBasis; dominant: boolean }
  /** Several materially different readings. */
  | { status: "AMBIGUOUS"; candidates: readonly SubjectRef[] }
  /** Nothing in state to resolve against. */
  | { status: "UNRESOLVED" }
  /** The utterance carried no referent needing resolution. */
  | { status: "NOT_REQUIRED" };

export type ResolutionBasis =
  | "PENDING_PROPOSAL"
  | "ACTIVE_THREAD"
  | "SOLE_SUBJECT"
  | "RECENCY_DOMINANCE"
  | "EXPLICIT_IN_UTTERANCE";

// ---------------------------------------------------------------------------
// Gateway output
// ---------------------------------------------------------------------------

export interface GatewayDecision {
  utteranceClass: UtteranceClass;
  responseMode: ResponseMode;
  riskTier: RiskTier;
  referent: ReferentResolution;
  /**
   * True for an understood but irreversible effect. This is a CONFIRMATION
   * ("about to delete X, go ahead?"), which is a different act from a
   * CLARIFICATION ("I need a clearer bounded instruction"). Confirmation
   * presupposes understanding; clarification denies it. Conflating them is
   * how a safety control became a comprehension failure.
   */
  requiresConfirmation: boolean;
  /** Affect detected and deliberately discarded before classification. */
  affect: "NEUTRAL" | "FRUSTRATED";
  /** One-line assumption to surface when responseMode is ACT_WITH_ASSUMPTION. */
  assumption?: string;
  /** Short A/B options when responseMode is OFFER_CHOICE. */
  choices?: readonly string[];
  /** Machine-readable trace of why this route was taken. */
  rationale: string;
}
