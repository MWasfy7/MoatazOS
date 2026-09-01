import {
  normalizeActorRole,
  normalizeChannel,
  normalizeDirection,
  normalizePhone,
  normalizeTimestamp,
  requiredContextIssues,
} from "./normalization";
import type { ImportContext, ImportIssue, ImportResult, NormalizedSalesEvent, RealEstateEventContext } from "./types";

interface CsvRecord { values: string[]; line: number }

const REQUIRED_COLUMNS = ["event_id", "lead_id", "occurred_at", "actor_id", "actor_role", "channel", "event_type", "direction"] as const;
const MAX_INPUT_CHARACTERS = 5_000_000;
const REAL_ESTATE_COLUMNS: Record<string, keyof RealEstateEventContext> = {
  project: "project",
  developer: "developer",
  unit: "unit",
  budget: "budget",
  area_location: "areaOrLocation",
  payment_plan_context: "paymentPlanContext",
};

export function parseCrmCsv(input: string, context: ImportContext): ImportResult {
  const issues = requiredContextIssues(context);
  if (input.length > MAX_INPUT_CHARACTERS) {
    issues.push({ severity: "ERROR", code: "INPUT_TOO_LARGE", message: "CSV input exceeds the 5 MB preview limit." });
    return rejected(issues, 0);
  }
  const parsed = parseCsvRecords(input);
  issues.push(...parsed.issues);
  if (parsed.records.length === 0) issues.push({ severity: "ERROR", code: "EMPTY_INPUT", message: "The CSV contains no records." });
  if (hasErrors(issues)) return rejected(issues, Math.max(0, parsed.records.length - 1));

  const headerRecord = parsed.records[0];
  if (!headerRecord) return rejected(issues, 0);
  const headers = headerRecord.values.map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  for (const header of new Set(duplicateHeaders)) {
    issues.push({ severity: "ERROR", code: "DUPLICATE_COLUMN", message: `CSV column ${header} appears more than once.`, line: headerRecord.line });
  }
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) issues.push({ severity: "ERROR", code: "MISSING_COLUMN", message: `Required CSV column ${required} is missing.`, line: headerRecord.line });
  }
  if (hasErrors(issues)) return rejected(issues, Math.max(0, parsed.records.length - 1));

  const events: NormalizedSalesEvent[] = [];
  const realEstateByEventId: Record<string, RealEstateEventContext> = {};
  const eventFingerprints = new Map<string, string>();
  const phoneOwners = new Map<string, string>();
  let duplicateCount = 0;
  let sourceRecordCount = 0;
  let previousOccurredAt: string | null = null;
  let outOfOrder = false;

  for (const record of parsed.records.slice(1)) {
    if (record.values.every((value) => !value.trim())) {
      issues.push({ severity: "WARNING", code: "BLANK_RECORD", message: "Blank CSV record was ignored.", line: record.line });
      continue;
    }
    sourceRecordCount += 1;
    if (record.values.length !== headers.length) {
      issues.push({ severity: "ERROR", code: "COLUMN_COUNT_MISMATCH", message: "CSV record does not match the header column count.", line: record.line });
      continue;
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, record.values[index]?.trim() ?? ""]));
    const missing = REQUIRED_COLUMNS.filter((column) => !row[column]);
    if (missing.length > 0) {
      issues.push({ severity: "ERROR", code: "MISSING_VALUE", message: `Required values are missing: ${missing.join(", ")}.`, line: record.line });
      continue;
    }
    const occurredAt = normalizeTimestamp(row.occurred_at ?? "", context.defaultTimezoneOffset);
    const channel = normalizeChannel(row.channel ?? "");
    const direction = normalizeDirection(row.direction ?? "");
    const actorRole = normalizeActorRole(row.actor_role ?? "");
    if (!occurredAt) issues.push({ severity: "ERROR", code: "INVALID_TIMESTAMP", message: "Timestamp is malformed or ambiguous.", line: record.line });
    if (!channel) issues.push({ severity: "ERROR", code: "INVALID_CHANNEL", message: "Channel is not recognized.", line: record.line });
    if (!direction) issues.push({ severity: "ERROR", code: "INVALID_DIRECTION", message: "Direction is not recognized.", line: record.line });
    if (!actorRole) issues.push({ severity: "ERROR", code: "INVALID_ACTOR_ROLE", message: "Actor role is not recognized.", line: record.line });
    if (!occurredAt || !channel || !direction || !actorRole) continue;

    const phone = normalizePhone(row.contact_phone ?? "");
    if (row.contact_phone && !phone) {
      issues.push({ severity: "ERROR", code: "INVALID_PHONE", message: "Contact phone cannot be normalized safely.", line: record.line });
      continue;
    }
    if (phone) {
      const phoneKey = phone.replace(/^\+/, "");
      const owner = phoneOwners.get(phoneKey);
      if (owner && owner !== row.lead_id) {
        issues.push({ severity: "ERROR", code: "IDENTITY_COLLISION", message: "One normalized phone maps to multiple lead IDs.", line: record.line });
        continue;
      }
      phoneOwners.set(phoneKey, row.lead_id ?? "");
    }

    const metadata = Object.fromEntries(
      headers
        .filter((header) => header.startsWith("meta_") && row[header])
        .map((header) => [header.slice(5), row[header] ?? ""]),
    );
    const event: NormalizedSalesEvent = {
      organizationId: context.organizationId.trim(),
      salesFloorId: context.salesFloorId.trim(),
      leadId: row.lead_id ?? "",
      actorId: row.actor_id ?? "",
      actorRole,
      eventId: row.event_id ?? "",
      occurredAt,
      channel,
      eventType: (row.event_type ?? "").toUpperCase(),
      direction,
      sourceRef: row.source_ref || `crm:${context.sourceId}:row:${record.line}`,
      textOrSummary: row.text_or_summary ?? "",
      crmStage: row.crm_stage || undefined,
      metadata,
    };
    const fingerprint = JSON.stringify({ ...event, sourceRef: row.source_ref || "generated" });
    const existingFingerprint = eventFingerprints.get(event.eventId);
    if (existingFingerprint) {
      if (existingFingerprint !== fingerprint) {
        issues.push({ severity: "ERROR", code: "EVENT_ID_COLLISION", message: "The same event ID carries conflicting content.", line: record.line });
      } else {
        duplicateCount += 1;
        issues.push({ severity: "WARNING", code: "DUPLICATE_RECORD", message: "Exact duplicate CSV event was ignored.", line: record.line });
      }
      continue;
    }
    eventFingerprints.set(event.eventId, fingerprint);
    if (previousOccurredAt && occurredAt < previousOccurredAt) outOfOrder = true;
    previousOccurredAt = occurredAt;
    events.push(event);

    const realEstate = Object.fromEntries(
      Object.entries(REAL_ESTATE_COLUMNS)
        .filter(([column]) => row[column])
        .map(([column, field]) => [field, row[column]]),
    ) as RealEstateEventContext;
    if (Object.keys(realEstate).length > 0) realEstateByEventId[event.eventId] = realEstate;
  }

  if (outOfOrder) issues.push({ severity: "WARNING", code: "OUT_OF_ORDER", message: "Events were sorted into chronological order." });
  if (hasErrors(issues)) return rejected(issues, sourceRecordCount, duplicateCount);
  events.sort(compareEvents);
  return { status: "ACCEPTED", events, realEstateByEventId, issues, sourceRecordCount, duplicateCount };
}

