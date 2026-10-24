/**
 * Donna durable-store adapter (DON-02). The ONLY module that imports the
 * Supabase SDK. Domain data is never cached in the browser; the SDK keeps
 * only its own auth session. Writes go through the database functions
 * `donna_upsert_call` / `donna_record_event`, which validate and enforce
 * ownership, append-only history, one outcome per call, and retry idempotency.
 * A write resolves only after the database acknowledges it.
 */
import { createClient } from "@supabase/supabase-js";
import { deriveOutcomeFacts } from "../engine";
import {
  DonnaStoreError,
  ENGINE_ERROR_CODES,
  type DonnaRemote,
  type DonnaStoreSnapshot,
  type StoreErrorCode,
  type WriteStatus,
} from "../store";
import type { DonnaEventInput, NextAction, OutcomeKind, PlannedCall, StoredEvent } from "../types";

interface ApiError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

interface Page {
  data: unknown[] | null;
  error: ApiError | null;
}

/** The slice of the SDK this adapter uses; lets tests inject a mock. */
export interface SupabaseLike {
  auth: {
    getSession(): PromiseLike<{ data: { session: { user: { email?: string | null } } | null } }>;
    signInWithPassword(credentials: { email: string; password: string }): PromiseLike<{ error: ApiError | null }>;
    signOut(): PromiseLike<unknown>;
    onAuthStateChange(
      callback: (event: string, session: { user: { email?: string | null } } | null) => void,
    ): { data: { subscription: { unsubscribe(): void } } };
  };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: ApiError | null }>;
  from(table: string): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): {
        range(from: number, to: number): PromiseLike<Page>;
      };
    };
  };
}

/** Keys accepted by `donna_record_event`; a test keeps this in step with the SQL. */
export const RPC_EVENT_KEYS = [
  "event_id",
  "call_id",
  "type",
  "at",
  "until",
  "outcome",
  "original_input",
  "next_action_kind",
  "follow_up_date",
  "appointment_at",
  "client_confirmed",
] as const;

export const RPC_CALL_KEYS = ["id", "client_id", "due_at"] as const;

export function toRpcEvent(eventId: string, event: DonnaEventInput): Record<string, unknown> {
  const base = { event_id: eventId, call_id: event.callId, type: event.type, at: event.at };
  switch (event.type) {
    case "QUESTION_DISMISSED":
    case "TASK_MARKED_DONE":
      return base;
    case "SNOOZED":
      return { ...base, until: event.until };
    case "OUTCOME_RECORDED": {
      const out: Record<string, unknown> = { ...base, outcome: event.outcome, original_input: event.originalInput };
      if (event.nextAction?.kind === "INTERNAL_FOLLOW_UP") {
        out.next_action_kind = "INTERNAL_FOLLOW_UP";
        out.follow_up_date = event.nextAction.date;
      } else if (event.nextAction?.kind === "CLIENT_CONFIRMED_APPOINTMENT") {
        out.next_action_kind = "CLIENT_CONFIRMED_APPOINTMENT";
        out.appointment_at = event.nextAction.at;
        out.client_confirmed = event.nextAction.clientConfirmed;
      }
      return out;
    }
  }
}

export function toRpcCall(call: PlannedCall): Record<string, unknown> {
  return { id: call.id, client_id: call.clientId, due_at: call.dueAt };
}

export function mapApiError(error: ApiError | null | undefined): StoreErrorCode {
  const message = error?.message ?? "";
  const donna = /DONNA_([A-Z_]+)/.exec(message)?.[1];
  if (donna) {
    if ((ENGINE_ERROR_CODES as readonly string[]).includes(donna)) return donna as StoreErrorCode;
    if (donna === "SIGNUP_NOT_ALLOWED" || donna === "NOT_ALLOWED") return "NOT_ALLOWED";
    if (["NOT_SIGNED_IN", "EVENT_ID_REUSED", "CALL_CONFLICT", "INVALID_PAYLOAD"].includes(donna)) {
      return donna as StoreErrorCode;
    }
    return "UNKNOWN";
  }
  if (error?.code === "42501" || /permission denied|row-level security/i.test(message)) return "NOT_ALLOWED";
  if (/JWT|not authenticated|invalid claim|session/i.test(message) || error?.status === 401) return "NOT_SIGNED_IN";
  if (error?.status === 0 || /fetch|network|offline|timeout/i.test(message)) return "OFFLINE";
  return "UNKNOWN";
}

function iso(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new DonnaStoreError("UNKNOWN");
  return date.toISOString();
}

interface EventRow {
  seq: number;
  call_id: string;
  type: string;
  at: string;
  until: string | null;
  outcome: string | null;
  original_input: string | null;
  next_action_kind: string | null;
  follow_up_date: string | null;
  appointment_at: string | null;
}

