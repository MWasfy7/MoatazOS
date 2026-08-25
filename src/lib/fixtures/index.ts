/**
 * Deterministic synthetic fixtures for MoatazOS M0.
 *
 * Every name, alias, and evidence label below is fictional. No real
 * buyer data, phone numbers, or messages appear anywhere in this
 * file. Timestamps are fixture-authored constants, never generated
 * from the system clock, so the app's output is fully deterministic
 * across every run.
 */

import type {
  ContradictoryEvidenceSnapshot,
  DecisionSnapshot,
  InsufficientEvidenceSnapshot,
  NextStepReadySnapshot,
  NoActionSnapshot,
  Opportunity,
} from "../types";

// ---------------------------------------------------------------------------
// Fixture 1 — NO_ACTION
// Validated evidence exists; no supported buyer next-step trigger;
// active restraint; no pending evidence.
// ---------------------------------------------------------------------------

export const FIXTURE_1_NO_ACTION: NoActionSnapshot = {
  opportunityId: "opp-farah",
  snapshotId: "snap-farah-001",
  eventSetId: "evset-farah-001",
  fixtureId: "fixture-1-no-action",
  buyerAlias: "F. Al-Sayed",
  decisionState: "NO_ACTION",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-farah-001",
    eventSetId: "evset-farah-001",
    fixtureId: "fixture-1-no-action",
    generatedAt: "2026-06-01T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-farah-1", label: "Buyer requested a brochure two weeks ago.", group: "validated", snapshotId: "snap-farah-001" },
    { id: "ev-farah-2", label: "Buyer has not replied since the brochure was sent.", group: "validated", snapshotId: "snap-farah-001" },
  ],
  buyerSignals: [],
  conditions: [
    { id: "cond-farah-1", label: "An explicit buyer-initiated trigger for a next step", status: "unsatisfied" },
    { id: "cond-farah-2", label: "No active restraint condition", status: "contradicted" },
  ],
  history: [
    { id: "hist-farah-1", kind: "decision_recorded", occurredAt: "2026-06-01T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-farah-001" },
  ],
  restraint: {
    reason: "No action recommended from this evidence snapshot.",
    doNotDoBehaviors: [
      "Do not send a follow-up message asking if the buyer is still interested.",
      "Do not call to check in.",
      "Do not escalate outreach frequency.",
    ],
    reengagementConditions: [
      "Buyer replies or initiates contact.",
      "Buyer states a new timing preference.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Fixture 2 — NO_ACTION + Pending Evidence
// Current decision remains NO_ACTION; one pending buyer signal;
// pending evidence does not unlock reevaluation.
// ---------------------------------------------------------------------------

export const FIXTURE_2_NO_ACTION_PENDING: NoActionSnapshot = {
  opportunityId: "opp-tariq",
  snapshotId: "snap-tariq-001",
  eventSetId: "evset-tariq-001",
  fixtureId: "fixture-2-no-action-pending",
  buyerAlias: "T. Nour",
  decisionState: "NO_ACTION",
  freshness: "NEW_EVIDENCE_PENDING",
  provenance: {
    snapshotId: "snap-tariq-001",
    eventSetId: "evset-tariq-001",
    fixtureId: "fixture-2-no-action-pending",
    generatedAt: "2026-06-02T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-tariq-1", label: "Buyer viewed one listing three weeks ago.", group: "validated", snapshotId: "snap-tariq-001" },
    { id: "ev-tariq-2", label: "An unvalidated message was received and is awaiting review.", group: "pending", snapshotId: "snap-tariq-001" },
  ],
  buyerSignals: [
    { id: "sig-tariq-1", label: "Possible renewed interest (not yet validated).", attributedTo: "buyer", validated: false, snapshotId: "snap-tariq-001" },
  ],
  conditions: [
    { id: "cond-tariq-1", label: "An explicit, validated buyer-initiated trigger for a next step", status: "unsatisfied" },
  ],
  history: [
    { id: "hist-tariq-1", kind: "decision_recorded", occurredAt: "2026-06-02T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-tariq-001" },
  ],
  restraint: {
    reason: "No action recommended from this evidence snapshot. Pending evidence has not been validated and does not change this.",
    doNotDoBehaviors: [
      "Do not treat the pending message as confirmed renewed interest.",
      "Do not initiate contact based on unvalidated evidence.",
    ],
    reengagementConditions: ["The pending signal is validated.", "Buyer initiates direct contact."],
  },
};

// ---------------------------------------------------------------------------
// Fixture 3 — NO_ACTION + Reevaluation Eligible
// Validated buyer signal exists; current decision still NO_ACTION;
// restraint remains active; reevaluation eligible metadata visible.
// ---------------------------------------------------------------------------

export const FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE: NoActionSnapshot = {
  opportunityId: "opp-sara",
  snapshotId: "snap-sara-001",
  eventSetId: "evset-sara-001",
  fixtureId: "fixture-3-no-action-reeval-eligible",
  buyerAlias: "S. Hamdy",
  decisionState: "NO_ACTION",
  freshness: "REEVALUATION_ELIGIBLE",
  provenance: {
    snapshotId: "snap-sara-001",
    eventSetId: "evset-sara-001",
    fixtureId: "fixture-3-no-action-reeval-eligible",
    generatedAt: "2026-06-03T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-sara-1", label: "Buyer confirmed a validated new inquiry into pricing tiers.", group: "validated", snapshotId: "snap-sara-001" },
  ],
  buyerSignals: [
    { id: "sig-sara-1", label: "Validated renewed interest in pricing.", attributedTo: "buyer", validated: true, snapshotId: "snap-sara-001" },
  ],
  conditions: [
    { id: "cond-sara-1", label: "A validated buyer signal exists", status: "satisfied" },
    { id: "cond-sara-2", label: "Reevaluation has been completed for this signal", status: "unresolved" },
  ],
  history: [
    { id: "hist-sara-1", kind: "decision_recorded", occurredAt: "2026-06-03T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-sara-001" },
  ],
  restraint: {
    reason: "No action recommended from this evidence snapshot. The current decision has not yet been reevaluated against the new validated signal.",
    doNotDoBehaviors: ["Do not treat reevaluation eligibility as an approved next step.", "Do not initiate contact before reevaluation completes."],
    reengagementConditions: ["Reevaluation completes and produces a different decision state."],
  },
  reevaluationEligible: true,
  reevaluationReason: "A validated buyer signal was recorded after this decision was made.",
};

