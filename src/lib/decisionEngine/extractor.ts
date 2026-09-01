import type { NormalizedSalesEvent } from "@/lib/realInput";
import { maskPii, stableHash } from "@/lib/realInput";
import type { EvidenceSignal, EvidenceSignalType, ExtractionResult, SignalConfidence } from "./types";

export const EXTRACTOR_VERSION = "salesos-evidence-v0.1.0";
const MAX_EXCERPT = 160;

const LEXICON: Partial<Record<EvidenceSignalType, string[]>> = {
  BUYER_REQUEST: ["please send", "send me", "can you share", "i need", "أرسل", "ارسل", "ممكن تبعت", "محتاج", "أحتاج"],
  BUYER_EXPLICIT_PAUSE: ["not now", "pause", "wait until", "do not contact", "stop contacting", "later this month", "مش دلوقتي", "توقف", "استنى", "انتظر", "لا تتواصل"],
  TIMING_SIGNAL: ["next month", "next quarter", "this week", "tomorrow", "الشهر القادم", "الأسبوع القادم", "غداً", "بكرة"],
  BUDGET_SIGNAL: ["budget", "afford", "egp", "aed", "sar", "ميزانية", "مليون", "جنيه", "درهم", "ريال"],
  PROPERTY_REQUIREMENT: ["bedroom", "unit", "villa", "apartment", "location", "غرفة", "وحدة", "فيلا", "شقة", "منطقة"],
  OBJECTION: ["too expensive", "concern", "not convinced", "غالي", "مشكلة", "غير مقتنع"],
  BUYER_INITIATED_REENGAGEMENT: ["following up", "back to this", "ready to continue", "رجعت", "نكمل", "جاهز نكمل"],
  PROMISED_FOLLOWUP: ["i will follow up", "will send", "سأتابع", "هبعت", "سأرسل"],
  PROCUREMENT_SIGNAL: ["procurement", "contract review", "legal review", "security review", "المشتريات", "العقد", "مراجعة قانونية"],
};

const EVENT_TYPE_HINTS: Partial<Record<string, EvidenceSignalType>> = {
  BUYER_REQUEST: "BUYER_REQUEST",
  BUYER_EXPLICIT_PAUSE: "BUYER_EXPLICIT_PAUSE",
  TIMING_SIGNAL: "TIMING_SIGNAL",
  BUDGET_SIGNAL: "BUDGET_SIGNAL",
  PROPERTY_REQUIREMENT: "PROPERTY_REQUIREMENT",
  OBJECTION: "OBJECTION",
  BUYER_REENGAGEMENT: "BUYER_INITIATED_REENGAGEMENT",
  PROCUREMENT_SIGNAL: "PROCUREMENT_SIGNAL",
  PROMISED_FOLLOWUP: "PROMISED_FOLLOWUP",
};

export function extractEvidence(events: readonly NormalizedSalesEvent[]): ExtractionResult {
  const signals: EvidenceSignal[] = [];
  let rejectedEventCount = 0;

  events.forEach((event, index) => {
    const validationError = validateEvent(event);
    if (validationError) {
      rejectedEventCount += 1;
      signals.push(createSignal({
        type: "UNKNOWN",
        event,
        index,
        confidence: "LOW",
        uncertaintyReason: "The source event could not be interpreted safely.",
        rejectionReason: validationError,
      }));
      return;
    }

    const eventSignals: EvidenceSignal[] = [];
    const hintedType = EVENT_TYPE_HINTS[event.eventType.toUpperCase()];
    if (hintedType && actorCanProduce(hintedType, event)) {
      eventSignals.push(createSignal({ type: hintedType, event, index, confidence: "HIGH" }));
    }

    const normalizedText = event.textOrSummary.toLocaleLowerCase();
    for (const [type, terms] of Object.entries(LEXICON) as Array<[EvidenceSignalType, string[]]>) {
      if (!actorCanProduce(type, event) || eventSignals.some((signal) => signal.type === type)) continue;
      if (terms.some((term) => normalizedText.includes(term))) {
        eventSignals.push(createSignal({ type, event, index, confidence: type === "TIMING_SIGNAL" || type === "PROPERTY_REQUIREMENT" ? "MEDIUM" : "HIGH" }));
      }
    }

    if (event.direction === "OUTBOUND" && event.actorRole === "REP") {
      eventSignals.push(createSignal({ type: "REP_CONTACT", event, index, confidence: "HIGH" }));
    }

    if (eventSignals.length === 0) {
      eventSignals.push(createSignal({
        type: "UNKNOWN",
        event,
        index,
        confidence: "LOW",
        uncertaintyReason: "No bounded evidence class matched this event.",
      }));
    }
    signals.push(...deduplicateSignals(eventSignals));
  });

  const contradiction = detectCrmConversationContradiction(events, signals);
  if (contradiction) signals.push(contradiction);
  signals.sort(compareSignals);
  return deepFreeze({ signals, extractorVersion: EXTRACTOR_VERSION, rejectedEventCount });
}

