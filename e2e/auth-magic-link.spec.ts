/**
 * E2E: Magic Link login flow.
 *
 * Flow:
 * 1. Navigate to /login
 * 2. Enter email and submit magic-link form
 * 3. Fetch latest email from Mailpit API
 * 4. Extract magic-link URL from email
 * 5. Navigate to the URL
 * 6. Assert redirect to /dashboard
 *
 * Requires:
 * - API server running (bun run dev)
 * - Mailpit running (docker compose up -d mailpit)
 */

import { expect, test } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
const TEST_EMAIL = `playwright-test-${Date.now()}@vellum-test.local`;

async function getLatestEmailBody(): Promise<string> {
  // Poll Mailpit API for the latest message
  const listResp = await fetch(`${MAILPIT_API}/v1/messages`);
  const list = (await listResp.json()) as {
    messages?: Array<{ ID: string }>;
  };

  const latest = list.messages?.[0];
  if (!latest) throw new Error("No email found in Mailpit");

  const msgResp = await fetch(`${MAILPIT_API}/v1/message/${latest.ID}`);
  const msg = (await msgResp.json()) as { HTML?: string; Text?: string };
  return msg.HTML ?? msg.Text ?? "";
}

function extractMagicLinkUrl(emailBody: string): string {
  // Match href containing /api/auth/magic-link/verify
  const match = emailBody.match(
    /href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i,
  );
  if (match?.[1]) return match[1];

  // Fallback: match plain text URL
  const textMatch = emailBody.match(
    /(https?:\/\/[^\s]*\/api\/auth\/magic-link\/verify[^\s]*)/i,
  );
  if (textMatch?.[1]) return textMatch[1];

  throw new Error(`Magic link URL not found in email body:\n${emailBody}`);
}

test.describe("Magic Link login flow", () => {
  test("user can sign in via magic link and reach /dashboard", async ({
    page,
  }) => {
    // Step 1: Go to /login
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Step 2: Fill and submit magic-link form
    const emailInput = page.getByRole("textbox", { name: /email/i });
    await emailInput.fill(TEST_EMAIL);
    await emailInput.press("Enter");

    // Step 3: Wait for "check your inbox" message
    await expect(
      page.getByText(/check your inbox|請至信箱收信/i),
    ).toBeVisible({ timeout: 10_000 });

    // Step 4: Retrieve magic-link URL from Mailpit
    let magicLinkUrl = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const body = await getLatestEmailBody();
        magicLinkUrl = extractMagicLinkUrl(body);
        break;
      } catch {
        await page.waitForTimeout(1000);
      }
    }
    expect(magicLinkUrl).not.toBe("");

    // Step 5: Navigate to the magic link
    // Replace the server-side URL with the test base URL
    const verifyUrl = magicLinkUrl.replace(
      /^https?:\/\/[^/]+/,
      page.context().browser()?.contexts()[0]?.pages()[0]?.url().match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3001",
    );

    await page.goto(verifyUrl);

    // Step 6: Should end up at /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
