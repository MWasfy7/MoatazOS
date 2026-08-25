"use client";

import { useState } from "react";
import type {
  ContributionValidationState as ValidationState,
  DecisionSnapshot,
  ManagerContribution,
  ManagerContributionType,
  ManagerInterventionFixture,
  ManagerInterventionState,
} from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const EMPTY_INTERVENTION: ManagerInterventionFixture = {
  state: "NO_INTERVENTION",
  reviewedSnapshotId: "",
  contributions: [],
};

const validationStyles: Record<ValidationState, string> = {
  NOT_REQUIRED: "border-neutral-700 text-neutral-300",
  PENDING: "border-amber-700 text-amber-300",
  VALIDATED: "border-emerald-700 text-emerald-300",
  REJECTED: "border-rose-700 text-rose-300",
  EXCLUDED: "border-neutral-700 text-neutral-400",
};

export function ManagerInterventionReview({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const intervention = snapshot.managerIntervention ?? { ...EMPTY_INTERVENTION, reviewedSnapshotId: snapshot.snapshotId };
  const [open, setOpen] = useState(Boolean(snapshot.managerIntervention));
  const [reviewState, setReviewState] = useState<ManagerInterventionState>(intervention.state);
  const [selectedType, setSelectedType] = useState<ManagerContributionType>("COMMENTARY_ONLY");
  const [showComparison, setShowComparison] = useState(Boolean(intervention.reevaluatedSnapshot));
  const hasValidatedMaterial = intervention.contributions.some(
    (contribution) => contribution.validation === "VALIDATED" && contribution.materiallyRelevant,
  );
  const isStale = reviewState === "STALE_REVIEW" || intervention.state === "STALE_REVIEW";
  const reevaluationEligible = hasValidatedMaterial && !isStale;

  if (!open) {
    return (
      <button type="button" className="rounded-md border border-sky-800 px-3 py-2 text-sm font-medium text-sky-200" onClick={() => setOpen(true)}>
        {dict.managerIntervention.openReview}
      </button>
    );
  }

  function recordContribution() {
    setReviewState(selectedType === "COMMENTARY_ONLY" ? "COMMENTARY_ONLY" : selectedType === "TIMING_CONTEXT" || selectedType === "SOURCE_CORRECTION" ? "CONTEXT_CORRECTION_PENDING_VALIDATION" : "EVIDENCE_SUBMITTED_PENDING_VALIDATION");
  }

  function requestReevaluation() {
    if (!reevaluationEligible) return;
    setReviewState(intervention.reevaluatedSnapshot ? "REEVALUATED_NEW_SNAPSHOT" : "REEVALUATION_REQUESTED");
    setShowComparison(Boolean(intervention.reevaluatedSnapshot));
  }

  return (
    <section className="space-y-4 rounded-xl border border-sky-900 bg-sky-950/15 p-4" data-testid="manager-intervention-review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-sky-100">{dict.managerIntervention.title}</h2>
          <p className="mt-1 text-xs text-neutral-400" dir="auto">{dict.managerIntervention.noAuthority}</p>
        </div>
        <button type="button" className="text-sm text-sky-200 underline" onClick={() => setOpen(false)}>{dict.managerIntervention.closeReview}</button>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-neutral-500">{dict.managerIntervention.reviewedSnapshot}</dt><dd dir="auto" className="font-mono text-neutral-200">{intervention.reviewedSnapshotId}</dd></div>
        <div><dt className="text-neutral-500">{dict.managerIntervention.currentDecision}</dt><dd className="text-neutral-200">{dict.decisionState[snapshot.decisionState]}</dd></div>
      </dl>

      <ManagerDisagreementPanel disagreement={intervention.disagreement} />
      <ManagerContributionComposer selectedType={selectedType} onSelect={setSelectedType} onRecord={recordContribution} />

      <div className="space-y-2" aria-label={dict.managerIntervention.contribution}>
        {intervention.contributions.map((contribution) => <ContributionValidationState key={contribution.id} contribution={contribution} />)}
      </div>

      <ReevaluationGate eligible={reevaluationEligible} stale={isStale} onRequest={requestReevaluation} />
      {showComparison && intervention.reevaluatedSnapshot ? <DecisionSnapshotComparison snapshot={snapshot} intervention={intervention} /> : null}
      <ManagerInterventionTimeline state={reviewState} contributions={intervention.contributions} staleReason={intervention.staleReason} />
    </section>
  );
}

export function ManagerDisagreementPanel({ disagreement }: { disagreement?: string }) {
  const { dict } = useLocale();
  if (!disagreement) return null;
  return <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3"><p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{dict.managerIntervention.disagreement}</p><p className="mt-1 text-sm text-neutral-200" dir="auto">{disagreement}</p></div>;
}

export function ManagerContributionComposer({ selectedType, onSelect, onRecord }: { selectedType: ManagerContributionType; onSelect: (type: ManagerContributionType) => void; onRecord: () => void }) {
  const { dict } = useLocale();
  const choices: ManagerContributionType[] = ["COMMENTARY_ONLY", "NEW_BUYER_EVIDENCE", "TIMING_CONTEXT", "SOURCE_CORRECTION", "INTEGRITY_FLAG"];
  const choiceLabel = (type: ManagerContributionType) => type === "NEW_BUYER_EVIDENCE" ? dict.managerIntervention.addEvidence : type === "TIMING_CONTEXT" ? dict.managerIntervention.correctContext : type === "INTEGRITY_FLAG" ? dict.managerIntervention.flagIntegrity : dict.managerIntervention.contributionTypes[type];
  return <div className="space-y-2 rounded-lg border border-neutral-800 p-3"><p className="text-sm font-medium text-neutral-200">{dict.managerIntervention.contribution}</p><div className="flex flex-wrap gap-2">{choices.map((type) => <button key={type} type="button" aria-pressed={selectedType === type} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-200" onClick={() => onSelect(type)}>{choiceLabel(type)}</button>)}</div><p className="text-xs text-neutral-400" dir="auto">{selectedType === "COMMENTARY_ONLY" ? dict.managerIntervention.commentaryOnly : dict.managerIntervention.reevaluationIneligible}</p><button type="button" className="rounded bg-sky-800 px-3 py-2 text-sm font-medium text-white" onClick={onRecord}>{dict.managerIntervention.recordContribution}</button></div>;
}

export function ContributionValidationState({ contribution }: { contribution: ManagerContribution }) {
  const { dict } = useLocale();
  return <article className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3" data-validation-state={contribution.validation}><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium text-neutral-100">{dict.managerIntervention.contributionTypes[contribution.type]}</p><span className={`rounded border px-2 py-0.5 text-xs ${validationStyles[contribution.validation]}`}>{dict.managerIntervention.validationStates[contribution.validation]}</span></div><p className="mt-2 text-sm text-neutral-300" dir="auto">{contribution.summary}</p><p className="mt-2 text-xs text-neutral-500" dir="auto">{dict.managerIntervention.manager}: {contribution.managerAlias}</p>{contribution.supersedesContributionId ? <p className="mt-1 font-mono text-xs text-neutral-500" dir="auto">{contribution.supersedesContributionId}</p> : null}</article>;
}

export function ReevaluationGate({ eligible, stale, onRequest }: { eligible: boolean; stale: boolean; onRequest: () => void }) {
  const { dict } = useLocale();
  const explanation = stale ? dict.managerIntervention.staleReview : eligible ? dict.managerIntervention.reevaluationEligible : dict.managerIntervention.reevaluationIneligible;
  return <div className="rounded-lg border border-sky-900 p-3"><p className="text-sm font-medium text-sky-100">{dict.managerIntervention.reevaluationGate}</p><p id="reevaluation-gate-explanation" className="mt-1 text-xs text-neutral-400" dir="auto">{explanation}</p><button type="button" className="mt-3 rounded bg-sky-800 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-700" disabled={!eligible} aria-describedby="reevaluation-gate-explanation" onClick={onRequest}>{dict.managerIntervention.requestReevaluation}</button></div>;
}

export function DecisionSnapshotComparison({ snapshot, intervention }: { snapshot: DecisionSnapshot; intervention: ManagerInterventionFixture }) {
  const { dict } = useLocale();
  const after = intervention.reevaluatedSnapshot;
  if (!after) return null;
  return <section className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/10 p-3" data-testid="manager-snapshot-comparison" aria-live="polite"><h3 className="text-sm font-semibold text-emerald-100">{dict.comparison.title}</h3><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-neutral-500">{dict.managerIntervention.previousSnapshot}</p><p className="font-mono text-sm text-neutral-200" dir="auto">{snapshot.snapshotId}</p><p className="text-sm text-neutral-300">{dict.decisionState[snapshot.decisionState]}</p></div><div><p className="text-xs text-neutral-500">{dict.managerIntervention.currentSnapshot}</p><p className="font-mono text-sm text-neutral-200" dir="auto">{after.snapshotId}</p><p className="text-sm text-neutral-300">{dict.decisionState[after.decisionState]}</p></div></div><dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-neutral-500">{dict.managerIntervention.evidenceDelta}</dt><dd className="text-neutral-200">{after.evidenceDelta}</dd></div><div><dt className="text-neutral-500">{dict.managerIntervention.contradictionCount}</dt><dd className="text-neutral-200">{after.contradictionCount}</dd></div>{after.restraintState ? <div><dt className="text-neutral-500">{dict.managerIntervention.restraintState}</dt><dd className="text-neutral-200" dir="auto">{after.restraintState}</dd></div> : null}<div><dt className="text-neutral-500">{dict.managerIntervention.uncertainty}</dt><dd className="text-neutral-200" dir="auto">{after.uncertainty}</dd></div></dl><p className="text-sm text-neutral-200" dir="auto">{after.changeReason}</p>{after.decisionState === snapshot.decisionState ? <p className="text-xs text-emerald-300">{dict.managerIntervention.decisionUnchanged}</p> : null}<p className="text-xs text-neutral-400">{dict.managerIntervention.preservedHistory}</p></section>;
}

export function ManagerInterventionTimeline({ state, contributions, staleReason }: { state: ManagerInterventionState; contributions: readonly ManagerContribution[]; staleReason?: string }) {
  const { dict } = useLocale();
  return <section><h3 className="text-sm font-medium text-neutral-200">{dict.managerIntervention.timeline}</h3><ol className="mt-2 space-y-1 text-xs text-neutral-400" data-testid="manager-intervention-timeline"><li>{dict.managerIntervention.states[state]}</li>{contributions.map((contribution) => <li key={contribution.id}>{dict.managerIntervention.validationStates[contribution.validation]}: <span dir="auto">{contribution.summary}</span></li>)}{staleReason ? <li dir="auto">{staleReason}</li> : null}</ol></section>;
}
