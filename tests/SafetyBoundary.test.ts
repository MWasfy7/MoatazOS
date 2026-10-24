/**
 * Repository-wide safety boundary.
 *
 * MoatazOS is execution-free: nothing under src/ may reach a network,
 * persist to the browser, spawn processes, contact a buyer, or expose a
 * server endpoint. Component tests prove individual surfaces render no
 * execution control; this test proves no source file acquires the
 * capability in the first place.
 *
 * Do not weaken, skip, or allowlist entries in this file without explicit
 * owner approval recorded in the PR (see CLAUDE.md, "Protected invariants").
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const FORBIDDEN_SOURCE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["network: fetch", /\bfetch\s*\(/],
  ["network: XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["network: WebSocket", /\bnew\s+WebSocket\b/],
  ["network: EventSource", /\bEventSource\b/],
  ["network: sendBeacon", /\bsendBeacon\b/],
  ["network: absolute URL", /https?:\/\//],
  ["persistence: localStorage", /\blocalStorage\b/],
  ["persistence: sessionStorage", /\bsessionStorage\b/],
  ["persistence: indexedDB", /\bindexedDB\b/],
  ["persistence: cookie", /document\.cookie/],
  ["process: child_process", /child_process/],
  ["server: server action", /["']use server["']/],
  ["server: environment access", /\bprocess\.env\b/],
  ["outbound contact: mailto", /mailto:/],
  ["outbound contact: tel", /\btel:/],
  ["outbound contact: WhatsApp link", /wa\.me|api\.whatsapp/],
  ["outbound: window.open", /window\.open\s*\(/],
];

const FORBIDDEN_FILE_PATTERNS: ReadonlyArray<[string, RegExp]> = [
  ["server: route handler", /(^|\/)route\.(t|j)sx?$/],
  ["server: middleware", /(^|\/)middleware\.(t|j)sx?$/],
  ["server: pages API", /(^|\/)pages\/api\//],
];

/** Runtime dependencies ship to users; adding one needs owner approval. */
const APPROVED_RUNTIME_DEPENDENCIES = ["@supabase/supabase-js", "next", "react", "react-dom"];

/**
 * DON-02 (owner-approved 2026-10-24, AGENTS.md invariant 8 amendment): the Donna
 * durable-store adapter is the ONLY code allowed to touch the environment and the
 * Supabase SDK. The exception is per file, per capability, and asserted not to grow:
 *  - config.ts may read exactly three NEXT_PUBLIC_DONNA_* names from process.env;
 *  - supabaseStore.ts may import the SDK (which keeps its own auth session) and
 *    nothing else here; it still may not call fetch, use browser storage, or read env.
 * Real client data stays prohibited; the adapter is for synthetic data until the
 * trial-readiness gate.
 */
const DONNA_ADAPTER_FILES = [
  "src/lib/donna/remote/config.ts",
  "src/lib/donna/remote/supabaseStore.ts",
] as const;
const DONNA_SDK_FILE = "src/lib/donna/remote/supabaseStore.ts";
const DONNA_ENV_FILE = "src/lib/donna/remote/config.ts";
const DONNA_ENV_NAMES = [
  "NEXT_PUBLIC_DONNA_SYNC",
  "NEXT_PUBLIC_DONNA_SUPABASE_URL",
  "NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY",
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(t|j)sx?$|\.mjs$/.test(entry.name) ? [full] : [];
  });
}

function findSourceViolations(relativePath: string, content: string): string[] {
  const violations: string[] = [];
  for (const [label, pattern] of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(relativePath)) violations.push(`${relativePath}: ${label}`);
  }
  content.split("\n").forEach((line, index) => {
    for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
      if (!pattern.test(line)) continue;
      if (label === "server: environment access" && relativePath === DONNA_ENV_FILE) {
        const refs = line.match(/process\.env(\.\w+)?/g) ?? [];
        if (refs.every((ref) => DONNA_ENV_NAMES.some((name) => ref === `process.env.${name}`))) continue;
      }
      violations.push(`${relativePath}:${index + 1}: ${label}`);
    }
  });
  return violations;
}

