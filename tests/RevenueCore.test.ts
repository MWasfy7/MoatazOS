import { describe, expect, it } from "vitest";
import {
  changePhoneNumber,
  computeBuyerEngagement,
  deriveNextStep,
  deriveQualificationStatus,
  evaluateContactAllowance,
  findDuplicateCandidates,
  isBuyerEngagementInteraction,
  normalizeContactValue,
  resolveContactAllowance,
  resolveDuplicateCandidate,
  SYNTHETIC_CONSENT,
  SYNTHETIC_CUSTOMER_DUPLICATE_A,
  SYNTHETIC_CUSTOMER_DUPLICATE_B,
  SYNTHETIC_CUSTOMER_PHONE_CHANGED,
  SYNTHETIC_INTERACTIONS,
  SYNTHETIC_OPPORTUNITY_UNKNOWN,
  SYNTHETIC_QUALIFICATION_EVIDENCE_PARTIAL,
  type ChannelConsent,
  type CustomerRecord,
  type Interaction,
  type QualificationEvidenceItem,
} from "@/lib/revenueCore";

describe("RC1 customer identity — stable id, phone change preserves history", () => {
  it("RC1-001 keeps the fixture's old phone identifier retained as SUPERSEDED", () => {
    const oldIdentifier = SYNTHETIC_CUSTOMER_PHONE_CHANGED.identifiers.find((identifier) => identifier.id === "ident_001_phone_old");
    const newIdentifier = SYNTHETIC_CUSTOMER_PHONE_CHANGED.identifiers.find((identifier) => identifier.id === "ident_001_phone_new");
    expect(oldIdentifier?.status).toBe("SUPERSEDED");
    expect(newIdentifier?.status).toBe("ACTIVE");
    expect(newIdentifier?.supersedes).toBe("ident_001_phone_old");
  });

  it("RC1-002 changePhoneNumber preserves customerId and both old and new identifiers", () => {
    const before: CustomerRecord = {
      customerId: "cust_100",
      createdAt: "2026-01-01T00:00:00.000Z",
      identifiers: [
        {
          id: "ident_100_a",
          channel: "PHONE",
          normalizedValue: "+201000000001",
          rawValue: "+20 100 000 0001",
          status: "ACTIVE",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const after = changePhoneNumber({
      customer: before,
      newRawPhone: "+20 100 000 0002",
      effectiveFrom: "2026-03-01T00:00:00.000Z",
      newIdentifierId: "ident_100_b",
      reason: "buyer switched carrier",
    });

    expect(after.customerId).toBe("cust_100");
    expect(after.identifiers).toHaveLength(2);

    const superseded = after.identifiers.find((identifier) => identifier.id === "ident_100_a");
    expect(superseded?.status).toBe("SUPERSEDED");
    expect(superseded?.effectiveTo).toBe("2026-03-01T00:00:00.000Z");
    expect(superseded?.normalizedValue).toBe("+201000000001");

    const active = after.identifiers.find((identifier) => identifier.id === "ident_100_b");
    expect(active?.status).toBe("ACTIVE");
    expect(active?.normalizedValue).toBe("+201000000002");
    expect(active?.supersedes).toBe("ident_100_a");
  });

  it("RC1-003 changePhoneNumber does not mutate the input record", () => {
    const before: CustomerRecord = {
      customerId: "cust_101",
      createdAt: "2026-01-01T00:00:00.000Z",
      identifiers: [
        {
          id: "ident_101_a",
          channel: "PHONE",
          normalizedValue: "+201000000003",
          rawValue: "01000000003",
          status: "ACTIVE",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const snapshotBefore = JSON.parse(JSON.stringify(before));

    changePhoneNumber({
      customer: before,
      newRawPhone: "01000000004",
      effectiveFrom: "2026-02-01T00:00:00.000Z",
      newIdentifierId: "ident_101_b",
    });

    expect(before).toEqual(snapshotBefore);
  });

  it("RC1-004 normalizeContactValue strips formatting but keeps a leading + for phone", () => {
    expect(normalizeContactValue("PHONE", "+20 100 111 2233")).toBe("+201001112233");
    expect(normalizeContactValue("PHONE", "01001112233")).toBe("01001112233");
    expect(normalizeContactValue("EMAIL", "  Buyer@Example.com ")).toBe("buyer@example.com");
  });
});

describe("RC2 duplicate candidates — explicit, never a silent merge", () => {
  it("RC2-001 detects the fixture pair sharing a normalized phone number", () => {
    const candidates = findDuplicateCandidates(
      [SYNTHETIC_CUSTOMER_DUPLICATE_A, SYNTHETIC_CUSTOMER_DUPLICATE_B],
      "2026-07-22T14:30:00.000Z",
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      customerIdA: "cust_002",
      customerIdB: "cust_003",
      basis: "EXACT_NORMALIZED_PHONE",
      status: "PENDING_REVIEW",
    });
  });

  it("RC2-002 does not flag two distinct customers with different identifiers", () => {
    const distinctCustomer: CustomerRecord = {
      customerId: "cust_009",
      createdAt: "2026-08-01T00:00:00.000Z",
      identifiers: [
        {
          id: "ident_009",
          channel: "PHONE",
          normalizedValue: "+201999999999",
          rawValue: "+20 199 999 9999",
          status: "ACTIVE",
          effectiveFrom: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    const candidates = findDuplicateCandidates([SYNTHETIC_CUSTOMER_DUPLICATE_A, distinctCustomer], "2026-08-01T00:00:00.000Z");
    expect(candidates).toHaveLength(0);
  });

  it("RC2-003 ignores a SUPERSEDED identifier when matching for duplicates", () => {
    // cust_002's active number, re-used as a *superseded* identifier on another customer.
    const supersededMatch: CustomerRecord = {
      customerId: "cust_010",
      createdAt: "2026-08-01T00:00:00.000Z",
      identifiers: [
        {
          id: "ident_010",
          channel: "PHONE",
          normalizedValue: "+201122334455",
          rawValue: "+20 112 233 4455",
          status: "SUPERSEDED",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          effectiveTo: "2026-02-01T00:00:00.000Z",
        },
      ],
    };
    const candidates = findDuplicateCandidates([SYNTHETIC_CUSTOMER_DUPLICATE_A, supersededMatch], "2026-08-01T00:00:00.000Z");
    expect(candidates).toHaveLength(0);
  });

  it("RC2-004 resolveDuplicateCandidate records an explicit decision without touching either customer record", () => {
    const candidates = findDuplicateCandidates(
      [SYNTHETIC_CUSTOMER_DUPLICATE_A, SYNTHETIC_CUSTOMER_DUPLICATE_B],
      "2026-07-22T14:30:00.000Z",
    );
    const candidate = candidates[0];
    expect(candidate).toBeDefined();
    const resolved = resolveDuplicateCandidate(candidate as NonNullable<typeof candidate>, "CONFIRMED_MERGE", "2026-07-23T09:00:00.000Z");
    expect(resolved.status).toBe("CONFIRMED_MERGE");
    expect(resolved.decidedAt).toBe("2026-07-23T09:00:00.000Z");
    // Original candidate object is untouched — resolution is pure.
    expect(candidate?.status).toBe("PENDING_REVIEW");
    // No merge function exists in this module: cust_002 and cust_003 remain two records.
    expect(SYNTHETIC_CUSTOMER_DUPLICATE_A.customerId).not.toBe(SYNTHETIC_CUSTOMER_DUPLICATE_B.customerId);
  });
});

describe("RC3 buyer engagement — seller activity and unanswered calls never count", () => {
  it("RC3-001 an unanswered outbound seller call is not buyer engagement", () => {
    const unansweredCall = SYNTHETIC_INTERACTIONS.find((interaction) => interaction.id === "int_004_01");
    expect(unansweredCall).toBeDefined();
    expect(isBuyerEngagementInteraction(unansweredCall as Interaction)).toBe(false);
  });

  it("RC3-002 a seller CRM note is not buyer engagement regardless of direction", () => {
    const sellerNote = SYNTHETIC_INTERACTIONS.find((interaction) => interaction.id === "int_004_02");
    expect(sellerNote).toBeDefined();
    expect(isBuyerEngagementInteraction(sellerNote as Interaction)).toBe(false);
  });

  it("RC3-003 the fixture's genuine inbound buyer message is the only thing that refreshes engagement", () => {
    const summary = computeBuyerEngagement("cust_004", SYNTHETIC_INTERACTIONS);
    expect(summary.lastBuyerEngagementAt).toBe("2026-08-06T15:20:00.000Z");
    expect(summary.buyerEngagementInteractionIds).toEqual(["int_004_03"]);
  });

  it("RC3-004 a customer with only seller-authored interactions has no known buyer engagement (undefined, not a false claim)", () => {
    const onlySellerInteractions: Interaction[] = SYNTHETIC_INTERACTIONS.filter((interaction) => interaction.customerId === "cust_004").filter(
      (interaction) => interaction.actorRole === "SELLER",
    );
    const summary = computeBuyerEngagement("cust_004", onlySellerInteractions);
    expect(summary.lastBuyerEngagementAt).toBeUndefined();
    expect(summary.buyerEngagementInteractionIds).toEqual([]);
  });

  it("RC3-005 an outbound seller call that connected still does not, by itself, count as buyer engagement", () => {
    const answeredSellerCall: Interaction = {
      id: "int_004_connected",
      customerId: "cust_004",
      contactIdentifierId: "ident_004_phone",
      channel: "CALL",
      direction: "OUTBOUND",
      actorRole: "SELLER",
      outcome: "CONNECTED",
      source: "CALL_LOG_IMPORT",
      occurredAt: "2026-08-04T10:00:00.000Z",
      sourceRef: "call-log:cust_004:2",
    };
    expect(isBuyerEngagementInteraction(answeredSellerCall)).toBe(false);
  });

  it("RC3-006 buyer engagement is scoped to the requested customer only", () => {
    const otherCustomerBuyerMessage: Interaction = {
      id: "int_999",
      customerId: "cust_999",
      contactIdentifierId: "ident_999",
      channel: "WHATSAPP",
      direction: "INBOUND",
      actorRole: "BUYER",
      outcome: "MESSAGE_DELIVERED",
      source: "WHATSAPP_EXPORT",
      occurredAt: "2026-09-01T00:00:00.000Z",
      sourceRef: "whatsapp:cust_999:1",
    };
    const summary = computeBuyerEngagement("cust_004", [...SYNTHETIC_INTERACTIONS, otherCustomerBuyerMessage]);
    expect(summary.buyerEngagementInteractionIds).not.toContain("int_999");
  });
});

describe("RC4 channel consent — unknown is never read as allowed or restricted", () => {
  it("RC4-001 a channel with no consent record at all evaluates as UNKNOWN", () => {
    const result = resolveContactAllowance(SYNTHETIC_CONSENT, "cust_005", "WHATSAPP");
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toBeUndefined();
  });

  it("RC4-002 an explicit UNKNOWN status record still evaluates as UNKNOWN, not ALLOWED", () => {
    const explicitUnknown: ChannelConsent = { customerId: "cust_020", channel: "SMS", status: "UNKNOWN" };
    expect(evaluateContactAllowance(explicitUnknown, "SMS").status).toBe("UNKNOWN");
  });

  it("RC4-003 GRANTED evaluates as ALLOWED", () => {
    const result = resolveContactAllowance(SYNTHETIC_CONSENT, "cust_005", "CALL");
    expect(result.status).toBe("ALLOWED");
  });

  it("RC4-004 WITHDRAWN evaluates as RESTRICTED with an explicit reason", () => {
    const result = resolveContactAllowance(SYNTHETIC_CONSENT, "cust_005", "EMAIL");
    expect(result.status).toBe("RESTRICTED");
    expect(result.reason).toBe("CONSENT_WITHDRAWN");
  });

  it("RC4-005 DENIED evaluates as RESTRICTED distinctly from WITHDRAWN", () => {
    const denied: ChannelConsent = { customerId: "cust_021", channel: "SMS", status: "DENIED", recordedAt: "2026-08-01T00:00:00.000Z" };
    const result = evaluateContactAllowance(denied, "SMS");
    expect(result.status).toBe("RESTRICTED");
    expect(result.reason).toBe("CONSENT_DENIED");
  });
});

describe("RC5 qualification — missing evidence stays UNKNOWN, never DISQUALIFIED", () => {
  it("RC5-001 the fixture opportunity with zero evidence reads UNKNOWN", () => {
    expect(SYNTHETIC_OPPORTUNITY_UNKNOWN.qualification.status).toBe("UNKNOWN");
    expect(deriveQualificationStatus(SYNTHETIC_OPPORTUNITY_UNKNOWN.qualification.evidence)).toBe("UNKNOWN");
  });

  it("RC5-002 no evidence is UNKNOWN, not DISQUALIFIED, not QUALIFIED", () => {
    const status = deriveQualificationStatus([]);
    expect(status).toBe("UNKNOWN");
    expect(status).not.toBe("DISQUALIFIED");
  });

  it("RC5-003 partial core evidence reads PARTIALLY_QUALIFIED", () => {
    expect(deriveQualificationStatus(SYNTHETIC_QUALIFICATION_EVIDENCE_PARTIAL)).toBe("PARTIALLY_QUALIFIED");
  });

  it("RC5-004 all four core evidence types present reads QUALIFIED", () => {
    const fullEvidence: QualificationEvidenceItem[] = [
      { id: "e1", type: "BUDGET_CONFIRMED", interactionId: "i1", summary: "budget", recordedAt: "2026-08-01T00:00:00.000Z" },
      { id: "e2", type: "TIMELINE_CONFIRMED", interactionId: "i2", summary: "timeline", recordedAt: "2026-08-01T00:00:00.000Z" },
      { id: "e3", type: "AUTHORITY_CONFIRMED", interactionId: "i3", summary: "authority", recordedAt: "2026-08-01T00:00:00.000Z" },
      { id: "e4", type: "NEED_CONFIRMED", interactionId: "i4", summary: "need", recordedAt: "2026-08-01T00:00:00.000Z" },
    ];
    expect(deriveQualificationStatus(fullEvidence)).toBe("QUALIFIED");
  });

  it("RC5-005 an explicit disqualifying signal reads DISQUALIFIED even with other confirmed evidence", () => {
    const evidence: QualificationEvidenceItem[] = [
      { id: "e1", type: "BUDGET_CONFIRMED", interactionId: "i1", summary: "budget", recordedAt: "2026-08-01T00:00:00.000Z" },
      { id: "e2", type: "DISQUALIFYING_SIGNAL", interactionId: "i2", summary: "buyer withdrew permanently", recordedAt: "2026-08-02T00:00:00.000Z" },
    ];
    expect(deriveQualificationStatus(evidence)).toBe("DISQUALIFIED");
  });

  it("RC5-006 deriveNextStep for UNKNOWN asks to gather evidence, never invents an action", () => {
    const step = deriveNextStep("UNKNOWN", [], "2026-08-25T10:00:00.000Z");
    expect(step.stepClass).toBe("GATHER_MISSING_QUALIFICATION_EVIDENCE");
    expect(step.basedOnEvidenceIds).toEqual([]);
  });

  it("RC5-007 deriveNextStep for QUALIFIED proposes a follow-up, not an execution action", () => {
    const step = deriveNextStep("QUALIFIED", SYNTHETIC_QUALIFICATION_EVIDENCE_PARTIAL, "2026-08-28T00:00:00.000Z");
    expect(step.stepClass).toBe("SCHEDULE_QUALIFICATION_FOLLOWUP");
  });
});
