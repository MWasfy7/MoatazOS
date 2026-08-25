"use client";

import type { NoActionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * NO_ACTION is a protected restraint state, not an empty state. This
 * panel's visual weight (the restraint block) must outrank the
 * optional evidence-navigation content below it. There is no
 * countdown, no "overdue" language, and no automatically-computed
 * next contact date anywhere here - only what the fixture itself
 * states as a reengagement *condition*, never a schedule.
 */
export function NoActionPanel({ snapshot }: { snapshot: NoActionSnapshot }) {
  const { dict } = useLocale();
  const restraint = snapshot.restraint;
  const conditions = restraint.reengagementConditions.map((condition) =>
    typeof condition === "string" ? { summary: condition } : condition,
  );
  return (
    <section
      className="rounded-lg border-2 border-neutral-700 bg-neutral-900 p-5"
      aria-labelledby="no-action-restraint-title"
      data-testid="no-action-restraint-review"
    >
      <h3 id="no-action-restraint-title" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {dict.decisionCard.restraintTitle}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div data-testid="restraint-reason-block">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Restraint reason</p>
          {restraint.reasonCode ? <p className="mt-1 text-xs font-semibold text-amber-300">{restraint.reasonCode}</p> : null}
          <p className="mt-1 text-base font-medium text-neutral-100" dir="auto">{restraint.reason}</p>
          {restraint.summary ? <p className="mt-1 text-sm text-neutral-300">{restraint.summary}</p> : null}
        </div>
        <div data-testid="no-action-snapshot-metadata" className="rounded border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-400">
          <p>Snapshot: {snapshot.snapshotId}</p>
          <p className="mt-1">Effective: {snapshot.provenance.generatedAt}</p>
          <p className="mt-1">Integrity: verified</p>
        </div>
      </div>

      {restraint.behavior ? (
        <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/60 p-3" data-testid="seller-behavior-review">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Seller behavior review</p>
          <p className="mt-1 text-sm font-semibold text-neutral-100">{restraint.behavior.state}</p>
          <p className="mt-1 text-sm text-neutral-300">{restraint.behavior.summary}</p>
          <p className="mt-1 text-xs text-neutral-500">Observation window: {restraint.behavior.observationWindow}</p>
        </div>
      ) : null}

      {restraint.uncertainty ? (
        <div className="mt-3 rounded border border-neutral-800 p-3" data-testid="no-action-uncertainty-panel">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Uncertainty</p>
          <p className="mt-1 text-sm font-semibold text-neutral-100">{restraint.uncertainty.state}</p>
          <p className="mt-1 text-sm text-neutral-300">{restraint.uncertainty.summary}</p>
        </div>
      ) : null}

      {restraint.doNotDoBehaviors.length > 0 ? (
        <div className="mt-4" data-testid="do-not-do-boundary">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.doNotDo}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-200">
            {restraint.doNotDoBehaviors.map((behavior) => <li key={behavior}>{behavior}</li>)}
          </ul>
        </div>
      ) : null}

      {conditions.length > 0 ? (
        <div className="mt-4 border-t border-neutral-800 pt-3" data-testid="reengagement-conditions">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.reengagementConditions}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
            {conditions.map((condition) => (
              <li key={condition.summary}>
                {"class" in condition ? `${condition.class}: ` : ""}{condition.summary}
                {"class" in condition && condition.class === "POLICY_DEFINED_WAIT_ELAPSED"
                  ? " Reevaluation only; it does not authorize contact."
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
