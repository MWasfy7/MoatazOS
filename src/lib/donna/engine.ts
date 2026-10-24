import { isCalendarDate, isInQuietHours, localParts, parseInstant } from "./time";
import type {
  ApplyResult,
  ConfirmedFact,
  DonnaClient,
  DonnaErrorCode,
  DonnaEventInput,
  DonnaInbox,
  DonnaState,
  NextAction,
  OutcomeQuestion,
  OutcomeRecord,
  PlannedCall,
  ReminderPolicy,
  ReminderStatus,
  StoredEvent,
  UnknownField,
} from "./types";

export const DONNA_LOGIC_VERSION = "donna-outcome-v0.1.0";

export function createState(
  policy: ReminderPolicy,
  clients: readonly DonnaClient[],
  calls: readonly PlannedCall[],
): DonnaState {
  return deepFreeze({ policy, clients, calls, events: [] });
}

/**
 * Append one event. Pure: returns a new state and never edits the old one.
 * `now` is the caller's clock; an event later than `now` is rejected, so
 * future evidence cannot influence a question.
 */
export function applyEvent(state: DonnaState, input: DonnaEventInput, now: string): ApplyResult {
  const nowMs = parseInstant(now);
  const atMs = parseInstant(input.at);
  if (Number.isNaN(nowMs) || Number.isNaN(atMs)) return fail("INVALID_INSTANT");
  if (atMs > nowMs) return fail("FUTURE_EVENT");

  const call = state.calls.find((c) => c.id === input.callId);
  if (!call) return fail("UNKNOWN_CALL");
  if (findOutcome(state.events, call.id)) return fail("ALREADY_RESOLVED");

  if (input.type !== "TASK_MARKED_DONE" && atMs < parseInstant(call.dueAt)) return fail("NOT_YET_DUE");

  let stored: StoredEvent;
  const seq = state.events.length + 1;
  switch (input.type) {
    case "QUESTION_DISMISSED":
    case "TASK_MARKED_DONE":
      stored = { ...input, seq };
      break;
    case "SNOOZED": {
      const untilMs = parseInstant(input.until);
      if (Number.isNaN(untilMs)) return fail("INVALID_INSTANT");
      if (untilMs <= atMs) return fail("SNOOZE_NOT_IN_FUTURE");
      stored = { ...input, seq };
      break;
    }
    case "OUTCOME_RECORDED": {
      const checked = checkNextAction(input.outcome, input.nextAction, input.at, state.policy);
      if (typeof checked === "string") return fail(checked);
      const nextAction = checked;
      const unknownFields: UnknownField[] = [];
      if (input.originalInput.trim() === "") unknownFields.push("NOTE");
      if (nextAction === null && input.outcome !== "CANCELLED") unknownFields.push("NEXT_ACTION");
      const confirmedFacts: ConfirmedFact[] = [{ kind: "OUTCOME", outcome: input.outcome }];
      if (nextAction?.kind === "INTERNAL_FOLLOW_UP") {
        confirmedFacts.push({ kind: "INTERNAL_FOLLOW_UP_DATE", date: nextAction.date });
      } else if (nextAction?.kind === "CLIENT_CONFIRMED_APPOINTMENT") {
        confirmedFacts.push({ kind: "CLIENT_CONFIRMED_APPOINTMENT_AT", at: nextAction.at });
      }
      stored = {
        type: "OUTCOME_RECORDED",
        callId: input.callId,
        at: input.at,
        outcome: input.outcome,
        originalInput: input.originalInput,
        confirmedFacts,
        unknownFields,
        nextAction,
        seq,
      };
      break;
    }
  }
  return { ok: true, state: deepFreeze({ ...state, events: [...state.events, stored] }) };
}

