import { applyEvent, rebuildState } from "./engine";
import { DonnaStoreError, type DonnaStore, type DonnaStoreSnapshot, type WriteStatus } from "./store";
import { parseInstant } from "./time";
import type { DonnaEventInput, DonnaState, PlannedCall, ReminderPolicy } from "./types";

/**
 * MOCK: an in-memory double of the durable-store contract. It re-uses the
 * browser engine's rules plus the idempotency/conflict semantics the database
 * enforces, so provider and UI tests can run without hosted credentials.
 * It persists nothing and must never be described as persistence.
 */
export function createMemoryStore(policy: ReminderPolicy, clock: () => string): DonnaStore & { readonly isMock: true } {
  const calls: PlannedCall[] = [];
  const held = new Map<string, DonnaEventInput>();
  let state: DonnaState = rebuildState(policy, [], [], []);

  return {
    isMock: true,
    async load(): Promise<DonnaStoreSnapshot> {
      return { calls: [...state.calls], events: [...state.events] };
    },
    async upsertCall(call): Promise<WriteStatus> {
      const existing = calls.find((c) => c.id === call.id);
      if (!existing) {
        calls.push(call);
        state = rebuildState(policy, [], calls, state.events);
        return "CREATED";
      }
      if (existing.clientId === call.clientId && parseInstant(existing.dueAt) === parseInstant(call.dueAt)) return "DUPLICATE";
      throw new DonnaStoreError("CALL_CONFLICT");
    },
    async appendEvent(eventId, event): Promise<WriteStatus> {
      const prior = held.get(eventId);
      if (prior) {
        if (JSON.stringify(prior) === JSON.stringify(event)) return "DUPLICATE";
        throw new DonnaStoreError("EVENT_ID_REUSED");
      }
      const result = applyEvent(state, event, clock());
      if (!result.ok) throw new DonnaStoreError(result.error);
      state = result.state;
      held.set(eventId, event);
      return "CREATED";
    },
  };
}