// ---------------------------------------------------------------------------
// Fixture 4 — NEXT_STEP_READY
// Explicit buyer request; no restraint conflict; supported next-step
// class; no execution CTA.
// ---------------------------------------------------------------------------

export const FIXTURE_4_NEXT_STEP_READY: NextStepReadySnapshot = {
  opportunityId: "opp-ahmed",
  snapshotId: "snap-ahmed-001",
  eventSetId: "evset-ahmed-001",
  fixtureId: "fixture-4-next-step-ready",
  buyerAlias: "A. Hassan",
  decisionState: "NEXT_STEP_READY",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-ahmed-001",
    eventSetId: "evset-ahmed-001",
    fixtureId: "fixture-4-next-step-ready",
    generatedAt: "2026-06-04T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-ahmed-1", label: "Buyer explicitly asked for unit pricing by floor.", group: "validated", snapshotId: "snap-ahmed-001" },
    { id: "ev-ahmed-2", label: "Buyer confirmed they are the decision-maker.", group: "validated", snapshotId: "snap-ahmed-001" },
  ],
  buyerSignals: [
    { id: "sig-ahmed-1", label: "Explicit, validated request for pricing information.", attributedTo: "buyer", validated: true, snapshotId: "snap-ahmed-001" },
  ],
  conditions: [
    { id: "cond-ahmed-1", label: "An explicit buyer request exists", status: "satisfied" },
    { id: "cond-ahmed-2", label: "No active restraint condition", status: "satisfied" },
  ],
  history: [
    { id: "hist-ahmed-1", kind: "decision_recorded", occurredAt: "2026-06-04T09:00:00Z", decisionState: "NEXT_STEP_READY", summary: "Current evidence supports this next-step class.", snapshotId: "snap-ahmed-001" },
  ],
  nextStep: {
    stepClass: "PROVIDE_REQUESTED_INFORMATION",
    whyNowEvidenceIds: ["ev-ahmed-1"],
    buyerSignalClass: "Explicit information request",
    restraintChecks: ["No unresolved contradiction.", "No active stop condition."],
  },
  contradictions: [],
};

// ---------------------------------------------------------------------------
// Fixture 5 — NEXT_STEP_READY + Contradiction
// Valid buyer request; contradictory timing evidence; readiness
// remains current for the pinned snapshot; contradiction visible.
// ---------------------------------------------------------------------------

