export const en = {
  locale: "en",
  dir: "ltr" as const,
  appStudio: {
    title: "MoatazOS App Studio",
    modules: {
      salesos: "SalesOS",
      performanceos: "PerformanceOS",
      revenueos: "RevenueOS",
      analyticsos: "AnalyticsOS",
      jarvis: "Jarvis",
    },
    futureModule: "Coming soon",
  },
  commandCenter: {
    title: "Command Center",
    opportunityListTitle: "Opportunities",
    selectPrompt: "Select an opportunity to inspect its decision.",
  },
  decisionState: {
    NO_ACTION: "No action",
    NEXT_STEP_READY: "Next step ready",
    INSUFFICIENT_EVIDENCE: "Insufficient evidence",
    CONTRADICTORY_EVIDENCE: "Contradictory evidence",
  },
  freshness: {
    CURRENT: "Current",
    NEW_EVIDENCE_PENDING: "New evidence pending review",
    REEVALUATION_ELIGIBLE: "Reevaluation eligible",
    REEVALUATION_IN_PROGRESS: "Reevaluation in progress",
    NEW_SNAPSHOT_AVAILABLE: "A newer snapshot is available",
    SUPERSEDED: "Superseded by a later snapshot",
    STALE_CONTEXT: "Context may be stale",
    INTEGRITY_BLOCKED: "Integrity check blocked",
  },
  decisionCard: {
    restraintTitle: "Active restraint",
    doNotDo: "Do not",
    reengagementConditions: "Would change this",
    whyThisDecision: "Why this decision",
    known: "Known",
    missing: "Missing",
    unknownClasses: "Unknown evidence classes",
    strongerReviewWouldRequire: "A stronger review would require",
    contradictionConflictClass: "Conflict",
    sideA: "Side A",
    sideB: "Side B",
    establishedDespiteConflict: "Established despite the conflict",
    cannotConclude: "Cannot currently conclude",
    resolutionEvidenceClasses: "Would help resolve this",
    nextStepClassLabel: "Supported next-step class",
    whyNow: "Why now",
    buyerSignalClass: "Buyer signal class",
    restraintChecks: "Restraint checks",
    reevaluationEligibleBanner: "A validated signal makes this eligible for reevaluation.",
    newSnapshotBanner: "A newer snapshot exists for this opportunity.",
    compareSnapshots: "Compare snapshots",
    integrityBlockedTitle: "Integrity check failed",
    integrityBlockedBody: "This snapshot's evidence does not match its own identity. Interpretive content has been suppressed rather than shown as a partial or best-guess decision.",
    headline: {
      NEXT_STEP_READY: "Current evidence supports this next-step class.",
      INSUFFICIENT_EVIDENCE: "Current evidence is not sufficient to support a bounded decision.",
      CONTRADICTORY_EVIDENCE: "Validated evidence conflicts; no single conclusion is currently supported.",
    },
  },
  nextStepClass: {
    RESPOND_TO_BUYER_REQUEST: "Respond to buyer request",
    PROVIDE_REQUESTED_INFORMATION: "Provide requested information",
    QUALIFY_STATED_REQUIREMENT: "Qualify stated requirement",
    PREPARE_BUYER_REQUESTED_PROPOSAL_REVIEW: "Prepare buyer-requested proposal review",
    SUPPORT_BUYER_INITIATED_COMMERCIAL_REVIEW: "Support buyer-initiated commercial review",
  },
  inspectionRail: {
    evidence: "Evidence",
    whyThisDecision: "Why this decision",
    uncertainty: "Uncertainty",
    buyerSignals: "Buyer signals",
    managerReview: "Manager review",
    pilotEvidence: "Pilot evidence",
    history: "History",
    provenance: "Provenance",
    close: "Close",
  },
  evidenceDrawer: {
    validated: "Validated, decision-grade",
    contradictory: "Contradictory",
    pending: "Pending — not used in current decision",
    excluded: "Excluded / rejected",
    excludedReason: "Reason excluded",
  },
  conditionStatus: {
    satisfied: "Satisfied",
    unsatisfied: "Unsatisfied",
    contradicted: "Contradicted",
    unresolved: "Unresolved",
  },
  uncertaintyDrawer: {
    known: "Known",
    unknown: "Unknown",
    contradicted: "Contradicted",
    notEstablished: "Not established",
  },
  buyerSignalsDrawer: {
    attributedToBuyer: "Buyer",
    attributedToDelegate: "Buyer delegate",
    validated: "Validated",
    notValidated: "Not yet validated",
    empty: "No attributable buyer signals in this snapshot.",
  },
  managerReviewDrawer: {
    empty: "No manager review has been recorded for this snapshot.",
  },
  pilotEvidenceDrawer: {
    empty: "No pilot-level evidence is attached to this snapshot in this milestone.",
  },
  historyDrawer: {
    empty: "No history recorded.",
  },
  provenanceDrawer: {
    opportunityId: "Opportunity ID",
    snapshotId: "Snapshot ID",
    eventSetId: "Event-set ID",
    fixtureId: "Fixture",
    generatedAt: "Generated at",
    source: "Source",
  },
  comparison: {
    title: "Compare snapshots",
    before: "Before",
    after: "After",
    decisionBefore: "Decision before",
    decisionAfter: "Decision after",
    addedEvidence: "Added validated evidence",
    contradictionsAdded: "Contradictions added",
    contradictionsResolved: "Contradictions resolved",
    transition: "Restraint / readiness transition",
    uncertaintyMovement: "Uncertainty movement",
    preservedHistory: "Preserved history",
    unchanged: "The decision is unchanged after reevaluation.",
    back: "Back to current snapshot",
  },
  errors: {
    notFound: "This opportunity could not be found in the current data source.",
  },
  demo: {
    badge: "DEMO DATA",
  },
  locale_switch: {
    label: "Language",
    en: "English",
    ar: "العربية",
  },
} as const;

type DeepWiden<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends readonly (infer U)[] ? readonly DeepWiden<U>[] :
  T extends object ? { [K in keyof T]: DeepWiden<T[K]> } :
  T;

/**
 * Preserve the dictionary key structure while widening translated leaf values.
 * Using `typeof en` directly would freeze every leaf to its English literal and
 * make a valid Arabic dictionary fail TypeScript assignment.
 */
export type Dictionary = DeepWiden<typeof en> & {
  locale: "en" | "ar";
  dir: "ltr" | "rtl";
};
