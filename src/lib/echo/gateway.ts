import {
  EMPTY_DIALOGUE_STATE,
  type DialogueState,
  type GatewayDecision,
  type ReferentResolution,
  type RiskTier,
  type SubjectRef,
  type UtteranceClass,
} from "./types";

export const GATEWAY_VERSION = "echo-conversational-gateway-v0.1.0";

// ---------------------------------------------------------------------------
// Lexical inventories.
//
// These are NOT an intent lexicon. SalesOS's extractor fails precisely
// because its lexicon *is* the classifier: a term miss becomes UNKNOWN and
// UNKNOWN is terminal. Here the inventories only tag structural features
// (is this interrogative? does it carry an unresolved pronoun? is the effect
// irreversible?). A term miss degrades to CONVERSATION — the safe, talkative
// default — never to a rejection. Adding phrases tunes recall; it is never
// load-bearing for correctness.
// ---------------------------------------------------------------------------

/** Stripped before classification and recorded separately. Affect is not intent. */
const AFFECT_TOKENS = new Set([
  "fuck", "fucking", "shit", "damn", "hell", "wtf", "ffs", "bro", "man", "dude", "ugh",
]);

const FRUSTRATION_MARKERS = ["still", "keep", "again and again", "isn't working", "not working", "broken"];

/** Interrogative openers. Auxiliary inversion and wh-fronting. */
const INTERROGATIVE_OPENERS = new Set([
  "what", "whats", "what's", "where", "when", "why", "how", "who", "which", "whose",
  "is", "are", "was", "were", "do", "does", "did", "can", "could", "should", "would",
  "will", "have", "has", "had", "am", "any",
]);

/** Imperative in form, information-seeking in force. These are questions. */
const INFO_SEEKING = [
  "tell me", "show me", "explain", "describe", "list ", "summarize", "summarise",
  "remind me", "catch me up", "walk me through", "give me a rundown", "status",
];

/**
 * Continuation markers, including Egyptian-Arabic code switching in both
 * transliteration and script. This mirrors the bilingual lexicon already
 * present in src/lib/decisionEngine/extractor.ts — code switching is a
 * normalization concern, not a comprehension failure.
 */
const CONTINUATION_MARKERS = [
  "continue", "resume", "carry on", "keep going", "again", "back to", "pick up",
  "where were we", "where did we", "left off", "what we were", "what we did",
  "yesterday", "earlier", "last time", "before", "next step", "whats next", "what's next",
  "yalla", "yala", "kammel", "kamel", "komel", "نكمل", "يلا", "كمل", "يالا",
];

/** "You decide" — a delegated continuation of whatever is already in flight. */
const DELEGATION_MARKERS = [
  "whatever makes the most sense", "whatever makes sense", "do whatever", "you decide",
  "up to you", "your call", "whatever you think", "as you see fit",
];

/** Bare assent. With a pending proposal outstanding, this is a complete instruction. */
const ASSENT_TOKENS = new Set([
  "ok", "okay", "k", "yes", "yeah", "yep", "yup", "sure", "fine", "alright", "aight",
  "please", "then", "now", "go", "cool", "good",
  "tamam", "khalas", "5alas", "aywa", "aiwa", "mashi", "masi",
  "تمام", "خلاص", "أيوة", "ايوه", "ماشي", "نعم",
]);

const ASSENT_PHRASES = ["do it", "go ahead", "go for it", "lets do it", "let's do it", "make it happen"];

/** Pronouns with no antecedent in the utterance itself. */
const BARE_PRONOUNS = new Set(["it", "this", "that", "them", "those", "these", "they", "thing", "stuff"]);

/**
 * Verbs whose effects leave the workspace or cannot be undone. Membership
 * here sets RISK, never comprehension. An understood irreversible request is
 * confirmed, not clarified.
 */
const IRREVERSIBLE_VERBS = new Set([
  "delete", "remove", "drop", "wipe", "purge", "destroy", "truncate", "rm",
  "deploy", "publish", "release", "ship", "send", "email", "pay", "charge",
  "refund", "migrate", "revoke", "rotate", "merge", "force-push", "overwrite", "reset",
]);