export const FIXTURE_5_NEXT_STEP_READY_CONTRADICTION: NextStepReadySnapshot = {
  opportunityId: "opp-nadia",
  snapshotId: "snap-nadia-001",
  eventSetId: "evset-nadia-001",
  fixtureId: "fixture-5-next-step-ready-contradiction",
  buyerAlias: "N. Saleh",
  decisionState: "NEXT_STEP_READY",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-nadia-001",
    eventSetId: "evset-nadia-001",
    fixtureId: "fixture-5-next-step-ready-contradiction",
    generatedAt: "2026-06-05T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-nadia-1", label: "Buyer explicitly asked to review a proposal.", group: "validated", snapshotId: "snap-nadia-001" },
    { id: "ev-nadia-2", label: "Buyer stated they want to move within a month.", group: "contradictory", snapshotId: "snap-nadia-001" },
    { id: "ev-nadia-3", label: "Buyer separately stated timing is not decided yet.", group: "contradictory", snapshotId: "snap-nadia-001" },
  ],
  buyerSignals: [
    { id: "sig-nadia-1", label: "Explicit, validated request for a proposal review.", attributedTo: "buyer", validated: true, snapshotId: "snap-nadia-001" },
  ],
  conditions: [
    { id: "cond-nadia-1", label: "An explicit buyer request exists", status: "satisfied" },
    { id: "cond-nadia-2", label: "Buyer timing is internally consistent", status: "contradicted" },
  ],
  history: [
    { id: "hist-nadia-1", kind: "decision_recorded", occurredAt: "2026-06-05T09:00:00Z", decisionState: "NEXT_STEP_READY", summary: "Current evidence supports this next-step class.", snapshotId: "snap-nadia-001" },
  ],
  nextStep: {
    stepClass: "PREPARE_BUYER_REQUESTED_PROPOSAL_REVIEW",
    whyNowEvidenceIds: ["ev-nadia-1"],
    buyerSignalClass: "Explicit proposal-review request",
    restraintChecks: ["No unresolved contradiction affecting the proposal-review request itself."],
  },
  contradictions: [
    {
      id: "conf-nadia-1",
      conflictClass: "Buyer timing statements disagree",
      sideA: { label: "Buyer wants to move within a month.", evidenceIds: ["ev-nadia-2"] },
      sideB: { label: "Buyer says timing is not decided yet.", evidenceIds: ["ev-nadia-3"] },
      establishedDespiteConflict: ["Buyer explicitly requested a proposal review."],
      cannotConclude: ["An actual target move-in date."],
      resolutionEvidenceClasses: ["A single, later, unambiguous timing statement from the buyer."],
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixture 6 — INSUFFICIENT_EVIDENCE
// Some verified context; buyer timing unknown; no fabricated next step.
// ---------------------------------------------------------------------------

export const FIXTURE_6_INSUFFICIENT_EVIDENCE: InsufficientEvidenceSnapshot = {
  opportunityId: "opp-omar",
  snapshotId: "snap-omar-001",
  eventSetId: "evset-omar-001",
  fixtureId: "fixture-6-insufficient-evidence",
  buyerAlias: "O. Zaki",
  decisionState: "INSUFFICIENT_EVIDENCE",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-omar-001",
    eventSetId: "evset-omar-001",
    fixtureId: "fixture-6-insufficient-evidence",
    generatedAt: "2026-06-06T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-omar-1", label: "Buyer attended one open viewing.", group: "validated", snapshotId: "snap-omar-001" },
  ],
  buyerSignals: [],
  conditions: [
    { id: "cond-omar-1", label: "Buyer timing preference is known", status: "unresolved" },
    { id: "cond-omar-2", label: "Buyer decision-maker status is known", status: "unresolved" },
  ],
  history: [
    { id: "hist-omar-1", kind: "decision_recorded", occurredAt: "2026-06-06T09:00:00Z", decisionState: "INSUFFICIENT_EVIDENCE", summary: "Current evidence is not sufficient to support a bounded decision.", snapshotId: "snap-omar-001" },
  ],
  insufficiency: {
    known: ["Buyer attended one open viewing."],
    missing: ["Buyer timing preference.", "Whether this buyer is the decision-maker."],
    unknownEvidenceClasses: ["Timing statement", "Decision-maker confirmation"],
    strongerReviewWouldRequire: ["A validated timing statement from the buyer.", "Confirmation of who makes the final decision."],
  },
};

// ---------------------------------------------------------------------------
// Fixture 7 — CONTRADICTORY_EVIDENCE
// Two validated conflicting buyer signals; both sides visible.
// ---------------------------------------------------------------------------

