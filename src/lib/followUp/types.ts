/**
 * MoatazOS — Follow-up Progression Engine contracts.
 *
 * Pure, dependency-free TypeScript types for daily queue ranking,
 * details-to-meeting progression, meeting confirmation/no-show recovery,
 * and post-visit reservation progression.
 *
 * Built strictly against revenueCore contracts (CustomerId, CustomerRecord,
 * Interaction, ChannelConsent, RevenueOpportunity). No duplicate customer
 * or interaction schema.
 *
 * Invariants:
 *  1. An explicit clock (IsoTimestamp) is passed into all evaluators.
 *  2. Unanswered seller activity never counts as buyer engagement.
 *  3. Restricted outreach produces no contact recommendation.
 *  4. Availability does not become a confirmed meeting.
 *  5. Drafts never become completed actions automatically.
 */

import type {
  ChannelConsent,
  CustomerId,
  CustomerRecord,
  Interaction,
  InteractionChannel,
  RevenueOpportunity,
} from "@/lib/revenueCore";

export type {
  ChannelConsent,
  CustomerId,
  CustomerRecord,
  Interaction,
  InteractionChannel,
  RevenueOpportunity,
};

export type IsoTimestamp = string;

// ---------------------------------------------------------------------------
// Commitments & Promises
// ---------------------------------------------------------------------------

export type CommitmentParty = "SELLER" | "BUYER";

export type CommitmentStatus = "PENDING" | "FULFILLED" | "OVERDUE" | "CANCELLED";

export interface FollowUpCommitment {
  id: string;
  customerId: CustomerId;
  opportunityId?: string;
  party: CommitmentParty;
  description: string;
  dueAt: IsoTimestamp;
  status: CommitmentStatus;
  fulfilledAt?: IsoTimestamp;
  sourceInteractionId?: string;
}

// ---------------------------------------------------------------------------
// Drafts (Human-in-the-loop: drafts NEVER become completed actions automatically)
// ---------------------------------------------------------------------------

export type DraftStatus = "DRAFT" | "READY_FOR_HUMAN_REVIEW" | "REJECTED";

