"use client";

import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function ProvenanceFooter({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const { provenance } = snapshot;
  return (
    <footer className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
      <span dir="ltr" className="font-mono">
        {dict.provenanceDrawer.snapshotId}: {provenance.snapshotId}
      </span>
      <span dir="ltr" className="font-mono">
        {dict.provenanceDrawer.eventSetId}: {provenance.eventSetId}
      </span>
      <span dir="auto">{provenance.source}</span>
    </footer>
  );
}
