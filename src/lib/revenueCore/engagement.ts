import type { BuyerEngagementSummary, CustomerId, Interaction } from "./types";

/**
 * True only for interactions directly attributable to the buyer or an
 * explicit buyer delegate. A SELLER- or SYSTEM-authored interaction —
 * an outbound call, an outbound message, a CRM note — is never buyer
 * engagement by itself, regardless of its outcome. This is what makes
 * an unanswered (or even answered) outbound seller call fail to
 * refresh engagement: the call is the seller's action, not the
 * buyer's. Genuine buyer participation must show up as its own
 * buyer-attributed interaction (e.g. the buyer's reply).
 */
export function isBuyerEngagementInteraction(interaction: Interaction): boolean {
  return interaction.actorRole === "BUYER" || interaction.actorRole === "BUYER_DELEGATE";
}

/**
 * Computes the latest known buyer engagement for one customer's
 * interaction history. `lastBuyerEngagementAt` is left `undefined`
 * when there is no buyer-attributed interaction — that means "no
 * known buyer engagement yet," not "the buyer will never engage."
 * Seller-authored attempts (including unanswered outbound calls) are
 * excluded and never advance this timestamp.
 */
export function computeBuyerEngagement(customerId: CustomerId, interactions: Interaction[]): BuyerEngagementSummary {
  const buyerInteractions = interactions
    .filter((interaction) => interaction.customerId === customerId)
    .filter(isBuyerEngagementInteraction)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const latest = buyerInteractions[buyerInteractions.length - 1];

  return {
    customerId,
    lastBuyerEngagementAt: latest?.occurredAt,
    buyerEngagementInteractionIds: buyerInteractions.map((interaction) => interaction.id),
  };
}
