/**
 * MoatazOS — Post-Visit Decision & Reservation Progression.
 *
 * Evaluates post-visit progression from completed site visit to unit
 * selection and reservation readiness.
 *
 * Invariants:
 *  1. Overdue commitments elevate urgency and must be fulfilled first.
 *  2. Missing evidence stays explicit (unit choice, payment terms).
 *  3. Restricted outreach produces no contact recommendation.
 *  4. Drafts never become completed actions or auto-reservations.
 */

import {
  isBuyerEngagementInteraction,
  resolveContactAllowance,
  type InteractionChannel,
} from "@/lib/revenueCore";
import type {
  FollowUpCandidateContext,
  FollowUpNextStepClass,
  FollowUpRecommendation,
  IsoTimestamp,
  PostVisitEvaluation,
  PostVisitStage,
  RecommendationEvidence,
} from "./types";

export function evaluatePostVisitProgression(
  context: FollowUpCandidateContext,
  now: IsoTimestamp,
): PostVisitEvaluation {
  const customerId = context.customer.customerId;
  const channel: InteractionChannel = context.preferredChannel ?? "WHATSAPP";

  // Check channel consent
  const contactAllowance = resolveContactAllowance(context.consentRecords, customerId, channel);
  const isRestricted = contactAllowance.status === "RESTRICTED";

  // Completed visits
  const visits = context.visits?.filter((v) => v.customerId === customerId && v.status === "COMPLETED") ?? [];
  const latestVisit = [...visits].sort((a, b) => a.visitedAt.localeCompare(b.visitedAt)).pop();

  if (!latestVisit) {
    const evidence: RecommendationEvidence = {
      summary: "No completed site visits found for this customer.",
      interactionIds: [],
      signals: ["NO_VISIT_COMPLETED"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_pv_${customerId}_novisit_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_ACTION_REQUIRED",
      channel,
      isContactAllowed: !isRestricted,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "NOT_VISITED",
      recommendation,
      missingEvidence: ["SITE_VISIT_COMPLETION"],
    };
  }

  // Check commitments
  const commitments = context.commitments?.filter((c) => c.customerId === customerId) ?? [];
  const overdueSellerCommitment = commitments.find(
    (c) => c.party === "SELLER" && c.status === "PENDING" && c.dueAt < now,
  );
  const overdueBuyerCommitment = commitments.find(
    (c) => c.party === "BUYER" && c.status === "PENDING" && c.dueAt < now,
  );

  // Check drafts
  const pendingDraft = context.drafts?.find(
    (d) => d.customerId === customerId && (d.status === "DRAFT" || d.status === "READY_FOR_HUMAN_REVIEW"),
  );

  // If outreach is restricted, suppress contact recommendation
  if (isRestricted) {
    const evidence: RecommendationEvidence = {
      summary: `Site visit ${latestVisit.id} completed on ${latestVisit.visitedAt}, but contact on ${channel} is restricted (${contactAllowance.reason}). No post-visit outreach allowed.`,
      visitId: latestVisit.id,
      interactionIds: latestVisit.feedbackInteractionId ? [latestVisit.feedbackInteractionId] : [],
      signals: ["VISIT_COMPLETED", "CONTACT_RESTRICTION_ACTIVE"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_pv_${customerId}_restricted_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_CONTACT_RESTRICTION",
      channel,
      isContactAllowed: false,
      contactRestrictionReason: contactAllowance.reason,
      evidence,
      generatedAt: now,
    };

    return {
      stage: latestVisit.selectedUnitId ? "RESERVATION_IN_PROGRESS" : "FEEDBACK_PENDING",
      visitId: latestVisit.id,
      recommendation,
      selectedUnitId: latestVisit.selectedUnitId,
      missingEvidence: latestVisit.selectedUnitId ? [] : ["SELECTED_UNIT_ID"],
    };
  }

  // 1. Overdue Seller Commitment takes top priority
  if (overdueSellerCommitment) {
    const evidence: RecommendationEvidence = {
      summary: `Seller commitment "${overdueSellerCommitment.description}" was due at ${overdueSellerCommitment.dueAt} and is now overdue. Must fulfill commitment before further prospecting.`,
      commitmentIds: [overdueSellerCommitment.id],
      visitId: latestVisit.id,
      interactionIds: overdueSellerCommitment.sourceInteractionId ? [overdueSellerCommitment.sourceInteractionId] : [],
      signals: ["SELLER_COMMITMENT_OVERDUE"],
      missingEvidence: ["COMMITMENT_FULFILLMENT"],
    };

    let nextStepClass: FollowUpNextStepClass = "FULFILL_OVERDUE_COMMITMENT";
    let draftId: string | undefined;

    if (pendingDraft) {
      nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
      draftId = pendingDraft.id;
    }

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_pv_${customerId}_overdue_seller_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass,
      channel,
      draftId,
      isContactAllowed: true,
      evidence,
      generatedAt: now,
    };

    return {
      stage: latestVisit.selectedUnitId ? "RESERVATION_IN_PROGRESS" : "FEEDBACK_PENDING",
      visitId: latestVisit.id,
      recommendation,
      selectedUnitId: latestVisit.selectedUnitId,
      missingEvidence: ["COMMITMENT_FULFILLMENT"],
    };
  }

  // 2. Unit is selected: evaluate reservation readiness
  if (latestVisit.selectedUnitId) {
    const missingEvidence: string[] = [];

    // Check if buyer has confirmed payment plan preference
    const postVisitInteractions = context.interactions.filter(
      (i) => i.customerId === customerId && i.occurredAt >= latestVisit.visitedAt && isBuyerEngagementInteraction(i),
    );

    const hasPaymentPlanEvidence = postVisitInteractions.some(
      (i) => (i.sourceRef ?? "").toLowerCase().includes("payment") || (i.sourceRef ?? "").toLowerCase().includes("plan"),
    );

    if (!hasPaymentPlanEvidence) {
      missingEvidence.push("PAYMENT_PLAN_TERMS_SELECTION");
    }

    let nextStepClass: FollowUpNextStepClass = "PREPARE_RESERVATION_SUMMARY";
    let draftId: string | undefined;

    if (pendingDraft) {
      nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
      draftId = pendingDraft.id;
    } else if (missingEvidence.length > 0) {
      nextStepClass = "GATHER_MISSING_EVIDENCE";
    }

    const evidence: RecommendationEvidence = {
      summary: `Buyer selected unit ${latestVisit.selectedUnitId} following visit on ${latestVisit.visitedAt}. ${missingEvidence.length > 0 ? `Missing: ${missingEvidence.join(", ")}.` : "Ready for human review of reservation summary."}`,
      visitId: latestVisit.id,
      interactionIds: postVisitInteractions.map((i) => i.id),
      signals: ["UNIT_SELECTED", missingEvidence.length > 0 ? "EVIDENCE_INCOMPLETE" : "RESERVATION_SUMMARY_READY"],
      missingEvidence,
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_pv_${customerId}_unit_selected_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass,
      channel,
      draftId,
      isContactAllowed: true,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "RESERVATION_IN_PROGRESS",
      visitId: latestVisit.id,
      recommendation,
      selectedUnitId: latestVisit.selectedUnitId,
      missingEvidence,
    };
  }

  // 3. Visit completed, but feedback / unit choice is missing
  const postVisitBuyerInteractions = context.interactions.filter(
    (i) => i.customerId === customerId && i.occurredAt >= latestVisit.visitedAt && isBuyerEngagementInteraction(i),
  );

  const missingEvidence = ["SELECTED_UNIT_ID", "POST_VISIT_FEEDBACK"];

  let nextStepClass: FollowUpNextStepClass = "GATHER_MISSING_VISIT_FEEDBACK";
  let draftId: string | undefined;

  if (pendingDraft) {
    nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
    draftId = pendingDraft.id;
  } else if (overdueBuyerCommitment) {
    nextStepClass = "AWAIT_BUYER_RESPONSE";
  }

  const evidence: RecommendationEvidence = {
    summary: `Visit completed on ${latestVisit.visitedAt}. Unit selection and decision feedback remain unconfirmed. Rep should review feedback with buyer.`,
    visitId: latestVisit.id,
    commitmentIds: overdueBuyerCommitment ? [overdueBuyerCommitment.id] : [],
    interactionIds: postVisitBuyerInteractions.map((i) => i.id),
    signals: ["VISIT_COMPLETED", "FEEDBACK_PENDING"],
    missingEvidence,
  };

  const recommendation: FollowUpRecommendation = {
    recommendationId: `rec_pv_${customerId}_feedback_pending_${now}`,
    customerId,
    opportunityId: context.opportunity?.opportunityId,
    nextStepClass,
    channel,
    draftId,
    isContactAllowed: true,
    evidence,
    generatedAt: now,
  };

  return {
    stage: "FEEDBACK_PENDING",
    visitId: latestVisit.id,
    recommendation,
    selectedUnitId: undefined,
    missingEvidence,
  };
}
