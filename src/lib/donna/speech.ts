import type { DonnaClient } from "./types";

/**
 * Donna's ears (pure and deterministic). Reads what the operator said or typed, in English or
 * Egyptian Arabic, as a speech engine or a keyboard produced it: comparable text, client
 * references, amounts and dates. Nothing here listens, records or stores anything.
 */

const LETTER_FOLD: Readonly<Record<string, string>> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ى": "ي",
  "ة": "ه",
  "ؤ": "و",
  "ئ": "ي",
  "٫": ".",
  "٬": ",",
  "،": ",",
  "؟": "?",
};

/**
 * Same-length fold: lowercase, one spelling per Arabic letter family, Western digits.
 * Every index in the result points at the same character in the input, so a match found in
 * the folded text can be cut verbatim out of the operator's own words.
 */
export function foldText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    const code = ch.charCodeAt(0);
    if (code >= 0x660 && code <= 0x669) out += String(code - 0x660);
    else if (code >= 0x6f0 && code <= 0x6f9) out += String(code - 0x6f0);
    else if (LETTER_FOLD[ch] !== undefined) out += LETTER_FOLD[ch];
    else if (ch >= "A" && ch <= "Z") out += ch.toLowerCase();
    else out += ch;
  }
  return out;
}

const MARKS = /[ً-ٰٟـ⁦-⁩‎‏]/g;

/** Folded, without Arabic diacritics or direction marks, single-spaced. For matching only. */
export function normalizeText(text: string): string {
  return foldText(text.replace(MARKS, "")).replace(/\s+/g, " ").trim();
}

export interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

