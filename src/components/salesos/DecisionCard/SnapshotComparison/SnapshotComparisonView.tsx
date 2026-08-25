"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionStateBadge } from "../../Badges";

export interface SnapshotComparisonViewProps {
  before: DecisionSnapshot;
  after: DecisionSnapshot;
  onBack: () => void;
}

function evidenceLabels(snapshot: DecisionSnapshot, group: "validated" | "contradictory"): string[] {
  return snapshot.evidence.filter((e) => e.group === group).map((e) => e.label);
}

function contradictionCount(snapshot: DecisionSnapshot): number {
  if (snapshot.decisionState === "NEXT_STEP_READY" || snapshot.decisionState === "CONTRADICTORY_EVIDENCE") {
    return snapshot.contradictions.length;
  }
  return 0;
}

/**
 * Compares two immutable snapshots explicitly and side by side. Never
 * silently replaces "before" with "after" - both remain fully visible,
 * and the comparison never asserts "wrong"/"overridden"/"incorrect"
 * language. "Decision unchanged" is rendered as a valid, ordinary
 * outcome, not a failure to find something to report.
 *
 * Before/after are labeled explicitly rather than relying on left/
 * right position, so the semantic order survives an RTL layout.
 */
export function SnapshotComparisonView({ before, after, onBack }: SnapshotComparisonViewProps) {
  const { dict } = useLocale();

  const beforeValidated = new Set(evidenceLabels(before, "validated"));
  const addedEvidence = evidenceLabels(after, "validated").filter((label) => !beforeValidated.has(label));

  const beforeContradictions = contradictionCount(before);
  const afterContradictions = contradictionCount(after);

  const unresolvedBefore = before.conditions.filter((c) => c.status === "unresolved").length;
  const unresolvedAfter = after.conditions.filter((c) => c.status === "unresolved").length;

  const decisionUnchanged = before.decisionState === after.decisionState;

  return (
    <section className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-testid="snapshot-comparison">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-50">{dict.comparison.title}</h2>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
        >
          {dict.comparison.back}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{dict.comparison.before}</p>
          <div className="mt-2">
            <DecisionStateBadge state={before.decisionState} />
          </div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{dict.comparison.after}</p>
          <div className="mt-2">
            <DecisionStateBadge state={after.decisionState} />
          </div>
        </div>
      </div>

      {decisionUnchanged ? (
        <p className="rounded-md border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-300">
          {dict.comparison.unchanged}
        </p>
      ) : null}

      {addedEvidence.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {dict.comparison.addedEvidence}
          </p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-neutral-300">
            {addedEvidence.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {afterContradictions > beforeContradictions ? (
        <p className="text-sm text-rose-300">
          {dict.comparison.contradictionsAdded}: {afterContradictions - beforeContradictions}
        </p>
      ) : null}
      {afterContradictions < beforeContradictions ? (
        <p className="text-sm text-emerald-300">
          {dict.comparison.contradictionsResolved}: {beforeContradictions - afterContradictions}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {dict.comparison.uncertaintyMovement}
        </p>
        <p className="mt-1 text-sm text-neutral-300">
          {dict.uncertaintyDrawer.notEstablished}: {unresolvedBefore} → {unresolvedAfter}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {dict.comparison.preservedHistory}
        </p>
        <p className="mt-1 text-sm text-neutral-300">
          {after.history.length} {dict.inspectionRail.history.toLowerCase()}
        </p>
      </div>
    </section>
  );
}
