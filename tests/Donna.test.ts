import { describe, expect, it } from "vitest";
import {
  addMinutes,
  applyEvent,
  buildInbox,
  createDemoState,
  createState,
  DEMO_CALLS,
  DEMO_CLIENTS,
  DEMO_NOW,
  DEMO_POLICY,
  isInQuietHours,
  localToInstant,
  nextLocalMorning,
  type DonnaEventInput,
  type DonnaState,
} from "@/lib/donna";

const DUE = "2026-10-26T07:00:00.000Z";
const AFTER = "2026-10-26T07:01:00.000Z";

function single(): DonnaState {
  return createState(DEMO_POLICY, DEMO_CLIENTS, [{ id: "c1", clientId: "cl-alpha", dueAt: DUE }]);
}

function apply(state: DonnaState, event: DonnaEventInput, now: string): DonnaState {
  const result = applyEvent(state, event, now);
  if (!result.ok) throw new Error(`unexpected ${result.error}`);
  return result.state;
}

describe("Donna outcome questions", () => {
  it("creates no question before the due time and exactly one at or after it", () => {
    const state = single();
    expect(buildInbox(state, "2026-10-26T06:59:59.000Z").unresolved).toHaveLength(0);
    expect(buildInbox(state, "2026-10-26T06:59:59.000Z").upcoming).toHaveLength(1);
    expect(buildInbox(state, DUE).unresolved).toHaveLength(1);
    // Re-evaluating the same in-memory state proves deterministic derivation
    // only. It is NOT restart persistence: a reload resets the demo.
    const later = buildInbox(state, addMinutes(DUE, 600));
    expect(later.unresolved.map((q) => q.id)).toEqual(["q-c1"]);
  });

  it("does not assume the call happened: no outcome exists until the operator records one", () => {
    const inbox = buildInbox(single(), AFTER);
    expect(inbox.resolved).toHaveLength(0);
    expect(inbox.unresolved[0]).toMatchObject({ callId: "c1", taskMarkedDone: false });
  });

  it("keeps the question unresolved when the call task is marked done without an outcome", () => {
    const state = apply(single(), { type: "TASK_MARKED_DONE", callId: "c1", at: AFTER }, AFTER);
    const inbox = buildInbox(state, AFTER);
    expect(inbox.unresolved).toHaveLength(1);
    expect(inbox.unresolved[0]?.taskMarkedDone).toBe(true);
    expect(inbox.resolved).toHaveLength(0);
  });

  it("keeps the question unresolved when it is dismissed or ignored", () => {
    const state = apply(single(), { type: "QUESTION_DISMISSED", callId: "c1", at: AFTER }, AFTER);
    const inbox = buildInbox(state, addMinutes(AFTER, 5000));
    expect(inbox.unresolved).toHaveLength(1);
    expect(inbox.unresolved[0]?.dismissCount).toBe(1);
    expect(inbox.resolved).toHaveLength(0);
  });

  it("snooze moves the reminder, not the outcome, and the reminder returns when it expires", () => {
    const until = addMinutes(AFTER, 60);
    const state = apply(single(), { type: "SNOOZED", callId: "c1", at: AFTER, until }, AFTER);
    const during = buildInbox(state, addMinutes(AFTER, 30));
    expect(during.unresolved[0]).toMatchObject({ reminder: "SNOOZED", snoozedUntil: until });
    const expired = buildInbox(state, addMinutes(AFTER, 61));
    expect(expired.unresolved[0]).toMatchObject({ reminder: "DUE_NOW", snoozedUntil: null });
    expect(expired.resolved).toHaveLength(0);
  });

  it("a newer, shorter snooze supersedes an older, longer one (regression)", () => {
    const tomorrow = nextLocalMorning(AFTER, DEMO_POLICY, 9); // 09:00 local next day
    const shortUntil = addMinutes(AFTER, 60);
    let state = apply(single(), { type: "SNOOZED", callId: "c1", at: AFTER, until: tomorrow }, AFTER);
    state = apply(state, { type: "SNOOZED", callId: "c1", at: AFTER, until: shortUntil }, AFTER);
    expect(buildInbox(state, addMinutes(AFTER, 30)).unresolved[0]).toMatchObject({ reminder: "SNOOZED", snoozedUntil: shortUntil });
    // Just after the short snooze: due again, not revived to tomorrow.
    expect(buildInbox(state, addMinutes(AFTER, 61)).unresolved[0]).toMatchObject({ reminder: "DUE_NOW", snoozedUntil: null });
    // Quiet hours still apply once the snooze has expired.
    expect(buildInbox(state, "2026-10-26T21:00:00.000Z").unresolved[0]).toMatchObject({ reminder: "HELD_QUIET_HOURS", snoozedUntil: null });
  });

  it("holds reminders during quiet hours but still lists the question", () => {
    expect(isInQuietHours("2026-10-26T20:00:00.000Z", DEMO_POLICY)).toBe(true); // 22:00 local
    expect(isInQuietHours("2026-10-26T04:59:00.000Z", DEMO_POLICY)).toBe(true); // 06:59 local
    expect(isInQuietHours("2026-10-26T05:00:00.000Z", DEMO_POLICY)).toBe(false); // 07:00 local
    const inbox = buildInbox(single(), "2026-10-26T21:00:00.000Z");
    expect(inbox.unresolved).toHaveLength(1);
    expect(inbox.unresolved[0]?.reminder).toBe("HELD_QUIET_HOURS");
  });

  it("treats spoke, no answer, did not call and cancelled as distinct recorded outcomes", () => {
    for (const outcome of ["SPOKE", "NO_ANSWER", "DID_NOT_CALL", "CANCELLED"] as const) {
      const state = apply(
        single(),
        { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome, originalInput: "x", nextAction: null },
        AFTER,
      );
      const inbox = buildInbox(state, AFTER);
      expect(inbox.unresolved).toHaveLength(0);
      expect(inbox.resolved[0]?.record.outcome).toBe(outcome);
      expect(inbox.resolved[0]?.record.confirmedFacts[0]).toEqual({ kind: "OUTCOME", outcome });
    }
  });

  it("a cancelled call has no reminder at any later time", () => {
    const state = apply(
      single(),
      { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome: "CANCELLED", originalInput: "", nextAction: null },
      AFTER,
    );
    expect(buildInbox(state, addMinutes(AFTER, 100_000)).unresolved).toHaveLength(0);
  });

  it("rejects a second outcome, snooze, or dismissal once resolved (repeat delivery cannot duplicate)", () => {
    const outcome: DonnaEventInput = { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome: "NO_ANSWER", originalInput: "", nextAction: null };
    const state = apply(single(), outcome, AFTER);
    for (const event of [
      outcome,
      { type: "SNOOZED", callId: "c1", at: AFTER, until: addMinutes(AFTER, 5) } as const,
      { type: "QUESTION_DISMISSED", callId: "c1", at: AFTER } as const,
    ]) {
      expect(applyEvent(state, event, AFTER)).toEqual({ ok: false, error: "ALREADY_RESOLVED" });
    }
    expect(state.events.filter((e) => e.type === "OUTCOME_RECORDED")).toHaveLength(1);
  });

  it("rejects answering before the question exists, unknown calls, and future-dated entries", () => {
    const early = "2026-10-26T06:00:00.000Z";
    expect(applyEvent(single(), { type: "QUESTION_DISMISSED", callId: "c1", at: early }, early)).toEqual({ ok: false, error: "NOT_YET_DUE" });
    expect(applyEvent(single(), { type: "QUESTION_DISMISSED", callId: "nope", at: AFTER }, AFTER)).toEqual({ ok: false, error: "UNKNOWN_CALL" });
    expect(applyEvent(single(), { type: "QUESTION_DISMISSED", callId: "c1", at: addMinutes(AFTER, 1) }, AFTER)).toEqual({ ok: false, error: "FUTURE_EVENT" });
    expect(applyEvent(single(), { type: "SNOOZED", callId: "c1", at: AFTER, until: AFTER }, AFTER)).toEqual({ ok: false, error: "SNOOZE_NOT_IN_FUTURE" });
  });

  it("ignores events dated after the evaluation clock", () => {
    const state = apply(single(), { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome: "SPOKE", originalInput: "", nextAction: null }, AFTER);
    // Evaluating at an earlier clock must not see the later outcome.
    expect(buildInbox(state, DUE).unresolved).toHaveLength(1);
  });
});