export const FIXTURE_7_CONTRADICTORY_EVIDENCE: ContradictoryEvidenceSnapshot = {
  opportunityId: "opp-layla",
  snapshotId: "snap-layla-001",
  eventSetId: "evset-layla-001",
  fixtureId: "fixture-7-contradictory-evidence",
  buyerAlias: "L. Fahmy",
  decisionState: "CONTRADICTORY_EVIDENCE",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-layla-001",
    eventSetId: "evset-layla-001",
    fixtureId: "fixture-7-contradictory-evidence",
    generatedAt: "2026-06-07T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-layla-1", label: "Buyer validated statement: proceeding with this unit.", group: "contradictory", snapshotId: "snap-layla-001" },
    { id: "ev-layla-2", label: "Buyer validated statement (later): reconsidering, may look elsewhere.", group: "contradictory", snapshotId: "snap-layla-001" },
  ],
  buyerSignals: [
    { id: "sig-layla-1", label: "Validated intent to proceed.", attributedTo: "buyer", validated: true, snapshotId: "snap-layla-001" },
    { id: "sig-layla-2", label: "Validated statement of reconsideration.", attributedTo: "buyer", validated: true, snapshotId: "snap-layla-001" },
  ],
  conditions: [
    { id: "cond-layla-1", label: "Buyer intent is internally consistent", status: "contradicted" },
  ],
  history: [
    { id: "hist-layla-1", kind: "decision_recorded", occurredAt: "2026-06-07T09:00:00Z", decisionState: "CONTRADICTORY_EVIDENCE", summary: "Validated evidence conflicts; no single conclusion is currently supported.", snapshotId: "snap-layla-001" },
  ],
  contradictions: [
    {
      id: "conf-layla-1",
      conflictClass: "Buyer intent statements disagree",
      sideA: { label: "Buyer stated intent to proceed with this unit.", evidenceIds: ["ev-layla-1"] },
      sideB: { label: "Buyer later stated they are reconsidering.", evidenceIds: ["ev-layla-2"] },
      establishedDespiteConflict: ["Buyer has engaged directly on this specific unit."],
      cannotConclude: ["Whether the buyer currently intends to proceed."],
      resolutionEvidenceClasses: ["A single later validated statement resolving the buyer's intent."],
    },
  ],
};

// ---------------------------------------------------------------------------
// Fixture 8 — Historical Chasing Violation
// Original NO_ACTION; chasing violation recorded; later positive
// buyer engagement; violation remains visible.
// ---------------------------------------------------------------------------

export const FIXTURE_8_HISTORICAL_CHASING_VIOLATION: NextStepReadySnapshot = {
  opportunityId: "opp-yasmin",
  snapshotId: "snap-yasmin-002",
  eventSetId: "evset-yasmin-002",
  fixtureId: "fixture-8-historical-chasing-violation",
  buyerAlias: "Y. Adel",
  decisionState: "NEXT_STEP_READY",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-yasmin-002",
    eventSetId: "evset-yasmin-002",
    fixtureId: "fixture-8-historical-chasing-violation",
    generatedAt: "2026-06-10T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-yasmin-1", label: "Buyer explicitly re-engaged and asked about availability.", group: "validated", snapshotId: "snap-yasmin-002" },
  ],
  buyerSignals: [
    { id: "sig-yasmin-1", label: "Explicit, validated re-engagement.", attributedTo: "buyer", validated: true, snapshotId: "snap-yasmin-002" },
  ],
  conditions: [
    { id: "cond-yasmin-1", label: "An explicit buyer request exists", status: "satisfied" },
  ],
  history: [
    { id: "hist-yasmin-1", kind: "decision_recorded", occurredAt: "2026-05-01T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-yasmin-001" },
    {
      id: "hist-yasmin-2",
      kind: "chasing_violation",
      occurredAt: "2026-05-03T09:00:00Z",
      decisionState: "NO_ACTION",
      summary: "A message was sent to this buyer while the decision was NO_ACTION. This restraint violation remains part of the permanent record.",
      snapshotId: "snap-yasmin-001",
    },
    {
      id: "hist-yasmin-3",
      kind: "decision_recorded",
      occurredAt: "2026-06-10T09:00:00Z",
      decisionState: "NEXT_STEP_READY",
      summary: "Current evidence supports this next-step class.",
      snapshotId: "snap-yasmin-002",
    },
  ],
  nextStep: {
    stepClass: "RESPOND_TO_BUYER_REQUEST",
    whyNowEvidenceIds: ["ev-yasmin-1"],
    buyerSignalClass: "Explicit re-engagement request",
    restraintChecks: ["No unresolved contradiction.", "No active stop condition."],
  },
  contradictions: [],
};

// ---------------------------------------------------------------------------
// Fixture 9 — New Snapshot Available
// Source snapshot remains visible; new snapshot notice; explicit
// comparison action; no silent replacement.
// ---------------------------------------------------------------------------

export const FIXTURE_9_NEW_SNAPSHOT_AVAILABLE: NoActionSnapshot = {
  opportunityId: "opp-karim",
  snapshotId: "snap-karim-001",
  eventSetId: "evset-karim-001",
  fixtureId: "fixture-9-new-snapshot-available",
  buyerAlias: "K. Mansour",
  decisionState: "NO_ACTION",
  freshness: "NEW_SNAPSHOT_AVAILABLE",
  provenance: {
    snapshotId: "snap-karim-001",
    eventSetId: "evset-karim-001",
    fixtureId: "fixture-9-new-snapshot-available",
    generatedAt: "2026-06-11T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-karim-1", label: "Buyer requested a brochure once.", group: "validated", snapshotId: "snap-karim-001" },
  ],
  buyerSignals: [],
  conditions: [
    { id: "cond-karim-1", label: "An explicit buyer-initiated trigger for a next step", status: "unsatisfied" },
  ],
  history: [
    { id: "hist-karim-1", kind: "decision_recorded", occurredAt: "2026-06-11T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-karim-001" },
  ],
  restraint: {
    reason: "No action recommended from this evidence snapshot.",
    doNotDoBehaviors: ["Do not send a follow-up message."],
    reengagementConditions: ["Buyer replies or initiates contact."],
  },
  newerSnapshotId: "snap-karim-002",
};

