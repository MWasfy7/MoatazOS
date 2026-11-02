"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMinutes,
  formatLocal,
  localToInstant,
  nextLocalMorning,
  type NextActionInput,
  type OutcomeKind,
  type OutcomeQuestion,
  type StoreErrorCode,
} from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ClientHistory } from "./ClientHistory";
import { useDonna, type PreparedEvent } from "./DonnaProvider";
import { useFeedback } from "./Feedback";
import { BUTTON, FIELD, PRIMARY } from "./ui";
import { VoiceButton } from "./VoiceButton";
import { VoiceReviewPanel } from "./VoiceReviewPanel";

type Mode = "idle" | "snooze" | "cancel" | OutcomeKind;
type Step = 0 | 1 | 2;

/** The database allows 2000 characters in each of the two free-text fields. */
const MAX_TEXT = 2000;
const LAST_STEP: Step = 2;

/** Adds dictated text after what is already typed, never altering the typed text itself. */
function appendSpoken(current: string, spoken: string): string {
  return current === "" || /\s$/.test(current) ? current + spoken : `${current} ${spoken}`;
}

function Time({ iso, offset }: { iso: string; offset: number }) {
  return <bdi dir="ltr">{formatLocal(iso, offset)}</bdi>;
}

/**
 * One due call, asked as a short conversation: did it happen, what happened, what is the
 * next step, when will you follow up. Every value is sent exactly as typed or dictated.
 */
