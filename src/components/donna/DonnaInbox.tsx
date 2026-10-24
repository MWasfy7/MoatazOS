"use client";

import { useRef, useState } from "react";
import {
  addMinutes,
  formatLocal,
  localToInstant,
  nextLocalMorning,
  type ConfirmedFact,
  type NextActionInput,
  type OutcomeKind,
  type OutcomeQuestion,
  type OutcomeRecord,
  type StoreErrorCode,
} from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/en";
import { DonnaSyncPanel } from "./DonnaSyncPanel";
import { useDonna } from "./DonnaProvider";

type Copy = Dictionary["donna"];
type Mode = "idle" | "snooze" | "cancel" | OutcomeKind;

const BUTTON =
  "min-h-11 rounded-md border border-neutral-700 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

function Time({ iso, offset }: { iso: string; offset: number }) {
  return <bdi dir="ltr">{formatLocal(iso, offset)}</bdi>;
}

export function DonnaInbox() {
  const { dict } = useLocale();
  const { state, now, inbox, advanceClock, resetDemo, clientLabel, sync } = useDonna();
  const copy = dict.donna;
  const offset = state.policy.utcOffsetMinutes;
  const demoMode = sync.mode === "OFF";
  const showLists = demoMode || (sync.mode === "ON" && sync.phase === "READY");

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="donna-inbox">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">{copy.eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">{copy.title}</h1>
        <p className="text-sm leading-6 text-neutral-300" dir="auto">{copy.description}</p>
        <p className="rounded-md border border-rose-900/70 bg-rose-950/20 p-3 text-sm text-rose-100" dir="auto">
          {copy.noExecution}
        </p>
      </header>

      <DonnaSyncPanel />

      <section aria-label={copy.demoTitle} className="rounded-xl border border-neutral-800 p-4" data-testid="donna-demo-status">
        <h2 className="text-sm font-semibold text-neutral-200">{copy.demoTitle}</h2>
        {demoMode ? <p className="mt-1 text-sm text-neutral-400" dir="auto">{copy.demoBody}</p> : null}
        <h3 className="mt-3 text-sm font-semibold text-amber-200">{copy.notImplementedTitle}</h3>
        <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-400" dir="auto">
          <li>{copy.notImplemented.voice}</li>
          <li>{copy.notImplemented.notifications}</li>
          <li>{copy.notImplemented.offline}</li>
          <li>{copy.notImplemented.realData}</li>
        </ul>
        <h3 className="mt-3 text-sm font-semibold text-amber-200">{copy.behindSwitchTitle}</h3>
        <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-neutral-400" dir="auto">
          <li>{copy.behindSwitch.persistence}</li>
          <li>{copy.behindSwitch.sync}</li>
        </ul>
        <p className="mt-1 text-sm text-neutral-400" dir="auto">{copy.behindSwitch.status}</p>
      </section>

      {demoMode ? (
      <section aria-label={copy.clock.title} className="rounded-xl border border-neutral-800 p-4" data-testid="donna-clock">
        <h2 className="text-sm font-semibold text-neutral-200">{copy.clock.title}</h2>
        <p className="mt-1 text-sm text-neutral-300">
          {copy.clock.now}: <span data-testid="donna-now"><Time iso={now} offset={offset} /></span>{" "}
          <span className="text-xs text-neutral-500">{copy.clock.offsetNote}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={BUTTON} onClick={() => advanceClock(60)}>{copy.clock.plusHour}</button>
          <button type="button" className={BUTTON} onClick={() => advanceClock(600)}>{copy.clock.plusTenHours}</button>
          <button type="button" className={BUTTON} onClick={() => advanceClock(1440)}>{copy.clock.plusDay}</button>
          <button type="button" className={BUTTON} onClick={resetDemo}>{copy.clock.reset}</button>
        </div>
      </section>
      ) : null}

      {showLists ? (
        <>
      <section aria-labelledby="donna-unresolved" className="space-y-3">
        <h2 id="donna-unresolved" className="text-lg font-semibold text-neutral-50">
          {copy.unresolvedTitle} <span data-testid="donna-unresolved-count">({inbox.unresolved.length})</span>
        </h2>
        {inbox.unresolved.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.unresolvedEmpty}</p>
        ) : (
          inbox.unresolved.map((question) => <QuestionCard key={question.id} question={question} />)
        )}
      </section>

      <section aria-labelledby="donna-upcoming" className="space-y-3">
        <h2 id="donna-upcoming" className="text-lg font-semibold text-neutral-50">{copy.upcomingTitle}</h2>
        {inbox.upcoming.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.upcomingEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {inbox.upcoming.map((call) => (
              <li key={call.id} className="rounded-lg border border-neutral-800 p-3 text-sm text-neutral-300" data-testid={`donna-upcoming-${call.id}`}>
                {clientLabel(call.clientId)} · {copy.dueLabel} <Time iso={call.dueAt} offset={offset} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="donna-resolved" className="space-y-3">
        <h2 id="donna-resolved" className="text-lg font-semibold text-neutral-50">{copy.resolvedTitle}</h2>
        {inbox.resolved.length === 0 ? (
          <p className="text-sm text-neutral-400">{copy.resolvedEmpty}</p>
        ) : (
          inbox.resolved.map(({ call, record }) => (
            <RecordCard key={call.id} callId={call.id} client={clientLabel(call.clientId)} dueAt={call.dueAt} record={record} copy={copy} offset={offset} />
          ))
        )}
      </section>
        </>
      ) : null}
    </div>
  );
}

function QuestionCard({ question }: { question: OutcomeQuestion }) {
  const { dict } = useLocale();
  const { state, clockNow, clientLabel, markTaskDone, recordOutcome, snooze, newRequestId, sync } = useDonna();
  const copy = dict.donna;
  const offset = state.policy.utcOffsetMinutes;
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [nextKind, setNextKind] = useState<"none" | NonNullable<NextActionInput>["kind"]>("none");
  const [date, setDate] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<StoreErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  // One id per submission attempt: a retry after a failure reuses it, so the
  // database can tell a repeat of the same request from a second, conflicting one.
  const requestId = useRef<string | null>(null);
  const rid = () => (requestId.current ??= newRequestId());
  const locked = pending || sync.busy;

  const apply = (code: StoreErrorCode | null) => {
    setError(code);
    if (code === null) {
      requestId.current = null;
      setMode("idle");
    }
  };
  const finish = (result: StoreErrorCode | null | Promise<StoreErrorCode | null>) => {
    if (result instanceof Promise) {
      setPending(true);
      void result.then((code) => {
        setPending(false);
        apply(code);
      });
    } else {
      apply(result);
    }
  };

  const submitOutcome = (outcome: OutcomeKind) => {
    let nextAction: NextActionInput | null = null;
    if (outcome !== "CANCELLED") {
      if (nextKind === "INTERNAL_FOLLOW_UP") nextAction = { kind: nextKind, date };
      if (nextKind === "CLIENT_CONFIRMED_APPOINTMENT") {
        nextAction = { kind: nextKind, at: localToInstant(dateTime, offset), clientConfirmed: confirmed };
      }
    }
    finish(recordOutcome(question.callId, outcome, outcome === "CANCELLED" ? "" : note, nextAction, rid()));
  };

  const reminderText =
    question.reminder === "SNOOZED" && question.snoozedUntil
      ? copy.reminder.SNOOZED.replace("{time}", formatLocal(question.snoozedUntil, offset))
      : question.reminder === "HELD_QUIET_HOURS"
        ? copy.reminder.HELD_QUIET_HOURS.replace("{start}", String(state.policy.quietStartHour)).replace("{end}", String(state.policy.quietEndHour))
        : copy.reminder.DUE_NOW;

  const open = (next: Mode) => {
    setError(null);
    requestId.current = null;
    setMode(next);
  };

  return (
    <article className="space-y-3 rounded-xl border border-amber-900/60 bg-neutral-900/60 p-4" data-testid={`donna-question-${question.callId}`}>
      <div dir="auto">
        <h3 className="text-base font-semibold text-neutral-50">{clientLabel(question.clientId)}</h3>
        <p className="text-lg text-amber-100">{copy.question}</p>
        <p className="text-xs text-neutral-400">
          {copy.callDue} <Time iso={question.dueAt} offset={offset} />
        </p>
      </div>
      <p className="text-xs text-neutral-300" data-testid={`donna-reminder-${question.callId}`} dir="auto">
        {reminderText} <span className="text-neutral-500">· {copy.reminder.note}</span>
      </p>
      {question.taskMarkedDone ? <p className="text-xs text-amber-300" dir="auto">{copy.taskDoneNote}</p> : null}
      {question.dismissCount > 0 ? (
        <p className="text-xs text-neutral-400" dir="auto">{copy.dismissedNote.replace("{count}", String(question.dismissCount))}</p>
      ) : null}

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={locked} className={BUTTON} onClick={() => open("SPOKE")}>{copy.actions.spoke}</button>
          <button type="button" disabled={locked} className={BUTTON} onClick={() => open("NO_ANSWER")}>{copy.actions.noAnswer}</button>
          <button type="button" disabled={locked} className={BUTTON} onClick={() => open("DID_NOT_CALL")}>{copy.actions.didNotCall}</button>
          <button type="button" disabled={locked} className={BUTTON} onClick={() => open("snooze")}>{copy.actions.snooze}</button>
          <button type="button" disabled={locked} className={BUTTON} onClick={() => open("cancel")}>{copy.actions.cancel}</button>
          {question.taskMarkedDone ? null : (
            <button type="button" className={`${BUTTON} text-neutral-400`} onClick={() => finish(markTaskDone(question.callId, rid()))} disabled={locked}>
              {copy.actions.markTaskDone}
            </button>
          )}
        </div>
      ) : null}

      {mode === "snooze" ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-300" dir="auto">{copy.snooze.title}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} disabled={locked} onClick={() => finish(snooze(question.callId, addMinutes(clockNow(), 60), rid()))}>{copy.snooze.oneHour}</button>
            <button type="button" className={BUTTON} disabled={locked} onClick={() => finish(snooze(question.callId, addMinutes(clockNow(), 240), rid()))}>{copy.snooze.fourHours}</button>
            <button type="button" className={BUTTON} disabled={locked} onClick={() => finish(snooze(question.callId, nextLocalMorning(clockNow(), state.policy, 9), rid()))}>{copy.snooze.tomorrow}</button>
            <button type="button" className={BUTTON} onClick={() => open("idle")}>{copy.actions.back}</button>
          </div>
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={locked} className={BUTTON} onClick={() => submitOutcome("CANCELLED")}>{copy.actions.confirmCancel}</button>
          <button type="button" className={BUTTON} onClick={() => open("idle")}>{copy.actions.back}</button>
        </div>
      ) : null}

      {mode === "SPOKE" || mode === "NO_ANSWER" || mode === "DID_NOT_CALL" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitOutcome(mode);
          }}
        >
          <p className="text-sm font-semibold text-amber-200">{copy.outcomes[mode]}</p>
          <label className="block text-sm text-neutral-300">
            {copy.form.note}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              dir="auto"
              rows={3}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">{copy.form.nextAction}</legend>
            <label className="flex items-start gap-2 text-sm text-neutral-300">
              <input type="radio" name={`next-${question.callId}`} checked={nextKind === "none"} onChange={() => setNextKind("none")} className="mt-1" />
              {copy.form.none}
            </label>
            <label className="flex items-start gap-2 text-sm text-neutral-300">
              <input type="radio" name={`next-${question.callId}`} checked={nextKind === "INTERNAL_FOLLOW_UP"} onChange={() => setNextKind("INTERNAL_FOLLOW_UP")} className="mt-1" />
              {copy.form.internal}
            </label>
            {mode === "SPOKE" ? (
              <label className="flex items-start gap-2 text-sm text-neutral-300">
                <input type="radio" name={`next-${question.callId}`} checked={nextKind === "CLIENT_CONFIRMED_APPOINTMENT"} onChange={() => setNextKind("CLIENT_CONFIRMED_APPOINTMENT")} className="mt-1" />
                {copy.form.appointment}
              </label>
            ) : null}
          </fieldset>
          {nextKind === "INTERNAL_FOLLOW_UP" ? (
            <label className="block text-sm text-neutral-300">
              {copy.form.date}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-neutral-100" />
            </label>
          ) : null}
          {nextKind === "CLIENT_CONFIRMED_APPOINTMENT" ? (
            <div className="space-y-2">
              <label className="block text-sm text-neutral-300">
                {copy.form.dateTime}
                <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="mt-1 block min-h-11 rounded-md border border-neutral-700 bg-neutral-950 px-2 text-neutral-100" />
              </label>
              <label className="flex items-start gap-2 text-sm text-neutral-300">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
                {copy.form.clientConfirmed}
              </label>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={locked} className={`${BUTTON} bg-amber-700 hover:bg-amber-600`}>{copy.actions.saveOutcome}</button>
            <button type="button" className={BUTTON} onClick={() => open("idle")}>{copy.actions.back}</button>
          </div>
        </form>
      ) : null}

      {pending ? (
        <p role="status" className="text-sm text-amber-300" dir="auto" data-testid={`donna-saving-${question.callId}`}>
          {copy.sync.saving}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-rose-300" dir="auto" data-testid={`donna-error-${question.callId}`}>
          {copy.errors[error]}
        </p>
      ) : null}
    </article>
  );
}

