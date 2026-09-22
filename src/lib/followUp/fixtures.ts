/**
 * MoatazOS — Synthetic Fixtures for Follow-up Progression Engine.
 *
 * Deterministic synthetic fixtures with zero real customer data,
 * representing key sales pipeline progression scenarios and boundary
 * conditions.
 */

import type { ChannelConsent, CustomerRecord, Interaction, RevenueOpportunity } from "@/lib/revenueCore";
import type {
  FollowUpCandidateContext,
  FollowUpCommitment,
  FollowUpDraft,
  MeetingRecord,
  VisitRecord,
} from "./types";

export const FIXTURE_CLOCK_NOW = "2026-09-22T09:00:00.000Z";

// ---------------------------------------------------------------------------
// 1. Details sent, seller made 2 unanswered calls. Zero buyer engagement.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_DETAILS_UNANSWERED: CustomerRecord = {
  customerId: "cust_fu_001",
  createdAt: "2026-09-18T10:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_001_phone",
      channel: "PHONE",
      normalizedValue: "+201001110001",
      rawValue: "+20 100 111 0001",
      status: "ACTIVE",
      effectiveFrom: "2026-09-18T10:00:00.000Z",
    },
  ],
};

export const FIXTURE_INTERACTIONS_UNANSWERED: Interaction[] = [
  {
    id: "int_fu_001_details_sent",
    customerId: "cust_fu_001",
    contactIdentifierId: "ident_fu_001_phone",
    channel: "WHATSAPP",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "MESSAGE_DELIVERED",
    source: "WHATSAPP_EXPORT",
    occurredAt: "2026-09-19T10:00:00.000Z",
    sourceRef: "wa:details:cust_fu_001",
  },
  {
    id: "int_fu_001_call_attempt_1",
    customerId: "cust_fu_001",
    contactIdentifierId: "ident_fu_001_phone",
    channel: "CALL",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "NO_ANSWER",
    source: "CALL_LOG_IMPORT",
    occurredAt: "2026-09-20T11:30:00.000Z",
    sourceRef: "call-log:cust_fu_001:1",
  },
  {
    id: "int_fu_001_call_attempt_2",
    customerId: "cust_fu_001",
    contactIdentifierId: "ident_fu_001_phone",
    channel: "CALL",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "NO_ANSWER",
    source: "CALL_LOG_IMPORT",
    occurredAt: "2026-09-21T14:00:00.000Z",
    sourceRef: "call-log:cust_fu_001:2",
  },
];

export const FIXTURE_CONSENT_GRANTED: ChannelConsent[] = [
  { customerId: "cust_fu_001", channel: "WHATSAPP", status: "GRANTED", recordedAt: "2026-09-18T10:00:00.000Z" },
  { customerId: "cust_fu_001", channel: "CALL", status: "GRANTED", recordedAt: "2026-09-18T10:00:00.000Z" },
];

export const CANDIDATE_DETAILS_UNANSWERED: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_DETAILS_UNANSWERED,
  interactions: FIXTURE_INTERACTIONS_UNANSWERED,
  consentRecords: FIXTURE_CONSENT_GRANTED,
  detailsSentAt: "2026-09-19T10:00:00.000Z",
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 15,
};

// ---------------------------------------------------------------------------
// 2. Buyer replied with availability ("Free Thursday afternoon").
// Invariant: Availability != Confirmed Meeting.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_AVAILABILITY: CustomerRecord = {
  customerId: "cust_fu_002",
  createdAt: "2026-09-15T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_002_phone",
      channel: "WHATSAPP",
      normalizedValue: "+201001110002",
      rawValue: "+20 100 111 0002",
      status: "ACTIVE",
      effectiveFrom: "2026-09-15T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_INTERACTIONS_AVAILABILITY: Interaction[] = [
  {
    id: "int_fu_002_buyer_slot",
    customerId: "cust_fu_002",
    contactIdentifierId: "ident_fu_002_phone",
    channel: "WHATSAPP",
    direction: "INBOUND",
    actorRole: "BUYER",
    outcome: "MESSAGE_DELIVERED",
    source: "WHATSAPP_EXPORT",
    occurredAt: "2026-09-21T16:00:00.000Z",
    sourceRef: "whatsapp:availability:thursday_afternoon",
  },
];

export const FIXTURE_MEETING_PROPOSED_SLOT: MeetingRecord = {
  id: "meet_fu_002_proposed",
  customerId: "cust_fu_002",
  scheduledAt: "2026-09-24T15:00:00.000Z",
  durationMinutes: 30,
  status: "PROPOSED",
  availabilityEvidenceInteractionId: "int_fu_002_buyer_slot",
};

export const CANDIDATE_AVAILABILITY: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_AVAILABILITY,
  interactions: FIXTURE_INTERACTIONS_AVAILABILITY,
  consentRecords: [{ customerId: "cust_fu_002", channel: "WHATSAPP", status: "GRANTED" }],
  meetings: [FIXTURE_MEETING_PROPOSED_SLOT],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 10,
};