/** The newer snapshot referenced by Fixture 9, used by the comparison flow. */
export const FIXTURE_9_NEWER_SNAPSHOT: NextStepReadySnapshot = {
  opportunityId: "opp-karim",
  snapshotId: "snap-karim-002",
  eventSetId: "evset-karim-002",
  fixtureId: "fixture-9-new-snapshot-available-after",
  buyerAlias: "K. Mansour",
  decisionState: "NEXT_STEP_READY",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-karim-002",
    eventSetId: "evset-karim-002",
    fixtureId: "fixture-9-new-snapshot-available-after",
    generatedAt: "2026-06-13T09:00:00Z",
    source: "Synthetic fixture — no live data.",
  },
  evidence: [
    { id: "ev-karim-1b", label: "Buyer requested a brochure once.", group: "validated", snapshotId: "snap-karim-002" },
    { id: "ev-karim-2", label: "Buyer explicitly asked about financing options.", group: "validated", snapshotId: "snap-karim-002" },
  ],
  buyerSignals: [
    { id: "sig-karim-1", label: "Explicit, validated financing question.", attributedTo: "buyer", validated: true, snapshotId: "snap-karim-002" },
  ],
  conditions: [{ id: "cond-karim-2", label: "An explicit buyer request exists", status: "satisfied" }],
  history: [
    { id: "hist-karim-1", kind: "decision_recorded", occurredAt: "2026-06-11T09:00:00Z", decisionState: "NO_ACTION", summary: "No action recommended from this evidence snapshot.", snapshotId: "snap-karim-001" },
    { id: "hist-karim-2", kind: "decision_recorded", occurredAt: "2026-06-13T09:00:00Z", decisionState: "NEXT_STEP_READY", summary: "Current evidence supports this next-step class.", snapshotId: "snap-karim-002" },
  ],
  nextStep: {
    stepClass: "PROVIDE_REQUESTED_INFORMATION",
    whyNowEvidenceIds: ["ev-karim-2"],
    buyerSignalClass: "Explicit information request",
    restraintChecks: ["No unresolved contradiction.", "No active stop condition."],
  },
  contradictions: [],
};

// ---------------------------------------------------------------------------
// Fixture 10 — Integrity Block
// Decision snapshot and evidence snapshot intentionally mismatch;
// interpretive content suppressed; fail-closed state visible.
// ---------------------------------------------------------------------------

export const FIXTURE_10_INTEGRITY_BLOCK: NoActionSnapshot = {
  opportunityId: "opp-hana",
  snapshotId: "snap-hana-002",
  eventSetId: "evset-hana-002",
  fixtureId: "fixture-10-integrity-block",
  buyerAlias: "H. Rashid",
  decisionState: "NO_ACTION",
  freshness: "INTEGRITY_BLOCKED",
  provenance: {
    // Intentionally mismatched against snapshotId/eventSetId above,
    // to exercise checkSnapshotIntegrity's fail-closed path.
    snapshotId: "snap-hana-001",
    eventSetId: "evset-hana-001",
    fixtureId: "fixture-10-integrity-block",
    generatedAt: "2026-06-12T09:00:00Z",
    source: "Synthetic fixture — intentionally mismatched to exercise the integrity block.",
  },
  evidence: [
    // Intentionally tagged with a DIFFERENT snapshotId than snap-hana-002.
    { id: "ev-hana-1", label: "Buyer requested a brochure.", group: "validated", snapshotId: "snap-hana-001" },
  ],
  buyerSignals: [],
  conditions: [],
  history: [],
  restraint: {
    reason: "No action recommended from this evidence snapshot.",
    doNotDoBehaviors: [],
    reengagementConditions: [],
  },
};

// ---------------------------------------------------------------------------
// Fixture 11 — Arabic mobile fixture
// A full Arabic-language snapshot, exercised on the mobile layout.
// ---------------------------------------------------------------------------

