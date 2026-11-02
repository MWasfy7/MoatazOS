import { buildInbox } from "./engine";
import { localParts, parseInstant } from "./time";
import type { DonnaState } from "./types";

/**
 * Donna's morning brief (pure and deterministic). What she says first thing, built from the
 * planned calls, the append-only outcome log and each client's profile. It only TELLS the
 * operator things; nothing is sent, called, scheduled or written anywhere.
 *
 * Order is deliberate. Restraint comes first (AGENTS.md invariant 2): who to leave alone
 * outranks every other suggestion. Then promises, missing outcomes, cold leads, today's calls.
 */

/** What the client wants. Every field is optional: unknown is never filled in. */
export interface ClientWants {
  readonly budget?: string;
  readonly area?: string;
  readonly unit?: string;
  readonly payment?: "CASH" | "INSTALLMENTS";
  readonly purpose?: "HOME" | "INVESTMENT";
}

export interface ClientPromise {
  readonly id: string;
  /** The operator's own words, exactly as recorded. */
  readonly text: string;
  /** `YYYY-MM-DD` the operator said they would do it by. */
  readonly due: string;
  readonly done: boolean;
}

/**
 * Why Donna holds off:
 * - ASKED_FOR_SPACE: the client asked not to be contacted (or for time). Never chased.
 * - UNANSWERED: the operator's last messages went unanswered; another one hurts more than it helps.
 */
export type HoldReason = "ASKED_FOR_SPACE" | "UNANSWERED";

export interface ClientProfile {
  readonly clientId: string;
  readonly wants: ClientWants;
  /** Personal context the client shared, in the operator's words. */
  readonly personal: string | null;
  readonly promises: readonly ClientPromise[];
  /** ISO instant of the last two-way contact, or null if never. */
  readonly lastContactAt: string | null;
  /** Who owes the next message. */
  readonly turn: "ME" | "CLIENT";
  /** Operator messages since the client last replied. */
  readonly unansweredMessages: number;
  readonly askedForSpace: boolean;
  /** The operator marked this as a serious buyer. */
  readonly hot: boolean;
}

export type BriefLine =
  | { readonly kind: "HOLD_OFF"; readonly clientId: string; readonly reason: HoldReason; readonly count: number }
  | { readonly kind: "PROMISE_OVERDUE"; readonly clientId: string; readonly text: string; readonly days: number }
  | { readonly kind: "PROMISE_TODAY"; readonly clientId: string; readonly text: string }
  | { readonly kind: "OUTCOME_MISSING"; readonly clientId: string; readonly callId: string }
  | { readonly kind: "GOING_COLD"; readonly clientId: string; readonly days: number }
  | { readonly kind: "CALL_TODAY"; readonly clientId: string; readonly callId: string; readonly at: string; readonly wants: ClientWants; readonly openPromise: string | null }
  | { readonly kind: "MISSING_INFO"; readonly clientId: string; readonly field: keyof ClientWants };

export interface MorningBrief {
  readonly today: string;
  readonly lines: readonly BriefLine[];
  /** Clients Donna is deliberately leaving alone today. */
  readonly holdingOff: readonly string[];
}

/** A serious buyer with no two-way contact for this many days is "going cold". */
export const COLD_AFTER_DAYS = 5;
/** This many unanswered messages in a row means stop sending. */
export const UNANSWERED_LIMIT = 2;

const DAY_MS = 86_400_000;
const daysBetween = (fromDate: string, toDate: string) =>
  Math.round((parseInstant(`${toDate}T00:00:00Z`) - parseInstant(`${fromDate}T00:00:00Z`)) / DAY_MS);

export function holdReason(profile: ClientProfile): HoldReason | null {
  if (profile.askedForSpace) return "ASKED_FOR_SPACE";
  if (profile.unansweredMessages >= UNANSWERED_LIMIT) return "UNANSWERED";
  return null;
}