function validateEvent(event: NormalizedSalesEvent): string | null {
  if (!event.eventId?.trim()) return "Missing event identity.";
  if (!event.sourceRef?.trim()) return "Missing source provenance.";
  if (!event.occurredAt || Number.isNaN(Date.parse(event.occurredAt))) return "Invalid event timestamp.";
  if (!event.leadId?.trim() || !event.actorId?.trim()) return "Missing lead or actor identity.";
  return null;
}

function actorCanProduce(type: EvidenceSignalType, event: NormalizedSalesEvent): boolean {
  if (type === "PROMISED_FOLLOWUP") return event.actorRole === "REP" && event.direction === "OUTBOUND";
  if (type === "REP_CONTACT") return event.actorRole === "REP" && event.direction === "OUTBOUND";
  return (event.actorRole === "BUYER" || event.actorRole === "BUYER_DELEGATE") && event.direction === "INBOUND";
}

function createSignal({
  type,
  event,
  index,
  confidence,
  uncertaintyReason,
  rejectionReason,
}: {
  type: EvidenceSignalType;
  event: NormalizedSalesEvent;
  index: number;
  confidence: SignalConfidence;
  uncertaintyReason?: string;
  rejectionReason?: string;
}): EvidenceSignal {
  const excerpt = maskPii(event.textOrSummary).slice(0, MAX_EXCERPT);
  const sourceRef = event.sourceRef?.trim() || `unavailable:${event.eventId || index}`;
  return {
    signalId: `signal-${stableHash([EXTRACTOR_VERSION, type, sourceRef, event.eventId || index].join("|"))}`,
    type,
    sourceRefs: [sourceRef],
    evidencePointer: { eventId: event.eventId || `unavailable-${index}`, excerpt, start: 0, end: excerpt.length },
    confidence,
    extractorVersion: EXTRACTOR_VERSION,
    occurredAt: event.occurredAt || "UNAVAILABLE",
    uncertaintyReason,
    rejectionReason,
  };
}

function detectCrmConversationContradiction(events: readonly NormalizedSalesEvent[], signals: readonly EvidenceSignal[]): EvidenceSignal | null {
  const closedEvent = events.find((event) => /closed[ _-]?lost|rejected|disqualified/i.test(event.crmStage ?? ""));
  const buyerSignal = signals.find((signal) => ["BUYER_REQUEST", "BUYER_INITIATED_REENGAGEMENT", "PROCUREMENT_SIGNAL"].includes(signal.type));
  if (!closedEvent || !buyerSignal || !closedEvent.sourceRef) return null;
  const sourceRefs = [closedEvent.sourceRef, ...buyerSignal.sourceRefs];
  const excerpt = maskPii(closedEvent.textOrSummary).slice(0, MAX_EXCERPT);
  const occurredAt = [closedEvent.occurredAt, buyerSignal.occurredAt].sort().at(-1) ?? closedEvent.occurredAt;
  return {
    signalId: `signal-${stableHash([EXTRACTOR_VERSION, "CONTRADICTION", ...sourceRefs].join("|"))}`,
    type: "CONTRADICTION",
    sourceRefs,
    evidencePointer: { eventId: closedEvent.eventId, excerpt, start: 0, end: excerpt.length },
    confidence: "HIGH",
    extractorVersion: EXTRACTOR_VERSION,
    occurredAt,
    uncertaintyReason: "CRM disposition conflicts with attributable buyer conversation evidence.",
  };
}

function deduplicateSignals(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter((signal, index) => signals.findIndex((candidate) => candidate.type === signal.type) === index);
}

function compareSignals(a: EvidenceSignal, b: EvidenceSignal): number {
  const aTime = Number.isNaN(Date.parse(a.occurredAt)) ? Number.MAX_SAFE_INTEGER : Date.parse(a.occurredAt);
  const bTime = Number.isNaN(Date.parse(b.occurredAt)) ? Number.MAX_SAFE_INTEGER : Date.parse(b.occurredAt);
  return aTime - bTime || a.signalId.localeCompare(b.signalId);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}
