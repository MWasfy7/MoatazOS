/**
 * MoatazOS — Revenue Core shared contracts.
 *
 * Pure, dependency-free TypeScript types and (in sibling files) pure
 * functions for the customer/contact identity layer, interaction log,
 * channel consent, and opportunity/qualification model that other
 * MoatazOS surfaces (UI, workflow agents) are meant to build against.
 *
 * Same constraints as the rest of this codebase: no execution
 * authority, no network/database access, no live writes. Everything
 * here is a contract plus deterministic, side-effect-free
 * transformations over data the caller supplies.
 *
 * Four rules this file exists to make structurally hard to violate:
 *  1. A customer's internal id is stable. A changed phone number is
 *     recorded as a new identifier that supersedes the old one; the
 *     old one is retained, not deleted or overwritten.
 *  2. Two customer records that look like the same person are
 *     surfaced as a DuplicateCandidate for explicit review. Nothing
 *     in this module merges records on its own.
 *  3. "Unknown" and "false/no" are different values everywhere they
 *     could be confused: consent, qualification, buyer engagement.
 *     Absence of evidence must never be read as a negative answer.
 *  4. A SELLER-authored interaction (an outbound call, an outbound
 *     message, a CRM note) is never, by itself, buyer engagement —
 *     only an interaction attributable to the buyer or an explicit
 *     buyer delegate counts.
 */

// ---------------------------------------------------------------------------
// Customer identity
// ---------------------------------------------------------------------------

export type CustomerId = string;

export type ContactChannel = "PHONE" | "EMAIL" | "WHATSAPP";

export type IdentifierStatus = "ACTIVE" | "SUPERSEDED";

export interface CustomerIdentifier {
  id: string;
  channel: ContactChannel;
  /** Normalized form used for matching (E.164-ish for phone/WhatsApp, lowercased/trimmed for email). */
  normalizedValue: string;
  /** Original as-captured value, preserved verbatim for display/audit. */
  rawValue: string;
  status: IdentifierStatus;
  /** ISO 8601. When this identifier became the active one for its channel. */
  effectiveFrom: string;
  /** ISO 8601. Set when superseded; absent while ACTIVE. */
  effectiveTo?: string;
  /** The identifier this one replaced, if any — preserves change history. */
  supersedes?: string;
  /** Fixture/operator-authored reason for the change. */
  changeReason?: string;
}

export interface CustomerRecord {
  customerId: CustomerId;
  /** Every identifier ever attached to this customer, active and superseded. Append-only. */
  identifiers: CustomerIdentifier[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Duplicate candidates — detection is explicit, merging is never automatic
// ---------------------------------------------------------------------------

export type DuplicateMatchBasis =
  | "EXACT_NORMALIZED_PHONE"
  | "EXACT_NORMALIZED_EMAIL"
  | "EXACT_NORMALIZED_WHATSAPP";

export type DuplicateCandidateStatus = "PENDING_REVIEW" | "CONFIRMED_MERGE" | "REJECTED_NOT_DUPLICATE";

export interface DuplicateCandidate {
  id: string;
  customerIdA: CustomerId;
  customerIdB: CustomerId;
  basis: DuplicateMatchBasis;
  /** The normalized value both customers share. */
  matchedIdentifier: string;
  status: DuplicateCandidateStatus;
  detectedAt: string;
  /** Set only once a human/workflow decision has been recorded. */
  decidedAt?: string;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

export type InteractionDirection = "INBOUND" | "OUTBOUND" | "UNKNOWN";

/**
 * Who this interaction is attributable to. This is the field buyer
 * engagement is computed from — never `direction` or `outcome` alone.
 */
export type InteractionActorRole = "BUYER" | "BUYER_DELEGATE" | "SELLER" | "SYSTEM" | "UNKNOWN";

export type InteractionChannel = "CALL" | "SMS" | "WHATSAPP" | "EMAIL" | "CRM_NOTE" | "OTHER";

export type InteractionSource = "CRM_IMPORT" | "CALL_LOG_IMPORT" | "WHATSAPP_EXPORT" | "MANUAL_ENTRY" | "OTHER";

export type InteractionOutcome =
  | "CONNECTED"
  | "NO_ANSWER"
  | "VOICEMAIL_LEFT"
  | "DECLINED_BY_RECIPIENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_UNDELIVERED"
  | "UNKNOWN";

export interface Interaction {
  id: string;
  customerId: CustomerId;
  /** Which of the customer's identifiers this interaction went through. */
  contactIdentifierId: string;
  channel: InteractionChannel;
  direction: InteractionDirection;
  actorRole: InteractionActorRole;
  outcome: InteractionOutcome;
  source: InteractionSource;
  occurredAt: string;
  sourceRef: string;
}

export interface BuyerEngagementSummary {
  customerId: CustomerId;
  /** Absent means no known buyer-attributed interaction — not "buyer never engaged." */
  lastBuyerEngagementAt?: string;
  buyerEngagementInteractionIds: string[];
}

// ---------------------------------------------------------------------------
// Channel consent and contact restrictions
// ---------------------------------------------------------------------------

export type ConsentStatus = "GRANTED" | "DENIED" | "WITHDRAWN" | "UNKNOWN";

export interface ChannelConsent {
  customerId: CustomerId;
  channel: InteractionChannel;
  status: ConsentStatus;
  /** ISO 8601. Absent when status is UNKNOWN — nothing was ever recorded. */
  recordedAt?: string;
  sourceRef?: string;
}

export type ContactRestrictionReason = "CONSENT_DENIED" | "CONSENT_WITHDRAWN";

export type ContactAllowanceStatus = "ALLOWED" | "RESTRICTED" | "UNKNOWN";

export interface ContactAllowanceResult {
  channel: InteractionChannel;
  status: ContactAllowanceStatus;
  reason?: ContactRestrictionReason;
}

// ---------------------------------------------------------------------------
// Opportunities, qualification evidence, next steps
// ---------------------------------------------------------------------------

export type QualificationEvidenceType =
  | "BUDGET_CONFIRMED"
  | "TIMELINE_CONFIRMED"
  | "AUTHORITY_CONFIRMED"
  | "NEED_CONFIRMED"
  | "BUYER_STATED_REQUIREMENT"
  | "DISQUALIFYING_SIGNAL"
  | "OTHER";

export interface QualificationEvidenceItem {
  id: string;
  type: QualificationEvidenceType;
  /** The buyer-attributed interaction this evidence was drawn from. */
  interactionId: string;
  summary: string;
  recordedAt: string;
}

export type QualificationStatus = "UNKNOWN" | "PARTIALLY_QUALIFIED" | "QUALIFIED" | "DISQUALIFIED";

export interface OpportunityQualification {
  status: QualificationStatus;
  evidence: QualificationEvidenceItem[];
}

/**
 * A bounded, named class of next step — never an imperative action.
 * Mirrors the product-wide "describe, don't execute" constraint
 * already enforced for Decision Card next steps.
 */
export type RevenueNextStepClass =
  | "GATHER_MISSING_QUALIFICATION_EVIDENCE"
  | "SCHEDULE_QUALIFICATION_FOLLOWUP"
  | "AWAIT_BUYER_RESPONSE"
  | "NO_STEP_IDENTIFIED";

export interface RevenueNextStep {
  stepClass: RevenueNextStepClass;
  basedOnEvidenceIds: string[];
  identifiedAt: string;
}

export interface RevenueOpportunity {
  opportunityId: string;
  customerId: CustomerId;
  qualification: OpportunityQualification;
  nextStep?: RevenueNextStep;
  createdAt: string;
}
