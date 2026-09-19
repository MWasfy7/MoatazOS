import type { DecisionSequence, DeterministicDecisionSnapshot } from "@/lib/decisionEngine";
import type { LeadLossReport } from "@/lib/leadLossReport";
import type { NormalizedSalesEvent } from "@/lib/realInput";

export type QueueSection = "ACT_NOW" | "COMMITMENTS_DUE" | "REVIEW" | "WAIT_PROTECTED" | "AT_RISK_NEGLECT";
export type Recommendation = "ACT" | "WAIT" | "REVIEW";
export type QueueReasonCode =
  | "CURRENT_BUYER_SIGNAL"
  | "OVERDUE_SELLER_COMMITMENT"
  | "ACTIVE_BUYER_PAUSE"
  | "ACTIVE_BUYER_PAUSE_WITH_OVERDUE_COMMITMENT"
  | "CONTRADICTORY_EVIDENCE"
  | "AGING_EVIDENCE_GAP"
  | "INSUFFICIENT_EVIDENCE"
  | "STALE_BUYER_SIGNAL"
  | "STALE_SELLER_COMMITMENT"
  | "FUTURE_EVIDENCE_EXCLUDED";

export interface EvidenceExclusion {
  sourceRef: string;
  reason: "FUTURE_TIMESTAMP";
}

export interface EvidenceContract {
  recommendation: Recommendation;
  primaryEvidence: readonly string[];
  provenance: readonly string[];
  freshness: "CURRENT" | "STALE" | "UNKNOWN";
  contradictions: readonly string[];
  missingInformation: readonly string[];
  uncertainty: readonly string[];
  governingPolicy: string;
  reevaluationConditions: readonly string[];
  excludedEvidence: readonly EvidenceExclusion[];
}

export interface OperatorOpportunity {
  opportunityId: string;
  displayLabel: string;
  value?: { amount: number; currency: "EGP" | "AED" | "SAR" | "USD" };
  events: readonly NormalizedSalesEvent[];
  decision: DecisionSequence;
}

export interface CommandQueueItem {
  queueItemId: string;
  opportunityId: string;
  displayLabel: string;
  section: QueueSection;
  priority: number;
  whyHere: string;
  whyNow: string;
  whatChanged: string;
  recommendation: string;
  ignoreRisk: string;
  reevaluateWhen: readonly string[];
  evidenceContract: EvidenceContract;
  reasonCode: QueueReasonCode;
  explanations: Record<"en" | "ar", QueueExplanation>;
}

export interface QueueExplanation {
  whyHere: string;
  whyNow: string;
  recommendation: string;
  ignoreRisk: string;
}

export type CaptureKind =
  | "CLIENT_CALLED" | "CLIENT_REPLIED" | "MEETING_HAPPENED" | "CLIENT_REQUESTED_OPTIONS"
  | "CLIENT_POSTPONED" | "BUDGET_CLARIFIED" | "PARTNER_APPROVAL_REQUIRED" | "PROMISED_FOLLOWUP"
  | "SELLER_COMMITMENT" | "OBJECTION" | "EXPLICIT_REJECTION" | "NEW_TIMELINE"
  | "MEETING_SCHEDULED" | "EOI" | "RESERVATION" | "OPERATOR_NOTE";

export interface QuickCaptureInput {
  opportunityId: string;
  kind: CaptureKind;
  occurredAt: string;
  operatorId: string;
  note?: string;
}

export interface OverrideRecord {
  overrideId: string;
  opportunityId: string;
  snapshotId: string;
  salesosRecommendation: Recommendation;
  evidenceContract: EvidenceContract;
  operatorDecision: "ACT" | "WAIT" | "REVIEW";
  overrideReason: string;
  intendedAction: string;
  occurredAt: string;
  policyVersion: string;
}

export type ObservationOutcome = "PROGRESSION_OBSERVED" | "DETERIORATION_OBSERVED" | "NO_MEANINGFUL_CHANGE" | "INSUFFICIENT_OBSERVATION" | "UNRESOLVED";

export interface PostDecisionObservation {
  observationId: string;
  overrideId: string;
  occurredAt: string;
  outcome: ObservationOutcome;
  sourceRef: string;
  note?: string;
  causalConclusion: "NOT_ESTABLISHED";
}

export type PatternMaturity = "OBSERVED_PATTERN" | "HYPOTHESIS" | "EXPERIMENT_CANDIDATE" | "VALIDATED_EXPERIMENT";

export interface OperatorPattern {
  patternId: string;
  title: string;
  maturity: PatternMaturity;
  sampleSize: number;
  evidenceRefs: readonly string[];
  limitation: string;
}

