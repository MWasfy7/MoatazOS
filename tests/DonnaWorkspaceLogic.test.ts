import { describe, expect, it } from "vitest";
import {
  AI_COST_THIS_SESSION_USD,
  AI_MODEL_CALLS_THIS_SESSION,
  AI_MONTHLY_CAP_USD,
  AI_STATUS,
  applyEvent,
  buildClientMemory,
  buildToday,
  createDemoState,
  createState,
  DEMO_CLIENTS,
  DEMO_NOW,
  DEMO_POLICY,
  draftFollowUp,
  type DonnaEventInput,
  type DonnaState,
  type OutcomeRecord,
} from "@/lib/donna";

// Pure logic only: no store, no network, no model.

function record(over: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    seq: 1,
    at: "2026-10-26T10:00:00.000Z",
    outcome: "SPOKE",
    originalInput: "PRIVATE-NOTE-DO-NOT-LEAK",
    nextStep: null,
    confirmedFacts: [{ kind: "OUTCOME", outcome: "SPOKE" }],
    unknownFields: [],
    nextAction: null,
    ...over,
  };
}

function apply(state: DonnaState, event: DonnaEventInput): DonnaState {
  const result = applyEvent(state, event, event.at);
  if (!result.ok) throw new Error(`unexpected ${result.error}`);
  return result.state;
}