export const FIXTURE_11_ARABIC_MOBILE: NextStepReadySnapshot = {
  opportunityId: "opp-mahmoud",
  snapshotId: "snap-mahmoud-001",
  eventSetId: "evset-mahmoud-001",
  fixtureId: "fixture-11-arabic-mobile",
  buyerAlias: "محمود عبد الله",
  decisionState: "NEXT_STEP_READY",
  freshness: "CURRENT",
  provenance: {
    snapshotId: "snap-mahmoud-001",
    eventSetId: "evset-mahmoud-001",
    fixtureId: "fixture-11-arabic-mobile",
    generatedAt: "2026-06-14T09:00:00Z",
    source: "بيانات تجريبية اصطناعية — لا توجد بيانات حية.",
  },
  evidence: [
    { id: "ev-mahmoud-1", label: "طلب المشتري صراحةً مراجعة عرض السعر.", group: "validated", snapshotId: "snap-mahmoud-001" },
    { id: "ev-mahmoud-2", label: "أكّد المشتري أنه صاحب القرار.", group: "validated", snapshotId: "snap-mahmoud-001" },
  ],
  buyerSignals: [
    { id: "sig-mahmoud-1", label: "طلب صريح وموثّق لمراجعة العرض.", attributedTo: "buyer", validated: true, snapshotId: "snap-mahmoud-001" },
  ],
  conditions: [{ id: "cond-mahmoud-1", label: "يوجد طلب صريح من المشتري", status: "satisfied" }],
  history: [
    { id: "hist-mahmoud-1", kind: "decision_recorded", occurredAt: "2026-06-14T09:00:00Z", decisionState: "NEXT_STEP_READY", summary: "الأدلة الحالية تدعم فئة الخطوة التالية هذه.", snapshotId: "snap-mahmoud-001" },
  ],
  nextStep: {
    stepClass: "PREPARE_BUYER_REQUESTED_PROPOSAL_REVIEW",
    whyNowEvidenceIds: ["ev-mahmoud-1"],
    buyerSignalClass: "طلب صريح لمراجعة العرض",
    restraintChecks: ["لا يوجد تعارض غير محلول.", "لا يوجد شرط إيقاف نشط."],
  },
  contradictions: [],
};

// ---------------------------------------------------------------------------
// M1A synthetic restraint-review fixtures. These are deliberately local,
// bounded summaries: no raw buyer messages and no executable authority.
// ---------------------------------------------------------------------------

function m1aNoActionFixture(
  opportunityId: string,
  snapshotId: string,
  fixtureId: string,
  buyerAlias: string,
  reasonCode: NonNullable<NoActionSnapshot["restraint"]["reasonCode"]>,
  reason: string,
  behavior: NonNullable<NoActionSnapshot["restraint"]["behavior"]>,
  uncertainty: NonNullable<NoActionSnapshot["restraint"]["uncertainty"]>,
  history: NoActionSnapshot["history"],
): NoActionSnapshot {
  return {
    opportunityId,
    snapshotId,
    eventSetId: `${snapshotId}-events`,
    fixtureId,
    buyerAlias,
    decisionState: "NO_ACTION",
    freshness: "CURRENT",
    provenance: { snapshotId, eventSetId: `${snapshotId}-events`, fixtureId, generatedAt: "2026-08-25T10:30:00Z", source: "Synthetic fixture - no live data." },
    evidence: [{ id: `${snapshotId}-evidence`, label: "Validated decision-grade restraint evidence is present.", group: "validated", snapshotId }],
    buyerSignals: [],
    conditions: [{ id: `${snapshotId}-condition`, label: "A buyer-initiated contact trigger is not established for this frozen snapshot.", status: "unsatisfied" }],
    history,
    restraint: {
      reasonCode,
      reason,
      summary: "SalesOS recommends restraint from the recorded evidence; silence is not classified as buyer rejection.",
      doNotDoBehaviors: ["Do not send another follow-up yet.", "Do not create artificial urgency.", "Do not escalate solely because the buyer is silent."],
      reengagementConditions: [
        { class: "NEW_BUYER_MESSAGE", summary: "A validated new buyer message permits reevaluation." },
        { class: "POLICY_DEFINED_WAIT_ELAPSED", summary: "A policy-defined wait has elapsed.", policyAllowsReevaluation: true },
      ],
      behavior,
      uncertainty,
    },
  };
}

export const FIXTURE_M1A_EXPLICIT_PAUSE = m1aNoActionFixture(
  "opp-m1a-pause", "snap-m1a-pause-001", "fixture-m1a-explicit-pause", "P. Nabil", "BUYER_BOUNDARY",
  "Buyer explicitly asked that no follow-up occur until they reinitiate.",
  { state: "RESTRAINT_PENDING", observationWindow: "Observation window remains open.", summary: "Behavior is not yet classified while the observation window is open." },
  { state: "OBSERVABLE", summary: "Validated boundary evidence is complete for this decision." },
  [{ id: "hist-m1a-pause-1", kind: "decision_recorded", occurredAt: "2026-08-25T10:30:00Z", decisionState: "NO_ACTION", summary: "NO_ACTION recorded with buyer boundary.", snapshotId: "snap-m1a-pause-001" }],
);

