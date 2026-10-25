import type { DonnaErrorCode, DonnaEventInput, PlannedCall, StoredEvent } from "./types";

/**
 * Durable-store contract (DON-02). Implemented by the Supabase adapter
 * (`remote/supabaseStore.ts`) and by an in-memory CONTRACT DOUBLE
 * (`memoryStore.ts`) used only in tests. The double is a mock: passing its
 * tests is not evidence of persistence.
 */
export type StoreErrorCode =
  | DonnaErrorCode
  | "NOT_SIGNED_IN"
  | "NOT_ALLOWED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "EVENT_ID_REUSED"
  | "CALL_CONFLICT"
  | "INVALID_PAYLOAD"
  | "SYNC_UNAVAILABLE"
  /** The database acknowledged the write, but reloading the records failed. The change IS stored. */
  | "WRITE_CONFIRMED_REFRESH_FAILED"
  | "UNKNOWN";

/** Codes the database can return that are also engine codes (message `DONNA_<code>`). */
export const ENGINE_ERROR_CODES: readonly DonnaErrorCode[] = [
  "UNKNOWN_CALL",
  "NOT_YET_DUE",
  "ALREADY_RESOLVED",
  "FUTURE_EVENT",
  "INVALID_INSTANT",
  "SNOOZE_NOT_IN_FUTURE",
  "APPOINTMENT_NOT_CONFIRMED",
  "APPOINTMENT_REQUIRES_SPOKE",
  "NEXT_ACTION_NOT_ALLOWED_FOR_OUTCOME",
  "FOLLOW_UP_DATE_INVALID",
  "FOLLOW_UP_DATE_IN_PAST",
  "APPOINTMENT_NOT_IN_FUTURE",
];

export class DonnaStoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(code: StoreErrorCode) {
    super(code);
    this.name = "DonnaStoreError";
    this.code = code;
  }
}

/** CREATED: stored by this call. DUPLICATE: an identical earlier write was already stored. */
export type WriteStatus = "CREATED" | "DUPLICATE";

export interface DonnaStoreSnapshot {
  readonly calls: readonly PlannedCall[];
  readonly events: readonly StoredEvent[];
}

export interface DonnaStore {
  load(): Promise<DonnaStoreSnapshot>;
  /**
   * `eventId` is the idempotency key: a retry MUST reuse it. A different id
   * for an already-resolved call is a conflict (`ALREADY_RESOLVED`), never a retry.
   * Resolves only after the database acknowledged the write.
   */
  appendEvent(eventId: string, event: DonnaEventInput): Promise<WriteStatus>;
  upsertCall(call: PlannedCall): Promise<WriteStatus>;
}

export interface DonnaAuth {
  /** Email of the signed-in user, or null. */
  currentEmail(): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<StoreErrorCode | null>;
  signOut(): Promise<void>;
  /** Returns an unsubscribe function. */
  onChange(listener: (email: string | null) => void): () => void;
}

export interface DonnaRemote {
  readonly store: DonnaStore;
  readonly auth: DonnaAuth;
}
