import { describe, expect, it } from "vitest";
import {
  CANDIDATE_AVAILABILITY,
  CANDIDATE_CONFIRMATION_PENDING,
  CANDIDATE_DETAILS_UNANSWERED,
  CANDIDATE_DRAFT,
  CANDIDATE_MISSING_EVIDENCE,
  CANDIDATE_NO_SHOW,
  CANDIDATE_OVERDUE_COMMITMENT,
  CANDIDATE_RESTRICTED,
  evaluateDetailsToMeetingProgression,
  evaluateMeetingConfirmationAndRecovery,
  evaluatePostVisitProgression,
  FIXTURE_CLOCK_NOW,
  FIXTURE_DAILY_QUEUE_CANDIDATES,
  FIXTURE_DRAFT_PENDING,
  FIXTURE_INTERACTIONS_UNANSWERED,
  rankDailyQueue,
  type FollowUpCandidateContext,
  type FollowUpCommitment,
  type Interaction,
  type MeetingRecord,
  type VisitRecord,
} from "@/lib/followUp";

describe("Follow-up Progression Engine — Acceptance Criteria", () => {
  // -------------------------------------------------------------------------
  // Acceptance 1: Same inputs and clock produce the same queue (Determinism)
  // -------------------------------------------------------------------------
  describe("AC1: Deterministic Queue Ranking", () => {
    it("AC1-001 produces identical ranked output given identical inputs and clock", () => {
      const run1 = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 60,
        now: FIXTURE_CLOCK_NOW,
      });

      const run2 = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 60,
        now: FIXTURE_CLOCK_NOW,
      });

      expect(run1).toEqual(run2);
    });

    it("AC1-002 produces consistent prioritized ordering regardless of candidate input order", () => {
      const reversedCandidates = [...FIXTURE_DAILY_QUEUE_CANDIDATES].reverse();

      const standardRun = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 60,
        now: FIXTURE_CLOCK_NOW,
      });

      const reversedRun = rankDailyQueue({
        candidates: reversedCandidates,
        availableTimeMinutes: 60,
        now: FIXTURE_CLOCK_NOW,
      });

      // Scheduled items should have identical customerId sequence
      const standardOrder = standardRun.scheduledItems.map((i) => i.customerId);
      const reversedOrder = reversedRun.scheduledItems.map((i) => i.customerId);

      expect(standardOrder).toEqual(reversedOrder);
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 2: Unanswered seller activity does not count as buyer engagement
  // -------------------------------------------------------------------------
  describe("AC2: Seller Activity Isolation (No Unearned Buyer Engagement)", () => {
    it("AC2-001 multiple unanswered seller calls do not advance details-to-meeting stage", () => {
      const evaluation = evaluateDetailsToMeetingProgression(
        CANDIDATE_DETAILS_UNANSWERED,
        FIXTURE_CLOCK_NOW,
      );

      // Must remain DETAILS_SHARED, never BUYER_ENGAGED
      expect(evaluation.stage).toBe("DETAILS_SHARED");
      expect(evaluation.hasBuyerResponse).toBe(false);
      expect(evaluation.lastBuyerInteractionId).toBeUndefined();
      expect(evaluation.recommendation.nextStepClass).toBe("AWAIT_BUYER_RESPONSE");
      expect(evaluation.recommendation.evidence.signals).toContain("UNANSWERED_SELLER_ATTEMPTS");
    });

    it("AC2-002 adding another unanswered outbound seller call does not advance engagement", () => {
      const additionalSellerCall: Interaction = {
        id: "int_extra_call",
        customerId: "cust_fu_001",
        contactIdentifierId: "ident_fu_001_phone",
        channel: "CALL",
        direction: "OUTBOUND",
        actorRole: "SELLER",
        outcome: "NO_ANSWER",
        source: "CALL_LOG_IMPORT",
        occurredAt: "2026-09-22T08:00:00.000Z",
        sourceRef: "call-log:extra",
      };

      const candidateWithExtraCall: FollowUpCandidateContext = {
        ...CANDIDATE_DETAILS_UNANSWERED,
        interactions: [...FIXTURE_INTERACTIONS_UNANSWERED, additionalSellerCall],
      };

      const evalBefore = evaluateDetailsToMeetingProgression(CANDIDATE_DETAILS_UNANSWERED, FIXTURE_CLOCK_NOW);
      const evalAfter = evaluateDetailsToMeetingProgression(candidateWithExtraCall, FIXTURE_CLOCK_NOW);

      expect(evalAfter.stage).toBe(evalBefore.stage);
      expect(evalAfter.hasBuyerResponse).toBe(false);
      expect(evalAfter.recommendation.nextStepClass).toBe("AWAIT_BUYER_RESPONSE");
    });

    it("AC2-003 an unanswered seller call after a missed meeting does not resolve no-show", () => {
      const evaluation = evaluateMeetingConfirmationAndRecovery(
        CANDIDATE_NO_SHOW,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.isNoShow).toBe(true);
      expect(evaluation.stage).toBe("RECOVERY_ATTEMPTED_AWAITING_RESPONSE");
      expect(evaluation.recommendation.nextStepClass).toBe("NO_SHOW_RECOVERY_CHECKIN");
      expect(evaluation.recommendation.evidence.signals).toContain("NO_BUYER_RECOVERY_RESPONSE");
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 3: Restricted outreach produces no contact recommendation
  // -------------------------------------------------------------------------
  describe("AC3: Contact Restriction Enforcement", () => {
    it("AC3-001 customer with withdrawn/denied consent yields NO_CONTACT_RESTRICTION", () => {
      const evaluation = evaluateDetailsToMeetingProgression(
        CANDIDATE_RESTRICTED,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.recommendation.nextStepClass).toBe("NO_CONTACT_RESTRICTION");
      expect(evaluation.recommendation.isContactAllowed).toBe(false);
      expect(evaluation.recommendation.contactRestrictionReason).toBe("CONSENT_WITHDRAWN");
      expect(evaluation.stage).toBe("STALLED");
    });

    it("AC3-002 post-visit evaluation enforces contact restriction", () => {
      const restrictedVisitCandidate: FollowUpCandidateContext = {
        ...CANDIDATE_OVERDUE_COMMITMENT,
        consentRecords: [{ customerId: "cust_fu_005", channel: "WHATSAPP", status: "DENIED" }],
      };

      const evaluation = evaluatePostVisitProgression(restrictedVisitCandidate, FIXTURE_CLOCK_NOW);

      expect(evaluation.recommendation.nextStepClass).toBe("NO_CONTACT_RESTRICTION");
      expect(evaluation.recommendation.isContactAllowed).toBe(false);
      expect(evaluation.recommendation.contactRestrictionReason).toBe("CONSENT_DENIED");
    });

    it("AC3-003 restricted candidates are routed to suppressedItems in daily queue", () => {
      const queue = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 120,
        now: FIXTURE_CLOCK_NOW,
      });

      const suppressedCustIds = queue.suppressedItems.map((i) => i.customerId);
      const scheduledCustIds = queue.scheduledItems.map((i) => i.customerId);
      const backlogCustIds = queue.backlogItems.map((i) => i.customerId);

      expect(suppressedCustIds).toContain("cust_fu_007");
      expect(scheduledCustIds).not.toContain("cust_fu_007");
      expect(backlogCustIds).not.toContain("cust_fu_007");
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 4: Availability does not become a confirmed meeting
  // -------------------------------------------------------------------------
  describe("AC4: Availability vs Confirmation Boundary", () => {
    it("AC4-001 buyer stating availability leaves meeting unconfirmed", () => {
      const evaluation = evaluateDetailsToMeetingProgression(
        CANDIDATE_AVAILABILITY,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.stage).toBe("AVAILABILITY_SHARED");
      expect(evaluation.isConfirmedMeeting).toBe(false);
      expect(evaluation.recommendation.nextStepClass).toBe("REQUEST_MEETING_CONFIRMATION");
      expect(evaluation.recommendation.evidence.signals).toContain("BUYER_AVAILABILITY_SHARED");
      expect(evaluation.recommendation.evidence.missingEvidence).toContain("MUTUAL_TIME_CONFIRMATION");
    });

    it("AC4-002 meeting confirmation evaluation treats proposed slots as unconfirmed", () => {
      const evaluation = evaluateMeetingConfirmationAndRecovery(
        CANDIDATE_AVAILABILITY,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.stage).toBe("CONFIRMATION_PENDING");
      expect(evaluation.isConfirmed).toBe(false);
      expect(evaluation.recommendation.nextStepClass).toBe("REQUEST_MEETING_CONFIRMATION");
    });

    it("AC4-003 meeting only becomes confirmed when explicit confirmation evidence is attached", () => {
      const confirmedMeeting: MeetingRecord = {
        id: "meet_confirmed_001",
        customerId: "cust_fu_002",
        scheduledAt: "2026-09-24T15:00:00.000Z",
        durationMinutes: 30,
        status: "CONFIRMED",
        confirmationEvidenceInteractionId: "int_confirmation_msg",
      };

      const candidateWithConfirmedMeeting: FollowUpCandidateContext = {
        ...CANDIDATE_AVAILABILITY,
        meetings: [confirmedMeeting],
      };

      const evaluation = evaluateDetailsToMeetingProgression(
        candidateWithConfirmedMeeting,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.stage).toBe("MEETING_CONFIRMED");
      expect(evaluation.isConfirmedMeeting).toBe(true);
      expect(evaluation.recommendation.nextStepClass).toBe("NO_ACTION_REQUIRED");
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 5: Drafts never become completed actions automatically
  // -------------------------------------------------------------------------
  describe("AC5: Draft Immutability and Human Review Boundary", () => {
    it("AC5-001 draft status remains unchanged and requires human review", () => {
      const evaluation = evaluateDetailsToMeetingProgression(
        CANDIDATE_DRAFT,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.recommendation.nextStepClass).toBe("SEND_FOLLOWUP_DRAFT_FOR_REVIEW");
      expect(evaluation.recommendation.draftId).toBe(FIXTURE_DRAFT_PENDING.id);
      // Original draft object remains unchanged
      expect(FIXTURE_DRAFT_PENDING.status).toBe("READY_FOR_HUMAN_REVIEW");
    });

    it("AC5-002 draft in post-visit progression stays a review proposal, not auto-executed", () => {
      const candidateWithDraft: FollowUpCandidateContext = {
        ...CANDIDATE_OVERDUE_COMMITMENT,
        drafts: [
          {
            id: "draft_reservation",
            customerId: "cust_fu_005",
            channel: "WHATSAPP",
            content: "Attached is the draft installment breakdown for unit V09-B.",
            status: "DRAFT",
            createdAt: "2026-09-22T08:30:00.000Z",
          },
        ],
      };

      const evaluation = evaluatePostVisitProgression(candidateWithDraft, FIXTURE_CLOCK_NOW);

      expect(evaluation.recommendation.nextStepClass).toBe("SEND_FOLLOWUP_DRAFT_FOR_REVIEW");
      expect(evaluation.recommendation.draftId).toBe("draft_reservation");
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 6: Time Budgeting and Queue Allocation
  // -------------------------------------------------------------------------
  describe("Time Budgeting and Capacity Constraints", () => {
    it("AC6-001 allocates items within available time budget and moves overflow to backlog", () => {
      // Candidates have duration: overdue (20m), buyer reply draft (10m), availability (10m), etc.
      // Total available time: 40 minutes
      const queue = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 40,
        now: FIXTURE_CLOCK_NOW,
      });

      expect(queue.allocatedMinutes).toBeLessThanOrEqual(40);
      expect(queue.scheduledItems.length).toBeGreaterThan(0);
      expect(queue.backlogItems.length).toBeGreaterThan(0);

      // Verify allocatedMinutes matches exact sum of scheduled items
      const sumScheduled = queue.scheduledItems.reduce((acc, item) => acc + item.estimatedDurationMinutes, 0);
      expect(queue.allocatedMinutes).toBe(sumScheduled);
    });

    it("AC6-002 with generous time budget, all unrestricted items are scheduled", () => {
      const queue = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 300, // 5 hours (total eligible duration is ~105m)
        now: FIXTURE_CLOCK_NOW,
      });

      expect(queue.backlogItems).toHaveLength(0);
      expect(queue.scheduledItems.length).toBe(7); // 8 candidates minus 1 restricted
      expect(queue.suppressedItems.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 7: Overdue Commitments Urgency
  // -------------------------------------------------------------------------
  describe("Overdue Commitments Prioritization", () => {
    it("AC7-001 overdue commitment ranks at highest priority band CRITICAL_OVERDUE", () => {
      const queue = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 60,
        now: FIXTURE_CLOCK_NOW,
      });

      const topItem = queue.scheduledItems[0];
      expect(topItem?.customerId).toBe("cust_fu_005");
      expect(topItem?.priorityBand).toBe("CRITICAL_OVERDUE");
      expect(topItem?.isOverdue).toBe(true);
      expect(topItem?.overdueMinutes).toBeGreaterThan(0);
    });

    it("AC7-002 post-visit evaluation flags overdue seller commitment explicitly", () => {
      const evaluation = evaluatePostVisitProgression(
        CANDIDATE_OVERDUE_COMMITMENT,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.recommendation.nextStepClass).toBe("FULFILL_OVERDUE_COMMITMENT");
      expect(evaluation.recommendation.evidence.signals).toContain("SELLER_COMMITMENT_OVERDUE");
      expect(evaluation.recommendation.evidence.commitmentIds).toContain("com_fu_005_payment_plan");
    });
  });

  // -------------------------------------------------------------------------
  // Acceptance 8: Missing Evidence and Explainability
  // -------------------------------------------------------------------------
  describe("Explainability and Evidence Trail", () => {
    it("AC8-001 every recommendation explains its evidence and proposed next step", () => {
      const queue = rankDailyQueue({
        candidates: FIXTURE_DAILY_QUEUE_CANDIDATES,
        availableTimeMinutes: 120,
        now: FIXTURE_CLOCK_NOW,
      });

      const allItems = [...queue.scheduledItems, ...queue.backlogItems, ...queue.suppressedItems];

      for (const item of allItems) {
        expect(item.recommendation.nextStepClass).toBeDefined();
        expect(item.recommendation.evidence.summary).toBeTruthy();
        expect(item.recommendation.evidence.signals.length).toBeGreaterThan(0);
        expect(item.recommendation.generatedAt).toBe(FIXTURE_CLOCK_NOW);
      }
    });

    it("AC8-002 missing evidence is explicitly listed in post-visit evaluation", () => {
      const evaluation = evaluatePostVisitProgression(
        CANDIDATE_MISSING_EVIDENCE,
        FIXTURE_CLOCK_NOW,
      );

      expect(evaluation.missingEvidence).toContain("SELECTED_UNIT_ID");
      expect(evaluation.missingEvidence).toContain("POST_VISIT_FEEDBACK");
      expect(evaluation.recommendation.evidence.missingEvidence).toEqual(evaluation.missingEvidence);
    });
  });
});
