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
  /** Set only after the database acknowledged a write and the records were re-read. */
  lastAckAt: string | null;
}

type ActionResult = StoreErrorCode | null;

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
  newRequestId: () => string;
  recordOutcome: (callId: string, outcome: OutcomeKind, originalInput: string, nextAction: NextActionInput | null, requestId?: string) => ActionResult | Promise<ActionResult>;
  snooze: (callId: string, until: string, requestId?: string) => ActionResult | Promise<ActionResult>;
  markTaskDone: (callId: string, requestId?: string) => ActionResult | Promise<ActionResult>;
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
  const remoteRef = useRef<DonnaRemote | null>(remote);
  remoteRef.current = remote;

  const loadNow = useCallback(async (): Promise<ActionResult> => {
    const r = remoteRef.current;
    if (!r) return "SYNC_UNAVAILABLE";
    try {
      const snapshot = await r.store.load();
      setRemoteState(rebuildState(DEMO_POLICY, DEMO_CLIENTS, snapshot.calls, snapshot.events));
      setLoadError(null);
      setPhase("READY");
      return null;
    } catch (error) {
      const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
      setLoadError(code);
      if (code === "NOT_SIGNED_IN") {
        setRemoteState(null);
        setEmail(null);
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
        setEmail(nextEmail);
        if (nextEmail) {
          void loadNow();
        } else {
          setRemoteState(null);
          setPhase("SIGNED_OUT");
        }
      });
      const current = await r.auth.currentEmail();
      if (cancelled) return;
      setEmail(current);
      if (current) await loadNow();
      else setPhase("SIGNED_OUT");
    })().catch(() => {
      if (!cancelled) {
        setLoadError("SYNC_UNAVAILABLE");
        setPhase("ERROR");
      }
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config, injectedRemote, loadNow]);

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

  const syncWrite = useCallback(
    async (input: DonnaEventInput, requestId: string): Promise<ActionResult> => {
      const r = remoteRef.current;
      if (!r || phase !== "READY") return "NOT_SIGNED_IN";
      // Fast local check with the browser rules; the database re-checks everything.
      const pre = applyEvent(state, input, input.at);
      if (!pre.ok) return pre.error;
      setBusy(true);
      setNotice(null);
      try {
        await r.store.appendEvent(requestId, input);
      } catch (error) {
        const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
        if (code === "ALREADY_RESOLVED" || code === "NOT_YET_DUE") {
          await loadNow();
          setNotice(code);
        }
        if (code === "NOT_SIGNED_IN") setPhase("SIGNED_OUT");
        setBusy(false);
        return code;
      }
      // Acknowledged by the database. Show it only once re-read from the database.
      const reloaded = await loadNow();
      setBusy(false);
      if (reloaded === null) setLastAckAt(clock());
      return null;
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
        lastAckAt,
      },
      bannerHidden,
      advanceClock: (minutes) => setDemoNow((current) => addMinutes(current, minutes)),
      resetDemo: () => {
        setDemoState(createDemoState());
        setDemoNow(DEMO_NOW);
        setDismissedIds([]);
      },
      newRequestId: newId,
      recordOutcome: (callId, outcome, originalInput, nextAction, requestId) => {
        const at = clockNow();
        const event: DonnaEventInput = { type: "OUTCOME_RECORDED", callId, at, outcome, originalInput, nextAction };
        return syncOn ? syncWrite(event, requestId ?? newId()) : demoApply(event);
      },
      snooze: (callId, until, requestId) => {
        const event: DonnaEventInput = { type: "SNOOZED", callId, at: clockNow(), until };
        return syncOn ? syncWrite(event, requestId ?? newId()) : demoApply(event);
      },
      markTaskDone: (callId, requestId) => {
        const event: DonnaEventInput = { type: "TASK_MARKED_DONE", callId, at: clockNow() };
        return syncOn ? syncWrite(event, requestId ?? newId()) : demoApply(event);
      },
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
        setEmail(emailInput.trim().toLowerCase());
        const loaded = await loadNow();
        setBusy(false);
        return loaded;
      },
      signOut: async () => {
        await remoteRef.current?.auth.signOut();
        setRemoteState(null);
        setEmail(null);
        setPhase("SIGNED_OUT");
      },
      refresh: async () => {
        setBusy(true);
        const code = await loadNow();
        setBusy(false);
        return code;
      },
      seedSyntheticCalls: async () => {
        const r = remoteRef.current;
        if (!r) return "SYNC_UNAVAILABLE";
        setBusy(true);
        let failure: ActionResult = null;
        for (const call of buildSyntheticCalls(clock())) {
          try {
            await r.store.upsertCall(call);
          } catch (error) {
            const code = error instanceof DonnaStoreError ? error.code : "UNKNOWN";
            // An existing call with other times (seeded earlier, e.g. from another device) is fine.
            if (code !== "CALL_CONFLICT") failure = failure ?? code;
          }
        }
        const loaded = await loadNow();
        setBusy(false);
        return failure ?? loaded;
      },
      clientLabel: (clientId) => {
        const client = state.clients.find((c) => c.id === clientId);
        return client ? client.label[locale] : clientId;
      },
    }),
    [state, now, clockNow, inbox, config, phase, email, busy, loadError, notice, lastAckAt, bannerHidden, newId, syncOn, syncWrite, demoApply, demoState, demoNow, loadNow, clock, locale],
  );

  return <DonnaContext.Provider value={value}>{children}</DonnaContext.Provider>;
}

export function useDonna(): DonnaContextValue {
  const ctx = useContext(DonnaContext);
  if (!ctx) throw new Error("useDonna must be used within a DonnaProvider");
  return ctx;
}