export function QuestionFlow({ question }: { question: OutcomeQuestion }) {
  const { dict } = useLocale();
  const { state, clockNow, clientLabel, prepare, send, sync } = useDonna();
  const { notify } = useFeedback();
  const copy = dict.donna;
  const flow = copy.flow;
  const offset = state.policy.utcOffsetMinutes;
  const client = clientLabel(question.clientId);
  const [mode, setMode] = useState<Mode>("idle");
  const [step, setStep] = useState<Step>(0);
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextKind, setNextKind] = useState<"none" | NonNullable<NextActionInput>["kind"]>("none");
  const [date, setDate] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<StoreErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // A submission is frozen on first use (id AND exact payload, including `at` and
  // `until`). A retry with the same inputs re-sends that very object, so after an
  // uncertain network result the database can recognise it as a duplicate. Changing
  // any input makes a new submission with a new id.
  const attempt = useRef<{ key: string; prepared: PreparedEvent } | null>(null);
  const frozen = (key: string, make: () => PreparedEvent): PreparedEvent => {
    if (attempt.current?.key !== key) attempt.current = { key, prepared: make() };
    return attempt.current.prepared;
  };
  const locked = pending || sync.busy;
  const formMode = mode === "SPOKE" || mode === "NO_ANSWER" || mode === "DID_NOT_CALL" ? mode : null;
  const inForm = formMode !== null;

  // Move focus to the new step's heading so screen-reader and keyboard users land on it.
  useEffect(() => {
    if (inForm) heading.current?.focus();
  }, [inForm, step]);

  const confirmation = (text: string) => (sync.mode === "OFF" ? `${text} ${flow.demoSuffix}` : text);

  const apply = (code: StoreErrorCode | null, message: string) => {
    setError(code);
    if (code === null) {
      attempt.current = null;
      setMode("idle");
      setStep(0);
      // Shown only now: in sync mode `send` resolves after the database acknowledged and the records were re-read.
      notify(confirmation(message));
    }
  };
  const finish = (result: StoreErrorCode | null | Promise<StoreErrorCode | null>, message: string) => {
    if (result instanceof Promise) {
      setPending(true);
      void result.then((code) => {
        setPending(false);
        apply(code, message);
      });
    } else {
      apply(result, message);
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
    // Both texts are sent exactly as typed or dictated: no trimming, no combining.
    const text = outcome === "CANCELLED" ? "" : note;
    const stepText = outcome === "CANCELLED" || nextStep === "" ? null : nextStep;
    if (text.length > MAX_TEXT || (stepText !== null && stepText.length > MAX_TEXT)) return setError("INVALID_PAYLOAD");
    const key = JSON.stringify(["outcome", question.callId, outcome, text, stepText, nextKind, date, dateTime, confirmed]);
    const message = flow.savedOutcome.replace("{client}", client).replace("{outcome}", copy.outcomes[outcome]);
    finish(send(frozen(key, () => prepare.outcome(question.callId, outcome, text, nextAction, stepText))), message);
  };

  const snoozeFor = (label: string, until: () => string) => {
    const at = until();
    const message = flow.savedSnooze.replace("{client}", client).replace("{time}", formatLocal(at, offset));
    finish(send(frozen(JSON.stringify(["snooze", question.callId, label]), () => prepare.snooze(question.callId, at))), message);
  };

  const reminderText =
    question.reminder === "SNOOZED" && question.snoozedUntil
      ? copy.reminder.SNOOZED.replace("{time}", formatLocal(question.snoozedUntil, offset))
      : question.reminder === "HELD_QUIET_HOURS"
        ? copy.reminder.HELD_QUIET_HOURS.replace("{start}", String(state.policy.quietStartHour)).replace("{end}", String(state.policy.quietEndHour))
        : copy.reminder.DUE_NOW;

  const open = (next: Mode) => {
    setError(null);
    attempt.current = null;
    setStep(0);
    setMode(next);
  };

  const followUpSummary =
    nextKind === "INTERNAL_FOLLOW_UP"
      ? `${copy.nextKinds.INTERNAL_FOLLOW_UP}: ${date === "" ? flow.notSet : date}`
      : nextKind === "CLIENT_CONFIRMED_APPOINTMENT"
        ? `${copy.nextKinds.CLIENT_CONFIRMED_APPOINTMENT}: ${dateTime === "" ? flow.notSet : dateTime.replace("T", " ")}`
        : copy.nextKinds.none;

  return (
    <article
      id={`donna-q-${question.callId}`}
      tabIndex={-1}
      className="donna-pop scroll-mt-4 space-y-4 rounded-2xl border border-amber-900/60 bg-neutral-900/70 p-4 outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:p-5"
      data-testid={`donna-question-${question.callId}`}
    >
      <div dir="auto" className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-lg font-semibold text-neutral-50">{client}</h3>
          <button
            type="button"
            className="min-h-11 px-1 text-xs text-amber-200 underline active:opacity-70"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? flow.hideHistory : flow.showHistory}
          </button>
        </div>
        <p className="text-xl leading-snug text-amber-100">{copy.question}</p>
        <p className="text-xs text-neutral-400">
          {copy.callDue} <Time iso={question.dueAt} offset={offset} />
        </p>
      </div>
      {showHistory ? (
        <div className="donna-pop rounded-xl border border-neutral-800 p-3">
          <ClientHistory clientId={question.clientId} />
        </div>
      ) : null}
      <p className="text-xs text-neutral-300" data-testid={`donna-reminder-${question.callId}`} dir="auto">
        {reminderText} <span className="text-neutral-500">· {copy.reminder.note}</span>
      </p>
      {question.taskMarkedDone ? <p className="text-xs text-amber-300" dir="auto">{copy.taskDoneNote}</p> : null}
      {question.dismissCount > 0 ? (
        <p className="text-xs text-neutral-400" dir="auto">{copy.dismissedNote.replace("{count}", String(question.dismissCount))}</p>
      ) : null}

      {mode === "idle" ? (
        <div className="donna-pop space-y-3">
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            <button type="button" disabled={locked} className={`${PRIMARY} min-h-14 text-base`} onClick={() => open("SPOKE")}>{copy.actions.spoke}</button>
            <button type="button" disabled={locked} className={`${BUTTON} min-h-14 text-base`} onClick={() => open("NO_ANSWER")}>{copy.actions.noAnswer}</button>
            <button type="button" disabled={locked} className={`${BUTTON} min-h-14 text-base`} onClick={() => open("DID_NOT_CALL")}>{copy.actions.didNotCall}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={locked} className={BUTTON} onClick={() => open("snooze")}>{copy.actions.snooze}</button>
            <button type="button" disabled={locked} className={BUTTON} onClick={() => open("cancel")}>{copy.actions.cancel}</button>
            {question.taskMarkedDone ? null : (
              <button
                type="button"
                className={`${BUTTON} text-neutral-400`}
                disabled={locked}
                onClick={() => finish(send(frozen(JSON.stringify(["done", question.callId]), () => prepare.taskDone(question.callId))), flow.savedTaskDone.replace("{client}", client))}
              >
                {copy.actions.markTaskDone}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {mode === "snooze" ? (
        <div className="donna-pop space-y-2">
          <p className="text-sm text-neutral-300" dir="auto">{copy.snooze.title}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON} disabled={locked} onClick={() => snoozeFor("1h", () => addMinutes(clockNow(), 60))}>{copy.snooze.oneHour}</button>
            <button type="button" className={BUTTON} disabled={locked} onClick={() => snoozeFor("4h", () => addMinutes(clockNow(), 240))}>{copy.snooze.fourHours}</button>
            <button type="button" className={BUTTON} disabled={locked} onClick={() => snoozeFor("tomorrow", () => nextLocalMorning(clockNow(), state.policy, 9))}>{copy.snooze.tomorrow}</button>
            <button type="button" className={BUTTON} onClick={() => open("idle")}>{copy.actions.back}</button>
          </div>
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="donna-pop flex flex-wrap gap-2">
          <button type="button" disabled={locked} className={BUTTON} onClick={() => submitOutcome("CANCELLED")}>{copy.actions.confirmCancel}</button>
          <button type="button" className={BUTTON} onClick={() => open("idle")}>{copy.actions.back}</button>
        </div>
      ) : null}

      {formMode ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (step < LAST_STEP) setStep((s) => (s + 1) as Step);
            else submitOutcome(formMode);
          }}
        >
          <div dir="auto" className="space-y-2">
            <p className="text-sm font-semibold text-amber-200">{copy.outcomes[formMode]}</p>
            <ol className="flex gap-1.5" aria-label={flow.progress}>
              {flow.steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={index === step ? "step" : undefined}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${index <= step ? "bg-amber-500" : "bg-neutral-700"}`}
                  title={label}
                />
              ))}
            </ol>
            <h4 ref={heading} tabIndex={-1} className="text-base font-semibold text-neutral-50 outline-none" data-testid={`donna-step-${question.callId}`}>
              {flow.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(LAST_STEP + 1))} · {flow.steps[step]}
            </h4>
            <p className="text-sm text-neutral-300">{flow.prompts[formMode][step]}</p>
          </div>

          {step === 0 ? (
            <div key="step-note" className="donna-pop space-y-2">
              <label className="block text-sm text-neutral-300">
                {copy.form.note}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" rows={4} className={FIELD} />
              </label>
              <VoiceButton label={copy.form.noteShort} onText={(t) => setNote((cur) => appendSpoken(cur, t))} />
              <VoiceReviewPanel
                note={note}
                callId={question.callId}
                at={clockNow()}
                onUseDate={(d) => {
                  setNextKind("INTERNAL_FOLLOW_UP");
                  setDate(d);
                }}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div key="step-next" className="donna-pop space-y-2">
              <label className="block text-sm text-neutral-300">
                {copy.form.nextStep}
                <textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} dir="auto" rows={3} className={FIELD} />
              </label>
              <VoiceButton label={copy.form.nextStepShort} onText={(t) => setNextStep((cur) => appendSpoken(cur, t))} />
            </div>
          ) : null}

          {step === 2 ? (
            <div key="step-follow" className="donna-pop space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-sm text-neutral-300">{copy.form.nextAction}</legend>
                <label className="flex min-h-11 items-start gap-3 rounded-lg border border-neutral-800 p-3 text-sm text-neutral-300 has-[:checked]:border-amber-500">
                  <input type="radio" name={`next-${question.callId}`} checked={nextKind === "none"} onChange={() => setNextKind("none")} className="mt-1 h-4 w-4" />
                  {copy.form.none}
                </label>
                <label className="flex min-h-11 items-start gap-3 rounded-lg border border-neutral-800 p-3 text-sm text-neutral-300 has-[:checked]:border-amber-500">
                  <input type="radio" name={`next-${question.callId}`} checked={nextKind === "INTERNAL_FOLLOW_UP"} onChange={() => setNextKind("INTERNAL_FOLLOW_UP")} className="mt-1 h-4 w-4" />
                  {copy.form.internal}
                </label>
                {formMode === "SPOKE" ? (
                  <label className="flex min-h-11 items-start gap-3 rounded-lg border border-neutral-800 p-3 text-sm text-neutral-300 has-[:checked]:border-amber-500">
                    <input type="radio" name={`next-${question.callId}`} checked={nextKind === "CLIENT_CONFIRMED_APPOINTMENT"} onChange={() => setNextKind("CLIENT_CONFIRMED_APPOINTMENT")} className="mt-1 h-4 w-4" />
                    {copy.form.appointment}
                  </label>
                ) : null}
              </fieldset>
              {nextKind === "INTERNAL_FOLLOW_UP" ? (
                <label className="donna-pop block text-sm text-neutral-300">
                  {copy.form.date}
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-base text-neutral-100" />
                </label>
              ) : null}
              {nextKind === "CLIENT_CONFIRMED_APPOINTMENT" ? (
                <div className="donna-pop space-y-2">
                  <label className="block text-sm text-neutral-300">
                    {copy.form.dateTime}
                    <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 text-base text-neutral-100" />
                  </label>
                  <label className="flex min-h-11 items-start gap-3 text-sm text-neutral-300">
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />
                    {copy.form.clientConfirmed}
                  </label>
                </div>
              ) : null}
              <dl className="space-y-1 rounded-xl border border-neutral-800 p-3 text-sm text-neutral-300" dir="auto" data-testid={`donna-review-${question.callId}`}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-amber-200">{flow.review}</dt>
                <dd>{copy.outcomes[formMode]}</dd>
                <dd className="whitespace-pre-wrap">{copy.record.originalInput}: {note === "" ? flow.notSet : note}</dd>
                <dd className="whitespace-pre-wrap">{copy.record.nextStep}: {nextStep === "" ? flow.notSet : nextStep}</dd>
                <dd>{followUpSummary}</dd>
              </dl>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {step < LAST_STEP ? (
              <button type="submit" disabled={locked} className={PRIMARY}>{flow.next}</button>
            ) : null}
            <button
              type={step < LAST_STEP ? "button" : "submit"}
              disabled={locked}
              className={step < LAST_STEP ? BUTTON : PRIMARY}
              onClick={step < LAST_STEP ? () => submitOutcome(formMode) : undefined}
            >
              {copy.actions.saveOutcome}
            </button>
            <button type="button" className={BUTTON} onClick={() => (step === 0 ? open("idle") : setStep((s) => (s - 1) as Step))}>{copy.actions.back}</button>
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
