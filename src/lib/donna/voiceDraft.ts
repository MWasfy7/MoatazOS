import type { NextAction, OutcomeKind } from "./types";

/**
 * DON-03 voice capture: transcript -> reviewable DRAFT.
 *
 * Pure and deterministic: no model, no network, no storage. The transcript comes from
 * outside (a person typing, or a separate speech service) and is never trusted.
 * A draft is only a proposal. The operator reviews it and confirms it in Donna's own
 * outcome flow; nothing here records an event, sends anything, or books anything.
 *
 * Rules (AGENTS.md invariants 1, 2, 9):
 *  - `originalInput` is the transcript verbatim.
 *  - Voice alone never creates a CLIENT_CONFIRMED_APPOINTMENT.
 *  - Do-not-contact language wins: restraint is flagged and no next action is proposed.
 *  - An outcome is proposed only when the words say so; otherwise it stays unknown.
 */
export type VoiceReview =
  | "NO_ACTION"
  | "INSUFFICIENT_EVIDENCE"
  | "REJECT_DRAFT"
  | "ASK_OPERATOR_OUTCOME"
  | "PROPOSE_INTERNAL_FOLLOW_UP";

export interface VoiceDraft {
  readonly callId: string;
  readonly at: string;
  readonly outcome: OutcomeKind | null;
  readonly originalInput: string;
  readonly nextAction: Extract<NextAction, { kind: "INTERNAL_FOLLOW_UP" }> | null;
  readonly voice: {
    readonly proposalOnly: true;
    readonly externalSideEffect: false;
    readonly needsOperatorConfirmation: true;
    readonly restraint: boolean;
    readonly unresolved: readonly ("outcome" | "nextAction")[];
  };
}

export interface VoiceReviewResult {
  readonly decision: VoiceReview;
  readonly flags: readonly ("RESTRAIN" | "INVALID_DRAFT" | "NO_EVIDENCE" | "OUTCOME_UNKNOWN")[];
}

const RESTRAINT =
  /do not contact|don't contact|stop contacting|not interested|لا\s*تتصل|مش\s*عايز|متتصلش|بلاش\s*تتصل|ما\s*تتصل|تتصلش/i;
const NO_ANSWER = /no answer|didn't pick up|did not answer|مردش|ما\s*ردش|مفيش\s*رد/i;
const SPOKE = /\bspoke\b|\btalked\b|كلمته|كلمتها|اتكلمت|اتكلمنا/i;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

export function hasRestraintLanguage(text: string): boolean {
  return RESTRAINT.test(text);
}

function validIsoDate(match: RegExpMatchArray | null): string | null {
  if (!match) return null;
  const [whole, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d)
    ? whole
    : null;
}

export function draftFromTranscript(transcript: string, callId: string, at: string): VoiceDraft {
  const restraint = hasRestraintLanguage(transcript);
  // Negated phrases ("no answer") are checked first so "spoke" cannot override them.
  const outcome: OutcomeKind | null = NO_ANSWER.test(transcript) ? "NO_ANSWER" : SPOKE.test(transcript) ? "SPOKE" : null;
  const date = validIsoDate(transcript.match(ISO_DATE));
  const nextAction = date && !restraint ? ({ kind: "INTERNAL_FOLLOW_UP", date } as const) : null;
  return {
    callId,
    at,
    outcome,
    originalInput: transcript,
    nextAction,
    voice: {
      proposalOnly: true,
      externalSideEffect: false,
      needsOperatorConfirmation: true,
      restraint,
      unresolved: [
        ...(outcome === null ? (["outcome"] as const) : []),
        ...(nextAction === null ? (["nextAction"] as const) : []),
      ],
    },
  };
}

/**
 * Council-style review of a draft. Precedence:
 * invalid > restraint > no evidence > unknown outcome > propose internal follow-up.
 * The result is a recommendation class for the operator, never an action.
 */
export function reviewVoiceDraft(draft: VoiceDraft): VoiceReviewResult {
  const flags: Array<VoiceReviewResult["flags"][number]> = [];
  // Widened on purpose: a draft from outside may not honour the literal types.
  const v: { proposalOnly: boolean; externalSideEffect: boolean; needsOperatorConfirmation: boolean; restraint: boolean } = draft.voice;
  const next: { kind: string } | null = draft.nextAction;
  const invalid =
    v.proposalOnly !== true ||
    v.externalSideEffect !== false ||
    v.needsOperatorConfirmation !== true ||
    next?.kind === "CLIENT_CONFIRMED_APPOINTMENT";
  if (invalid) flags.push("INVALID_DRAFT");
  else if (draft.originalInput.trim() === "") flags.push("NO_EVIDENCE");
  if (v.restraint || hasRestraintLanguage(draft.originalInput)) flags.push("RESTRAIN");
  if (draft.outcome === null) flags.push("OUTCOME_UNKNOWN");

  const has = (f: VoiceReviewResult["flags"][number]) => flags.includes(f);
  const decision: VoiceReview = has("INVALID_DRAFT")
    ? "REJECT_DRAFT"
    : has("RESTRAIN")
      ? "NO_ACTION"
      : has("NO_EVIDENCE")
        ? "INSUFFICIENT_EVIDENCE"
        : has("OUTCOME_UNKNOWN")
          ? "ASK_OPERATOR_OUTCOME"
          : "PROPOSE_INTERNAL_FOLLOW_UP";
  return { decision, flags: [...flags].sort() };
}
