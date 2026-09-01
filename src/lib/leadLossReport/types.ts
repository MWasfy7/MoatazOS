import type { DecisionSequence } from "@/lib/decisionEngine";
import type { NormalizedSalesEvent } from "@/lib/realInput";
import type { DecisionState } from "@/lib/types";

export type ReportFreshnessState = "CURRENT" | "STALE";
export type ReportRestraintObservation = "RESTRAINT_RESPECTED" | "CHASING_VIOLATION" | "NOT_OBSERVABLE" | "PENDING";

export interface ReportSource {
  sourceRef: string;
  sourceType: "CRM_CSV" | "WHATSAPP_EXPORT";
}

export interface ReportFreshness {
  state: ReportFreshnessState;
  observedThrough: string;
  reason?: string;
}

export interface ReportManagerReview {
  reviewId: string;
  snapshotId: string;
  occurredAt: string;
  state: "COMMENTARY_ONLY" | "PENDING_VALIDATION" | "VALIDATED" | "REJECTED";
  summaryCode: "OBSERVABLE_SEQUENCE_ONLY" | "SOURCE_CORRECTION_PENDING";
}

export interface LeadLossCase {
  caseId: string;
  leadId: string;
  buyerAlias: string;
  opportunityId: string;
  assignedRepId?: string;
  events: readonly NormalizedSalesEvent[];
  decision: DecisionSequence;
  freshness: ReportFreshness;
  sources: readonly ReportSource[];
  restraintObservation?: {
    state: ReportRestraintObservation;
    window: string;
    sourceRefs: readonly string[];
  };
  managerReviewHistory: readonly ReportManagerReview[];
}

export interface MetricExclusion {
  caseId: string;
  reason: "INVALID_RECEIVED_EVENT" | "NO_OBSERVABLE_REP_RESPONSE" | "RESTRAINT_NOT_OBSERVABLE" | "RESTRAINT_PENDING";
}

export interface ReportMetric {
  numerator: number;
  denominator: number;
  exclusions: readonly MetricExclusion[];
}

export interface FirstResponseMetric extends ReportMetric {
  averageMinutes: number | null;
}

export interface LeadReportRow {
  caseId: string;
  leadId: string;
  buyerAlias: string;
  opportunityId: string;
  decisionState: DecisionState;
  freshness: ReportFreshness;
  assignedRepId?: string;
  sourceRefs: readonly string[];
  firstResponseMinutes: number | null;
  managerReviewHistory: readonly ReportManagerReview[];
}

export interface LeadLossReport {
  reportId: string;
  generatedAt: string;
  observationWindow: { start: string; end: string };
  sources: readonly ReportSource[];
  leadsReceived: ReportMetric;
  untouchedLeads: ReportMetric;
  timeToFirstResponse: FirstResponseMetric;
  decisionDistribution: Readonly<Record<DecisionState, ReportMetric>>;
  staleOrUnresolved: ReportMetric;
  noAction: ReportMetric;
  restraintRespected: ReportMetric;
  chasingViolations: ReportMetric;
  contradictoryEvidence: ReportMetric;
  repOwnershipGaps: ReportMetric;
  leads: readonly LeadReportRow[];
}
