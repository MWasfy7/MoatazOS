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
  return (
    <section
      className="rounded-lg border-2 border-neutral-700 bg-neutral-900 p-5"
      aria-labelledby="no-action-restraint-title"
    >
      <h3 id="no-action-restraint-title" className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
        {dict.decisionCard.restraintTitle}
      </h3>
      <p className="mt-2 text-base font-medium text-neutral-100" dir="auto">
        {snapshot.restraint.reason}
      </p>

      {snapshot.restraint.doNotDoBehaviors.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.doNotDo}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-200">
            {snapshot.restraint.doNotDoBehaviors.map((behavior) => (
              <li key={behavior}>{behavior}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {snapshot.restraint.reengagementConditions.length > 0 ? (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {dict.decisionCard.reengagementConditions}
          </p>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
            {snapshot.restraint.reengagementConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
