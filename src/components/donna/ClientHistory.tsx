"use client";

import { useMemo } from "react";
import { buildClientMemory, formatLocal } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";

const SHOWN = 3;

/**
 * The newest recorded outcomes for one client, read-only, with the operator's own
 * words exactly as typed. A view over the same records as Client memory below.
 */
export function ClientHistory({ clientId }: { clientId: string }) {
  const { dict } = useLocale();
  const { state, now } = useDonna();
  const copy = dict.donna;
  const offset = state.policy.utcOffsetMinutes;
  const entries = useMemo(() => buildClientMemory(state, now).find((c) => c.clientId === clientId)?.entries ?? [], [state, now, clientId]);

  return (
    <div className="space-y-2" data-testid={`donna-history-${clientId}`} dir="auto">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-200">{copy.flow.historyTitle}</h4>
      {entries.length === 0 ? <p className="text-sm text-neutral-400">{copy.flow.historyEmpty}</p> : null}
      <ul className="space-y-2">
        {entries.slice(0, SHOWN).map((entry) => (
          <li key={entry.callId} className="space-y-1 border-s-2 border-neutral-700 ps-3 text-sm text-neutral-300">
            <p className="font-medium text-neutral-100">
              {copy.outcomes[entry.outcome]} · <bdi dir="ltr" className="text-xs text-neutral-400">{formatLocal(entry.at, offset)}</bdi>
            </p>
            <p className="whitespace-pre-wrap">{entry.note.trim() === "" ? copy.memory.noNote : entry.note}</p>
            {entry.nextStep !== null && entry.nextStep.trim() !== "" ? (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">{copy.record.nextStep}:</span> {entry.nextStep}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {entries.length > SHOWN ? (
        <p className="text-xs text-neutral-500">{copy.flow.historyMore.replace("{count}", String(entries.length - SHOWN))}</p>
      ) : null}
    </div>
  );
}
