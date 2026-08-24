"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Freshness is metadata only - it NEVER mutates the pinned decision
 * above it. This banner only ever offers navigation to an explicit
 * comparison flow; it never silently swaps the rendered decision.
 */
export function FreshnessStateBanner({
  snapshot,
  onCompare,
}: {
  snapshot: DecisionSnapshot;
  onCompare?: () => void;
}) {
  const { dict } = useLocale();

  if (snapshot.freshness === "REEVALUATION_ELIGIBLE" && snapshot.reevaluationEligible) {
    return (
      <div className="rounded-md border border-amber-800 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
        {dict.decisionCard.reevaluationEligibleBanner}
        {snapshot.reevaluationReason ? (
          <p className="mt-1 text-xs text-amber-300/80">{snapshot.reevaluationReason}</p>
        ) : null}
      </div>
    );
  }

  if (snapshot.freshness === "NEW_SNAPSHOT_AVAILABLE" && snapshot.newerSnapshotId) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-800 bg-sky-950/20 px-4 py-3 text-sm text-sky-200">
        <span>{dict.decisionCard.newSnapshotBanner}</span>
        {onCompare ? (
          <button
            type="button"
            onClick={onCompare}
            className="rounded border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/40"
          >
            {dict.decisionCard.compareSnapshots}
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
