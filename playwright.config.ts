import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const devServerCommand =
  process.platform === "win32" ? `npm.cmd run dev -- --port ${port}` : `npm run dev -- --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
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
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-arabic", use: { ...devices["iPhone 13"], locale: "ar-EG" } },
  ],
});
