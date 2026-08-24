"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { DecisionStateBadge, FreshnessBadge } from "../Badges";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function DecisionCardHeader({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  return (
    <header className="flex flex-col gap-2 border-b border-neutral-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {dict.commandCenter.title}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-50" dir="auto">
          {snapshot.buyerAlias}
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DecisionStateBadge state={snapshot.decisionState} size="lg" />
        <FreshnessBadge freshness={snapshot.freshness} />
      </div>
    </header>
  );
}
