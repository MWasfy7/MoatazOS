"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  createEchoRuntime,
  type EchoInputMode,
  type EchoResult,
} from "@/lib/echo";

interface DisplayTurn {
  id: string;
  role: "USER" | "ECHO";
  text: string;
  result?: EchoResult;
}

const STARTER: DisplayTurn = {
  id: "welcome",
  role: "ECHO",
  text: "I’m ECHO’s local conversation runtime. Tell me what you’re thinking about, correct me naturally, or continue a thread. I won’t take external action.",
};

export function EchoConversation() {
  const runtime = useRef(createEchoRuntime());
  const [ready, setReady] = useState(false);
  const [inputMode, setInputMode] = useState<EchoInputMode>("TEXT");
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<DisplayTurn[]>([STARTER]);

  useEffect(() => setReady(true), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const submitted = text;
    if (!submitted.trim()) return;
    const result = runtime.current.process({
      text: submitted,
      inputMode,
      timestamp: new Date().toISOString(),
      session: { id: "echo-browser-session" },
    });
    const sequence = turns.length;
    setTurns((current) => [
      ...current,
      { id: `user-${sequence}`, role: "USER", text: submitted },
      { id: `echo-${sequence}`, role: "ECHO", text: result.response, result },
    ]);
    setText("");
  };

  return (
    <main
      className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-100"
      data-runtime-ready={ready ? "true" : "false"}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 shadow-2xl shadow-black/20">
        <header className="border-b border-neutral-800 px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">MoatazOS</p>
              <h1 className="mt-1 text-2xl font-semibold">ECHO</h1>
              <p className="mt-1 text-sm text-neutral-400">Local conversation · proposal only · no external effects</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              Input
              <select
                aria-label="Input mode"
                value={inputMode}
                onChange={(event) => setInputMode(event.target.value as EchoInputMode)}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              >
                <option value="TEXT">Text</option>
                <option value="VOICE_TRANSCRIPT">Voice transcript</option>
              </select>
            </label>
          </div>
        </header>

        <section aria-label="Conversation" className="flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-7">
          {turns.map((turn) => (
            <article
              key={turn.id}
              className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                turn.role === "USER"
                  ? "ms-auto bg-sky-500 text-neutral-950"
                  : "border border-neutral-800 bg-neutral-950 text-neutral-100"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{turn.text}</p>
              {turn.result ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-neutral-400">
                  <span>{turn.result.resolvedIntent.kind}</span>
                  <span>·</span>
                  <span>{turn.result.confidence}</span>
                  <span>·</span>
                  <span>{turn.result.destination}</span>
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <form onSubmit={submit} className="border-t border-neutral-800 p-4 sm:p-6">
          <label htmlFor="echo-input" className="mb-2 block text-sm font-medium text-neutral-300">
            {inputMode === "VOICE_TRANSCRIPT" ? "Paste or type a voice transcript" : "Message ECHO"}
          </label>
          <div className="flex gap-3">
            <textarea
              id="echo-input"
              disabled={!ready}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={2}
              placeholder={inputMode === "VOICE_TRANSCRIPT" ? "uh… yalla kammel from where we stopped" : "Continue with the ECHO runtime"}
              className="min-h-12 flex-1 resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600"
            />
            <button
              type="submit"
              disabled={!ready}
              className="self-end rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-sky-300 disabled:cursor-wait disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Voice mode accepts an existing transcript. No microphone or external service is connected.
          </p>
        </form>
      </div>
    </main>
  );
}