export type DoctrineStatus = "ACTIVE" | "UNDER_CHALLENGE" | "EXPERIMENT" | "RETIRED";

export interface DoctrineItem {
  doctrineId: string;
  title: string;
  description: string;
  version: string;
  status: DoctrineStatus;
  evidenceRequirement: string;
  rationale: string;
  source: string;
  scope: "SALESOS_CORE" | "TEAM" | "OPERATOR";
  createdAt: string;
  changedAt: string;
}

export interface ExperimentCandidate {
  experimentId: string;
  observedPattern: string;
  currentDoctrineId: string;
  possibleContradiction: string;
  relevantSample: number;
  evidenceLimitations: string;
  proposedExperiment: string;
  successCriterion: string;
  failureCriterion: string;
  minimumObservation: number;
  status: "CANDIDATE" | "APPROVED" | "COMPLETED";
}

export interface MetricValue {
  numerator: number;
  denominator: number;
  value: number | null;
  statement: string;
}

export interface PerformanceLedger {
  decisionDiscipline: Record<string, MetricValue>;
  pipelineProgression: Record<string, MetricValue>;
  commercialOutcomes: Record<string, MetricValue>;
  learning: Record<string, MetricValue>;
  causalBoundary: "DESCRIPTIVE_ASSOCIATION_ONLY";
}

export interface OperatorProfile {
  operatorId: string;
  profileVersion: "operator-profile-v0";
  boundary: "EVIDENCE_BACKED_OPERATING_PATTERNS_NOT_PERSONALITY";
  patterns: readonly OperatorPattern[];
  measures: {
    nextStepSecuredRate: MetricValue;
    strongSignalResponseLatency: MetricValue;
    commitmentCompletion: MetricValue;
    observableChasing: MetricValue;
    unresolvedOpportunities: MetricValue;
    overrideFrequency: MetricValue;
    qualificationCompleteness: MetricValue;
    stageProgression: MetricValue;
    concessionBehavior: MetricValue;
  };
}

export interface BaselinePeriod {
  status: "OBSERVATION_PERIOD" | "COMPLETE";
  startedAt: string;
  minimumDays: 7;
  observedDays: number;
  comparisonLanguage: "ASSOCIATED_IMPROVEMENT_OBSERVED";
}

export type TrialSignalKind =
  | "QUEUE_OPENED"
  | "RECOMMENDATION_ACCEPTED"
  | "RECOMMENDATION_OVERRIDDEN"
  | "QUICK_CAPTURE"
  | "INCORRECT_PRIORITY"
  | "FALSE_URGENCY"
  | "MISSED_IMPORTANT_OPPORTUNITY"
  | "NO_ACTION_USEFUL"
  | "MISSED_COMMITMENT"
  | "WORKFLOW_ABANDONED"
  | "FEATURE_IGNORED";

export interface TrialSignal {
  signalId: string;
  kind: TrialSignalKind;
  occurredAt: string;
  opportunityId?: string;
  note?: string;
  sourceClassification: "OPERATOR_TRIAL_OBSERVATION";
}

export interface OperatorSession {
  sessionId: string;
  operatorId: string;
  generatedAt: string;
  opportunities: readonly OperatorOpportunity[];
  queue: readonly CommandQueueItem[];
  overrides: readonly OverrideRecord[];
  observations: readonly PostDecisionObservation[];
  patterns: readonly OperatorPattern[];
  doctrine: readonly DoctrineItem[];
  experiments: readonly ExperimentCandidate[];
  performance: PerformanceLedger;
  operatorProfile: OperatorProfile;
  baseline: BaselinePeriod;
  trialSignals: readonly TrialSignal[];
  leadLossReport?: LeadLossReport;
}

export interface SanitizedOperatorExport {
  schemaVersion: "salesos-operator-export-v1";
  runId: string;
  timestamp: string;
  policyVersions: readonly string[];
  extractorVersions: readonly string[];
  commandQueueSummary: Record<QueueSection, number>;
  decisionDiscipline: Record<string, MetricValue>;
  leadLossSummary?: Record<string, { numerator: number; denominator: number }>;
  unresolvedContradictions: number;
  trialSummary: Record<TrialSignalKind, number>;
  limitations: readonly string[];
  insufficientEvidence: readonly string[];
}

export function snapshotRecommendation(snapshot: DeterministicDecisionSnapshot): Recommendation {
  if (snapshot.decisionState === "NEXT_STEP_READY") return "ACT";
  if (snapshot.decisionState === "NO_ACTION") return "WAIT";
  return "REVIEW";
}
