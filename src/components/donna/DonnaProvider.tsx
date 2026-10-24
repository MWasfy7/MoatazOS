"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  addMinutes,
  applyEvent,
  buildInbox,
  createDemoState,
  DEMO_NOW,
  type DonnaErrorCode,
  type DonnaEventInput,
  type DonnaInbox,
  type DonnaState,
  type NextActionInput,
  type OutcomeKind,
} from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface DonnaContextValue {
  state: DonnaState;
  now: string;
  inbox: DonnaInbox;
  /** True when every unresolved question has been dismissed from the banner. */
  bannerHidden: boolean;
  advanceClock: (minutes: number) => void;
  resetDemo: () => void;
  recordOutcome: (callId: string, outcome: OutcomeKind, originalInput: string, nextAction: NextActionInput | null) => DonnaErrorCode | null;
  snooze: (callId: string, until: string) => DonnaErrorCode | null;
  markTaskDone: (callId: string) => DonnaErrorCode | null;
  /** Hides the banner and logs a dismissal. Never resolves a question. */
  dismissBanner: () => void;
  clientLabel: (clientId: string) => string;
}

const DonnaContext = createContext<DonnaContextValue | null>(null);

/**
 * Memory-only Donna store for the demo. State is lost on reload by design:
 * persistence is subsequent work.
 */
export function DonnaProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [state, setState] = useState<DonnaState>(() => createDemoState());
  const [now, setNow] = useState<string>(DEMO_NOW);
  const [dismissedIds, setDismissedIds] = useState<readonly string[]>([]);

  const inbox = useMemo(() => buildInbox(state, now), [state, now]);
  const bannerHidden = inbox.unresolved.every((q) => dismissedIds.includes(q.id));

  const submit = useCallback(
    (event: DonnaEventInput): DonnaErrorCode | null => {
      const result = applyEvent(state, event, now);
      if (!result.ok) return result.error;
      setState(result.state);
      return null;
    },
    [state, now],
  );

  const value = useMemo<DonnaContextValue>(
    () => ({
      state,
      now,
      inbox,
      bannerHidden,
      advanceClock: (minutes) => setNow((current) => addMinutes(current, minutes)),
      resetDemo: () => {
        setState(createDemoState());
        setNow(DEMO_NOW);
        setDismissedIds([]);
      },
      recordOutcome: (callId, outcome, originalInput, nextAction) =>
        submit({ type: "OUTCOME_RECORDED", callId, at: now, outcome, originalInput, nextAction }),
      snooze: (callId, until) => submit({ type: "SNOOZED", callId, at: now, until }),
      markTaskDone: (callId) => submit({ type: "TASK_MARKED_DONE", callId, at: now }),
      dismissBanner: () => {
        let next = state;
        for (const question of inbox.unresolved) {
          const result = applyEvent(next, { type: "QUESTION_DISMISSED", callId: question.callId, at: now }, now);
          if (result.ok) next = result.state;
        }
        setState(next);
        setDismissedIds(inbox.unresolved.map((q) => q.id));
      },
      clientLabel: (clientId) => {
        const client = state.clients.find((c) => c.id === clientId);
        return client ? client.label[locale] : clientId;
      },
    }),
    [state, now, inbox, bannerHidden, submit, locale],
  );

  return <DonnaContext.Provider value={value}>{children}</DonnaContext.Provider>;
}

export function useDonna(): DonnaContextValue {
  const ctx = useContext(DonnaContext);
  if (!ctx) throw new Error("useDonna must be used within a DonnaProvider");
  return ctx;
}
