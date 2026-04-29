/**
 * E2E: Google OAuth login flow.
 *
 * Uses GOOGLE_OAUTH_TEST_MODE=1 environment variable to enable a stub
 * OAuth provider on the API side (bypasses real Google).
 *
 * In test mode, the API accepts requests to
 * /api/auth/callback/google?test_email=<email>&test_mode=1
 * and creates a session without real Google interaction.
 *
 * Scenarios:
 * - First-time login: creates user row + redirects to /dashboard
 * - Returning login: reuses existing user row
 *
 * NOTE: These tests require GOOGLE_OAUTH_TEST_MODE=1 to be set in the API
 * environment. Without this, the tests are skipped.
 */

import { expect, test } from "@playwright/test";

const TEST_MODE = process.env["GOOGLE_OAUTH_TEST_MODE"] === "1";
const GOOGLE_TEST_EMAIL = `google-test-${Date.now()}@gmail-test.local`;

test.describe("Google OAuth login (stub provider)", () => {
  test.skip(!TEST_MODE, "Skipped: set GOOGLE_OAUTH_TEST_MODE=1 to run");

  test("first-time Google login creates user and redirects to /dashboard", async ({ page }) => {
    // Navigate to the stub OAuth callback (test mode only)
    await page.goto(
      `/api/auth/callback/google?test_email=${encodeURIComponent(GOOGLE_TEST_EMAIL)}&test_mode=1`,
    );

    // Should end up at /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Verify user can access profile (session was created)
    const resp = await page.request.get("/api/account/profile");
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as { data?: { email?: string } };
    expect(body.data?.email).toBe(GOOGLE_TEST_EMAIL);
  });

  test("returning Google login reuses existing user row", async ({ page }) => {
    // First login
    await page.goto(
      `/api/auth/callback/google?test_email=${encodeURIComponent(GOOGLE_TEST_EMAIL)}&test_mode=1`,
    );
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Get user ID from first login
    const resp1 = await page.request.get("/api/account/profile");
    const body1 = (await resp1.json()) as { data?: { id?: string } };
    const firstUserId = body1.data?.id;

    // Sign out
    await page.request.post("/api/auth/sign-out");

    // Second login
    await page.goto(
      `/api/auth/callback/google?test_email=${encodeURIComponent(GOOGLE_TEST_EMAIL)}&test_mode=1`,
    );
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Verify same user ID (row reused)
    const resp2 = await page.request.get("/api/account/profile");
    const body2 = (await resp2.json()) as { data?: { id?: string } };
    expect(body2.data?.id).toBe(firstUserId);
  });
});
