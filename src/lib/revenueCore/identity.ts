import type {
  ContactChannel,
  CustomerIdentifier,
  CustomerRecord,
  DuplicateCandidate,
  DuplicateCandidateStatus,
} from "./types";

/**
 * Normalizes a raw contact value for matching. Phone/WhatsApp values
 * keep a leading "+" if present and strip everything else non-digit;
 * email values are trimmed and lowercased. This is matching-only —
 * `rawValue` is always preserved separately for display/audit.
 */
export function normalizeContactValue(channel: ContactChannel, rawValue: string): string {
  const trimmed = rawValue.trim();
  if (channel === "EMAIL") {
    return trimmed.toLowerCase();
  }
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

export interface ChangePhoneNumberInput {
  customer: CustomerRecord;
  newRawPhone: string;
  /** ISO 8601. When the new number became active. */
  effectiveFrom: string;
  /** Caller-supplied id for the new identifier — kept pure, no id generation here. */
  newIdentifierId: string;
  reason?: string;
}

/**
 * Records a phone number change without losing history and without
 * changing the customer's stable internal id. The previously active
 * PHONE identifier (if any) is marked SUPERSEDED and retained; a new
 * ACTIVE identifier is appended pointing back at it via `supersedes`.
 *
 * Pure: returns a new CustomerRecord, does not mutate the input.
 */
export function changePhoneNumber(input: ChangePhoneNumberInput): CustomerRecord {
  const { customer, newRawPhone, effectiveFrom, newIdentifierId, reason } = input;
  const normalizedValue = normalizeContactValue("PHONE", newRawPhone);
  const previousActivePhone = customer.identifiers.find(
    (identifier) => identifier.channel === "PHONE" && identifier.status === "ACTIVE",
  );

  const identifiersWithPreviousSuperseded: CustomerIdentifier[] = customer.identifiers.map((identifier) =>
    previousActivePhone && identifier.id === previousActivePhone.id
      ? { ...identifier, status: "SUPERSEDED" as const, effectiveTo: effectiveFrom }
      : identifier,
  );

  const newIdentifier: CustomerIdentifier = {
    id: newIdentifierId,
    channel: "PHONE",
    normalizedValue,
    rawValue: newRawPhone,
    status: "ACTIVE",
    effectiveFrom,
    supersedes: previousActivePhone?.id,
    changeReason: reason,
  };

  return {
    ...customer,
    identifiers: [...identifiersWithPreviousSuperseded, newIdentifier],
  };
}

const BASIS_BY_CHANNEL: Record<ContactChannel, DuplicateCandidate["basis"]> = {
  PHONE: "EXACT_NORMALIZED_PHONE",
  EMAIL: "EXACT_NORMALIZED_EMAIL",
  WHATSAPP: "EXACT_NORMALIZED_WHATSAPP",
};

/**
 * Detects customer records that share an ACTIVE identifier's
 * normalized value on the same channel. Returns PENDING_REVIEW
 * candidates only — this function never merges, mutates, or removes
 * a customer record. Merge decisions must go through
 * `resolveDuplicateCandidate` with an explicit decision.
 */
export function findDuplicateCandidates(customers: CustomerRecord[], detectedAt: string): DuplicateCandidate[] {
  const byChannelAndValue = new Map<string, { customerId: string; normalizedValue: string; channel: ContactChannel }[]>();

  for (const customer of customers) {
    for (const identifier of customer.identifiers) {
      if (identifier.status !== "ACTIVE") continue;
      const key = `${identifier.channel}:${identifier.normalizedValue}`;
      const bucket = byChannelAndValue.get(key) ?? [];
      bucket.push({ customerId: customer.customerId, normalizedValue: identifier.normalizedValue, channel: identifier.channel });
      byChannelAndValue.set(key, bucket);
    }
  }

  const candidates: DuplicateCandidate[] = [];
  for (const bucket of byChannelAndValue.values()) {
    const distinctCustomerIds = [...new Set(bucket.map((entry) => entry.customerId))];
    const first = bucket[0];
    if (distinctCustomerIds.length < 2 || !first) continue;

    const { channel, normalizedValue } = first;
    for (let i = 0; i < distinctCustomerIds.length; i += 1) {
      for (let j = i + 1; j < distinctCustomerIds.length; j += 1) {
        const customerIdA = distinctCustomerIds[i];
        const customerIdB = distinctCustomerIds[j];
        if (!customerIdA || !customerIdB) continue;
        candidates.push({
          id: `dup_${customerIdA}_${customerIdB}_${channel}`,
          customerIdA,
          customerIdB,
          basis: BASIS_BY_CHANNEL[channel],
          matchedIdentifier: normalizedValue,
          status: "PENDING_REVIEW",
          detectedAt,
        });
      }
    }
  }

  return candidates;
}

/**
 * Records an explicit decision on a duplicate candidate. This never
 * performs the merge itself — it only moves the candidate out of
 * PENDING_REVIEW into an explicit, attributable end state. Any actual
 * record consolidation is a separate, out-of-scope write operation.
 */
export function resolveDuplicateCandidate(
  candidate: DuplicateCandidate,
  decision: Extract<DuplicateCandidateStatus, "CONFIRMED_MERGE" | "REJECTED_NOT_DUPLICATE">,
  decidedAt: string,
): DuplicateCandidate {
  return { ...candidate, status: decision, decidedAt };
}
