import { localPartsToIso, normalizeIdentity, parseOffsetMinutes, requiredContextIssues, stableHash } from "./normalization";
import type { ImportIssue, ImportResult, NormalizedSalesEvent, WhatsappImportOptions, WhatsappParticipant } from "./types";

const MESSAGE_HEADER = /^\[?(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\]?\s+-\s+([^:]+):\s?(.*)$/;
const MAX_INPUT_CHARACTERS = 5_000_000;

interface PendingMessage { line: number; dateParts: RegExpExecArray; sender: string; text: string }

export function parseWhatsappExport(input: string, options: WhatsappImportOptions): ImportResult {
  const issues = requiredContextIssues(options);
  if (input.length > MAX_INPUT_CHARACTERS) {
    issues.push({ severity: "ERROR", code: "INPUT_TOO_LARGE", message: "WhatsApp input exceeds the 5 MB preview limit." });
    return rejected(issues, 0);
  }
  if (options.participants.length === 0) issues.push({ severity: "ERROR", code: "MISSING_PARTICIPANTS", message: "At least one explicit participant mapping is required." });
  const participantMap = buildParticipantMap(options.participants, issues);
  const offsetMinutes = parseOffsetMinutes(options.defaultTimezoneOffset);
  if (issues.some((issue) => issue.severity === "ERROR") || offsetMinutes === null) return rejected(issues, 0);

  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const pending: PendingMessage[] = [];
  let current: PendingMessage | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";
    const match = MESSAGE_HEADER.exec(line.replace(/[\u200e\u200f]/g, ""));
    if (match) {
      if (current) pending.push(current);
      current = { line: lineNumber, dateParts: match, sender: match[8]?.trim() ?? "", text: match[9] ?? "" };
      continue;
    }
    if (!current) {
      if (!line.trim()) continue;
      issues.push({ severity: "ERROR", code: "MALFORMED_RECORD", message: "Text appears before the first valid WhatsApp message header.", line: lineNumber });
      continue;
    }
    if (index !== lines.length - 1 || line.length > 0) current.text += `\n${line}`;
  }
  if (current) pending.push(current);
  if (pending.length === 0) issues.push({ severity: "ERROR", code: "EMPTY_INPUT", message: "No WhatsApp messages were recognized." });

  const events: NormalizedSalesEvent[] = [];
  const fingerprints = new Set<string>();
  let duplicateCount = 0;
  let previousOccurredAt: string | null = null;
  let outOfOrder = false;

  for (const message of pending) {
    const participant = participantMap.get(normalizeIdentity(message.sender));
    if (!participant) {
      issues.push({ severity: "ERROR", code: "UNKNOWN_PARTICIPANT", message: "Sender has no explicit identity mapping.", line: message.line });
      continue;
    }
    const occurredAt = whatsappTimestamp(message.dateParts, options.dateOrder, offsetMinutes);
    if (!occurredAt) {
      issues.push({ severity: "ERROR", code: "INVALID_TIMESTAMP", message: "WhatsApp timestamp is malformed or ambiguous.", line: message.line });
      continue;
    }
    if (!message.text.trim()) {
      issues.push({ severity: "WARNING", code: "BLANK_MESSAGE", message: "Blank WhatsApp message was ignored.", line: message.line });
      continue;
    }
    const fingerprint = [occurredAt, participant.actorId, participant.leadId, message.text].join("\u001f");
    if (fingerprints.has(fingerprint)) {
      duplicateCount += 1;
      issues.push({ severity: "WARNING", code: "DUPLICATE_RECORD", message: "Exact duplicate WhatsApp message was ignored.", line: message.line });
      continue;
    }
    fingerprints.add(fingerprint);
    const hash = stableHash(fingerprint);
    const event: NormalizedSalesEvent = {
      organizationId: options.organizationId.trim(),
      salesFloorId: options.salesFloorId.trim(),
      leadId: participant.leadId,
      actorId: participant.actorId,
      actorRole: participant.actorRole,
      eventId: `wa-${hash}`,
      occurredAt,
      channel: "WHATSAPP",
      eventType: "MESSAGE",
      direction: participant.direction,
      sourceRef: `whatsapp:${options.sourceId}:message:${hash}`,
      textOrSummary: message.text,
      metadata: {},
    };
    if (previousOccurredAt && occurredAt < previousOccurredAt) outOfOrder = true;
    previousOccurredAt = occurredAt;
    events.push(event);
  }

  if (outOfOrder) issues.push({ severity: "WARNING", code: "OUT_OF_ORDER", message: "Messages were sorted into chronological order." });
  if (issues.some((issue) => issue.severity === "ERROR")) return rejected(issues, pending.length, duplicateCount);
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.eventId.localeCompare(b.eventId));
  return { status: "ACCEPTED", events, realEstateByEventId: {}, issues, sourceRecordCount: pending.length, duplicateCount };
}

function buildParticipantMap(participants: WhatsappParticipant[], issues: ImportIssue[]): Map<string, WhatsappParticipant> {
  const map = new Map<string, WhatsappParticipant>();
  for (const participant of participants) {
    if (!participant.actorId.trim() || !participant.leadId.trim() || participant.aliases.length === 0) {
      issues.push({ severity: "ERROR", code: "INVALID_PARTICIPANT", message: "Each participant needs an actor ID, lead ID, and at least one alias." });
      continue;
    }
    for (const alias of participant.aliases) {
      const key = normalizeIdentity(alias);
      const existing = map.get(key);
      if (existing && (existing.actorId !== participant.actorId || existing.leadId !== participant.leadId)) {
        issues.push({ severity: "ERROR", code: "IDENTITY_COLLISION", message: "One normalized WhatsApp alias maps to multiple identities." });
        continue;
      }
      map.set(key, participant);
    }
  }
  return map;
}

function whatsappTimestamp(parts: RegExpExecArray, dateOrder: "DMY" | "MDY", offsetMinutes: number): string | null {
  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const rawYear = Number(parts[3]);
  let hour = Number(parts[4]);
  const minute = Number(parts[5]);
  const secondValue = Number(parts[6] ?? "0");
  const meridiem = parts[7]?.toUpperCase();
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "PM") hour += 12;
  }
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = dateOrder === "DMY" ? second : first;
  const day = dateOrder === "DMY" ? first : second;
  return localPartsToIso(year, month, day, hour, minute, secondValue, offsetMinutes);
}

function rejected(issues: ImportIssue[], sourceRecordCount: number, duplicateCount = 0): ImportResult {
  return { status: "REJECTED", events: [], realEstateByEventId: {}, issues, sourceRecordCount, duplicateCount };
}
