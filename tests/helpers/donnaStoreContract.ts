/**
 * Store-contract scenarios (DON-02). Framework-free so the SAME scenarios run:
 *  - against the in-memory MOCK in Vitest (tests/DonnaStoreContract.test.ts), and
 *  - against the REAL database in the live acceptance harness (tests/donna-live).
 * Passing against the mock is not persistence evidence; passing live is.
 */
import { DonnaStoreError, type DonnaStore, type StoreErrorCode } from "@/lib/donna";

export interface ContractContext {
  readonly store: DonnaStore;
  now(): string;
  newId(): string;
  /** A call id unique to this scenario run (matches ^[a-z0-9][a-z0-9-]{0,63}$). */
  callId(tag: string): string;
}

export interface ContractScenario {
  readonly name: string;
  run(ctx: ContractContext): Promise<void>;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`contract: ${message}`);
}

async function code(promise: Promise<unknown>): Promise<StoreErrorCode | "NO_ERROR"> {
  try {
    await promise;
    return "NO_ERROR";
  } catch (error) {
    if (error instanceof DonnaStoreError) return error.code;
    throw error;
  }
}

const minutes = (iso: string, delta: number) => new Date(Date.parse(iso) + delta * 60_000).toISOString();

async function dueCall(ctx: ContractContext, tag: string) {
  const id = ctx.callId(tag);
  const call = { id, clientId: "cl-contract", dueAt: minutes(ctx.now(), -180) };
  check((await ctx.store.upsertCall(call)) === "CREATED", "call created");
  return call;
}

async function outcomes(ctx: ContractContext, callId: string) {
  const snapshot = await ctx.store.load();
  return snapshot.events.filter((e) => e.type === "OUTCOME_RECORDED" && e.callId === callId);
}

const spoke = (callId: string, at: string, text = "Synthetic note") =>
  ({
    type: "OUTCOME_RECORDED" as const,
    callId,
    at,
    outcome: "SPOKE" as const,
    originalInput: text,
    nextAction: { kind: "INTERNAL_FOLLOW_UP" as const, date: at.slice(0, 10) },
  });

