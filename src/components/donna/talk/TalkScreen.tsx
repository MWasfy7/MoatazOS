"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildMorningBrief,
  buildNameIndex,
  converse,
  daysBetween,
  declined,
  localParts,
  opening,
  readBook,
  startConversation,
  type BookEntry,
  type ClientProfile,
  type Conversation,
  type DebriefProposal,
  type DonnaClient,
  type HeardItem,
  type Mood,
  type Reply,
  type World,
} from "@/lib/donna";
import { ar } from "@/lib/i18n/ar";
import { en, type Dictionary } from "@/lib/i18n/en";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Bidi } from "../Bidi";
import { fill, lineText, wantsText } from "../briefText";
import { useDonna } from "../DonnaProvider";
import { BookRadar } from "./BookRadar";
import { DonnaOrb } from "./DonnaOrb";
import { factText, heardText, replyLines, speakable, type Voice } from "./sayText";
import { useDonnaVoice, type Lang } from "./useDonnaVoice";

const DICTS: Record<Lang, Dictionary> = { en, ar };

type Entry =
  | { readonly id: number; readonly who: "you"; readonly text: string }
  | {
      readonly id: number;
      readonly who: "donna";
      readonly reply: Reply;
      readonly lang: Lang;
      readonly proposal: DebriefProposal | null;
      readonly state: "open" | "filed" | "discarded" | "replaced" | null;
    };

const shortName = (clients: readonly DonnaClient[], id: string, lang: Lang) => clients.find((c) => c.id === id)?.label[lang].split(" ").pop() ?? id;
/** Donna answers in the language the operator just used. */
const detectLang = (text: string, fallback: Lang): Lang => (/[؀-ۿ]/.test(text) ? "ar" : /[a-z]/i.test(text) ? "en" : fallback);

const MOOD_TONE: Record<Mood, string> = {
  CALM: "border-amber-900/40 bg-neutral-900/70",
  WARN: "border-amber-600/50 bg-amber-950/40",
  STOP: "border-rose-600/70 bg-rose-950/50",
  PLEASED: "border-yellow-600/40 bg-yellow-950/25",
};

const HEAT_CHIP: Record<BookEntry["heat"], string> = {
  HOT: "bg-orange-500/20 text-orange-200",
  WARM: "bg-amber-500/20 text-amber-200",
  COOLING: "bg-sky-500/20 text-sky-200",
  COLD: "bg-slate-500/20 text-slate-300",
  HELD: "bg-zinc-600/30 text-zinc-300",
};

const CHIPS = ["brief", "who", "hold", "owe", "prep", "debrief"] as const;

function LangToggle({ locale, setLocale }: { locale: Lang; setLocale: (l: Lang) => void }) {
  return (
    <>
      {(["en", "ar"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`min-h-11 min-w-11 rounded-lg px-2 text-sm ${locale === l ? "bg-white/10 text-white" : "text-neutral-500"}`}
          lang={l}
          data-testid={`donna-talk-lang-${l}`}
        >
          {l === "en" ? "EN" : "ع"}
        </button>
      ))}
    </>
  );
}

