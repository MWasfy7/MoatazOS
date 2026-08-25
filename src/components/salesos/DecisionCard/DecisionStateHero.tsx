"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The single most important visual element on the card: the current
 * decision state, rendered large enough that it visually outranks
 * every optional evidence-navigation affordance below it. Every
 * headline string is looked up from the locale dictionary - never
 * hard-coded English - so this genuinely translates, not just
 * right-aligns.
 */
export function DecisionStateHero({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();

  const headline =
    snapshot.decisionState === "NO_ACTION"
      ? snapshot.restraint.reason
      : dict.decisionCard.headline[snapshot.decisionState];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {dict.decisionState[snapshot.decisionState]}
      </p>
      <p className="mt-2 text-lg font-medium leading-snug text-neutral-100" dir="auto">
        {headline}
      </p>
    </div>
  );
}
