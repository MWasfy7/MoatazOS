"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface FeedbackValue {
  /** Shows a short confirmation. Call it only after the action really succeeded. */
  notify: (message: string) => void;
}

const FeedbackContext = createContext<FeedbackValue>({ notify: () => {} });

const VISIBLE_MS = 7000;

/** Holds the latest confirmation so it survives the card that caused it unmounting. */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { dict } = useLocale();
  const [entry, setEntry] = useState<{ id: number; message: string } | null>(null);

  const notify = useCallback((message: string) => setEntry((current) => ({ id: (current?.id ?? 0) + 1, message })), []);
  const value = useMemo(() => ({ notify }), [notify]);

  useEffect(() => {
    if (!entry) return;
    const timer = setTimeout(() => setEntry(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [entry]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4" aria-live="polite" role="status">
        {entry ? (
          <div
            key={entry.id}
            className="donna-pop pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-50 shadow-lg shadow-black/50"
            data-testid="donna-toast"
            dir="auto"
          >
            <span aria-hidden="true">✓</span>
            <span className="flex-1">{entry.message}</span>
            <button
              type="button"
              className="min-h-8 rounded-md px-2 text-emerald-200 underline active:scale-95"
              onClick={() => setEntry(null)}
            >
              {dict.donna.flow.closeMessage}
            </button>
          </div>
        ) : null}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  return useContext(FeedbackContext);
}
