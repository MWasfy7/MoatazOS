import {
  buildMorningBrief,
  daysBetween,
  holdReason,
  type BriefLine,
  type ClientProfile,
  type ClientPromise,
  type ClientWants,
  type HoldReason,
  type ToldFact,
  type ToldTopic,
} from "./brief";
import { readBook, type Heat } from "./book";
import { buildInbox } from "./engine";
import { findClient, foldText, formatMoney, hasPhrase, normalizeText, parseDueDate, parseQuantities, tokenize, type NameIndex, type Quantity } from "./speech";
import { localParts } from "./time";
import type { DonnaState } from "./types";
import { hasRestraintLanguage } from "./voiceDraft";

/**
 * Donna's mind (pure and deterministic). One conversational turn at a time: what the operator
 * said, plus what Donna already knows, gives what she says back and any memory change the
 * operator confirmed. Every answer is built from recorded facts; nothing is invented.
 *
 * She tells, she never acts (AGENTS.md invariants 1, 9): no reply sends, calls, schedules or
 * books anything, and a debrief is only a proposal until the operator says "file it".
 * Restraint comes first (invariant 2): asking about a client Donna is holding off gets a stop,
 * and asking again gets a harder one.
 */

export type Mood = "CALM" | "WARN" | "STOP" | "PLEASED";
export type DayPart = "MORNING" | "AFTERNOON" | "EVENING";
export type Outcome = "SPOKE" | "NO_ANSWER";

export type CallReason =
  | { readonly kind: "OWED_LATE"; readonly days: number }
  | { readonly kind: "OWED_TODAY" }
  | { readonly kind: "QUIET"; readonly days: number }
  | { readonly kind: "PLANNED"; readonly at: string }
  | { readonly kind: "YOUR_MOVE" };

export interface CallPick {
  readonly clientId: string;
  readonly reasons: readonly CallReason[];
}

export type HoldHeard = "ASKED_FOR_SPACE" | "PERSONAL_BLOCKER" | "NOT_INTERESTED";

export type HeardItem =
  | { readonly kind: "OUTCOME"; readonly outcome: Outcome }
  | { readonly kind: "WANTS"; readonly wants: ClientWants }
  | { readonly kind: "PROMISE"; readonly text: string; readonly due: string; readonly dueSaid: boolean }
  | { readonly kind: "KEPT"; readonly promiseId: string; readonly text: string }
  | { readonly kind: "TOLD"; readonly fact: ToldFact }
  | { readonly kind: "PERSONAL"; readonly text: string }
  | { readonly kind: "HOLD"; readonly reason: HoldHeard };

export interface DebriefProposal {
  readonly clientId: string;
  /** Exactly what the operator said, never rewritten. */
  readonly originalInput: string;
  readonly items: readonly HeardItem[];
  readonly conflicts: ReadonlyArray<{ readonly before: ToldFact; readonly now: ToldFact }>;
  readonly proposalOnly: true;
  readonly externalSideEffect: false;
}

export type Say =
  | { readonly kind: "OPEN"; readonly part: DayPart; readonly count: number }
  | { readonly kind: "LINE"; readonly line: BriefLine }
  | { readonly kind: "MORE"; readonly count: number }
  | { readonly kind: "START_WITH"; readonly clientId: string }
  | { readonly kind: "CALL_ORDER"; readonly picks: readonly CallPick[] }
  | { readonly kind: "NOT_THEM"; readonly clientIds: readonly string[] }
  | { readonly kind: "NOBODY_TO_CALL" }
  | { readonly kind: "NO_HOLDS" }
  | { readonly kind: "OWE_COUNT"; readonly count: number }
  | { readonly kind: "OWE"; readonly clientId: string; readonly text: string; readonly late: number }
  | { readonly kind: "OWE_NONE"; readonly clientId: string }
  | { readonly kind: "NONE_COLD" }
  | { readonly kind: "HEAT"; readonly clientId: string; readonly heat: Heat; readonly days: number | null }
  | { readonly kind: "WANTS"; readonly wants: ClientWants }
  | { readonly kind: "PERSONAL"; readonly text: string }
  | { readonly kind: "TOLD"; readonly facts: readonly ToldFact[] }
  | { readonly kind: "GAP"; readonly field: keyof ClientWants }
  | { readonly kind: "TURN"; readonly turn: "ME" | "CLIENT" }
  | { readonly kind: "PREP"; readonly clientId: string; readonly at: string | null }
  | { readonly kind: "STOP_CALL"; readonly clientId: string; readonly reason: HoldReason; readonly count: number; readonly planned: boolean }
  | { readonly kind: "STOP_MESSAGE"; readonly clientId: string; readonly reason: HoldReason; readonly count: number }
  | { readonly kind: "PUSHBACK"; readonly level: 1 | 2 }
  | { readonly kind: "DELIVER_FIRST"; readonly text: string }
  | { readonly kind: "ASK_ONCE"; readonly field: keyof ClientWants }
  | { readonly kind: "ONLY_THE_PROMISE"; readonly text: string }
  | { readonly kind: "MESSAGE_OK" }
  | { readonly kind: "CLAIM_CONFLICT"; readonly clientId: string; readonly before: ToldFact; readonly now: ToldFact }
  | { readonly kind: "CLAIM_MATCH"; readonly before: ToldFact }
  | { readonly kind: "CLAIM_NEW"; readonly topic: ToldTopic }
  | { readonly kind: "DEBRIEF_GO"; readonly clientId: string }
  | { readonly kind: "HEARD"; readonly clientId: string }
  | { readonly kind: "HEARD_NOTHING" }
  | { readonly kind: "CONFIRM" }
  | { readonly kind: "NO_RETRY" }
  | { readonly kind: "SUPPORT_FIRST" }
  | { readonly kind: "SPACE_KEPT" }
  | { readonly kind: "DID_YOUR_PART" }
  | { readonly kind: "FILED"; readonly clientId: string; readonly promise: { readonly text: string; readonly due: string } | null }
  | { readonly kind: "KEPT"; readonly clientId: string; readonly text: string }
  | { readonly kind: "DISCARDED" }
  | { readonly kind: "NOTHING_PENDING" }
  | { readonly kind: "OK" }
  | { readonly kind: "WHO" }
  | { readonly kind: "IDENTITY" }
  | { readonly kind: "THANKS"; readonly variant: number }
  | { readonly kind: "HELLO" }
  | { readonly kind: "HELP" }
  | { readonly kind: "UNKNOWN" }
  | { readonly kind: "DECLINED"; readonly clientId: string | null };

export type Card = { readonly kind: "DOSSIER"; readonly clientId: string } | { readonly kind: "BRIEF" } | { readonly kind: "PROPOSAL" };

export interface Reply {
  readonly mood: Mood;
  readonly says: readonly Say[];
  readonly card: Card | null;
}

type Waiting = "BEFORE_CALL" | "DEBRIEF" | "CLAIM" | "KEPT";

export interface Conversation {
  /** The client the conversation is about, for "him", "her", "them". */
  readonly focus: string | null;
  readonly pending:
    | { readonly kind: "WHO"; readonly then: Waiting; readonly outcome: Outcome | null; readonly text: string }
    | { readonly kind: "DEBRIEF_WHAT"; readonly clientId: string; readonly outcome: Outcome | null }
    | null;
  readonly proposal: DebriefProposal | null;
  /** How many times the operator pushed to contact a held client this session. */
  readonly pushes: Readonly<Record<string, number>>;
  readonly turn: number;
}

export interface World {
  readonly state: DonnaState;
  readonly profiles: readonly ClientProfile[];
  readonly now: string;
  readonly names: NameIndex;
}

