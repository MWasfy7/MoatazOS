/**
 * Donna v0.1 — client-outcome recovery (first slice).
 *
 * Synthetic, memory-only, proposal-free. Nothing here sends, calls,
 * schedules, or writes to a CRM. A question is DERIVED from a planned call,
 * the append-only event log and an explicit clock; it is never inferred
 * that a call happened.
 */

export interface DonnaClient {
  readonly id: string;
  /** Synthetic display labels only. Never a real person. */
  readonly label: { readonly en: string; readonly ar: string };
}

/** A call the operator planned. Its due time starts the outcome question. */
export interface PlannedCall {
  readonly id: string;
  readonly clientId: string;
  /** ISO-8601 instant with explicit offset (e.g. `...Z`). */
  readonly dueAt: string;
}

/** What the operator reports. Snooze is NOT an outcome. */
export type OutcomeKind = "SPOKE" | "NO_ANSWER" | "DID_NOT_CALL" | "CANCELLED";

/**
 * Two different promises, kept apart on purpose:
 * - INTERNAL_FOLLOW_UP: the operator's own reminder date (`YYYY-MM-DD`).
 *   The client has agreed to nothing.
 * - CLIENT_CONFIRMED_APPOINTMENT: an instant the client explicitly agreed to.
 */
export type NextAction =
  | { readonly kind: "INTERNAL_FOLLOW_UP"; readonly date: string }
  | { readonly kind: "CLIENT_CONFIRMED_APPOINTMENT"; readonly at: string; readonly clientConfirmed: true };

/** Unvalidated form of {@link NextAction}; `clientConfirmed` must be true for an appointment. */
export type NextActionInput =
  | { readonly kind: "INTERNAL_FOLLOW_UP"; readonly date: string }
  | { readonly kind: "CLIENT_CONFIRMED_APPOINTMENT"; readonly at: string; readonly clientConfirmed: boolean };

export type ConfirmedFact =
  | { readonly kind: "OUTCOME"; readonly outcome: OutcomeKind }
  | { readonly kind: "INTERNAL_FOLLOW_UP_DATE"; readonly date: string }
  | { readonly kind: "CLIENT_CONFIRMED_APPOINTMENT_AT"; readonly at: string };

/** Fields the operator did not provide; recorded so absence is never mistaken for "none". */
export type UnknownField = "NOTE" | "NEXT_ACTION";

export type DonnaEvent =
  | { readonly type: "QUESTION_DISMISSED"; readonly callId: string; readonly at: string }
  | { readonly type: "TASK_MARKED_DONE"; readonly callId: string; readonly at: string }
  | { readonly type: "SNOOZED"; readonly callId: string; readonly at: string; readonly until: string }
  | {
      readonly type: "OUTCOME_RECORDED";
      readonly callId: string;
      readonly at: string;
      readonly outcome: OutcomeKind;
      readonly originalInput: string;
      readonly confirmedFacts: readonly ConfirmedFact[];
      readonly unknownFields: readonly UnknownField[];
      readonly nextAction: NextAction | null;
    };

/** Event as supplied by the caller (the engine assigns the sequence number). */
export type DonnaEventInput =
  | Extract<DonnaEvent, { type: "QUESTION_DISMISSED" | "TASK_MARKED_DONE" | "SNOOZED" }>
  | {
      readonly type: "OUTCOME_RECORDED";
      readonly callId: string;
      readonly at: string;
      readonly outcome: OutcomeKind;
      readonly originalInput: string;
      readonly nextAction: NextActionInput | null;
    };

export type StoredEvent = DonnaEvent & { readonly seq: number };

export interface DonnaState {
  readonly policy: ReminderPolicy;
  readonly clients: readonly DonnaClient[];
  readonly calls: readonly PlannedCall[];
  /** Append-only. Earlier entries are never edited or removed. */
  readonly events: readonly StoredEvent[];
}

export interface ReminderPolicy {
  /** Fixed offset used for quiet hours and display (demo: UTC+2, no DST). */
  readonly utcOffsetMinutes: number;
  /** Local hour [0-23] quiet hours begin (inclusive). */
  readonly quietStartHour: number;
  /** Local hour [0-23] quiet hours end (exclusive). */
  readonly quietEndHour: number;
}

/**
 * Reminder state for an unresolved question. Resolved questions (including
 * a cancelled call) have no reminder at all. No notification is delivered
 * by this slice; this only classifies when one would be allowed.
 */
export type ReminderStatus = "DUE_NOW" | "SNOOZED" | "HELD_QUIET_HOURS";

export interface OutcomeRecord {
  readonly seq: number;
  readonly at: string;
  readonly outcome: OutcomeKind;
  readonly originalInput: string;
  readonly confirmedFacts: readonly ConfirmedFact[];
  readonly unknownFields: readonly UnknownField[];
  readonly nextAction: NextAction | null;
}

/** The single pending question for one planned call. Id is stable per call. */
export interface OutcomeQuestion {
  readonly id: string;
  readonly callId: string;
  readonly clientId: string;
  readonly dueAt: string;
  /** Operator marked the call task done. Does NOT resolve the question. */
  readonly taskMarkedDone: boolean;
  /** Times the question was dismissed from view. Does NOT resolve it. */
  readonly dismissCount: number;
  readonly snoozedUntil: string | null;
  readonly reminder: ReminderStatus;
}

export interface DonnaInbox {
  /** Due, no outcome. Always listed, including when snoozed or dismissed. */
  readonly unresolved: readonly OutcomeQuestion[];
  /** Not yet due: no question exists yet. */
  readonly upcoming: readonly PlannedCall[];
  readonly resolved: ReadonlyArray<{ readonly call: PlannedCall; readonly record: OutcomeRecord }>;
}

export type DonnaErrorCode =
  | "UNKNOWN_CALL"
  | "NOT_YET_DUE"
  | "ALREADY_RESOLVED"
  | "FUTURE_EVENT"
  | "INVALID_INSTANT"
  | "SNOOZE_NOT_IN_FUTURE"
  | "APPOINTMENT_NOT_CONFIRMED"
  | "APPOINTMENT_REQUIRES_SPOKE"
  | "NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME"
  | "FOLLOW_UP_DATE_INVALID"
  | "FOLLOW_UP_DATE_IN_PAST"
  | "APPOINTMENT_NOT_IN_FUTURE";

export type ApplyResult =
  | { readonly ok: true; readonly state: DonnaState }
  | { readonly ok: false; readonly error: DonnaErrorCode };
