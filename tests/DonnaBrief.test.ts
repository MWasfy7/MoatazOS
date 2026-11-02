import { describe, expect, it } from "vitest";
import {
  buildMorningBrief,
  createDemoProfiles,
  createDemoState,
  DEMO_NOW,
  type BriefLine,
  type ClientProfile,
} from "@/lib/donna";

const state = createDemoState();
const profiles = createDemoProfiles(DEMO_NOW);
const brief = () => buildMorningBrief(state, profiles, DEMO_NOW);
const kinds = (lines: readonly BriefLine[]) => lines.map((l) => `${l.kind}:${l.clientId}`);
const edit = (id: string, patch: Partial<ClientProfile>) => profiles.map((p) => (p.clientId === id ? { ...p, ...patch } : p));

describe("buildMorningBrief", () => {
  it("puts restraint first: who to leave alone outranks everything else", () => {
    const lines = brief().lines;
    expect(lines[0]).toMatchObject({ kind: "HOLD_OFF", clientId: "cl-beta", reason: "UNANSWERED", count: 3 });
    expect(lines[1]).toMatchObject({ kind: "HOLD_OFF", clientId: "cl-delta", reason: "ASKED_FOR_SPACE" });
    expect(brief().holdingOff).toEqual(["cl-beta", "cl-delta"]);
  });

  it("never suggests contacting a held client: no cold, call or gap line for them", () => {
    const held = new Set(brief().holdingOff);
    for (const line of brief().lines) {
      if (["GOING_COLD", "CALL_TODAY", "MISSING_INFO"].includes(line.kind)) expect(held.has(line.clientId)).toBe(false);
    }
  });

  it("asking for space wins even for a hot lead with a planned call and our turn", () => {
    const lines = buildMorningBrief(state, edit("cl-gamma", { askedForSpace: true }), DEMO_NOW).lines;
    expect(kinds(lines)).toContain("HOLD_OFF:cl-gamma");
    expect(kinds(lines)).not.toContain("CALL_TODAY:cl-gamma");
  });

  it("lists overdue and due-today promises with the operator's exact words", () => {
    const lines = brief().lines;
    expect(lines).toContainEqual({ kind: "PROMISE_OVERDUE", clientId: "cl-alpha", text: "Send the payment plan for the 3rd-floor unit", days: 2 });
    expect(lines).toContainEqual({ kind: "PROMISE_TODAY", clientId: "cl-gamma", text: "Bring two layout options to compare" });
    expect(buildMorningBrief(state, edit("cl-alpha", { promises: [] }), DEMO_NOW).lines.some((l) => l.kind === "PROMISE_OVERDUE")).toBe(false);
  });

  it("asks for outcomes of due calls with no feedback (never assumes they happened)", () => {
    expect(kinds(brief().lines)).toEqual(expect.arrayContaining(["OUTCOME_MISSING:cl-alpha", "OUTCOME_MISSING:cl-beta"]));
  });

  it("flags a hot lead as going cold only when it is our turn and contact is old enough", () => {
    expect(brief().lines).toContainEqual({ kind: "GOING_COLD", clientId: "cl-alpha", days: 9 });
    expect(kinds(buildMorningBrief(state, edit("cl-alpha", { turn: "CLIENT" }), DEMO_NOW).lines)).not.toContain("GOING_COLD:cl-alpha");
    expect(kinds(buildMorningBrief(state, edit("cl-alpha", { hot: false }), DEMO_NOW).lines)).not.toContain("GOING_COLD:cl-alpha");
  });

  it("briefs today's call with what the client wants and the open promise", () => {
    const call = brief().lines.find((l) => l.kind === "CALL_TODAY");
    expect(call).toMatchObject({ clientId: "cl-gamma", wants: { area: "Sheikh Zayed", unit: "a townhouse" }, openPromise: "Bring two layout options to compare" });
  });

  it("asks one gap question per client it talks about, never invents the answer", () => {
    const gaps = brief().lines.filter((l) => l.kind === "MISSING_INFO");
    expect(gaps).toEqual([{ kind: "MISSING_INFO", clientId: "cl-gamma", field: "budget" }]);
  });

  it("is deterministic for the same inputs", () => {
    expect(brief()).toEqual(brief());
  });
});
