"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addMinutes,
  applyEvent,
  buildInbox,
  buildSyntheticCalls,
  createDemoState,
  DEMO_CLIENTS,
  DEMO_NOW,
  DEMO_POLICY,
  DonnaStoreError,
  rebuildState,
  type DonnaEventInput,
  type DonnaInbox,
  type DonnaRemote,
  type DonnaState,
  type NextActionInput,
  type OutcomeKind,
  type StoreErrorCode,
} from "@/lib/donna";
import { readSyncConfig, type SyncConfigIssue, type SyncConfigResult } from "@/lib/donna/remote/config";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export type SyncPhase = "LOADING" | "SIGNED_OUT" | "READY" | "ERROR";

/**
 * A submission frozen at the moment it was made: the idempotency key AND the
 * exact payload (including `at` and `until`). A retry after an uncertain
 * network result must send this object unchanged; an edited submission is a
 * new one with a new id.
 */
export interface PreparedEvent {
  readonly requestId: string;
  readonly event: DonnaEventInput;
}

export interface SyncRecovery {
  readonly callId: string;
  readonly requestId: string;
  readonly kind: DonnaEventInput["type"];
}

export interface SyncStatus {
  /** OFF = memory-only demo. ON = every record lives in, and is read from, the database. */
  mode: "OFF" | "MISCONFIGURED" | "ON";
  issue: SyncConfigIssue | null;
  phase: SyncPhase;
  email: string | null;
  /** A database write or load is in flight. */
  busy: boolean;
  loadError: StoreErrorCode | null;
  /** A write was refused because the database already holds a different answer (e.g. another device). */
  notice: StoreErrorCode | null;
  /** The database acknowledged a write but the records could not be reloaded: stored, not yet shown. */
  recovery: SyncRecovery | null;
  /** Set only after the database acknowledged a write and the records were re-read. */
  lastAckAt: string | null;
}

type ActionResult = StoreErrorCode | null;
type LoadResult = ActionResult | "STALE";

interface DonnaContextValue {
  state: DonnaState;
  now: string;
  /** Fresh time for actions: the real clock in sync mode, the demo clock otherwise. */
  clockNow: () => string;
  inbox: DonnaInbox;
  sync: SyncStatus;
  bannerHidden: boolean;
  advanceClock: (minutes: number) => void;
  resetDemo: () => void;
  /** Build a frozen submission (new id, payload fixed now). */
  prepare: {
    outcome: (callId: string, outcome: OutcomeKind, originalInput: string, nextAction: NextActionInput | null) => PreparedEvent;
    snooze: (callId: string, until: string) => PreparedEvent;
    taskDone: (callId: string) => PreparedEvent;
  };
  /** Send a prepared submission. Re-sending the same object is a safe retry. */
  send: (prepared: PreparedEvent) => ActionResult | Promise<ActionResult>;
  /** Hides the banner. In demo mode it logs a dismissal; in sync mode it is local UI state only. Never resolves a question. */
  dismissBanner: () => void;
  signIn: (email: string, password: string) => Promise<ActionResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<ActionResult>;
  seedSyntheticCalls: () => Promise<ActionResult>;
  clientLabel: (clientId: string) => string;
}

const DonnaContext = createContext<DonnaContextValue | null>(null);

interface DonnaProviderProps {
  children: ReactNode;
  /** Test seam: a ready-made remote (a mock in tests). Production builds one from the environment. */
  remote?: DonnaRemote;
  /** Test seam: override the environment-derived sync configuration. */
  syncConfig?: SyncConfigResult;
  clock?: () => string;
  newId?: () => string;
}

const realClock = () => new Date().toISOString();
const realId = () => crypto.randomUUID();
const EMPTY_STATE = rebuildState(DEMO_POLICY, DEMO_CLIENTS, [], []);
const normalizeEmail = (value: string | null) => (value ? value.trim().toLowerCase() : null);

function freezePrepared(requestId: string, event: DonnaEventInput): PreparedEvent {
  const copy: DonnaEventInput =
    event.type === "OUTCOME_RECORDED" ? { ...event, nextAction: event.nextAction ? Object.freeze({ ...event.nextAction }) : null } : { ...event };
  return Object.freeze({ requestId, event: Object.freeze(copy) });
}

