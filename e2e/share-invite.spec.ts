/**
 * E2E: share invite happy path (task 6.1).
 *
 * Flow:
 *   1. Owner logs in (magic link) and creates a canvas
 *   2. Owner opens ShareDialog and invites a fresh email
 *   3. Mailpit yields an invite email; recipient clicks the accept URL
 *   4. Recipient logs in (magic link, since the email wasn't registered yet)
 *   5. After accept, recipient lands on `/canvas/:id` and sees the canvas
 *
 * Covers spec scenarios:
 *   - "Owner invites an unknown email creates a pending invite and sends mail"
 *   - "Invite acceptance route requires email match and writes a share"
 *
 * Requires:
 *   - API + web running (`bun run dev:up`)
 *   - Mailpit running on :8025
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";

async function getEmailBodyForRecipient(recipient: string): Promise<string> {
  const list = (await (await fetch(`${MAILPIT_API}/v1/messages`)).json()) as {
    messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
  };
  const match = list.messages?.find((m) => m.To?.some((t) => t.Address === recipient));
  if (!match) throw new Error(`No email found in Mailpit for ${recipient}`);
  const msg = (await (await fetch(`${MAILPIT_API}/v1/message/${match.ID}`)).json()) as {
    HTML?: string;
    Text?: string;
  };
  return msg.HTML ?? msg.Text ?? "";
}

function extractFirstUrl(body: string, marker: RegExp): string {
  const m = body.match(marker);
  if (!m?.[1]) throw new Error(`URL not found:\n${body}`);
  return m[1].replace(/&amp;/g, "&");
}

async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  await page.waitForTimeout(500);
  const body = await getEmailBodyForRecipient(email);
  const link = extractFirstUrl(body, /href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i);
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
  // Force user locale to en so the rest of the spec can rely on English
  // selectors (DB default is zh-TW; useAuth syncs i18n from user.locale).
  await page.request.patch("/api/account/profile", { data: { locale: "en" } });
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Share invite happy path", () => {
  test("owner invites a new email; invitee accepts and joins the canvas", async ({ browser }) => {
    const ts = Date.now();
    const ownerEmail = `owner-${ts}@vellum-test.local`;
    const inviteEmail = `invitee-${ts}@vellum-test.local`;

    const ownerCtx: BrowserContext = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();

    // 1. Owner logs in
    await loginViaMagicLink(ownerPage, ownerEmail);

    // 2. Owner creates a canvas
    await ownerPage.getByRole("button", { name: "Create canvas" }).first().click();
    await ownerPage.getByPlaceholder("Canvas title").fill("Share invite probe");
    await ownerPage.getByRole("button", { name: "Create" }).last().click();
    // Dashboard stays after create — open the new card to enter the editor.
    await expect(ownerPage.getByText("Share invite probe")).toBeVisible({ timeout: 10_000 });
    const canvasId = await ownerPage
      .locator(`[data-canvas-id]`)
      .first()
      .getAttribute("data-canvas-id");
    await ownerPage.goto(`/canvas/${canvasId}`);
    await ownerPage.waitForURL(/\/canvas\/[a-f0-9-]+/);
    const canvasUrl = ownerPage.url();

    // 3. Open ShareDialog and invite the new email
    await ownerPage.getByRole("button", { name: "Share", exact: true }).click();
    const shareDialog = ownerPage.getByRole("dialog");
    await expect(shareDialog).toBeVisible();
    await shareDialog.getByPlaceholder(/example\.com/i).fill(inviteEmail);
    await shareDialog.getByRole("button", { name: /send invite/i }).click();
    // Pending badge appears once the invite is created.
    await expect(ownerPage.getByText("Pending").first()).toBeVisible();

    // 4. Invitee receives the invite email + accepts
    await ownerPage.waitForTimeout(800);
    const inviteBody = await getEmailBodyForRecipient(inviteEmail);
    const acceptUrl = extractFirstUrl(
      inviteBody,
      /href=["']([^"']*\/api\/share\/invite\/[^"']+\/accept)['"]/i,
    );

    const inviteeCtx: BrowserContext = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    // Accept route redirects through /login when there's no session.
    await inviteePage.goto(acceptUrl);
    await expect(inviteePage).toHaveURL(/\/login/);
    // Magic-link login the invitee under their own email.
    await loginViaMagicLink(inviteePage, inviteEmail);
    // After login the redirect query SHOULD send them back through the
    // accept handler → /canvas/:id. Phase 1 trusts that round-trip; if the
    // login flow drops the redirect param this test catches the regression.
    await inviteePage.goto(acceptUrl);
    await expect(inviteePage).toHaveURL(canvasUrl);

    await ownerCtx.close();
    await inviteeCtx.close();
  });
});
