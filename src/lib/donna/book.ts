import { COLD_AFTER_DAYS, daysBetween, holdReason, type ClientProfile, type HoldReason } from "./brief";
import { parseAmount } from "./speech";
import { localParts } from "./time";

/**
 * The operator's whole book at a glance (pure). Each client gets a temperature and a "drift":
 * how far they have slipped since the last real two-way contact. Held clients are drawn apart
 * so restraint stays visible (AGENTS.md invariant 2). Nothing here suggests contacting anyone.
 */
export type Heat = "HOT" | "WARM" | "COOLING" | "COLD" | "HELD";

export interface BookEntry {
  readonly clientId: string;
  readonly heat: Heat;
  /** Whole days since the last two-way contact; null if there never was one. */
  readonly days: number | null;
  /** 0 = just spoke, 1 = drifted out of reach (or held). */
  readonly drift: number;
  readonly owed: number;
  readonly overdue: number;
  /** Budget in EGP when the client gave one. */
  readonly budget: number | null;
  readonly hold: HoldReason | null;
}

/** After this many quiet days a client sits on the outer ring. */
export const DRIFT_HORIZON_DAYS = 14;

export function readBook(profiles: readonly ClientProfile[], now: string, utcOffsetMinutes: number): readonly BookEntry[] {
  const today = localParts(now, utcOffsetMinutes).date;
  return profiles.map((p) => {
    const hold = holdReason(p);
    const days = p.lastContactAt === null ? null : Math.max(0, daysBetween(localParts(p.lastContactAt, utcOffsetMinutes).date, today));
    const open = p.promises.filter((x) => !x.done);
    let heat: Heat;
    if (hold) heat = "HELD";
    else if (p.hot && days !== null && days < COLD_AFTER_DAYS) heat = "HOT";
    else if (p.hot) heat = "COOLING";
    else if (days !== null && days <= 7) heat = "WARM";
    else heat = "COLD";
    return {
      clientId: p.clientId,
      heat,
      days,
      drift: hold ? 1 : Math.min(1, (days ?? DRIFT_HORIZON_DAYS) / DRIFT_HORIZON_DAYS),
      owed: open.length,
      overdue: open.filter((x) => x.due < today).length,
      budget: p.wants.budget ? parseAmount(p.wants.budget) : null,
      hold,
    };
  });
}
