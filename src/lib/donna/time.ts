import type { ReminderPolicy } from "./types";

const MINUTE_MS = 60_000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Epoch ms for a strict ISO instant with explicit offset, or NaN. */
export function parseInstant(value: string): number {
  return ISO_INSTANT.test(value) ? Date.parse(value) : Number.NaN;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(parseInstant(iso) + minutes * MINUTE_MS).toISOString();
}

export interface LocalParts {
  readonly date: string;
  readonly hour: number;
  readonly minute: number;
}

/** Wall-clock parts at a fixed UTC offset. No DST, no ambient timezone. */
export function localParts(iso: string, utcOffsetMinutes: number): LocalParts {
  const shifted = new Date(parseInstant(iso) + utcOffsetMinutes * MINUTE_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** `YYYY-MM-DD HH:mm` at the fixed offset. */
export function formatLocal(iso: string, utcOffsetMinutes: number): string {
  const p = localParts(iso, utcOffsetMinutes);
  return `${p.date} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function isCalendarDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Quiet hours may wrap midnight (e.g. 22 → 7). */
export function isInQuietHours(iso: string, policy: ReminderPolicy): boolean {
  const { hour } = localParts(iso, policy.utcOffsetMinutes);
  const { quietStartHour: start, quietEndHour: end } = policy;
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** The instant of `hour:00` local time on the next local day after `iso`. */
export function nextLocalMorning(iso: string, policy: ReminderPolicy, hour: number): string {
  const { date } = localParts(iso, policy.utcOffsetMinutes);
  const midnightLocalAsUtc = Date.parse(`${date}T00:00:00Z`) - policy.utcOffsetMinutes * MINUTE_MS;
  return new Date(midnightLocalAsUtc + (24 * 60 + hour * 60) * MINUTE_MS).toISOString();
}

/**
 * Convert a `YYYY-MM-DDTHH:mm` wall-clock value at a fixed offset to a UTC
 * instant. Returns "" when the value is not a real date and time.
 */
export function localToInstant(value: string, utcOffsetMinutes: number): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const asUtc = Date.parse(`${value}:00Z`);
  if (Number.isNaN(asUtc)) return "";
  const instant = new Date(asUtc - utcOffsetMinutes * MINUTE_MS).toISOString();
  return localParts(instant, utcOffsetMinutes).date === value.slice(0, 10) ? instant : "";
}
