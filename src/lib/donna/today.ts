import { buildInbox } from "./engine";
import { localParts, parseInstant } from "./time";
import type { DonnaState, NextAction, OutcomeQuestion, PlannedCall } from "./types";

/**
 * "Today" view (pure and deterministic). Derived only from the planned calls and
 * the append-only event log; nothing is stored and nothing is inferred beyond:
 *  - a call with no recorded outcome is a question (never assumed to have happened);
 *  - a recorded next action stays a visible commitment until a LATER conversation
 *    (a SPOKE outcome) with the same client is recorded.
 */
export type CommitmentStatus = "OVERDUE" | "TODAY" | "UPCOMING";

export interface Commitment {
  readonly callId: string;
  readonly clientId: string;
  readonly kind: NextAction["kind"];
  /** `YYYY-MM-DD` for an internal follow-up, an ISO instant for a client-confirmed appointment. */
  readonly due: string;
  readonly status: CommitmentStatus;
  /** The operator's own next-step text, exactly as recorded. */
  readonly nextStep: string | null;
  readonly recordedAt: string;
}

export interface TodayView {
  /** Local calendar date (`YYYY-MM-DD`) at the policy offset. */
  readonly today: string;
  /** Calls that are due and have no outcome. */
  readonly needsOutcome: readonly OutcomeQuestion[];
  /** Calls not yet due, planned for the rest of today. */
  readonly callsToday: readonly PlannedCall[];
  /** Overdue first, then today, then upcoming; soonest first inside each group. */
  readonly commitments: readonly Commitment[];
  /** Commitments hidden because a later conversation with the same client was recorded. */
  readonly handledCount: number;
}

const RANK: Record<CommitmentStatus, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2 };

export function buildToday(state: DonnaState, now: string): TodayView {
  const offset = state.policy.utcOffsetMinutes;
  const today = localParts(now, offset).date;
  const inbox = buildInbox(state, now);

  const callsToday = inbox.upcoming.filter((call) => localParts(call.dueAt, offset).date === today);

  const items: Array<Commitment & { dueMs: number }> = [];
  let handledCount = 0;
  for (const { call, record } of inbox.resolved) {
    const next = record.nextAction;
    if (!next) continue;
    const handled = inbox.resolved.some(
      (other) => other.call.clientId === call.clientId && other.record.outcome === "SPOKE" && other.record.seq > record.seq,
    );
    if (handled) {
      handledCount += 1;
      continue;
    }
    if (next.kind === "INTERNAL_FOLLOW_UP") {
      const status: CommitmentStatus = next.date < today ? "OVERDUE" : next.date === today ? "TODAY" : "UPCOMING";
      items.push({
        callId: call.id,
        clientId: call.clientId,
        kind: next.kind,
        due: next.date,
        status,
        nextStep: record.nextStep,
        recordedAt: record.at,
        dueMs: parseInstant(`${next.date}T00:00:00Z`) - offset * 60_000,
      });
    } else {
      const day = localParts(next.at, offset).date;
      const status: CommitmentStatus = parseInstant(next.at) < parseInstant(now) ? "OVERDUE" : day === today ? "TODAY" : "UPCOMING";
      items.push({
        callId: call.id,
        clientId: call.clientId,
        kind: next.kind,
        due: next.at,
        status,
        nextStep: record.nextStep,
        recordedAt: record.at,
        dueMs: parseInstant(next.at),
      });
    }
  }
  items.sort((a, b) => RANK[a.status] - RANK[b.status] || a.dueMs - b.dueMs || a.callId.localeCompare(b.callId));

  return {
    today,
    needsOutcome: inbox.unresolved,
    callsToday,
    commitments: items.map(({ dueMs: _dueMs, ...commitment }) => commitment),
    handledCount,
  };
}
