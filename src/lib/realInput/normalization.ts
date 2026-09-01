import type { EventDirection, ImportIssue, SalesActorRole, SalesChannel } from "./types";

const OFFSET_PATTERN = /^([+-])(\d{2}):(\d{2})$/;
const LOCAL_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function requiredContextIssues(context: {
  organizationId: string;
  salesFloorId: string;
  sourceId: string;
  defaultTimezoneOffset: string;
}): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const requiredFields = {
    organizationId: context.organizationId,
    salesFloorId: context.salesFloorId,
    sourceId: context.sourceId,
    defaultTimezoneOffset: context.defaultTimezoneOffset,
  };
  for (const [field, value] of Object.entries(requiredFields)) {
    if (!value.trim()) issues.push({ severity: "ERROR", code: "MISSING_CONTEXT", message: `${field} is required.` });
  }
  if (context.defaultTimezoneOffset && parseOffsetMinutes(context.defaultTimezoneOffset) === null) {
    issues.push({ severity: "ERROR", code: "INVALID_TIMEZONE_OFFSET", message: "Timezone must be a fixed offset such as +02:00." });
  }
  return issues;
}

export function parseOffsetMinutes(offset: string): number | null {
  const match = OFFSET_PATTERN.exec(offset);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null;
  const total = hours * 60 + minutes;
  return match[1] === "-" ? -total : total;
}

export function normalizeTimestamp(value: string, defaultOffset: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const local = LOCAL_TIMESTAMP_PATTERN.exec(trimmed);
  const offsetMinutes = parseOffsetMinutes(defaultOffset);
  if (!local || offsetMinutes === null) return null;
  return localPartsToIso(
    Number(local[1]),
    Number(local[2]),
    Number(local[3]),
    Number(local[4]),
    Number(local[5]),
    Number(local[6] ?? "0"),
    offsetMinutes,
  );
}

export function localPartsToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  offsetMinutes: number,
): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const localUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(localUtc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) return null;
  return new Date(localUtc - offsetMinutes * 60_000).toISOString();
}

export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasInternationalPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return null;
  return `${hasInternationalPrefix ? "+" : ""}${digits}`;
}

export function normalizeIdentity(value: string): string {
  const phone = normalizePhone(value);
  return phone ? `phone:${phone.replace(/^\+/, "")}` : `name:${value.trim().toLocaleLowerCase()}`;
}

export function normalizeChannel(value: string): SalesChannel | null {
  const channel = value.trim().toUpperCase();
  return (["CRM", "WHATSAPP", "EMAIL", "CALL", "OTHER"] as const).find((item) => item === channel) ?? null;
}

export function normalizeDirection(value: string): EventDirection | null {
  const direction = value.trim().toUpperCase();
  return (["INBOUND", "OUTBOUND", "INTERNAL", "UNKNOWN"] as const).find((item) => item === direction) ?? null;
}

export function normalizeActorRole(value: string): SalesActorRole | null {
  const role = value.trim().toUpperCase();
  return (["BUYER", "BUYER_DELEGATE", "REP", "MANAGER", "SYSTEM"] as const).find((item) => item === role) ?? null;
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
