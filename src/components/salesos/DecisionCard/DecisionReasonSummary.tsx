"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const STATUS_STYLE: Record<string, string> = {
  satisfied: "text-emerald-400",
  unsatisfied: "text-neutral-400",
  contradicted: "text-rose-400",
  unresolved: "text-amber-400",
};

/**
 * A compact, scannable summary of the product-level conditions behind
 * the decision - never a raw model threshold or hidden weight, only
 * named conditions and their status.
 */
export function DecisionReasonSummary({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  if (snapshot.conditions.length === 0) return null;
  return (
    <section aria-label={dict.decisionCard.whyThisDecision} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{dict.decisionCard.whyThisDecision}</p>
      <ul className="mt-2 space-y-1.5">
        {snapshot.conditions.map((condition) => (
          <li key={condition.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 font-semibold ${STATUS_STYLE[condition.status] ?? "text-neutral-400"}`}>
              {dict.conditionStatus[condition.status]}
            </span>
            <span className="text-neutral-300">{condition.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
