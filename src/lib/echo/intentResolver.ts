import type {
  EchoLanguage,
  IntentResolution,
  ResolvedIntent,
} from "./types";

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/gu;
const PUNCTUATION = /[^\p{L}\p{N}'?]+/gu;

const STEMS = {
  continue: ["continue", "resume", "proceed", "كمل", "نكمل", "كمّل", "kammel", "kamel", "kmel"],
  action: [
    "fix", "change", "update", "review", "inspect", "explain", "show", "open", "send", "delete",
    "صلح", "غير", "راجع", "اشرح", "وريني", "افتح", "ابعت", "ابعث", "امسح",
    "sal7", "salla7", "ghayar", "rag3", "eshra7", "warini", "efta7", "eb3at", "ems7",
  ],
  correction: ["actually", "mean", "correction", "قصدي", "لا", "لأ", "مش", "asdy", "la2", "msh", "mesh"],
  greeting: ["hello", "hey", "hi", "morning", "مساء", "صباح", "اهلا", "أهلا", "ازيك", "salam", "ezayak"],
  question: ["what", "why", "how", "where", "when", "who", "ايه", "ليه", "ازاي", "فين", "متى", "eh", "leh", "ezay", "feen"],
  pronoun: ["it", "that", "this", "them", "him", "her", "ده", "دا", "دي", "دول", "داك", "له", "لها", "da", "di", "dah", "dol"],
} as const;

const FILLERS = new Set([
  "uh", "um", "erm", "like", "يعني", "بص", "طيب", "ya3ni", "tab", "okay", "ok",
]);

const POLITE = new Set([
  "please", "kindly", "ممكن", "لو", "سمحت", "من", "فضلك", "momken", "law", "sama7t", "fadlak",
]);

const stemMatch = (token: string, stems: readonly string[]) =>
  stems.some((stem) => token === stem || (stem.length >= 4 && token.startsWith(stem)));

const hasStem = (tokens: readonly string[], stems: readonly string[]) =>
  tokens.some((token) => stemMatch(token, stems));

export function normalizeEchoText(text: string): string {
  const normalized = text
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .toLowerCase()
    .replace(/[’‘]/gu, "'")
    .replace(PUNCTUATION, " ")
    .trim()
    .replace(/\s+/gu, " ");
  const tokens = normalized.split(" ").filter(Boolean);
  return tokens.filter((token, index) => token !== tokens[index - 1]).join(" ");
}

export function detectEchoLanguage(text: string): EchoLanguage {
  const arabic = /\p{Script=Arabic}/u.test(text);
  const latin = /[a-z]/iu.test(text);
  if (arabic && latin) return "MIXED";
  if (arabic) return "ARABIC";
  if (/[23789]/u.test(text) || /\b(?:kammel|la2|asdy|msh|mesh|ya3ni|sal7)\b/iu.test(text))
    return "FRANCO_ARABIC";
  return "ENGLISH";
}

const meaningfulTokens = (tokens: readonly string[]) =>
  tokens.filter((token) => !FILLERS.has(token) && !POLITE.has(token) && token !== "yalla" && token !== "يلا");

const actionOperation = (tokens: readonly string[]) => {
  const token = tokens.find((candidate) => stemMatch(candidate, STEMS.action));
  if (token && /^(?:send|ابعت|ابعث|eb3at)/u.test(token)) return "send";
  if (token && /^(?:delete|امسح|ems7)/u.test(token)) return "delete";
  return token;
};

const explicitTargetAfterAction = (tokens: readonly string[], operation?: string) => {
  if (!operation) return undefined;
  const index = tokens.findIndex((token) => actionOperation([token]) === operation);
  const tail = tokens
    .slice(index + 1)
    .filter((token) => !POLITE.has(token) && !FILLERS.has(token));
  if (!tail.length || tail.every((token) => stemMatch(token, STEMS.pronoun))) return undefined;
  return tail.join(" ");
};

export function resolveIntent(text: string): IntentResolution {
  const normalizedText = normalizeEchoText(text);
  const rawTokens = normalizedText.split(" ").filter(Boolean);
  const tokens = meaningfulTokens(rawTokens);
  const language = detectEchoLanguage(text);
  const operation = actionOperation(tokens);
  const explicitCancellation =
    /\b(?:wait\s+no|never\s*mind)\b/iu.test(normalizedText) ||
    /^(?:please\s+)?(?:cancel|stop)(?:\s|$)/u.test(normalizedText) ||
    /\b(?:don't|do\s+not|never)\s+(?:please\s+)?(?:change|fix|update|delete|send|open|continue|resume)\b/u.test(normalizedText) ||
    /(?:^|\s)(?:بلاش|متعملش|ما\s*تعملش|ماتعملش|متغيرش|ماتغيرش|متبعتش|ماتبعتش|متبعتوش|متصلحش|متمسحش)(?:\s|$)/u.test(normalizedText) ||
    /\b(?:balash|matb3atsh|matghayarsh|matemsa7sh|matems7sh)\b/u.test(normalizedText);
  const restraintFrame =
    /\b(?:don't|do\s+not|no\s+more|stop)\b.*\b(?:follow\s*up|send|message|call)\b/iu.test(normalizedText) ||
    /(?:مش|مبقتش|ما\s*عدتش)\s+عايز.*(?:follow\s*up|متابعة|رسائل|مكالمات)/iu.test(normalizedText);
  const usesContextReference = hasStem(tokens, STEMS.pronoun) ||
    tokens.some((token) => /^(?:ابعت|ابعث)(?:له|لها|لهم)|^eb3at(?:lo|lha|lhom)/u.test(token));
  const correctionFrame =
    hasStem(tokens, STEMS.correction) ||
    /^(?:no)\b/iu.test(normalizedText) ||
    /\b(?:i\s+mean)\b/iu.test(normalizedText);
  const signals: string[] = [];
  let kind: ResolvedIntent["kind"] = "CONVERSATION";

  if (restraintFrame) {
    kind = "RESTRAINT_REQUEST";
    signals.push("restraint-marker");
  } else if (explicitCancellation) {
    kind = "CANCEL_REQUEST";
    signals.push("cancellation-marker");
  } else if (correctionFrame) {
    kind = "CORRECTION";
    signals.push("correction-marker");
  } else if (hasStem(tokens, STEMS.continue) || (/\bcarry\s+on\b/u.test(normalizedText))) {
    kind = "CONTINUE";
    signals.push("continuation");
  } else if (operation) {
    kind = "ACTION_REQUEST";
    signals.push("action-verb");
  } else if (text.includes("?") || hasStem(tokens, STEMS.question)) {
    kind = "INFORMATION_REQUEST";
    signals.push("question-form");
  } else if (tokens.length <= 3 && hasStem(tokens, STEMS.greeting)) {
    kind = "GREETING";
    signals.push("greeting");
  } else if (tokens.length > 0 && tokens.length <= 7) {
    kind = "CONTEXT_UPDATE";
    signals.push("bounded-fragment");
  } else {
    signals.push("open-conversation");
  }

  if (usesContextReference) signals.push("context-reference");
  if (rawTokens.length !== tokens.length) signals.push("noise-normalized");

  return {
    originalText: text,
    tokens,
    intent: {
      kind,
      language,
      normalizedText,
      operation,
      explicitTarget: explicitTargetAfterAction(tokens, operation),
      usesContextReference,
      isFragment: tokens.length <= 7 && !/[.!?؟]/u.test(text.trim().slice(0, -1)),
      signals,
    },
  };
}
