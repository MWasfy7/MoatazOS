"use client";

import { useState } from "react";
import type { DecisionSnapshot } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Drawer } from "./Drawer";
import {
  EvidenceDrawerContent,
  WhyThisDecisionDrawerContent,
  UncertaintyDrawerContent,
  BuyerSignalsDrawerContent,
  ManagerReviewDrawerContent,
  PilotEvidenceDrawerContent,
  HistoryDrawerContent,
  ProvenanceDrawerContent,
} from "./DrawerContents";

type InspectionKey =
  | "evidence"
  | "whyThisDecision"
  | "uncertainty"
  | "buyerSignals"
  | "managerReview"
  | "pilotEvidence"
  | "history"
  | "provenance";

const ITEMS: InspectionKey[] = [
  "evidence",
  "whyThisDecision",
  "uncertainty",
  "buyerSignals",
  "managerReview",
  "pilotEvidence",
  "history",
  "provenance",
];

/**
 * The one canonical inspection rail. This is an inspection toolbar,
 * not an action toolbar - every item opens a read-only drawer pinned
 * to the exact snapshot currently on screen. No item here ever sends,
 * calls, schedules, writes, approves, or edits anything.
 */
export function InspectionRail({ snapshot }: { snapshot: DecisionSnapshot }) {
  const { dict } = useLocale();
  const [open, setOpen] = useState<InspectionKey | null>(null);

  const renderContent = (key: InspectionKey) => {
    switch (key) {
      case "evidence":
        return <EvidenceDrawerContent snapshot={snapshot} />;
      case "whyThisDecision":
        return <WhyThisDecisionDrawerContent snapshot={snapshot} />;
      case "uncertainty":
        return <UncertaintyDrawerContent snapshot={snapshot} />;
      case "buyerSignals":
        return <BuyerSignalsDrawerContent snapshot={snapshot} />;
      case "managerReview":
        return <ManagerReviewDrawerContent />;
      case "pilotEvidence":
        return <PilotEvidenceDrawerContent />;
      case "history":
        return <HistoryDrawerContent snapshot={snapshot} />;
      case "provenance":
        return <ProvenanceDrawerContent snapshot={snapshot} />;
    }
  };

  return (
    <nav aria-label={dict.inspectionRail.evidence} className="flex flex-wrap gap-2">
      {ITEMS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setOpen(key)}
          className="min-h-11 rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-600 hover:text-neutral-100"
          data-inspection-item={key}
        >
          {dict.inspectionRail[key]}
        </button>
      ))}

      {ITEMS.map((key) => (
        <Drawer key={key} title={dict.inspectionRail[key]} open={open === key} onClose={() => setOpen(null)}>
          {renderContent(key)}
        </Drawer>
      ))}
    </nav>
  );
}