export interface Turn {
  readonly conversation: Conversation;
  readonly reply: Reply;
  /** A debrief the operator confirmed. The caller files it in memory; nothing leaves the device. */
  readonly file: DebriefProposal | null;
  /** A promise the operator says they kept. */
  readonly keep: { readonly clientId: string; readonly promiseId: string } | null;
}

export type Intent =
  | { readonly kind: "BRIEF" }
  | { readonly kind: "WHO_TO_CALL" }
  | { readonly kind: "HOLDS" }
  | { readonly kind: "PROMISES"; readonly clientId: string | null }
  | { readonly kind: "COLD" }
  | { readonly kind: "CLIENT"; readonly clientId: string }
  | { readonly kind: "BEFORE_CALL"; readonly clientId: string | null }
  | { readonly kind: "MESSAGE"; readonly clientId: string }
  | { readonly kind: "CLAIM"; readonly clientId: string | null }
  | { readonly kind: "DEBRIEF"; readonly clientId: string | null; readonly outcome: Outcome | null }
  | { readonly kind: "KEPT"; readonly clientId: string | null }
  | { readonly kind: "YES" }
  | { readonly kind: "NO" }
  | { readonly kind: "CANCEL" }
  | { readonly kind: "IDENTITY" }
  | { readonly kind: "THANKS" }
  | { readonly kind: "HELLO" }
  | { readonly kind: "HELP" }
  | { readonly kind: "UNKNOWN" };

// ── Vocabulary (normalised: folded letters, no diacritics) ─────────────────────────────────

const any = (norm: string, en: RegExp, ar: readonly string[]) => en.test(norm) || hasPhrase(norm, ar);

const YES_EN = /^(yes|yeah|yep|yup|sure|correct|right|file it|save it|do it|ok|okay|go ahead|confirm|perfect)\b/;
const YES_AR = ["ايوه", "ايوا", "اه", "تمام", "ماشي", "صح", "احفظي", "احفظ", "سجلي", "سجل", "اوكي", "اكيد", "مظبوط", "بالظبط"];
const NO_EN = /^(no|nope|discard|wrong|scrap (it|that)|not quite)\b/;
const NO_AR = ["لا", "لاء", "امسحي", "امسح", "غلط", "مش صح"];
const CANCEL_EN = /^(never ?mind|forget it|cancel|stop)\b/;
const CANCEL_AR = ["خلاص", "انسي", "سيبك", "الغي", "بلاش"];

