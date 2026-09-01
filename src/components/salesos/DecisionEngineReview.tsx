"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { buildDecisionSequence, DECISION_ENGINE_FIXTURES, type DecisionEngineFixtureKey } from "@/lib/decisionEngine";
import { maskPii } from "@/lib/realInput";

const FIXTURE_KEYS = Object.keys(DECISION_ENGINE_FIXTURES) as DecisionEngineFixtureKey[];

export function DecisionEngineReview() {
  const { dict } = useLocale();
  const [fixtureKey, setFixtureKey] = useState<DecisionEngineFixtureKey>("explicitPause");
  const sequence = buildDecisionSequence(DECISION_ENGINE_FIXTURES[fixtureKey]);
  const current = sequence.current;

  return (
    <section className="mx-auto max-w-6xl space-y-6" data-testid="decision-engine-review">
      <header className="rounded-2xl border border-amber-950 bg-[radial-gradient(circle_at_top_left,_rgba(180,83,9,0.18),_transparent_40%),linear-gradient(140deg,_rgba(10,10,10,0.98),_rgba(31,20,8,0.92))] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">{dict.decisionEngine.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-50">{dict.decisionEngine.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">{dict.decisionEngine.description}</p>
        <p className="mt-4 rounded-lg border border-rose-900/70 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">{dict.decisionEngine.noAuthority}</p>
      </header>

      <nav aria-label={dict.decisionEngine.fixtures} className="flex flex-wrap gap-2">
        {FIXTURE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={fixtureKey === key}
            onClick={() => setFixtureKey(key)}
            className={`min-h-11 rounded-full border px-4 text-xs font-medium ${fixtureKey === key ? "border-amber-600 bg-amber-950/50 text-amber-100" : "border-neutral-800 bg-neutral-950 text-neutral-400"}`}
          >
            {dict.decisionEngine.fixtureLabels[key]}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <article className="rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-decision-state={current.decisionState} data-testid="deterministic-decision">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500">{dict.decisionEngine.currentDecision}</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-100">{dict.decisionState[current.decisionState]}</h2>
              </div>
              <span className="rounded-full border border-neutral-700 px-3 py-1 font-mono text-[11px] text-neutral-300">{current.snapshotId}</span>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Metadata label={dict.decisionEngine.effectiveAt} value={current.effectiveAt} />
              <Metadata label={dict.decisionEngine.policyVersion} value={current.policyVersion} />
              <Metadata label={dict.decisionEngine.extractorVersion} value={current.extractorVersion} />
              <Metadata label={dict.decisionEngine.priorSnapshot} value={current.priorSnapshotId ?? dict.decisionEngine.none} />
            </dl>

            <ReviewList title={dict.decisionEngine.reasonCodes} values={current.reasonCodes.map((code) => dict.decisionEngine.reasonLabels[code])} />
            <ReviewList title={dict.decisionEngine.evidenceRefs} values={current.evidenceRefs.map(maskPii)} mono empty={dict.decisionEngine.none} />
            <ReviewList title={dict.decisionEngine.uncertainty} values={current.uncertainty.map((code) => dict.decisionEngine.uncertaintyLabels[code])} empty={dict.decisionEngine.noUncertainty} />
            <ReviewList title={dict.decisionEngine.reevaluation} values={current.reevaluationConditions.map((condition) => dict.decisionEngine.reevaluationLabels[condition])} />
          </article>

          <article className="rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-testid="decision-lineage">
            <h2 className="text-sm font-semibold text-neutral-100">{dict.decisionEngine.lineage}</h2>
            <ol className="mt-3 space-y-3">
              {sequence.snapshots.map((snapshot, index) => (
                <li key={snapshot.snapshotId} className="grid grid-cols-[28px_1fr] gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-xs text-neutral-300">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-neutral-100">{dict.decisionState[snapshot.decisionState]}</p>
                    <p className="mt-1 font-mono text-[11px] text-neutral-500">{snapshot.snapshotId}</p>
                    <time className="mt-1 block text-xs text-neutral-500" dateTime={snapshot.effectiveAt}>{snapshot.effectiveAt}</time>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>

        <div className="space-y-5">
          <article className="rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-testid="extracted-signals">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-neutral-100">{dict.decisionEngine.extractedSignals}</h2>
              <span className="text-xs text-neutral-500">{sequence.extraction.signals.length} {dict.decisionEngine.signals}</span>
            </div>
            <ul className="mt-3 space-y-3">
              {sequence.extraction.signals.map((signal) => (
                <li key={signal.signalId} data-signal-type={signal.type} className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-200">{dict.decisionEngine.signalLabels[signal.type]}</span>
                    <span className="text-[11px] text-neutral-500">{dict.decisionEngine.confidence}: {dict.decisionEngine.confidenceLabels[signal.confidence]}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-200" dir="auto">{signal.evidencePointer.excerpt || dict.decisionEngine.noExcerpt}</p>
                  <p className="mt-2 break-all font-mono text-[11px] text-sky-400" dir="ltr">{signal.sourceRefs.map(maskPii).join(" · ")}</p>
                  {signal.uncertaintyReason ? <p className="mt-2 text-xs text-amber-300">{dict.decisionEngine.signalUncertainty}</p> : null}
                  {signal.rejectionReason ? <p className="mt-1 text-xs text-rose-300">{dict.decisionEngine.signalRejected}</p> : null}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-testid="historical-findings">
            <h2 className="text-sm font-semibold text-neutral-100">{dict.decisionEngine.historicalFindings}</h2>
            {current.historicalFindings.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">{dict.decisionEngine.noHistoricalFindings}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {current.historicalFindings.map((finding) => (
                  <li key={`${finding.kind}-${finding.sourceRefs.join("-")}`} className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3">
                    <p className="text-sm font-semibold text-rose-200">{dict.decisionEngine.chasingFinding}</p>
                    <p className="mt-2 text-xs text-neutral-300">{dict.decisionEngine.chasingSummary}</p>
                    <p className="mt-2 break-all font-mono text-[11px] text-neutral-500" dir="ltr">{finding.sourceRefs.map(maskPii).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-neutral-800 bg-neutral-900/50 p-3"><dt className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</dt><dd className="mt-1 break-all font-mono text-xs text-neutral-200" dir="auto">{value}</dd></div>;
}

function ReviewList({ title, values, mono = false, empty }: { title: string; values: readonly string[]; mono?: boolean; empty?: string }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
      {values.length === 0 ? <p className="mt-2 text-sm text-neutral-500">{empty}</p> : (
        <ul className="mt-2 space-y-2">{values.map((value) => <li key={value} className={`rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-neutral-200 ${mono ? "break-all font-mono text-xs" : ""}`} dir="auto">{value}</li>)}</ul>
      )}
    </section>
  );
}
