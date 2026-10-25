import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DonnaStoreError } from "@/lib/donna";
import {
  createSupabaseRemote,
  fromEventRow,
  mapApiError,
  RPC_CALL_KEYS,
  RPC_EVENT_KEYS,
  toRpcCall,
  toRpcEvent,
  type SupabaseLike,
} from "@/lib/donna/remote/supabaseStore";

// MOCK SDK client: these tests check payload shapes, error mapping and the
// "no acknowledgement, no success" rule. They do not talk to any database.
const MIGRATION = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261025000000_donna_durable_records.sql"), "utf8");

function sqlKeyList(functionName: string, which: 0 | 1): string[] {
  const body = MIGRATION.slice(MIGRATION.indexOf(`create function public.${functionName}`));
  const match = /donna_require_keys\(\s*(?:p_event|p_call),\s*array\[([^\]]*)\],\s*array\[([^\]]*)\]/.exec(body);
  if (!match) throw new Error("require_keys call not found");
  return [...(match[which + 1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string);
}

function fakeClient(over: Partial<SupabaseLike> = {}, calls: Array<{ fn: string; args: Record<string, unknown> }> = []): SupabaseLike {
  return {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => undefined,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      return { data: { status: "CREATED" }, error: null };
    },
    from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) }),
    ...over,
  };
}