const TOKEN = /\d+(?:[.,]\d+)*%?|[a-z]+(?:['’][a-z]+)?|[ء-ي]+|%/g;

/** Tokens of an already folded string, with positions in it. */
export function tokenize(folded: string): readonly Token[] {
  return [...folded.matchAll(TOKEN)].map((m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** True when any of the phrases appears as whole words in the normalised text. */
export function hasPhrase(normalized: string, phrases: readonly string[]): boolean {
  const padded = ` ${tokenize(normalized).map((t) => t.text).join(" ")} `;
  return phrases.some((p) => padded.includes(` ${p} `));
}

// ── Client names ───────────────────────────────────────────────────────────────────────────

export interface ClientKeys {
  readonly clientId: string;
  readonly keys: readonly string[];
}
export type NameIndex = readonly ClientKeys[];

/** Spellings a speech engine produces for the synthetic demo names. */
const DEMO_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "cl-alpha": ["alpha", "alfa", "الفا", "الفه"],
  "cl-beta": ["beta", "bita", "بيتا", "بيطا"],
  "cl-gamma": ["gamma", "gama", "جاما", "غاما", "جامه"],
  "cl-delta": ["delta", "دلتا", "دلطا"],
  "cl-epsilon": ["epsilon", "ابسيلون", "ابسلون", "ايبسلون", "ابسيلن"],
};

export function buildNameIndex(clients: readonly DonnaClient[]): NameIndex {
  const lastWord = (label: string) => normalizeText(label).split(" ").pop() ?? "";
  return clients.map((client) => {
    const keys = new Set([lastWord(client.label.en), lastWord(client.label.ar), ...(DEMO_ALIASES[client.id] ?? []).map(normalizeText)]);
    keys.delete("");
    return { clientId: client.id, keys: [...keys] };
  });
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = row;
  }
  return prev[b.length] ?? 2;
}

/** Arabic words carry attached prepositions ("لألفا", "وبيتا"); try the word without them too. */
function variants(token: string): readonly string[] {
  const out = [token];
  if (!/^[ء-ي]/.test(token)) return out;
  let t = token;
  if (/^[وف]/.test(t) && t.length > 4) {
    t = t.slice(1);
    out.push(t);
  }
  if (/^[لبك]/.test(t) && t.length > 4) {
    t = t.slice(1);
    out.push(t);
  }
  if (t.startsWith("ال") && t.length > 4) out.push(t.slice(2));
  return out;
}

/** The first client mentioned, by position in the text. Close misspellings of longer names count. */
export function findClient(text: string, index: NameIndex): string | null {
  for (const token of tokenize(normalizeText(text))) {
    for (const v of variants(token.text)) {
      for (const entry of index) {
        if (entry.keys.some((k) => k === v || (k.length >= 5 && v.length >= 4 && editDistance(k, v) <= 1))) return entry.clientId;
      }
    }
  }
  return null;
}

// ── Quantities ─────────────────────────────────────────────────────────────────────────────

export type QuantityUnit = "MONEY" | "PERCENT" | "YEAR" | "YEARS" | "BEDROOMS";

export interface Quantity {
  readonly value: number;
  readonly unit: QuantityUnit;
  readonly start: number;
  readonly end: number;
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  "واحد": 1, "اتنين": 2, "اثنين": 2, "تلاته": 3, "ثلاثه": 3, "تلات": 3, "اربعه": 4, "اربع": 4, "خمسه": 5, "سته": 6,
  "سبعه": 7, "تمانيه": 8, "ثمانيه": 8, "تسعه": 9, "عشره": 10, "اتناشر": 12, "خمستاشر": 15, "عشرين": 20,
};
const MILLION = new Set(["million", "millions", "mn", "مليون", "ملايين"]);
const THOUSAND = new Set(["k", "thousand", "الف", "الاف"]);
const YEARS_WORDS = new Set(["year", "years", "yrs", "سنه", "سنين", "سنوات"]);
const ROOM_WORDS = new Set(["bed", "beds", "bedroom", "bedrooms", "br", "غرف", "غرفه", "اوض", "اوضه"]);
const PERCENT_WORDS = new Set(["%", "percent", "pct"]);
/** Egyptian duals: "مليونين" is two million, "اوضتين" two bedrooms, "سنتين" two years. */
const DUALS: Readonly<Record<string, [number, QuantityUnit]>> = {
  "مليونين": [2_000_000, "MONEY"],
  "اوضتين": [2, "BEDROOMS"],
  "غرفتين": [2, "BEDROOMS"],
  "سنتين": [2, "YEARS"],
};

function numberOf(token: string): number | null {
  if (/^\d/.test(token)) {
    const raw = token.replace(/%$/, "");
    // "4,500,000" groups thousands; "4,5" is a decimal comma.
    const clean = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }
  return NUMBER_WORDS[token] ?? null;
}

/** Fractions spoken after a unit: "4 million and a half", "٤ مليون ونص", "وربع". */
function fractionAfter(tokens: readonly Token[], i: number): [number, number] {
  const a = tokens[i]?.text;
  const b = tokens[i + 1]?.text;
  const c = tokens[i + 2]?.text;
  if (a === "ونص" || (a === "و" && b === "نص")) return [0.5, a === "و" ? 2 : 1];
  if (a === "وربع" || (a === "و" && b === "ربع")) return [0.25, a === "و" ? 2 : 1];
  if (a === "and" && b === "a" && c === "half") return [0.5, 3];
  if (a === "and" && b === "a" && c === "quarter") return [0.25, 3];
  return [0, 0];
}

/** Money, percentages, years, year counts and bedroom counts in a folded string. */
export function parseQuantities(folded: string): readonly Quantity[] {
  const tokens = tokenize(folded);
  const out: Quantity[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] as Token;
    const next = tokens[i + 1]?.text ?? "";
    const dual = DUALS[tok.text];
    if (dual) {
      const [frac, used] = dual[1] === "MONEY" ? fractionAfter(tokens, i + 1) : [0, 0];
      const last = tokens[i + used] ?? tok;
      out.push({ value: dual[0] + frac * 1_000_000, unit: dual[1], start: tok.start, end: last.end });
      i += used;
      continue;
    }
    // "half a million", "نص مليون"
    if ((tok.text === "نص" && MILLION.has(next)) || (tok.text === "half" && next === "a" && MILLION.has(tokens[i + 2]?.text ?? ""))) {
      const used = tok.text === "نص" ? 1 : 2;
      out.push({ value: 500_000, unit: "MONEY", start: tok.start, end: (tokens[i + used] as Token).end });
      i += used;
      continue;
    }
    // "4.5m", "750k": the letter is glued to the number.
    const glued = tokens[i + 1];
    if (/^\d/.test(tok.text) && glued && glued.start === tok.end && (glued.text === "m" || glued.text === "k")) {
      const n = numberOf(tok.text);
      if (n !== null) out.push({ value: n * (glued.text === "m" ? 1_000_000 : 1_000), unit: "MONEY", start: tok.start, end: glued.end });
      i += 1;
      continue;
    }
    if (MILLION.has(tok.text)) {
      const [frac, used] = fractionAfter(tokens, i + 1);
      out.push({ value: (1 + frac) * 1_000_000, unit: "MONEY", start: tok.start, end: (tokens[i + used] ?? tok).end });
      i += used;
      continue;
    }
    const n = numberOf(tok.text);
    if (n === null) continue;
    if (tok.text.endsWith("%") || PERCENT_WORDS.has(next) || (next === "في" && /^(الميه|الميا|المئه)$/.test(tokens[i + 2]?.text ?? ""))) {
      const used = tok.text.endsWith("%") ? 0 : next === "في" ? 2 : 1;
      out.push({ value: n, unit: "PERCENT", start: tok.start, end: (tokens[i + used] ?? tok).end });
      i += used;
      continue;
    }
    if (MILLION.has(next) || THOUSAND.has(next)) {
      const scale = MILLION.has(next) ? 1_000_000 : 1_000;
      const [frac, used] = fractionAfter(tokens, i + 2);
      out.push({ value: (n + frac) * scale, unit: "MONEY", start: tok.start, end: (tokens[i + 1 + used] as Token).end });
      i += 1 + used;
      continue;
    }
    if (YEARS_WORDS.has(next)) {
      out.push({ value: n, unit: "YEARS", start: tok.start, end: (tokens[i + 1] as Token).end });
      i += 1;
      continue;
    }
    if (ROOM_WORDS.has(next)) {
      out.push({ value: n, unit: "BEDROOMS", start: tok.start, end: (tokens[i + 1] as Token).end });
      i += 1;
      continue;
    }
    if (Number.isInteger(n) && n >= 2020 && n <= 2049) {
      out.push({ value: n, unit: "YEAR", start: tok.start, end: tok.end });
      continue;
    }
    if (n >= 100_000) out.push({ value: n, unit: "MONEY", start: tok.start, end: tok.end });
  }
  return out;
}

/** An EGP amount in a profile field such as "4M EGP" or "750K EGP". */
export function parseAmount(text: string): number | null {
  const money = parseQuantities(foldText(text)).find((q) => q.unit === "MONEY");
  return money ? money.value : null;
}

/** "4.5M EGP", "750K EGP". */
export function formatMoney(egp: number): string {
  const trim = (n: number) => String(Math.round(n * 100) / 100);
  return egp >= 1_000_000 ? `${trim(egp / 1_000_000)}M EGP` : `${trim(egp / 1_000)}K EGP`;
}

// ── Dates ──────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const WEEKDAYS: ReadonlyArray<readonly [number, readonly string[]]> = [
  [0, ["sunday", "الحد", "الاحد"]],
  [1, ["monday", "الاتنين", "الاثنين"]],
  [2, ["tuesday", "التلات", "الثلاثاء", "التلاتاء"]],
  [3, ["wednesday", "الاربع", "الاربعاء", "الاربعا"]],
  [4, ["thursday", "الخميس"]],
  [5, ["friday", "الجمعه"]],
  [6, ["saturday", "السبت"]],
];

/** A due date the operator named, relative to `today` (`YYYY-MM-DD`), or null when none was said. */
export function parseDueDate(text: string, today: string): string | null {
  const norm = normalizeText(text);
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(norm);
  if (iso) {
    const d = new Date(`${iso[0]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso[0]) return iso[0];
  }
  if (/\bday after tomorrow\b/.test(norm) || hasPhrase(norm, ["بعد بكره", "بعد بكرا"])) return addDays(today, 2);
  if (/\btomorrow\b/.test(norm) || hasPhrase(norm, ["بكره", "بكرا"])) return addDays(today, 1);
  if (/\b(today|tonight|this evening|this afternoon)\b/.test(norm) || hasPhrase(norm, ["النهارده", "انهارده", "الليله", "بالليل"])) return today;
  if (/\bnext week\b/.test(norm) || hasPhrase(norm, ["الاسبوع الجاي", "الاسبوع اللي جاي"])) return addDays(today, 7);
  const inDays = /\bin (\w+) days?\b/.exec(norm) ?? /(?:بعد|كمان) (\S+) (?:ايام|يوم)/.exec(norm);
  if (inDays) {
    const n = numberOf(inDays[1] ?? "");
    if (n !== null && n > 0 && n < 60) return addDays(today, Math.round(n));
  }
  const todayIndex = new Date(`${today}T00:00:00Z`).getUTCDay();
  for (const [index, names] of WEEKDAYS) {
    if (names.some((name) => (/^[a-z]/.test(name) ? new RegExp(`\\b${name}\\b`).test(norm) : hasPhrase(norm, [name])))) {
      const ahead = (index - todayIndex + 7) % 7 || 7;
      return addDays(today, ahead);
    }
  }
  return null;
}

// ── Voices ─────────────────────────────────────────────────────────────────────────────────

export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
}

const FEMALE_VOICE: Readonly<Record<"en" | "ar", RegExp>> = {
  en: /aria|jenny|ava|emma|michelle|samantha|allison|zira|libby|sonia|female|google us english/i,
  ar: /salma|hoda|zariyah|laila|amina|mariam|female/i,
};

/** Voices closest to Donna's character (warm, low, quick, sure of herself), best first. An original voice, not anyone's copy. */
const DONNA_CHARACTER: Readonly<Record<"en" | "ar", readonly RegExp[]>> = {
  en: [/\bava\b/i, /\bemma\b/i, /\bjenny\b/i, /\baria\b/i],
  ar: [/\bsalma\b/i, /\bzariyah\b/i],
};

/** Donna's voice: a female voice in the reply language, Egyptian Arabic first, natural voices preferred. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], locale: "en" | "ar"): V | null {
  const region = locale === "ar" ? ["ar-eg", "ar-sa", "ar"] : ["en-us", "en-gb", "en"];
  const score = (v: V) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    if (!lang.startsWith(locale)) return -1;
    const regionRank = region.findIndex((r) => lang.startsWith(r));
    // A natural (neural) voice matters more than the region, but never more than her being a woman.
    const quality = /natural|neural|online|premium|enhanced/i.test(v.name) ? 8 : 0;
    const character = DONNA_CHARACTER[locale].findIndex((pattern) => pattern.test(v.name));
    return (FEMALE_VOICE[locale].test(v.name) ? 10 : 0) + (regionRank >= 0 ? 6 - regionRank * 2 : 0) + quality + (character >= 0 ? 4 - character : 0);
  };
  let best: V | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = score(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return bestScore >= 0 ? best : null;
}
