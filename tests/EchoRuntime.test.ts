import { describe, expect, it } from "vitest";
import {
  createEchoRuntime,
  type EchoContextReference,
  type EchoInput,
} from "@/lib/echo";

const timestamp = "2026-09-19T09:00:00.000Z";
const input = (
  text: string,
  overrides: Partial<EchoInput> = {},
): EchoInput => ({
  text,
  inputMode: "TEXT",
  timestamp,
  session: { id: "test-session" },
  ...overrides,
});

const reference = (id: string, label: string): EchoContextReference => ({
  id,
  label,
  kind: "PROJECT",
});

describe("ECHO Build 0 natural conversational runtime", () => {
  it("returns the complete EchoResult contract", () => {
    const result = createEchoRuntime().process(input("Hello Echo"));
    expect(result).toMatchObject({
      response: expect.any(String),
      resolvedIntent: expect.objectContaining({ kind: "GREETING" }),
      confidence: expect.stringMatching(/HIGH|MEDIUM|LOW/u),
      destination: expect.any(String),
      proposedActions: expect.any(Array),
      clarificationRequired: expect.any(Boolean),
      contextReferences: expect.any(Array),
      assumptions: expect.any(Array),
    });
  });

  it.each([
    ["English", "continue from where we stopped"],
    ["Egyptian Arabic", "يلا كمل من آخر حاجة"],
    ["Franco-Arabic", "yalla kammel men akher 7aga"],
    ["mixed language", "yalla continue من آخر نقطة"],
  ])("resolves %s continuation from the active session context", (_label, text) => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO natural runtime"));
    const result = runtime.process(input(text));
    expect(result.resolvedIntent.kind).toBe("CONTINUE");
    expect(result.clarificationRequired).toBe(false);
    expect(result.contextReferences.at(-1)?.label).toBe("ECHO natural runtime");
    expect(result.proposedActions[0]).toMatchObject({
      kind: "CONTINUE_THREAD",
      externalSideEffect: false,
    });
    expect(result.response).toContain("ECHO natural runtime");
  });

  it("uses the same reasoning path for text and voice transcripts", () => {
    const text = createEchoRuntime().process(
      input("please review the ECHO runtime", { inputMode: "TEXT" }),
    );
    const voice = createEchoRuntime().process(
      input("please review the ECHO runtime", { inputMode: "VOICE_TRANSCRIPT" }),
    );
    expect(voice).toEqual(text);
  });

  it("normalizes repeated fillers in a noisy transcript compositionally", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("the runtime test plan"));
    const result = runtime.process(
      input("uh uh yalla yalla continue that please", {
        inputMode: "VOICE_TRANSCRIPT",
      }),
    );
    expect(result.resolvedIntent.kind).toBe("CONTINUE");
    expect(result.resolvedIntent.normalizedText).toBe("uh yalla continue that please");
    expect(result.assumptions).toContain(
      "Continue refers to the current focus in this session.",
    );
  });

  it("resolves a pronoun against one active focus", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("the validation issue"));
    const result = runtime.process(input("fix that"));
    expect(result.resolvedIntent.kind).toBe("ACTION_REQUEST");
    expect(result.clarificationRequired).toBe(false);
    expect(result.proposedActions[0]?.targetReferenceId).toBe(
      "topic:the-validation-issue",
    );
    expect(result.response).toContain("the validation issue");
  });

  it("clarifies an unresolved consequential pronoun", () => {
    const result = createEchoRuntime().process(input("fix that"));
    expect(result.clarificationRequired).toBe(true);
    expect(result.confidence).toBe("LOW");
    expect(result.destination).toBe("CLARIFICATION");
    expect(result.proposedActions).toEqual([]);
  });

  it("clarifies only when multiple consequential targets remain", () => {
    const runtime = createEchoRuntime();
    const result = runtime.process(
      input("review this", {
        session: {
          id: "test-session",
          references: [
            reference("project:echo", "ECHO"),
            reference("project:website", "website"),
          ],
        },
      }),
    );
    expect(result.clarificationRequired).toBe(true);
    expect(result.response).toContain("ECHO or website");
  });

  it("does not clarify ordinary conversation or a non-consequential question", () => {
    const runtime = createEchoRuntime();
    const thought = runtime.process(
      input("I have been thinking about how this could feel more natural over time"),
    );
    const question = runtime.process(input("what do you think?"));
    expect(thought.clarificationRequired).toBe(false);
    expect(question.clarificationRequired).toBe(false);
    expect(thought.destination).toBe("CONVERSATION");
  });

  it.each([
    ["English correction", "No, not SalesOS. ECHO."],
    ["Egyptian Arabic correction", "لا قصدي إيكو مش سيلز"],
    ["Franco correction", "la2 asdy ECHO mesh SalesOS"],
  ])("updates only conversation context for %s", (_label, text) => {
    const runtime = createEchoRuntime();
    runtime.process(input("SalesOS"));
    const result = runtime.process(input(text));
    expect(result.resolvedIntent.kind).toBe("CORRECTION");
    expect(result.clarificationRequired).toBe(false);
    expect(result.proposedActions[0]).toMatchObject({
      kind: "UPDATE_CONVERSATION_FOCUS",
      externalSideEffect: false,
    });
    expect(runtime.snapshot("test-session")?.session.activeFocus?.label).not.toBe(
      "SalesOS",
    );
  });

  it("turns a short fragment into session context, then continues it", () => {
    const runtime = createEchoRuntime();
    const fragment = runtime.process(input("the onboarding flow"));
    const continuation = runtime.process(input("continue"));
    expect(fragment.resolvedIntent).toMatchObject({
      kind: "CONTEXT_UPDATE",
      isFragment: true,
    });
    expect(continuation.response).toContain("the onboarding flow");
  });

  it("responds naturally instead of using a generic bounded-instruction rejection", () => {
    const result = createEchoRuntime().process(
      input("I’m frustrated and need to think this through with you for a minute"),
    );
    expect(result.response).not.toMatch(/bounded instruction|cannot process|unsupported command/iu);
    expect(result.response).toContain("following");
    expect(result.clarificationRequired).toBe(false);
  });

  it("proposes review but never represents an external side effect", () => {
    const result = createEchoRuntime().process(
      input("review the ECHO input flow"),
    );
    expect(result.destination).toBe("ACTION_REVIEW");
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions.every((action) => action.externalSideEffect === false)).toBe(true);
    expect(result.proposedActions.every((action) => action.status === "PROPOSED")).toBe(true);
    expect(result.response).toContain("nothing external has run");
  });

  it("keeps session context isolated", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("Project Alpha", { session: { id: "alpha" } }));
    runtime.process(input("Project Beta", { session: { id: "beta" } }));
    const alpha = runtime.process(input("continue", { session: { id: "alpha" } }));
    const beta = runtime.process(input("continue", { session: { id: "beta" } }));
    expect(alpha.response).toContain("Project Alpha");
    expect(alpha.response).not.toContain("Project Beta");
    expect(beta.response).toContain("Project Beta");
  });

  it("returns a mode-specific empty-input response without side effects", () => {
    const result = createEchoRuntime().process(
      input("", { inputMode: "VOICE_TRANSCRIPT" }),
    );
    expect(result.response).toContain("transcript");
    expect(result.proposedActions).toEqual([]);
    expect(result.clarificationRequired).toBe(false);
  });

  it("keeps a greeting conversational without replacing the active focus", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO runtime"));
    const result = runtime.process(input("morning"));
    expect(result.resolvedIntent.kind).toBe("GREETING");
    expect(result.proposedActions).toEqual([]);
    expect(runtime.snapshot("test-session")?.session.activeFocus?.label).toBe("ECHO runtime");
  });

  it.each([
    ["English", "don't change that file"],
    ["noisy transcript", "uh send send that to wait no"],
    ["Egyptian Arabic", "بلاش نبعت دلوقتي"],
  ])("honors %s cancellation before positive action words", (_label, text) => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO runtime"));
    const result = runtime.process(input(text));
    expect(result.resolvedIntent.kind).toBe("CANCEL_REQUEST");
    expect(result.proposedActions).toEqual([]);
    expect(result.response).toContain("Nothing external has run");
  });

  it("recognizes a scoped follow-up restraint without replacing focus", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("Mostafa's deal"));
    const result = runtime.process(input("مش عايز أي follow up تاني، خلاص"));
    expect(result.resolvedIntent.kind).toBe("RESTRAINT_REQUEST");
    expect(result.proposedActions).toEqual([]);
    expect(runtime.snapshot("test-session")?.session.activeFocus?.label).toBe("Mostafa's deal");
  });

  it("recognizes an outbound request and clarifies unbound payload and recipient", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO runtime"));
    const result = runtime.process(input("send that to him"));
    expect(result.resolvedIntent).toMatchObject({ kind: "ACTION_REQUEST", operation: "send" });
    expect(result.clarificationRequired).toBe(true);
    expect(result.proposedActions).toEqual([]);
  });

  it("recognizes a destructive request while keeping it proposal-only", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("the stale client record"));
    const result = runtime.process(input("delete it"));
    expect(result.resolvedIntent).toMatchObject({ kind: "ACTION_REQUEST", operation: "delete" });
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]).toMatchObject({ externalSideEffect: false, status: "PROPOSED" });
    expect(result.response).toContain("nothing external has run");
  });

  it("uses monotonic turn IDs after bounded history truncation", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO runtime"));
    for (let index = 0; index < 13; index += 1) runtime.process(input("continue"));
    const turns = runtime.snapshot("test-session")?.session.turns ?? [];
    expect(new Set(turns.map(({ id }) => id)).size).toBe(turns.length);
    expect(runtime.snapshot("test-session")?.nextTurnSequence).toBe(28);
  });

  it("assigns a unique ID to each proposal instance", () => {
    const runtime = createEchoRuntime();
    runtime.process(input("ECHO runtime"));
    const first = runtime.process(input("fix that"));
    const second = runtime.process(input("fix that"));
    expect(first.proposedActions[0]?.id).not.toBe(second.proposedActions[0]?.id);
  });

  it.each(["متغيرش الملف ده", "matghayarsh el file", "balash eb3atlo", "don't change that file"])("suppresses negated actions with text/transcript parity: %s", (text) => {
    const typed = createEchoRuntime().process(input(text));
    const transcript = createEchoRuntime().process(input(text, { inputMode: "VOICE_TRANSCRIPT" }));
    expect(typed.resolvedIntent.kind).toBe("CANCEL_REQUEST");
    expect(typed.proposedActions).toEqual([]);
    expect(transcript).toEqual(typed);
  });

  it.each(["I don't know", "what is a stop rule?", "explain the cancellation policy"])("does not mistake ordinary negative or quoted vocabulary for cancellation: %s", (text) => {
    const result = createEchoRuntime().process(input(text));
    expect(["CANCEL_REQUEST", "RESTRAINT_REQUEST"]).not.toContain(result.resolvedIntent.kind);
  });

  it.each(["ابعتله دي", "eb3atlo da", "send that to him"])("clarifies an outbound request without inventing recipient binding: %s", (text) => {
    const result = createEchoRuntime().process(input(text));
    expect(result.resolvedIntent.operation).toBe("send");
    expect(result.clarificationRequired).toBe(true);
    expect(result.response).toContain("no sending service is connected");
    expect(result.proposedActions).toEqual([]);
  });

  it.each(["send", "delete", "delete it"])("asks for missing targets on first-turn actions: %s", (text) => {
    const result = createEchoRuntime().process(input(text));
    expect(result.clarificationRequired).toBe(true);
    expect(result.proposedActions).toEqual([]);
  });

  it.each(["change the ECHO layout", "غير الملف", "ghayar el file"])("retains positive action handling: %s", (text) => {
    const result = createEchoRuntime().process(input(text));
    expect(result.resolvedIntent.kind).toBe("ACTION_REQUEST");
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]?.externalSideEffect).toBe(false);
  });
});