export const CONTRACT_SCENARIOS: readonly ContractScenario[] = [
  {
    name: "a repeated call is a duplicate, changed details are a conflict (no second task)",
    async run(ctx) {
      const call = await dueCall(ctx, "call-dup");
      check((await ctx.store.upsertCall(call)) === "DUPLICATE", "repeat is DUPLICATE");
      check((await code(ctx.store.upsertCall({ ...call, dueAt: minutes(call.dueAt, 5) }))) === "CALL_CONFLICT", "changed due time conflicts");
      const snapshot = await ctx.store.load();
      check(snapshot.calls.filter((c) => c.id === call.id).length === 1, "exactly one call row");
    },
  },
  {
    name: "an acknowledged outcome is returned by load() exactly once",
    async run(ctx) {
      const call = await dueCall(ctx, "outcome-once");
      const at = minutes(ctx.now(), -1);
      check((await ctx.store.appendEvent(ctx.newId(), spoke(call.id, at))) === "CREATED", "outcome CREATED");
      const rows = await outcomes(ctx, call.id);
      check(rows.length === 1, "one outcome after load");
      const row = rows[0];
      check(row?.type === "OUTCOME_RECORDED" && row.outcome === "SPOKE", "outcome content survives the round trip");
      check(row.nextAction?.kind === "INTERNAL_FOLLOW_UP", "internal follow-up survives the round trip");
      check(row.originalInput === "Synthetic note", "original input preserved verbatim");
    },
  },
  {
    name: "a retry (same event id, same content) is a duplicate and adds nothing",
    async run(ctx) {
      const call = await dueCall(ctx, "retry");
      const id = ctx.newId();
      const event = spoke(call.id, minutes(ctx.now(), -1));
      check((await ctx.store.appendEvent(id, event)) === "CREATED", "first CREATED");
      check((await ctx.store.appendEvent(id, event)) === "DUPLICATE", "retry DUPLICATE");
      check((await outcomes(ctx, call.id)).length === 1, "still one outcome");
    },
  },
  {
    name: "the same event id with different content is rejected as reuse",
    async run(ctx) {
      const call = await dueCall(ctx, "reuse");
      const id = ctx.newId();
      const at = minutes(ctx.now(), -1);
      await ctx.store.appendEvent(id, spoke(call.id, at, "first"));
      check((await code(ctx.store.appendEvent(id, spoke(call.id, at, "edited")))) === "EVENT_ID_REUSED", "EVENT_ID_REUSED");
      const rows = await outcomes(ctx, call.id);
      check(rows.length === 1 && rows[0]?.type === "OUTCOME_RECORDED" && rows[0].originalInput === "first", "original content kept");
    },
  },
  {
    name: "a second outcome with a NEW event id is a conflict, even with identical content",
    async run(ctx) {
      const call = await dueCall(ctx, "conflict");
      const at = minutes(ctx.now(), -1);
      await ctx.store.appendEvent(ctx.newId(), spoke(call.id, at));
      check((await code(ctx.store.appendEvent(ctx.newId(), spoke(call.id, at)))) === "ALREADY_RESOLVED", "identical content, new id -> ALREADY_RESOLVED");
      check(
        (await code(ctx.store.appendEvent(ctx.newId(), { type: "OUTCOME_RECORDED", callId: call.id, at, outcome: "NO_ANSWER", originalInput: "", nextAction: null }))) === "ALREADY_RESOLVED",
        "different outcome -> ALREADY_RESOLVED",
      );
      check((await outcomes(ctx, call.id)).length === 1, "still exactly one outcome");
    },
  },
  {
    name: "snooze, dismissal and task-done never create an outcome, and nothing follows an outcome",
    async run(ctx) {
      const call = await dueCall(ctx, "non-outcome");
      const at = minutes(ctx.now(), -2);
      await ctx.store.appendEvent(ctx.newId(), { type: "SNOOZED", callId: call.id, at, until: minutes(ctx.now(), 60) });
      await ctx.store.appendEvent(ctx.newId(), { type: "QUESTION_DISMISSED", callId: call.id, at });
      await ctx.store.appendEvent(ctx.newId(), { type: "TASK_MARKED_DONE", callId: call.id, at });
      check((await outcomes(ctx, call.id)).length === 0, "no outcome from non-outcome events");
      await ctx.store.appendEvent(ctx.newId(), spoke(call.id, minutes(ctx.now(), -1)));
      check((await code(ctx.store.appendEvent(ctx.newId(), { type: "QUESTION_DISMISSED", callId: call.id, at: minutes(ctx.now(), -1) }))) === "ALREADY_RESOLVED", "no dismissal after an outcome");
    },
  },
  {
    name: "invalid events are rejected: appointment rules, future events, unknown calls",
    async run(ctx) {
      const call = await dueCall(ctx, "invalid");
      const at = minutes(ctx.now(), -1);
      const appt = minutes(ctx.now(), 2 * 24 * 60);
      const base = { type: "OUTCOME_RECORDED" as const, callId: call.id, at, originalInput: "" };
      check((await code(ctx.store.appendEvent(ctx.newId(), { ...base, outcome: "NO_ANSWER", nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: appt, clientConfirmed: true } }))) === "APPOINTMENT_REQUIRES_SPOKE", "appointment after no answer");
      check((await code(ctx.store.appendEvent(ctx.newId(), { ...base, outcome: "SPOKE", nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: appt, clientConfirmed: false } }))) === "APPOINTMENT_NOT_CONFIRMED", "appointment without confirmation");
      check((await code(ctx.store.appendEvent(ctx.newId(), { ...base, outcome: "CANCELLED", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: at.slice(0, 10) } }))) === "NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME", "next action on cancelled call");
      check((await code(ctx.store.appendEvent(ctx.newId(), { type: "QUESTION_DISMISSED", callId: call.id, at: minutes(ctx.now(), 30) }))) === "FUTURE_EVENT", "future-dated event");
      check((await code(ctx.store.appendEvent(ctx.newId(), { type: "QUESTION_DISMISSED", callId: "no-such-call-" + ctx.newId().slice(0, 8), at }))) === "UNKNOWN_CALL", "unknown call");
      check((await outcomes(ctx, call.id)).length === 0, "rejected events stored nothing");
    },
  },
];
