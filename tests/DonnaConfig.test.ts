import { describe, expect, it } from "vitest";
import { evaluateSyncConfig, looksLikeSecretKey, readSyncConfig } from "@/lib/donna/remote/config";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
// Fabricated, unsigned fixtures only: never a real key.
const ANON_LIKE = `${b64({ alg: "none" })}.${b64({ role: "anon" })}.sig`;
const SERVICE_LIKE = `${b64({ alg: "none" })}.${b64({ role: "service_role" })}.sig`;

describe("Donna sync configuration (sync is OFF unless switched on and safely configured)", () => {
  it("is OFF by default in this repository's test environment", () => {
    expect(readSyncConfig()).toEqual({ mode: "OFF" });
  });

  it("stays OFF for anything but the exact value 'on', even when a URL and key exist", () => {
    for (const sync of [undefined, "", "off", "true", "1", "ON "]) {
      expect(evaluateSyncConfig({ sync, url: "https://x.example.test", anonKey: ANON_LIKE })).toEqual({ mode: "OFF" });
    }
  });

  it("is misconfigured, never silently on, when URL or key is missing", () => {
    expect(evaluateSyncConfig({ sync: "on", anonKey: ANON_LIKE })).toEqual({ mode: "MISCONFIGURED", issue: "MISSING_URL" });
    expect(evaluateSyncConfig({ sync: "on", url: "https://x.example.test" })).toEqual({ mode: "MISCONFIGURED", issue: "MISSING_ANON_KEY" });
  });

  it("requires a secure URL (http only for localhost)", () => {
    for (const url of ["http://x.example.test", "ftp://x.example.test", "not a url"]) {
      expect(evaluateSyncConfig({ sync: "on", url, anonKey: ANON_LIKE })).toEqual({ mode: "MISCONFIGURED", issue: "URL_NOT_SECURE" });
    }
    expect(evaluateSyncConfig({ sync: "on", url: "http://127.0.0.1:54321", anonKey: ANON_LIKE }).mode).toBe("ON");
    expect(evaluateSyncConfig({ sync: "on", url: "http://localhost:54321", anonKey: ANON_LIKE }).mode).toBe("ON");
  });

  it("refuses a service-role or secret key in browser configuration", () => {
    expect(looksLikeSecretKey(SERVICE_LIKE)).toBe(true);
    expect(looksLikeSecretKey("sb_secret_abc")).toBe(true);
    expect(looksLikeSecretKey(ANON_LIKE)).toBe(false);
    expect(looksLikeSecretKey("sb_publishable_abc")).toBe(false);
    expect(evaluateSyncConfig({ sync: "on", url: "https://x.example.test", anonKey: SERVICE_LIKE })).toEqual({
      mode: "MISCONFIGURED",
      issue: "SECRET_KEY_IN_BROWSER_CONFIG",
    });
  });

  it("is ON only with the switch, a secure URL and a non-secret key", () => {
    expect(evaluateSyncConfig({ sync: "on", url: "https://x.example.test/path?x=1", anonKey: ` ${ANON_LIKE} ` })).toEqual({
      mode: "ON",
      url: "https://x.example.test",
      anonKey: ANON_LIKE,
    });
  });
});