/** The inbox as of `now`. Deterministic; events later than `now` are ignored. */
export function buildInbox(state: DonnaState, now: string): DonnaInbox {
  const nowMs = parseInstant(now);
  const events = state.events.filter((e) => parseInstant(e.at) <= nowMs);
  const calls = [...state.calls].sort((a, b) => parseInstant(a.dueAt) - parseInstant(b.dueAt) || a.id.localeCompare(b.id));

  const unresolved: OutcomeQuestion[] = [];
  const upcoming: PlannedCall[] = [];
  const resolved: Array<{ call: PlannedCall; record: OutcomeRecord }> = [];

  for (const call of calls) {
    const record = findOutcome(events, call.id);
    if (record) {
      resolved.push({ call, record });
    } else if (parseInstant(call.dueAt) > nowMs) {
      upcoming.push(call);
    } else {
      unresolved.push(toQuestion(call, events, now, state.policy));
    }
  }
  return deepFreeze({ unresolved, upcoming, resolved });
}

function toQuestion(call: PlannedCall, events: readonly StoredEvent[], now: string, policy: ReminderPolicy): OutcomeQuestion {
  const own = events.filter((e) => e.callId === call.id);
  // The latest snooze supersedes every earlier one, even a longer one:
  // choose by sequence first, and only then ask whether it is still active.
  let latestSnoozeUntil: string | null = null;
  for (const e of own) {
    if (e.type === "SNOOZED") latestSnoozeUntil = e.until;
  }
  const snoozedUntil = latestSnoozeUntil !== null && parseInstant(latestSnoozeUntil) > parseInstant(now) ? latestSnoozeUntil : null;
  let reminder: ReminderStatus = "DUE_NOW";
  if (snoozedUntil) reminder = "SNOOZED";
  else if (isInQuietHours(now, policy)) reminder = "HELD_QUIET_HOURS";
  return {
    id: `q-${call.id}`,
    callId: call.id,
    clientId: call.clientId,
    dueAt: call.dueAt,
    taskMarkedDone: own.some((e) => e.type === "TASK_MARKED_DONE"),
    dismissCount: own.filter((e) => e.type === "QUESTION_DISMISSED").length,
    snoozedUntil,
    reminder,
  };
}

function findOutcome(events: readonly StoredEvent[], callId: string): OutcomeRecord | null {
  for (const e of events) {
    if (e.type === "OUTCOME_RECORDED" && e.callId === callId) {
      return {
        seq: e.seq,
        at: e.at,
        outcome: e.outcome,
        originalInput: e.originalInput,
        confirmedFacts: e.confirmedFacts,
        unknownFields: e.unknownFields,
        nextAction: e.nextAction,
      };
    }
  }
  return null;
}

function checkNextAction(
  outcome: OutcomeRecord["outcome"],
  input: Extract<DonnaEventInput, { type: "OUTCOME_RECORDED" }>["nextAction"],
  at: string,
  policy: ReminderPolicy,
): NextAction | null | DonnaErrorCode {
  if (input === null) return null;
  if (outcome === "CANCELLED") return "NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME";

  if (input.kind === "CLIENT_CONFIRMED_APPOINTMENT") {
    // Only a conversation can produce a client-agreed time.
    if (outcome !== "SPOKE") return "APPOINTMENT_REQUIRES_SPOKE";
    if (input.clientConfirmed !== true) return "APPOINTMENT_NOT_CONFIRMED";
    const atMs = parseInstant(input.at);
    if (Number.isNaN(atMs)) return "INVALID_INSTANT";
    if (atMs <= parseInstant(at)) return "APPOINTMENT_NOT_IN_FUTURE";
    return { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: input.at, clientConfirmed: true };
  }

  if (!isCalendarDate(input.date)) return "FOLLOW_UP_DATE_INVALID";
  if (input.date < localParts(at, policy.utcOffsetMinutes).date) return "FOLLOW_UP_DATE_IN_PAST";
  return { kind: "INTERNAL_FOLLOW_UP", date: input.date };
}

function fail(error: DonnaErrorCode): ApplyResult {
  return { ok: false, error };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
