"use client";

import type { NextStepReadySnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * NEXT_STEP_READY names a bounded next-step CLASS - never an
 * imperative action. There is intentionally no button, link, or
 * control here that could be mistaken for Send / Call / Schedule.
 * Contradictions (if any) remain visible on this same panel rather
 * than being hidden because readiness was reached.
 */
export function NextStepReadyPanel({ snapshot }: { snapshot: NextStepReadySnapshot }) {
  const { dict } = useLocale();
  return (
    <section className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-5" data-testid="next-step-ready-panel">
      <p className="text-xs uppercase tracking-wide text-emerald-400">{dict.decisionCard.nextStepClassLabel}</p>
      <p className="mt-1 text-base font-medium text-neutral-50">
        {dict.nextStepClass[snapshot.nextStep.stepClass]}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.whyNow}</dt>
          <dd className="mt-1 text-sm text-neutral-200">
            {snapshot.evidence
              .filter((e) => snapshot.nextStep.whyNowEvidenceIds.includes(e.id))
              .map((e) => e.label)
              .join(" ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.buyerSignalClass}</dt>
          <dd className="mt-1 text-sm text-neutral-200">{snapshot.nextStep.buyerSignalClass}</dd>
        </div>
      </dl>

      {snapshot.nextStep.restraintChecks.length > 0 ? (
        <div className="mt-4 border-t border-emerald-900/60 pt-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.restraintChecks}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
            {snapshot.nextStep.restraintChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.contradictions.length > 0 ? (
        <div className="mt-4 rounded-md border border-rose-900 bg-rose-950/30 p-3">
          <p className="text-xs uppercase tracking-wide text-rose-400">
            {dict.decisionState.CONTRADICTORY_EVIDENCE}
          </p>
          {snapshot.contradictions.map((c) => (
            <p key={c.id} className="mt-1 text-sm text-neutral-200">
              {c.conflictClass}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
