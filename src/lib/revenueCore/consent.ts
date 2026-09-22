import type { ChannelConsent, ContactAllowanceResult, InteractionChannel } from "./types";

/**
 * Evaluates whether a channel may be contacted for a customer.
 * Absence of a consent record — or a status of UNKNOWN — always
 * yields `"UNKNOWN"`, never `"ALLOWED"` or `"RESTRICTED"`. This keeps
 * "we never asked" structurally distinct from "the buyer said no."
 */
export function evaluateContactAllowance(
  consent: ChannelConsent | undefined,
  channel: InteractionChannel,
): ContactAllowanceResult {
  if (!consent || consent.status === "UNKNOWN") {
    return { channel, status: "UNKNOWN" };
  }
  if (consent.status === "GRANTED") {
    return { channel, status: "ALLOWED" };
  }
  return {
    channel,
    status: "RESTRICTED",
    reason: consent.status === "WITHDRAWN" ? "CONSENT_WITHDRAWN" : "CONSENT_DENIED",
  };
}

/**
 * Looks up the most relevant consent record for a customer/channel
 * pair from a flat consent list and evaluates it. Convenience wrapper
 * around `evaluateContactAllowance` for callers holding a full list.
 */
export function resolveContactAllowance(
  consentRecords: ChannelConsent[],
  customerId: string,
  channel: InteractionChannel,
): ContactAllowanceResult {
  const consent = consentRecords.find((record) => record.customerId === customerId && record.channel === channel);
  return evaluateContactAllowance(consent, channel);
}
