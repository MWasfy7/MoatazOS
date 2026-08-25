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
  pilotReview: { title: "Pilot Evidence Review", open: "Open Pilot Evidence Review", readiness: "Evidence readiness", validatedEpisodes: "Validated episodes", excludedEpisodes: "Excluded episodes", companies: "Distinct companies", observationWindow: "Observation window", buyerReaction: "Buyer reaction", behavioralEvidence: "Behavioral evidence", regionalSplit: "Regional evidence split", commercialProgression: "Commercial progression", limitations: "Limitations and not proven", provenance: "Bounded provenance", disputeTimeline: "Disputes and corrections", notProven: "Not proven", insufficient: "Insufficient evidence", descriptiveOnly: "Descriptive only; not causal.", previous: "Previous immutable snapshot", current: "Current immutable snapshot", noAuthority: "This frozen review has no durable write or execution authority.", states: { NOT_REVIEWABLE: "Not reviewable", EVIDENCE_READY: "Evidence ready", BUYER_REVIEW_IN_PROGRESS: "Buyer review in progress", BUYER_DISPUTED: "Buyer disputed", BUYER_ACCEPTED_DIRECTIONAL: "Buyer accepted directionally", BUYER_ACCEPTED_DECISION_USEFUL: "Buyer accepted as decision-useful", COMMERCIAL_NEXT_STEP_PRESENT: "Commercial next step present", SUPERSEDED: "Superseded" } },
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
    restraintReason: "Restraint reason",
    snapshotLabel: "Snapshot",
    effectiveLabel: "Effective",
    sellerBehaviorReview: "Seller behavior review",
    observationWindow: "Observation window",
    restraintObservability: "Restraint observability",
    reevaluationOnlyNotice: "Reevaluation only; it does not authorize contact.",
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
  managerIntervention: {
    title: "Manager intervention review",
    openReview: "Open manager review",
    closeReview: "Close manager review",
    reviewedSnapshot: "Reviewed snapshot",
    currentDecision: "Current decision",
    disagreement: "Manager disagreement",
    commentary: "Commentary",
    commentaryOnly: "Commentary only; it does not enter decision computation.",
    contribution: "Contribution",
    contributionType: "Contribution type",
    validation: "Validation",
    manager: "Manager",
    addEvidence: "Add evidence",
    correctContext: "Correct context",
    flagIntegrity: "Flag integrity",
    recordContribution: "Record structured contribution",
    recordedContributionSummary: "Locally recorded for review; it does not enter decision computation.",
    localManagerAlias: "Manager M-local",
    reevaluationGate: "Reevaluation gate",
    reevaluationEligible: "Validated, materially relevant evidence permits reevaluation only.",
    reevaluationIneligible: "Reevaluation requires validated, materially relevant evidence.",
    staleReview: "This review is stale and cannot request reevaluation.",
    requestReevaluation: "Request reevaluation",
    previousSnapshot: "Previous immutable snapshot",
    currentSnapshot: "Current immutable snapshot",
    evidenceDelta: "Validated evidence delta",
    contradictionCount: "Contradiction count",
    restraintState: "Preserved restraint state",
    uncertainty: "Uncertainty",
    changeReason: "Change reason",
    decisionUnchanged: "Decision unchanged after reevaluation.",
    preservedHistory: "Historical record preserved",
    timeline: "Manager intervention timeline",
    noAuthority: "This review cannot override a decision, set confidence, or authorize execution.",
    states: {
      NO_INTERVENTION: "No intervention", REVIEWING: "Reviewing", COMMENTARY_ONLY: "Commentary only", EVIDENCE_SUBMITTED_PENDING_VALIDATION: "Evidence pending validation", CONTEXT_CORRECTION_PENDING_VALIDATION: "Context correction pending validation", REEVALUATION_REQUESTED: "Reevaluation requested", REEVALUATED_NEW_SNAPSHOT: "Reevaluated with a new snapshot", REJECTED_EVIDENCE: "Rejected evidence", STALE_REVIEW: "Stale review",
    },
    contributionTypes: {
      NEW_BUYER_EVIDENCE: "New buyer evidence", PROCUREMENT_EVIDENCE: "Procurement evidence", TIMING_CONTEXT: "Timing context", SOURCE_CORRECTION: "Source correction", SELLER_ACTIVITY_CORRECTION: "Seller activity correction", INTEGRITY_FLAG: "Integrity flag", COMMENTARY_ONLY: "Commentary only",
    },
    validationStates: { NOT_REQUIRED: "Not required", PENDING: "Pending validation", VALIDATED: "Validated", REJECTED: "Rejected", EXCLUDED: "Excluded" },
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
