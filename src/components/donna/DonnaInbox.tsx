"use client";

import { formatLocal, type ConfirmedFact, type OutcomeRecord } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/en";
import { AiStatusPanel } from "./AiStatusPanel";
import { ClientMemoryPanel } from "./ClientMemoryPanel";
import { DonnaSyncPanel } from "./DonnaSyncPanel";
import { DraftCard } from "./DraftCard";
import { FeedbackProvider } from "./Feedback";
import { MorningBrief } from "./MorningBrief";
import { TodayPanel } from "./TodayPanel";
import { useDonna } from "./DonnaProvider";
import { BUTTON } from "./ui";
import Link from "next/link";

type Copy = Dictionary["donna"];

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
    <FeedbackProvider>
      <div className="mx-auto max-w-2xl space-y-6 pb-24" data-testid="donna-inbox">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">{copy.eyebrow}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50">{copy.title}</h1>
          <p className="text-sm leading-6 text-neutral-300" dir="auto">{copy.description}</p>
          <p className="rounded-lg border border-rose-900/70 bg-rose-950/20 p-3 text-sm text-rose-100" dir="auto">
            {copy.noExecution}
          </p>
        </header>

        <Link
          href="/app-studio/donna/talk"
          className="group flex items-center gap-4 rounded-2xl border border-rose-700/50 bg-gradient-to-r from-rose-950/70 via-amber-950/40 to-neutral-950 p-4 transition hover:border-rose-500/70 active:scale-[0.99]"
          data-testid="donna-talk-open"
        >
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-orange-500 to-rose-700 shadow-[0_0_28px_rgba(244,63,94,0.45)]">
            <span className="absolute inset-0 rounded-full border border-rose-400/40 motion-safe:animate-ping" />
            <span className="h-3 w-3 rounded-full bg-white/90" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-neutral-50">{copy.talk.open}</span>
            <span className="block text-sm text-neutral-300" dir="auto">{copy.talk.openHint}</span>
          </span>
        </Link>

        {showLists ? <MorningBrief /> : null}

        <Link href="/app-studio/donna/council" className="block rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-sm font-semibold text-amber-100">Donna AI Council →</Link>

        <DonnaSyncPanel />

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
            <TodayPanel />

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

            <ClientMemoryPanel />
          </>
        ) : null}

        <AiStatusPanel />

        <details className="rounded-xl border border-neutral-800 p-4" data-testid="donna-demo-status">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold text-neutral-200">{copy.demoTitle}</summary>
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
        </details>
      </div>
    </FeedbackProvider>
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
      <p className="whitespace-pre-wrap text-sm text-neutral-300" dir="auto">
        <span className="font-medium">{copy.record.originalInput}:</span> {record.originalInput.trim() === "" ? copy.record.noNote : record.originalInput}
      </p>
      {record.nextStep !== null && record.nextStep.trim() !== "" ? (
        <p className="whitespace-pre-wrap text-sm text-neutral-300" data-testid={`donna-nextstep-${callId}`} dir="auto">
          <span className="font-medium">{copy.record.nextStep}:</span> {record.nextStep}
        </p>
      ) : null}
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
      <DraftCard callId={callId} clientName={client} record={record} offsetMinutes={offset} />
    </article>
  );
}
