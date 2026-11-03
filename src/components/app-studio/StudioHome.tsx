"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { createEchoRuntime, type EchoResult } from "@/lib/echo";
import {
  buildNameIndex,
  converse,
  localParts,
  startConversation,
  type DonnaClient,
  type Mood,
  type World,
} from "@/lib/donna";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "@/components/donna/DonnaProvider";
import { DonnaOrb, type OrbActivity } from "@/components/donna/talk/DonnaOrb";
import { replyLines, type Voice } from "@/components/donna/talk/sayText";
import { fill } from "@/components/donna/briefText";

type Lang = "en" | "ar";

interface Answer {
  readonly id: number;
  readonly text: string;
  readonly echo: EchoResult;
  readonly lines: readonly string[];
  readonly mood: Mood;
}

const detectLang = (text: string, fallback: Lang): Lang => (/[؀-ۿ]/.test(text) ? "ar" : /[a-z]/i.test(text) ? "en" : fallback);
const shortName = (clients: readonly DonnaClient[], id: string, lang: Lang) => clients.find((c) => c.id === id)?.label[lang].split(" ").pop() ?? id;

const PRIMARY =
  "studio-press inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--studio-accent)] px-6 text-base font-semibold text-[var(--studio-ground)] hover:bg-[var(--studio-accent-hover)]";
const SECONDARY =
  "studio-press inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--studio-raised)] px-6 text-base font-semibold text-[var(--studio-ink)] hover:bg-[var(--studio-raised-hover)]";

/**
 * The App Studio home: one page that introduces Donna, SalesOS and ECHO and lets the owner
 * try a sentence on all three at once. Everything runs locally on the synthetic demo book;
 * nothing is sent, stored or fetched.
 */
