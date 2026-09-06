import { buildDecisionSequence } from "@/lib/decisionEngine";
import type { NormalizedSalesEvent } from "@/lib/realInput";
import type { OperatorOpportunity } from "./types";

const base = {
  organizationId: "org-synthetic-brokerage",
  salesFloorId: "floor-synthetic-mena",
  metadata: { dataset: "EXPLICITLY_SYNTHETIC_BUILD4" },
};

function event(
  leadId: string,
  eventId: string,
  occurredAt: string,
  eventType: string,
  textOrSummary: string,
  actorRole: NormalizedSalesEvent["actorRole"],
  direction: NormalizedSalesEvent["direction"],
  channel: NormalizedSalesEvent["channel"] = "WHATSAPP",
  crmStage?: string,
): NormalizedSalesEvent {
  return {
    ...base, leadId, eventId, occurredAt, eventType, textOrSummary, actorRole, direction, channel, crmStage,
    actorId: actorRole === "BUYER" ? `buyer-${leadId}` : "operator-synthetic",
    sourceRef: `synthetic-build4:${channel.toLowerCase()}:${eventId}`,
  };
}

function received(lead: string, at: string) {
  return event(lead, `${lead}-received`, at, "LEAD_RECEIVED", "Synthetic lead received.", "SYSTEM", "INTERNAL", "CRM");
}

function opportunity(opportunityId: string, displayLabel: string, events: NormalizedSalesEvent[], value?: OperatorOpportunity["value"]): OperatorOpportunity {
  return { opportunityId, displayLabel, value, events, decision: buildDecisionSequence(events) };
}

const strong = [
  received("lead-egypt-strong", "2026-09-04T07:45:00.000Z"),
  event("lead-egypt-strong", "egypt-strong-request", "2026-09-05T06:10:00.000Z", "BUYER_REQUEST", "ممكن تبعتلي خيارات 3 غرف في New Cairo بحدود 8,000,000 EGP؟", "BUYER", "INBOUND"),
];

const protectedPause = [
  received("lead-gcc-pause", "2026-09-01T08:00:00.000Z"),
  event("lead-gcc-pause", "gcc-pause", "2026-09-02T09:00:00.000Z", "BUYER_EXPLICIT_PAUSE", "Please pause contact until I return to Dubai next month.", "BUYER", "INBOUND"),
  event("lead-gcc-pause", "gcc-chase-1", "2026-09-03T09:00:00.000Z", "MESSAGE", "Following up again.", "REP", "OUTBOUND"),
  event("lead-gcc-pause", "gcc-chase-2", "2026-09-04T09:00:00.000Z", "MESSAGE", "Any update?", "REP", "OUTBOUND"),
];

const overdue = [
  received("lead-egypt-commitment", "2026-09-03T08:00:00.000Z"),
  event("lead-egypt-commitment", "commitment-request", "2026-09-03T08:10:00.000Z", "BUYER_REQUEST", "Please send the payment plan.", "BUYER", "INBOUND"),
  { ...event("lead-egypt-commitment", "commitment-due", "2026-09-03T08:15:00.000Z", "PROMISED_FOLLOWUP", "I will send the payment plan by noon tomorrow.", "REP", "OUTBOUND"), metadata: { dataset: "EXPLICITLY_SYNTHETIC_BUILD4", dueAt: "2026-09-04T12:00:00.000Z" } },
];

const contradiction = [
  received("lead-gcc-contradiction", "2026-09-01T08:00:00.000Z"),
  event("lead-gcc-contradiction", "crm-hot", "2026-09-04T07:00:00.000Z", "STAGE_CHANGED", "CRM stage marked HOT.", "REP", "INTERNAL", "CRM", "HOT"),
  event("lead-gcc-contradiction", "crm-closed", "2026-09-04T07:05:00.000Z", "STAGE_CHANGED", "CRM disposition is Closed Lost.", "REP", "INTERNAL", "CRM", "Closed Lost"),
  event("lead-gcc-contradiction", "buyer-postponed", "2026-09-04T08:00:00.000Z", "BUYER_REQUEST", "Purchase postponed for six months; keep the project options for later.", "BUYER", "INBOUND"),
];

const weakSilence = [
  received("lead-egypt-silence", "2026-08-20T08:00:00.000Z"),
  event("lead-egypt-silence", "silence-outbound", "2026-08-20T08:15:00.000Z", "MESSAGE", "Checking whether you saw the brochure.", "REP", "OUTBOUND"),
];

const mixedArabic = [
  received("lead-egypt-mixed", "2026-09-04T10:00:00.000Z"),
  event("lead-egypt-mixed", "mixed-request", "2026-09-05T07:00:00.000Z", "BUYER_REQUEST", "عايز أعرف تفاصيل Palm Hills والمقدم بالجنيه EGP.", "BUYER", "INBOUND"),
];

export const SYNTHETIC_OPERATOR_OPPORTUNITIES: readonly OperatorOpportunity[] = [
  opportunity("opp-egypt-strong", "Synthetic Egypt · New Cairo request", strong, { amount: 8_000_000, currency: "EGP" }),
  opportunity("opp-gcc-protected", "Synthetic GCC · Dubai pause", protectedPause, { amount: 2_000_000, currency: "AED" }),
  opportunity("opp-egypt-overdue", "Synthetic Egypt · Payment-plan commitment", overdue, { amount: 6_500_000, currency: "EGP" }),
  opportunity("opp-gcc-conflict", "Synthetic GCC · CRM/conversation conflict", contradiction, { amount: 1_500_000, currency: "AED" }),
  opportunity("opp-egypt-silence", "Synthetic Egypt · Silence only", weakSilence),
  opportunity("opp-egypt-mixed", "Synthetic Egypt · Palm Hills / EGP", mixedArabic, { amount: 9_200_000, currency: "EGP" }),
] as const;

export const SYNTHETIC_OPERATOR_AS_OF = "2026-09-05T09:00:00.000Z";
