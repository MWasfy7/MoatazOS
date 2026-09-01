import type { NormalizedSalesEvent } from "@/lib/realInput";

const base = {
  organizationId: "org-synthetic",
  salesFloorId: "floor-synthetic",
  leadId: "lead-synthetic",
  channel: "WHATSAPP" as const,
  metadata: {},
};

function buyer(eventId: string, occurredAt: string, eventType: string, textOrSummary: string): NormalizedSalesEvent {
  return { ...base, actorId: "buyer-synthetic", actorRole: "BUYER", eventId, occurredAt, eventType, direction: "INBOUND", sourceRef: `synthetic:${eventId}`, textOrSummary };
}

function rep(eventId: string, occurredAt: string, textOrSummary: string): NormalizedSalesEvent {
  return { ...base, actorId: "rep-synthetic", actorRole: "REP", eventId, occurredAt, eventType: "MESSAGE", direction: "OUTBOUND", sourceRef: `synthetic:${eventId}`, textOrSummary };
}

export const DECISION_ENGINE_FIXTURES = {
  explicitPause: [buyer("pause-001", "2026-08-24T08:00:00.000Z", "BUYER_EXPLICIT_PAUSE", "Please do not contact me until next month.")],
  directRequest: [buyer("request-001", "2026-08-24T08:00:00.000Z", "BUYER_REQUEST", "Please send the unit details.")],
  silence: [rep("rep-001", "2026-08-24T08:00:00.000Z", "Following up on the prior message."), rep("rep-002", "2026-08-25T08:00:00.000Z", "Checking again.")],
  weakEvidence: [buyer("weak-001", "2026-08-24T08:00:00.000Z", "TIMING_SIGNAL", "Maybe next quarter, budget is still unclear.")],
  contradiction: [
    { ...rep("crm-closed-001", "2026-08-24T08:00:00.000Z", "CRM marked closed lost."), channel: "CRM" as const, crmStage: "Closed Lost" },
    buyer("request-after-close-001", "2026-08-24T09:00:00.000Z", "BUYER_REQUEST", "Please send the proposal for review."),
  ],
  reengagementAfterChasing: [
    buyer("pause-002", "2026-08-24T08:00:00.000Z", "BUYER_EXPLICIT_PAUSE", "Not now. Wait until I come back."),
    rep("chase-001", "2026-08-25T08:00:00.000Z", "Following up despite the pause."),
    buyer("reengage-001", "2026-08-28T08:00:00.000Z", "BUYER_REENGAGEMENT", "I am back and ready to continue."),
  ],
  arabicRequest: [buyer("arabic-001", "2026-08-24T08:00:00.000Z", "BUYER_REQUEST", "ممكن تبعت تفاصيل الوحدة وخطة السداد؟")],
  extractorFailure: [{ ...buyer("broken-001", "not-a-timestamp", "MESSAGE", "Unclassified source"), sourceRef: "" }],
} as const satisfies Record<string, readonly NormalizedSalesEvent[]>;

export type DecisionEngineFixtureKey = keyof typeof DECISION_ENGINE_FIXTURES;