describe("repository safety boundary", () => {
  it("keeps every source file free of network, persistence, process, server, and outbound-contact capability", () => {
    const violations = sourceFiles(SRC).flatMap((file) =>
      findSourceViolations(path.relative(ROOT, file).split(path.sep).join("/"), fs.readFileSync(file, "utf8")),
    );
    expect(violations).toEqual([]);
  });

  it("ships only the approved runtime dependencies, with the Supabase SDK pinned exactly", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([...APPROVED_RUNTIME_DEPENDENCIES].sort());
    expect(pkg.dependencies?.["@supabase/supabase-js"]).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("confines the environment and the Supabase SDK to the two Donna adapter files (the exception does not grow)", () => {
    expect(DONNA_ADAPTER_FILES).toHaveLength(2);
    const files = sourceFiles(SRC).map((f) => path.relative(ROOT, f).split(path.sep).join("/"));
    for (const adapter of DONNA_ADAPTER_FILES) expect(files).toContain(adapter);
    const envUsers: string[] = [];
    const sdkUsers: string[] = [];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
      if (/process\.env/.test(content)) envUsers.push(rel);
      if (/@supabase\//.test(content)) sdkUsers.push(rel);
    }
    expect(envUsers).toEqual([DONNA_ENV_FILE]);
    expect(sdkUsers).toEqual([DONNA_SDK_FILE]);
    const envNames = [...fs.readFileSync(path.join(ROOT, DONNA_ENV_FILE), "utf8").matchAll(/process\.env\.(\w+)/g)].map((m) => m[1]);
    expect([...new Set(envNames)].sort()).toEqual([...DONNA_ENV_NAMES].sort());
  });

  it("detects each class of forbidden capability", () => {
    const samples: Array<[string, string]> = [
      ["src/lib/a.ts", "await fetch('/x')"],
      ["src/lib/b.ts", "window.localStorage.setItem('k', 'v')"],
      ["src/lib/c.ts", "import { spawn } from 'node:child_process'"],
      ["src/lib/d.ts", "'use server'"],
      ["src/lib/e.tsx", "<a href=\"https://wa.me/201000000000\">"],
      ["src/app/api/send/route.ts", "export const x = 1"],
    ];
    for (const [file, line] of samples) {
      expect(findSourceViolations(file, line).length, `${file}: ${line}`).toBeGreaterThan(0);
    }
    expect(findSourceViolations("src/lib/ok.ts", "const sent = false; // no network")).toEqual([]);
    // The Donna env exception is exact: other names, other files, and other capabilities still fail.
    expect(findSourceViolations(DONNA_ENV_FILE, "const a = process.env.NEXT_PUBLIC_DONNA_SYNC;")).toEqual([]);
    expect(findSourceViolations(DONNA_ENV_FILE, "const a = process.env.SUPABASE_SERVICE_ROLE_KEY;").length).toBeGreaterThan(0);
    expect(findSourceViolations(DONNA_ENV_FILE, "const a = process.env;").length).toBeGreaterThan(0);
    expect(findSourceViolations("src/lib/donna/other.ts", "const a = process.env.NEXT_PUBLIC_DONNA_SYNC;").length).toBeGreaterThan(0);
    expect(findSourceViolations(DONNA_SDK_FILE, "const a = process.env.NEXT_PUBLIC_DONNA_SYNC;").length).toBeGreaterThan(0);
    expect(findSourceViolations(DONNA_SDK_FILE, "await fetch('/x')").length).toBeGreaterThan(0);
    expect(findSourceViolations(DONNA_SDK_FILE, "window.localStorage.setItem('k', 'v')").length).toBeGreaterThan(0);
  });
});
