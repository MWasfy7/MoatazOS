import { defineConfig } from "@playwright/test";

/**
 * DON-02 trigger evidence, phase 2: check an exported Postgres log excerpt against the phase-1 observations
 * (see tests/donna-live/allowlist-trigger-attribution.spec.ts). No network, no credentials, no browser.
 *
 *   DONNA_LIVE_TRIGGER_LOG_FILE=<file> npm run test:donna-verify-trigger
 */
if (!process.env.DONNA_LIVE_TRIGGER_LOG_FILE) {
  throw new Error(
    "Donna trigger attribution is BLOCKED: set DONNA_LIVE_TRIGGER_LOG_FILE to a file holding the exported Postgres log lines (DON-02-SETUP.md section 9).",
  );
}

export default defineConfig({
  testDir: "./tests/donna-live",
  testMatch: ["**/allowlist-trigger-attribution.spec.ts"],
  workers: 1,
  reporter: "list",
  // A different output directory, so this run never wipes anything phase 1 left behind.
  outputDir: "./test-results-verify",
});
