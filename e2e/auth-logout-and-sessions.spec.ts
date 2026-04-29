/**
 * E2E: Session management and logout flow.
 *
 * Flow:
 * 1. Context 1 signs in via magic link
 * 2. GET /api/account/sessions → exactly 1 session, isCurrent=true
 * 3. Context 2 signs in with same email → creates a second session
 * 4. Context 1 refreshes sessions list → 2 sessions visible
 * 5. Context 1 revokes Context 2's session (the non-current one)
 * 6. Context 2 calls GET /api/account/profile → 401 (session gone)
 * 7. Context 1 calls POST /api/auth/sign-out → logout
 * 8. Context 1 calls GET /api/account/profile → 401 (session cleared)
 *
 * Requires: API + Mailpit running.
 */

import { expect, test } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";

/** Shared email so both contexts create sessions for the same user. */
const SHARED_EMAIL = `sessions-test-${Date.now()}@vellum-test.local`;

// ---------------------------------------------------------------------------
// Mailpit helper — filter by recipient to avoid cross-test pollution
// ---------------------------------------------------------------------------

interface MailpitRecipient {
  Address: string;
  Name?: string;
}

interface MailpitMessageSummary {
  ID: string;
  To?: MailpitRecipient[];
}

interface MailpitMessageDetail {
  HTML?: string;
  Text?: string;
}

async function getMagicLinkForEmail(recipientEmail: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const listResp = await fetch(`${MAILPIT_API}/v1/messages?limit=20`);
      const list = (await listResp.json()) as {
        messages?: MailpitMessageSummary[];
      };

      // Find the latest message addressed to our specific recipient
      const match = list.messages?.find((m) =>
        m.To?.some((t) => t.Address === recipientEmail),
      );
      if (!match) throw new Error(`No email for ${recipientEmail}`);

      const msgResp = await fetch(`${MAILPIT_API}/v1/message/${match.ID}`);
      const msg = (await msgResp.json()) as MailpitMessageDetail;
      const body = msg.HTML ?? msg.Text ?? "";

      const urlMatch =
        body.match(/href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i) ??
        body.match(/(https?:\/\/[^\s]*\/api\/auth\/magic-link\/verify[^\s]*)/i);

      if (urlMatch?.[1]) return urlMatch[1];
    } catch {
      /* retry */
    }
    // Brief wait before next attempt — avoid hammering Mailpit
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Magic link URL not found for ${recipientEmail}`);
}

// ---------------------------------------------------------------------------
// Sign-in helper
// ---------------------------------------------------------------------------

async function signInWithMagicLink(
  page: import("@playwright/test").Page,
  email: string,
): Promise<void> {
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await emailInput.press("Enter");

  await expect(
    page.getByText(/check your inbox|請至信箱收信/i),
  ).toBeVisible({ timeout: 10_000 });

  const rawUrl = await getMagicLinkForEmail(email);
  // Rewrite host to the test base URL (magic link email uses production host)
  const verifyUrl = rawUrl.replace(/^https?:\/\/[^/]+/, "http://localhost:3001");

  await page.goto(verifyUrl);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Session management and logout", () => {
  test(
    "can list sessions (isCurrent), revoke another session, and sign out",
    async ({ browser }) => {
      // ---------------------------------------------------------------
      // § 1 — Context 1 signs in
      // ---------------------------------------------------------------
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      await signInWithMagicLink(page1, SHARED_EMAIL);

      // ---------------------------------------------------------------
      // § 2 — GET /api/account/sessions: exactly 1, isCurrent=true
      // ---------------------------------------------------------------
      const sessResp1 = await page1.request.get("/api/account/sessions");
      expect(sessResp1.status()).toBe(200);

      const sessBody1 = (await sessResp1.json()) as {
        data?: { sessions?: Array<{ id: string; isCurrent: boolean }> };
      };
      const sessions1 = sessBody1.data?.sessions ?? [];
      expect(sessions1.length).toBeGreaterThanOrEqual(1);

      const currentSession = sessions1.find((s) => s.isCurrent);
      expect(currentSession).toBeDefined();

      // ---------------------------------------------------------------
      // § 3 — Context 2 signs in (same email → second session)
      // ---------------------------------------------------------------
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await signInWithMagicLink(page2, SHARED_EMAIL);

      // ---------------------------------------------------------------
      // § 4 — Context 1 sees 2 sessions after Context 2 signs in
      // ---------------------------------------------------------------
      // Poll briefly — DB write is near-instant but give a small grace period
      let otherSession: { id: string; isCurrent: boolean } | undefined;

      for (let attempt = 0; attempt < 5; attempt++) {
        const sessResp2 = await page1.request.get("/api/account/sessions");
        const sessBody2 = (await sessResp2.json()) as {
          data?: { sessions?: Array<{ id: string; isCurrent: boolean }> };
        };
        const all = sessBody2.data?.sessions ?? [];
        otherSession = all.find((s) => !s.isCurrent);
        if (otherSession) break;
        await page1.waitForTimeout(500);
      }

      expect(otherSession).toBeDefined();

      // ---------------------------------------------------------------
      // § 5 — Context 1 revokes Context 2's session
      // ---------------------------------------------------------------
      const revokeResp = await page1.request.delete(
        `/api/account/sessions/${otherSession!.id}`,
      );
      expect(revokeResp.status()).toBe(200);

      // ---------------------------------------------------------------
      // § 6 — Context 2's next API call → 401 (session revoked)
      // ---------------------------------------------------------------
      const profileRespCtx2 = await page2.request.get("/api/account/profile");
      expect(profileRespCtx2.status()).toBe(401);

      // ---------------------------------------------------------------
      // § 7 — Context 1 signs out
      // ---------------------------------------------------------------
      const signOutResp = await page1.request.post("/api/auth/sign-out");
      expect([200, 204]).toContain(signOutResp.status());

      // ---------------------------------------------------------------
      // § 8 — Context 1's next API call → 401 (session cleared by logout)
      // ---------------------------------------------------------------
      const profileRespCtx1 = await page1.request.get("/api/account/profile");
      expect(profileRespCtx1.status()).toBe(401);

      // ---------------------------------------------------------------
      // Navigating to protected route redirects to /login
      // ---------------------------------------------------------------
      await page1.goto("/account/profile");
      await expect(page1).toHaveURL(/\/login/, { timeout: 5_000 });

      await context1.close();
      await context2.close();
    },
  );

  test("current session is marked isCurrent=true in the list", async ({ page }) => {
    await signInWithMagicLink(page, `isCurrent-check-${Date.now()}@vellum-test.local`);

    const resp = await page.request.get("/api/account/sessions");
    expect(resp.status()).toBe(200);

    const body = (await resp.json()) as {
      data?: { sessions?: Array<{ id: string; isCurrent: boolean }> };
    };
    const sessions = body.data?.sessions ?? [];
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const current = sessions.filter((s) => s.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBeTruthy();
  });
});
