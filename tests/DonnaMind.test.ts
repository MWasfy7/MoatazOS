import { describe, expect, it } from "vitest";
import {
  buildMorningBrief,
  buildNameIndex,
  converse,
  createDemoProfiles,
  createDemoState,
  DEMO_CLIENTS,
  DEMO_NOW,
  fileProposal,
  findClient,
  normalizeText,
  opening,
  parseDueDate,
  parseQuantities,
  foldText,
  pickCalls,
  pickVoice,
  readBook,
  readDebrief,
  startConversation,
  understand,
  type Conversation,
  type Say,
  type World,
} from "@/lib/donna";

const names = buildNameIndex(DEMO_CLIENTS);
const world: World = { state: createDemoState(), profiles: createDemoProfiles(DEMO_NOW), now: DEMO_NOW, names };
const kinds = (says: readonly Say[]) => says.map((s) => s.kind);
const ask = (text: string, conv: Conversation = startConversation(), w: World = world) => converse(conv, text, w);

describe("Donna's ears: names, numbers and dates in English and Egyptian Arabic", () => {
  it("normalises Arabic letter variants and Arabic-Indic digits", () => {
    expect(normalizeText("أَلفا ٤٫٥ مليون")).toBe("الفا 4.5 مليون");
    expect(foldText("ألفا")).toHaveLength("ألفا".length);
  });

  it("finds a client however the name was spoken or spelled", () => {
    expect(findClient("tell me about Alpha", names)).toBe("cl-alpha");
    expect(findClient("قوليلي عن ألفا", names)).toBe("cl-alpha");
    expect(findClient("هقول لألفا السعر", names)).toBe("cl-alpha");
    expect(findClient("كلمت غاما", names)).toBe("cl-gamma");
    expect(findClient("what about gama", names)).toBe("cl-gamma");
    expect(findClient("who should I call", names)).toBeNull();
  });

  it("reads money, percentages, years and bedrooms", () => {
    const value = (text: string) => parseQuantities(foldText(text)).map((q) => [q.unit, q.value]);
    expect(value("4.5 million")).toEqual([["MONEY", 4_500_000]]);
    expect(value("٤ مليون ونص")).toEqual([["MONEY", 4_500_000]]);
    expect(value("مليونين")).toEqual([["MONEY", 2_000_000]]);
    expect(value("4,500,000")).toEqual([["MONEY", 4_500_000]]);
    expect(value("750k")).toEqual([["MONEY", 750_000]]);
    expect(value("10% down, delivery 2028, 8 years")).toEqual([["PERCENT", 10], ["YEAR", 2028], ["YEARS", 8]]);
    expect(value("تلات اوض")).toEqual([["BEDROOMS", 3]]);
  });

  it("turns spoken due dates into calendar dates (demo today is Monday 2026-10-26)", () => {
    expect(parseDueDate("send it tomorrow", "2026-10-26")).toBe("2026-10-27");
    expect(parseDueDate("ابعتها بعد بكره", "2026-10-26")).toBe("2026-10-28");
    expect(parseDueDate("by Thursday", "2026-10-26")).toBe("2026-10-29");
    expect(parseDueDate("يوم الخميس", "2026-10-26")).toBe("2026-10-29");
    expect(parseDueDate("no date here", "2026-10-26")).toBeNull();
  });

  it("picks a female voice in the reply language, Egyptian Arabic first", () => {
    const voices = [
      { name: "Microsoft David", lang: "en-US" },
      { name: "Microsoft Aria Online (Natural)", lang: "en-US" },
      { name: "Microsoft Naayf", lang: "ar-SA" },
      { name: "Microsoft Salma Online (Natural)", lang: "ar-EG" },
    ];
    expect(pickVoice(voices, "en")?.name).toMatch(/Aria/);
    expect(pickVoice(voices, "ar")?.name).toMatch(/Salma/);
    expect(pickVoice([{ name: "Microsoft David", lang: "en-US" }], "ar")).toBeNull();
    // A natural voice beats a robotic one; her character voice wins among naturals; never a man's.
    const many = [
      { name: "Samantha", lang: "en-US" },
      { name: "Microsoft Guy Online (Natural)", lang: "en-US" },
      { name: "Microsoft Jenny Online (Natural)", lang: "en-US" },
      { name: "Microsoft Ava Online (Natural)", lang: "en-US" },
    ];
    expect(pickVoice(many, "en")?.name).toMatch(/Ava/);
    expect(pickVoice(many.slice(0, 2), "en")?.name).toBe("Samantha");
  });
});

describe("Donna's book: temperature and drift", () => {
  it("marks the hot lead going cold, the held clients, and the warm one", () => {
    const heat = Object.fromEntries(readBook(world.profiles, DEMO_NOW, 120).map((e) => [e.clientId, e.heat]));
    expect(heat).toEqual({ "cl-alpha": "COOLING", "cl-beta": "HELD", "cl-gamma": "HOT", "cl-delta": "HELD", "cl-epsilon": "WARM" });
  });
});

