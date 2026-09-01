import { buildDecisionSequence } from "@/lib/decisionEngine";
import type { NormalizedSalesEvent } from "@/lib/realInput";
import type { LeadLossCase, ReportRestraintObservation } from "./types";

const source = (caseId: string, sourceType: "CRM_CSV" | "WHATSAPP_EXPORT") => ({
  sourceRef: `synthetic:${caseId}:${sourceType.toLowerCase()}`,
  sourceType,
});

function event(
  leadId: string,
  eventId: string,
  occurredAt: string,
  eventType: string,
  actorRole: NormalizedSalesEvent["actorRole"],
  direction: NormalizedSalesEvent["direction"],
  textOrSummary: string,
  channel: NormalizedSalesEvent["channel"] = "WHATSAPP",
  crmStage?: string,
): NormalizedSalesEvent {
  return {
    organizationId: "org-synthetic",
    salesFloorId: "floor-synthetic",
    leadId,
    actorId: `${actorRole.toLowerCase()}-synthetic`,
    actorRole,
    eventId,
    occurredAt,
    channel,
    eventType,
    direction,
    sourceRef: `synthetic:${eventId}`,
    textOrSummary,
    crmStage,
    metadata: {},
  };
}

function received(leadId: string, eventId: string, occurredAt: string): NormalizedSalesEvent {
  return event(leadId, eventId, occurredAt, "LEAD_RECEIVED", "SYSTEM", "INTERNAL", "Synthetic lead received.", "CRM", "New");
}

function rep(leadId: string, eventId: string, occurredAt: string): NormalizedSalesEvent {
  return event(leadId, eventId, occurredAt, "MESSAGE", "REP", "OUTBOUND", "Synthetic rep response.");
}

function buyer(leadId: string, eventId: string, occurredAt: string, eventType: string, text: string): NormalizedSalesEvent {
  return event(leadId, eventId, occurredAt, eventType, "BUYER", "INBOUND", text);
}

function leadCase({
  caseId,
  leadId,
  buyerAlias,
  opportunityId,
  events,
  assignedRepId = "rep-assigned-synthetic",
  freshness = "CURRENT",
  restraintObservation,
  managerReviewHistory = [],
}: {
  caseId: string;
  leadId: string;
  buyerAlias: string;
  opportunityId: string;
  events: NormalizedSalesEvent[];
  assignedRepId?: string | null;
  freshness?: "CURRENT" | "STALE";
  restraintObservation?: ReportRestraintObservation;
  managerReviewHistory?: LeadLossCase["managerReviewHistory"];
}): LeadLossCase {
  return {
    caseId,
    leadId,
    buyerAlias,
    opportunityId,
    assignedRepId: assignedRepId ?? undefined,
    events,
    decision: buildDecisionSequence(events),
    freshness: {
      state: freshness,
      observedThrough: events.filter((item) => !Number.isNaN(Date.parse(item.occurredAt))).map((item) => item.occurredAt).sort().at(-1) ?? "UNAVAILABLE",
      reason: freshness === "STALE" ? "No source event was observed inside the report freshness threshold." : undefined,
    },
    sources: [source(caseId, "CRM_CSV"), source(caseId, "WHATSAPP_EXPORT")],
    restraintObservation: restraintObservation ? {
      state: restraintObservation,
      window: "2026-08-24T08:00:00.000Z/2026-08-31T18:00:00.000Z",
      sourceRefs: [`synthetic:${caseId}:observation`],
    } : undefined,
    managerReviewHistory,
  };
}

