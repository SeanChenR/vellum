/**
 * E2E: public link happy path (task 6.2).
 *
 * Flow:
 *   1. Owner logs in (magic link) and creates a canvas
 *   2. Owner opens ShareDialog and switches link mode to "view"
 *   3. Owner copies the link (we read the token via the dialog's input)
 *   4. Anonymous browser context opens the link → reaches the canvas in
 *      read-only mode (no /login redirect, View only badge visible)
 *   5. Owner switches mode to "closed" → anonymous WS is kicked
 *      (disconnected banner appears)
 *
 * Covers spec scenarios:
 *   - "Owner toggles the public link mode"
 *   - "Anonymous visitors enter via public link without login redirect"
 *   - "Sync server kicks affected sessions when access is revoked"
 *   - "Viewer role connects in read-only mode"
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

async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  await page.waitForTimeout(500);
  const body = await getEmailBodyForRecipient(email);
  const m = body.match(/href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i);
  if (!m?.[1]) throw new Error(`magic link not found:\n${body}`);
  await page.goto(m[1].replace(/&amp;/g, "&"));
  await expect(page).toHaveURL(/\/dashboard/);
  // DB default locale is zh-TW; force en so English selectors match.
  await page.request.patch("/api/account/profile", { data: { locale: "en" } });
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Public link happy path", () => {
  test("anonymous visitor enters via view-mode link, then is kicked when mode → closed", async ({
    browser,
  }) => {
    const ownerEmail = `owner-${Date.now()}@vellum-test.local`;

    const ownerCtx: BrowserContext = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginViaMagicLink(ownerPage, ownerEmail);

    // Create canvas
    await ownerPage.getByRole("button", { name: "Create canvas" }).first().click();
    await ownerPage.getByPlaceholder("Canvas title").fill("Public link probe");
    await ownerPage.getByRole("button", { name: "Create" }).last().click();
    await expect(ownerPage.getByText("Public link probe")).toBeVisible({ timeout: 10_000 });
    const newCanvasId = await ownerPage
      .locator(`[data-canvas-id]`)
      .first()
      .getAttribute("data-canvas-id");
    await ownerPage.goto(`/canvas/${newCanvasId}`);
    await ownerPage.waitForURL(/\/canvas\/[a-f0-9-]+/);
    const canvasUrl = ownerPage.url();

    // Open ShareDialog → set link mode to "View only"
    await ownerPage.getByRole("button", { name: "Share", exact: true }).click();
    const dlg = ownerPage.getByRole("dialog");
    await expect(dlg).toBeVisible();
    // The radios live inside the dialog; click the label-text instead of
    // the small radio handle to avoid hit-test intercepts on the floating
    // tldraw style panel that overlays the right side.
    await dlg.getByText(/^view only$/i).click();

    // The link record now exists; its share token is reflected in the
    // copy-link button's URL. Read it via API since the UI doesn't expose
    // the token directly.
    const canvasId = canvasUrl.match(/\/canvas\/([a-f0-9-]+)/)![1]!;
    const stateResp = await ownerPage.request.get(`/api/canvas/${canvasId}/share`);
    const state = (await stateResp.json()) as {
      data: { link: { token: string; mode: string } };
    };
    const token = state.data.link.token;
    expect(state.data.link.mode).toBe("view");

    // Anonymous visitor enters via the public link (different context, no cookies).
    const anonCtx: BrowserContext = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`/canvas/${canvasId}?share=${token}`);
    // MUST NOT redirect to /login.
    await expect(anonPage).toHaveURL(new RegExp(`/canvas/${canvasId}`));
    // View-only badge appears once the WS handshake resolves.
    await expect(anonPage.getByText(/view only/i)).toBeVisible({ timeout: 10_000 });

    // Owner flips mode → closed. The dialog is still open from earlier.
    await ownerPage
      .getByRole("dialog")
      .getByText(/^closed$/i)
      .click();

    // Anonymous client should be kicked; the connection-status badge moves
    // out of the steady "connected" state. Either the persistent
    // "Lost connection" banner or the transient "Reconnecting…" badge
    // confirms the drop — tests covering the steady disconnected state
    // are deferred (see Phase 2 backlog).
    await expect(anonPage.getByText(/lost connection|reconnecting/i)).toBeVisible({
      timeout: 35_000,
    });

    await ownerCtx.close();
    await anonCtx.close();
  });
});
