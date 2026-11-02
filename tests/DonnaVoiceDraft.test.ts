import { describe, expect, it } from "vitest";
import { draftFromTranscript, reviewVoiceDraft, type VoiceDraft } from "@/lib/donna";

const AT = "2026-11-02T09:00:00Z";
const make = (t: string) => draftFromTranscript(t, "SYN-1", AT);
const withVoice = (d: VoiceDraft, v: Record<string, unknown>) => ({ ...d, voice: { ...d.voice, ...v } }) as unknown as VoiceDraft;

describe("draftFromTranscript", () => {
  it("keeps the transcript verbatim", () => {
    const t = "  spoke, follow up 2026-11-05  ";
    expect(make(t).originalInput).toBe(t);
  });
  it("is always proposal-only with no side effect", () => {
    expect(make("anything").voice).toMatchObject({ proposalOnly: true, externalSideEffect: false, needsOperatorConfirmation: true });
  });
  it("proposes only an internal follow-up from an ISO date, never an appointment", () => {
    expect(make("spoke, follow up 2026-11-05").nextAction).toEqual({ kind: "INTERNAL_FOLLOW_UP", date: "2026-11-05" });
    expect(make("client confirmed a visit on 2026-11-06 at 14:00").nextAction?.kind).toBe("INTERNAL_FOLLOW_UP");
  });
  it("ignores impossible dates", () => {
    expect(make("spoke 2026-13-45").nextAction).toBeNull();
    expect(make("spoke 2026-02-30").nextAction).toBeNull();
  });
  it("detects Egyptian do-not-contact language and drops the next action", () => {
    for (const t of ["قالي مش عايز، بلاش تتصل بيا", "العميل قال متتصلش تاني 2026-11-05", "he said do not contact me"]) {
      const d = make(t);
      expect(d.voice.restraint).toBe(true);
      expect(d.nextAction).toBeNull();
    }
  });
  it("outcome: no answer wins over spoke, unknown stays null", () => {
    expect(make("no answer, I never spoke to him").outcome).toBe("NO_ANSWER");
    expect(make("كلمته امبارح").outcome).toBe("SPOKE");
    expect(make("some words").outcome).toBeNull();
    expect(make("some words").voice.unresolved).toEqual(["outcome", "nextAction"]);
  });
});

describe("reviewVoiceDraft", () => {
  it("normal draft proposes an internal follow-up", () => {
    expect(reviewVoiceDraft(make("spoke, follow up 2026-11-05")).decision).toBe("PROPOSE_INTERNAL_FOLLOW_UP");
  });
  it("restraint wins over a follow-up date, even if the flag was missed", () => {
    const d = make("spoke, follow up 2026-11-05");
    expect(reviewVoiceDraft({ ...d, originalInput: "العميل قال متتصلش تاني" }).decision).toBe("NO_ACTION");
  });
  it("rejects a voice-created client appointment", () => {
    const d = { ...make("spoke"), nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: AT, clientConfirmed: true } } as unknown as VoiceDraft;
    expect(reviewVoiceDraft(d).decision).toBe("REJECT_DRAFT");
  });
  it("rejects a draft claiming a side effect, and that beats restraint", () => {
    expect(reviewVoiceDraft(withVoice(make("spoke"), { externalSideEffect: true, restraint: true })).decision).toBe("REJECT_DRAFT");
  });
  it("empty transcript is insufficient evidence", () => {
    expect(reviewVoiceDraft(make("   ")).decision).toBe("INSUFFICIENT_EVIDENCE");
  });
  it("unknown outcome asks the operator", () => {
    expect(reviewVoiceDraft(make("some words 2026-11-05")).decision).toBe("ASK_OPERATOR_OUTCOME");
  });
});