export interface FollowUpDraft {
  id: string;
  customerId: CustomerId;
  opportunityId?: string;
  channel: InteractionChannel;
  content: string;
  status: DraftStatus;
  createdAt: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Meetings & Attendance (Availability != Confirmed Meeting)
// ---------------------------------------------------------------------------

export type MeetingStatus =
  | "PROPOSED"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED";

export interface MeetingRecord {
  id: string;
  customerId: CustomerId;
  opportunityId?: string;
  scheduledAt: IsoTimestamp;
  durationMinutes: number;
  status: MeetingStatus;
  /** Set ONLY when explicit mutual confirmation is established. */
  confirmationEvidenceInteractionId?: string;
  /** Set when buyer shared availability slots, not yet mutually confirmed. */
  availabilityEvidenceInteractionId?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Site Visits & Property Viewing
// ---------------------------------------------------------------------------

export type VisitStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface VisitRecord {
  id: string;
  customerId: CustomerId;
  opportunityId?: string;
  propertyId?: string;
  visitedAt: IsoTimestamp;
  status: VisitStatus;
  attendees?: string[];
  feedbackInteractionId?: string;
  selectedUnitId?: string;
  objectionNotes?: string;
}

// ---------------------------------------------------------------------------
// Follow-up Recommendations & Explanations
// ---------------------------------------------------------------------------

export type FollowUpNextStepClass =
  | "AWAIT_BUYER_RESPONSE"
  | "PROPOSE_MEETING_SLOTS"
  | "REQUEST_MEETING_CONFIRMATION"
  | "SEND_FOLLOWUP_DRAFT_FOR_REVIEW"
  | "NO_SHOW_RECOVERY_CHECKIN"
  | "GATHER_MISSING_VISIT_FEEDBACK"
  | "PREPARE_RESERVATION_SUMMARY"
  | "FULFILL_OVERDUE_COMMITMENT"
  | "GATHER_MISSING_EVIDENCE"
  | "NO_CONTACT_RESTRICTION"
  | "NO_ACTION_REQUIRED";

export interface RecommendationEvidence {
  summary: string;
  interactionIds: string[];
  commitmentIds?: string[];
  meetingId?: string;
  visitId?: string;
  signals: string[];
  missingEvidence?: string[];
}

export interface FollowUpRecommendation {
  recommendationId: string;
  customerId: CustomerId;
  opportunityId?: string;
  nextStepClass: FollowUpNextStepClass;
  channel?: InteractionChannel;
  draftId?: string;
  isContactAllowed: boolean;
  contactRestrictionReason?: string;
  evidence: RecommendationEvidence;
  generatedAt: IsoTimestamp;
}

// ---------------------------------------------------------------------------
// Progression Stages
// ---------------------------------------------------------------------------

export type DetailsToMeetingStage =
  | "DETAILS_SHARED"
  | "BUYER_ENGAGED"
  | "AVAILABILITY_SHARED"
  | "MEETING_CONFIRMED"
  | "STALLED";

export interface DetailsToMeetingEvaluation {
  stage: DetailsToMeetingStage;
  recommendation: FollowUpRecommendation;
  hasBuyerResponse: boolean;
  lastBuyerInteractionId?: string;
  isConfirmedMeeting: boolean;
}

export type MeetingRecoveryStage =
  | "NOT_APPLICABLE"
  | "CONFIRMATION_PENDING"
  | "CONFIRMED_UPCOMING"
  | "NO_SHOW_RECOVERY_NEEDED"
  | "RECOVERY_ATTEMPTED_AWAITING_RESPONSE";

export interface MeetingConfirmationEvaluation {
  stage: MeetingRecoveryStage;
  meetingId?: string;
  recommendation: FollowUpRecommendation;
  isNoShow: boolean;
  isConfirmed: boolean;
}

export type PostVisitStage =
  | "NOT_VISITED"
  | "FEEDBACK_PENDING"
  | "UNIT_EXPLORATION"
  | "RESERVATION_IN_PROGRESS"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export interface PostVisitEvaluation {
  stage: PostVisitStage;
  visitId?: string;
  recommendation: FollowUpRecommendation;
  selectedUnitId?: string;
  missingEvidence: string[];
}

// ---------------------------------------------------------------------------
// Daily Queue & Ranking
// ---------------------------------------------------------------------------

export type QueuePriorityBand =
  | "CRITICAL_OVERDUE"
  | "HIGH_ENGAGEMENT"
  | "STANDARD_PROGRESSION"
  | "LOW_NURTURE";

export interface QueueItem {
  id: string;
  customerId: CustomerId;
  opportunityId?: string;
  title: string;
  recommendation: FollowUpRecommendation;
  priorityBand: QueuePriorityBand;
  priorityScore: number;
  estimatedDurationMinutes: number;
  isOverdue: boolean;
  overdueMinutes?: number;
  hasRecentBuyerResponse: boolean;
  hasMissingEvidence: boolean;
  isRestricted: boolean;
  rationale: string;
}

export interface RankedDailyQueue {
  generatedAt: IsoTimestamp;
  totalAvailableMinutes: number;
  allocatedMinutes: number;
  scheduledItems: QueueItem[];
  backlogItems: QueueItem[];
  suppressedItems: QueueItem[];
}

// ---------------------------------------------------------------------------
// Candidate Context (Unified Input for Progression & Queue Ranking)
// ---------------------------------------------------------------------------

export interface FollowUpCandidateContext {
  customer: CustomerRecord;
  opportunity?: RevenueOpportunity;
  interactions: Interaction[];
  consentRecords: ChannelConsent[];
  commitments?: FollowUpCommitment[];
  meetings?: MeetingRecord[];
  visits?: VisitRecord[];
  drafts?: FollowUpDraft[];
  detailsSentAt?: IsoTimestamp;
  preferredChannel?: InteractionChannel;
  estimatedDurationMinutes?: number;
}