function Icon({ d, className = "h-6 w-6" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const HANDSET =
  "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.12.37 2.33.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z";
const MIC = "M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z";
const SPEAKER = "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z";
const SPEAKER_OFF = "M16.5 12A4.5 4.5 0 0 0 14 8v2.18l2.45 2.45a4.4 4.4 0 0 0 .05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z";

/**
 * Talk to Donna (DON-07). She calls you; you answer; she speaks first. Then it is a
 * conversation, by voice or by text, in English or Egyptian Arabic, grounded only in what she
 * remembers. Every answer comes from Donna's pure mind (`@/lib/donna/mind`); this screen only
 * shows it, says it, and files what the operator confirms into memory. Nothing here calls,
 * messages, books or writes anywhere outside this tab (AGENTS.md invariants 1, 8, 9).
 */
export function TalkScreen() {
  const { dict, locale, setLocale } = useLocale();
  const talk = dict.donna.talk;
  const { state, now, profiles, inbox, prepare, send, fileDebrief, markPromiseKept } = useDonna();
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
  const briefCount = useMemo(() => buildMorningBrief(state, profiles, now).lines.length, [state, profiles, now]);

  const voice = useDonnaVoice();
  const [phase, setPhase] = useState<"ringing" | "live">("ringing");
  const [conv, setConv] = useState<Conversation>(startConversation);
  const convRef = useRef(conv);
  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [mood, setMood] = useState<Mood>("CALM");
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState("");
  const nextId = useRef(0);
  const handsFree = useRef(false);
  /** First entry of the newest exchange: scrolled to the top so her words show before any card. */
  const [anchor, setAnchor] = useState<number | null>(null);
  const anchorRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    anchorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [anchor]);

  useEffect(() => {
    if (voice.problem) handsFree.current = false;
  }, [voice.problem]);

  const speakReply = (reply: Reply, lang: Lang, proposal: DebriefProposal | null) => {
    if (muted || !voice.canSpeak) return;
    const lines = replyLines(reply, voices[lang], proposal).map(speakable);
    voice.speak(lines, lang, () => {
      if (handsFree.current) listenRef.current();
    });
  };

  const fileIt = (proposal: DebriefProposal) => {
    fileDebrief(proposal);
    const outcome = proposal.items.find((i): i is Extract<HeardItem, { kind: "OUTCOME" }> => i.kind === "OUTCOME");
    const question = inbox.unresolved.find((q) => q.clientId === proposal.clientId);
    if (!outcome || !question) return;
    const promise = proposal.items.find((i): i is Extract<HeardItem, { kind: "PROMISE" }> => i.kind === "PROMISE");
    const nextAction = promise && promise.due >= today ? { kind: "INTERNAL_FOLLOW_UP" as const, date: promise.due } : null;
    void Promise.resolve(send(prepare.outcome(question.callId, outcome.outcome, proposal.originalInput, nextAction)));
  };

  const start = (reply: Reply, speakIt: boolean) => {
    setPhase("live");
    setEntries([{ id: nextId.current++, who: "donna", reply, lang: locale, proposal: null, state: null }]);
    setMood(reply.mood);
    if (speakIt) speakReply(reply, locale, null);
  };

  const handle = (raw: string, viaVoice = false) => {
    const text = raw.trim();
    if (!text) return;
    handsFree.current = viaVoice;
    voice.hush();
    const lang = detectLang(text, locale);
    const before = convRef.current;
    const turn = converse(before, text, world);
    if (turn.file) fileIt(turn.file);
    if (turn.keep) markPromiseKept(turn.keep.clientId, turn.keep.promiseId);
    convRef.current = turn.conversation;
    setConv(turn.conversation);
    const proposal = turn.reply.card?.kind === "PROPOSAL" ? turn.conversation.proposal : null;
    const youId = nextId.current++;
    const herId = nextId.current++;
    setAnchor(youId);
    setEntries((prev) => [
      ...prev.map((e): Entry => {
        if (e.who !== "donna" || e.state !== "open" || e.proposal !== before.proposal) return e;
        if (turn.file) return { ...e, state: "filed" };
        if (!turn.conversation.proposal) return { ...e, state: "discarded" };
        return proposal ? { ...e, state: "replaced" } : e;
      }),
      { id: youId, who: "you", text },
      { id: herId, who: "donna", reply: turn.reply, lang, proposal, state: proposal ? "open" : null },
    ]);
    setMood(turn.reply.mood);
    if (turn.reply.mood === "STOP" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([70, 50, 70]);
    speakReply(turn.reply, lang, proposal);
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

  useEffect(() => {
    if (phase !== "live") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|BUTTON|SELECT|A)$/.test(target.tagName)) return;
      if (event.code === "Space" && voice.canListen) {
        event.preventDefault();
        if (voice.listening) voice.stopListening();
        else listenRef.current();
      }
      if (event.key === "Escape") voice.hush();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, voice]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    handle(input);
    setInput("");
  };

  const activity = voice.listening ? "listening" : voice.speaking ? "speaking" : "idle";
  const lastHer = [...entries].reverse().find((e): e is Extract<Entry, { who: "donna" }> => e.who === "donna");
  const herLines = lastHer ? replyLines(lastHer.reply, voices[lastHer.lang], lastHer.proposal) : [];
  // The caption follows her voice sentence by sentence; when she is quiet it shows her headline.
  const caption = voice.listening ? voice.interim || talk.status.listening : (voice.speaking ? herLines[voice.line] : herLines[0]) ?? "";
  const status = voice.listening ? talk.status.listening : voice.speaking ? talk.status.speaking : muted ? talk.status.muted : talk.status.ready;
  const earNote = voice.problem === "denied" ? talk.denied : voice.problem === "no_speech" ? talk.noSpeech : voice.problem === "failed" ? talk.earFailed : null;

  if (phase === "ringing") {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden bg-[radial-gradient(ellipse_at_top,_#3b0a14_0%,_#0b0507_55%,_#050505_100%)] px-6 pb-[max(env(safe-area-inset-bottom),2.5rem)] pt-16 text-center text-neutral-100"
        data-testid="donna-talk-incoming"
        dir={dict.dir}
      >
        <div className="absolute end-3 top-3 flex gap-1">
          <LangToggle locale={locale} setLocale={setLocale} />
        </div>
        <div className="flex flex-col items-center">
          <div className="relative h-60 w-60">
            <span className="absolute inset-6 rounded-full border border-rose-500/30 motion-safe:animate-ping" />
            <DonnaOrb activity="ringing" mood="CALM" scale={0.2} className="absolute inset-0 h-full w-full" />
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">{talk.caller}</h1>
          <p className="mt-2 text-lg text-neutral-300">{talk.calling}</p>
          <p className="mt-6 max-w-xs text-base text-amber-200/90" dir="auto">
            {briefCount > 0 ? fill(talk.teaser, { count: briefCount }) : talk.teaserNone}
          </p>
        </div>
        <div className="flex w-full max-w-xs items-start justify-between">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => start(declined(world), false)}
              className="grid h-16 w-16 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/50 transition active:scale-95"
              aria-label={talk.decline}
              data-testid="donna-talk-decline"
            >
              <Icon d={HANDSET} className="h-7 w-7 rotate-[135deg]" />
            </button>
            <span className="text-sm text-neutral-300">{talk.decline}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="relative grid h-16 w-16 place-items-center">
              {/* The ring pulses; the button itself stays still so a thumb can hit it. */}
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-emerald-400/40 motion-safe:animate-ping" />
              <button
                type="button"
                autoFocus
                onClick={() => start(opening(world), true)}
                className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/50 transition active:scale-95"
                aria-label={talk.answer}
                data-testid="donna-talk-answer"
              >
                <Icon d={HANDSET} className="h-7 w-7" />
              </button>
            </span>
            <span className="text-sm text-neutral-300">{talk.answer}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[radial-gradient(ellipse_at_top,_#1c0a0d_0%,_#070506_50%,_#040404_100%)] text-neutral-100" data-testid="donna-talk" dir={dict.dir}>
      <header className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <Link href="/app-studio/donna" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-neutral-400 hover:text-neutral-100">
          <span aria-hidden="true" className="inline-block rtl:rotate-180">‹</span> {talk.back}
        </Link>
        <div className="flex items-center gap-2" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${voice.listening ? "bg-emerald-400 motion-safe:animate-pulse" : voice.speaking ? "bg-amber-400 motion-safe:animate-pulse" : "bg-neutral-600"}`} />
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">{talk.caller}</span>
          <span className="text-xs text-neutral-500" data-testid="donna-talk-status">{status}</span>
        </div>
        <div className="flex items-center gap-1">
          <LangToggle locale={locale} setLocale={setLocale} />
          <button
            type="button"
            onClick={() => {
              if (!muted) voice.hush();
              setMuted(!muted);
            }}
            aria-pressed={muted}
            aria-label={muted ? talk.unmute : talk.mute}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-neutral-400 hover:text-neutral-100"
            data-testid="donna-talk-mute"
          >
            <Icon d={muted ? SPEAKER_OFF : SPEAKER} className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex shrink-0 flex-col items-center px-4 pt-1 md:flex-1 md:justify-center md:pt-4" aria-label={talk.radarTitle}>
          <div className="w-full max-w-[min(100%,34vh)] md:max-w-[min(100%,64vh)]">
            <BookRadar
              entries={book}
              name={v.name}
              label={(entry) =>
                [fill(talk.radarLabel, { client: v.name(entry.clientId), heat: talk.heat[entry.heat] }), entry.days !== null ? fill(talk.radarDays, { days: entry.days }) : "", entry.overdue > 0 ? talk.owedBadge : ""]
                  .filter(Boolean)
                  .join(" · ")
              }
              title={`${talk.radarTitle}. ${talk.radarHint}`}
              focus={conv.focus}
              onPick={(clientId) => handle(fill(talk.askAbout, { client: v.name(clientId) }))}
              activity={activity}
              mood={mood}
              pulse={voice.pulse}
            />
          </div>
          <p className="mt-1 line-clamp-2 min-h-[2.75rem] max-w-xl text-center text-[15px] leading-relaxed text-neutral-100 md:line-clamp-3 md:text-lg" dir="auto" aria-live="polite" data-testid="donna-talk-caption">
            <Bidi text={caption} />
          </p>
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2 md:max-w-md md:flex-none md:basis-[28rem] md:border-s md:border-white/5" aria-label={talk.title} data-testid="donna-talk-log">
          <ol className="space-y-3">
            {entries.map((entry) =>
              entry.who === "you" ? (
                <li
                  key={entry.id}
                  ref={entry.id === anchor ? anchorRef : undefined}
                  className="ms-auto max-w-[85%] scroll-mt-2 rounded-2xl rounded-ee-sm bg-white/10 px-4 py-2 text-[15px] text-neutral-100"
                  dir="auto"
                  data-testid="donna-talk-entry"
                  data-who="you"
                >
                  {entry.text}
                </li>
              ) : (
                <DonnaEntry key={entry.id} entry={entry} v={voices[entry.lang]} world={world} book={book} hasQuestion={(id) => inbox.unresolved.some((q) => q.clientId === id)} onAnswer={(text) => handle(text)} />
              ),
            )}
          </ol>
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/40 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2 backdrop-blur">
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handle(talk.chipText[chip])}
              className="min-h-10 shrink-0 rounded-full border border-amber-700/40 bg-amber-950/30 px-3 text-sm text-amber-100 transition hover:bg-amber-900/40 active:scale-95"
              data-testid="donna-talk-chip"
            >
              {talk.chips[chip]}
            </button>
          ))}
        </div>
        <form className="flex items-center gap-2" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={talk.placeholder}
            aria-label={talk.placeholder}
            className="min-h-12 min-w-0 flex-1 rounded-full border border-neutral-800 bg-neutral-950 px-4 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
            dir="auto"
            enterKeyHint="send"
            data-testid="donna-talk-input"
          />
          <button type="submit" className="min-h-12 shrink-0 rounded-full border border-neutral-700 px-4 text-sm font-semibold text-neutral-100 transition hover:bg-neutral-800 active:scale-95" data-testid="donna-talk-ask">
            {talk.ask}
          </button>
          {voice.canListen ? (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stopListening() : startListening())}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? talk.micStop : voice.speaking ? talk.hush : talk.mic}
              className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-lg transition active:scale-95 ${
                voice.listening ? "bg-emerald-500 shadow-emerald-900/60" : "bg-gradient-to-br from-amber-500 to-rose-700 shadow-rose-900/50"
              }`}
              data-testid="donna-talk-mic"
            >
              {voice.listening ? <span className="absolute inset-0 rounded-full border-2 border-emerald-300 motion-safe:animate-ping" /> : null}
              <Icon d={MIC} className="h-7 w-7" />
            </button>
          ) : null}
        </form>
        <p className="mt-2 text-[11px] leading-snug text-neutral-500" dir="auto" data-testid="donna-talk-note">
          {[earNote, !voice.canListen ? talk.noEar : null, !voice.canSpeak ? talk.noVoice : null, voice.silentIn ? fill(talk.noLangVoice, { language: talk.languages[voice.silentIn] }) : null, talk.voiceNote]
            .filter(Boolean)
            .join(" ")}
          {voice.canListen ? <span className="hidden md:inline"> {talk.shortcuts}</span> : null}
        </p>
      </footer>
    </div>
  );
}

function DonnaEntry({
  entry,
  v,
  world,
  book,
  hasQuestion,
  onAnswer,
}: {
  entry: Extract<Entry, { who: "donna" }>;
  v: Voice;
  world: World;
  book: readonly BookEntry[];
  hasQuestion: (clientId: string) => boolean;
  onAnswer: (text: string) => void;
}) {
  const lines = replyLines(entry.reply, v, entry.proposal);
  const card = entry.reply.card;
  return (
    <li className={`max-w-[95%] rounded-2xl rounded-ss-sm border px-4 py-3 ${MOOD_TONE[entry.reply.mood]}`} dir={DICTS[entry.lang].dir} lang={entry.lang} data-testid="donna-talk-entry" data-who="donna" data-mood={entry.reply.mood}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-300/80">{v.copy.talk.her}</p>
      <div className="mt-1 space-y-1 text-[15px] leading-relaxed text-neutral-100">
        {lines.map((line, i) => (
          <p key={i}>
            <Bidi text={line} />
          </p>
        ))}
      </div>
      {card?.kind === "BRIEF" ? <BriefCard v={v} world={world} /> : null}
      {card?.kind === "DOSSIER" ? <DossierCard clientId={card.clientId} v={v} world={world} entry={book.find((b) => b.clientId === card.clientId)} /> : null}
      {card?.kind === "PROPOSAL" && entry.proposal ? <ProposalCard entry={entry} proposal={entry.proposal} v={v} engine={hasQuestion(entry.proposal.clientId)} onAnswer={onAnswer} /> : null}
    </li>
  );
}

function BriefCard({ v, world }: { v: Voice; world: World }) {
  const brief = buildMorningBrief(world.state, world.profiles, world.now);
  return (
    <ol className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-sm" data-testid="donna-talk-brief">
      {brief.lines.map((line, i) => (
        <li key={`${line.kind}-${line.clientId}-${i}`} className="flex gap-2">
          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${line.kind === "HOLD_OFF" ? "bg-rose-900/60 text-rose-100" : "bg-white/10 text-amber-100"}`}>
            {v.copy.brief.priority[line.kind]}
          </span>
          <span className="text-neutral-200">
            <Bidi text={lineText(line, v.copy.brief, v.name(line.clientId), v.offset)} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function DossierCard({ clientId, v, world, entry }: { clientId: string; v: Voice; world: World; entry: BookEntry | undefined }) {
  const profile: ClientProfile | undefined = world.profiles.find((p) => p.clientId === clientId);
  if (!profile || !entry) return null;
  const t = v.copy.talk;
  const open = profile.promises.filter((p) => !p.done);
  const told = new Map((profile.told ?? []).map((f) => [f.topic, f]));
  const wants = wantsText(profile.wants, v.copy.brief);
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm" data-testid="donna-talk-dossier" data-client={clientId}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-neutral-50">{v.name(clientId)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEAT_CHIP[entry.heat]}`}>{t.heat[entry.heat]}</span>
      </div>
      <dl className="mt-2 space-y-1.5 text-neutral-300">
        {wants ? (
          <div>
            <dt className="inline font-medium text-neutral-400">{t.dossier.wants}: </dt>
            <dd className="inline">
              <Bidi text={wants} />
            </dd>
          </div>
        ) : null}
        {profile.personal ? (
          <div>
            <dt className="inline font-medium text-neutral-400">{t.dossier.personal}: </dt>
            <dd className="inline">
              <bdi>{profile.personal}</bdi>
            </dd>
          </div>
        ) : null}
        {open.map((p) => {
          const late = daysBetween(p.due, v.today);
          return (
            <div key={p.id} className={late > 0 ? "text-rose-200" : ""}>
              <dt className="inline font-medium text-neutral-400">{t.dossier.owe}: </dt>
              <dd className="inline">
                <bdi>{p.text}</bdi> · <bdi dir="ltr">{p.due}</bdi>
              </dd>
            </div>
          );
        })}
        {told.size > 0 ? (
          <div>
            <dt className="inline font-medium text-neutral-400">{t.dossier.told}: </dt>
            <dd className="inline">
              <Bidi text={[...told.values()].map((f) => factText(f, v)).join(" · ")} />
            </dd>
          </div>
        ) : null}
        {entry.hold ? null : <div className="text-xs text-amber-200/80">{t.dossier.turn[profile.turn]}</div>}
        {!wants && !profile.personal && open.length === 0 && told.size === 0 ? <div className="text-neutral-500">{t.dossier.none}</div> : null}
      </dl>
    </div>
  );
}

function ProposalCard({
  entry,
  proposal,
  v,
  engine,
  onAnswer,
}: {
  entry: Extract<Entry, { who: "donna" }>;
  proposal: DebriefProposal;
  v: Voice;
  engine: boolean;
  onAnswer: (text: string) => void;
}) {
  const t = v.copy.talk;
  const hasOutcome = proposal.items.some((i) => i.kind === "OUTCOME");
  return (
    <div className="mt-3 rounded-xl border border-amber-600/40 bg-black/40 p-3 text-sm" data-testid="donna-talk-proposal" data-state={entry.state ?? ""}>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t.proposal.title}</p>
      <ul className="mt-2 space-y-1.5 text-neutral-200">
        {proposal.items.map((item, i) => (
          <li key={i} className={`flex gap-2 ${item.kind === "HOLD" ? "text-rose-200" : ""}`}>
            <span aria-hidden="true" className="text-amber-400">•</span>
            <span>
              <Bidi text={heardText(item, v)} />
            </span>
          </li>
        ))}
        {proposal.conflicts.map((c, i) => (
          <li key={`c-${i}`} className="flex gap-2 text-rose-200" data-testid="donna-talk-conflict">
            <span aria-hidden="true">!</span>
            <span>
              <Bidi text={`${factText(c.now, v)} ≠ ${factText(c.before, v)}`} />
            </span>
          </li>
        ))}
      </ul>
      {entry.state === "open" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onAnswer(t.fileText)} className="min-h-11 rounded-lg border border-amber-500 bg-amber-700 px-4 font-semibold text-white transition hover:bg-amber-600 active:scale-95" data-testid="donna-talk-file">
            {t.proposal.file}
          </button>
          <button type="button" onClick={() => onAnswer(t.discardText)} className="min-h-11 rounded-lg border border-neutral-700 px-4 text-neutral-200 transition hover:bg-neutral-800 active:scale-95" data-testid="donna-talk-discard">
            {t.proposal.discard}
          </button>
        </div>
      ) : entry.state === "filed" || entry.state === "discarded" ? (
        <p className={`mt-3 text-xs font-semibold ${entry.state === "filed" ? "text-emerald-300" : "text-neutral-500"}`}>{entry.state === "filed" ? t.proposal.filed : t.proposal.discarded}</p>
      ) : null}
      <p className="mt-2 text-[11px] text-neutral-500">{[engine && hasOutcome ? t.proposal.engine : null, t.proposal.local].filter(Boolean).join(" ")}</p>
    </div>
  );
}