const OUTCOMES: readonly OutcomeKind[] = ["SPOKE", "NO_ANSWER", "DID_NOT_CALL", "CANCELLED"];

export function fromEventRow(row: EventRow): StoredEvent {
  const base = { seq: Number(row.seq), callId: row.call_id, at: iso(row.at) };
  switch (row.type) {
    case "QUESTION_DISMISSED":
    case "TASK_MARKED_DONE":
      return { ...base, type: row.type };
    case "SNOOZED":
      return { ...base, type: "SNOOZED", until: iso(row.until) };
    case "OUTCOME_RECORDED": {
      const outcome = OUTCOMES.find((o) => o === row.outcome);
      if (!outcome) throw new DonnaStoreError("UNKNOWN");
      let nextAction: NextAction | null = null;
      if (row.next_action_kind === "INTERNAL_FOLLOW_UP" && row.follow_up_date) {
        nextAction = { kind: "INTERNAL_FOLLOW_UP", date: row.follow_up_date };
      } else if (row.next_action_kind === "CLIENT_CONFIRMED_APPOINTMENT" && row.appointment_at) {
        nextAction = { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: iso(row.appointment_at), clientConfirmed: true };
      }
      const originalInput = row.original_input ?? "";
      const { confirmedFacts, unknownFields } = deriveOutcomeFacts(outcome, originalInput, nextAction);
      return { ...base, type: "OUTCOME_RECORDED", outcome, originalInput, confirmedFacts, unknownFields, nextAction };
    }
    default:
      throw new DonnaStoreError("UNKNOWN");
  }
}

const PAGE_SIZE = 1000;

export function createSupabaseRemote(client: SupabaseLike): DonnaRemote {
  async function fetchAll(table: string, columns: string, orderBy: string): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let page: Page;
      try {
        page = await client.from(table).select(columns).order(orderBy, { ascending: true }).range(from, from + PAGE_SIZE - 1);
      } catch {
        throw new DonnaStoreError("OFFLINE");
      }
      if (page.error) throw new DonnaStoreError(mapApiError(page.error));
      const data = page.data ?? [];
      rows.push(...data);
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  async function write(fn: string, payload: Record<string, unknown>): Promise<WriteStatus> {
    let result: { data: unknown; error: ApiError | null };
    try {
      result = await client.rpc(fn, { [fn === "donna_record_event" ? "p_event" : "p_call"]: payload });
    } catch {
      throw new DonnaStoreError("OFFLINE");
    }
    if (result.error) throw new DonnaStoreError(mapApiError(result.error));
    const status = (result.data as { status?: unknown } | null)?.status;
    if (status === "CREATED" || status === "DUPLICATE") return status;
    // No explicit acknowledgement means the write is NOT confirmed.
    throw new DonnaStoreError("UNKNOWN");
  }

  return {
    store: {
      async load(): Promise<DonnaStoreSnapshot> {
        const [callRows, eventRows] = await Promise.all([
          fetchAll("donna_calls", "id, client_id, due_at", "due_at"),
          fetchAll(
            "donna_events",
            "seq, call_id, type, at, until, outcome, original_input, next_action_kind, follow_up_date, appointment_at",
            "seq",
          ),
        ]);
        const calls = (callRows as Array<{ id: string; client_id: string; due_at: string }>).map((r) => ({
          id: r.id,
          clientId: r.client_id,
          dueAt: iso(r.due_at),
        }));
        return { calls, events: (eventRows as EventRow[]).map(fromEventRow) };
      },
      appendEvent: (eventId, event) => write("donna_record_event", toRpcEvent(eventId, event)),
      upsertCall: (call) => write("donna_upsert_call", toRpcCall(call)),
    },
    auth: {
      async currentEmail() {
        try {
          const { data } = await client.auth.getSession();
          return data.session?.user.email ?? null;
        } catch {
          return null;
        }
      },
      async signInWithPassword(email, password) {
        try {
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (!error) return null;
          if (error.status === 0 || /fetch|network/i.test(error.message ?? "")) return "OFFLINE";
          return "INVALID_CREDENTIALS";
        } catch {
          return "OFFLINE";
        }
      },
      async signOut() {
        await client.auth.signOut();
      },
      onChange(listener) {
        const { data } = client.auth.onAuthStateChange((_event, session) => listener(session?.user.email ?? null));
        return () => data.subscription.unsubscribe();
      },
    },
  };
}

/** Builds the real client. Called only when sync is ON and safely configured. */
export function createSupabaseRemoteFromConfig(config: { url: string; anonKey: string }): DonnaRemote {
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return createSupabaseRemote(client as unknown as SupabaseLike);
}