export function buildMorningBrief(state: DonnaState, profiles: readonly ClientProfile[], now: string): MorningBrief {
  const offset = state.policy.utcOffsetMinutes;
  const today = localParts(now, offset).date;
  const inbox = buildInbox(state, now);
  const byId = new Map(profiles.map((p) => [p.clientId, p]));
  const held = new Map<string, HoldReason>();
  for (const p of profiles) {
    const reason = holdReason(p);
    if (reason) held.set(p.clientId, reason);
  }

  const hold: BriefLine[] = [...held].map(([clientId, reason]) => ({
    kind: "HOLD_OFF",
    clientId,
    reason,
    count: byId.get(clientId)?.unansweredMessages ?? 0,
  }));

  // A promise is still owed even to a client Donna is holding off: it is the operator's word.
  // It is listed, but a held client's line never suggests contacting them.
  const promises: BriefLine[] = [];
  for (const p of profiles) {
    for (const promise of p.promises) {
      if (promise.done) continue;
      if (promise.due < today) {
        promises.push({ kind: "PROMISE_OVERDUE", clientId: p.clientId, text: promise.text, days: daysBetween(promise.due, today) });
      } else if (promise.due === today) {
        promises.push({ kind: "PROMISE_TODAY", clientId: p.clientId, text: promise.text });
      }
    }
  }
  promises.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "PROMISE_OVERDUE" ? -1 : 1));

  const outcomes: BriefLine[] = inbox.unresolved.map((q) => ({ kind: "OUTCOME_MISSING", clientId: q.clientId, callId: q.callId }));

  const cold: BriefLine[] = profiles
    .filter((p) => p.hot && !held.has(p.clientId) && p.turn === "ME" && p.lastContactAt !== null)
    .map((p) => ({ kind: "GOING_COLD" as const, clientId: p.clientId, days: daysBetween(localParts(p.lastContactAt as string, offset).date, today) }))
    .filter((line) => line.days >= COLD_AFTER_DAYS)
    .sort((a, b) => b.days - a.days);

  // A planned call with a client Donna is holding off is covered by the HOLD_OFF line instead.
  const calls: BriefLine[] = inbox.upcoming
    .filter((call) => localParts(call.dueAt, offset).date === today && !held.has(call.clientId))
    .map((call) => {
      const p = byId.get(call.clientId);
      const open = p?.promises.find((x) => !x.done) ?? null;
      return { kind: "CALL_TODAY" as const, clientId: call.clientId, callId: call.id, at: call.dueAt, wants: p?.wants ?? {}, openPromise: open?.text ?? null };
    });

  // One gap question per client Donna will talk about today (never for a held client).
  const asked = new Set<string>();
  const missing: BriefLine[] = [];
  for (const line of [...calls, ...cold]) {
    const p = byId.get(line.clientId);
    if (!p || held.has(p.clientId) || asked.has(p.clientId)) continue;
    const field = (["budget", "purpose", "area"] as const).find((f) => p.wants[f] === undefined);
    if (field) {
      asked.add(p.clientId);
      missing.push({ kind: "MISSING_INFO", clientId: p.clientId, field });
    }
  }

  return { today, lines: [...hold, ...promises, ...outcomes, ...cold, ...calls, ...missing], holdingOff: [...held.keys()] };
}

/** Synthetic profiles for the demo clients. No real person, budget or conversation. */
export function createDemoProfiles(now: string): readonly ClientProfile[] {
  const daysAgo = (n: number) => new Date(parseInstant(now) - n * DAY_MS).toISOString();
  const date = (n: number) => daysAgo(-n).slice(0, 10);
  return [
    {
      clientId: "cl-alpha",
      wants: { budget: "4M EGP", area: "New Cairo", unit: "a 3-bedroom apartment", payment: "INSTALLMENTS", purpose: "HOME" },
      personal: "Moving with their son; wants to keep the community feel of where they live now.",
      promises: [{ id: "p-alpha-1", text: "Send the payment plan for the 3rd-floor unit", due: date(-2), done: false }],
      lastContactAt: daysAgo(9),
      turn: "ME",
      unansweredMessages: 0,
      askedForSpace: false,
      hot: true,
    },
    {
      clientId: "cl-beta",
      wants: { budget: "10M EGP", purpose: "INVESTMENT", payment: "CASH" },
      personal: null,
      promises: [],
      lastContactAt: daysAgo(4),
      turn: "CLIENT",
      unansweredMessages: 3,
      askedForSpace: false,
      hot: true,
    },
    {
      clientId: "cl-gamma",
      wants: { area: "Sheikh Zayed", unit: "a townhouse", purpose: "HOME" },
      personal: "Works in finishing and decor; values layout over location.",
      promises: [{ id: "p-gamma-1", text: "Bring two layout options to compare", due: date(0), done: false }],
      lastContactAt: daysAgo(2),
      turn: "ME",
      unansweredMessages: 0,
      askedForSpace: false,
      hot: true,
    },
    {
      clientId: "cl-delta",
      wants: { budget: "6M EGP", purpose: "INVESTMENT" },
      personal: null,
      promises: [],
      lastContactAt: daysAgo(6),
      turn: "CLIENT",
      unansweredMessages: 0,
      askedForSpace: true,
      hot: false,
    },
    {
      clientId: "cl-epsilon",
      wants: { budget: "3M EGP", area: "October", purpose: "HOME" },
      personal: null,
      promises: [],
      lastContactAt: daysAgo(1),
      turn: "CLIENT",
      unansweredMessages: 1,
      askedForSpace: false,
      hot: false,
    },
  ];
}