// ---------------------------------------------------------------------------
// 3. Meeting scheduled for tomorrow, confirmation pending.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_CONFIRMATION_PENDING: CustomerRecord = {
  customerId: "cust_fu_003",
  createdAt: "2026-09-10T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_003_phone",
      channel: "PHONE",
      normalizedValue: "+201001110003",
      rawValue: "+20 100 111 0003",
      status: "ACTIVE",
      effectiveFrom: "2026-09-10T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_MEETING_CONFIRMATION_PENDING: MeetingRecord = {
  id: "meet_fu_003_upcoming",
  customerId: "cust_fu_003",
  scheduledAt: "2026-09-23T11:00:00.000Z", // 26 hours ahead
  durationMinutes: 45,
  status: "AWAITING_CONFIRMATION",
};

export const CANDIDATE_CONFIRMATION_PENDING: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_CONFIRMATION_PENDING,
  interactions: [],
  consentRecords: [{ customerId: "cust_fu_003", channel: "WHATSAPP", status: "GRANTED" }],
  meetings: [FIXTURE_MEETING_CONFIRMATION_PENDING],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 15,
};

// ---------------------------------------------------------------------------
// 4. Meeting was missed (no-show). Seller called, NO_ANSWER.
// Invariant: Unanswered seller call does NOT resolve no-show.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_NO_SHOW: CustomerRecord = {
  customerId: "cust_fu_004",
  createdAt: "2026-09-01T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_004_phone",
      channel: "PHONE",
      normalizedValue: "+201001110004",
      rawValue: "+20 100 111 0004",
      status: "ACTIVE",
      effectiveFrom: "2026-09-01T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_MEETING_MISSED: MeetingRecord = {
  id: "meet_fu_004_missed",
  customerId: "cust_fu_004",
  scheduledAt: "2026-09-21T14:00:00.000Z",
  durationMinutes: 30,
  status: "NO_SHOW",
};

export const FIXTURE_INTERACTIONS_NO_SHOW: Interaction[] = [
  {
    id: "int_fu_004_rep_call_after_miss",
    customerId: "cust_fu_004",
    contactIdentifierId: "ident_fu_004_phone",
    channel: "CALL",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "NO_ANSWER",
    source: "CALL_LOG_IMPORT",
    occurredAt: "2026-09-21T14:15:00.000Z",
    sourceRef: "call-log:cust_fu_004:post_noshow",
  },
];

export const CANDIDATE_NO_SHOW: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_NO_SHOW,
  interactions: FIXTURE_INTERACTIONS_NO_SHOW,
  consentRecords: [{ customerId: "cust_fu_004", channel: "WHATSAPP", status: "GRANTED" }],
  meetings: [FIXTURE_MEETING_MISSED],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 20,
};

// ---------------------------------------------------------------------------
// 5. Site visit completed, seller commitment overdue.
// Invariant: Overdue commitment elevates urgency.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_OVERDUE_COMMITMENT: CustomerRecord = {
  customerId: "cust_fu_005",
  createdAt: "2026-08-20T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_005_phone",
      channel: "PHONE",
      normalizedValue: "+201001110005",
      rawValue: "+20 100 111 0005",
      status: "ACTIVE",
      effectiveFrom: "2026-08-20T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_VISIT_COMPLETED: VisitRecord = {
  id: "visit_fu_005_completed",
  customerId: "cust_fu_005",
  propertyId: "prop_new_cairo_villa_09",
  visitedAt: "2026-09-20T15:00:00.000Z",
  status: "COMPLETED",
  selectedUnitId: "unit_v09_b",
};

export const FIXTURE_COMMITMENT_OVERDUE_SELLER: FollowUpCommitment = {
  id: "com_fu_005_payment_plan",
  customerId: "cust_fu_005",
  party: "SELLER",
  description: "Send customized 7-year installment schedule for unit V09-B",
  dueAt: "2026-09-21T18:00:00.000Z", // 15 hours overdue relative to FIXTURE_CLOCK_NOW
  status: "PENDING",
  sourceInteractionId: "int_fu_005_visit_notes",
};

export const CANDIDATE_OVERDUE_COMMITMENT: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_OVERDUE_COMMITMENT,
  interactions: [],
  consentRecords: [{ customerId: "cust_fu_005", channel: "WHATSAPP", status: "GRANTED" }],
  visits: [FIXTURE_VISIT_COMPLETED],
  commitments: [FIXTURE_COMMITMENT_OVERDUE_SELLER],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 20,
};

