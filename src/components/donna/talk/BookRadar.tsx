"use client";

import type { MutableRefObject } from "react";
import type { BookEntry, Heat, Mood } from "@/lib/donna";
import { DonnaOrb, type OrbActivity } from "./DonnaOrb";

const HEAT_COLOR: Record<Heat, string> = {
  HOT: "#fb923c",
  WARM: "#fbbf24",
  COOLING: "#38bdf8",
  COLD: "#64748b",
  HELD: "#71717a",
};

/** Ring radii (percent of the half-width) the dots drift between: just spoke → drifted away. */
const INNER = 0.46;
const OUTER = 0.92;

/**
 * The operator's book around Donna. Each client is a dot: closer means a more recent real
 * conversation, colour is temperature, size is budget, a pulsing red ring is a late promise,
 * and grey with a slash means "leave alone". Tapping a dot asks Donna about that client.
 */
export function BookRadar({
  entries,
  name,
  label,
  title,
  focus,
  onPick,
  activity,
  mood,
  pulse,
}: {
  entries: readonly BookEntry[];
  name: (clientId: string) => string;
  label: (entry: BookEntry) => string;
  title: string;
  focus: string | null;
  onPick: (clientId: string) => void;
  activity: OrbActivity;
  mood: Mood;
  pulse: MutableRefObject<number>;
}) {
  const count = Math.max(1, entries.length);
  return (
    <div className="relative aspect-square w-full select-none" role="group" aria-label={title} data-testid="donna-radar">
      <DonnaOrb activity={activity} mood={mood} pulse={pulse} className="absolute inset-0 h-full w-full" />
      <svg viewBox="-100 -100 200 200" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {[INNER, 0.62, 0.77, OUTER].map((r) => (
          <circle key={r} r={r * 100} fill="none" stroke="rgba(251,191,36,0.12)" strokeWidth={0.5} strokeDasharray="1.5 3" />
        ))}
        <line x1={-OUTER * 100} y1={0} x2={-INNER * 100} y2={0} stroke="rgba(251,191,36,0.08)" strokeWidth={0.4} />
        <line x1={INNER * 100} y1={0} x2={OUTER * 100} y2={0} stroke="rgba(251,191,36,0.08)" strokeWidth={0.4} />
        <line x1={0} y1={-OUTER * 100} x2={0} y2={-INNER * 100} stroke="rgba(251,191,36,0.08)" strokeWidth={0.4} />
        <line x1={0} y1={INNER * 100} x2={0} y2={OUTER * 100} stroke="rgba(251,191,36,0.08)" strokeWidth={0.4} />
      </svg>
      {entries.map((entry, i) => {
        const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
        const radius = INNER + entry.drift * (OUTER - INNER);
        const left = 50 + Math.cos(angle) * radius * 50;
        const top = 50 + Math.sin(angle) * radius * 50;
        const size = 12 + (Math.min(entry.budget ? entry.budget / 1_000_000 : 2, 12) / 12) * 10;
        const color = HEAT_COLOR[entry.heat];
        const held = entry.heat === "HELD";
        return (
          <button
            key={entry.clientId}
            type="button"
            onClick={() => onPick(entry.clientId)}
            className="absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300"
            style={{ left: `${left}%`, top: `${top}%` }}
            aria-label={label(entry)}
            aria-pressed={focus === entry.clientId}
            data-testid="donna-radar-dot"
            data-client={entry.clientId}
            data-heat={entry.heat}
          >
            <span
              className={`relative block rounded-full ${focus === entry.clientId ? "ring-2 ring-white/80 ring-offset-2 ring-offset-black" : ""}`}
              style={{ width: size, height: size, background: held ? "transparent" : color, border: held ? `2px dashed ${color}` : "none", boxShadow: held ? "none" : `0 0 ${8 + size / 2}px ${color}` }}
            >
              {entry.overdue > 0 ? <span className="absolute -inset-1.5 rounded-full border-2 border-rose-500 motion-safe:animate-ping" /> : null}
              {held ? <span className="absolute left-1/2 top-1/2 h-[140%] w-[2px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded bg-zinc-400" /> : null}
            </span>
            <span className={`text-[11px] font-semibold leading-none ${held ? "text-zinc-500" : "text-neutral-100"}`}>{name(entry.clientId)}</span>
          </button>
        );
      })}
    </div>
  );
}
