"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RealInputWorkspace } from "@/components/salesos/RealInputWorkspace";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  attachObservation, captureEvent, clearOperatorSession, createOperatorSession, createSanitizedExport,
  detectExperimentCandidate, exportAsMarkdown, opportunitiesFromEvents, recordOverride, recordTrialSignal,
  SYNTHETIC_OPERATOR_AS_OF, SYNTHETIC_OPERATOR_OPPORTUNITIES, type CaptureKind, type OperatorSession,
  type QueueSection, type TrialSignalKind,
} from "@/lib/operatorRuntime";
import { maskPii } from "@/lib/realInput";

const SECTIONS: QueueSection[] = ["ACT_NOW", "COMMITMENTS_DUE", "REVIEW", "WAIT_PROTECTED", "AT_RISK_NEGLECT"];
const CAPTURE_KINDS: CaptureKind[] = ["CLIENT_CALLED", "CLIENT_REPLIED", "MEETING_HAPPENED", "CLIENT_REQUESTED_OPTIONS", "CLIENT_POSTPONED", "BUDGET_CLARIFIED", "PARTNER_APPROVAL_REQUIRED", "PROMISED_FOLLOWUP", "SELLER_COMMITMENT", "OBJECTION", "EXPLICIT_REJECTION", "NEW_TIMELINE", "MEETING_SCHEDULED", "EOI", "RESERVATION", "OPERATOR_NOTE"];
const MANUAL_TRIAL_SIGNALS: Exclude<TrialSignalKind, "QUEUE_OPENED" | "RECOMMENDATION_OVERRIDDEN" | "QUICK_CAPTURE">[] = ["RECOMMENDATION_ACCEPTED", "INCORRECT_PRIORITY", "FALSE_URGENCY", "MISSED_IMPORTANT_OPPORTUNITY", "NO_ACTION_USEFUL", "MISSED_COMMITMENT", "WORKFLOW_ABANDONED", "FEATURE_IGNORED"];

