"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * A compact count-only strip (validated / contradictory / pending /
 * excluded). Detail lives in the Evidence Drawer; this rail exists so
 * a seller can see at a glance whether contradictory or pending
 * evidence exists at all, without opening anything.
 */
export function EvidenceSummaryRail({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const counts = {
    validated: snapshot.evidence.filter((e) => e.group === "validated").length,
    contradictory: snapshot.evidence.filter((e) => e.group === "contradictory").length,
    pending: snapshot.evidence.filter((e) => e.group === "pending").length,
    excluded: snapshot.evidence.filter((e) => e.group === "excluded").length,
  };
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {(["validated", "contradictory", "pending", "excluded"] as const).map((group) =>
        counts[group] > 0 ? (
          <span
            key={group}
            className="rounded border border-neutral-700 px-2 py-1 text-neutral-300"
            data-evidence-group={group}
          >
            {dict.evidenceDrawer[group]}: <strong className="text-neutral-100">{counts[group]}</strong>
          </span>
        ) : null,
      )}
    </div>
  );
}
