"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionStateBadge } from "../Badges";

/**
 * Append-only, read-only history. A restraint violation recorded here
 * remains visible even after a later positive outcome - history is
 * never edited or hidden to make a later decision look cleaner.
 */
export function DecisionHistoryStrip({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  if (snapshot.history.length === 0) {
    return <p className="text-sm text-neutral-500">{dict.historyDrawer.empty}</p>;
  }
  return (
    <ol className="space-y-3">
      {snapshot.history.map((event) => (
        <li
          key={event.id}
          className={`rounded-md border p-3 text-sm ${
            event.kind === "chasing_violation"
              ? "border-rose-800 bg-rose-950/20"
              : "border-neutral-800 bg-neutral-900/40"
          }`}
          data-history-kind={event.kind}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DecisionStateBadge state={event.decisionState} size="sm" />
            <time className="text-xs text-neutral-500" dateTime={event.occurredAt}>
              {event.occurredAt}
            </time>
          </div>
          <p className="mt-1.5 text-neutral-200">{event.summary}</p>
          {event.kind === "chasing_violation" ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-rose-400">
              {dict.decisionState.NO_ACTION}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