export function OperatorRuntime() {
  const { dict } = useLocale();
  const copy = dict.operatorRuntime;
  const [session, setSession] = useState<OperatorSession | null>(() => createOperatorSession("operator-local", SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF));
  const [selectedId, setSelectedId] = useState("opp-egypt-overdue");
  const [captureKind, setCaptureKind] = useState<CaptureKind>("CLIENT_REPLIED");
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [intendedAction, setIntendedAction] = useState("");
  const [exportMode, setExportMode] = useState<"JSON" | "MARKDOWN" | null>(null);
  const [trialKind, setTrialKind] = useState<(typeof MANUAL_TRIAL_SIGNALS)[number]>("RECOMMENDATION_ACCEPTED");
  const [trialNote, setTrialNote] = useState("");

  const queueItem = session?.queue.find((item) => item.opportunityId === selectedId) ?? session?.queue[0];
  const opportunity = session?.opportunities.find((item) => item.opportunityId === queueItem?.opportunityId);
  const latestOverride = session?.overrides.filter((item) => item.opportunityId === queueItem?.opportunityId).at(-1);
  const exportText = useMemo(() => {
    if (!session || !exportMode) return "";
    const safe = createSanitizedExport(session);
    return exportMode === "JSON" ? JSON.stringify(safe, null, 2) : exportAsMarkdown(safe);
  }, [exportMode, session]);

  if (!session) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-emerald-900/60 bg-neutral-950 p-8 text-center" data-testid="session-cleared">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">{copy.sessionCleared}</p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-50">{copy.noRuntimeData}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400">{copy.resetBoundary}</p>
        <button type="button" onClick={() => setSession(createOperatorSession("operator-local", SYNTHETIC_OPERATOR_OPPORTUNITIES, SYNTHETIC_OPERATOR_AS_OF))} className="mt-6 min-h-11 rounded-full bg-amber-400 px-5 text-sm font-semibold text-neutral-950">{copy.loadSynthetic}</button>
      </section>
    );
  }

  const snapshot = opportunity?.decision.current;
  return (
    <main className="mx-auto max-w-7xl space-y-6" data-testid="operator-runtime">
      <header className="overflow-hidden rounded-3xl border border-amber-900/60 bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,0.18),transparent_34%),linear-gradient(135deg,#17120a,#090909_58%)] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">{copy.eyebrow}</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">{copy.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300">{copy.description}</p>
          </div>
          <div className="rounded-2xl border border-neutral-700 bg-black/30 px-4 py-3 text-end">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">{copy.baseline}</p>
            <p className="mt-1 text-sm font-semibold text-amber-200">{copy.observationPeriod}</p>
            <p className="mt-1 text-xs text-neutral-500">{session.baseline.observedDays} / {session.baseline.minimumDays} {copy.daysObserved}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {[copy.now, copy.decide, copy.execute, copy.learn].map((label, index) => <div key={label} className={`rounded-lg border px-2 py-2 ${index === 0 ? "border-amber-600 bg-amber-950/50 text-amber-200" : "border-neutral-800 bg-neutral-950/70"}`}>{label}</div>)}
        </div>
      </header>

      <details className="rounded-2xl border border-sky-900/50 bg-sky-950/10 p-4" data-testid="runtime-input-gate">
        <summary className="cursor-pointer text-sm font-semibold text-sky-200">{copy.inputGate}</summary>
        <p className="mt-2 text-xs text-neutral-400">{copy.inputGateBoundary}</p>
        <div className="mt-5"><RealInputWorkspace onAccepted={(result) => {
          const opportunities = opportunitiesFromEvents(result.events);
          if (opportunities.length === 0) return;
          const next = createOperatorSession(session.operatorId, opportunities, new Date().toISOString());
          setSession(next); setSelectedId(next.queue[0]?.opportunityId ?? ""); setExportMode(null);
        }} /></div>
      </details>

      <section aria-labelledby="queue-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.24em] text-amber-400">{copy.now}</p><h2 id="queue-title" className="mt-1 text-2xl font-semibold text-neutral-50">{copy.whatDeservesAttention}</h2></div>
          <Link href="/app-studio/salesos/import" className="text-xs text-emerald-300 underline decoration-emerald-800 underline-offset-4">{copy.openInput}</Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          {SECTIONS.map((section) => {
            const items = session.queue.filter((item) => item.section === section);
            return (
              <section key={section} data-queue-section={section} className="min-h-32 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                <div className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">{copy.sections[section]}</h3><span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400">{items.length}</span></div>
                {items.length === 0 ? <p className="mt-4 text-xs text-neutral-600">{copy.noArtificialItems}</p> : <ul className="mt-3 space-y-2">{items.map((item) => (
                  <li key={item.queueItemId}><button type="button" onClick={() => setSelectedId(item.opportunityId)} aria-pressed={queueItem?.opportunityId === item.opportunityId} className={`w-full rounded-xl border p-3 text-start ${queueItem?.opportunityId === item.opportunityId ? "border-amber-700 bg-amber-950/30" : "border-neutral-800 bg-neutral-900/60"}`}>
                    <span className="block text-sm font-medium text-neutral-100" dir="auto">{item.displayLabel}</span><span className="mt-2 block text-xs leading-5 text-neutral-400">{copy.queueWhy[section]}</span>
                  </button></li>
                ))}</ul>}
              </section>
            );
          })}
        </div>
      </section>

      {queueItem && opportunity && snapshot ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5" data-testid="decision-workspace">
            <article className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-sky-300">{copy.decide}</p><h2 className="mt-2 text-2xl font-semibold text-white" dir="auto">{queueItem.displayLabel}</h2></div><span data-decision-state={snapshot.decisionState} className="rounded-full border border-sky-800 bg-sky-950/40 px-3 py-1 text-xs text-sky-200">{dict.decisionState[snapshot.decisionState]}</span></div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <Detail label={copy.why} value={copy.queueWhy[queueItem.section]} />
                <Detail label={copy.whyNow} value={copy.queueNow[queueItem.section]} />
                <Detail label={copy.whatChanged} value={snapshot.priorSnapshotId ? copy.lineageChanged : copy.firstSnapshot} />
                <Detail label={copy.ignoreRisk} value={copy.queueRisk[queueItem.section]} />
              </dl>
              <div className="mt-5 grid gap-3 sm:grid-cols-2"><List title={copy.do} values={[copy.queueDo[queueItem.section]]} /><List title={copy.dont} values={[copy.queueDont[queueItem.section]]} /><List title={copy.reevaluateWhen} values={snapshot.reevaluationConditions.map((key) => dict.decisionEngine.reevaluationLabels[key])} /></div>
            </article>

            <article className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5" data-testid="evidence-contract">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-neutral-100">{copy.evidenceContract}</h3><span className="font-mono text-[10px] text-neutral-500">{snapshot.snapshotId}</span></div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2"><Detail label={copy.recommendation} value={copy.recommendations[queueItem.evidenceContract.recommendation]} /><Detail label={copy.freshness} value={copy.freshnessValues[queueItem.evidenceContract.freshness]} /><Detail label={copy.policy} value={queueItem.evidenceContract.governingPolicy} /><Detail label={copy.provenance} value={`${queueItem.evidenceContract.provenance.length} ${copy.attributableSources}`} /></dl>
              <List title={copy.primaryEvidence} values={queueItem.evidenceContract.primaryEvidence.map(maskPii)} mono empty={copy.none} />
              <List title={copy.contradictions} values={queueItem.evidenceContract.contradictions.map(maskPii)} mono empty={copy.none} />
              <List title={copy.missingInformation} values={queueItem.evidenceContract.missingInformation.map(() => copy.decisionGradeMissing)} empty={copy.none} />
              <p className="mt-4 rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">{copy.noExecutionAuthority}</p>
            </article>
          </section>

          <aside className="space-y-5">
            <article className="rounded-2xl border border-emerald-900/60 bg-emerald-950/10 p-5" data-testid="quick-capture">
              <p className="text-xs uppercase tracking-widest text-emerald-300">{copy.execute}</p><h2 className="mt-2 text-xl font-semibold text-white">{copy.quickCapture}</h2><p className="mt-2 text-xs text-neutral-400">{copy.manualBoundary}</p>
              <label className="mt-4 block text-xs text-neutral-400">{copy.captureKind}<select value={captureKind} onChange={(event) => setCaptureKind(event.target.value as CaptureKind)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100">{CAPTURE_KINDS.map((kind) => <option key={kind} value={kind}>{copy.captureKinds[kind]}</option>)}</select></label>
              <label className="mt-3 block text-xs text-neutral-400">{copy.optionalNote}<input dir="auto" value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" /></label>
              <button type="button" onClick={() => { setSession((current) => current ? captureEvent(current, { opportunityId: queueItem.opportunityId, kind: captureKind, occurredAt: new Date().toISOString(), operatorId: current.operatorId, note }) : current); setNote(""); }} className="mt-4 min-h-11 w-full rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-neutral-950">{copy.recordCapture}</button>
            </article>

            <article className="rounded-2xl border border-orange-900/60 bg-orange-950/10 p-5" data-testid="override-ledger">
              <p className="text-xs uppercase tracking-widest text-orange-300">{copy.disagreement}</p><h2 className="mt-2 text-xl font-semibold text-white">{copy.overrideLedger}</h2><p className="mt-2 text-xs text-neutral-400">{copy.overrideBoundary}</p>
              <label className="mt-4 block text-xs text-neutral-400">{copy.overrideReason}<input dir="auto" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" /></label>
              <label className="mt-3 block text-xs text-neutral-400">{copy.intendedAction}<input dir="auto" value={intendedAction} onChange={(event) => setIntendedAction(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" /></label>
              <button type="button" disabled={!overrideReason.trim() || !intendedAction.trim()} onClick={() => { setSession((current) => current ? recordOverride(current, queueItem.opportunityId, queueItem.evidenceContract.recommendation === "WAIT" ? "ACT" : "WAIT", overrideReason, intendedAction, new Date().toISOString()) : current); setOverrideReason(""); setIntendedAction(""); }} className="mt-4 min-h-11 w-full rounded-lg bg-orange-400 px-4 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40">{copy.recordOverride}</button>
              <p className="mt-3 text-xs text-neutral-500">{session.overrides.filter((item) => item.opportunityId === queueItem.opportunityId).length} {copy.appendOnlyRecords}</p>
              {latestOverride ? <button type="button" onClick={() => setSession((current) => current ? attachObservation(current, latestOverride.overrideId, { occurredAt: new Date().toISOString(), outcome: "PROGRESSION_OBSERVED", sourceRef: `operator-session:${current.sessionId}:observation`, note: copy.syntheticObservation }) : current)} className="mt-3 min-h-11 w-full rounded-lg border border-neutral-700 px-4 text-sm text-neutral-200">{copy.recordObservation}</button> : null}
              {session.observations.length > 0 ? <p className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-300">{copy.noCausalWinner}</p> : null}
            </article>
          </aside>
        </div>
      ) : null}

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5" data-testid="learning-ledger">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-violet-300">{copy.learn}</p><h2 className="mt-2 text-xl font-semibold text-white">{copy.performanceAndLearning}</h2></div><button type="button" onClick={() => setSession((current) => current ? detectExperimentCandidate(current, copy.syntheticPattern, ["bounded:a", "bounded:b", "bounded:c"]) : current)} className="min-h-11 rounded-lg border border-violet-800 px-4 text-xs text-violet-200">{copy.detectCandidate}</button></div>
        <p className="mt-3 text-sm text-neutral-400">{copy.descriptiveOnly}</p>
        <details className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-200">{copy.reviewMeasures}</summary>
        <article className="mt-4 rounded-xl border border-amber-900/50 bg-amber-950/10 p-4" data-testid="operator-profile">
          <h3 className="font-semibold text-amber-100">{copy.operatorProfile}</h3>
          <p className="mt-1 text-xs text-neutral-400">{copy.profileBoundary}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{Object.entries(session.operatorProfile.measures).map(([key, metric]) => <div key={key} className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"><p className="text-[10px] uppercase tracking-wide text-neutral-500">{copy.profileMeasures[key as keyof typeof copy.profileMeasures]}</p><p className="mt-1 font-mono text-sm text-neutral-100">{metric.numerator} / {metric.denominator} · {metric.value === null ? copy.insufficient : `${Math.round(metric.value * 100)}%`}</p></div>)}</div>
        </article>
        <div className="mt-5 grid gap-4 md:grid-cols-4">{Object.entries(session.performance).filter(([key]) => key !== "causalBoundary").map(([group, metrics]) => <article key={group} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"><h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">{copy.metricGroups[group as keyof typeof copy.metricGroups]}</h3><ul className="mt-3 space-y-3">{Object.entries(metrics as Record<string, { numerator: number; denominator: number; value: number | null; statement: string }>).map(([key, metric]) => <li key={key}><p className="text-xs text-neutral-400" dir="auto">{metric.statement}</p><p className="mt-1 font-mono text-sm text-white">{metric.numerator} / {metric.denominator} · {metric.value === null ? copy.insufficient : `${Math.round(metric.value * 100)}%`}</p></li>)}</ul></article>)}</div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><article className="rounded-xl border border-neutral-800 p-4"><h3 className="font-semibold text-neutral-100">{copy.doctrineRegistry}</h3>{session.doctrine.map((item) => <div key={`${item.doctrineId}-${item.version}`} className="mt-3"><p className="text-sm text-neutral-200">{item.title} · v{item.version}</p><p className="text-xs text-neutral-500">{copy.doctrineStatuses[item.status]} · {copy.scopeValues[item.scope]}</p></div>)}</article><article className="rounded-xl border border-neutral-800 p-4"><h3 className="font-semibold text-neutral-100">{copy.experimentCandidates}</h3>{session.experiments.length === 0 ? <p className="mt-3 text-sm text-neutral-500">{copy.noCandidates}</p> : session.experiments.map((item) => <div key={item.experimentId} className="mt-3"><p className="text-sm text-neutral-200">{item.observedPattern}</p><p className="text-xs text-amber-300">{copy.candidateOnly}</p></div>)}</article></div>
        </details>
      </section>

      <section className="rounded-2xl border border-amber-900/60 bg-amber-950/10 p-5" data-testid="trial-instrumentation">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs uppercase tracking-widest text-amber-300">{copy.trialEyebrow}</p><h2 className="mt-2 text-xl font-semibold text-white">{copy.trialTitle}</h2></div>
          <span className="rounded-full border border-amber-900 px-3 py-1 text-xs text-amber-200">{session.trialSignals.length} {copy.trialSignalsRecorded}</span>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-400">{copy.trialBoundary}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
          <label className="text-xs text-neutral-400">{copy.trialSignal}<select value={trialKind} onChange={(event) => setTrialKind(event.target.value as typeof trialKind)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100">{MANUAL_TRIAL_SIGNALS.map((kind) => <option key={kind} value={kind}>{copy.trialKinds[kind]}</option>)}</select></label>
          <label className="text-xs text-neutral-400">{copy.trialNote}<input dir="auto" value={trialNote} onChange={(event) => setTrialNote(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100" /></label>
          <button type="button" onClick={() => { setSession((current) => current ? recordTrialSignal(current, trialKind, new Date().toISOString(), queueItem?.opportunityId, trialNote) : current); setTrialNote(""); }} className="min-h-11 self-end rounded-lg bg-amber-400 px-4 text-sm font-semibold text-neutral-950">{copy.recordTrialSignal}</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_auto]">
        <article className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5"><h2 className="font-semibold text-white">{copy.sanitizedExport}</h2><p className="mt-2 text-xs text-neutral-400">{copy.exportBoundary}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setExportMode("JSON")} className="min-h-11 rounded-lg border border-sky-800 px-4 text-sm text-sky-200">{copy.previewJson}</button><button type="button" onClick={() => setExportMode("MARKDOWN")} className="min-h-11 rounded-lg border border-sky-800 px-4 text-sm text-sky-200">{copy.previewMarkdown}</button>{exportMode ? <a download={`salesos-${session.sessionId}.${exportMode === "JSON" ? "json" : "md"}`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(exportText)}`} className="flex min-h-11 items-center rounded-lg bg-sky-400 px-4 text-sm font-semibold text-neutral-950">{copy.download}</a> : null}</div>{exportMode ? <pre data-testid="sanitized-export" className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-800 bg-black p-3 text-[11px] text-neutral-300" dir="ltr">{exportText}</pre> : null}</article>
        <button type="button" onClick={() => { setSession(clearOperatorSession()); setExportMode(null); setNote(""); setOverrideReason(""); setIntendedAction(""); setTrialNote(""); }} className="min-h-14 rounded-2xl border border-rose-900 bg-rose-950/20 px-6 text-sm font-semibold text-rose-200">{copy.clearSession}</button>
      </section>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3"><dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt><dd className="mt-2 text-sm leading-5 text-neutral-200" dir="auto">{value}</dd></div>; }
function List({ title, values, mono = false, empty }: { title: string; values: readonly string[]; mono?: boolean; empty?: string }) { return <section className="mt-4"><h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h4>{values.length ? <ul className="mt-2 space-y-2">{values.map((value) => <li key={value} className={`rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs text-neutral-300 ${mono ? "break-all font-mono" : ""}`} dir="auto">{value}</li>)}</ul> : <p className="mt-2 text-xs text-neutral-600">{empty}</p>}</section>; }