/**
 * Donna store. With sync OFF (the default) this is the memory-only demo and a
 * reload resets it. With sync ON, state is read only from the database after
 * sign-in, and nothing is shown as saved until the database acknowledges it.
 */
export function DonnaProvider({ children, remote: injectedRemote, syncConfig, clock = realClock, newId = realId }: DonnaProviderProps) {
  const { locale } = useLocale();
  const [config] = useState<SyncConfigResult>(() => syncConfig ?? readSyncConfig());
  const syncOn = config.mode === "ON";

  const [demoState, setDemoState] = useState<DonnaState>(() => createDemoState());
  const [demoNow, setDemoNow] = useState<string>(DEMO_NOW);
  const [syncNow, setSyncNow] = useState<string>(() => clock());
  const [dismissedIds, setDismissedIds] = useState<readonly string[]>([]);

  const [remote, setRemote] = useState<DonnaRemote | null>(injectedRemote ?? null);
  const [remoteState, setRemoteState] = useState<DonnaState | null>(null);
  const [phase, setPhase] = useState<SyncPhase>("LOADING");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<StoreErrorCode | null>(null);
  const [lastAckAt, setLastAckAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<StoreErrorCode | null>(null);
  const [recovery, setRecovery] = useState<SyncRecovery | null>(null);
  const remoteRef = useRef<DonnaRemote | null>(remote);
  remoteRef.current = remote;
  const clockRef = useRef(clock);
  clockRef.current = clock;

  // Every async result is tied to the identity it started under. Sign-out, an
  // account change, or unmount bumps the epoch, so a late response from the
  // previous identity is discarded instead of repopulating the screen.
  const epochRef = useRef(0);
  const emailRef = useRef<string | null>(null);
  // Counts every auth notification. A session lookup that started before a notification
  // is older news than that notification and must be discarded.
  const authSeqRef = useRef(0);

  const resetIdentity = useCallback((next: string | null) => {
    epochRef.current += 1;
    emailRef.current = next;
    setEmail(next);
    setRemoteState(null);
    setLastAckAt(null);
    setNotice(null);
    setLoadError(null);
    setRecovery(null);
    setBusy(false);
    setPhase(next ? "LOADING" : "SIGNED_OUT");
  }, []);

  const adoptIdentity = useCallback(
    (next: string | null) => {
      if (emailRef.current !== next) resetIdentity(next);
    },
    [resetIdentity],
  );

  const loadNow = useCallback(async (): Promise<LoadResult> => {
    const r = remoteRef.current;
    if (!r) return "SYNC_UNAVAILABLE";
    // Defence in depth: never load while no identity is adopted (signed out).
    if (emailRef.current === null) return "STALE";
    const epoch = epochRef.current;
    try {
      const snapshot = await r.store.load();
      if (epoch !== epochRef.current) return "STALE";
      setRemoteState(rebuildState(DEMO_POLICY, DEMO_CLIENTS, snapshot.calls, snapshot.events));
      // The inbox ignores events dated after its clock, so bring the clock up to date with the
      // records: otherwise a just-saved outcome (dated "now") stays hidden until the next tick.
      setSyncNow(clockRef.current());
      setLoadError(null);
      setRecovery(null);
      setPhase("READY");
      return null;
    } catch (error) {
      if (epoch !== epochRef.current) return "STALE";
      const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
      setLoadError(code);
      if (code === "NOT_SIGNED_IN") {
        setRemoteState(null);
        setEmail(null);
        emailRef.current = null;
        setPhase("SIGNED_OUT");
      } else {
        setPhase((current) => (current === "READY" ? "READY" : "ERROR"));
      }
      return code;
    }
  }, []);

  // Sync ON: build the remote (lazily, so the SDK never loads when sync is off), then restore the session.
  useEffect(() => {
    if (config.mode !== "ON") return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      let r = injectedRemote ?? null;
      if (!r) {
        const mod = await import("@/lib/donna/remote/supabaseStore");
        r = mod.createSupabaseRemoteFromConfig({ url: config.url, anonKey: config.anonKey });
      }
      if (cancelled) return;
      remoteRef.current = r;
      setRemote(r);
      unsubscribe = r.auth.onChange((nextEmail) => {
        if (cancelled) return;
        authSeqRef.current += 1;
        const next = normalizeEmail(nextEmail);
        if (next === emailRef.current) {
          // e.g. a token refresh for the same account. A "signed out" notice while we are
          // still waiting for the first answer settles that wait.
          if (next === null) setPhase((phase) => (phase === "LOADING" ? "SIGNED_OUT" : phase));
          return;
        }
        resetIdentity(next);
        if (next) void loadNow();
      });
      const lookupSeq = authSeqRef.current;
      const current = normalizeEmail(await r.auth.currentEmail());
      if (cancelled) return;
      // An auth notification arrived while we were asking: it is newer than this answer.
      if (authSeqRef.current !== lookupSeq) return;
      if (current) {
        adoptIdentity(current);
        await loadNow();
      } else {
        setPhase("SIGNED_OUT");
      }
    })().catch(() => {
      if (!cancelled) {
        setLoadError("SYNC_UNAVAILABLE");
        setPhase("ERROR");
      }
    });
    return () => {
      cancelled = true;
      epochRef.current += 1; // pending loads and writes from this mount are now stale
      unsubscribe?.();
    };
  }, [config, injectedRemote, loadNow, adoptIdentity, resetIdentity]);

  // Sync ON uses the real clock; refresh it so due questions appear while the app is open.
  useEffect(() => {
    if (!syncOn) return;
    const id = setInterval(() => setSyncNow(clock()), 30_000);
    return () => clearInterval(id);
  }, [syncOn, clock]);

  const now = syncOn ? syncNow : demoNow;
  const state = syncOn ? (remoteState ?? EMPTY_STATE) : demoState;
  const inbox = useMemo(() => buildInbox(state, now), [state, now]);
  const bannerHidden = inbox.unresolved.every((q) => dismissedIds.includes(q.id));
  const clockNow = useCallback(() => (syncOn ? clock() : demoNow), [syncOn, clock, demoNow]);

  const syncSend = useCallback(
    async (prepared: PreparedEvent): Promise<ActionResult> => {
      const r = remoteRef.current;
      if (!r || phase !== "READY") return "NOT_SIGNED_IN";
      const { requestId, event } = prepared;
      // Fast local check with the browser rules; the database re-checks everything.
      const pre = applyEvent(state, event, event.at);
      if (!pre.ok) return pre.error;
      const epoch = epochRef.current;
      const sameIdentity = () => epoch === epochRef.current;
      setBusy(true);
      setNotice(null);
      try {
        await r.store.appendEvent(requestId, event);
      } catch (error) {
        const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
        if (!sameIdentity()) return "NOT_SIGNED_IN";
        if (code === "ALREADY_RESOLVED" || code === "NOT_YET_DUE") {
          await loadNow();
          if (sameIdentity()) setNotice(code);
        }
        if (code === "NOT_SIGNED_IN" && sameIdentity()) setPhase("SIGNED_OUT");
        if (sameIdentity()) setBusy(false);
        return code;
      }
      // Acknowledged by the database. If the identity changed meanwhile, this write
      // belongs to the previous account: do not reload (that would repopulate the screen).
      if (!sameIdentity()) return "NOT_SIGNED_IN";
      // Show it only once re-read from the database.
      const reloaded = await loadNow();
      if (!sameIdentity()) return "NOT_SIGNED_IN";
      setBusy(false);
      if (reloaded === null) {
        setLastAckAt(clock());
        return null;
      }
      // Stored, but the screen could not be refreshed: say exactly that, and keep what is needed to recover.
      setLastAckAt(null);
      setRecovery({ callId: event.callId, requestId, kind: event.type });
      return "WRITE_CONFIRMED_REFRESH_FAILED";
    },
    [phase, state, loadNow, clock],
  );

  const demoApply = useCallback(
    (event: DonnaEventInput): ActionResult => {
      const result = applyEvent(demoState, event, demoNow);
      if (!result.ok) return result.error;
      setDemoState(result.state);
      return null;
    },
    [demoState, demoNow],
  );

  const value = useMemo<DonnaContextValue>(
    () => ({
      state,
      now,
      clockNow,
      inbox,
      sync: {
        mode: config.mode,
        issue: config.mode === "MISCONFIGURED" ? config.issue : null,
        phase,
        email,
        busy,
        loadError,
        notice,
        recovery,
        lastAckAt,
      },
      bannerHidden,
      advanceClock: (minutes) => setDemoNow((current) => addMinutes(current, minutes)),
      resetDemo: () => {
        setDemoState(createDemoState());
        setDemoNow(DEMO_NOW);
        setDismissedIds([]);
      },
      prepare: {
        outcome: (callId, outcome, originalInput, nextAction) =>
          freezePrepared(newId(), { type: "OUTCOME_RECORDED", callId, at: clockNow(), outcome, originalInput, nextAction }),
        snooze: (callId, until) => freezePrepared(newId(), { type: "SNOOZED", callId, at: clockNow(), until }),
        taskDone: (callId) => freezePrepared(newId(), { type: "TASK_MARKED_DONE", callId, at: clockNow() }),
      },
      send: (prepared) => (syncOn ? syncSend(prepared) : demoApply(prepared.event)),
      dismissBanner: () => {
        if (!syncOn) {
          let next = demoState;
          for (const question of inbox.unresolved) {
            const result = applyEvent(next, { type: "QUESTION_DISMISSED", callId: question.callId, at: demoNow }, demoNow);
            if (result.ok) next = result.state;
          }
          setDemoState(next);
        }
        setDismissedIds(inbox.unresolved.map((q) => q.id));
      },
      signIn: async (emailInput, password) => {
        const r = remoteRef.current;
        if (!r) return "SYNC_UNAVAILABLE";
        setBusy(true);
        const code = await r.auth.signInWithPassword(emailInput.trim(), password);
        if (code) {
          setBusy(false);
          return code;
        }
        adoptIdentity(normalizeEmail(emailInput));
        setBusy(true);
        const loaded = await loadNow();
        if (loaded !== "STALE") setBusy(false);
        return loaded === "STALE" ? null : loaded;
      },
      signOut: async () => {
        await remoteRef.current?.auth.signOut();
        resetIdentity(null);
      },
      refresh: async () => {
        setBusy(true);
        const code = await loadNow();
        if (code !== "STALE") setBusy(false);
        return code === "STALE" ? null : code;
      },
      seedSyntheticCalls: async () => {
        const r = remoteRef.current;
        if (!r) return "SYNC_UNAVAILABLE";
        const epoch = epochRef.current;
        setBusy(true);
        let failure: ActionResult = null;
        for (const call of buildSyntheticCalls(clock())) {
          // Re-check before EVERY write: after sign-out, an account change or unmount the
          // remaining writes belong to a previous identity and must never start.
          if (epoch !== epochRef.current) return null;
          try {
            await r.store.upsertCall(call);
          } catch (error) {
            const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
            // An existing call with other times (seeded earlier, e.g. from another device) is fine.
            if (code !== "CALL_CONFLICT") failure = failure ?? code;
          }
        }
        if (epoch !== epochRef.current) return null;
        const loaded = await loadNow();
        if (loaded !== "STALE") setBusy(false);
        return failure ?? (loaded === "STALE" ? null : loaded);
      },
      clientLabel: (clientId) => {
        const client = state.clients.find((c) => c.id === clientId);
        return client ? client.label[locale] : clientId;
      },
    }),
    [state, now, clockNow, inbox, config, phase, email, busy, loadError, notice, recovery, lastAckAt, bannerHidden, newId, syncOn, syncSend, demoApply, demoState, demoNow, loadNow, clock, locale, adoptIdentity, resetIdentity],
  );

  return <DonnaContext.Provider value={value}>{children}</DonnaContext.Provider>;
}

export function useDonna(): DonnaContextValue {
  const ctx = useContext(DonnaContext);
  if (!ctx) throw new Error("useDonna must be used within a DonnaProvider");
  return ctx;
}
