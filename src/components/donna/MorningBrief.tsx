"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMorningBrief, createDemoProfiles, DEMO_NOW, formatLocal, type BriefLine, type ClientWants } from "@/lib/donna";
import type { Dictionary } from "@/lib/i18n/en";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDonna } from "./DonnaProvider";
import { BUTTON, PRIMARY } from "./ui";

type Copy = Dictionary["donna"]["brief"];

/** Keeps the operator's own words (often another language) in one piece inside RTL or LTR text. */
const isolate = (text: string) => `⁨"${text}"⁩`;

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

function wantsText(wants: ClientWants, copy: Copy): string {
  const parts = [
    wants.unit,
    wants.area ? fill(copy.parts.area, { v: wants.area }) : null,
    wants.budget ? fill(copy.parts.budget, { v: wants.budget }) : null,
    wants.payment ? copy.parts[wants.payment] : null,
    wants.purpose ? copy.parts[wants.purpose] : null,
  ].filter(Boolean);
  return parts.length ? fill(copy.wants, { parts: parts.join(", ") }) : "";
}

export function lineText(line: BriefLine, copy: Copy, client: string, offset: number): string {
  switch (line.kind) {
    case "HOLD_OFF":
      return fill(line.reason === "ASKED_FOR_SPACE" ? copy.lines.HOLD_OFF_ASKED_FOR_SPACE : copy.lines.HOLD_OFF_UNANSWERED, { client, count: line.count });
    case "PROMISE_OVERDUE":
      return fill(copy.lines.PROMISE_OVERDUE, { client, text: isolate(line.text), days: line.days });
    case "PROMISE_TODAY":
      return fill(copy.lines.PROMISE_TODAY, { client, text: isolate(line.text) });
    case "OUTCOME_MISSING":
      return fill(copy.lines.OUTCOME_MISSING, { client });
    case "GOING_COLD":
      return fill(copy.lines.GOING_COLD, { client, days: line.days });
    case "CALL_TODAY":
      return [
        fill(copy.lines.CALL_TODAY, { client, time: formatLocal(line.at, offset).slice(-5) }),
        wantsText(line.wants, copy),
        line.openPromise ? fill(copy.bringUp, { text: isolate(line.openPromise) }) : "",
      ]
        .filter(Boolean)
        .join(" ");
    case "MISSING_INFO":
      return fill(copy.lines.MISSING_INFO, { client, field: copy.fields[line.field] });
  }
}

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
  const { state, now, clientLabel } = useDonna();
  const copy = dict.donna.brief;
  const offset = state.policy.utcOffsetMinutes;
  const profiles = useMemo(() => createDemoProfiles(DEMO_NOW), []);
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
            <p className="text-base leading-7 text-neutral-100" dir="auto">{texts[index]}</p>
          </li>
        ))}
      </ol>

      <p className="text-xs text-neutral-500" dir="auto">{copy.footnote}</p>
    </section>
  );
}