export const FIXTURE_M1A_RESTRAINT_RESPECTED = m1aNoActionFixture(
  "opp-m1a-respected", "snap-m1a-respected-001", "fixture-m1a-restraint-respected", "R. Samir", "RECENT_CONTACT_AWAIT_RESPONSE",
  "A recent seller response is awaiting a buyer reply; no decision-grade signal supports another follow-up.",
  { state: "RESTRAINT_RESPECTED", observationWindow: "Complete through 2026-08-24.", summary: "No prohibited seller contact was observed before valid reevaluation." },
  { state: "OBSERVABLE", summary: "The observation window is complete enough to classify recorded behavior." },
  [{ id: "hist-m1a-respected-1", kind: "restraint_upheld", occurredAt: "2026-08-24T18:00:00Z", decisionState: "NO_ACTION", summary: "Restraint respected; no causal claim is made about any later buyer activity.", snapshotId: "snap-m1a-respected-001" }],
);

export const FIXTURE_M1A_CHASING_VIOLATION = m1aNoActionFixture(
  "opp-m1a-chasing", "snap-m1a-chasing-001", "fixture-m1a-chasing-violation", "C. Fawzy", "BUYER_EXPLICIT_PAUSE",
  "Buyer pause remains the effective restraint boundary for this frozen review.",
  { state: "CHASING_VIOLATION", observationWindow: "Complete through 2026-08-24.", summary: "Validated prohibited seller contact was observed after NO_ACTION and before reevaluation." },
  { state: "OBSERVABLE", summary: "Recorded evidence is complete enough to classify the violation." },
  [{ id: "hist-m1a-chasing-1", kind: "chasing_violation", occurredAt: "2026-08-23T12:00:00Z", decisionState: "NO_ACTION", summary: "Chasing violation recorded and preserved despite later buyer commitment.", snapshotId: "snap-m1a-chasing-001" }],
);

export const FIXTURE_M1A_NOT_OBSERVABLE = m1aNoActionFixture(
  "opp-m1a-unobservable", "snap-m1a-unobservable-001", "fixture-m1a-not-observable", "U. Kareem", "NO_DECISION_GRADE_SIGNAL",
  "No decision-grade signal supports outreach, and behavior evidence is incomplete.",
  { state: "NOT_OBSERVABLE", observationWindow: "Incomplete activity evidence.", summary: "Missing data is not treated as compliance." },
  { state: "INCOMPLETE_EVIDENCE", summary: "The review cannot infer restraint compliance from absent records." },
  [{ id: "hist-m1a-unobservable-1", kind: "decision_recorded", occurredAt: "2026-08-25T10:30:00Z", decisionState: "NO_ACTION", summary: "NO_ACTION retained; behavior cannot be classified.", snapshotId: "snap-m1a-unobservable-001" }],
);

export const FIXTURE_M1A_LATER_REPLY = m1aNoActionFixture(
  "opp-m1a-later-reply", "snap-m1a-later-reply-001", "fixture-m1a-later-buyer-reply", "L. Hatem", "TIMING_NOT_READY",
  "Timing was not ready in this frozen NO_ACTION snapshot.",
  { state: "RESTRAINT_RESPECTED", observationWindow: "Complete before the later buyer reply.", summary: "Restraint was respected; the later buyer reply does not prove restraint caused it." },
  { state: "OBSERVABLE", summary: "The earlier observation window is complete and remains historically fixed." },
  [{ id: "hist-m1a-reply-1", kind: "restraint_upheld", occurredAt: "2026-08-22T18:00:00Z", decisionState: "NO_ACTION", summary: "Restraint respected before later buyer reply; no causality is claimed.", snapshotId: "snap-m1a-later-reply-001" }],
);

export const FIXTURE_M1A_LATER_COMMITMENT = m1aNoActionFixture(
  "opp-m1a-later-commitment", "snap-m1a-later-commitment-001", "fixture-m1a-later-commitment-after-chasing", "M. Adel", "BUYER_BOUNDARY",
  "The recorded buyer boundary remains valid for this historical NO_ACTION review.",
  { state: "CHASING_VIOLATION", observationWindow: "Complete before the later buyer commitment.", summary: "The chasing violation remains preserved even after later buyer commitment." },
  { state: "OBSERVABLE", summary: "The historical review is complete and is not rewritten by a later snapshot." },
  [{ id: "hist-m1a-commitment-1", kind: "chasing_violation", occurredAt: "2026-08-22T18:00:00Z", decisionState: "NO_ACTION", summary: "Chasing violation remains recorded after later buyer commitment.", snapshotId: "snap-m1a-later-commitment-001" }],
);

// ---------------------------------------------------------------------------
// Aggregate lookup
// ---------------------------------------------------------------------------

