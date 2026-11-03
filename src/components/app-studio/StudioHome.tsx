"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import { createEchoRuntime } from "@/lib/echo";
import {
  buildNameIndex,
  converse,
  localParts,
  opening,
  readBook,
  startConversation,
  type Conversation,
  type DonnaClient,
  type Mood,
  type World,
} from "@/lib/donna";
import { ar } from "@/lib/i18n/ar";
import { en } from "@/lib/i18n/en";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "@/components/donna/DonnaProvider";
import { BookRadar } from "@/components/donna/talk/BookRadar";
import { replyLines, speakable, type Voice } from "@/components/donna/talk/sayText";
import { useDonnaVoice, type Lang } from "@/components/donna/talk/useDonnaVoice";
import { fill } from "@/components/donna/briefText";

type Line =
  | { readonly id: number; readonly who: "you"; readonly text: string; readonly heard: string }
  | { readonly id: number; readonly who: "donna"; readonly lines: readonly string[]; readonly mood: Mood; readonly lang: Lang };

const detectLang = (text: string, fallback: Lang): Lang => (/[؀-ۿ]/.test(text) ? "ar" : /[a-z]/i.test(text) ? "en" : fallback);
const shortName = (clients: readonly DonnaClient[], id: string, lang: Lang) => clients.find((c) => c.id === id)?.label[lang].split(" ").pop() ?? id;

/** The room takes her mood: the whole stage shifts tone when she warns, stops you, or is pleased. */
const MOOD_GROUND: Record<Mood, string> = { CALM: "#0c0b0a", WARN: "#17120a", STOP: "#1d0b0b", PLEASED: "#151309" };

const PRIMARY =
  "studio-press inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--studio-accent)] px-6 text-base font-semibold text-[var(--studio-ground)] hover:bg-[var(--studio-accent-hover)]";
const SECONDARY =
  "studio-press inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--studio-raised)] px-6 text-base font-semibold text-[var(--studio-ink)] hover:bg-[var(--studio-raised-hover)]";

/** Shows its section as it scrolls into view. Without script, or before it runs, everything is visible. */
function Reveal({ children, className = "", label }: { children: ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"static" | "pending" | "shown">("static");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    setState("pending");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} aria-labelledby={label} data-reveal={state} className={className}>
      {children}
    </section>
  );
}

/**
 * The App Studio home is a call: Donna speaks first, you talk or type back, and she answers
 * aloud. ECHO shows how it heard each sentence, the radar is your book around her, and the
 * room changes with her mood. Everything runs on this device on the synthetic demo book;
 * her voice is the browser's own speech. Nothing is sent anywhere.
 */
