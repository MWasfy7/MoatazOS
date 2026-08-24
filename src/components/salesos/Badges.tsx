"use client";

import type { DecisionState, FreshnessState } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const DECISION_STATE_STYLE: Record<DecisionState, string> = {
  NO_ACTION: "border-neutral-600 text-neutral-200 bg-neutral-800/60",
  NEXT_STEP_READY: "border-emerald-700 text-emerald-300 bg-emerald-950/60",
  INSUFFICIENT_EVIDENCE: "border-amber-700 text-amber-300 bg-amber-950/60",
  CONTRADICTORY_EVIDENCE: "border-rose-700 text-rose-300 bg-rose-950/60",
};

export function DecisionStateBadge({ state, size = "md" }: { state: DecisionState; size?: "sm" | "md" | "lg" }) {
  const { dict } = useLocale();
  const sizeClass = size === "lg" ? "text-sm px-3 py-1.5" : size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-semibold uppercase tracking-wide ${DECISION_STATE_STYLE[state]} ${sizeClass}`}
      data-decision-state={state}
    >
      {dict.decisionState[state]}
    </span>
  );
}

const FRESHNESS_STYLE: Record<FreshnessState, string> = {
  CURRENT: "text-neutral-400 border-neutral-700",
  NEW_EVIDENCE_PENDING: "text-sky-300 border-sky-800",
  REEVALUATION_ELIGIBLE: "text-amber-300 border-amber-800",
  REEVALUATION_IN_PROGRESS: "text-amber-300 border-amber-800",
  NEW_SNAPSHOT_AVAILABLE: "text-sky-300 border-sky-800",
  SUPERSEDED: "text-neutral-500 border-neutral-700",
  STALE_CONTEXT: "text-neutral-500 border-neutral-700",
  INTEGRITY_BLOCKED: "text-rose-300 border-rose-800",
};

export function FreshnessBadge({ freshness }: { freshness: FreshnessState }) {
  const { dict } = useLocale();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${FRESHNESS_STYLE[freshness]}`}
      data-freshness={freshness}
    >
      {dict.freshness[freshness]}
    </span>
  );
}