export const ALL_SNAPSHOTS: Record<string, DecisionSnapshot> = {
  "snap-farah-001": FIXTURE_1_NO_ACTION,
  "snap-tariq-001": FIXTURE_2_NO_ACTION_PENDING,
  "snap-sara-001": FIXTURE_3_NO_ACTION_REEVAL_ELIGIBLE,
  "snap-ahmed-001": FIXTURE_4_NEXT_STEP_READY,
  "snap-nadia-001": FIXTURE_5_NEXT_STEP_READY_CONTRADICTION,
  "snap-omar-001": FIXTURE_6_INSUFFICIENT_EVIDENCE,
  "snap-layla-001": FIXTURE_7_CONTRADICTORY_EVIDENCE,
  "snap-yasmin-002": FIXTURE_8_HISTORICAL_CHASING_VIOLATION,
  "snap-karim-001": FIXTURE_9_NEW_SNAPSHOT_AVAILABLE,
  "snap-karim-002": FIXTURE_9_NEWER_SNAPSHOT,
  "snap-hana-002": FIXTURE_10_INTEGRITY_BLOCK,
  "snap-mahmoud-001": FIXTURE_11_ARABIC_MOBILE,
  "snap-m1a-pause-001": FIXTURE_M1A_EXPLICIT_PAUSE,
  "snap-m1a-respected-001": FIXTURE_M1A_RESTRAINT_RESPECTED,
  "snap-m1a-chasing-001": FIXTURE_M1A_CHASING_VIOLATION,
  "snap-m1a-unobservable-001": FIXTURE_M1A_NOT_OBSERVABLE,
  "snap-m1a-later-reply-001": FIXTURE_M1A_LATER_REPLY,
  "snap-m1a-later-commitment-001": FIXTURE_M1A_LATER_COMMITMENT,
};

export const OPPORTUNITIES: Opportunity[] = [
  { opportunityId: "opp-farah", buyerAlias: "F. Al-Sayed", currentSnapshotId: "snap-farah-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-tariq", buyerAlias: "T. Nour", currentSnapshotId: "snap-tariq-001", decisionState: "NO_ACTION", freshness: "NEW_EVIDENCE_PENDING" },
  { opportunityId: "opp-sara", buyerAlias: "S. Hamdy", currentSnapshotId: "snap-sara-001", decisionState: "NO_ACTION", freshness: "REEVALUATION_ELIGIBLE" },
  { opportunityId: "opp-ahmed", buyerAlias: "A. Hassan", currentSnapshotId: "snap-ahmed-001", decisionState: "NEXT_STEP_READY", freshness: "CURRENT" },
  { opportunityId: "opp-nadia", buyerAlias: "N. Saleh", currentSnapshotId: "snap-nadia-001", decisionState: "NEXT_STEP_READY", freshness: "CURRENT" },
  { opportunityId: "opp-omar", buyerAlias: "O. Zaki", currentSnapshotId: "snap-omar-001", decisionState: "INSUFFICIENT_EVIDENCE", freshness: "CURRENT" },
  { opportunityId: "opp-layla", buyerAlias: "L. Fahmy", currentSnapshotId: "snap-layla-001", decisionState: "CONTRADICTORY_EVIDENCE", freshness: "CURRENT" },
  { opportunityId: "opp-yasmin", buyerAlias: "Y. Adel", currentSnapshotId: "snap-yasmin-002", decisionState: "NEXT_STEP_READY", freshness: "CURRENT" },
  { opportunityId: "opp-karim", buyerAlias: "K. Mansour", currentSnapshotId: "snap-karim-001", decisionState: "NO_ACTION", freshness: "NEW_SNAPSHOT_AVAILABLE" },
  { opportunityId: "opp-hana", buyerAlias: "H. Rashid", currentSnapshotId: "snap-hana-002", decisionState: "NO_ACTION", freshness: "INTEGRITY_BLOCKED" },
  { opportunityId: "opp-mahmoud", buyerAlias: "محمود عبد الله", currentSnapshotId: "snap-mahmoud-001", decisionState: "NEXT_STEP_READY", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-pause", buyerAlias: "P. Nabil", currentSnapshotId: "snap-m1a-pause-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-respected", buyerAlias: "R. Samir", currentSnapshotId: "snap-m1a-respected-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-chasing", buyerAlias: "C. Fawzy", currentSnapshotId: "snap-m1a-chasing-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-unobservable", buyerAlias: "U. Kareem", currentSnapshotId: "snap-m1a-unobservable-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-later-reply", buyerAlias: "L. Hatem", currentSnapshotId: "snap-m1a-later-reply-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
  { opportunityId: "opp-m1a-later-commitment", buyerAlias: "M. Adel", currentSnapshotId: "snap-m1a-later-commitment-001", decisionState: "NO_ACTION", freshness: "CURRENT" },
];

export function getSnapshot(snapshotId: string): DecisionSnapshot | undefined {
  return ALL_SNAPSHOTS[snapshotId];
}

export function getOpportunity(opportunityId: string): Opportunity | undefined {
  return OPPORTUNITIES.find((o) => o.opportunityId === opportunityId);
}
