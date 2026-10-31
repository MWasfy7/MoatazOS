"use client";

import { useMemo } from "react";
import { buildToday, formatLocal, type CommitmentStatus } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";

const STATUS_STYLE: Record<CommitmentStatus, string> = {
  OVERDUE: "border-rose-800 bg-rose-950/30 text-rose-100",
  TODAY: "border-amber-700 bg-amber-950/30 text-amber-100",
  UPCOMING: "border-neutral-800 text-neutral-200",
};

/** The one screen to open each day: what is waiting, what is planned, what you promised yourself. */
export function TodayPanel() {
  const { dict } = useLocale();
  const { state, now, clientLabel } = useDonna();
  const copy = dict.donna.today;
  const offset = state.policy.utcOffsetMinutes;
  const view = useMemo(() => buildToday(state, now), [state, now]);

  return (
    <section aria-labelledby="donna-today" className="space-y-4 rounded-xl border border-amber-900/60 bg-neutral-900/40 p-4" data-testid="donna-today">
      <div dir="auto">
        <h2 id="donna-today" className="text-xl font-semibold text-neutral-50">{copy.title}</h2>
        <p className="text-sm text-neutral-400">{copy.intro}</p>
      </div>

      <div className="space-y-2" dir="auto">
        <h3 className="text-sm font-semibold text-amber-200">
          {copy.needsOutcome} <span data-testid="donna-today-needs-count">({view.needsOutcome.length})</span>
        </h3>
        {view.needsOutcome.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.needsOutcomeEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {view.needsOutcome.map((q) => (
              <li key={q.id} className="rounded-md border border-neutral-800 p-2 text-sm text-neutral-200" data-testid={`donna-today-needs-${q.callId}`}>
                {clientLabel(q.clientId)} · <bdi dir="ltr">{formatLocal(q.dueAt, offset)}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" dir="auto">
        <h3 className="text-sm font-semibold text-amber-200">{copy.callsToday}</h3>
        {view.callsToday.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.callsTodayEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {view.callsToday.map((call) => (
              <li key={call.id} className="rounded-md border border-neutral-800 p-2 text-sm text-neutral-200" data-testid={`donna-today-call-${call.id}`}>
                {clientLabel(call.clientId)} · <bdi dir="ltr">{formatLocal(call.dueAt, offset)}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2" dir="auto">
        <h3 className="text-sm font-semibold text-amber-200">{copy.commitments}</h3>
        {view.commitments.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.commitmentsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {view.commitments.map((c) => (
              <li key={c.callId} className={`rounded-md border p-3 text-sm ${STATUS_STYLE[c.status]}`} data-testid={`donna-today-commitment-${c.callId}`} data-status={c.status}>
                <p className="font-semibold">
                  {copy.status[c.status]} · {clientLabel(c.clientId)}
                </p>
                <p>
                  {copy.kinds[c.kind]}:{" "}
                  <bdi dir="ltr">{c.kind === "INTERNAL_FOLLOW_UP" ? c.due : formatLocal(c.due, offset)}</bdi>
                </p>
                {c.nextStep !== null && c.nextStep.trim() !== "" ? (
                  <p className="whitespace-pre-wrap">
                    <span className="font-medium">{copy.nextStep}:</span> {c.nextStep}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {view.handledCount > 0 ? (
          <p className="text-xs text-neutral-500" data-testid="donna-today-handled">{copy.handled.replace("{count}", String(view.handledCount))}</p>
        ) : null}
        <p className="text-xs text-neutral-500">{copy.footnote}</p>
      </div>
    </section>
  );
}
