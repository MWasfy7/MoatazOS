"use client";

import type { ContradictoryEvidenceSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * No majority voting, no "latest wins", no confidence averaging, no
 * manager tie-breaker. Both validated sides are shown with equal
 * visual weight (a two-column grid, not a stacked "primary vs
 * secondary" layout) so RTL layouts don't accidentally imply one
 * side is more authoritative via position alone.
 */
export function ContradictoryEvidencePanel({ snapshot }: { snapshot: ContradictoryEvidenceSnapshot }) {
  const { dict } = useLocale();
  return (
    <section className="space-y-4">
      {snapshot.contradictions.map((c) => (
        <div key={c.id} className="rounded-lg border border-rose-900 bg-rose-950/10 p-5">
          <p className="text-xs uppercase tracking-wide text-rose-400">
            {dict.decisionCard.contradictionConflictClass}
          </p>
          <p className="mt-1 text-base font-medium text-neutral-50">{c.conflictClass}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {dict.decisionCard.sideA}
              </p>
              <p className="mt-1 text-sm text-neutral-200">{c.sideA.label}</p>
            </div>
            <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {dict.decisionCard.sideB}
              </p>
              <p className="mt-1 text-sm text-neutral-200">{c.sideB.label}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {dict.decisionCard.establishedDespiteConflict}
              </p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
                {c.establishedDespiteConflict.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.cannotConclude}</p>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
                {c.cannotConclude.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 border-t border-rose-900/50 pt-3">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              {dict.decisionCard.resolutionEvidenceClasses}
            </p>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-300">
              {c.resolutionEvidenceClasses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </section>
  );
}
