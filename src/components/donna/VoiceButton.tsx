"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Minimal shape of the browser's speech recognition (not in the TypeScript DOM lib). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

export type VoiceState = "idle" | "listening" | "unsupported" | "denied" | "no_speech" | "network" | "failed";

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function classify(error: string): VoiceState {
  if (error === "not-allowed" || error === "service-not-allowed") return "denied";
  if (error === "no-speech" || error === "audio-capture") return "no_speech";
  if (error === "network") return "network";
  return "failed";
}

const BUTTON =
  "min-h-11 rounded-md border border-neutral-700 px-4 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Dictation into a text field. Uses the browser's built-in speech recognition;
 * the repository adds no dependency and makes no network call. NOTE: the
 * browser itself may send the audio to its vendor's speech service, so the UI
 * says so. Typing always works and is never blocked by a voice failure.
 */
export function VoiceButton({ onText, label }: { onText: (text: string) => void; label: string }) {
  const { dict, locale } = useLocale();
  const copy = dict.donna.voice;
  const [state, setState] = useState<VoiceState>("idle");
  const ref = useRef<Recognition | null>(null);
  const heard = useRef(false);
  const errored = useRef(false);

  useEffect(() => {
    if (!recognitionCtor()) setState("unsupported");
    return () => ref.current?.stop();
  }, []);

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return setState("unsupported");
    const rec = new Ctor();
    rec.lang = locale === "ar" ? "ar-EG" : "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    heard.current = false;
    errored.current = false;
    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) {
        heard.current = true;
        onText(text);
      }
    };
    rec.onerror = (event) => {
      errored.current = true;
      setState(classify(event.error));
    };
    rec.onend = () => {
      ref.current = null;
      if (errored.current) return;
      setState(heard.current ? "idle" : "no_speech");
    };
    ref.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      ref.current = null;
      setState("failed");
    }
  };

  if (state === "unsupported") {
    return (
      <p className="text-xs text-neutral-400" dir="auto" data-testid="donna-voice-status">
        {copy.unsupported}
      </p>
    );
  }
  const listening = state === "listening";
  const message = state === "idle" ? null : copy[state];
  return (
    <div className="space-y-1">
      <button
        type="button"
        className={`${BUTTON} ${listening ? "border-amber-500 bg-amber-900/40" : ""}`}
        aria-pressed={listening}
        onClick={() => (listening ? ref.current?.stop() : start())}
      >
        {listening ? copy.stop : `${copy.start} — ${label}`}
      </button>
      {message ? (
        <p role={listening ? "status" : "alert"} className="text-xs text-amber-300" dir="auto" data-testid="donna-voice-status">
          {message}
        </p>
      ) : (
        <p className="text-xs text-neutral-500" dir="auto">{copy.privacy}</p>
      )}
    </div>
  );
}