describe("Donna next action: internal follow-up vs client-confirmed appointment", () => {
  const record = (nextAction: Parameters<typeof applyEvent>[1] extends infer E ? (E extends { nextAction: infer N } ? N : never) : never, outcome: "SPOKE" | "NO_ANSWER" | "CANCELLED" = "SPOKE") =>
    applyEvent(single(), { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome, originalInput: "note", nextAction }, AFTER);

  it("stores an internal follow-up date as the operator's own, never as a client agreement", () => {
    const result = record({ kind: "INTERNAL_FOLLOW_UP", date: "2026-10-29" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rec = buildInbox(result.state, AFTER).resolved[0]?.record;
    expect(rec?.nextAction).toEqual({ kind: "INTERNAL_FOLLOW_UP", date: "2026-10-29" });
    expect(rec?.confirmedFacts.some((f) => f.kind === "CLIENT_CONFIRMED_APPOINTMENT_AT")).toBe(false);
  });

  it("stores a client-confirmed appointment only with explicit client confirmation", () => {
    const at = "2026-10-30T09:00:00.000Z";
    expect(record({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at, clientConfirmed: false })).toEqual({ ok: false, error: "APPOINTMENT_NOT_CONFIRMED" });
    const ok = record({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at, clientConfirmed: true });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const rec = buildInbox(ok.state, AFTER).resolved[0]?.record;
    expect(rec?.nextAction).toEqual({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at, clientConfirmed: true });
    expect(rec?.confirmedFacts).toContainEqual({ kind: "CLIENT_CONFIRMED_APPOINTMENT_AT", at });
  });

  it("refuses a client-confirmed appointment when the client was not reached", () => {
    const at = "2026-10-30T09:00:00.000Z";
    expect(record({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at, clientConfirmed: true }, "NO_ANSWER")).toEqual({ ok: false, error: "APPOINTMENT_REQUIRES_SPOKE" });
    // No answer still allows the operator's own follow-up date.
    expect(record({ kind: "INTERNAL_FOLLOW_UP", date: "2026-10-27" }, "NO_ANSWER").ok).toBe(true);
  });

  it("validates dates and rejects a next action on a cancelled call", () => {
    expect(record({ kind: "INTERNAL_FOLLOW_UP", date: "2026-10-25" })).toEqual({ ok: false, error: "FOLLOW_UP_DATE_IN_PAST" });
    expect(record({ kind: "INTERNAL_FOLLOW_UP", date: "2026-02-31" })).toEqual({ ok: false, error: "FOLLOW_UP_DATE_INVALID" });
    expect(record({ kind: "INTERNAL_FOLLOW_UP", date: "" })).toEqual({ ok: false, error: "FOLLOW_UP_DATE_INVALID" });
    expect(record({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at: "2026-10-26T07:00:00.000Z", clientConfirmed: true })).toEqual({ ok: false, error: "APPOINTMENT_NOT_IN_FUTURE" });
    expect(record({ kind: "CLIENT_CONFIRMED_APPOINTMENT", at: "", clientConfirmed: true })).toEqual({ ok: false, error: "INVALID_INSTANT" });
    expect(record({ kind: "INTERNAL_FOLLOW_UP", date: "2026-10-29" }, "CANCELLED")).toEqual({ ok: false, error: "NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME" });
  });

  it("records original input verbatim and marks what the operator did not provide as unknown", () => {
    const note = "  كلمته وقال هيرد بكرة  ";
    const result = applyEvent(single(), { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome: "SPOKE", originalInput: note, nextAction: null }, AFTER);
    if (!result.ok) throw new Error(result.error);
    const rec = buildInbox(result.state, AFTER).resolved[0]?.record;
    expect(rec?.originalInput).toBe(note);
    expect(rec?.unknownFields).toEqual(["NEXT_ACTION"]);
    const blank = applyEvent(single(), { type: "OUTCOME_RECORDED", callId: "c1", at: AFTER, outcome: "NO_ANSWER", originalInput: " ", nextAction: null }, AFTER);
    if (!blank.ok) throw new Error(blank.error);
    expect(buildInbox(blank.state, AFTER).resolved[0]?.record.unknownFields).toEqual(["NOTE", "NEXT_ACTION"]);
  });
});

describe("Donna immutability, determinism and demo data", () => {
  it("appends without editing earlier state, and freezes everything", () => {
    const before = single();
    const after = apply(before, { type: "QUESTION_DISMISSED", callId: "c1", at: AFTER }, AFTER);
    expect(before.events).toHaveLength(0);
    expect(after.events).toHaveLength(1);
    expect(Object.isFrozen(after)).toBe(true);
    expect(Object.isFrozen(after.events[0])).toBe(true);
    expect(Object.isFrozen(buildInbox(after, AFTER).unresolved)).toBe(true);
    expect(after.events.map((e) => e.seq)).toEqual([1]);
  });

  it("is deterministic for the same state and clock", () => {
    expect(buildInbox(createDemoState(), DEMO_NOW)).toEqual(buildInbox(createDemoState(), DEMO_NOW));
  });

  it("demo opens with two unresolved questions, including a task marked done with no outcome", () => {
    const inbox = buildInbox(createDemoState(), DEMO_NOW);
    expect(inbox.unresolved.map((q) => q.callId)).toEqual(["call-alpha", "call-beta"]);
    expect(inbox.unresolved.find((q) => q.callId === "call-beta")?.taskMarkedDone).toBe(true);
    expect(inbox.upcoming.map((c) => c.id)).toEqual(["call-gamma", "call-epsilon"]);
    expect(inbox.resolved.map((r) => r.call.id)).toEqual(["call-delta"]);
    // One +1 hour click (11:00Z) does not make Gamma (due 13:00Z) a question; three do.
    expect(buildInbox(createDemoState(), addMinutes(DEMO_NOW, 60)).unresolved.map((q) => q.callId)).toEqual(["call-alpha", "call-beta"]);
    expect(buildInbox(createDemoState(), addMinutes(DEMO_NOW, 120)).unresolved).toHaveLength(2);
    expect(buildInbox(createDemoState(), addMinutes(DEMO_NOW, 180)).unresolved.map((q) => q.callId)).toContain("call-gamma");
    // Advancing the clock past a due time raises exactly one new question.
    const later = buildInbox(createDemoState(), addMinutes(DEMO_NOW, 180));
    expect(later.unresolved.map((q) => q.callId)).toEqual(["call-alpha", "call-beta", "call-gamma"]);
  });

  it("uses only synthetic client labels", () => {
    expect(DEMO_CALLS.length).toBeGreaterThan(0);
    for (const client of DEMO_CLIENTS) expect(client.label.en).toMatch(/^Synthetic Client /);
    expect(JSON.stringify([DEMO_CLIENTS, DEMO_CALLS])).not.toMatch(/\d{9,}|@/);
  });

  it("converts local wall time at the fixed offset and finds the next local morning", () => {
    expect(localToInstant("2026-10-30T11:00", 120)).toBe("2026-10-30T09:00:00.000Z");
    expect(localToInstant("2026-02-31T11:00", 120)).toBe("");
    expect(localToInstant("garbage", 120)).toBe("");
    expect(nextLocalMorning("2026-10-26T10:00:00.000Z", DEMO_POLICY, 9)).toBe("2026-10-27T07:00:00.000Z");
  });
});
