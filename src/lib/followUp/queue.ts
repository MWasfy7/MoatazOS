/**
 * MoatazOS — Daily Queue Ranking Against Available Time.
 *
 * Deterministic pure function to score, rank, and allocate follow-up
 * tasks within a daily time budget.
 *
 * Invariants:
 *  1. Same inputs and clock produce the exact same queue (deterministic).
 *  2. Unanswered seller activity never counts as buyer engagement.
 *  3. Restricted outreach produces no contact recommendation (routed to suppressed).
 *  4. Availability does not become a confirmed meeting.
 *  5. Drafts never become completed actions automatically.
 */

import {
  isBuyerEngagementInteraction,
  resolveContactAllowance,
  type InteractionChannel,
} from "@/lib/revenueCore";
import { evaluateMeetingConfirmationAndRecovery } from "./confirmation";
import { evaluatePostVisitProgression } from "./postVisit";
import { evaluateDetailsToMeetingProgression } from "./progression";
import type {
  FollowUpCandidateContext,
  FollowUpRecommendation,
  IsoTimestamp,
  QueueItem,
  QueuePriorityBand,
  RankedDailyQueue,
} from "./types";

export interface RankDailyQueueOptions {
  candidates: FollowUpCandidateContext[];
  availableTimeMinutes: number;
  now: IsoTimestamp;
}