describe("Donna's mind: she tells, restraint first", () => {
  it("opens with the brief: restraint lines before anything else, then who to start with", () => {
    const reply = opening(world);
    expect(reply.says[0]).toMatchObject({ kind: "OPEN", count: buildMorningBrief(world.state, world.profiles, DEMO_NOW).lines.length });
    expect(reply.says[1]).toMatchObject({ kind: "LINE", line: { kind: "HOLD_OFF", clientId: "cl-beta" } });
    expect(reply.says[2]).toMatchObject({ kind: "LINE", line: { kind: "HOLD_OFF", clientId: "cl-delta" } });
    expect(reply.says.at(-1)).toEqual({ kind: "START_WITH", clientId: "cl-alpha" });
  });

  it("who to call: names who to leave alone first, never picks a held client, puts the broken promise first", () => {
    for (const text of ["who should I call?", "اكلم مين النهارده؟"]) {
      const { reply } = ask(text);
      expect(reply.says[0]).toEqual({ kind: "NOT_THEM", clientIds: ["cl-beta", "cl-delta"] });
      const order = reply.says.find((s): s is Extract<Say, { kind: "CALL_ORDER" }> => s.kind === "CALL_ORDER");
      expect(order?.picks.map((p) => p.clientId)).toEqual(["cl-alpha", "cl-gamma"]);
      expect(order?.picks[0]?.reasons[0]).toEqual({ kind: "OWED_LATE", days: 2 });
    }
    expect(pickCalls(world).picks.some((p) => ["cl-beta", "cl-delta"].includes(p.clientId))).toBe(false);
  });

  it("about to call a client who stopped answering: STOP, and harder each time the operator pushes", () => {
    const first = ask("I'm about to call Beta");
    expect(first.reply.mood).toBe("STOP");
    expect(first.reply.says[0]).toMatchObject({ kind: "STOP_CALL", clientId: "cl-beta", reason: "UNANSWERED", count: 3 });
    const second = ask("should I call beta", first.conversation);
    expect(kinds(second.reply.says)).toEqual(["STOP_CALL", "PUSHBACK"]);
    expect(second.reply.says[1]).toEqual({ kind: "PUSHBACK", level: 1 });
    const third = ask("هكلم بيتا", second.conversation);
    expect(third.reply.says[1]).toEqual({ kind: "PUSHBACK", level: 2 });
  });

  it("asked for space means no message either", () => {
    const { reply } = ask("can I text Delta?");
    expect(reply.mood).toBe("STOP");
    expect(reply.says[0]).toMatchObject({ kind: "STOP_MESSAGE", clientId: "cl-delta", reason: "ASKED_FOR_SPACE" });
  });

  it("before a call: deliver what you owe first, then ask the missing question once (the owner's own rule)", () => {
    const { reply } = ask("prep me for Gamma");
    expect(kinds(reply.says)).toEqual(["PREP", "DELIVER_FIRST", "WANTS", "PERSONAL", "ASK_ONCE"]);
    expect(reply.says[1]).toEqual({ kind: "DELIVER_FIRST", text: "Bring two layout options to compare" });
    expect(reply.says.at(-1)).toEqual({ kind: "ASK_ONCE", field: "budget" });
  });

  it("messaging a client you owe: only the promised thing", () => {
    const { reply } = ask("should I send Alpha a message");
    expect(reply.says).toEqual([{ kind: "ONLY_THE_PROMISE", text: "Send the payment plan for the 3rd-floor unit" }]);
  });

  it("catches wrong information before it reaches the client, in either language", () => {
    const wrong = ask("I'll tell Alpha the price is 4 million");
    expect(wrong.reply.mood).toBe("STOP");
    expect(wrong.reply.says[0]).toMatchObject({ kind: "CLAIM_CONFLICT", before: { topic: "PRICE", value: 4_500_000 }, now: { value: 4_000_000 } });
    expect(ask("هقول لألفا السعر ٤٫٥ مليون").reply.says[0]).toMatchObject({ kind: "CLAIM_MATCH" });
    expect(ask("I'll tell Alpha delivery is 2029").reply.says[0]).toMatchObject({ kind: "CLAIM_CONFLICT", before: { topic: "DELIVERY", value: 2028 } });
  });

  it("answers about a client only from memory, and remembers who 'them' is", () => {
    const first = ask("tell me about alpha");
    expect(first.reply.says[0]).toEqual({ kind: "HEAT", clientId: "cl-alpha", heat: "COOLING", days: 9 });
    expect(first.conversation.focus).toBe("cl-alpha");
    const follow = ask("what did I promise them?", first.conversation);
    expect(follow.reply.says).toEqual([{ kind: "OWE", clientId: "cl-alpha", text: "Send the payment plan for the 3rd-floor unit", late: 2 }]);
  });

  it("a debrief becomes a proposal; nothing is filed until the operator says yes", () => {
    const text = "Just finished with Gamma. Budget is 5 million, cash. I promised to send the floor plans tomorrow. Her son starts university in September.";
    const heard = ask(text);
    expect(heard.file).toBeNull();
    expect(heard.reply.card).toEqual({ kind: "PROPOSAL" });
    const proposal = heard.conversation.proposal;
    expect(proposal).toMatchObject({ clientId: "cl-gamma", originalInput: text, proposalOnly: true, externalSideEffect: false });
    expect(proposal?.items).toEqual([
      { kind: "OUTCOME", outcome: "SPOKE" },
      { kind: "PROMISE", text: "send the floor plans", due: "2026-10-27", dueSaid: true },
      { kind: "WANTS", wants: { budget: "5M EGP", payment: "CASH" } },
      { kind: "PERSONAL", text: "Her son starts university in September" },
    ]);
    const filed = ask("file it", heard.conversation);
    expect(filed.file).toBe(proposal);
    expect(filed.reply.says[0]).toEqual({ kind: "FILED", clientId: "cl-gamma", promise: { text: "send the floor plans", due: "2026-10-27" } });
    const profiles = fileProposal(world.profiles, proposal!, DEMO_NOW);
    const gamma = profiles.find((p) => p.clientId === "cl-gamma");
    expect(gamma?.wants.budget).toBe("5M EGP");
    expect(gamma?.lastContactAt).toBe(DEMO_NOW);
    // Donna stops asking for the budget once she knows it.
    const brief = buildMorningBrief(world.state, profiles, DEMO_NOW).lines;
    expect(brief.some((l) => l.kind === "MISSING_INFO" && l.clientId === "cl-gamma")).toBe(false);
  });

  it("reads an Egyptian Arabic debrief and can be told no", () => {
    const heard = ask("لسه خالص مع جاما، ميزانيتها ٥ مليون كاش ووعدتها ابعتلها الماستر بلان بكره");
    expect(heard.conversation.proposal?.items).toEqual([
      { kind: "OUTCOME", outcome: "SPOKE" },
      { kind: "PROMISE", text: "ابعتلها الماستر بلان", due: "2026-10-27", dueSaid: true },
      { kind: "WANTS", wants: { budget: "5M EGP", payment: "CASH" } },
    ]);
    const no = ask("لا", heard.conversation);
    expect(no.file).toBeNull();
    expect(no.conversation.proposal).toBeNull();
    expect(no.reply.says).toEqual([{ kind: "DISCARDED" }]);
  });

  it("a debrief that says they asked for space or are unwell turns into a hold, never a follow-up", () => {
    const space = readDebrief("spoke to Epsilon, they asked for some time, will get back to me", "cl-epsilon", world, "SPOKE");
    expect(space.items).toContainEqual({ kind: "HOLD", reason: "ASKED_FOR_SPACE" });
    expect(space.items.some((i) => i.kind === "PROMISE")).toBe(false);
    const ill = readDebrief("كلمت إبسيلون، عيان ومش قادر يتكلم", "cl-epsilon", world, "SPOKE");
    expect(ill.items).toContainEqual({ kind: "HOLD", reason: "PERSONAL_BLOCKER" });
    const filed = fileProposal(world.profiles, ill, DEMO_NOW);
    expect(buildMorningBrief(world.state, filed, DEMO_NOW).holdingOff).toContain("cl-epsilon");
  });

  it("a missed call is one try: no retry today", () => {
    const { reply } = ask("I called Beta, no answer");
    expect(kinds(reply.says)).toEqual(["HEARD", "NO_RETRY", "CONFIRM"]);
  });

  it("asks who when the client is missing, then carries on", () => {
    const who = ask("I just finished a call");
    expect(who.reply.says).toEqual([{ kind: "WHO" }]);
    const go = ask("Gamma", who.conversation);
    expect(go.reply.says).toEqual([{ kind: "DEBRIEF_GO", clientId: "cl-gamma" }]);
    const heard = ask("budget is 6 million", go.conversation);
    expect(heard.conversation.proposal?.items).toEqual([
      { kind: "OUTCOME", outcome: "SPOKE" },
      { kind: "WANTS", wants: { budget: "6M EGP" } },
    ]);
  });

  it("closes a promise when the operator says it is done", () => {
    const turn = ask("I sent Alpha the payment plan");
    expect(turn.keep).toEqual({ clientId: "cl-alpha", promiseId: "p-alpha-1" });
  });

  it("has a personality, and never claims to have contacted anyone", () => {
    expect(understand("who are you", names, null)).toEqual({ kind: "IDENTITY" });
    expect(understand("شكرا يا دونا", names, null)).toEqual({ kind: "THANKS" });
    expect(ask("blah blah").reply.says).toEqual([{ kind: "UNKNOWN" }]);
    const utterances = ["brief me", "who should I call", "I'm calling Gamma", "message Alpha", "remind Beta", "just finished with Alpha, she wants a villa"];
    for (const text of utterances) {
      const json = JSON.stringify(ask(text).reply);
      expect(json).not.toMatch(/SENT|CALLED|SCHEDULED|BOOKED/);
    }
  });

  it("is deterministic: the same words against the same memory give the same answer", () => {
    expect(ask("prep me for Gamma")).toEqual(ask("prep me for Gamma"));
  });
});
