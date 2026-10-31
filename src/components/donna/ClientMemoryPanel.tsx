"use client";

import { useMemo, useState } from "react";
import { buildClientMemory, formatLocal, type ConfirmedFact } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";

const BUTTON =
  "min-h-11 rounded-md border border-neutral-700 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Reviewable memory: a read-only view of what the operator recorded, per client, with their
 * own words untouched. Corrections are session-only (no database change is approved for them)
 * and the screen says so; they are never merged into the recorded facts.
 */
export function ClientMemoryPanel() {
  const { dict } = useLocale();
  const { state, now, clientLabel } = useDonna();
  const copy = dict.donna;
  const memory = copy.memory;
  const offset = state.policy.utcOffsetMinutes;
  const clients = useMemo(() => buildClientMemory(state, now), [state, now]);
  const [corrections, setCorrections] = useState<Record<string, readonly string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const factText = (fact: ConfirmedFact): string => {
    if (fact.kind === "OUTCOME") return copy.outcomes[fact.outcome];
    if (fact.kind === "INTERNAL_FOLLOW_UP_DATE") return `${copy.nextKinds.INTERNAL_FOLLOW_UP}: ${fact.date}`;
    return `${copy.nextKinds.CLIENT_CONFIRMED_APPOINTMENT}: ${formatLocal(fact.at, offset)}`;
  };

  return (
    <section aria-labelledby="donna-memory" className="space-y-3" data-testid="donna-memory">
      <div dir="auto">
        <h2 id="donna-memory" className="text-lg font-semibold text-neutral-50">{memory.title}</h2>
        <p className="text-sm text-neutral-400">{memory.intro}</p>
      </div>
      {clients.length === 0 ? <p className="text-sm text-neutral-400">{memory.empty}</p> : null}
      {clients.map((client) => {
        const mine = corrections[client.clientId] ?? [];
        const draft = drafts[client.clientId] ?? "";
        return (
          <article key={client.clientId} className="space-y-2 rounded-xl border border-neutral-800 p-4" data-testid={`donna-memory-${client.clientId}`} dir="auto">
            <h3 className="text-base font-semibold text-neutral-50">{clientLabel(client.clientId)}</h3>
            {client.entries.map((entry) => (
              <div key={entry.callId} className="space-y-1 border-s border-neutral-800 ps-3 text-sm text-neutral-300">
                <p className="text-xs font-medium text-amber-200">{memory.facts}</p>
                <ul className="list-disc ps-5 text-xs text-neutral-400">
                  {entry.confirmedFacts.map((fact) => (
                    <li key={fact.kind}>{factText(fact)}</li>
                  ))}
                </ul>
                <p className="whitespace-pre-wrap">
                  <span className="font-medium">{memory.words}:</span> {entry.note.trim() === "" ? memory.noNote : entry.note}
                </p>
                {entry.nextStep !== null && entry.nextStep.trim() !== "" ? (
                  <p className="whitespace-pre-wrap">
                    <span className="font-medium">{memory.nextStep}:</span> {entry.nextStep}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="space-y-2 rounded-md border border-amber-900/50 p-3">
              <h4 className="text-sm font-semibold text-amber-200">{memory.corrections}</h4>
              <p className="text-xs text-neutral-400">{memory.correctionsNote}</p>
              {mine.length === 0 ? (
                <p className="text-xs text-neutral-500">{memory.correctionsEmpty}</p>
              ) : (
                <ul className="list-disc ps-5 text-sm text-neutral-200" data-testid={`donna-corrections-${client.clientId}`}>
                  {mine.map((text, i) => (
                    <li key={i} className="whitespace-pre-wrap">{text}</li>
                  ))}
                </ul>
              )}
              <label className="block text-sm text-neutral-300">
                {memory.correctionLabel}
                <textarea
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [client.clientId]: e.target.value }))}
                  rows={2}
                  dir="auto"
                  className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
                />
              </label>
              <button
                type="button"
                className={BUTTON}
                disabled={draft.trim() === ""}
                onClick={() => {
                  setCorrections((c) => ({ ...c, [client.clientId]: [...(c[client.clientId] ?? []), draft] }));
                  setDrafts((d) => ({ ...d, [client.clientId]: "" }));
                }}
              >
                {memory.correctionAdd}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
