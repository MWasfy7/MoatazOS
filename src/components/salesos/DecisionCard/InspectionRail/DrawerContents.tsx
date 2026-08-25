"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DecisionHistoryStrip } from "../DecisionHistoryStrip";

const GROUP_ORDER = ["validated", "contradictory", "pending", "excluded"] as const;

/** Evidence Drawer: contradictions visible by default; pending explicitly
 * marked as unused; excluded items remain inspectable, never hidden;
 * raw buyer messages never rendered - only the bounded label. */
export function EvidenceDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  return (
    <div className="space-y-5">
      {GROUP_ORDER.map((group) => {
        const items = snapshot.evidence.filter((e) => e.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {dict.evidenceDrawer[group]}
            </h4>
            <ul className="mt-2 space-y-2">
              {items.map((item) => (
                <li key={item.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-2.5 text-sm text-neutral-200">
                  {item.label}
                  {item.exclusionReason ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      {dict.evidenceDrawer.excludedReason}: {item.exclusionReason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Why This Decision: product-level conditions only - satisfied /
 * unsatisfied / contradicted / unresolved. Never a raw threshold. */
export function WhyThisDecisionDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  if (snapshot.conditions.length === 0) {
    return <p className="text-sm text-neutral-500">—</p>;
  }
  return (
    <ul className="space-y-2">
      {snapshot.conditions.map((condition) => (
        <li key={condition.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-2.5 text-sm">
          <span className="font-semibold text-neutral-300">{dict.conditionStatus[condition.status]}</span>
          <span className="ms-2 text-neutral-300">{condition.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Uncertainty: known / unknown / contradicted / not-established -
 * never a purchase probability of any kind. */
export function UncertaintyDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const known = snapshot.evidence.filter((e) => e.group === "validated").map((e) => e.label);
  const contradicted = snapshot.evidence.filter((e) => e.group === "contradictory").map((e) => e.label);
  const unknown =
    snapshot.decisionState === "INSUFFICIENT_EVIDENCE" ? snapshot.insufficiency.unknownEvidenceClasses : [];
  const notEstablished = snapshot.conditions.filter((c) => c.status === "unresolved").map((c) => c.label);

  const sections: Array<[string, string[]]> = [
    [dict.uncertaintyDrawer.known, known],
    [dict.uncertaintyDrawer.unknown, unknown],
    [dict.uncertaintyDrawer.contradicted, contradicted],
    [dict.uncertaintyDrawer.notEstablished, notEstablished],
  ];

  return (
    <div className="space-y-4">
      {sections.map(([label, items]) =>
        items.length > 0 ? (
          <section key={label}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</h4>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-neutral-300">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}

/** Buyer Signals: only attributable, validated buyer/delegate signals.
 * Seller activity, CRM stage, manager opinion are never modeled here. */
export function BuyerSignalsDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  if (snapshot.buyerSignals.length === 0) {
    return <p className="text-sm text-neutral-500">{dict.buyerSignalsDrawer.empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {snapshot.buyerSignals.map((signal) => (
        <li key={signal.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-200">{signal.label}</span>
            <span className={`text-xs font-semibold ${signal.validated ? "text-emerald-400" : "text-amber-400"}`}>
              {signal.validated ? dict.buyerSignalsDrawer.validated : dict.buyerSignalsDrawer.notValidated}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {signal.attributedTo === "buyer"
              ? dict.buyerSignalsDrawer.attributedToBuyer
              : dict.buyerSignalsDrawer.attributedToDelegate}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Manager Review: this milestone has no manager-review data source
 * wired up yet - shown honestly as empty, never fabricated. */
export function ManagerReviewDrawerContent() {
  const { dict } = useLocale();
  return <p className="text-sm text-neutral-500">{dict.managerReviewDrawer.empty}</p>;
}

/** Pilot Evidence: same honesty rule as Manager Review. */
export function PilotEvidenceDrawerContent() {
  const { dict } = useLocale();
  return <p className="text-sm text-neutral-500">{dict.pilotEvidenceDrawer.empty}</p>;
}

/** History: delegates to the same append-only strip shown on the card,
 * so the drawer and the inline strip can never disagree. */
export function HistoryDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  return <DecisionHistoryStrip snapshot={snapshot} />;
}

/** Provenance: full identity triple, never abbreviated or guessed. */
export function ProvenanceDrawerContent({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const { provenance, opportunityId } = snapshot;
  const rows: Array<[string, string]> = [
    [dict.provenanceDrawer.opportunityId, opportunityId],
    [dict.provenanceDrawer.snapshotId, provenance.snapshotId],
    [dict.provenanceDrawer.eventSetId, provenance.eventSetId],
    [dict.provenanceDrawer.fixtureId, provenance.fixtureId],
    [dict.provenanceDrawer.generatedAt, provenance.generatedAt],
    [dict.provenanceDrawer.source, provenance.source],
  ];
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
          <dd className="font-mono text-neutral-200" dir="ltr">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
