"use client";

import { useMemo, useState, type ReactNode } from "react";
import { buildToday, formatLocal, type Commitment, type CommitmentStatus } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ClientHistory } from "./ClientHistory";
import { useDonna } from "./DonnaProvider";
import { DraftCard } from "./DraftCard";
import { QuestionFlow } from "./QuestionFlow";
import { PRIMARY } from "./ui";

const STATUS_STYLE: Record<CommitmentStatus, string> = {
  OVERDUE: "border-rose-800 bg-rose-950/30",
  TODAY: "border-amber-700 bg-amber-950/30",
  UPCOMING: "border-neutral-800",
};
const CHIP_STYLE: Record<CommitmentStatus, string> = {
  OVERDUE: "bg-rose-900 text-rose-100",
  TODAY: "bg-amber-800 text-amber-50",
  UPCOMING: "bg-neutral-800 text-neutral-200",
};

/** A tappable row that opens in place, so nothing makes you leave the screen. */
function Row({
  id,
  testId,
  open,
  onToggle,
  summary,
  className,
  testAttrs,
  children,
}: {
  id: string;
  testId: string;
  open: boolean;
  onToggle: () => void;
  summary: ReactNode;
  className: string;
  testAttrs?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <li className={`overflow-hidden rounded-xl border transition-colors duration-200 ${className}`} data-testid={testId} {...testAttrs}>
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-start text-sm transition active:bg-neutral-800/60"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <span aria-hidden="true" className={`shrink-0 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open ? (
        <div id={id} className="donna-pop space-y-3 border-t border-neutral-800/80 px-4 py-3">
          {children}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The one screen to open each day: the thing to do now, what is waiting for your answer,
 * what is coming up, and what you promised yourself. Built only from the planned calls and
 * the outcomes you recorded; every action here is saved through the same path as the rest of Donna.
 */
export function TodayPanel() {
  const { dict } = useLocale();
  const { state, now, inbox, clientLabel } = useDonna();
  const copy = dict.donna.today;
  const flow = dict.donna.flow;
  const offset = state.policy.utcOffsetMinutes;
  const view = useMemo(() => buildToday(state, now), [state, now]);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);

  const toggle = (id: string) => setOpenRow((current) => (current === id ? null : id));
  const recordFor = (callId: string) => inbox.resolved.find((entry) => entry.call.id === callId)?.record ?? null;

  const firstQuestion = view.needsOutcome[0] ?? null;
  const firstCommitment: Commitment | null = view.commitments[0] ?? null;
  const firstCall = view.callsToday[0] ?? null;

  const focusQuestion = (callId: string) => {
    const card = document.getElementById(`donna-q-${callId}`);
    card?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    card?.focus({ preventScroll: true });
  };
  const openDraft = (callId: string) => {
    setDraftFor(callId);
    setOpenRow(`commit-${callId}`);
  };

  const dueText = (c: Commitment) => (c.kind === "INTERNAL_FOLLOW_UP" ? c.due : formatLocal(c.due, offset));

  return (
    <section aria-labelledby="donna-today" className="space-y-5" data-testid="donna-today">
      <div dir="auto">
        <h2 id="donna-today" className="text-2xl font-semibold text-neutral-50">{copy.title}</h2>
        <p className="text-sm text-neutral-400">{copy.intro}</p>
      </div>

      <div
        className="donna-pop space-y-2 rounded-2xl border border-amber-700/70 bg-gradient-to-br from-amber-950/50 to-neutral-900 p-4"
        data-testid="donna-today-priority"
        data-kind={firstQuestion ? "NEEDS_OUTCOME" : firstCommitment ? "COMMITMENT" : firstCall ? "NEXT_CALL" : "CLEAR"}
        dir="auto"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{flow.priorityTitle}</p>
        {firstQuestion ? (
          <>
            <p className="text-lg font-semibold text-neutral-50">{flow.priorityNeeds.replace("{client}", clientLabel(firstQuestion.clientId))}</p>
            <p className="text-sm text-neutral-300">{flow.priorityNeedsHint}</p>
            <button type="button" className={PRIMARY} onClick={() => focusQuestion(firstQuestion.callId)}>
              {flow.recordOutcome}
            </button>
          </>
        ) : firstCommitment ? (
          <>
            <p className="text-lg font-semibold text-neutral-50">
              {copy.status[firstCommitment.status]} · {clientLabel(firstCommitment.clientId)}
            </p>
            <p className="text-sm text-neutral-300">
              {copy.kinds[firstCommitment.kind]}: <bdi dir="ltr">{dueText(firstCommitment)}</bdi>
            </p>
            {firstCommitment.nextStep !== null && firstCommitment.nextStep.trim() !== "" ? (
              <p className="whitespace-pre-wrap text-sm text-neutral-200">
                <span className="font-medium">{copy.nextStep}:</span> {firstCommitment.nextStep}
              </p>
            ) : null}
            <button type="button" className={PRIMARY} onClick={() => openDraft(firstCommitment.callId)}>
              {flow.prepareDraft}
            </button>
          </>
        ) : firstCall ? (
          <>
            <p className="text-lg font-semibold text-neutral-50">{flow.priorityNext.replace("{client}", clientLabel(firstCall.clientId))}</p>
            <p className="text-sm text-neutral-300">
              <bdi dir="ltr">{formatLocal(firstCall.dueAt, offset)}</bdi> · {flow.priorityNextHint}
            </p>
          </>
        ) : (
          <p className="text-lg font-semibold text-neutral-50">{flow.priorityClear}</p>
        )}
      </div>

      <div className="space-y-3">
        <h3 id="donna-unresolved" className="text-lg font-semibold text-neutral-50" dir="auto">
          {copy.needsOutcome} <span data-testid="donna-unresolved-count">({view.needsOutcome.length})</span>
        </h3>
        {view.needsOutcome.length === 0 ? (
          <p className="text-sm text-neutral-400" dir="auto">{copy.needsOutcomeEmpty}</p>
        ) : (
          view.needsOutcome.map((q) => (
            <div key={q.id} data-testid={`donna-today-needs-${q.callId}`}>
              <QuestionFlow question={q} />
            </div>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-neutral-50" dir="auto">{copy.callsToday}</h3>
        {view.callsToday.length === 0 ? (
          <p className="text-sm text-neutral-400" dir="auto">{copy.callsTodayEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {view.callsToday.map((call) => (
              <Row
                key={call.id}
                id={`donna-call-${call.id}`}
                testId={`donna-today-call-${call.id}`}
                open={openRow === `call-${call.id}`}
                onToggle={() => toggle(`call-${call.id}`)}
                className="border-neutral-800 text-neutral-200"
                summary={
                  <span dir="auto">
                    <span className="block font-medium">{clientLabel(call.clientId)}</span>
                    <bdi dir="ltr" className="text-xs text-neutral-400">{formatLocal(call.dueAt, offset)}</bdi>
                  </span>
                }
              >
                <p className="text-sm text-neutral-300" dir="auto">{flow.notDueYet}</p>
                <ClientHistory clientId={call.clientId} />
              </Row>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-neutral-50" dir="auto">{copy.commitments}</h3>
        {view.commitments.length === 0 ? (
          <p className="text-sm text-neutral-400" dir="auto">{copy.commitmentsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {view.commitments.map((c) => {
              const record = recordFor(c.callId);
              const rowId = `commit-${c.callId}`;
              return (
                <Row
                  key={c.callId}
                  id={`donna-commit-${c.callId}`}
                  testId={`donna-today-commitment-${c.callId}`}
                  testAttrs={{ "data-status": c.status }}
                  open={openRow === rowId}
                  onToggle={() => toggle(rowId)}
                  className={`${STATUS_STYLE[c.status]} text-neutral-100`}
                  summary={
                    <span dir="auto" className="block space-y-1">
                      <span className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP_STYLE[c.status]}`}>{copy.status[c.status]}</span>
                        <span className="font-medium">{clientLabel(c.clientId)}</span>
                      </span>
                      <span className="block text-xs text-neutral-300">
                        {copy.kinds[c.kind]}: <bdi dir="ltr">{dueText(c)}</bdi>
                      </span>
                      {c.nextStep !== null && c.nextStep.trim() !== "" ? (
                        <span className="block whitespace-pre-wrap text-sm">
                          <span className="font-medium">{copy.nextStep}:</span> {c.nextStep}
                        </span>
                      ) : null}
                    </span>
                  }
                >
                  <ClientHistory clientId={c.clientId} />
                  {record ? (
                    <DraftCard
                      key={`${c.callId}-${draftFor === c.callId}`}
                      callId={c.callId}
                      idSuffix="-today"
                      clientName={clientLabel(c.clientId)}
                      record={record}
                      offsetMinutes={offset}
                      defaultOpen={draftFor === c.callId}
                    />
                  ) : null}
                </Row>
              );
            })}
          </ul>
        )}
        {view.handledCount > 0 ? (
          <p className="text-xs text-neutral-500" data-testid="donna-today-handled" dir="auto">{copy.handled.replace("{count}", String(view.handledCount))}</p>
        ) : null}
        <p className="text-xs text-neutral-500" dir="auto">{copy.footnote}</p>
      </div>
    </section>
  );
}