const NO_ANSWER_EN = /\b(no answer|didn'?t (pick up|answer)|did not (pick up|answer)|voicemail|unreachable|phone (was )?off|no reply)\b/;
const NO_ANSWER_AR = ["مردش", "ما ردش", "ماردش", "مرديتش", "مفيش رد", "مقفول", "مغلق", "خارج التغطيه", "مبيردش"];
const SPOKE_EN = /\b(just (finished|got off|hung up|spoke|talked|met)|finished (with|a call|the call)|done with (the call|my call|\w+)|got off the phone|hung up with|spoke (to|with)|talked (to|with)|had (a|the) (call|meeting) with|met with|after (the|my) call)\b/;
const SPOKE_AR = ["خلصت مع", "خلصت مكالمه", "خلصت المكالمه", "لسه خالص", "لسه خلصت", "لسه قافل", "لسه قافله", "قفلت مع", "كلمت", "كلمته", "كلمتها", "كلمتهم", "اتكلمت", "اتكلمنا", "لسه مكلم", "قابلت", "قابلته", "قابلتها", "اتقابلنا"];
const TRIED_EN = /\b(i (called|rang|phoned|tried)|debrief)\b/;
const TRIED_AR = ["اتصلت", "رنيت", "رنيتله", "رنيتلها"];
const KEPT_EN = /\b(i('ve| have)? (sent|delivered|shared|forwarded|emailed)|already sent|kept (my|the) promise)\b/;
const KEPT_AR = ["بعتله", "بعتلها", "بعتلهم", "بعتت", "بعت", "سلمته", "سلمتها", "وريته", "وريتها", "اديته", "اديتها", "اديتله", "اديتلها", "ارسلت"];

const WHO_TO_CALL_EN =
  /\b(who (should|do|shall|must|can) i (call|ring|phone|contact|talk to|message|text|reach|chase|focus on)|who('s| is) (next|first)|who (comes )?first|call list|who to (call|contact)|who needs me|priorit\w*|where do i start)\b/;
const WHO_TO_CALL_AR = ["اكلم مين", "مين اكلم", "مين اكلمه", "اتصل بمين", "مين الاول", "ابدا بمين", "مين محتاجني", "مين اتابع", "اتابع مع مين", "ابعت لمين", "اولوياتي"];
const HOLDS_EN = /\b(leave (\w+ )?alone|hold off|avoid|off.limits|who (should i|do i) (not|avoid|leave)|not (to )?(call|contact|message))\b/;
const HOLDS_AR = ["مين ما اكلمش", "مين ماكلمش", "مين مكلمش", "مين اسيبه", "مين اسيبهم", "اسيب مين", "ابعد عن مين"];
const PREP_EN = /\b(prep me|prepare me|get me ready|before (i|my) (call|meeting)|about to (call|ring|phone|meet|see)|i'?m (calling|meeting|seeing)|going to (call|meet|see)|gonna (call|meet|see)|heading (to|into))\b/;
const PREP_AR = ["جهزيني", "حضريني", "قبل ما اكلم", "قبل المكالمه", "داخل اكلم", "رايح اكلم", "رايح اقابل", "داخل مكالمه", "هكلم", "هتصل", "هقابل"];
const CALL_EN = /\b(call|calling|ring|phone|meet|meeting|visit)\b/;
const CALL_AR = ["اكلم", "اكلمه", "اكلمها", "كلم", "اتصل", "ارن", "اقابل", "هكلمه", "هكلمها"];
const MESSAGE_EN = /\b(message|messaging|text|texting|whatsapp|send|sending|ping|write to|follow up|chase|chasing|remind)\b/;
const MESSAGE_AR = ["ابعت", "هبعت", "ابعتله", "ابعتلها", "هبعتله", "هبعتلها", "رساله", "رسايل", "واتس", "واتساب", "اكتبله", "اكتبلها", "اتابع", "هتابع", "افكره", "افكرها"];
const PROMISES_EN = /\b(promis\w*|owe|commitments?)\b/;
const PROMISES_AR = ["وعد", "وعدت", "وعده", "وعدته", "وعدتها", "وعدتهم", "وعودي", "وعود", "مديون", "مديونه", "عليا ايه", "التزاماتي"];
const COLD_EN = /\b(cold|cooling|slipping|drift\w*|losing|neglect\w*|forgotten|forgetting)\b/;
const COLD_AR = ["برد", "بارد", "باردين", "بيبرد", "هيبرد", "بردت", "بيضيع", "هيضيع", "ناسيه", "نسيته", "نسيتها", "مهمل"];
const IDENTITY_EN = /\b(who are you|what are you|your name|what can you do|what do you do)\b/;
const IDENTITY_AR = ["انتي مين", "انت مين", "مين انتي", "اسمك ايه", "بتعملي ايه", "تقدري تعملي ايه"];
const HELP_EN = /\b(help|what can i (ask|say)|how does this work)\b/;
const HELP_AR = ["ساعديني", "اسالك ايه", "اقول ايه", "ازاي استخدمك"];
const BRIEF_EN =
  /\b(brief|briefing|rundown|catch me up|what('?s| is) (up|new|today|my day|on|the plan)|what matters|good (morning|afternoon|evening)|morning|status|update me|where do we stand|today)\b/;
const BRIEF_AR = ["صباح", "مساء", "مسا", "ايه النظام", "ايه الاخبار", "ايه الدنيا", "لخصيلي", "لخصي", "فكريني", "ايه المهم", "عندي ايه", "الموقف", "الوضع", "النهارده"];
const THANKS_EN = /\b(thanks|thank you|cheers|appreciate it|good job|nice one)\b/;
const THANKS_AR = ["شكرا", "ميرسي", "متشكر", "متشكره", "تسلمي", "تسلم", "جدعه", "عاش"];
const HELLO_EN = /^(hi|hello|hey|yo|hiya)\b|\bhow are you\b/;
const HELLO_AR = ["اهلا", "ازيك", "سلام", "السلام عليكم", "هاي", "عامله ايه", "ايه اخبارك"];
const PRONOUN_EN = /\b(him|her|them|they|he|she)\b/;
const PRONOUN_AR = /(وعدته|وعدتها|وعدتهم|اكلمه|اكلمها|ابعتله|ابعتلها|هكلمه|هكلمها|هبعتله|هبعتلها|اقوله|اقولها|هقوله|هقولها|بعتله|بعتلها)/;
const CLAIM_VERB_EN = /\b(tell|telling|say|saying|quote|quoting|offer|offering|confirm)\b/;
const CLAIM_VERB_AR = ["هقول", "هقوله", "هقولها", "هقولهم", "اقول", "اقوله", "اقولها", "هبلغ", "هبلغه", "هبلغها", "هاكد", "هعرض", "اعرض", "ينفع اقول"];

/** Arabic whole-word alternation without lookbehind (older iPhones lack it): group 1 is the boundary. */
const arWords = (alternation: string) => new RegExp(`(^|[^\\u0621-\\u064A])(${alternation})(?=$|[^\\u0621-\\u064A])`);

function firstIndex(folded: string, en: RegExp, ar: RegExp): { start: number; end: number } | null {
  const e = en.exec(folded);
  const a = ar.exec(folded);
  const fromEn = e ? { start: e.index, end: e.index + e[0].length } : null;
  const fromAr = a ? { start: a.index + (a[1] ?? "").length, end: a.index + a[0].length } : null;
  if (fromEn && fromAr) return fromEn.start <= fromAr.start ? fromEn : fromAr;
  return fromEn ?? fromAr;
}

const TOPICS: ReadonlyArray<readonly [ToldTopic, RegExp, RegExp]> = [
  ["DOWN_PAYMENT", /\b(down ?payment|deposit)\b/, arWords("مقدم|المقدم|الداون|داون|الدفعه الاولي")],
  ["INSTALLMENT_YEARS", /\b(installments?|instalments?|payment plan|years to pay)\b/, arWords("تقسيط|التقسيط|قسط|اقساط|السداد|سداد")],
  ["DELIVERY", /\b(delivery|handover|hand over|ready (in|by))\b/, arWords("استلام|الاستلام|تسليم|التسليم|هتستلم|يستلم|تستلم")],
  ["PRICE", /\b(price|priced|cost|asking|total)\b/, arWords("سعر|السعر|سعرها|سعره|بكام|التمن|تمنها|تمنه")],
];

const UNIT_FOR: Readonly<Record<ToldTopic, ReadonlyArray<readonly [Quantity["unit"], ToldFact["unit"]]>>> = {
  PRICE: [["MONEY", "EGP"]],
  DOWN_PAYMENT: [["PERCENT", "PERCENT"], ["MONEY", "EGP"]],
  DELIVERY: [["YEAR", "YEAR"]],
  INSTALLMENT_YEARS: [["YEARS", "YEARS"]],
};

/** Prices, down payments, delivery years and installment years the text states. */
export function factsIn(folded: string, today: string): readonly ToldFact[] {
  const quantities = parseQuantities(folded);
  const used = new Set<Quantity>();
  const facts: ToldFact[] = [];
  for (const [topic, en, ar] of TOPICS) {
    const at = firstIndex(folded, en, ar);
    if (!at) continue;
    const fits = (q: Quantity) => !used.has(q) && UNIT_FOR[topic].some(([u]) => u === q.unit);
    const after = quantities.find((q) => fits(q) && q.start >= at.start && q.start - at.end <= 40);
    const before = [...quantities].reverse().find((q) => fits(q) && q.end <= at.start && at.start - q.end <= 25);
    const q = after ?? before;
    if (!q) continue;
    used.add(q);
    const unit = UNIT_FOR[topic].find(([u]) => u === q.unit)?.[1] ?? "EGP";
    facts.push({ topic, value: q.value, unit, on: today });
  }
  return facts;
}

const sameFact = (a: ToldFact, b: ToldFact) =>
  a.unit === b.unit && (a.unit === "EGP" ? Math.abs(a.value - b.value) <= Math.max(a.value, b.value) * 0.005 : a.value === b.value);

function lastTold(profile: ClientProfile, topic: ToldTopic, unit?: ToldFact["unit"]): ToldFact | null {
  const list = (profile.told ?? []).filter((f) => f.topic === topic && (!unit || f.unit === unit));
  return list[list.length - 1] ?? null;
}

// ── Understanding ──────────────────────────────────────────────────────────────────────────

export function understand(text: string, names: NameIndex, focus: string | null): Intent {
  const norm = normalizeText(text);
  if (!norm) return { kind: "UNKNOWN" };
  const words = tokenize(norm).map((t) => t.text);
  const first = words[0] ?? "";
  const named = findClient(text, names);
  const client = named ?? (PRONOUN_EN.test(norm) || PRONOUN_AR.test(norm) ? focus : null);
  const short = words.length <= 4;

  if (short && (YES_EN.test(norm) || YES_AR.includes(first))) return { kind: "YES" };
  if (short && (NO_EN.test(norm) || NO_AR.includes(first))) return { kind: "NO" };
  if (short && (CANCEL_EN.test(norm) || CANCEL_AR.includes(first))) return { kind: "CANCEL" };

  const isWho = /\bwho\b/.test(norm) || words.includes("مين");
  const noAnswer = any(norm, NO_ANSWER_EN, NO_ANSWER_AR);
  const spoke = any(norm, SPOKE_EN, SPOKE_AR);
  if (!isWho && (spoke || noAnswer || any(norm, TRIED_EN, TRIED_AR))) {
    return { kind: "DEBRIEF", clientId: client, outcome: noAnswer ? "NO_ANSWER" : spoke ? "SPOKE" : null };
  }
  if (any(norm, KEPT_EN, KEPT_AR)) return { kind: "KEPT", clientId: client ?? focus };

  const folded = foldText(text);
  const claimTopic = TOPICS.some(([, en, ar]) => en.test(folded) || ar.test(folded));
  if (claimTopic && factsIn(folded, "2000-01-01").length > 0 && (any(norm, CLAIM_VERB_EN, CLAIM_VERB_AR) || named)) {
    return { kind: "CLAIM", clientId: client ?? focus };
  }

  if (any(norm, WHO_TO_CALL_EN, WHO_TO_CALL_AR)) return { kind: "WHO_TO_CALL" };
  if (any(norm, HOLDS_EN, HOLDS_AR)) return { kind: "HOLDS" };
  const prep = any(norm, PREP_EN, PREP_AR);
  if (!isWho && (prep || any(norm, CALL_EN, CALL_AR))) {
    if (client) return { kind: "BEFORE_CALL", clientId: client };
    if (prep) return { kind: "BEFORE_CALL", clientId: null };
  }
  if (client && any(norm, MESSAGE_EN, MESSAGE_AR)) return { kind: "MESSAGE", clientId: client };
  if (any(norm, PROMISES_EN, PROMISES_AR)) return { kind: "PROMISES", clientId: client };
  if (any(norm, COLD_EN, COLD_AR)) return client ? { kind: "CLIENT", clientId: client } : { kind: "COLD" };
  if (named) return { kind: "CLIENT", clientId: named };
  if (any(norm, IDENTITY_EN, IDENTITY_AR)) return { kind: "IDENTITY" };
  if (any(norm, HELP_EN, HELP_AR)) return { kind: "HELP" };
  if (any(norm, BRIEF_EN, BRIEF_AR)) return { kind: "BRIEF" };
  if (any(norm, THANKS_EN, THANKS_AR)) return { kind: "THANKS" };
  if (any(norm, HELLO_EN, HELLO_AR)) return { kind: "HELLO" };
  return { kind: "UNKNOWN" };
}

// ── Reading a debrief ──────────────────────────────────────────────────────────────────────

const PROMISE_EN =
  /\b(i(?:'ll| will| shall)|i promised(?: to)?(?: (?:them|him|her))?|promised (?:them|him|her)|promised to|i(?:'m| am) (?:going to|gonna)|i need to|i have to|i owe (?:them|him|her))\s+/g;
const PROMISE_LEAD_AR = /^(?:و)?(وعدته|وعدتها|وعدتهم|وعدت)$/;
const PROMISE_VERB_AR = /^(?:و)?(هبعت|هجيب|هجهز|هشوف|هتاكد|هرد|هكلم|هعدي|هوري|هرتب|هحجز|هظبط|هسال|هبلغ|هتصل)/;
const DATE_EN = /\b(by |on |before |until )?(the )?(day after tomorrow|tomorrow|today|tonight|this evening|next week|in \w+ days?|sunday|monday|tuesday|wednesday|thursday|friday|saturday|\d{4}-\d{2}-\d{2})\b/;
const DATE_AR = new Set(["بكره", "بكرا", "النهارده", "انهارده", "الليله", "بالليل", "الاسبوع", "السبت", "الحد", "الاحد", "الاتنين", "الاثنين", "التلات", "الثلاثاء", "الاربع", "الاربعاء", "الخميس", "الجمعه", "يوم"]);
const CLAUSE_END = /[.;!?\n]|,\s|\s(and|but|also)\s/g;

interface PromiseSpan {
  readonly text: string;
  readonly due: string;
  readonly dueSaid: boolean;
  readonly start: number;
  readonly end: number;
}

function clauseEnd(folded: string, from: number): number {
  CLAUSE_END.lastIndex = from;
  const m = CLAUSE_END.exec(folded);
  return m ? m.index : folded.length;
}

const clean = (s: string) => s.trim().replace(/^[,،:\-–\s]+|[,،.:;!?\-–\s]+$/g, "");

function findPromises(original: string, folded: string, today: string): readonly PromiseSpan[] {
  const spans: PromiseSpan[] = [];
  for (const m of folded.matchAll(PROMISE_EN)) {
    const start = (m.index ?? 0) + m[0].length;
    const end = clauseEnd(folded, start);
    const clause = folded.slice(start, end);
    const date = DATE_EN.exec(clause);
    const text = clean(original.slice(start, date ? start + date.index : end));
    if (text.length < 3) continue;
    const said = parseDueDate(clause, today);
    spans.push({ text, due: said ?? today, dueSaid: said !== null, start: m.index ?? 0, end });
  }
  const tokens = tokenize(folded);
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] as (typeof tokens)[number];
    const lead = PROMISE_LEAD_AR.test(tok.text);
    if (!lead && !PROMISE_VERB_AR.test(tok.text)) continue;
    const startTok = lead ? tokens[i + 1] : tok;
    if (!startTok) continue;
    let j = lead ? i + 1 : i;
    let dateAt: number | null = null;
    const stop = Math.min(tokens.length, j + 9);
    for (; j < stop; j += 1) {
      const t = tokens[j] as (typeof tokens)[number];
      if (j > i && (PROMISE_LEAD_AR.test(t.text) || (j > (lead ? i + 1 : i) && PROMISE_VERB_AR.test(t.text)))) break;
      if (DATE_AR.has(t.text) || (t.text === "بعد" && DATE_AR.has(tokens[j + 1]?.text ?? ""))) {
        dateAt = j;
        break;
      }
      if (/[.;!?\n]/.test(folded.slice(t.end, tokens[j + 1]?.start ?? t.end))) {
        j += 1;
        break;
      }
    }
    const last = tokens[(dateAt ?? j) - 1];
    if (!last || last.end <= startTok.start) continue;
    const dateEnd = dateAt === null ? last.end : (tokens[Math.min(dateAt + 2, tokens.length - 1)] as (typeof tokens)[number]).end;
    const said = parseDueDate(folded.slice(startTok.start, dateEnd), today);
    const text = clean(original.slice(startTok.start, last.end));
    if (text.length >= 3) spans.push({ text, due: said ?? today, dueSaid: said !== null, start: tok.start, end: last.end });
    i = (dateAt ?? j) - 1;
  }
  return spans.sort((a, b) => a.start - b.start);
}

const AREA_EN = /\b(new cairo|fifth settlement|sheikh zayed|new zayed|zayed|6th of october|october|new capital|administrative capital|north coast|sahel|sokhna|maadi|madinaty|mostakbal city|shorouk|heliopolis)\b/;
const AREA_AR = arWords("التجمع الخامس|التجمع|القاهره الجديده|الشيخ زايد|زايد الجديده|زايد|6 اكتوبر|اكتوبر|العاصمه الاداريه|العاصمه|الساحل الشمالي|الساحل|السخنه|العين السخنه|المعادي|مدينتي|مستقبل سيتي|الشروق|مصر الجديده");
const UNIT_EN = /\b(apartment|flat|villa|townhouse|town house|twin ?house|duplex|penthouse|chalet|studio|loft|office|clinic|shop)\b/;
const UNIT_AR = arWords("شقه|فيلا|تاون هاوس|تاون|توين هاوس|دوبلكس|بنتهاوس|بنت هاوس|شاليه|ستوديو|مكتب|عياده|محل");
const BUDGET_EN = /\b(budget|afford|up to|maximum|ceiling|can spend|has around|range)\b/;
const BUDGET_AR = arWords("ميزانيه|ميزانيته|ميزانيتها|ميزانيتهم|الميزانيه|في حدود|لحد|معاه|معاها|اخره|اخرها|يقدر يدفع|تقدر تدفع");
const CASH_EN = /\b(cash|full payment)\b/;
const CASH_AR = arWords("كاش|نقدي|نقدا");
const INSTALLMENTS_EN = /\b(installments?|instalments?|monthly payments?)\b/;
const INSTALLMENTS_AR = arWords("تقسيط|بالتقسيط|قسط|اقساط");
const INVEST_EN = /\b(invest|investment|investor|rent (it )?out|rental income|resale|roi)\b/;
const INVEST_AR = arWords("استثمار|للاستثمار|يستثمر|تستثمر|ايجار|ياجر|ياجرها|ريسيل");
const HOME_EN = /\b(to live|live in|living in|family home|move in|moving in|primary home)\b/;
const HOME_AR = arWords("سكن|للسكن|يسكن|تسكن|هيسكن|هتسكن|يعيش|هيعيش|يستقر");

const PERSONAL_EN = /\b(son|daughter|wife|husband|kids?|children|mother|father|mom|dad|wedding|engaged|baby|school|university|birthday|hospital|sick|travel\w*|moving abroad)\b/;
const PERSONAL_AR = arWords("ابنه|ابنها|ابنهم|بنته|بنتها|مراته|جوزها|ولاده|اولاده|عياله|عيلته|مامته|والدته|والده|باباه|فرح|فرحه|جواز|خطوبه|مولود|حامل|مدرسه|المدرسه|جامعه|الجامعه|مسافر|مسافره|هيسافر|هتسافر|ميلاده|عيان|عيانه|تعبان|تعبانه|مستشفي|المستشفي|عمليه");
const NOT_INTERESTED_EN = /\b(not interested|no longer interested|lost interest|bought (elsewhere|somewhere else|already|from someone else)|went with (another|someone else|a competitor))\b/;
const NOT_INTERESTED_AR = ["مش مهتم", "مش مهتمه", "مبقاش مهتم", "اشتري خلاص", "اشترت خلاص", "اشتري من حد تاني", "صرف نظر"];
const BLOCKER_EN = /\b(sick|ill|unwell|in (the )?hospital|surgery|funeral|passed away|family emergency|bad time|work (problems|issues|crisis))\b/;
const BLOCKER_AR = ["عيان", "عيانه", "تعبان", "تعبانه", "مستشفي", "المستشفي", "عمليه", "عزا", "اتوفي", "توفي", "ظروف", "مشاكل شغل", "مشاكل في الشغل"];
const SPACE_EN =
  /\b(give (him|her|them|me) (some )?(space|time)|asked (for|me for) (some )?(space|time)|needs? (some )?time|not now|(call|contact) (me|him|her|them) (next|in a) (week|month)|will get back to me|busy (this|for the) (week|month))\b/;
const SPACE_AR = ["سيبني", "سيبوني", "اديني وقت", "ادوني وقت", "محتاج وقت", "محتاجه وقت", "مش دلوقتي", "هيكلمني هو", "هتكلمني هي", "هيرجعلي", "هترجعلي", "مشغول الفتره دي", "مشغوله الفتره دي"];

function sliceAt(original: string, folded: string, en: RegExp, ar: RegExp): string | null {
  const at = firstIndex(folded, en, ar);
  return at ? original.slice(at.start, at.end) : null;
}

function readWants(original: string, masked: string): ClientWants {
  const wants: { -readonly [K in keyof ClientWants]: ClientWants[K] } = {};
  const quantities = parseQuantities(masked);
  const budgetAt = firstIndex(masked, BUDGET_EN, BUDGET_AR);
  if (budgetAt) {
    const money = quantities.find((q) => q.unit === "MONEY" && q.start >= budgetAt.start && q.start - budgetAt.end <= 30);
    if (money) wants.budget = formatMoney(money.value);
  }
  const area = sliceAt(original, masked, AREA_EN, AREA_AR);
  if (area) wants.area = area;
  const unitAt = firstIndex(masked, UNIT_EN, UNIT_AR);
  if (unitAt) {
    const rooms = quantities.find((q) => q.unit === "BEDROOMS" && Math.abs(q.start - unitAt.start) <= 24);
    const parts = [rooms ? { s: rooms.start, e: rooms.end } : null, { s: unitAt.start, e: unitAt.end }]
      .filter((x): x is { s: number; e: number } => x !== null)
      .sort((a, b) => a.s - b.s);
    wants.unit = parts.map((p) => original.slice(p.s, p.e)).join(" ");
  }
  const cash = firstIndex(masked, CASH_EN, CASH_AR);
  const inst = firstIndex(masked, INSTALLMENTS_EN, INSTALLMENTS_AR);
  if (cash || inst) wants.payment = cash && (!inst || cash.start < inst.start) ? "CASH" : "INSTALLMENTS";
  const invest = firstIndex(masked, INVEST_EN, INVEST_AR);
  const home = firstIndex(masked, HOME_EN, HOME_AR);
  if (invest || home) wants.purpose = invest && (!home || invest.start < home.start) ? "INVESTMENT" : "HOME";
  return wants;
}

function readPersonal(original: string, folded: string): string | null {
  const at = firstIndex(folded, PERSONAL_EN, PERSONAL_AR);
  if (!at) return null;
  const boundary = /[.;!?\n]/g;
  let start = 0;
  for (const m of folded.slice(0, at.start).matchAll(boundary)) start = (m.index ?? 0) + 1;
  boundary.lastIndex = at.end;
  const endMatch = boundary.exec(folded);
  let end = endMatch ? endMatch.index : folded.length;
  // No punctuation (typical of dictation): keep a short window around the marker.
  const tokens = tokenize(folded).filter((t) => t.start >= start && t.end <= end);
  const idx = tokens.findIndex((t) => t.start >= at.start);
  if (tokens.length > 12 && idx >= 0) {
    start = tokens[Math.max(0, idx - 3)]?.start ?? start;
    end = tokens[Math.min(tokens.length - 1, idx + 6)]?.end ?? end;
  }
  const text = clean(original.slice(start, end));
  return text.length >= 3 ? text : null;
}

function readHold(norm: string): HoldHeard | null {
  if (any(norm, NOT_INTERESTED_EN, NOT_INTERESTED_AR)) return "NOT_INTERESTED";
  if (any(norm, BLOCKER_EN, BLOCKER_AR)) return "PERSONAL_BLOCKER";
  if (any(norm, SPACE_EN, SPACE_AR) || hasRestraintLanguage(norm)) return "ASKED_FOR_SPACE";
  return null;
}

/** The open promise the operator's words point at: most shared words, then the oldest. */
function matchPromise(profile: ClientProfile, text: string): ClientPromise | null {
  const open = profile.promises.filter((p) => !p.done).slice().sort((a, b) => a.due.localeCompare(b.due));
  if (!open.length) return null;
  const said = new Set(tokenize(normalizeText(text)).map((t) => t.text).filter((w) => w.length >= 3));
  let best = open[0] as ClientPromise;
  let bestScore = -1;
  for (const p of open) {
    const score = tokenize(normalizeText(p.text)).filter((t) => said.has(t.text)).length;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

const profileOf = (world: World, clientId: string) => world.profiles.find((p) => p.clientId === clientId) ?? null;
const offsetOf = (world: World) => world.state.policy.utcOffsetMinutes;
const todayOf = (world: World) => localParts(world.now, offsetOf(world)).date;

/** Reads a spoken or typed debrief into a reviewable proposal. Nothing is filed until the operator confirms. */
export function readDebrief(text: string, clientId: string, world: World, outcome: Outcome | null): DebriefProposal {
  const today = todayOf(world);
  const profile = profileOf(world, clientId);
  const folded = foldText(text);
  const norm = normalizeText(text);
  const items: HeardItem[] = [];

  const said: Outcome | null = any(norm, NO_ANSWER_EN, NO_ANSWER_AR) ? "NO_ANSWER" : outcome ?? (any(norm, SPOKE_EN, SPOKE_AR) ? "SPOKE" : null);
  if (said) items.push({ kind: "OUTCOME", outcome: said });

  const promises = findPromises(text, folded, today);
  let masked = folded;
  for (const p of promises) masked = masked.slice(0, p.start) + " ".repeat(p.end - p.start) + masked.slice(p.end);

  if (profile && any(norm, KEPT_EN, KEPT_AR)) {
    const kept = matchPromise(profile, text);
    if (kept) items.push({ kind: "KEPT", promiseId: kept.id, text: kept.text });
  }
  for (const p of promises) items.push({ kind: "PROMISE", text: p.text, due: p.due, dueSaid: p.dueSaid });

  const wants = readWants(text, masked);
  if (Object.keys(wants).length) items.push({ kind: "WANTS", wants });

  const facts = factsIn(masked, today);
  for (const fact of facts) items.push({ kind: "TOLD", fact });

  const personal = readPersonal(text, folded);
  if (personal) items.push({ kind: "PERSONAL", text: personal });

  const hold = readHold(norm);
  if (hold) items.push({ kind: "HOLD", reason: hold });

  const conflicts = profile
    ? facts.flatMap((now) => {
        const before = lastTold(profile, now.topic, now.unit);
        return before && !sameFact(before, now) ? [{ before, now }] : [];
      })
    : [];
  return { clientId, originalInput: text, items, conflicts, proposalOnly: true, externalSideEffect: false };
}

/** Files a confirmed debrief into Donna's memory (a new, frozen-by-convention profile list). */
export function fileProposal(profiles: readonly ClientProfile[], proposal: DebriefProposal, now: string): readonly ClientProfile[] {
  return profiles.map((p) => {
    if (p.clientId !== proposal.clientId) return p;
    let wants: ClientWants = p.wants;
    let promises = p.promises;
    let told = p.told ?? [];
    let personal = p.personal;
    let askedForSpace = p.askedForSpace;
    let hot = p.hot;
    let lastContactAt = p.lastContactAt;
    let unansweredMessages = p.unansweredMessages;
    let spoke = false;
    for (const item of proposal.items) {
      switch (item.kind) {
        case "OUTCOME":
          if (item.outcome === "SPOKE") {
            spoke = true;
            lastContactAt = now;
            unansweredMessages = 0;
          }
          break;
        case "WANTS":
          wants = { ...wants, ...item.wants };
          break;
        case "PROMISE":
          promises = [...promises, { id: `p-${p.clientId}-${promises.length + 1}`, text: item.text, due: item.due, done: false }];
          break;
        case "KEPT":
          promises = promises.map((x) => (x.id === item.promiseId ? { ...x, done: true } : x));
          break;
        case "TOLD":
          told = [...told, item.fact];
          break;
        case "PERSONAL":
          personal = personal ? `${personal} · ${item.text}` : item.text;
          break;
        case "HOLD":
          askedForSpace = true;
          if (item.reason === "NOT_INTERESTED") hot = false;
          break;
      }
    }
    const turn = spoke ? (promises.some((x) => !x.done) ? "ME" : "CLIENT") : p.turn;
    return { ...p, wants, promises, told, personal, askedForSpace, hot, lastContactAt, unansweredMessages, turn };
  });
}

export function keepPromise(profiles: readonly ClientProfile[], clientId: string, promiseId: string): readonly ClientProfile[] {
  return profiles.map((p) => (p.clientId === clientId ? { ...p, promises: p.promises.map((x) => (x.id === promiseId ? { ...x, done: true } : x)) } : p));
}

// ── Answers ────────────────────────────────────────────────────────────────────────────────

export function dayPart(now: string, utcOffsetMinutes: number): DayPart {
  const { hour } = localParts(now, utcOffsetMinutes);
  return hour < 12 ? "MORNING" : hour < 17 ? "AFTERNOON" : "EVENING";
}

/** Who deserves the operator's next call, and who must be left alone. Held clients are never picked. */
export function pickCalls(world: World): { readonly picks: readonly CallPick[]; readonly held: readonly string[] } {
  const offset = offsetOf(world);
  const today = todayOf(world);
  const book = readBook(world.profiles, world.now, offset);
  const planned = new Map<string, string>();
  for (const call of buildInbox(world.state, world.now).upcoming) {
    if (localParts(call.dueAt, offset).date === today && !planned.has(call.clientId)) planned.set(call.clientId, call.dueAt);
  }
  const scored: Array<{ clientId: string; score: number; reasons: CallReason[] }> = [];
  for (const entry of book) {
    const p = profileOf(world, entry.clientId);
    if (!p || entry.heat === "HELD") continue;
    const open = p.promises.filter((x) => !x.done);
    const late = open.filter((x) => x.due < today).map((x) => daysBetween(x.due, today));
    const weighted: Array<[number, CallReason]> = [];
    if (late.length) weighted.push([100 + Math.max(...late), { kind: "OWED_LATE", days: Math.max(...late) }]);
    if (entry.heat === "COOLING" && p.turn === "ME" && entry.days !== null) weighted.push([80 + entry.days, { kind: "QUIET", days: entry.days }]);
    const at = planned.get(entry.clientId);
    if (at) weighted.push([60, { kind: "PLANNED", at }]);
    if (open.some((x) => x.due === today)) weighted.push([50, { kind: "OWED_TODAY" }]);
    if (!weighted.length && entry.heat === "HOT" && p.turn === "ME") weighted.push([30, { kind: "YOUR_MOVE" }]);
    if (!weighted.length) continue;
    weighted.sort((a, b) => b[0] - a[0]);
    scored.push({ clientId: entry.clientId, score: weighted.reduce((s, [w]) => s + w, 0), reasons: weighted.slice(0, 2).map(([, r]) => r) });
  }
  scored.sort((a, b) => b.score - a.score || a.clientId.localeCompare(b.clientId));
  return {
    picks: scored.slice(0, 3).map(({ clientId, reasons }) => ({ clientId, reasons })),
    held: book.filter((e) => e.heat === "HELD").map((e) => e.clientId),
  };
}

/** What Donna says when the operator picks up: the brief, restraint first, kept short for the ear. */
export function opening(world: World): Reply {
  const brief = buildMorningBrief(world.state, world.profiles, world.now);
  const top = brief.lines.slice(0, 3);
  const first = pickCalls(world).picks[0];
  const says: Say[] = [{ kind: "OPEN", part: dayPart(world.now, offsetOf(world)), count: brief.lines.length }, ...top.map((line): Say => ({ kind: "LINE", line }))];
  if (brief.lines.length > top.length) says.push({ kind: "MORE", count: brief.lines.length - top.length });
  if (first) says.push({ kind: "START_WITH", clientId: first.clientId });
  const mood: Mood = top.some((l) => l.kind === "HOLD_OFF" || l.kind === "PROMISE_OVERDUE") ? "WARN" : "CALM";
  return { mood, says, card: { kind: "BRIEF" } };
}

/** The operator let the call ring out. She still leaves one line. */
export function declined(world: World): Reply {
  return { mood: "CALM", says: [{ kind: "DECLINED", clientId: pickCalls(world).picks[0]?.clientId ?? null }], card: { kind: "BRIEF" } };
}

function whoToCall(world: World): Reply {
  const { picks, held } = pickCalls(world);
  const says: Say[] = [];
  if (held.length) says.push({ kind: "NOT_THEM", clientIds: held });
  says.push(picks.length ? { kind: "CALL_ORDER", picks } : { kind: "NOBODY_TO_CALL" });
  const urgent = picks.some((p) => p.reasons.some((r) => r.kind === "OWED_LATE" || r.kind === "QUIET"));
  return { mood: urgent ? "WARN" : "CALM", says, card: picks[0] ? { kind: "DOSSIER", clientId: picks[0].clientId } : null };
}

function holds(world: World): Reply {
  const lines = buildMorningBrief(world.state, world.profiles, world.now).lines.filter((l) => l.kind === "HOLD_OFF");
  return lines.length
    ? { mood: "WARN", says: lines.map((line): Say => ({ kind: "LINE", line })), card: null }
    : { mood: "CALM", says: [{ kind: "NO_HOLDS" }], card: null };
}

function promisesReply(world: World, clientId: string | null): Reply {
  const today = todayOf(world);
  const owed = world.profiles
    .filter((p) => !clientId || p.clientId === clientId)
    .flatMap((p) => p.promises.filter((x) => !x.done).map((x) => ({ clientId: p.clientId, text: x.text, late: daysBetween(x.due, today) })))
    .sort((a, b) => b.late - a.late);
  if (clientId && !owed.length) return { mood: "CALM", says: [{ kind: "OWE_NONE", clientId }], card: { kind: "DOSSIER", clientId } };
  const says: Say[] = clientId ? [] : [{ kind: "OWE_COUNT", count: owed.length }];
  for (const o of owed.slice(0, 5)) says.push({ kind: "OWE", ...o });
  return { mood: owed.some((o) => o.late > 0) ? "WARN" : "CALM", says, card: clientId ? { kind: "DOSSIER", clientId } : null };
}

function cold(world: World): Reply {
  const lines = buildMorningBrief(world.state, world.profiles, world.now).lines.filter((l) => l.kind === "GOING_COLD");
  return lines.length
    ? { mood: "WARN", says: lines.map((line): Say => ({ kind: "LINE", line })), card: { kind: "DOSSIER", clientId: (lines[0] as BriefLine).clientId } }
    : { mood: "CALM", says: [{ kind: "NONE_COLD" }], card: null };
}

const GAP_FIELDS = ["budget", "purpose", "area"] as const;

function latestTold(profile: ClientProfile): readonly ToldFact[] {
  const byTopic = new Map<ToldTopic, ToldFact>();
  for (const f of profile.told ?? []) byTopic.set(f.topic, f);
  return [...byTopic.values()];
}

function dossier(world: World, clientId: string): Reply {
  const p = profileOf(world, clientId);
  const entry = readBook(world.profiles, world.now, offsetOf(world)).find((e) => e.clientId === clientId);
  if (!p || !entry) return { mood: "CALM", says: [{ kind: "UNKNOWN" }], card: null };
  const today = todayOf(world);
  const says: Say[] = [{ kind: "HEAT", clientId, heat: entry.heat, days: entry.days }];
  if (entry.hold) says.push({ kind: "LINE", line: { kind: "HOLD_OFF", clientId, reason: entry.hold, count: p.unansweredMessages } });
  if (Object.keys(p.wants).length) says.push({ kind: "WANTS", wants: p.wants });
  if (p.personal) says.push({ kind: "PERSONAL", text: p.personal });
  for (const x of p.promises.filter((x) => !x.done)) says.push({ kind: "OWE", clientId, text: x.text, late: daysBetween(x.due, today) });
  const told = latestTold(p);
  if (told.length) says.push({ kind: "TOLD", facts: told });
  if (!entry.hold) {
    const gap = GAP_FIELDS.find((f) => p.wants[f] === undefined);
    if (gap) says.push({ kind: "GAP", field: gap });
    says.push({ kind: "TURN", turn: p.turn });
  }
  const warn = entry.hold !== null || entry.overdue > 0 || entry.heat === "COOLING";
  return { mood: warn ? "WARN" : "CALM", says, card: { kind: "DOSSIER", clientId } };
}

function plannedToday(world: World, clientId: string): string | null {
  const offset = offsetOf(world);
  const today = todayOf(world);
  const inbox = buildInbox(world.state, world.now);
  const calls = [...inbox.upcoming, ...inbox.unresolved.map((q) => ({ clientId: q.clientId, dueAt: q.dueAt }))];
  return calls.find((c) => c.clientId === clientId && localParts(c.dueAt, offset).date === today)?.dueAt ?? null;
}

function pushback(conv: Conversation, clientId: string): { pushes: Readonly<Record<string, number>>; extra: Say[] } {
  const n = (conv.pushes[clientId] ?? 0) + 1;
  return { pushes: { ...conv.pushes, [clientId]: n }, extra: n >= 3 ? [{ kind: "PUSHBACK", level: 2 }] : n === 2 ? [{ kind: "PUSHBACK", level: 1 }] : [] };
}

function beforeCall(world: World, conv: Conversation, clientId: string): { reply: Reply; pushes: Readonly<Record<string, number>> } {
  const p = profileOf(world, clientId);
  if (!p) return { reply: { mood: "CALM", says: [{ kind: "WHO" }], card: null }, pushes: conv.pushes };
  const hold = holdReason(p);
  if (hold) {
    const { pushes, extra } = pushback(conv, clientId);
    const planned = plannedToday(world, clientId) !== null;
    return {
      reply: { mood: "STOP", says: [{ kind: "STOP_CALL", clientId, reason: hold, count: p.unansweredMessages, planned }, ...extra], card: { kind: "DOSSIER", clientId } },
      pushes,
    };
  }
  const today = todayOf(world);
  const open = p.promises.filter((x) => !x.done).slice().sort((a, b) => a.due.localeCompare(b.due));
  const says: Say[] = [{ kind: "PREP", clientId, at: plannedToday(world, clientId) }];
  if (open[0]) says.push({ kind: "DELIVER_FIRST", text: open[0].text });
  if (Object.keys(p.wants).length) says.push({ kind: "WANTS", wants: p.wants });
  if (p.personal) says.push({ kind: "PERSONAL", text: p.personal });
  const told = latestTold(p);
  if (told.length) says.push({ kind: "TOLD", facts: told });
  const gap = GAP_FIELDS.find((f) => p.wants[f] === undefined);
  if (gap) says.push({ kind: "ASK_ONCE", field: gap });
  const late = open.some((x) => x.due < today);
  return { reply: { mood: late ? "WARN" : "CALM", says, card: { kind: "DOSSIER", clientId } }, pushes: conv.pushes };
}

function message(world: World, conv: Conversation, clientId: string): { reply: Reply; pushes: Readonly<Record<string, number>> } {
  const p = profileOf(world, clientId);
  if (!p) return { reply: { mood: "CALM", says: [{ kind: "WHO" }], card: null }, pushes: conv.pushes };
  const hold = holdReason(p);
  if (hold) {
    const { pushes, extra } = pushback(conv, clientId);
    return { reply: { mood: "STOP", says: [{ kind: "STOP_MESSAGE", clientId, reason: hold, count: p.unansweredMessages }, ...extra], card: { kind: "DOSSIER", clientId } }, pushes };
  }
  const open = p.promises.filter((x) => !x.done).slice().sort((a, b) => a.due.localeCompare(b.due));
  return open[0]
    ? { reply: { mood: "WARN", says: [{ kind: "ONLY_THE_PROMISE", text: open[0].text }], card: { kind: "DOSSIER", clientId } }, pushes: conv.pushes }
    : { reply: { mood: "CALM", says: [{ kind: "MESSAGE_OK" }], card: { kind: "DOSSIER", clientId } }, pushes: conv.pushes };
}

function claim(world: World, clientId: string, text: string): Reply {
  const p = profileOf(world, clientId);
  const fact = factsIn(foldText(text), todayOf(world))[0];
  if (!p || !fact) return dossier(world, clientId);
  const says: Say[] = [];
  const hold = holdReason(p);
  if (hold) says.push({ kind: "LINE", line: { kind: "HOLD_OFF", clientId, reason: hold, count: p.unansweredMessages } });
  const before = lastTold(p, fact.topic, fact.unit);
  if (!before) return { mood: hold ? "STOP" : "CALM", says: [...says, { kind: "CLAIM_NEW", topic: fact.topic }], card: { kind: "DOSSIER", clientId } };
  if (sameFact(before, fact)) return { mood: hold ? "STOP" : "PLEASED", says: [...says, { kind: "CLAIM_MATCH", before }], card: { kind: "DOSSIER", clientId } };
  return { mood: "STOP", says: [...says, { kind: "CLAIM_CONFLICT", clientId, before, now: fact }], card: { kind: "DOSSIER", clientId } };
}

function proposalReply(proposal: DebriefProposal): Reply {
  const says: Say[] = [];
  for (const c of proposal.conflicts) says.push({ kind: "CLAIM_CONFLICT", clientId: proposal.clientId, before: c.before, now: c.now });
  const substantive = proposal.items.filter((i) => i.kind !== "OUTCOME");
  const hold = proposal.items.find((i): i is Extract<HeardItem, { kind: "HOLD" }> => i.kind === "HOLD");
  const noAnswer = proposal.items.some((i) => i.kind === "OUTCOME" && i.outcome === "NO_ANSWER");
  if (!substantive.length && !noAnswer) return { mood: "CALM", says: [{ kind: "HEARD_NOTHING" }], card: null };
  says.push({ kind: "HEARD", clientId: proposal.clientId });
  if (hold) says.push({ kind: hold.reason === "NOT_INTERESTED" ? "DID_YOUR_PART" : hold.reason === "PERSONAL_BLOCKER" ? "SUPPORT_FIRST" : "SPACE_KEPT" });
  else if (noAnswer) says.push({ kind: "NO_RETRY" });
  says.push({ kind: "CONFIRM" });
  const mood: Mood = proposal.conflicts.length ? "STOP" : hold || noAnswer ? "WARN" : "CALM";
  return { mood, says, card: { kind: "PROPOSAL" } };
}

function filedReply(proposal: DebriefProposal): Reply {
  const promise = proposal.items.find((i): i is Extract<HeardItem, { kind: "PROMISE" }> => i.kind === "PROMISE");
  return { mood: "PLEASED", says: [{ kind: "FILED", clientId: proposal.clientId, promise: promise ? { text: promise.text, due: promise.due } : null }], card: { kind: "DOSSIER", clientId: proposal.clientId } };
}

const STRONG = new Set<Intent["kind"]>(["BRIEF", "WHO_TO_CALL", "HOLDS", "COLD", "IDENTITY", "HELP", "PROMISES", "BEFORE_CALL", "CLAIM", "MESSAGE"]);

function social(intent: Intent, turn: number): Reply | null {
  switch (intent.kind) {
    case "IDENTITY":
      return { mood: "CALM", says: [{ kind: "IDENTITY" }], card: null };
    case "THANKS":
      return { mood: "PLEASED", says: [{ kind: "THANKS", variant: turn % 3 }], card: null };
    case "HELLO":
      return { mood: "CALM", says: [{ kind: "HELLO" }], card: null };
    case "HELP":
      return { mood: "CALM", says: [{ kind: "HELP" }], card: null };
    default:
      return null;
  }
}

export function startConversation(): Conversation {
  return { focus: null, pending: null, proposal: null, pushes: {}, turn: 0 };
}

const say = (conversation: Conversation, reply: Reply, extra: Partial<Pick<Turn, "file" | "keep">> = {}): Turn => ({
  conversation,
  reply,
  file: extra.file ?? null,
  keep: extra.keep ?? null,
});

/** One turn of the conversation. Pure: the same words against the same memory give the same answer. */
export function converse(conv: Conversation, text: string, world: World): Turn {
  const c: Conversation = { ...conv, turn: conv.turn + 1 };
  const intent = understand(text, world.names, conv.focus);

  if (conv.proposal) {
    const proposal = conv.proposal;
    if (intent.kind === "YES") return say({ ...c, proposal: null, pending: null, focus: proposal.clientId }, filedReply(proposal), { file: proposal });
    if (intent.kind === "NO" || intent.kind === "CANCEL") return say({ ...c, proposal: null, pending: null }, { mood: "CALM", says: [{ kind: "DISCARDED" }], card: null });
    const named = findClient(text, world.names);
    if (named === null || named === proposal.clientId) {
      const merged = readDebrief(`${proposal.originalInput} ${text}`, proposal.clientId, world, null);
      if (merged.items.length > proposal.items.length) return say({ ...c, proposal: merged }, proposalReply(merged));
    }
  }

  const pending = conv.pending;
  if (pending?.kind === "DEBRIEF_WHAT") {
    if (intent.kind === "CANCEL" || intent.kind === "NO") return say({ ...c, pending: null }, { mood: "CALM", says: [{ kind: "OK" }], card: null });
    const proposal = readDebrief(text, pending.clientId, world, pending.outcome);
    const reply = proposalReply(proposal);
    if (reply.says[0]?.kind !== "HEARD_NOTHING" || !STRONG.has(intent.kind)) {
      return say({ ...c, pending: reply.card ? null : pending, proposal: reply.card ? proposal : conv.proposal, focus: pending.clientId }, reply);
    }
  }
  if (pending?.kind === "WHO") {
    if (intent.kind === "CANCEL" || intent.kind === "NO") return say({ ...c, pending: null }, { mood: "CALM", says: [{ kind: "OK" }], card: null });
    const who = findClient(text, world.names);
    if (who) return dispatch({ ...c, pending: null, focus: who }, resume(pending, who), `${pending.text} ${text}`, world);
    if (!STRONG.has(intent.kind)) return say(c, { mood: "CALM", says: [{ kind: "WHO" }], card: null });
  }
  return dispatch({ ...c, pending: null }, intent, text, world);
}

function resume(pending: { then: Waiting; outcome: Outcome | null }, clientId: string): Intent {
  switch (pending.then) {
    case "BEFORE_CALL":
      return { kind: "BEFORE_CALL", clientId };
    case "DEBRIEF":
      return { kind: "DEBRIEF", clientId, outcome: pending.outcome };
    case "CLAIM":
      return { kind: "CLAIM", clientId };
    case "KEPT":
      return { kind: "KEPT", clientId };
  }
}

function dispatch(c: Conversation, intent: Intent, text: string, world: World): Turn {
  const ask = (then: Waiting, outcome: Outcome | null = null) =>
    say({ ...c, pending: { kind: "WHO", then, outcome, text } }, { mood: "CALM", says: [{ kind: "WHO" }], card: null });
  switch (intent.kind) {
    case "BRIEF":
      return say(c, opening(world));
    case "WHO_TO_CALL": {
      const reply = whoToCall(world);
      return say({ ...c, focus: reply.card?.kind === "DOSSIER" ? reply.card.clientId : c.focus }, reply);
    }
    case "HOLDS":
      return say(c, holds(world));
    case "PROMISES":
      return say({ ...c, focus: intent.clientId ?? c.focus }, promisesReply(world, intent.clientId));
    case "COLD":
      return say(c, cold(world));
    case "CLIENT":
      return say({ ...c, focus: intent.clientId }, dossier(world, intent.clientId));
    case "BEFORE_CALL": {
      if (!intent.clientId) return ask("BEFORE_CALL");
      const { reply, pushes } = beforeCall(world, c, intent.clientId);
      return say({ ...c, focus: intent.clientId, pushes }, reply);
    }
    case "MESSAGE": {
      const { reply, pushes } = message(world, c, intent.clientId);
      return say({ ...c, focus: intent.clientId, pushes }, reply);
    }
    case "CLAIM":
      return intent.clientId ? say({ ...c, focus: intent.clientId }, claim(world, intent.clientId, text)) : ask("CLAIM");
    case "DEBRIEF": {
      if (!intent.clientId) return ask("DEBRIEF", intent.outcome);
      const proposal = readDebrief(text, intent.clientId, world, intent.outcome);
      const reply = proposalReply(proposal);
      if (reply.card) return say({ ...c, focus: intent.clientId, proposal }, reply);
      return say(
        { ...c, focus: intent.clientId, pending: { kind: "DEBRIEF_WHAT", clientId: intent.clientId, outcome: intent.outcome } },
        { mood: "CALM", says: [{ kind: "DEBRIEF_GO", clientId: intent.clientId }], card: { kind: "DOSSIER", clientId: intent.clientId } },
      );
    }
    case "KEPT": {
      if (!intent.clientId) return ask("KEPT");
      const p = profileOf(world, intent.clientId);
      const kept = p ? matchPromise(p, text) : null;
      if (!kept) return say({ ...c, focus: intent.clientId }, { mood: "CALM", says: [{ kind: "OWE_NONE", clientId: intent.clientId }], card: null });
      return say(
        { ...c, focus: intent.clientId },
        { mood: "PLEASED", says: [{ kind: "KEPT", clientId: intent.clientId, text: kept.text }], card: { kind: "DOSSIER", clientId: intent.clientId } },
        { keep: { clientId: intent.clientId, promiseId: kept.id } },
      );
    }
    case "YES":
    case "NO":
      return say(c, { mood: "CALM", says: [{ kind: "NOTHING_PENDING" }], card: null });
    case "CANCEL":
      return say(c, { mood: "CALM", says: [{ kind: "OK" }], card: null });
    default:
      return say(c, social(intent, c.turn) ?? { mood: "CALM", says: [{ kind: "UNKNOWN" }], card: null });
  }
}
