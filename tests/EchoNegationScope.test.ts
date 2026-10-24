import { describe, expect, it } from "vitest";
import {
  createEchoRuntime,
  type EchoContextReference,
  type EchoInput,
} from "@/lib/echo";

// Regression suite for docs/engineering/reviews/PR-12-f3dd965.md (invariant 9):
// negative and cancellation instructions must be honored before any action routing.
// Session mirrors the review: one context reference ("Proposal draft") as active focus.

const timestamp = "2026-09-19T09:00:00.000Z";
const focus: EchoContextReference = {
  id: "artifact:proposal-draft",
  label: "Proposal draft",
  kind: "ARTIFACT",
};

const run = (text: string) =>
  createEchoRuntime().process({
    text,
    inputMode: "TEXT",
    timestamp,
    session: { id: "negation-session", references: [focus], activeFocus: focus },
  } satisfies EchoInput);

const RESTRAINT_KINDS = ["CANCEL_REQUEST", "RESTRAINT_REQUEST"];

describe("ECHO invariant 9 — negation scope over action verbs", () => {
  // The 10 defects from the PR #12 @ f3dd965 review (EN / Arabic / Franco).
  it.each([
    ["#1 EN no-apostrophe delete", "dont delete it"],
    ["#2 EN no-apostrophe send", "dont send it"],
    ["#3 EN hold off", "hold off on sending"],
    ["#4 EN trailing retraction", "can you send it? just kidding, don't"],
    ["#5 MSA/EG la + delete", "لا تحذف الملف"],
    ["#6 EN no need to call", "no need to call him"],
    ["#7 EG mesh 3ayez call", "مش عايز اتصل بيه"],
    ["#8 Franco spaced circumfix", "ma tb3atsh el contract"],
    ["#9 EG circumfix with suffix", "متبعتلوش العرض"],
    ["#10 EG spaced circumfix", "ما تبعتش حاجة"],
  ])("%s: %s → restraint, no proposal", (_label, text) => {
    const result = run(text);
    expect(RESTRAINT_KINDS).toContain(result.resolvedIntent.kind);
    expect(result.proposedActions).toEqual([]);
    expect(result.destination).toBe("CONVERSATION");
    expect(result.clarificationRequired).toBe(false);
  });

  // Inputs the review found already handled — must not regress.
  it.each([
    "don't send it",
    "do not send the proposal to Ahmed",
    "never send that message",
    "please don't delete the report",
    "don't not send it",
    "stop following up with the buyer",
    "ابعتلو بس متبعتش التاني",
  ])("still restrains: %s", (text) => {
    const result = run(text);
    expect(RESTRAINT_KINDS).toContain(result.resolvedIntent.kind);
    expect(result.proposedActions).toEqual([]);
  });

  // Positive controls: the fix must not swallow real requests.
  it.each([
    ["send it", "send"],
    ["delete it", "delete"],
    ["ابعته", "send"],
    ["امسح الملف", "delete"],
    ["eb3at el contract", "send"],
  ])("positive control routes to review, proposal-only: %s", (text, operation) => {
    const result = run(text);
    expect(result.resolvedIntent.kind).toBe("ACTION_REQUEST");
    expect(result.resolvedIntent.operation).toBe(operation);
    for (const action of result.proposedActions) expect(action.externalSideEffect).toBe(false);
  });

  // Adjacent phrasings found while probing the fix (not in the original 10).
  it.each(["send it. no.", "مش هبعت حاجة دلوقتي"])("also restrains: %s", (text) => {
    const result = run(text);
    expect(RESTRAINT_KINDS).toContain(result.resolvedIntent.kind);
    expect(result.proposedActions).toEqual([]);
  });

  // Negated forget/hesitate is a positive request, not a cancellation.
  // ("don't forget to send it" is still restrained by the pre-existing
  // restraintFrame regex — conservative, documented, out of this patch's scope.)
  it.each(["dont hesitate to send it", "متنساش تبعته"])(
    "polarity flip is not treated as cancellation: %s",
    (text) => {
      const result = run(text);
      expect(RESTRAINT_KINDS).not.toContain(result.resolvedIntent.kind);
      for (const action of result.proposedActions) expect(action.externalSideEffect).toBe(false);
    },
  );

  // Corrections without an action verb keep their existing meaning.
  it.each(["No, not SalesOS. ECHO.", "لا قصدي إيكو مش سيلز"])(
    "correction without action verb stays CORRECTION: %s",
    (text) => {
      expect(run(text).resolvedIntent.kind).toBe("CORRECTION");
    },
  );

  // A standalone "no" clause BEFORE the verb is a self-correction, not a negated verb.
  it("standalone leading 'لا،' does not cancel the following request", () => {
    expect(run("لا، ابعته").resolvedIntent.kind).not.toBe("CANCEL_REQUEST");
  });

  it("every proposal across the whole matrix keeps externalSideEffect:false", () => {
    for (const text of ["send it", "dont delete it", "delete it", "ابعته", "لا تحذف الملف"])
      for (const action of run(text).proposedActions) expect(action.externalSideEffect).toBe(false);
  });
});