function factText(fact: ConfirmedFact, copy: Copy, offset: number): string {
  switch (fact.kind) {
    case "OUTCOME":
      return `${copy.facts.OUTCOME}: ${copy.outcomes[fact.outcome]}`;
    case "INTERNAL_FOLLOW_UP_DATE":
      return `${copy.facts.INTERNAL_FOLLOW_UP_DATE}: ${fact.date}`;
    case "CLIENT_CONFIRMED_APPOINTMENT_AT":
      return `${copy.facts.CLIENT_CONFIRMED_APPOINTMENT_AT}: ${formatLocal(fact.at, offset)}`;
  }
}

function RecordCard({ callId, client, dueAt, record, copy, offset }: { callId: string; client: string; dueAt: string; record: OutcomeRecord; copy: Copy; offset: number }) {
  const next = record.nextAction;
  return (
    <article className="space-y-2 rounded-xl border border-neutral-800 p-4" data-testid={`donna-record-${callId}`}>
      <h3 className="text-base font-semibold text-neutral-50" dir="auto">
        {client} · {copy.outcomes[record.outcome]}
      </h3>
      <p className="text-xs text-neutral-400">
        {copy.dueLabel} <Time iso={dueAt} offset={offset} />
      </p>
      <p className="text-sm text-neutral-200" data-testid={`donna-next-${callId}`} dir="auto">
        {next ? copy.nextKinds[next.kind] : copy.nextKinds.none}
        {next?.kind === "INTERNAL_FOLLOW_UP" ? <>: <bdi dir="ltr">{next.date}</bdi></> : null}
        {next?.kind === "CLIENT_CONFIRMED_APPOINTMENT" ? <>: <Time iso={next.at} offset={offset} /></> : null}
      </p>
      <p className="text-sm text-neutral-300" dir="auto">
        <span className="font-medium">{copy.record.originalInput}:</span> {record.originalInput.trim() === "" ? copy.record.noNote : record.originalInput}
      </p>
      <div className="text-xs text-neutral-400" dir="auto">
        <p className="font-medium">{copy.record.confirmedFacts}</p>
        <ul className="list-disc ps-5">
          {record.confirmedFacts.map((fact) => (
            <li key={fact.kind}>{factText(fact, copy, offset)}</li>
          ))}
        </ul>
        {record.unknownFields.length > 0 ? (
          <p className="mt-1">
            <span className="font-medium">{copy.record.unknown}:</span>{" "}
            {record.unknownFields.map((field) => copy.unknownFields[field]).join(" · ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