export function rankDailyQueue(options: RankDailyQueueOptions): RankedDailyQueue {
  const { candidates, availableTimeMinutes, now } = options;
  const nowMs = Date.parse(now);

  const evaluatedItems: QueueItem[] = candidates.map((candidate, index) => {
    const customerId = candidate.customer.customerId;
    const channel: InteractionChannel = candidate.preferredChannel ?? "WHATSAPP";
    const duration = candidate.estimatedDurationMinutes ?? 15;

    // Evaluate channel contact allowance
    const contactAllowance = resolveContactAllowance(candidate.consentRecords, customerId, channel);
    const isRestricted = contactAllowance.status === "RESTRICTED";

    // 1. Check commitments
    const commitments = candidate.commitments?.filter((c) => c.customerId === customerId) ?? [];
    const overdueCommitments = commitments.filter(
      (c) => c.status === "PENDING" && Date.parse(c.dueAt) < nowMs,
    );
    const isOverdue = overdueCommitments.length > 0;
    const maxOverdueMinutes = isOverdue
      ? Math.max(
          ...overdueCommitments.map((c) => Math.max(0, Math.round((nowMs - Date.parse(c.dueAt)) / 60000))),
        )
      : undefined;

    // 2. Check genuine buyer engagement (seller-authored activity excluded)
    const buyerInteractions = candidate.interactions
      .filter((i) => i.customerId === customerId && isBuyerEngagementInteraction(i))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    const latestBuyerInteraction = buyerInteractions[buyerInteractions.length - 1];
    const sellerOutbounds = candidate.interactions.filter(
      (i) => i.customerId === customerId && i.actorRole === "SELLER" && i.direction === "OUTBOUND",
    );
    const latestSellerOutbound = [...sellerOutbounds].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).pop();

    // Has buyer replied AFTER seller's last outbound?
    const hasRecentBuyerResponse = Boolean(
      latestBuyerInteraction &&
        (!latestSellerOutbound || latestBuyerInteraction.occurredAt > latestSellerOutbound.occurredAt),
    );

    // 3. Determine best recommendation for this candidate
    let recommendation: FollowUpRecommendation;
    let hasMissingEvidence = false;

    const visits = candidate.visits?.filter((v) => v.customerId === customerId && v.status === "COMPLETED") ?? [];
    const meetings = candidate.meetings?.filter((m) => m.customerId === customerId) ?? [];

    if (visits.length > 0 || isOverdue) {
      const pvEval = evaluatePostVisitProgression(candidate, now);
      recommendation = pvEval.recommendation;
      hasMissingEvidence = pvEval.missingEvidence.length > 0;
    } else if (meetings.length > 0) {
      const meetEval = evaluateMeetingConfirmationAndRecovery(candidate, now);
      recommendation = meetEval.recommendation;
      hasMissingEvidence = (recommendation.evidence.missingEvidence?.length ?? 0) > 0;
    } else {
      const progEval = evaluateDetailsToMeetingProgression(candidate, now);
      recommendation = progEval.recommendation;
      hasMissingEvidence = (recommendation.evidence.missingEvidence?.length ?? 0) > 0;
    }

    // 4. Assign priority band and score
    let priorityBand: QueuePriorityBand;
    let baseScore: number;
    let rationale: string;

    if (isRestricted) {
      priorityBand = "LOW_NURTURE";
      baseScore = 0;
      rationale = `Contact restricted on ${channel} (${contactAllowance.reason ?? "RESTRICTED"}). Suppressed from outreach queue.`;
    } else if (isOverdue) {
      priorityBand = "CRITICAL_OVERDUE";
      // Higher score for longer overdue
      baseScore = 4000 + Math.min(maxOverdueMinutes ?? 0, 999);
      rationale = `Overdue commitment: ${overdueCommitments[0]?.description} (${maxOverdueMinutes}m overdue).`;
    } else if (hasRecentBuyerResponse) {
      priorityBand = "HIGH_ENGAGEMENT";
      baseScore = 3000;
      rationale = `Recent unaddressed buyer reply on ${latestBuyerInteraction?.occurredAt}.`;
    } else if (recommendation.nextStepClass === "NO_SHOW_RECOVERY_CHECKIN") {
      priorityBand = "HIGH_ENGAGEMENT";
      baseScore = 2800;
      rationale = "Missed meeting requires empathetic recovery check-in.";
    } else if (recommendation.nextStepClass === "REQUEST_MEETING_CONFIRMATION") {
      priorityBand = "STANDARD_PROGRESSION";
      baseScore = 2500;
      rationale = "Upcoming meeting requires mutual confirmation check.";
    } else if (hasMissingEvidence) {
      priorityBand = "STANDARD_PROGRESSION";
      baseScore = 2000;
      rationale = "Progression pending required decision evidence.";
    } else {
      priorityBand = "LOW_NURTURE";
      baseScore = 1000;
      rationale = "Awaiting buyer response or standard cadence.";
    }

    const title = `Follow-up: ${candidate.customer.customerId} (${recommendation.nextStepClass})`;

    return {
      id: `qitem_${customerId}_${index}`,
      customerId,
      opportunityId: candidate.opportunity?.opportunityId,
      title,
      recommendation,
      priorityBand,
      priorityScore: baseScore,
      estimatedDurationMinutes: duration,
      isOverdue,
      overdueMinutes: maxOverdueMinutes,
      hasRecentBuyerResponse,
      hasMissingEvidence,
      isRestricted,
      rationale,
    };
  });

  // Separate restricted/suppressed items from active items
  const suppressedItems: QueueItem[] = [];
  const activeItems: QueueItem[] = [];

  for (const item of evaluatedItems) {
    if (item.isRestricted || item.recommendation.nextStepClass === "NO_CONTACT_RESTRICTION") {
      suppressedItems.push(item);
    } else {
      activeItems.push(item);
    }
  }

  // Sort active items deterministically:
  // 1. Priority score descending
  // 2. For items with same score, sort by customerId alphabetically ascending (deterministic tie-breaker)
  activeItems.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.customerId.localeCompare(b.customerId);
  });

  // Sort suppressed items deterministically as well
  suppressedItems.sort((a, b) => a.customerId.localeCompare(b.customerId));

  // Allocate active items against available time budget
  const scheduledItems: QueueItem[] = [];
  const backlogItems: QueueItem[] = [];
  let allocatedMinutes = 0;

  for (const item of activeItems) {
    if (allocatedMinutes + item.estimatedDurationMinutes <= availableTimeMinutes) {
      scheduledItems.push(item);
      allocatedMinutes += item.estimatedDurationMinutes;
    } else {
      backlogItems.push(item);
    }
  }

  return {
    generatedAt: now,
    totalAvailableMinutes: availableTimeMinutes,
    allocatedMinutes,
    scheduledItems,
    backlogItems,
    suppressedItems,
  };
}
