import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.SALESOS_E2E_PORT ?? 3100);
const devServerCommand =
  process.platform === "win32" ? `npm.cmd run dev -- --port ${port}` : `npm run dev -- --port ${port}`;

// Cloud sessions ship a preinstalled Chromium that may not match the build
// pinned by @playwright/test. Setting PLAYWRIGHT_CHROMIUM_EXECUTABLE runs every
// project on that binary (the mobile project keeps iPhone 13 viewport, touch
// and locale emulation, but on Chromium instead of WebKit). CI leaves it unset.
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const executableOverride = chromiumExecutable
  ? { browserName: "chromium" as const, launchOptions: { executablePath: chromiumExecutable } }
  : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  timeout: 60 * 1000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
  },
  webServer: {
    command: devServerCommand,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], ...executableOverride } },
    {
      name: "mobile-arabic",
      use: { ...devices["iPhone 13"], locale: "ar-EG", ...executableOverride },
    },
  ],
});