export function StudioHome() {
  const { dict, locale } = useLocale();
  const copy = dict.studio;
  const { state, now, profiles } = useDonna();
  const offset = state.policy.utcOffsetMinutes;
  const today = localParts(now, offset).date;
  const names = useMemo(() => buildNameIndex(state.clients), [state.clients]);
  const world = useMemo<World>(() => ({ state, profiles, now, names }), [state, profiles, now, names]);
  const voices = useMemo<Record<Lang, Voice>>(
    () => ({
      en: { copy: en.donna, today, offset, name: (id) => shortName(state.clients, id, "en") },
      ar: { copy: ar.donna, today, offset, name: (id) => shortName(state.clients, id, "ar") },
    }),
    [state.clients, today, offset],
  );

  const echo = useRef(createEchoRuntime());
  const pulse = useRef(0);
  const nextId = useRef(1);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [activity, setActivity] = useState<OrbActivity>("idle");
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ask = (raw: string) => {
    const said = raw.trim();
    if (!said) return;
    const lang = detectLang(said, locale);
    const heard = echo.current.process({
      text: said,
      inputMode: "TEXT",
      timestamp: now,
      session: { id: "studio-home" },
    });
    // A fresh conversation each time: the home page shows one exchange, not a thread.
    const turn = converse(startConversation(), said, world);
    const lines = replyLines(turn.reply, voices[lang]);
    setAnswer({ id: nextId.current++, text: said, echo: heard, lines, mood: turn.reply.mood });
    setText("");
    pulse.current += 1;
    setActivity("speaking");
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setActivity("idle"), 1600);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    ask(text);
  };

  const heardLine = answer
    ? fill(copy.heardAs, {
        language: copy.languages[answer.echo.resolvedIntent.language],
        intent: copy.intents[answer.echo.resolvedIntent.kind],
        confidence: copy.confidence[answer.echo.confidence],
      })
    : null;
  const mood: Mood = answer?.mood ?? "CALM";

  return (
    <div className="studio -m-4 bg-[var(--studio-ground)] text-[var(--studio-ink)]" data-testid="studio-home">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
        <div className="studio-rise">
          <h1 className="max-w-[18ch] text-4xl font-semibold leading-[1] tracking-[-0.035em] sm:text-5xl xl:text-7xl" dir="auto">
            {copy.title}
          </h1>
          <p className="mt-8 max-w-[52ch] text-lg leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
            {copy.lede}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/app-studio/donna/talk" className={PRIMARY} data-testid="studio-answer">
              {copy.answer}
            </Link>
            <Link href="/app-studio/salesos" className={SECONDARY}>
              {copy.openSalesos}
            </Link>
          </div>
        </div>
        <div className="studio-rise studio-delay-2 relative mx-auto aspect-square w-full max-w-[420px]" aria-hidden="true">
          <DonnaOrb activity={activity} mood={mood} pulse={pulse} scale={0.26} className="absolute inset-0 h-full w-full" />
        </div>
      </section>

      <section aria-labelledby="studio-try" className="bg-[var(--studio-surface)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-24">
          <div>
            <h2 id="studio-try" className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl" dir="auto">
              {copy.tryTitle}
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
              {copy.tryLede}
            </p>
            <form onSubmit={submit} className="mt-8 flex gap-2" data-testid="studio-try-form">
              <label htmlFor="studio-input" className="sr-only">
                {copy.inputLabel}
              </label>
              <input
                id="studio-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={copy.placeholder}
                dir="auto"
                autoComplete="off"
                className="min-h-12 min-w-0 flex-1 rounded-full bg-[var(--studio-ground)] px-5 text-base text-[var(--studio-ink)] placeholder:text-[var(--studio-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]"
              />
              <button type="submit" className={PRIMARY}>
                {copy.run}
              </button>
            </form>
            <div className="mt-5" role="group" aria-label={copy.examplesLabel}>
              <span className="me-2 text-sm text-[var(--studio-ink-faint)]">{copy.examplesLabel}</span>
              <span className="mt-2 inline-flex flex-wrap gap-2">
                {copy.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => ask(example)}
                    dir="auto"
                    className="studio-press min-h-10 rounded-full bg-[var(--studio-raised)] px-4 text-sm text-[var(--studio-ink)] hover:bg-[var(--studio-raised-hover)]"
                  >
                    {example}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="self-start rounded-3xl bg-[var(--studio-ground)] p-6 sm:p-8" aria-live="polite" data-testid="studio-answer-panel">
            {answer ? (
              <dl key={answer.id} className="space-y-7">
                <p className="studio-rise text-xl font-medium" dir="auto">
                  “{answer.text}”
                </p>
                <div className="studio-rise studio-delay-1">
                  <dt className="text-sm text-[var(--studio-ink-faint)]">{copy.heard}</dt>
                  <dd className="mt-1 text-lg" dir="auto" data-testid="studio-heard">
                    {heardLine}
                  </dd>
                </div>
                <div className="studio-rise studio-delay-2">
                  <dt className="text-sm text-[var(--studio-ink-faint)]">{copy.says}</dt>
                  <dd className="mt-1 space-y-2 text-lg leading-relaxed" data-testid="studio-says" data-mood={answer.mood}>
                    {answer.lines.map((line, i) => (
                      <p key={i} dir="auto" className={i === 0 && (answer.mood === "STOP" || answer.mood === "WARN") ? "font-semibold text-[var(--studio-stop)]" : undefined}>
                        {line}
                      </p>
                    ))}
                  </dd>
                </div>
                <div className="studio-rise studio-delay-3">
                  <dt className="text-sm text-[var(--studio-ink-faint)]">{copy.sent}</dt>
                  <dd className="mt-1 text-lg font-semibold" dir="auto" data-testid="studio-sent">
                    {copy.sentNothing}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-lg text-[var(--studio-ink-soft)]" dir="auto">
                {copy.waiting}
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="studio-donna" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
        <div>
          <h2 id="studio-donna" className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl" dir="auto">
            {copy.donnaTitle}
          </h2>
          <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
            {copy.donnaBody}
          </p>
          <Link href="/app-studio/donna/talk" className={`${PRIMARY} mt-8`}>
            {copy.donnaLink}
          </Link>
        </div>
        <ul className="space-y-6">
          {copy.donnaPoints.map((point) => {
            const [moment, rest] = point.split(/:\s?/, 2);
            return (
              <li key={point} className="text-xl leading-snug" dir="auto">
                <span className="font-semibold text-[var(--studio-accent)]">{moment}</span>
                {rest ? <span className="text-[var(--studio-ink)]">: {rest}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="studio-salesos" className="bg-[var(--studio-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="studio-salesos" className="max-w-[20ch] text-3xl font-semibold tracking-[-0.025em] sm:text-4xl" dir="auto">
            {copy.salesosTitle}
          </h2>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
            {copy.salesosBody}
          </p>
          <ul className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {copy.salesosStates.map((stateName, i) => (
              <li
                key={stateName}
                dir="auto"
                className={
                  i === 0
                    ? "text-3xl font-semibold tracking-[-0.02em] text-[var(--studio-stop)] sm:col-span-2 sm:text-5xl"
                    : "text-2xl font-medium tracking-[-0.015em] text-[var(--studio-ink)]"
                }
              >
                {stateName}
              </li>
            ))}
          </ul>
          <Link href="/app-studio/salesos" className={`${SECONDARY} mt-12`}>
            {copy.salesosLink}
          </Link>
        </div>
      </section>

      <section aria-labelledby="studio-echo" className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
        <p className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--studio-ink)] sm:text-5xl" dir="rtl" lang="ar">
          هكلم Beta بكره, <span className="text-[var(--studio-accent)]">ok?</span>
          <br />
          <span dir="ltr" lang="en" className="text-[var(--studio-ink-soft)]">
            Ana 3ayez a7ges unit.
          </span>
        </p>
        <div>
          <h2 id="studio-echo" className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl" dir="auto">
            {copy.echoTitle}
          </h2>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
            {copy.echoBody}
          </p>
          <Link href="/app-studio/echo" className={`${SECONDARY} mt-8`}>
            {copy.echoLink}
          </Link>
        </div>
      </section>

      <section aria-labelledby="studio-close" className="bg-[var(--studio-accent)] text-[var(--studio-ground)]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8 lg:py-28">
          <h2 id="studio-close" className="max-w-[16ch] text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl" dir="auto">
            {copy.closeTitle}
          </h2>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed" dir="auto">
            {copy.closeBody}
          </p>
          <Link
            href="/app-studio/donna/talk"
            className="studio-press mt-10 inline-flex min-h-12 items-center rounded-full bg-[var(--studio-ground)] px-6 text-base font-semibold text-[var(--studio-ink)]"
          >
            {copy.answer}
          </Link>
          <p className="mt-16 text-sm" dir="auto">
            {copy.demoNote}
          </p>
        </div>
      </section>
    </div>
  );
}
