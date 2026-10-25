/**
 * The ONLY place Donna reads the environment (DON-02, owner-approved,
 * narrowly scoped). It reads three NEXT_PUBLIC_DONNA_* names and nothing else.
 * Sync stays OFF unless it is switched on AND fully, safely configured.
 */
export type SyncConfigIssue =
  | "MISSING_URL"
  | "MISSING_ANON_KEY"
  | "URL_NOT_SECURE"
  | "SECRET_KEY_IN_BROWSER_CONFIG";

export type SyncConfigResult =
  | { readonly mode: "OFF" }
  | { readonly mode: "MISCONFIGURED"; readonly issue: SyncConfigIssue }
  | { readonly mode: "ON"; readonly url: string; readonly anonKey: string };

export interface SyncEnv {
  readonly sync?: string;
  readonly url?: string;
  readonly anonKey?: string;
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** A service-role / secret key must never ship to a browser. */
export function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return false;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function evaluateSyncConfig(env: SyncEnv): SyncConfigResult {
  if (env.sync !== "on") return { mode: "OFF" };
  const url = (env.url ?? "").trim();
  const anonKey = (env.anonKey ?? "").trim();
  if (!url) return { mode: "MISCONFIGURED", issue: "MISSING_URL" };
  if (!anonKey) return { mode: "MISCONFIGURED", issue: "MISSING_ANON_KEY" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { mode: "MISCONFIGURED", issue: "URL_NOT_SECURE" };
  }
  const secure = parsed.protocol === "https:" || (parsed.protocol === "http:" && isLocalHost(parsed.hostname));
  if (!secure) return { mode: "MISCONFIGURED", issue: "URL_NOT_SECURE" };
  if (looksLikeSecretKey(anonKey)) return { mode: "MISCONFIGURED", issue: "SECRET_KEY_IN_BROWSER_CONFIG" };
  return { mode: "ON", url: parsed.origin, anonKey };
}

/** Next.js inlines these literal references at build time. */
export function readSyncConfig(): SyncConfigResult {
  return evaluateSyncConfig({
    sync: process.env.NEXT_PUBLIC_DONNA_SYNC,
    url: process.env.NEXT_PUBLIC_DONNA_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY,
  });
}