describe("Donna Supabase adapter (MOCK SDK)", () => {
  it("sends exactly the keys the SQL function accepts (drift guard against the migration)", () => {
    expect([...RPC_EVENT_KEYS].sort()).toEqual(sqlKeyList("donna_record_event", 0).sort());
    expect(sqlKeyList("donna_record_event", 1).sort()).toEqual(["at", "call_id", "event_id", "type"]);
    expect([...RPC_CALL_KEYS].sort()).toEqual(sqlKeyList("donna_upsert_call", 0).sort());
  });

  it("builds payloads for every event type using only allowed keys", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const at = "2026-10-26T10:00:00.000Z";
    const payloads = [
      toRpcEvent(id, { type: "QUESTION_DISMISSED", callId: "c", at }),
      toRpcEvent(id, { type: "TASK_MARKED_DONE", callId: "c", at }),
      toRpcEvent(id, { type: "SNOOZED", callId: "c", at, until: "2026-10-26T11:00:00.000Z" }),
      toRpcEvent(id, { type: "OUTCOME_RECORDED", callId: "c", at, outcome: "NO_ANSWER", originalInput: "", nextAction: null }),
      toRpcEvent(id, { type: "OUTCOME_RECORDED", callId: "c", at, outcome: "SPOKE", originalInput: "n", nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-28" } }),
      toRpcEvent(id, { type: "OUTCOME_RECORDED", callId: "c", at, outcome: "SPOKE", originalInput: "n", nextAction: { kind: "CLIENT_CONFIRMED_APPOINTMENT", at: "2026-10-30T09:00:00.000Z", clientConfirmed: true } }),
    ];
    for (const p of payloads) for (const key of Object.keys(p)) expect(RPC_EVENT_KEYS).toContain(key);
    expect(payloads[4]).toMatchObject({ next_action_kind: "INTERNAL_FOLLOW_UP", follow_up_date: "2026-10-28" });
    expect(payloads[4]).not.toHaveProperty("appointment_at");
    expect(payloads[5]).toMatchObject({ next_action_kind: "CLIENT_CONFIRMED_APPOINTMENT", client_confirmed: true });
    expect(payloads[5]).not.toHaveProperty("follow_up_date");
    expect(payloads[0]).not.toHaveProperty("owner_id");
    expect(toRpcCall({ id: "c", clientId: "cl-a", dueAt: at })).toEqual({ id: "c", client_id: "cl-a", due_at: at });
  });

  it("maps database messages and transport failures to store error codes", () => {
    expect(mapApiError({ message: "DONNA_ALREADY_RESOLVED", code: "P0001" })).toBe("ALREADY_RESOLVED");
    expect(mapApiError({ message: "DONNA_EVENT_ID_REUSED" })).toBe("EVENT_ID_REUSED");
    expect(mapApiError({ message: "DONNA_CALL_CONFLICT" })).toBe("CALL_CONFLICT");
    expect(mapApiError({ message: "DONNA_APPOINTMENT_REQUIRES_SPOKE" })).toBe("APPOINTMENT_REQUIRES_SPOKE");
    expect(mapApiError({ message: "DONNA_SIGNUP_NOT_ALLOWED" })).toBe("NOT_ALLOWED");
    expect(mapApiError({ message: "DONNA_NOT_SIGNED_IN" })).toBe("NOT_SIGNED_IN");
    expect(mapApiError({ message: "DONNA_APPEND_ONLY" })).toBe("UNKNOWN");
    expect(mapApiError({ message: "permission denied for table donna_events", code: "42501" })).toBe("NOT_ALLOWED");
    expect(mapApiError({ message: "JWT expired" })).toBe("NOT_SIGNED_IN");
    expect(mapApiError({ message: "TypeError: Failed to fetch" })).toBe("OFFLINE");
    expect(mapApiError({ message: "something else" })).toBe("UNKNOWN");
  });

  it("every error code the SQL raises is understood by the browser", () => {
    const raised = [...MIGRATION.matchAll(/message = 'DONNA_([A-Z_]+)'/g)].map((m) => m[1] as string);
    expect(raised.length).toBeGreaterThan(10);
    for (const name of new Set(raised)) {
      const mapped = mapApiError({ message: `DONNA_${name}` });
      if (name === "APPEND_ONLY") expect(mapped).toBe("UNKNOWN");
      else expect(mapped, name).not.toBe("UNKNOWN");
    }
  });

  it("converts database rows (PostgREST formats) into stored events with derived facts", () => {
    const outcome = fromEventRow({
      seq: 7, call_id: "c", type: "OUTCOME_RECORDED", at: "2026-10-26T10:00:00+00:00", until: null,
      outcome: "SPOKE", original_input: "n", next_action_kind: "INTERNAL_FOLLOW_UP", follow_up_date: "2026-10-28", appointment_at: null,
    });
    expect(outcome).toMatchObject({
      seq: 7, type: "OUTCOME_RECORDED", at: "2026-10-26T10:00:00.000Z",
      nextAction: { kind: "INTERNAL_FOLLOW_UP", date: "2026-10-28" },
      confirmedFacts: [{ kind: "OUTCOME", outcome: "SPOKE" }, { kind: "INTERNAL_FOLLOW_UP_DATE", date: "2026-10-28" }],
      unknownFields: [],
    });
    expect(() => fromEventRow({ seq: 1, call_id: "c", type: "BOGUS", at: "2026-10-26T10:00:00Z", until: null, outcome: null, original_input: null, next_action_kind: null, follow_up_date: null, appointment_at: null })).toThrow(DonnaStoreError);
  });

  it("reports success only on an explicit CREATED/DUPLICATE acknowledgement", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const ok = createSupabaseRemote(fakeClient({}, calls));
    expect(await ok.store.appendEvent("id", { type: "TASK_MARKED_DONE", callId: "c", at: "2026-10-26T10:00:00.000Z" })).toBe("CREATED");
    expect(calls[0]?.fn).toBe("donna_record_event");
    expect(Object.keys(calls[0]?.args ?? {})).toEqual(["p_event"]);
    await ok.store.upsertCall({ id: "c", clientId: "cl-a", dueAt: "2026-10-26T10:00:00.000Z" });
    expect(Object.keys(calls[1]?.args ?? {})).toEqual(["p_call"]);

    const noAck = createSupabaseRemote(fakeClient({ rpc: async () => ({ data: null, error: null }) }));
    await expect(noAck.store.appendEvent("id", { type: "TASK_MARKED_DONE", callId: "c", at: "2026-10-26T10:00:00.000Z" })).rejects.toMatchObject({ code: "UNKNOWN" });

    const dup = createSupabaseRemote(fakeClient({ rpc: async () => ({ data: { status: "DUPLICATE" }, error: null }) }));
    expect(await dup.store.upsertCall({ id: "c", clientId: "cl-a", dueAt: "2026-10-26T10:00:00.000Z" })).toBe("DUPLICATE");
  });

  it("surfaces database errors and network failures without claiming success", async () => {
    const conflict = createSupabaseRemote(fakeClient({ rpc: async () => ({ data: null, error: { message: "DONNA_ALREADY_RESOLVED", code: "P0001" } }) }));
    await expect(conflict.store.appendEvent("id", { type: "TASK_MARKED_DONE", callId: "c", at: "2026-10-26T10:00:00.000Z" })).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    const down = createSupabaseRemote(fakeClient({ rpc: async () => { throw new TypeError("Failed to fetch"); } }));
    await expect(down.store.appendEvent("id", { type: "TASK_MARKED_DONE", callId: "c", at: "2026-10-26T10:00:00.000Z" })).rejects.toMatchObject({ code: "OFFLINE" });
  });

  it("loads every page of calls and events in sequence order", async () => {
    const eventRow = (seq: number) => ({ seq, call_id: "c", type: "TASK_MARKED_DONE", at: "2026-10-26T10:00:00Z", until: null, outcome: null, original_input: null, next_action_kind: null, follow_up_date: null, appointment_at: null });
    const client = fakeClient({
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            range: async (from: number) => {
              if (table === "donna_calls") return { data: from === 0 ? [{ id: "c", client_id: "cl-a", due_at: "2026-10-26T07:00:00+00:00" }] : [], error: null };
              const total = 1500;
              const rows = Array.from({ length: Math.max(0, Math.min(1000, total - from)) }, (_, i) => eventRow(from + i + 1));
              return { data: rows, error: null };
            },
          }),
        }),
      }),
    });
    const snapshot = await createSupabaseRemote(client).store.load();
    expect(snapshot.calls).toEqual([{ id: "c", clientId: "cl-a", dueAt: "2026-10-26T07:00:00.000Z" }]);
    expect(snapshot.events).toHaveLength(1500);
    expect(snapshot.events[0]?.seq).toBe(1);
    expect(snapshot.events[1499]?.seq).toBe(1500);
  });

  it("maps sign-in failures (wrong credentials vs unreachable) and exposes the session email", async () => {
    const bad = createSupabaseRemote(fakeClient({ auth: { ...fakeClient().auth, signInWithPassword: async () => ({ error: { message: "Invalid login credentials", status: 400 } }) } }));
    expect(await bad.auth.signInWithPassword("a@example.test", "x")).toBe("INVALID_CREDENTIALS");
    const offline = createSupabaseRemote(fakeClient({ auth: { ...fakeClient().auth, signInWithPassword: async () => ({ error: { message: "Failed to fetch", status: 0 } }) } }));
    expect(await offline.auth.signInWithPassword("a@example.test", "x")).toBe("OFFLINE");
    // A server problem or rate limit must never be shown as "wrong password".
    const signInWith = (error: Record<string, unknown>) =>
      createSupabaseRemote(fakeClient({ auth: { ...fakeClient().auth, signInWithPassword: async () => ({ error }) } })).auth.signInWithPassword("a@example.test", "x");
    expect(await signInWith({ name: "AuthRetryableFetchError", status: 500, message: "{}" })).toBe("OFFLINE");
    expect(await signInWith({ status: 503, message: "upstream" })).toBe("OFFLINE");
    expect(await signInWith({ status: 429, code: "over_request_rate_limit", message: "Request rate limit reached" })).toBe("RATE_LIMITED");
    expect(await signInWith({ status: 400, code: "invalid_credentials", message: "Invalid login credentials" })).toBe("INVALID_CREDENTIALS");
    const signedIn = createSupabaseRemote(fakeClient({ auth: { ...fakeClient().auth, getSession: async () => ({ data: { session: { user: { email: "a@example.test" } } } }) } }));
    expect(await signedIn.auth.currentEmail()).toBe("a@example.test");
    expect(await createSupabaseRemote(fakeClient()).auth.currentEmail()).toBeNull();
  });
});
