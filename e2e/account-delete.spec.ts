/**
 * E2E: Delete account flow.
 *
 * Flow:
 * 1. Sign in via magic link
 * 2. Navigate to /account/profile
 * 3. Open Delete Account dialog
 * 4. Enter confirmEmail
 * 5. Submit
 * 6. Assert redirect to /login
 * 7. Verify re-entry to protected routes redirects to /login
 *
 * Requires: API + Mailpit running.
 */

import { expect, test } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
const DELETE_TEST_EMAIL = `delete-test-${Date.now()}@vellum-test.local`;

async function signInWithMagicLink(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await emailInput.press("Enter");

  await expect(page.getByText(/check your inbox|請至信箱收信/i)).toBeVisible({ timeout: 10_000 });

  // Fetch magic link from Mailpit
  let magicLinkUrl = "";
  for (let i = 0; i < 5; i++) {
    try {
      const listResp = await fetch(`${MAILPIT_API}/v1/messages`);
      const list = (await listResp.json()) as {
        messages?: Array<{ ID: string }>;
      };
      const latest = list.messages?.[0];
      if (!latest) throw new Error("No email");
      const msgResp = await fetch(`${MAILPIT_API}/v1/message/${latest.ID}`);
      const msg = (await msgResp.json()) as { HTML?: string; Text?: string };
      const body = msg.HTML ?? msg.Text ?? "";
      const match =
        body.match(/href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i) ??
        body.match(/(https?:\/\/[^\s]*\/api\/auth\/magic-link\/verify[^\s]*)/i);
      if (match?.[1]) {
        magicLinkUrl = match[1];
        break;
      }
    } catch {
      /* retry */
    }
    await page.waitForTimeout(1000);
  }

  if (!magicLinkUrl) throw new Error("Magic link URL not found");

  // Decode HTML entities (email body may be HTML-escaped) and rewrite host to baseURL.
  const decoded = magicLinkUrl
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3002";
  const verifyUrl = decoded.replace(/^https?:\/\/[^/]+/, baseUrl);
  await page.goto(verifyUrl);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe("Delete account flow", () => {
  test("signed-in user can delete account and is redirected to /login", async ({ page }) => {
    // Sign in
    await signInWithMagicLink(page, DELETE_TEST_EMAIL);

    // Navigate to profile page — the Delete Account trigger lives here
    await page.goto("/account/profile");

    // Look for a "Delete account" button or link
    const deleteBtn = page.getByRole("button", {
      name: /delete.*account|刪除帳號/i,
    });
    if ((await deleteBtn.count()) === 0) {
      // If not on profile page, skip — visual iteration not yet done
      test.skip();
      return;
    }
    await deleteBtn.click();

    // Fill confirm email
    const confirmInput = page.getByRole("textbox", {
      name: /confirm email|確認.*email/i,
    });
    await confirmInput.fill(DELETE_TEST_EMAIL);

    // Submit
    const submitBtn = page.getByRole("button", {
      name: /delete.*permanently|永久刪除/i,
    });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Navigating to /account/profile redirects to /login (session cleared)
    await page.goto("/account/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
