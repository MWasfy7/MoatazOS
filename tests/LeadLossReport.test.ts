import { describe, expect, it } from "vitest";
import {
  buildLeadLossReport,
  LEAD_LOSS_REPORT_CASES,
  type LeadLossCase,
} from "@/lib/leadLossReport";

const report = buildLeadLossReport(LEAD_LOSS_REPORT_CASES);

describe("S3 Lead Loss Report acceptance", () => {
  it("S3-001 counts only leads with a valid received event", () => {
    expect(report.leadsReceived).toMatchObject({ numerator: 8, denominator: 9 });
    expect(report.leadsReceived.exclusions).toEqual([
      { caseId: "report-invalid", reason: "INVALID_RECEIVED_EVENT" },
    ]);
  });

  it("S3-002 excludes malformed received records from every lead row", () => {
    expect(report.leads).toHaveLength(8);
    expect(report.leads.some((lead) => lead.caseId === "report-invalid")).toBe(false);
  });

  it("S3-003 reports untouched leads against the received-lead denominator", () => {
    expect(report.untouchedLeads).toMatchObject({ numerator: 2, denominator: 8 });
  });

  it("S3-004 calculates time to first response with an exact semantic denominator", () => {
    expect(report.timeToFirstResponse).toMatchObject({
      numerator: 240,
      denominator: 6,
      averageMinutes: 40,
    });
  });

  it("S3-005 discloses every first-response exclusion", () => {
    expect(report.timeToFirstResponse.exclusions).toEqual([
      { caseId: "report-invalid", reason: "INVALID_RECEIVED_EVENT" },
      { caseId: "report-farah", reason: "NO_OBSERVABLE_REP_RESPONSE" },
      { caseId: "report-sara", reason: "NO_OBSERVABLE_REP_RESPONSE" },
    ]);
  });

  it("S3-006 reports all four decision states over the same received population", () => {
    expect(report.decisionDistribution.NO_ACTION).toMatchObject({ numerator: 3, denominator: 8 });
    expect(report.decisionDistribution.NEXT_STEP_READY).toMatchObject({ numerator: 3, denominator: 8 });
    expect(report.decisionDistribution.INSUFFICIENT_EVIDENCE).toMatchObject({ numerator: 1, denominator: 8 });
    expect(report.decisionDistribution.CONTRADICTORY_EVIDENCE).toMatchObject({ numerator: 1, denominator: 8 });
  });

  it("S3-007 keeps the four-state distribution exhaustive", () => {
    const total = Object.values(report.decisionDistribution).reduce((sum, metric) => sum + metric.numerator, 0);
    expect(total).toBe(report.leadsReceived.numerator);
  });

  it("S3-008 includes stale and unresolved leads without double counting", () => {
    expect(report.staleOrUnresolved).toMatchObject({ numerator: 3, denominator: 8 });
  });

  it("S3-009 reports NO_ACTION descriptively over all received leads", () => {
    expect(report.noAction).toMatchObject({ numerator: 3, denominator: 8 });
  });

  it("S3-010 uses only observable NO_ACTION windows for restraint respected", () => {
    expect(report.restraintRespected).toMatchObject({ numerator: 1, denominator: 2 });
  });

  it("S3-011 uses the same observable denominator for chasing violations", () => {
    expect(report.chasingViolations).toMatchObject({ numerator: 1, denominator: 2 });
  });

  it("S3-012 discloses unobservable restraint cases rather than inferring compliance", () => {
    expect(report.restraintRespected.exclusions).toEqual([
      { caseId: "report-sara", reason: "RESTRAINT_NOT_OBSERVABLE" },
    ]);
  });

  it("S3-013 never treats a pending restraint window as observed", () => {
    const pending = cloneCase(LEAD_LOSS_REPORT_CASES.find((entry) => entry.caseId === "report-sara")!);
    pending.restraintObservation = {
      state: "PENDING",
      window: "synthetic-window",
      sourceRefs: ["synthetic:pending"],
    };
    const pendingReport = buildLeadLossReport([
      ...LEAD_LOSS_REPORT_CASES.filter((entry) => entry.caseId !== "report-sara"),
      pending,
    ]);
    expect(pendingReport.restraintRespected.denominator).toBe(2);
    expect(pendingReport.restraintRespected.exclusions.at(-1)).toEqual({
      caseId: "report-sara",
      reason: "RESTRAINT_PENDING",
    });
  });

  it("S3-014 reports CRM and conversation contradiction without resolving it", () => {
    expect(report.contradictoryEvidence).toMatchObject({ numerator: 1, denominator: 8 });
    expect(report.leads.find((lead) => lead.caseId === "report-layla")?.decisionState).toBe("CONTRADICTORY_EVIDENCE");
  });

  it("S3-015 derives ownership gaps from assignment evidence, not rep activity", () => {
    expect(report.repOwnershipGaps).toMatchObject({ numerator: 2, denominator: 8 });
    expect(report.leads.find((lead) => lead.caseId === "report-yasmin")?.firstResponseMinutes).toBe(45);
    expect(report.leads.find((lead) => lead.caseId === "report-yasmin")?.assignedRepId).toBeUndefined();
  });

  it("S3-016 preserves exact source provenance on each drill-down row", () => {
    expect(report.leads.find((lead) => lead.caseId === "report-ahmed")?.sourceRefs).toEqual([
      "synthetic:report-ahmed:crm_csv",
      "synthetic:report-ahmed:whatsapp_export",
    ]);
  });

  it("S3-017 preserves Arabic aliases without transliteration", () => {
    expect(report.leads.find((lead) => lead.caseId === "report-mahmoud")?.buyerAlias).toBe("محمود عبد الله");
  });

  it("S3-018 exposes stale source freshness explicitly", () => {
    expect(report.leads.find((lead) => lead.caseId === "report-mahmoud")?.freshness).toMatchObject({
      state: "STALE",
      reason: expect.any(String),
    });
  });

  it("S3-019 preserves manager review history where available", () => {
    expect(report.leads.find((lead) => lead.caseId === "report-tariq")?.managerReviewHistory).toHaveLength(1);
    expect(report.leads.find((lead) => lead.caseId === "report-layla")?.managerReviewHistory[0]?.state).toBe("PENDING_VALIDATION");
  });

  it("S3-020 creates deterministic report identity", () => {
    expect(buildLeadLossReport(LEAD_LOSS_REPORT_CASES).reportId).toBe(report.reportId);
  });

  it("S3-021 records a bounded observation window from eligible evidence", () => {
    expect(report.observationWindow).toEqual({
      start: "2026-08-24T08:00:00.000Z",
      end: "2026-08-30T08:05:00.000Z",
    });
  });

  it("S3-022 chooses the earliest attributable response even when events are out of order", () => {
    const ahmed = cloneCase(LEAD_LOSS_REPORT_CASES.find((entry) => entry.caseId === "report-ahmed")!);
    ahmed.events = [
      ...ahmed.events,
      { ...ahmed.events[1]!, eventId: "ahmed-later-response", occurredAt: "2026-08-25T08:30:00.000Z" },
    ].reverse();
    expect(buildLeadLossReport([ahmed]).timeToFirstResponse.averageMinutes).toBe(10);
  });

  it("S3-023 ignores rep events that predate lead receipt", () => {
    const farah = cloneCase(LEAD_LOSS_REPORT_CASES.find((entry) => entry.caseId === "report-farah")!);
    farah.events = [
      ...farah.events,
      {
        ...farah.events[0]!,
        eventId: "pre-receipt-rep",
        actorId: "rep-synthetic",
        actorRole: "REP",
        direction: "OUTBOUND",
        occurredAt: "2026-08-24T07:59:00.000Z",
      },
    ];
    expect(buildLeadLossReport([farah]).untouchedLeads.numerator).toBe(1);
  });

  it("S3-024 does not mutate fixture events, decisions, or review history", () => {
    const before = JSON.stringify(LEAD_LOSS_REPORT_CASES);
    buildLeadLossReport(LEAD_LOSS_REPORT_CASES);
    expect(JSON.stringify(LEAD_LOSS_REPORT_CASES)).toBe(before);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.leads[0]!.managerReviewHistory)).toBe(true);
  });
});

function cloneCase(entry: LeadLossCase): LeadLossCase {
  return structuredClone(entry);
}