const cases: LeadLossCase[] = [
  leadCase({
    caseId: "report-farah",
    leadId: "lead-farah-synthetic",
    buyerAlias: "F. Al-Sayed",
    opportunityId: "opp-farah",
    events: [
      received("lead-farah-synthetic", "farah-received", "2026-08-24T08:00:00.000Z"),
      buyer("lead-farah-synthetic", "farah-pause", "2026-08-24T08:05:00.000Z", "BUYER_EXPLICIT_PAUSE", "Please do not contact me until next month."),
    ],
    restraintObservation: "RESTRAINT_RESPECTED",
  }),
  leadCase({
    caseId: "report-tariq",
    leadId: "lead-tariq-synthetic",
    buyerAlias: "T. Nour",
    opportunityId: "opp-tariq",
    events: [
      received("lead-tariq-synthetic", "tariq-received", "2026-08-24T09:00:00.000Z"),
      buyer("lead-tariq-synthetic", "tariq-pause", "2026-08-24T09:05:00.000Z", "BUYER_EXPLICIT_PAUSE", "Not now. Wait until I come back."),
      rep("lead-tariq-synthetic", "tariq-response", "2026-08-24T09:20:00.000Z"),
    ],
    restraintObservation: "CHASING_VIOLATION",
    managerReviewHistory: [{
      reviewId: "review-tariq-001",
      snapshotId: "decision-report-tariq",
      occurredAt: "2026-08-25T10:00:00.000Z",
      state: "VALIDATED",
      summaryCode: "OBSERVABLE_SEQUENCE_ONLY",
    }],
  }),
  leadCase({
    caseId: "report-ahmed",
    leadId: "lead-ahmed-synthetic",
    buyerAlias: "A. Hassan",
    opportunityId: "opp-ahmed",
    events: [
      received("lead-ahmed-synthetic", "ahmed-received", "2026-08-25T08:00:00.000Z"),
      rep("lead-ahmed-synthetic", "ahmed-response", "2026-08-25T08:10:00.000Z"),
      buyer("lead-ahmed-synthetic", "ahmed-request", "2026-08-25T09:00:00.000Z", "BUYER_REQUEST", "Please send the unit details."),
    ],
  }),
  leadCase({
    caseId: "report-omar",
    leadId: "lead-omar-synthetic",
    buyerAlias: "O. Zaki",
    opportunityId: "opp-omar",
    events: [
      received("lead-omar-synthetic", "omar-received", "2026-08-26T08:00:00.000Z"),
      rep("lead-omar-synthetic", "omar-response", "2026-08-26T10:00:00.000Z"),
    ],
  }),
  leadCase({
    caseId: "report-layla",
    leadId: "lead-layla-synthetic",
    buyerAlias: "L. Fahmy",
    opportunityId: "opp-layla",
    events: [
      received("lead-layla-synthetic", "layla-received", "2026-08-27T08:00:00.000Z"),
      { ...rep("lead-layla-synthetic", "layla-response", "2026-08-27T08:30:00.000Z"), channel: "CRM", crmStage: "Closed Lost" },
      buyer("lead-layla-synthetic", "layla-request", "2026-08-27T09:00:00.000Z", "BUYER_REQUEST", "Please send the proposal for review."),
    ],
    managerReviewHistory: [{
      reviewId: "review-layla-001",
      snapshotId: "decision-report-layla",
      occurredAt: "2026-08-28T10:00:00.000Z",
      state: "PENDING_VALIDATION",
      summaryCode: "SOURCE_CORRECTION_PENDING",
    }],
  }),
  leadCase({
    caseId: "report-yasmin",
    leadId: "lead-yasmin-synthetic",
    buyerAlias: "Y. Adel",
    opportunityId: "opp-yasmin",
    assignedRepId: null,
    events: [
      received("lead-yasmin-synthetic", "yasmin-received", "2026-08-28T08:00:00.000Z"),
      rep("lead-yasmin-synthetic", "yasmin-response", "2026-08-28T08:45:00.000Z"),
      buyer("lead-yasmin-synthetic", "yasmin-request", "2026-08-28T09:00:00.000Z", "BUYER_REQUEST", "Can you share the payment plan?"),
    ],
  }),
  leadCase({
    caseId: "report-mahmoud",
    leadId: "lead-mahmoud-synthetic",
    buyerAlias: "محمود عبد الله",
    opportunityId: "opp-mahmoud",
    freshness: "STALE",
    events: [
      received("lead-mahmoud-synthetic", "mahmoud-received", "2026-08-29T08:00:00.000Z"),
      rep("lead-mahmoud-synthetic", "mahmoud-response", "2026-08-29T08:15:00.000Z"),
      buyer("lead-mahmoud-synthetic", "mahmoud-request", "2026-08-29T09:00:00.000Z", "BUYER_REQUEST", "ممكن تبعت تفاصيل الوحدة وخطة السداد؟"),
    ],
  }),
  leadCase({
    caseId: "report-sara",
    leadId: "lead-sara-synthetic",
    buyerAlias: "S. Hamdy",
    opportunityId: "opp-sara",
    assignedRepId: null,
    events: [
      received("lead-sara-synthetic", "sara-received", "2026-08-30T08:00:00.000Z"),
      buyer("lead-sara-synthetic", "sara-pause", "2026-08-30T08:05:00.000Z", "BUYER_EXPLICIT_PAUSE", "Pause contact until I return."),
    ],
    restraintObservation: "NOT_OBSERVABLE",
  }),
  leadCase({
    caseId: "report-invalid",
    leadId: "lead-invalid-synthetic",
    buyerAlias: "Excluded synthetic row",
    opportunityId: "opp-farah",
    events: [
      received("lead-invalid-synthetic", "invalid-received", "ambiguous-time"),
      buyer("lead-invalid-synthetic", "invalid-request", "2026-08-31T09:00:00.000Z", "BUYER_REQUEST", "Please send details."),
    ],
  }),
];

export const LEAD_LOSS_REPORT_CASES = deepFreeze(cases);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}
