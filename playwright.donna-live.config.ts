import { defineConfig, devices } from "@playwright/test";

/**
 * DON-02 live acceptance harness. Separate from `npm run test:e2e` and from CI:
 * it needs a REAL hosted database and test accounts, supplied only through the
 * environment (never the repository). Without them it FAILS with the list of
 * missing variable names; it never skips and never reports a pass it did not earn.
 *
 *   npm run test:donna-live
 *
 * It leaves synthetic rows (call ids starting with `live-`) behind: events are
 * append-only by design, so use a throwaway project (docs/engineering/DON-02-SETUP.md).
 */
const REQUIRED = [
  "NEXT_PUBLIC_DONNA_SUPABASE_URL",
  "NEXT_PUBLIC_DONNA_SUPABASE_ANON_KEY",
  "DONNA_LIVE_USER_A_EMAIL",
  "DONNA_LIVE_USER_A_PASSWORD",
  "DONNA_LIVE_USER_B_EMAIL",
  "DONNA_LIVE_USER_B_PASSWORD",
] as const;

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Donna live acceptance is BLOCKED: missing environment variables: ${missing.join(", ")}. ` +
      "Set them as described in docs/engineering/DON-02-SETUP.md (never paste secrets into chat or commit them).",
  );
}

const port = Number(process.env.DONNA_LIVE_PORT ?? 3101);
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./tests/donna-live",
  fullyParallel: false,
  workers: 1,
  timeout: 90 * 1000,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: process.platform === "win32" ? `npm.cmd run dev -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    // Never reuse a server: it might have been started without the sync switch.
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: { ...(process.env as Record<string, string>), NEXT_PUBLIC_DONNA_SYNC: "on" },
  },
  projects: [
    {
      name: "live-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
      },
    },
  ],
});
