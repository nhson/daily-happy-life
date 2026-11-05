import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests, signed in as a dedicated Clerk test user, against a production build
 * (default) or a deployed URL: `E2E_BASE_URL=https://daily-happy-life.vercel.app bun run e2e`.
 * The test user's rows are wiped before each run; the owner's data is never touched.
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3211;
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  outputDir: "e2e-results",
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: remote
    ? undefined
    : { command: `bun run build && bunx next start --port ${PORT}`, url: `http://localhost:${PORT}/sign-in`, timeout: 240_000, reuseExistingServer: true },
});
