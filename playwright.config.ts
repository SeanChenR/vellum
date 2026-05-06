import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "github" : "list",

  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3002",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Force the in-app i18n detector to pick `en` for E2E runs by
    // pre-seeding the localStorage key it caches into. Without this, the
    // detector reads `navigator.language` (en-US) which isn't in the
    // explicit supportedLngs list (zh-TW + en) and falls back to zh-TW —
    // breaking specs that target English UI strings.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: process.env["E2E_BASE_URL"] ?? "http://localhost:3002",
          localStorage: [{ name: "i18nextLng", value: "en" }],
        },
      ],
    },
    // Send an Origin header on every APIRequestContext call. better-auth
    // refuses POST /api/auth/* with a session cookie but no Origin header
    // (CSRF guard). Playwright's request fixture skips Origin by default;
    // emulate a browser-style same-origin request explicitly.
    extraHTTPHeaders: {
      Origin: process.env["E2E_BASE_URL"] ?? "http://localhost:3002",
    },
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Force browser locale to English so the i18n detector picks `en`
        // for fresh test users. Without this, Playwright inherits the host
        // OS locale (zh-TW on this dev machine) and selectors that target
        // English UI strings fail.
        locale: "en-US",
      },
    },
  ],

  webServer: {
    command: "bun scripts/dev.ts",
    url: "http://localhost:3002",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
