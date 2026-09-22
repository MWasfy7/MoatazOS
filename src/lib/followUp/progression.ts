/**
 * MoatazOS — Details-to-Meeting Progression.
 *
 * Evaluates the transition from property/project details shared to
 * meeting securing.
 *
 * Strict Invariants:
 *  1. Unanswered seller activity never counts as buyer engagement.
 *  2. Restricted outreach produces no contact recommendation.
 *  3. Availability does not become a confirmed meeting.
 *  4. Drafts never become completed actions automatically.
 */

import {
  computeBuyerEngagement,
  isBuyerEngagementInteraction,
  resolveContactAllowance,
  type Interaction,
  type InteractionChannel,
} from "@/lib/revenueCore";
import type {
  DetailsToMeetingEvaluation,
  DetailsToMeetingStage,
  FollowUpCandidateContext,
  FollowUpNextStepClass,
  FollowUpRecommendation,
  IsoTimestamp,
  RecommendationEvidence,
} from "./types";

export function evaluateDetailsToMeetingProgression(
  context: FollowUpCandidateContext,
  now: IsoTimestamp,
): DetailsToMeetingEvaluation {
  const customerId = context.customer.customerId;
  const channel: InteractionChannel = context.preferredChannel ?? "WHATSAPP";

  // Check channel contact allowance
  const contactAllowance = resolveContactAllowance(context.consentRecords, customerId, channel);
  const isRestricted = contactAllowance.status === "RESTRICTED";

  // Compute genuine buyer engagement (seller-authored interactions are excluded)
  const engagementSummary = computeBuyerEngagement(customerId, context.interactions);
  const buyerInteractions = context.interactions
    .filter((i) => i.customerId === customerId && isBuyerEngagementInteraction(i))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const sellerOutboundInteractions = context.interactions
    .filter((i) => i.customerId === customerId && i.actorRole === "SELLER" && i.direction === "OUTBOUND")
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const latestBuyerInteraction = buyerInteractions[buyerInteractions.length - 1];

  // Check existing meeting records
  const meetings = context.meetings?.filter((m) => m.customerId === customerId) ?? [];
  const confirmedMeeting = meetings.find(
    (m) => m.status === "CONFIRMED" && Boolean(m.confirmationEvidenceInteractionId),
  );
  const proposedOrAvailabilityMeeting = meetings.find(
    (m) =>
      (m.status === "PROPOSED" || m.status === "AWAITING_CONFIRMATION") ||
      Boolean(m.availabilityEvidenceInteractionId),
  );

  // Check pending drafts
  const pendingDraft = context.drafts?.find(
    (d) => d.customerId === customerId && (d.status === "DRAFT" || d.status === "READY_FOR_HUMAN_REVIEW"),
  );

  // If outreach is restricted, strictly suppress any contact recommendation
  if (isRestricted) {
    const evidence: RecommendationEvidence = {
      summary: `Channel ${channel} is restricted for customer ${customerId} (${contactAllowance.reason ?? "CONSENT_WITHDRAWN_OR_DENIED"}). No outreach permitted.`,
      interactionIds: latestBuyerInteraction ? [latestBuyerInteraction.id] : [],
      signals: ["CONTACT_RESTRICTION_ACTIVE"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_prog_${customerId}_restricted_${now}`,
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
      stage: "STALLED",
      recommendation,
      hasBuyerResponse: Boolean(latestBuyerInteraction),
      lastBuyerInteractionId: latestBuyerInteraction?.id,
      isConfirmedMeeting: false,
    };
  }

  // 1. Confirmed meeting already exists
  if (confirmedMeeting) {
    const evidence: RecommendationEvidence = {
      summary: `Meeting ${confirmedMeeting.id} is confirmed for ${confirmedMeeting.scheduledAt} with explicit mutual confirmation evidence.`,
      interactionIds: confirmedMeeting.confirmationEvidenceInteractionId
        ? [confirmedMeeting.confirmationEvidenceInteractionId]
        : [],
      meetingId: confirmedMeeting.id,
      signals: ["MUTUAL_CONFIRMATION_ESTABLISHED"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_prog_${customerId}_confirmed_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_ACTION_REQUIRED",
      channel,
      isContactAllowed: true,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "MEETING_CONFIRMED",
      recommendation,
      hasBuyerResponse: Boolean(latestBuyerInteraction),
      lastBuyerInteractionId: latestBuyerInteraction?.id,
      isConfirmedMeeting: true,
    };
  }

  // 2. Buyer shared availability, but meeting is NOT yet confirmed
  // (In accordance with invariant: availability does not become a confirmed meeting)
  if (proposedOrAvailabilityMeeting || hasStatedAvailabilitySignal(latestBuyerInteraction)) {
    const interactionId =
      proposedOrAvailabilityMeeting?.availabilityEvidenceInteractionId ?? latestBuyerInteraction?.id;

    const evidence: RecommendationEvidence = {
      summary: "Buyer shared availability or proposed slot, but meeting is not yet mutually confirmed.",
      interactionIds: interactionId ? [interactionId] : [],
      meetingId: proposedOrAvailabilityMeeting?.id,
      signals: ["BUYER_AVAILABILITY_SHARED", "CONFIRMATION_PENDING"],
      missingEvidence: ["MUTUAL_TIME_CONFIRMATION"],
    };

    let nextStepClass: FollowUpNextStepClass = "REQUEST_MEETING_CONFIRMATION";
    let draftId: string | undefined;

    if (pendingDraft) {
      nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
      draftId = pendingDraft.id;
    }

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_prog_${customerId}_avail_${now}`,
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
      stage: "AVAILABILITY_SHARED",
      recommendation,
      hasBuyerResponse: true,
      lastBuyerInteractionId: latestBuyerInteraction?.id,
      isConfirmedMeeting: false,
    };
  }

  // 3. Buyer has actively engaged (responded to details, asked questions)
  if (latestBuyerInteraction) {
    const evidence: RecommendationEvidence = {
      summary: `Buyer responded via ${latestBuyerInteraction.channel} on ${latestBuyerInteraction.occurredAt}. Propose suitable meeting slots.`,
      interactionIds: [latestBuyerInteraction.id],
      signals: ["BUYER_RESPONSE_RECEIVED"],
      missingEvidence: ["BUYER_PREFERRED_TIMESLOT"],
    };

    let nextStepClass: FollowUpNextStepClass = "PROPOSE_MEETING_SLOTS";
    let draftId: string | undefined;

    if (pendingDraft) {
      nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
      draftId = pendingDraft.id;
    }

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_prog_${customerId}_engaged_${now}`,
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
      stage: "BUYER_ENGAGED",
      recommendation,
      hasBuyerResponse: true,
      lastBuyerInteractionId: latestBuyerInteraction.id,
      isConfirmedMeeting: false,
    };
  }

  // 4. Details sent, but NO buyer engagement yet.
  // Unanswered seller activity (calls, messages) must NOT count as buyer engagement.
  const unansweredSellerAttempts = sellerOutboundInteractions.filter(
    (i) => i.outcome === "NO_ANSWER" || i.outcome === "VOICEMAIL_LEFT" || i.outcome === "MESSAGE_DELIVERED",
  );

  const evidence: RecommendationEvidence = {
    summary:
      unansweredSellerAttempts.length > 0
        ? `Details were shared and seller made ${unansweredSellerAttempts.length} contact attempt(s) with no buyer reply. Await buyer response before further outreach.`
        : "Details were shared. No buyer engagement recorded yet. Await buyer response.",
    interactionIds: unansweredSellerAttempts.map((i) => i.id),
    signals: unansweredSellerAttempts.length > 0 ? ["UNANSWERED_SELLER_ATTEMPTS"] : ["DETAILS_PENDING_RESPONSE"],
    missingEvidence: ["BUYER_FIRST_RESPONSE"],
  };

  const recommendation: FollowUpRecommendation = {
    recommendationId: `rec_prog_${customerId}_await_${now}`,
    customerId,
    opportunityId: context.opportunity?.opportunityId,
    nextStepClass: "AWAIT_BUYER_RESPONSE",
    channel,
    isContactAllowed: true,
    evidence,
    generatedAt: now,
  };

  return {
    stage: "DETAILS_SHARED",
    recommendation,
    hasBuyerResponse: false,
    lastBuyerInteractionId: undefined,
    isConfirmedMeeting: false,
  };
}

function hasStatedAvailabilitySignal(interaction?: Interaction): boolean {
  if (!interaction || interaction.actorRole !== "BUYER") return false;
  // If interaction source ref or source metadata hints availability
  const ref = (interaction.sourceRef ?? "").toLowerCase();
  return ref.includes("availab") || ref.includes("timeslot") || ref.includes("free_at");
}
