"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/en";
import {
  buildLeadLossReport,
  LEAD_LOSS_REPORT_CASES,
  type MetricExclusion,
  type ReportMetric,
} from "@/lib/leadLossReport";
import { maskPii } from "@/lib/realInput";
import type { DecisionState } from "@/lib/types";

const REPORT = buildLeadLossReport(LEAD_LOSS_REPORT_CASES);
const DECISION_STATES: readonly DecisionState[] = [
  "NO_ACTION",
  "NEXT_STEP_READY",
  "INSUFFICIENT_EVIDENCE",
  "CONTRADICTORY_EVIDENCE",
];

export function LeadLossReportView() {
  const { dict } = useLocale();
  const copy = dict.leadLossReport;
  const methodology = [
    { label: copy.leadsReceived, metric: REPORT.leadsReceived, denominator: copy.receivedRecords },
    { label: copy.untouchedLeads, metric: REPORT.untouchedLeads, denominator: copy.metricDenominators.untouchedLeads },
    { label: copy.firstResponse, metric: REPORT.timeToFirstResponse, denominator: copy.metricDenominators.firstResponse },
    { label: copy.decisionDistribution, metric: REPORT.decisionDistribution.NO_ACTION, denominator: copy.metricDenominators.stateDistribution },
    { label: copy.restraintRespected, metric: REPORT.restraintRespected, denominator: copy.metricDenominators.behavior },
    { label: copy.ownershipGaps, metric: REPORT.repOwnershipGaps, denominator: copy.metricDenominators.ownership },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8" data-testid="lead-loss-report">
      <header className="overflow-hidden rounded-2xl border border-orange-900/70 bg-[radial-gradient(circle_at_top_right,rgba(194,65,12,0.22),transparent_42%),linear-gradient(135deg,#17120d,#090909_62%)] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">{copy.eyebrow}</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">{copy.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300" dir="auto">{copy.description}</p>
          </div>
          <div className="rounded-xl border border-rose-900/70 bg-rose-950/20 p-4 text-sm leading-6 text-rose-100" dir="auto">
            {copy.noCausality}
          </div>
        </div>
      </header>

      <section aria-label={copy.leadDetail} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={copy.leadsReceived} metric={REPORT.leadsReceived} denominator={copy.receivedRecords} testId="leads-received" />
        <MetricCard label={copy.untouchedLeads} metric={REPORT.untouchedLeads} denominator={copy.receivedLeads} testId="untouched-leads" tone="rose" />
        <MetricCard
          label={copy.firstResponse}
          metric={REPORT.timeToFirstResponse}
          denominator={copy.respondedLeads}
          testId="first-response"
          value={REPORT.timeToFirstResponse.averageMinutes === null ? "—" : `${REPORT.timeToFirstResponse.averageMinutes} ${copy.minutesAverage}`}
        />
        <MetricCard label={copy.staleOrUnresolved} metric={REPORT.staleOrUnresolved} denominator={copy.receivedLeads} testId="stale-unresolved" tone="amber" />
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{copy.decisionDistribution}</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-100">{copy.metricDenominators.stateDistribution}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="decision-distribution">
          {DECISION_STATES.map((state) => (
            <MetricCard
              key={state}
              label={dict.decisionState[state]}
              metric={REPORT.decisionDistribution[state]}
              denominator={copy.receivedLeads}
              testId={`state-${state.toLowerCase()}`}
              tone={state === "CONTRADICTORY_EVIDENCE" ? "rose" : state === "INSUFFICIENT_EVIDENCE" ? "amber" : "neutral"}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{copy.behaviorReview}</p>
          <p className="mt-1 text-sm text-neutral-400" dir="auto">{copy.metricDenominators.behavior}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label={copy.noAction} metric={REPORT.noAction} denominator={copy.receivedLeads} testId="no-action" />
          <MetricCard label={copy.restraintRespected} metric={REPORT.restraintRespected} denominator={copy.observableNoAction} testId="restraint-respected" tone="emerald" />
          <MetricCard label={copy.chasingViolations} metric={REPORT.chasingViolations} denominator={copy.observableNoAction} testId="chasing-violations" tone="rose" />
          <MetricCard label={copy.contradictoryEvidence} metric={REPORT.contradictoryEvidence} denominator={copy.receivedLeads} testId="contradictions" tone="rose" />
          <MetricCard label={copy.ownershipGaps} metric={REPORT.repOwnershipGaps} denominator={copy.receivedLeads} testId="ownership-gaps" tone="amber" />
        </div>
        <p className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400" dir="auto">{copy.assignmentBoundary}</p>
      </section>

      <section className="space-y-4" aria-labelledby="lead-detail-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{copy.leadDetail}</p>
          <h2 id="lead-detail-title" className="mt-1 text-xl font-semibold text-neutral-100">{copy.openDecisionEvidence}</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2" data-testid="lead-report-rows">
          {REPORT.leads.map((lead) => (
            <article key={lead.caseId} className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4" data-testid="lead-report-row" data-decision-state={lead.decisionState}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-neutral-100" dir="auto">{lead.buyerAlias}</h3>
                  <p className="mt-1 font-mono text-xs text-neutral-500" dir="auto">{lead.leadId}</p>
                </div>
                <span className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-300">{dict.decisionState[lead.decisionState]}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">{copy.observedThrough}</dt>
                  <dd className={lead.freshness.state === "STALE" ? "mt-1 text-amber-300" : "mt-1 text-neutral-200"} dir="auto">
                    {lead.freshness.observedThrough} · {lead.freshness.state === "STALE" ? copy.stale : copy.current}
                  </dd>
                  {lead.freshness.state === "STALE" ? <p className="mt-1 text-amber-200/70" dir="auto">{copy.staleReason}</p> : null}
                </div>
                <div>
                  <dt className="text-neutral-500">{copy.assignedRep}</dt>
                  <dd className={lead.assignedRepId ? "mt-1 text-neutral-200" : "mt-1 text-amber-300"} dir="auto">
                    {lead.assignedRepId ? `${copy.assigned}: ${lead.assignedRepId}` : copy.assignmentMissing}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{copy.firstResponse}</dt>
                  <dd className="mt-1 text-neutral-200" dir="auto">
                    {lead.firstResponseMinutes === null ? copy.firstResponseNotObserved : `${lead.firstResponseMinutes} ${copy.minutes}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{copy.source}</dt>
                  <dd className="mt-1 space-y-1 font-mono text-neutral-300">
                    {lead.sourceRefs.map((sourceRef) => <span key={sourceRef} className="block" dir="auto">{maskPii(sourceRef)}</span>)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-neutral-800 pt-3">
                <p className="text-xs font-medium text-neutral-400">{copy.managerHistory}</p>
                {lead.managerReviewHistory.length === 0 ? (
                  <p className="mt-2 text-xs text-neutral-600">{copy.noManagerHistory}</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {lead.managerReviewHistory.map((review) => (
                      <li key={review.reviewId} className="rounded border border-sky-950 bg-sky-950/20 p-2 text-xs text-neutral-300">
                        <span className="font-medium text-sky-200">{copy.states[review.state]}</span>
                        <span className="mx-2 text-neutral-600">·</span>
                        <span dir="auto">{copy.reviewSummaries[review.summaryCode]}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <Link href={`/app-studio/salesos/opportunity/${lead.opportunityId}`} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-orange-800 px-3 text-sm font-medium text-orange-200 hover:bg-orange-950/30">
                {copy.openDecisionEvidence}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold text-neutral-100">{copy.methodology}</h2>
          <div className="mt-4 space-y-4" data-testid="metric-methodology">
            {methodology.map((item) => (
              <div key={item.label} className="border-b border-neutral-900 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-neutral-200">{item.label}</span>
                  <span className="font-mono text-neutral-400">{item.metric.numerator} / {item.metric.denominator}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500" dir="auto">{copy.denominator}: {item.denominator}</p>
                <ExclusionList exclusions={item.metric.exclusions} copy={copy} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold text-neutral-100">{copy.provenance}</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-neutral-500">{copy.reportWindow}</dt>
              <dd className="mt-1 font-mono text-neutral-200" dir="auto">{REPORT.observationWindow.start} → {REPORT.observationWindow.end}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{copy.source}</dt>
              <dd className="mt-2 space-y-1 font-mono text-xs text-neutral-300">
                {REPORT.sources.map((source) => <span key={`${source.sourceType}:${source.sourceRef}`} className="block" dir="auto">{source.sourceType} · {maskPii(source.sourceRef)}</span>)}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  metric,
  denominator,
  testId,
  value,
  tone = "neutral",
}: {
  label: string;
  metric: ReportMetric;
  denominator: string;
  testId: string;
  value?: string;
  tone?: "neutral" | "rose" | "amber" | "emerald";
}) {
  const { dict } = useLocale();
  const border = {
    neutral: "border-neutral-800",
    rose: "border-rose-900/70",
    amber: "border-amber-900/70",
    emerald: "border-emerald-900/70",
  }[tone];
  return (
    <article className={`rounded-xl border bg-neutral-950 p-4 ${border}`} data-testid={`metric-${testId}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-neutral-50" dir="auto">{value ?? metric.numerator}</p>
      <p className="mt-2 font-mono text-xs text-neutral-400">{metric.numerator} / {metric.denominator}</p>
      <p className="mt-1 text-xs text-neutral-600" dir="auto">{denominator}</p>
      <p className="mt-2 text-xs text-neutral-500">{dict.leadLossReport.exclusions}: {metric.exclusions.length}</p>
    </article>
  );
}

function ExclusionList({ exclusions, copy }: { exclusions: readonly MetricExclusion[]; copy: Dictionary["leadLossReport"] }) {
  if (exclusions.length === 0) return <p className="mt-2 text-xs text-neutral-600">{copy.noExclusions}</p>;
  return (
    <ul className="mt-2 space-y-1 text-xs text-neutral-500">
      {exclusions.map((exclusion) => (
        <li key={`${exclusion.caseId}:${exclusion.reason}`} dir="auto">
          {exclusion.caseId}: {copy.exclusionReasons[exclusion.reason]}
        </li>
      ))}
    </ul>
  );
}
