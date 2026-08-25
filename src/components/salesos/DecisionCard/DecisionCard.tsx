"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { checkSnapshotIntegrity } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionCardHeader } from "./DecisionCardHeader";
import { DecisionStateHero } from "./DecisionStateHero";
import { DecisionReasonSummary } from "./DecisionReasonSummary";
import { EvidenceSummaryRail } from "./EvidenceSummaryRail";
import { FreshnessStateBanner } from "./FreshnessState";
import { DecisionHistoryStrip } from "./DecisionHistoryStrip";
import { ProvenanceFooter } from "./ProvenanceFooter";
import { InspectionRail } from "./InspectionRail/InspectionRail";
import { NoActionPanel } from "./panels/NoActionPanel";
import { NextStepReadyPanel } from "./panels/NextStepReadyPanel";
import { InsufficientEvidencePanel } from "./panels/InsufficientEvidencePanel";
import { ContradictoryEvidencePanel } from "./panels/ContradictoryEvidencePanel";
import { ManagerInterventionReview } from "./ManagerInterventionReview";

export interface DecisionCardProps {
  snapshot: DecisionSnapshot;
  onCompare?: () => void;
}

/**
 * Renders one immutable Decision Card. If the snapshot's evidence
 * does not match its own identity (integrity check fails), this
 * suppresses ALL interpretive content and renders only the
 * integrity-blocked state - it never falls through to a "best guess"
 * partial render.
 */
export function DecisionCard({ snapshot, onCompare }: DecisionCardProps) {
  const { dict } = useLocale();
  const integrity = checkSnapshotIntegrity(snapshot);

  if (!integrity.ok) {
    return (
      <article
        className="space-y-4 rounded-xl border-2 border-rose-800 bg-rose-950/10 p-5"
        data-testid="integrity-blocked-card"
      >
        <DecisionCardHeader snapshot={snapshot} />
        <div className="rounded-lg border border-rose-800 bg-rose-950/30 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-rose-400">
            {dict.decisionCard.integrityBlockedTitle}
          </p>
          <p className="mt-2 text-sm text-neutral-200">{dict.decisionCard.integrityBlockedBody}</p>
        </div>
        <ProvenanceFooter snapshot={snapshot} />
      </article>
    );
  }

  return (
    <article className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-950 p-5" data-testid="decision-card">
      <DecisionCardHeader snapshot={snapshot} />

      <FreshnessStateBanner snapshot={snapshot} onCompare={onCompare} />

      <DecisionStateHero snapshot={snapshot} />

      {snapshot.decisionState === "NO_ACTION" ? <NoActionPanel snapshot={snapshot} /> : null}
      {snapshot.decisionState === "NEXT_STEP_READY" ? <NextStepReadyPanel snapshot={snapshot} /> : null}
      {snapshot.decisionState === "INSUFFICIENT_EVIDENCE" ? (
        <InsufficientEvidencePanel snapshot={snapshot} />
      ) : null}
      {snapshot.decisionState === "CONTRADICTORY_EVIDENCE" ? (
        <ContradictoryEvidencePanel snapshot={snapshot} />
      ) : null}

      <ManagerInterventionReview snapshot={snapshot} />

      <DecisionReasonSummary snapshot={snapshot} />

      <EvidenceSummaryRail snapshot={snapshot} />

      <InspectionRail snapshot={snapshot} />

      <section aria-label={dict.inspectionRail.history}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {dict.inspectionRail.history}
        </h3>
        <DecisionHistoryStrip snapshot={snapshot} />
      </section>

      <ProvenanceFooter snapshot={snapshot} />
    </article>
  );
}