// ---------------------------------------------------------------------------
// 6. Site visit completed, missing unit and decision feedback.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_MISSING_EVIDENCE: CustomerRecord = {
  customerId: "cust_fu_006",
  createdAt: "2026-08-25T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_006_phone",
      channel: "PHONE",
      normalizedValue: "+201001110006",
      rawValue: "+20 100 111 0006",
      status: "ACTIVE",
      effectiveFrom: "2026-08-25T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_VISIT_NO_UNIT: VisitRecord = {
  id: "visit_fu_006_no_unit",
  customerId: "cust_fu_006",
  propertyId: "prop_october_duplex",
  visitedAt: "2026-09-21T11:00:00.000Z",
  status: "COMPLETED",
};

export const CANDIDATE_MISSING_EVIDENCE: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_MISSING_EVIDENCE,
  interactions: [],
  consentRecords: [{ customerId: "cust_fu_006", channel: "WHATSAPP", status: "GRANTED" }],
  visits: [FIXTURE_VISIT_NO_UNIT],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 15,
};

// ---------------------------------------------------------------------------
// 7. Contact restriction active (Consent WITHDRAWN / DENIED).
// Invariant: Restricted outreach produces NO contact recommendation.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_RESTRICTED: CustomerRecord = {
  customerId: "cust_fu_007",
  createdAt: "2026-07-01T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_007_phone",
      channel: "PHONE",
      normalizedValue: "+201001110007",
      rawValue: "+20 100 111 0007",
      status: "ACTIVE",
      effectiveFrom: "2026-07-01T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_CONSENT_RESTRICTED: ChannelConsent[] = [
  {
    customerId: "cust_fu_007",
    channel: "WHATSAPP",
    status: "WITHDRAWN",
    recordedAt: "2026-09-10T12:00:00.000Z",
    sourceRef: "crm:opt_out:cust_fu_007",
  },
  {
    customerId: "cust_fu_007",
    channel: "CALL",
    status: "DENIED",
    recordedAt: "2026-09-10T12:00:00.000Z",
  },
];

export const CANDIDATE_RESTRICTED: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_RESTRICTED,
  interactions: [],
  consentRecords: FIXTURE_CONSENT_RESTRICTED,
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 10,
};

// ---------------------------------------------------------------------------
// 8. Follow-up draft pending human review.
// Invariant: Drafts never become completed actions automatically.
// ---------------------------------------------------------------------------

export const FIXTURE_CUSTOMER_DRAFT: CustomerRecord = {
  customerId: "cust_fu_008",
  createdAt: "2026-09-01T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_fu_008_phone",
      channel: "WHATSAPP",
      normalizedValue: "+201001110008",
      rawValue: "+20 100 111 0008",
      status: "ACTIVE",
      effectiveFrom: "2026-09-01T09:00:00.000Z",
    },
  ],
};

export const FIXTURE_DRAFT_PENDING: FollowUpDraft = {
  id: "draft_fu_008_followup",
  customerId: "cust_fu_008",
  channel: "WHATSAPP",
  content: "Good morning! Here are the 2 updated duplex options we discussed yesterday.",
  status: "READY_FOR_HUMAN_REVIEW",
  createdAt: "2026-09-22T08:00:00.000Z",
};

export const CANDIDATE_DRAFT: FollowUpCandidateContext = {
  customer: FIXTURE_CUSTOMER_DRAFT,
  interactions: [
    {
      id: "int_fu_008_buyer_msg",
      customerId: "cust_fu_008",
      contactIdentifierId: "ident_fu_008_phone",
      channel: "WHATSAPP",
      direction: "INBOUND",
      actorRole: "BUYER",
      outcome: "MESSAGE_DELIVERED",
      source: "WHATSAPP_EXPORT",
      occurredAt: "2026-09-21T17:00:00.000Z",
      sourceRef: "wa:cust_fu_008:request",
    },
  ],
  consentRecords: [{ customerId: "cust_fu_008", channel: "WHATSAPP", status: "GRANTED" }],
  drafts: [FIXTURE_DRAFT_PENDING],
  preferredChannel: "WHATSAPP",
  estimatedDurationMinutes: 10,
};

// ---------------------------------------------------------------------------
// Master Candidate Set for Daily Queue Tests
// Total Duration: 15 + 10 + 15 + 20 + 20 + 15 + 10 + 10 = 115 minutes
// ---------------------------------------------------------------------------

export const FIXTURE_DAILY_QUEUE_CANDIDATES: FollowUpCandidateContext[] = [
  CANDIDATE_DETAILS_UNANSWERED, // 15m, low nurture (awaiting response)
  CANDIDATE_AVAILABILITY,       // 10m, high engagement (availability shared)
  CANDIDATE_CONFIRMATION_PENDING,// 15m, standard progression (meeting confirmation)
  CANDIDATE_NO_SHOW,            // 20m, high engagement (no-show recovery)
  CANDIDATE_OVERDUE_COMMITMENT, // 20m, critical overdue
  CANDIDATE_MISSING_EVIDENCE,   // 15m, standard progression (missing feedback)
  CANDIDATE_RESTRICTED,         // 10m, restricted (suppressed)
  CANDIDATE_DRAFT,              // 10m, high engagement (buyer message + draft ready)
];
