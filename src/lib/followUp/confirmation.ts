/**
 * MoatazOS — Meeting Confirmation and No-Show Recovery.
 *
 * Pure functions to evaluate upcoming meeting confirmation checks
 * and post-meeting no-show recovery.
 *
 * Invariants:
 *  1. Availability does not become a confirmed meeting.
 *  2. Unanswered seller activity does not count as buyer engagement or resolve no-show.
 *  3. Restricted outreach produces no contact recommendation.
 *  4. Drafts never become completed actions automatically.
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
  MeetingConfirmationEvaluation,
  MeetingRecoveryStage,
  RecommendationEvidence,
} from "./types";

const CONFIRMATION_WINDOW_HOURS = 24;

export function evaluateMeetingConfirmationAndRecovery(
  context: FollowUpCandidateContext,
  now: IsoTimestamp,
): MeetingConfirmationEvaluation {
  const customerId = context.customer.customerId;
  const channel: InteractionChannel = context.preferredChannel ?? "WHATSAPP";

  // Check channel consent / restrictions
  const contactAllowance = resolveContactAllowance(context.consentRecords, customerId, channel);
  const isRestricted = contactAllowance.status === "RESTRICTED";

  const meetings = context.meetings?.filter((m) => m.customerId === customerId) ?? [];

  if (meetings.length === 0) {
    const evidence: RecommendationEvidence = {
      summary: "No meetings scheduled or recorded for customer.",
      interactionIds: [],
      signals: ["NO_MEETINGS_RECORDED"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_conf_${customerId}_none_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_ACTION_REQUIRED",
      channel,
      isContactAllowed: !isRestricted,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "NOT_APPLICABLE",
      recommendation,
      isNoShow: false,
      isConfirmed: false,
    };
  }

  // Sort meetings chronologically
  const sortedMeetings = [...meetings].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  // Find most relevant meeting: past uncompleted/no-show meeting, or next upcoming meeting
  const pastUnresolvedMeeting = sortedMeetings
    .filter((m) => m.scheduledAt <= now && m.status !== "COMPLETED" && m.status !== "CANCELLED")
    .pop();

  const upcomingMeeting = sortedMeetings.find((m) => m.scheduledAt > now && m.status !== "CANCELLED");

  // Check for pending drafts
  const pendingDraft = context.drafts?.find(
    (d) => d.customerId === customerId && (d.status === "DRAFT" || d.status === "READY_FOR_HUMAN_REVIEW"),
  );

  // 1. Evaluate No-Show Recovery
  if (pastUnresolvedMeeting) {
    const isNoShow = pastUnresolvedMeeting.status === "NO_SHOW" || pastUnresolvedMeeting.scheduledAt <= now;

    // Check interactions after the meeting scheduled time
    const postMeetingInteractions = context.interactions.filter(
      (i) => i.customerId === customerId && i.occurredAt >= pastUnresolvedMeeting.scheduledAt,
    );

    const postMeetingBuyerInteractions = postMeetingInteractions.filter(isBuyerEngagementInteraction);
    const postMeetingSellerAttempts = postMeetingInteractions.filter(
      (i) => i.actorRole === "SELLER" && (i.outcome === "NO_ANSWER" || i.outcome === "VOICEMAIL_LEFT" || i.outcome === "MESSAGE_DELIVERED"),
    );

    // If contact is restricted, suppress outreach
    if (isRestricted) {
      const evidence: RecommendationEvidence = {
        summary: `Meeting ${pastUnresolvedMeeting.id} scheduled for ${pastUnresolvedMeeting.scheduledAt} was missed (no-show), but contact on ${channel} is restricted (${contactAllowance.reason}). No recovery outreach permitted.`,
        interactionIds: pastUnresolvedMeeting.confirmationEvidenceInteractionId
          ? [pastUnresolvedMeeting.confirmationEvidenceInteractionId]
          : [],
        meetingId: pastUnresolvedMeeting.id,
        signals: ["NO_SHOW_DETECTED", "CONTACT_RESTRICTION_ACTIVE"],
      };

      const recommendation: FollowUpRecommendation = {
        recommendationId: `rec_conf_${customerId}_noshow_restricted_${now}`,
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
        stage: "NO_SHOW_RECOVERY_NEEDED",
        meetingId: pastUnresolvedMeeting.id,
        recommendation,
        isNoShow: true,
        isConfirmed: pastUnresolvedMeeting.status === "CONFIRMED",
      };
    }

    // Unanswered seller activity does not resolve no-show or count as buyer engagement
    if (postMeetingBuyerInteractions.length === 0) {
      let nextStepClass: FollowUpNextStepClass = "NO_SHOW_RECOVERY_CHECKIN";
      let draftId: string | undefined;

      if (pendingDraft) {
        nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
        draftId = pendingDraft.id;
      }

      const evidence: RecommendationEvidence = {
        summary:
          postMeetingSellerAttempts.length > 0
            ? `Meeting ${pastUnresolvedMeeting.id} was missed. Seller attempted contact ${postMeetingSellerAttempts.length} time(s) with no buyer response. Unanswered attempts do not resolve no-show. Empathetic recovery check-in recommended.`
            : `Meeting ${pastUnresolvedMeeting.id} scheduled for ${pastUnresolvedMeeting.scheduledAt} was missed. No buyer response recorded. Empathetic check-in recommended.`,
        interactionIds: [
          ...postMeetingSellerAttempts.map((i) => i.id),
          ...(pastUnresolvedMeeting.confirmationEvidenceInteractionId
            ? [pastUnresolvedMeeting.confirmationEvidenceInteractionId]
            : []),
        ],
        meetingId: pastUnresolvedMeeting.id,
        signals: ["NO_SHOW_DETECTED", "NO_BUYER_RECOVERY_RESPONSE"],
        missingEvidence: ["BUYER_RESCHEDULE_PREFERENCE"],
      };

      const recommendation: FollowUpRecommendation = {
        recommendationId: `rec_conf_${customerId}_noshow_${now}`,
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
        stage:
          postMeetingSellerAttempts.length > 0
            ? "RECOVERY_ATTEMPTED_AWAITING_RESPONSE"
            : "NO_SHOW_RECOVERY_NEEDED",
        meetingId: pastUnresolvedMeeting.id,
        recommendation,
        isNoShow: true,
        isConfirmed: pastUnresolvedMeeting.status === "CONFIRMED",
      };
    }

    // Buyer has replied after no-show
    const latestBuyerReply = postMeetingBuyerInteractions[postMeetingBuyerInteractions.length - 1];
    const evidence: RecommendationEvidence = {
      summary: `Buyer reached out following missed meeting on ${latestBuyerReply?.occurredAt}. Propose rescheduling options.`,
      interactionIds: latestBuyerReply ? [latestBuyerReply.id] : [],
      meetingId: pastUnresolvedMeeting.id,
      signals: ["BUYER_REENGAGED_AFTER_NO_SHOW"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_conf_${customerId}_noshow_reengaged_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "PROPOSE_MEETING_SLOTS",
      channel,
      isContactAllowed: true,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "NO_SHOW_RECOVERY_NEEDED",
      meetingId: pastUnresolvedMeeting.id,
      recommendation,
      isNoShow: true,
      isConfirmed: false,
    };
  }

  // 2. Evaluate Upcoming Meeting Confirmation
  if (upcomingMeeting) {
    const meetingTimeMs = Date.parse(upcomingMeeting.scheduledAt);
    const nowMs = Date.parse(now);
    const hoursUntilMeeting = (meetingTimeMs - nowMs) / (1000 * 60 * 60);

    const isConfirmed =
      upcomingMeeting.status === "CONFIRMED" &&
      Boolean(upcomingMeeting.confirmationEvidenceInteractionId);

    // If contact is restricted, no confirmation outreach allowed
    if (isRestricted) {
      const evidence: RecommendationEvidence = {
        summary: `Meeting ${upcomingMeeting.id} is upcoming at ${upcomingMeeting.scheduledAt}, but outreach on ${channel} is restricted (${contactAllowance.reason}).`,
        interactionIds: upcomingMeeting.confirmationEvidenceInteractionId
          ? [upcomingMeeting.confirmationEvidenceInteractionId]
          : [],
        meetingId: upcomingMeeting.id,
        signals: ["CONTACT_RESTRICTION_ACTIVE"],
      };

      const recommendation: FollowUpRecommendation = {
        recommendationId: `rec_conf_${customerId}_upcoming_restricted_${now}`,
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
        stage: isConfirmed ? "CONFIRMED_UPCOMING" : "CONFIRMATION_PENDING",
        meetingId: upcomingMeeting.id,
        recommendation,
        isNoShow: false,
        isConfirmed,
      };
    }

    // Availability does NOT become confirmed meeting
    if (!isConfirmed) {
      let nextStepClass: FollowUpNextStepClass = "REQUEST_MEETING_CONFIRMATION";
      let draftId: string | undefined;

      if (pendingDraft) {
        nextStepClass = "SEND_FOLLOWUP_DRAFT_FOR_REVIEW";
        draftId = pendingDraft.id;
      }

      const evidence: RecommendationEvidence = {
        summary: `Meeting ${upcomingMeeting.id} is scheduled in ${Math.max(0, Math.round(hoursUntilMeeting))} hour(s) but is unconfirmed. Buyer availability was stated without mutual confirmation.`,
        interactionIds: upcomingMeeting.availabilityEvidenceInteractionId
          ? [upcomingMeeting.availabilityEvidenceInteractionId]
          : [],
        meetingId: upcomingMeeting.id,
        signals: ["UNCONFIRMED_MEETING", "CONFIRMATION_REQUIRED"],
        missingEvidence: ["BUYER_MEETING_CONFIRMATION"],
      };

      const recommendation: FollowUpRecommendation = {
        recommendationId: `rec_conf_${customerId}_req_conf_${now}`,
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
        stage: "CONFIRMATION_PENDING",
        meetingId: upcomingMeeting.id,
        recommendation,
        isNoShow: false,
        isConfirmed: false,
      };
    }

    // Already confirmed upcoming meeting
    const evidence: RecommendationEvidence = {
      summary: `Meeting ${upcomingMeeting.id} is confirmed for ${upcomingMeeting.scheduledAt}. No further confirmation needed.`,
      interactionIds: upcomingMeeting.confirmationEvidenceInteractionId
        ? [upcomingMeeting.confirmationEvidenceInteractionId]
        : [],
      meetingId: upcomingMeeting.id,
      signals: ["MEETING_MUTUALLY_CONFIRMED"],
    };

    const recommendation: FollowUpRecommendation = {
      recommendationId: `rec_conf_${customerId}_confirmed_upcoming_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_ACTION_REQUIRED",
      channel,
      isContactAllowed: true,
      evidence,
      generatedAt: now,
    };

    return {
      stage: "CONFIRMED_UPCOMING",
      meetingId: upcomingMeeting.id,
      recommendation,
      isNoShow: false,
      isConfirmed: true,
    };
  }

  // Fallback
  return {
    stage: "NOT_APPLICABLE",
    recommendation: {
      recommendationId: `rec_conf_${customerId}_fallback_${now}`,
      customerId,
      opportunityId: context.opportunity?.opportunityId,
      nextStepClass: "NO_ACTION_REQUIRED",
      channel,
      isContactAllowed: !isRestricted,
      evidence: {
        summary: "No actionable meeting confirmation or no-show state detected.",
        interactionIds: [],
        signals: [],
      },
      generatedAt: now,
    },
    isNoShow: false,
    isConfirmed: false,
  };
}
