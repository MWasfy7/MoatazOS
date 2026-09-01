import { stableHash } from "@/lib/realInput";
import type { DecisionState } from "@/lib/types";
import type {
  LeadLossCase,
  LeadLossReport,
  LeadReportRow,
  MetricExclusion,
  ReportMetric,
} from "./types";

const DECISION_STATES: readonly DecisionState[] = [
  "NO_ACTION",
  "NEXT_STEP_READY",
  "INSUFFICIENT_EVIDENCE",
  "CONTRADICTORY_EVIDENCE",
];

export function buildLeadLossReport(
  cases: readonly LeadLossCase[],
  generatedAt = "2026-09-01T18:00:00.000Z",
): LeadLossReport {
  const received = cases.flatMap((entry) => {
    const event = entry.events.find((candidate) => candidate.eventType === "LEAD_RECEIVED");
    return event && validTimestamp(event.occurredAt) ? [{ entry, event }] : [];
  });
  const invalidReceivedExclusions: MetricExclusion[] = cases
    .filter((entry) => !received.some((candidate) => candidate.entry.caseId === entry.caseId))
    .map((entry) => ({ caseId: entry.caseId, reason: "INVALID_RECEIVED_EVENT" }));

  const rows: LeadReportRow[] = received.map(({ entry, event }) => ({
    caseId: entry.caseId,
    leadId: entry.leadId,
    buyerAlias: entry.buyerAlias,
    opportunityId: entry.opportunityId,
    decisionState: entry.decision.current.decisionState,
    freshness: entry.freshness,
    assignedRepId: entry.assignedRepId,
    sourceRefs: unique(entry.sources.map((source) => source.sourceRef)),
    firstResponseMinutes: firstResponseMinutes(entry, event.occurredAt),
    managerReviewHistory: entry.managerReviewHistory.map((review) => ({ ...review })),
  }));

  const untouched = rows.filter((row) => row.firstResponseMinutes === null);
  const responseExclusions: MetricExclusion[] = [
    ...invalidReceivedExclusions,
    ...untouched.map((row) => ({ caseId: row.caseId, reason: "NO_OBSERVABLE_REP_RESPONSE" as const })),
  ];
  const responseMinutes = rows.flatMap((row) => row.firstResponseMinutes === null ? [] : [row.firstResponseMinutes]);
  const noActionCases = received.filter(({ entry }) => entry.decision.current.decisionState === "NO_ACTION");
  const observableRestraint = noActionCases.filter(({ entry }) =>
    entry.restraintObservation?.state === "RESTRAINT_RESPECTED" ||
    entry.restraintObservation?.state === "CHASING_VIOLATION",
  );
  const restraintExclusions = noActionCases.reduce<MetricExclusion[]>((exclusions, { entry }) => {
    if (entry.restraintObservation?.state === "NOT_OBSERVABLE" || !entry.restraintObservation) {
      exclusions.push({ caseId: entry.caseId, reason: "RESTRAINT_NOT_OBSERVABLE" });
    }
    if (entry.restraintObservation?.state === "PENDING") {
      exclusions.push({ caseId: entry.caseId, reason: "RESTRAINT_PENDING" });
    }
    return exclusions;
  }, []);
  const reportSources = uniqueBy(
    cases.flatMap((entry) => entry.sources),
    (source) => `${source.sourceType}:${source.sourceRef}`,
  );
  const observedTimes = received.flatMap(({ entry }) =>
    entry.events.filter((event) => validTimestamp(event.occurredAt)).map((event) => event.occurredAt),
  ).sort();

  const metric = (numerator: number, denominator = rows.length, exclusions: readonly MetricExclusion[] = invalidReceivedExclusions): ReportMetric => ({
    numerator,
    denominator,
    exclusions,
  });
  const decisionDistribution = Object.fromEntries(
    DECISION_STATES.map((state) => [state, metric(rows.filter((row) => row.decisionState === state).length)]),
  ) as Record<DecisionState, ReportMetric>;

  const report: LeadLossReport = {
    reportId: `lead-loss-${stableHash(cases.map((entry) => `${entry.caseId}:${entry.decision.current.snapshotId}`).join("|"))}`,
    generatedAt,
    observationWindow: {
      start: observedTimes.at(0) ?? "UNAVAILABLE",
      end: observedTimes.at(-1) ?? "UNAVAILABLE",
    },
    sources: reportSources,
    leadsReceived: metric(received.length, cases.length, invalidReceivedExclusions),
    untouchedLeads: metric(untouched.length),
    timeToFirstResponse: {
      numerator: responseMinutes.reduce((total, minutes) => total + minutes, 0),
      denominator: responseMinutes.length,
      exclusions: responseExclusions,
      averageMinutes: responseMinutes.length > 0
        ? responseMinutes.reduce((total, minutes) => total + minutes, 0) / responseMinutes.length
        : null,
    },
    decisionDistribution,
    staleOrUnresolved: metric(rows.filter((row) =>
      row.freshness.state === "STALE" ||
      row.decisionState === "INSUFFICIENT_EVIDENCE" ||
      row.decisionState === "CONTRADICTORY_EVIDENCE",
    ).length),
    noAction: metric(rows.filter((row) => row.decisionState === "NO_ACTION").length),
    restraintRespected: {
      numerator: observableRestraint.filter(({ entry }) => entry.restraintObservation?.state === "RESTRAINT_RESPECTED").length,
      denominator: observableRestraint.length,
      exclusions: restraintExclusions,
    },
    chasingViolations: {
      numerator: observableRestraint.filter(({ entry }) => entry.restraintObservation?.state === "CHASING_VIOLATION").length,
      denominator: observableRestraint.length,
      exclusions: restraintExclusions,
    },
    contradictoryEvidence: metric(rows.filter((row) => row.decisionState === "CONTRADICTORY_EVIDENCE").length),
    repOwnershipGaps: metric(rows.filter((row) => !row.assignedRepId).length),
    leads: rows,
  };

  return deepFreeze(report);
}

function firstResponseMinutes(entry: LeadLossCase, receivedAt: string): number | null {
  const receivedTime = Date.parse(receivedAt);
  const response = entry.events
    .filter((event) =>
      event.actorRole === "REP" &&
      event.direction === "OUTBOUND" &&
      validTimestamp(event.occurredAt) &&
      Date.parse(event.occurredAt) >= receivedTime,
    )
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0];
  return response ? (Date.parse(response.occurredAt) - receivedTime) / 60_000 : null;
}

function validTimestamp(value: string): boolean {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return values.filter((value, index) => values.findIndex((candidate) => key(candidate) === key(value)) === index);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}
