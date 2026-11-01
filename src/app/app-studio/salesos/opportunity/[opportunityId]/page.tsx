"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getOpportunity, getSnapshot, OPPORTUNITIES } from "@/lib/fixtures";
import { OpportunityList } from "@/components/salesos/OpportunityList";
import { DecisionCard } from "@/components/salesos/DecisionCard/DecisionCard";
import { SnapshotComparisonView } from "@/components/salesos/DecisionCard/SnapshotComparison/SnapshotComparisonView";
import Link from "next/link";

export default function OpportunityPage({ params }: { params: { opportunityId: string } }) {
  const { opportunityId } = params;
  const { dict } = useLocale();
  const [comparing, setComparing] = useState(false);

  const opportunity = getOpportunity(opportunityId);
  const snapshot = opportunity ? getSnapshot(opportunity.currentSnapshotId) : undefined;

  if (!opportunity || !snapshot) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8 text-center">
          <p className="text-sm text-neutral-400">{dict.errors.notFound}</p>
        </div>
      </div>
    );
  }

  const newerSnapshot =
    "newerSnapshotId" in snapshot && snapshot.newerSnapshotId ? getSnapshot(snapshot.newerSnapshotId) : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[320px_1fr]">
      <section aria-label={dict.commandCenter.opportunityListTitle} className="hidden lg:block">
        <OpportunityList opportunities={OPPORTUNITIES} />
      </section>

      <section>
        <Link href={`/app-studio/donna/council/${opportunity.opportunityId}`} className="mb-4 block rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-sm font-semibold text-amber-200">{dict.council.openFromSales} →</Link>
        {comparing && newerSnapshot ? (
          <SnapshotComparisonView before={snapshot} after={newerSnapshot} onBack={() => setComparing(false)} />
        ) : (
          <DecisionCard snapshot={snapshot} onCompare={newerSnapshot ? () => setComparing(true) : undefined} />
        )}
      </section>
    </div>
  );
}
