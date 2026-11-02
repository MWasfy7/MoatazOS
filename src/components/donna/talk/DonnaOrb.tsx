"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { Mood } from "@/lib/donna";

export type OrbActivity = "idle" | "listening" | "speaking" | "ringing";

type Rgb = [number, number, number];
interface Palette {
  core: Rgb;
  mid: Rgb;
  rim: Rgb;
  glow: Rgb;
}

/** Donna's colours: copper and crimson at rest, amber when she warns, red when she says stop, gold when pleased. */
const PALETTES: Record<Mood, Palette> = {
  CALM: { core: [255, 222, 186], mid: [249, 115, 22], rim: [190, 18, 60], glow: [234, 88, 12] },
  WARN: { core: [255, 238, 190], mid: [245, 158, 11], rim: [180, 83, 9], glow: [245, 158, 11] },
  STOP: { core: [255, 210, 210], mid: [239, 68, 68], rim: [127, 29, 29], glow: [220, 38, 38] },
  PLEASED: { core: [255, 246, 205], mid: [250, 204, 21], rim: [161, 98, 7], glow: [234, 179, 8] },
};

const rgba = (c: Rgb, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const copyPalette = (p: Palette): Palette => ({ core: [...p.core], mid: [...p.mid], rim: [...p.rim], glow: [...p.glow] });

// Fixed (not random) particle layout: the orb looks the same on every load.
const PARTICLES = Array.from({ length: 64 }, (_, i) => ({
  angle: (((i * 137.508) % 360) * Math.PI) / 180,
  radius: 1.2 + ((i * 53) % 40) / 100,
  speed: 0.05 + ((i * 29) % 13) / 100,
  depth: ((i * 71) % 10) / 10,
}));

/**
 * Donna's presence: a living orb drawn on a canvas. It breathes when idle, leans in when she
 * listens and ripples with each word she speaks (`pulse` is bumped by the speech engine).
 * Purely visual; it reads nothing and stores nothing.
 */
export function DonnaOrb({
  activity,
  mood,
  pulse,
  scale = 0.12,
  className = "",
}: {
  activity: OrbActivity;
  mood: Mood;
  pulse?: MutableRefObject<number>;
  /** Core radius as a fraction of the canvas's smaller side. */
  scale?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ activity, mood });
  live.current = { activity, mood };
  const redraw = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas && typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    if (!canvas || !ctx) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    const color = copyPalette(PALETTES[live.current.mood]);
    let energy = 0.2;
    let kick = 0;
    let seenPulse = pulse?.current ?? 0;
    const started = performance.now();

    const draw = (time: number) => {
      const t = (time - started) / 1000;
      const { activity: act, mood: md } = live.current;
      const p = pulse?.current ?? 0;
      if (p !== seenPulse) {
        kick = Math.min(1.4, kick + 0.3 * Math.min(3, p - seenPulse));
        seenPulse = p;
      }
      kick *= 0.9;
      const ringing = act === "ringing" ? 0.3 + 0.3 * Math.max(0, Math.sin(t * 7)) : 0;
      const base = act === "speaking" ? 0.55 : act === "listening" ? 0.42 : act === "ringing" ? ringing : 0.18;
      energy += (base + kick * 0.45 - energy) * (reduced ? 1 : 0.08);
      const target = PALETTES[md];
      for (const key of ["core", "mid", "rim", "glow"] as const) {
        for (let i = 0; i < 3; i += 1) color[key][i] = (color[key][i] as number) + ((target[key][i] as number) - (color[key][i] as number)) * (reduced ? 1 : 0.06);
      }

      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) * scale;
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.3);
      glow.addColorStop(0, rgba(color.glow, 0.32 + energy * 0.35));
      glow.addColorStop(0.45, rgba(color.glow, 0.1 + energy * 0.12));
      glow.addColorStop(1, rgba(color.glow, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Instrument ring: ticks and three arcs turning against each other.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);
      ctx.strokeStyle = rgba(color.mid, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.72, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 72; i += 1) {
        const a = (i / 72) * Math.PI * 2;
        const outer = R * (i % 6 === 0 ? 1.82 : 1.77);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 1.72, Math.sin(a) * R * 1.72);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
      ctx.rotate(-t * 0.22);
      ctx.strokeStyle = rgba(color.rim, 0.6);
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.52, k * 2.1, k * 2.1 + 0.8 + energy * 0.7);
        ctx.stroke();
      }
      ctx.restore();

      // Filaments: closed rings that ripple harder while she talks.
      for (let ring = 0; ring < 4; ring += 1) {
        const amp = (0.05 + energy * 0.17) * (1 - ring * 0.15);
        const freq = 3 + ring * 2;
        const speed = (ring % 2 ? -1 : 1) * (0.4 + ring * 0.15) * (act === "speaking" ? 2.2 : 1);
        ctx.beginPath();
        for (let i = 0; i <= 120; i += 1) {
          const a = (i / 120) * Math.PI * 2;
          const wobble = Math.sin(a * freq + t * speed) * amp + Math.sin(a * (freq + 3) - t * speed * 1.3) * amp * 0.5;
          const r = R * (0.92 + ring * 0.07) * (1 + wobble);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = rgba(ring % 2 ? color.rim : color.mid, 0.35 + energy * 0.4 - ring * 0.05);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      const coreR = R * (0.62 + 0.04 * Math.sin(t * 1.6) + energy * 0.12);
      const core = ctx.createRadialGradient(cx - coreR * 0.25, cy - coreR * 0.3, coreR * 0.05, cx, cy, coreR);
      core.addColorStop(0, rgba(color.core, 0.95));
      core.addColorStop(0.5, rgba(color.mid, 0.75));
      core.addColorStop(1, rgba(color.rim, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      for (const particle of PARTICLES) {
        const a = particle.angle + t * particle.speed * (act === "speaking" ? 2.5 : 1);
        const r = R * (particle.radius + Math.sin(t * 0.7 + particle.depth * 6) * 0.04 + energy * 0.12);
        ctx.fillStyle = rgba(color.core, 0.2 + 0.55 * energy * (0.5 + particle.depth / 2));
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92, 0.8 + particle.depth * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (time: number) => {
      draw(time);
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    redraw.current = () => {
      if (reduced) draw(performance.now());
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      redraw.current = null;
    };
  }, [pulse, scale]);

  useEffect(() => {
    redraw.current?.();
  }, [activity, mood]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} data-testid="donna-orb" data-activity={activity} data-mood={mood} />;
}
