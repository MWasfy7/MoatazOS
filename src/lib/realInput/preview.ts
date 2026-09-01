import type { ImportPreview, ImportResult } from "./types";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d\s().-]{5,}\d)(?!\w)/g;

export function maskPii(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[EMAIL REDACTED]")
    .replace(PHONE_PATTERN, (match) => {
      const digits = match.replace(/\D/g, "");
      return digits.length >= 7 ? `[PHONE REDACTED ••${digits.slice(-2)}]` : match;
    });
}

export function createImportPreview(result: ImportResult): ImportPreview {
  return {
    status: result.status,
    acceptedCount: result.events.length,
    duplicateCount: result.duplicateCount,
    rejectedCount: result.status === "REJECTED" ? result.sourceRecordCount : 0,
    events: result.events.map((event) => ({
      ...event,
      eventId: maskPii(event.eventId),
      leadId: maskPii(event.leadId),
      actorId: maskPii(event.actorId),
      sourceRef: maskPii(event.sourceRef),
      textOrSummary: maskPii(event.textOrSummary),
      metadata: Object.fromEntries(Object.entries(event.metadata).map(([key, value]) => [key, maskPii(value)])),
    })),
    issues: result.issues,
  };
}