function parseCsvRecords(input: string): { records: CsvRecord[]; issues: ImportIssue[] } {
  const records: CsvRecord[] = [];
  const issues: ImportIssue[] = [];
  const row: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index += 1; continue; }
      if (char === '"') { quoted = false; continue; }
      field += char;
      if (char === "\n") line += 1;
      continue;
    }
    if (char === '"' && field.length === 0) { quoted = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\r" && next === "\n") continue;
    if (char === "\n" || char === "\r") {
      row.push(field);
      records.push({ values: [...row], line: recordLine });
      row.length = 0;
      field = "";
      line += 1;
      recordLine = line;
      continue;
    }
    field += char;
  }
  if (quoted) issues.push({ severity: "ERROR", code: "UNCLOSED_QUOTE", message: "CSV contains an unclosed quoted field.", line: recordLine });
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push({ values: [...row], line: recordLine });
  }
  if (records[0]?.values[0]) records[0].values[0] = records[0].values[0].replace(/^\uFEFF/, "");
  return { records, issues };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function hasErrors(issues: ImportIssue[]): boolean {
  return issues.some((issue) => issue.severity === "ERROR");
}

function rejected(issues: ImportIssue[], sourceRecordCount: number, duplicateCount = 0): ImportResult {
  return { status: "REJECTED", events: [], realEstateByEventId: {}, issues, sourceRecordCount, duplicateCount };
}

function compareEvents(a: NormalizedSalesEvent, b: NormalizedSalesEvent): number {
  return a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId);
}
