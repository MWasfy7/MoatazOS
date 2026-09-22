import type {
  ChannelConsent,
  CustomerRecord,
  DuplicateCandidate,
  Interaction,
  QualificationEvidenceItem,
  RevenueOpportunity,
} from "./types";

/**
 * Deterministic synthetic fixtures for the revenueCore contracts.
 * No real customer data. Intended for UI and workflow agents to
 * develop against before any real import path exists.
 */

// customer-001: a phone number change. History survives — the old
// identifier is retained with status SUPERSEDED, not deleted.
export const SYNTHETIC_CUSTOMER_PHONE_CHANGED: CustomerRecord = {
  customerId: "cust_001",
  createdAt: "2026-06-01T09:00:00.000Z",
  identifiers: [
    {
      id: "ident_001_phone_old",
      channel: "PHONE",
      normalizedValue: "+201001112233",
      rawValue: "+20 100 111 2233",
      status: "SUPERSEDED",
      effectiveFrom: "2026-06-01T09:00:00.000Z",
      effectiveTo: "2026-08-15T12:00:00.000Z",
    },
    {
      id: "ident_001_phone_new",
      channel: "PHONE",
      normalizedValue: "+201009998877",
      rawValue: "+20 100 999 8877",
      status: "ACTIVE",
      effectiveFrom: "2026-08-15T12:00:00.000Z",
      supersedes: "ident_001_phone_old",
      changeReason: "Buyer reported old number lost after carrier switch.",
    },
  ],
};

// customer-002 and customer-003 share a normalized phone number —
// a duplicate candidate, PENDING_REVIEW. Nothing here merges them.
export const SYNTHETIC_CUSTOMER_DUPLICATE_A: CustomerRecord = {
  customerId: "cust_002",
  createdAt: "2026-07-10T10:00:00.000Z",
  identifiers: [
    {
      id: "ident_002_phone",
      channel: "PHONE",
      normalizedValue: "+201122334455",
      rawValue: "01122334455",
      status: "ACTIVE",
      effectiveFrom: "2026-07-10T10:00:00.000Z",
    },
  ],
};

export const SYNTHETIC_CUSTOMER_DUPLICATE_B: CustomerRecord = {
  customerId: "cust_003",
  createdAt: "2026-07-22T14:30:00.000Z",
  identifiers: [
    {
      id: "ident_003_phone",
      channel: "PHONE",
      normalizedValue: "+201122334455",
      rawValue: "+20 112 233 4455",
      status: "ACTIVE",
      effectiveFrom: "2026-07-22T14:30:00.000Z",
    },
  ],
};

export const SYNTHETIC_DUPLICATE_CANDIDATE: DuplicateCandidate = {
  id: "dup_cust_002_cust_003_PHONE",
  customerIdA: "cust_002",
  customerIdB: "cust_003",
  basis: "EXACT_NORMALIZED_PHONE",
  matchedIdentifier: "+201122334455",
  status: "PENDING_REVIEW",
  detectedAt: "2026-07-22T14:30:00.000Z",
};

// customer-004: an unanswered outbound seller call followed later by a
// genuine inbound buyer message. Only the buyer message refreshes
// engagement; the unanswered call does not.
export const SYNTHETIC_CUSTOMER_ENGAGEMENT: CustomerRecord = {
  customerId: "cust_004",
  createdAt: "2026-08-01T08:00:00.000Z",
  identifiers: [
    {
      id: "ident_004_phone",
      channel: "PHONE",
      normalizedValue: "+201155667788",
      rawValue: "+20 115 566 7788",
      status: "ACTIVE",
      effectiveFrom: "2026-08-01T08:00:00.000Z",
    },
  ],
};

export const SYNTHETIC_INTERACTIONS: Interaction[] = [
  {
    id: "int_004_01",
    customerId: "cust_004",
    contactIdentifierId: "ident_004_phone",
    channel: "CALL",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "NO_ANSWER",
    source: "CALL_LOG_IMPORT",
    occurredAt: "2026-08-03T11:00:00.000Z",
    sourceRef: "call-log:cust_004:1",
  },
  {
    id: "int_004_02",
    customerId: "cust_004",
    contactIdentifierId: "ident_004_phone",
    channel: "CRM_NOTE",
    direction: "OUTBOUND",
    actorRole: "SELLER",
    outcome: "UNKNOWN",
    source: "CRM_IMPORT",
    occurredAt: "2026-08-03T11:05:00.000Z",
    sourceRef: "crm-note:cust_004:1",
  },
  {
    id: "int_004_03",
    customerId: "cust_004",
    contactIdentifierId: "ident_004_phone",
    channel: "WHATSAPP",
    direction: "INBOUND",
    actorRole: "BUYER",
    outcome: "MESSAGE_DELIVERED",
    source: "WHATSAPP_EXPORT",
    occurredAt: "2026-08-06T15:20:00.000Z",
    sourceRef: "whatsapp:cust_004:1",
  },
];

// customer-005: consent recorded per channel. WhatsApp is unknown
// (never recorded, not denied); email is explicitly withdrawn.
export const SYNTHETIC_CONSENT: ChannelConsent[] = [
  {
    customerId: "cust_005",
    channel: "CALL",
    status: "GRANTED",
    recordedAt: "2026-08-10T09:00:00.000Z",
    sourceRef: "crm-import:consent:cust_005:call",
  },
  {
    customerId: "cust_005",
    channel: "EMAIL",
    status: "WITHDRAWN",
    recordedAt: "2026-08-20T09:00:00.000Z",
    sourceRef: "crm-import:consent:cust_005:email",
  },
  // No WhatsApp entry at all — evaluateContactAllowance must read as UNKNOWN, never RESTRICTED.
];

// customer-006: no qualification evidence yet at all. Status must
// read UNKNOWN, never DISQUALIFIED.
export const SYNTHETIC_OPPORTUNITY_UNKNOWN: RevenueOpportunity = {
  opportunityId: "opp_006",
  customerId: "cust_006",
  createdAt: "2026-08-25T10:00:00.000Z",
  qualification: {
    status: "UNKNOWN",
    evidence: [],
  },
};

// customer-007: partial evidence — budget confirmed, nothing else yet.
export const SYNTHETIC_QUALIFICATION_EVIDENCE_PARTIAL: QualificationEvidenceItem[] = [
  {
    id: "qev_007_budget",
    type: "BUDGET_CONFIRMED",
    interactionId: "int_007_01",
    summary: "Buyer confirmed a 3.5M EGP budget ceiling.",
    recordedAt: "2026-08-27T13:00:00.000Z",
  },
];

export const SYNTHETIC_OPPORTUNITY_PARTIAL: RevenueOpportunity = {
  opportunityId: "opp_007",
  customerId: "cust_007",
  createdAt: "2026-08-27T13:00:00.000Z",
  qualification: {
    status: "PARTIALLY_QUALIFIED",
    evidence: SYNTHETIC_QUALIFICATION_EVIDENCE_PARTIAL,
  },
};
