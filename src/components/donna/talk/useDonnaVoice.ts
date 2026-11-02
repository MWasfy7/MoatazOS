"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickVoice } from "@/lib/donna";

/** Minimal shape of the browser's speech recognition (not in the TypeScript DOM lib). */
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0?: { readonly transcript: string };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const synthesis = () => (typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined" ? window.speechSynthesis : null);

export type EarProblem = "denied" | "no_speech" | "failed";
export type Lang = "en" | "ar";

/**
 * Donna's mouth and ears, using only what the browser already has (speech synthesis and
 * speech recognition). This code makes no network call and stores nothing; the browser's own
 * speech services may, which the screen says. `pulse` ticks on every word, for the orb.
 */
export function useDonnaVoice() {
  const [canSpeak, setCanSpeak] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<EarProblem | null>(null);
  /** A reply language this device has no voice for (she writes instead). */
  const [silentIn, setSilentIn] = useState<Lang | null>(null);
  /** Index of the sentence being spoken right now. */
  const [line, setLine] = useState(0);
  const pulse = useRef(0);
  const generation = useRef(0);
  const ear = useRef<Recognition | null>(null);

  useEffect(() => {
    const synth = synthesis();
    setCanSpeak(synth !== null);
    setCanListen(recognitionCtor() !== null);
    synth?.getVoices(); // some browsers load voices lazily; asking once starts that
    return () => {
      generation.current += 1;
      synth?.cancel();
      const r = ear.current;
      ear.current = null;
      if (r) (r.abort ?? r.stop).call(r);
    };
  }, []);

  const hush = useCallback(() => {
    generation.current += 1;
    synthesis()?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((lines: readonly string[], lang: Lang, onDone?: () => void) => {
    const synth = synthesis();
    if (!synth || lines.length === 0) {
      onDone?.();
      return;
    }
    generation.current += 1;
    const gen = generation.current;
    synth.cancel();
    const voices = synth.getVoices();
    const voice = pickVoice(voices, lang);
    if (voices.length > 0 && !voice) {
      setSilentIn(lang);
      setSpeaking(false);
      onDone?.();
      return;
    }
    setSilentIn(null);
    setLine(0);
    setSpeaking(true);
    lines.forEach((text, i) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "ar" ? "ar-EG" : "en-US";
      if (voice) utterance.voice = voice;
      utterance.rate = 1.02;
      utterance.onstart = () => {
        pulse.current += 2;
        if (gen === generation.current) setLine(i);
      };
      utterance.onboundary = () => {
        pulse.current += 1;
      };
      if (i === lines.length - 1) {
        const finish = () => {
          if (gen !== generation.current) return;
          setSpeaking(false);
          onDone?.();
        };
        utterance.onend = finish;
        utterance.onerror = finish;
      }
      synth.speak(utterance);
    });
  }, []);

  const stopListening = useCallback(() => {
    ear.current?.stop();
  }, []);

  /** Listens for one utterance. Returns false when listening could not start. */
  const listen = useCallback((lang: Lang, onFinal: (text: string) => void): boolean => {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    const previous = ear.current;
    if (previous) (previous.abort ?? previous.stop).call(previous);
    const r = new Ctor();
    r.lang = lang === "ar" ? "ar-EG" : "en-US";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    let lastHeard = "";
    let failed = false;
    r.onresult = (event) => {
      let pending = "";
      finalText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText += text;
        else pending += text;
      }
      lastHeard = `${finalText} ${pending}`.trim();
      pulse.current += 1;
      setInterim(lastHeard);
    };
    r.onerror = (event) => {
      if (event.error === "aborted") return;
      failed = true;
      setProblem(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "no-speech" ? "no_speech" : "failed");
    };
    r.onend = () => {
      if (ear.current === r) ear.current = null;
      setListening(false);
      setInterim("");
      const text = (finalText || lastHeard).trim();
      if (text) onFinal(text);
      else if (!failed) setProblem("no_speech");
    };
    ear.current = r;
    try {
      r.start();
      setProblem(null);
      setListening(true);
      return true;
    } catch {
      ear.current = null;
      setProblem("failed");
      return false;
    }
  }, []);

  return { canSpeak, canListen, speaking, listening, interim, problem, silentIn, line, pulse, speak, hush, listen, stopListening };
}