describe("Today view", () => {
  it("lists due calls without an outcome, the rest of today's calls, and open commitments (demo data)", () => {
    const view = buildToday(createDemoState(), DEMO_NOW);
    expect(view.today).toBe("2026-10-26");
    expect(view.needsOutcome.map((q) => q.callId)).toEqual(["call-alpha", "call-beta"]);
    expect(view.callsToday.map((c) => c.id)).toEqual(["call-gamma"]);
    expect(view.commitments).toEqual([
      expect.objectContaining({ callId: "call-delta", kind: "INTERNAL_FOLLOW_UP", due: "2026-10-28", status: "UPCOMING", nextStep: null }),
    ]);
  });

  it("moves a follow-up from upcoming to today to overdue as the clock advances, and keeps it visible", () => {
    const status = (now: string) => buildToday(createDemoState(), now).commitments[0]?.status;
    expect(status("2026-10-27T10:00:00.000Z")).toBe("UPCOMING");
    expect(status("2026-10-28T10:00:00.000Z")).toBe("TODAY");
    expect(status("2026-10-29T10:00:00.000Z")).toBe("OVERDUE");
    expect(status("2027-01-01T10:00:00.000Z")).toBe("OVERDUE");
  });

  const T0 = "2026-10-20T09:00:00.000Z";
  const T1 = "2026-10-21T09:00:00.000Z";
  function twoCalls(): DonnaState {
    return createState(DEMO_POLICY, DEMO_CLIENTS, [
      { id: "c1", clientId: "cl-alpha", dueAt: T0 },
      { id: "c2", clientId: "cl-alpha", dueAt: T1 },
      { id: "c3", clientId: "cl-beta", dueAt: T1 },
    ]);
  }
  const first: DonnaEventInput = {
    type: "OUTCOME_RECORDED", callId: "c1", at: "2026-10-20T10:00:00.000Z", outcome: "SPOKE",
    originalInput: "n", nextStep: "Send plan", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-22" },
  };

  it("hides a commitment only after a LATER conversation (SPOKE) with the same client, and counts it", () => {
    let state = apply(twoCalls(), first);
    const now = "2026-10-25T10:00:00.000Z";
    expect(buildToday(state, now).commitments).toHaveLength(1);
    // A no-answer call afterwards does not discharge the commitment.
    state = apply(state, { type: "OUTCOME_RECORDED", callId: "c2", at: "2026-10-21T10:00:00.000Z", outcome: "NO_ANSWER", originalInput: "", nextAction: null });
    expect(buildToday(state, now).commitments).toHaveLength(1);
    // A different client's conversation does not either.
    state = apply(state, { type: "OUTCOME_RECORDED", callId: "c3", at: "2026-10-21T10:00:00.000Z", outcome: "SPOKE", originalInput: "", nextAction: null });
    expect(buildToday(state, now).commitments).toHaveLength(1);
  });

  it("a later SPOKE with the same client hides the earlier commitment", () => {
    const state = createState(DEMO_POLICY, DEMO_CLIENTS, [
      { id: "c1", clientId: "cl-alpha", dueAt: T0 },
      { id: "c2", clientId: "cl-alpha", dueAt: T1 },
    ]);
    const after = apply(apply(state, first), { type: "OUTCOME_RECORDED", callId: "c2", at: "2026-10-21T10:00:00.000Z", outcome: "SPOKE", originalInput: "", nextAction: null });
    const view = buildToday(after, "2026-10-25T10:00:00.000Z");
    expect(view.commitments).toHaveLength(0);
    expect(view.handledCount).toBe(1);
  });

  it("shows the operator's next step verbatim, orders overdue before today before upcoming, and flags a past appointment", () => {
    let state = createState(DEMO_POLICY, DEMO_CLIENTS, [
      { id: "c1", clientId: "cl-alpha", dueAt: T0 },
      { id: "c2", clientId: "cl-beta", dueAt: T0 },
      { id: "c3", clientId: "cl-gamma", dueAt: T0 },
    ]);
    state = apply(state, { ...first, nextStep: " Send plan ", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-30" } });
    state = apply(state, { type: "OUTCOME_RECORDED", callId: "c2", at: "2026-10-20T10:00:00.000Z", outcome: "SPOKE", originalInput: "", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-21" } });
    state = apply(state, {
      type: "OUTCOME_RECORDED", callId: "c3", at: "2026-10-20T10:00:00.000Z", outcome: "SPOKE", originalInput: "",
      nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: "2026-10-23T09:00:00.000Z", clientConfirmed: true },
    });
    const view = buildToday(state, "2026-10-25T10:00:00.000Z");
    expect(view.commitments.map((c) => [c.callId, c.status])).toEqual([
      ["c2", "OVERDUE"],
      ["c3", "OVERDUE"],
      ["c1", "UPCOMING"],
    ]);
    expect(view.commitments.find((c) => c.callId === "c1")?.nextStep).toBe(" Send plan ");
    expect(view.commitments.find((c) => c.callId === "c3")?.kind).toBe("CLIENT_CONFIRMED_APPOINTMENT");
  });
});

describe("follow-up drafts (templates, no model)", () => {
  const base = { clientName: "Synthetic Client Alpha", offsetMinutes: 120 };

  it("uses the next step verbatim and never the private note or an unagreed internal date", () => {
    const draft = draftFollowUp({
      ...base, locale: "en",
      record: record({ nextStep: "Send the payment plan", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-28" } }),
    });
    expect(draft?.text).toContain("Hello Synthetic Client Alpha,");
    expect(draft?.text).toContain("Next step: Send the payment plan");
    expect(draft?.text).not.toContain("PRIVATE-NOTE-DO-NOT-LEAK");
    expect(draft?.text).not.toContain("2026-10-28");
    expect(draft?.basis).toEqual(["OUTCOME", "NEXT_STEP"]);
  });

  it("states a time only when the client confirmed it", () => {
    const draft = draftFollowUp({
      ...base, locale: "en",
      record: record({ nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: "2026-10-30T09:00:00.000Z", clientConfirmed: true } }),
    });
    expect(draft?.text).toContain("Confirming the appointment we agreed: 2026-10-30 11:00.");
    expect(draft?.basis).toContain("CONFIRMED_APPOINTMENT");
  });

  it("writes a different message for no answer, and offers none for did-not-call or cancelled", () => {
    expect(draftFollowUp({ ...base, locale: "en", record: record({ outcome: "NO_ANSWER" }) })?.text).toContain("could not get through");
    expect(draftFollowUp({ ...base, locale: "en", record: record({ outcome: "DID_NOT_CALL" }) })).toBeNull();
    expect(draftFollowUp({ ...base, locale: "en", record: record({ outcome: "CANCELLED" }) })).toBeNull();
  });

  it("has an Arabic version with the same safety rules", () => {
    const draft = draftFollowUp({
      ...base, clientName: "عميل تجريبي ألفا", locale: "ar",
      record: record({ nextStep: "إرسال خطة الأقساط", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-28" } }),
    });
    expect(draft?.text).toContain("مرحبًا عميل تجريبي ألفا،");
    expect(draft?.text).toContain("الخطوة التالية: إرسال خطة الأقساط");
    expect(draft?.text).not.toContain("PRIVATE-NOTE-DO-NOT-LEAK");
    expect(draft?.text).not.toContain("2026-10-28");
  });

  it("is deterministic", () => {
    const input = { ...base, locale: "en" as const, record: record({ nextStep: "x" }) };
    expect(draftFollowUp(input)).toEqual(draftFollowUp(input));
  });
});

describe("client memory view", () => {
  it("carries the operator's words and next step exactly, newest first, grouped by client", () => {
    const T0 = "2026-10-20T09:00:00.000Z";
    let state = createState(DEMO_POLICY, DEMO_CLIENTS, [
      { id: "c1", clientId: "cl-alpha", dueAt: T0 },
      { id: "c2", clientId: "cl-alpha", dueAt: T0 },
    ]);
    state = apply(state, { type: "OUTCOME_RECORDED", callId: "c1", at: "2026-10-20T10:00:00.000Z", outcome: "SPOKE", originalInput: "  first note \n", nextStep: " step one ", nextAction: null });
    state = apply(state, { type: "OUTCOME_RECORDED", callId: "c2", at: "2026-10-20T11:00:00.000Z", outcome: "NO_ANSWER", originalInput: "", nextAction: null });
    const memory = buildClientMemory(state, "2026-10-25T10:00:00.000Z");
    expect(memory).toHaveLength(1);
    expect(memory[0]?.clientId).toBe("cl-alpha");
    expect(memory[0]?.entries.map((e) => e.callId)).toEqual(["c2", "c1"]);
    expect(memory[0]?.entries[1]).toMatchObject({ note: "  first note \n", nextStep: " step one " });
  });
});

describe("model and cost status", () => {
  it("connects no model and allows no spending", () => {
    expect(AI_STATUS.filter((p) => p.state === "ACTIVE").map((p) => p.id)).toEqual(["templates"]);
    expect(AI_STATUS.filter((p) => p.id !== "templates").every((p) => p.state === "NOT_CONNECTED")).toBe(true);
    expect(AI_MODEL_CALLS_THIS_SESSION).toBe(0);
    expect(AI_COST_THIS_SESSION_USD).toBe(0);
    expect(AI_MONTHLY_CAP_USD).toBe(0);
  });
});
