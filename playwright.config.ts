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
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "bun run dev",
    url: "http://localhost:3001",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