export function StudioHome() {
  const { dict, locale } = useLocale();
  const copy = dict.studio;
  const talk = dict.donna.talk;
  const { state, now, profiles, fileDebrief, markPromiseKept } = useDonna();
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
  const v = voices[locale];
  const book = useMemo(() => readBook(profiles, now, offset), [profiles, now, offset]);

  const voice = useDonnaVoice();
  const echo = useRef(createEchoRuntime());
  const conv = useRef<Conversation>(startConversation());
  const nextId = useRef(1);
  const handsFree = useRef(false);
  const [live, setLive] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [lines, setLines] = useState<readonly Line[]>([]);
  const [mood, setMood] = useState<Mood>("CALM");
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState("");
  const tilt = useRef<HTMLDivElement | null>(null);
  const transcript = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const list = transcript.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines]);

  const say = (spoken: readonly string[], lang: Lang) => {
    if (muted || !voice.canSpeak) return;
    voice.speak(spoken.map(speakable), lang, () => {
      if (handsFree.current) listenRef.current();
    });
  };

  const answer = () => {
    if (live) return;
    setLive(true);
    const reply = opening(world);
    const spoken = replyLines(reply, v);
    setLines([{ id: nextId.current++, who: "donna", lines: spoken, mood: reply.mood, lang: locale }]);
    setMood(reply.mood);
    say(spoken, locale);
  };

  const handle = (raw: string, viaVoice = false) => {
    const text = raw.trim();
    if (!text) return;
    setLive(true);
    handsFree.current = viaVoice;
    voice.hush();
    const lang = detectLang(text, locale);
    const heard = echo.current.process({ text, inputMode: viaVoice ? "VOICE_TRANSCRIPT" : "TEXT", timestamp: now, session: { id: "studio-home" } });
    const turn = converse(conv.current, text, world);
    if (turn.file) fileDebrief(turn.file);
    if (turn.keep) markPromiseKept(turn.keep.clientId, turn.keep.promiseId);
    const proposal = turn.reply.card?.kind === "PROPOSAL" ? turn.conversation.proposal : null;
    conv.current = turn.conversation;
    setFocus(turn.conversation.focus);
    const spoken = replyLines(turn.reply, voices[lang], proposal);
    const heardLine = fill(copy.heardShort, {
      line: fill(copy.heardAs, {
        language: copy.languages[heard.resolvedIntent.language],
        intent: copy.intents[heard.resolvedIntent.kind],
        confidence: copy.confidence[heard.confidence],
      }),
    });
    setLines((prev) => [
      ...prev,
      { id: nextId.current++, who: "you", text, heard: heardLine },
      { id: nextId.current++, who: "donna", lines: spoken, mood: turn.reply.mood, lang },
    ]);
    setMood(turn.reply.mood);
    if (turn.reply.mood === "STOP" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([70, 50, 70]);
    say(spoken, lang);
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  const startListening = () => {
    voice.hush();
    handsFree.current = true;
    if (!voice.listen(locale, (text) => handleRef.current(text, true))) handsFree.current = false;
  };
  const listenRef = useRef(startListening);
  listenRef.current = startListening;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    handle(input);
    setInput("");
  };

  // The radar leans toward the pointer. Written straight to the style: no re-render per move.
  const lean = (event: PointerEvent<HTMLDivElement>) => {
    const el = tilt.current;
    if (!el || event.pointerType !== "mouse") return;
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg)`;
  };
  const settle = () => {
    if (tilt.current) tilt.current.style.transform = "";
  };

  const activity = voice.listening ? "listening" : voice.speaking ? "speaking" : live ? "idle" : "ringing";
  const lastHer = [...lines].reverse().find((l): l is Extract<Line, { who: "donna" }> => l.who === "donna");
  const status = voice.listening ? talk.status.listening : voice.speaking ? talk.status.speaking : muted ? talk.status.muted : talk.status.ready;

  return (
    <div className="studio -m-4 bg-[var(--studio-ground)] text-[var(--studio-ink)]" data-testid="studio-home">
      <section
        aria-labelledby="studio-title"
        className="studio-stage"
        style={{ backgroundColor: MOOD_GROUND[mood] }}
        data-mood={mood}
        data-testid="studio-stage"
      >
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-20 lg:pt-16">
          <div className="studio-rise">
            <h1 id="studio-title" className="max-w-[18ch] text-4xl font-semibold leading-[1] tracking-[-0.035em] sm:text-5xl xl:text-6xl" dir="auto">
              {copy.title}
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-[var(--studio-ink-soft)]" dir="auto">
              {copy.lede}
            </p>

            {!live ? (
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <button type="button" onClick={answer} className={`${PRIMARY} studio-ring relative isolate px-8 text-lg`} data-testid="studio-answer">
                  {copy.answer}
                </button>
                <span className="text-sm text-[var(--studio-ink-faint)]" dir="auto">
                  {copy.soundOn}
                </span>
              </div>
            ) : null}

            <div className={live ? "studio-rise mt-8" : "mt-8"} role="region" aria-label={copy.callTitle}>
              {live ? (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm text-[var(--studio-ink-faint)]">
                    <span aria-live="polite" data-testid="studio-status">
                      {status}
                    </span>
                    {voice.canSpeak ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!muted) voice.hush();
                          setMuted((m) => !m);
                        }}
                        className="studio-press min-h-10 rounded-full px-3 text-[var(--studio-ink-soft)] hover:text-[var(--studio-ink)]"
                        aria-pressed={muted}
                      >
                        {muted ? talk.unmute : talk.mute}
                      </button>
                    ) : null}
                  </div>
                  <ol
                    ref={transcript}
                    className="max-h-[22rem] space-y-4 overflow-y-auto rounded-3xl bg-[var(--studio-surface)] p-5 sm:p-6"
                    aria-live="polite"
                    data-testid="studio-transcript"
                  >
                    {lines.map((line) =>
                      line.who === "you" ? (
                        <li key={line.id} className="studio-rise text-end" data-who="you">
                          <p className="inline-block max-w-[85%] rounded-2xl bg-[var(--studio-raised)] px-4 py-2 text-start text-base" dir="auto">
                            {line.text}
                          </p>
                          <p className="mt-1 text-xs text-[var(--studio-ink-faint)]" dir="auto" data-testid="studio-heard">
                            {line.heard}
                          </p>
                        </li>
                      ) : (
                        <li key={line.id} className="studio-rise space-y-1.5" data-who="donna" data-mood={line.mood} data-testid="studio-says">
                          {line.lines.map((text, i) => {
                            const spokenNow = line === lastHer && voice.speaking && voice.line === i;
                            const warn = i === 0 && (line.mood === "STOP" || line.mood === "WARN");
                            return (
                              <p
                                key={i}
                                dir="auto"
                                className={`text-lg leading-relaxed transition-colors duration-300 ${warn ? "font-semibold text-[var(--studio-stop)]" : ""} ${
                                  line === lastHer && voice.speaking && !spokenNow ? "text-[var(--studio-ink-faint)]" : ""
                                }`}
                              >
                                {text}
                              </p>
                            );
                          })}
                        </li>
                      ),
                    )}
                  </ol>
                </>
              ) : null}

              <form onSubmit={submit} className="mt-4 flex gap-2" data-testid="studio-try-form">
                <label htmlFor="studio-input" className="sr-only">
                  {copy.inputLabel}
                </label>
                {voice.canListen ? (
                  <button
                    type="button"
                    onClick={() => (voice.listening ? voice.stopListening() : startListening())}
                    className={`studio-press grid h-12 w-12 shrink-0 place-items-center rounded-full ${
                      voice.listening ? "bg-[var(--studio-stop)] text-[var(--studio-ground)]" : "bg-[var(--studio-raised)] text-[var(--studio-ink)] hover:bg-[var(--studio-raised-hover)]"
                    }`}
                    aria-label={voice.listening ? talk.micStop : talk.mic}
                    aria-pressed={voice.listening}
                    data-testid="studio-mic"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                ) : null}
                <input
                  id="studio-input"
                  value={voice.listening ? voice.interim : input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={voice.listening ? talk.status.listening : copy.placeholder}
                  dir="auto"
                  autoComplete="off"
                  readOnly={voice.listening}
                  className="min-h-12 min-w-0 flex-1 rounded-full bg-[var(--studio-surface)] px-5 text-base text-[var(--studio-ink)] placeholder:text-[var(--studio-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--studio-accent)]"
                />
                <button type="submit" className={PRIMARY}>
                  {talk.ask}
                </button>
              </form>
              <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={copy.examplesLabel}>
                <span className="me-1 text-sm text-[var(--studio-ink-faint)]">{copy.examplesLabel}</span>
                {copy.examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handle(example)}
                    dir="auto"
                    className="studio-press min-h-10 rounded-full bg-[var(--studio-raised)] px-4 text-sm text-[var(--studio-ink)] hover:bg-[var(--studio-raised-hover)]"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-sm font-medium text-[var(--studio-ink-soft)]" dir="auto" data-testid="studio-sent">
                {copy.sentNothing}
              </p>
              {live && !voice.canListen ? (
                <p className="mt-1 text-sm text-[var(--studio-ink-faint)]" dir="auto">
                  {talk.noEar}
                </p>
              ) : null}
            </div>
          </div>

          <figure className="studio-rise studio-delay-2 mx-auto w-full max-w-[460px]">
            <div ref={tilt} onPointerMove={lean} onPointerLeave={settle} className="studio-tilt">
              <BookRadar
                entries={book}
                name={v.name}
                label={(entry) =>
                  [fill(talk.radarLabel, { client: v.name(entry.clientId), heat: talk.heat[entry.heat] }), entry.days !== null ? fill(talk.radarDays, { days: entry.days }) : "", entry.overdue > 0 ? talk.owedBadge : ""]
                    .filter(Boolean)
                    .join(" · ")
                }
                title={`${talk.radarTitle}. ${talk.radarHint}`}
                focus={focus}
                onPick={(clientId) => handle(fill(talk.askAbout, { client: v.name(clientId) }))}
                activity={activity}
                mood={mood}
                pulse={voice.pulse}
              />
            </div>
            <figcaption className="mt-3 text-center text-sm text-[var(--studio-ink-faint)]" dir="auto">
              {copy.radarCaption}
            </figcaption>
          </figure>
        </div>
      </section>

      <Reveal label="studio-donna" className="studio-reveal mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
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
      </Reveal>

      <Reveal label="studio-salesos" className="studio-reveal bg-[var(--studio-surface)]">
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
      </Reveal>

      <Reveal label="studio-echo" className="studio-reveal mx-auto grid max-w-6xl items-end gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
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
      </Reveal>

      <Reveal label="studio-close" className="studio-reveal bg-[var(--studio-accent)] text-[var(--studio-ground)]">
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
            {copy.donnaLink}
          </Link>
          <p className="mt-16 text-sm" dir="auto">
            {copy.demoNote}
          </p>
        </div>
      </Reveal>
    </div>
  );
}
