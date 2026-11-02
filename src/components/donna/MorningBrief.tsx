"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMorningBrief, type BriefLine } from "@/lib/donna";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Bidi } from "./Bidi";
import { fill, lineText } from "./briefText";
import { useDonna } from "./DonnaProvider";
import { BUTTON, PRIMARY } from "./ui";

export { lineText };

const TONE: Record<BriefLine["kind"], string> = {
  HOLD_OFF: "border-rose-700 bg-rose-950/40",
  PROMISE_OVERDUE: "border-amber-600 bg-amber-950/30",
  PROMISE_TODAY: "border-amber-800",
  OUTCOME_MISSING: "border-amber-800",
  GOING_COLD: "border-sky-800",
  CALL_TODAY: "border-neutral-700",
  MISSING_INFO: "border-neutral-800",
};

/** Speaks through the browser's own speech synthesis: no dependency, no network call from this code. */
function useSpeech() {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  const speak = (text: string, lang: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.02;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };
  return { supported, speaking, speak, stop };
}

/**
 * Donna's morning brief: she talks first. Restraint lines lead, then promises, missing outcomes,
 * cold leads, today's calls, and one gap question per client. It tells; it never acts.
 */
export function MorningBrief() {
  const { dict, locale } = useLocale();
  const { state, now, clientLabel, profiles } = useDonna();
  const copy = dict.donna.brief;
  const offset = state.policy.utcOffsetMinutes;
  const brief = useMemo(() => buildMorningBrief(state, profiles, now), [state, profiles, now]);
  const { supported, speaking, speak, stop } = useSpeech();

  const texts = brief.lines.map((line) => lineText(line, copy, clientLabel(line.clientId), offset));
  const greeting = brief.lines.length ? fill(copy.greeting, { count: brief.lines.length }) : copy.greetingNone;

  return (
    <section
      aria-labelledby="donna-brief-title"
      className="space-y-4 rounded-2xl border border-amber-700/60 bg-gradient-to-b from-amber-950/40 to-neutral-950 p-5"
      data-testid="donna-morning-brief"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">{copy.subtitle}</p>
          <h2 id="donna-brief-title" className="text-2xl font-semibold text-neutral-50">{copy.title}</h2>
        </div>
        {supported ? (
          <button
            type="button"
            className={speaking ? BUTTON : PRIMARY}
            aria-pressed={speaking}
            onClick={() => (speaking ? stop() : speak([greeting, ...texts].join(" "), locale === "ar" ? "ar-EG" : "en-US"))}
            data-testid="donna-brief-listen"
          >
            {speaking ? copy.stop : `▶ ${copy.listen}`}
          </button>
        ) : (
          <p className="text-xs text-neutral-400" dir="auto">{copy.noVoice}</p>
        )}
      </div>

      <p className="text-lg text-neutral-100" dir="auto" data-testid="donna-brief-greeting">{greeting}</p>

      <ol className="space-y-2">
        {brief.lines.map((line, index) => (
          <li
            key={`${line.kind}-${line.clientId}-${index}`}
            className={`rounded-xl border p-3 ${TONE[line.kind]}`}
            data-testid="donna-brief-line"
            data-kind={line.kind}
            data-client={line.clientId}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200" dir="auto">{copy.priority[line.kind]}</p>
            <p className="text-base leading-7 text-neutral-100" dir="auto"><Bidi text={texts[index] ?? ""} /></p>
          </li>
        ))}
      </ol>

      <p className="text-xs text-neutral-500" dir="auto">{copy.footnote}</p>
    </section>
  );
}
