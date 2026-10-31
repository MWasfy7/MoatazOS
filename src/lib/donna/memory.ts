import { buildInbox } from "./engine";
import type { ConfirmedFact, DonnaState, OutcomeKind } from "./types";

/**
 * Reviewable client memory. A read-only VIEW over the append-only outcome records:
 * nothing is stored separately, nothing is inferred, and the operator's own words
 * are carried exactly as typed (never trimmed, summarised or rewritten).
 */
export interface MemoryEntry {
  readonly callId: string;
  readonly at: string;
  readonly outcome: OutcomeKind;
  readonly confirmedFacts: readonly ConfirmedFact[];
  /** `original_input`, exactly as recorded. */
  readonly note: string;
  /** The operator's next-step text, exactly as recorded. */
  readonly nextStep: string | null;
}

export interface ClientMemory {
  readonly clientId: string;
  /** Newest first. */
  readonly entries: readonly MemoryEntry[];
}

export function buildClientMemory(state: DonnaState, now: string): readonly ClientMemory[] {
  const byClient = new Map<string, MemoryEntry[]>();
  for (const { call, record } of buildInbox(state, now).resolved) {
    const list = byClient.get(call.clientId) ?? [];
    list.push({
      callId: call.id,
      at: record.at,
      outcome: record.outcome,
      confirmedFacts: record.confirmedFacts,
      note: record.originalInput,
      nextStep: record.nextStep,
    });
    byClient.set(call.clientId, list);
  }
  return [...byClient.entries()]
    .map(([clientId, entries]) => ({
      clientId,
      entries: entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.callId.localeCompare(b.callId)),
    }))
    .sort((a, b) => a.clientId.localeCompare(b.clientId));
}