/** Local, reversible directives. */
const LOCAL_VERBS = new Set([
  "fix", "make", "improve", "better", "refactor", "clean", "rename", "update",
  "adjust", "tweak", "change", "add", "write", "edit", "try", "check", "look",
  "run", "build", "test", "start", "open", "read", "review", "draft",
]);

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface Features {
  normalized: string;
  tokens: string[];
  frustrated: boolean;
  interrogative: boolean;
  infoSeeking: boolean;
  continuation: boolean;
  assentOnly: boolean;
  barePronoun: boolean;
  irreversibleVerb: boolean;
  localVerb: boolean;
}

function normalize(raw: string): { text: string; tokens: string[]; affectSeen: boolean } {
  const lowered = raw.toLocaleLowerCase().trim();
  const rawTokens = lowered.replace(/[^\p{L}\p{N}'\-?]+/gu, " ").split(/\s+/).filter(Boolean);
  const affectSeen = rawTokens.some((token) => AFFECT_TOKENS.has(token.replace(/[?'-]+$/, "")));
  const tokens = rawTokens.filter((token) => !AFFECT_TOKENS.has(token.replace(/[?'-]+$/, "")));
  return { text: tokens.join(" "), tokens, affectSeen };
}

function extractFeatures(raw: string): Features {
  const { text, tokens, affectSeen } = normalize(raw);
  const first = tokens[0] ?? "";
  // "Echo, what are we doing?" — a vocative must not hide the interrogative.
  const afterVocative = first === "echo" ? tokens[1] ?? "" : first;

  const interrogative = raw.trim().endsWith("?")
    || INTERROGATIVE_OPENERS.has(afterVocative.replace(/\?$/, ""));
  const infoSeeking = INFO_SEEKING.some((phrase) => text.includes(phrase.trim()));
  const delegated = DELEGATION_MARKERS.some((phrase) => text.includes(phrase));
  const continuation = delegated || CONTINUATION_MARKERS.some((marker) => text.includes(marker));

  const residue = stripAssent(text);
  const assentOnly = tokens.length > 0 && residue.length === 0;

  return {
    normalized: text,
    tokens,
    frustrated: affectSeen || FRUSTRATION_MARKERS.some((marker) => text.includes(marker)),
    interrogative,
    infoSeeking,
    continuation,
    assentOnly,
    barePronoun: tokens.some((token) => BARE_PRONOUNS.has(token)),
    irreversibleVerb: tokens.some((token) => IRREVERSIBLE_VERBS.has(token)),
    localVerb: tokens.some((token) => LOCAL_VERBS.has(token)),
  };
}

/** Remove assent tokens and phrases; whatever survives is the real request. */
function stripAssent(text: string): string[] {
  let remaining = text;
  for (const phrase of ASSENT_PHRASES) remaining = remaining.split(phrase).join(" ");
  return remaining.split(/\s+/).filter(Boolean).filter((token) => !ASSENT_TOKENS.has(token));
}

// ---------------------------------------------------------------------------
// Referent resolution — attempted BEFORE any consideration of clarification
// ---------------------------------------------------------------------------

export function resolveReferent(features: Features, state: DialogueState): ReferentResolution {
  if (features.assentOnly && state.pendingProposal) {
    return { status: "RESOLVED", subject: state.pendingProposal, basis: "PENDING_PROPOSAL", dominant: true };
  }

  // An explicit name in the utterance beats everything in memory.
  const named = [...state.recentSubjects, ...(state.activeThread ? [state.activeThread] : [])]
    .find((candidate) => candidate.label.length > 2 && features.normalized.includes(candidate.label.toLocaleLowerCase()));
  if (named) return { status: "RESOLVED", subject: named, basis: "EXPLICIT_IN_UTTERANCE", dominant: true };

  const needsReferent = features.barePronoun || features.continuation || features.assentOnly;
  if (!needsReferent) return { status: "NOT_REQUIRED" };

  if (features.continuation && state.activeThread?.resumable) {
    return { status: "RESOLVED", subject: state.activeThread, basis: "ACTIVE_THREAD", dominant: false };
  }

  const ranked: SubjectRef[] = [...state.recentSubjects].sort((a, b) => b.lastTouchedTurn - a.lastTouchedTurn);
  if (ranked.length === 0) return { status: "UNRESOLVED" };
  if (ranked.length === 1) return { status: "RESOLVED", subject: ranked[0], basis: "SOLE_SUBJECT", dominant: true };
  if (ranked[0].lastTouchedTurn > ranked[1].lastTouchedTurn) {
    return { status: "RESOLVED", subject: ranked[0], basis: "RECENCY_DOMINANCE", dominant: false };
  }
  return { status: "AMBIGUOUS", candidates: ranked };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classify(features: Features, referent: ReferentResolution, risk: RiskTier): UtteranceClass {
  if (features.assentOnly) return "COMMAND";
  // Interrogative force wins over surface imperatives and continuation markers:
  // "Where did we leave off?" reports state, it does not resume work.
  if (features.interrogative || features.infoSeeking) return "QUESTION";
  if (features.continuation) return "CONTINUATION";
  if (risk === "IRREVERSIBLE") {
    return referent.status === "RESOLVED" || referent.status === "NOT_REQUIRED"
      ? "ACTION_REQUEST"
      : "AMBIGUOUS_HIGH_RISK";
  }
  if (features.localVerb) return "COMMAND";
  return "CONVERSATION";
}

// ---------------------------------------------------------------------------
// Routing — the safe-inference policy
// ---------------------------------------------------------------------------

function label(referent: ReferentResolution): string {
  return referent.status === "RESOLVED" ? referent.subject.label : "";
}

export function routeUtterance(raw: string, state: DialogueState = EMPTY_DIALOGUE_STATE): GatewayDecision {
  const features = extractFeatures(raw);
  const referent = resolveReferent(features, state);
  const risk: RiskTier = features.irreversibleVerb
    || (features.assentOnly && state.pendingProposal?.riskTier === "IRREVERSIBLE")
    ? "IRREVERSIBLE"
    : "REVERSIBLE";
  const utteranceClass = classify(features, referent, risk);
  const affect = features.frustrated ? "FRUSTRATED" : "NEUTRAL";

  const base = {
    utteranceClass,
    riskTier: risk,
    referent,
    affect,
    requiresConfirmation: false,
  } as const;

  // Conversation and questions never require an executable task to exist.
  // This single property is what the current architecture lacks.
  if (utteranceClass === "CONVERSATION" || utteranceClass === "QUESTION") {
    return {
      ...base,
      responseMode: "RESPOND",
      rationale: `${utteranceClass} needs no executable task; answering from dialogue state.`,
    };
  }

  if (utteranceClass === "AMBIGUOUS_HIGH_RISK") {
    return {
      ...base,
      responseMode: "REQUEST_CLARIFICATION",
      requiresConfirmation: true,
      rationale: "Irreversible effect with an unresolvable target; acting on any reading could cause material damage.",
    };
  }

  if (referent.status === "AMBIGUOUS") {
    return {
      ...base,
      responseMode: "OFFER_CHOICE",
      choices: referent.candidates.slice(0, 2).map((candidate) => candidate.label),
      rationale: "Several equally recent readings differ materially; offering a short choice rather than blocking.",
    };
  }

  if (referent.status === "UNRESOLVED") {
    // Low-risk and nothing to resolve against: keep talking. Never a rejection.
    return {
      ...base,
      responseMode: "RESPOND",
      rationale: "No referent in dialogue state, but the effect is reversible; respond conversationally instead of blocking.",
    };
  }

  const requiresConfirmation = risk === "IRREVERSIBLE";
  if (referent.status === "RESOLVED" && !referent.dominant) {
    return {
      ...base,
      requiresConfirmation,
      responseMode: "ACT_WITH_ASSUMPTION",
      assumption: `Assuming you mean ${label(referent)}.`,
      rationale: `Dominant reading selected via ${referent.basis}; stating the assumption and proceeding.`,
    };
  }

  return {
    ...base,
    requiresConfirmation,
    responseMode: "ACT",
    rationale: referent.status === "RESOLVED"
      ? `Intent unambiguous; referent resolved via ${referent.basis}.`
      : "Intent unambiguous and self-contained.",
  };
}
