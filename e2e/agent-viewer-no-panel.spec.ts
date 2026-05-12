/**
 * E2E: AI Side Panel hidden from view-mode public-link visitors.
 *
 * Spec ref: ai-side-panel "Side Panel docks into Editor and is collapsible"
 *           — viewer scenario.
 *
 * Flow:
 *   1. Owner signs in + creates a canvas.
 *   2. Owner opens the share dialog and switches the public link to "view".
 *   3. Anonymous browser context visits the share URL.
 *   4. AI panel toggle button MUST NOT be present in the DOM.
 *   5. AI panel mount point MUST NOT be present in the DOM.
 *
 * Requires: dev server running on baseURL + Mailpit (for owner sign-in).
 */

import { expect, test, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
const OWNER_EMAIL = `agent-viewer-${Date.now()}@vellum-test.local`;

async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await emailInput.press("Enter");
  await expect(page.getByText(/check your inbox|請至信箱收信/i)).toBeVisible({ timeout: 10_000 });

  let magicLinkUrl = "";
  for (let i = 0; i < 8; i++) {
    try {
      const listResp = await fetch(`${MAILPIT_API}/v1/messages`);
      const list = (await listResp.json()) as {
        messages?: Array<{ ID: string; To?: Array<{ Address: string }> }>;
      };
      const match = list.messages?.find((m) => m.To?.some((t) => t.Address === email));
      if (!match) throw new Error("No email yet");
      const msgResp = await fetch(`${MAILPIT_API}/v1/message/${match.ID}`);
      const msg = (await msgResp.json()) as { HTML?: string; Text?: string };
      const body = msg.HTML ?? msg.Text ?? "";
      const m = body.match(/https?:\/\/[^"'\s<>]+\/api\/auth\/magic-link\/verify[^"'\s<>]*/);
      if (m) {
        magicLinkUrl = m[0].replace(/&amp;/g, "&").replace(/&#39;/g, "'");
        break;
      }
      throw new Error("No magic-link URL in body");
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  expect(magicLinkUrl).not.toBe("");
  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3002";
  await page.goto(magicLinkUrl.replace(/^https?:\/\/[^/]+/, baseUrl));
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe("AI panel — hidden from public-link viewers", () => {
  test("anonymous viewer following a public-view link sees no AI toggle / panel", async ({
    browser,
  }) => {
    // Owner: sign in, create a canvas, share via public-view link.
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await signInWithMagicLink(ownerPage, OWNER_EMAIL);

    // Open the create-canvas dialog from the dashboard. The button only
    // opens a modal; the canvas is created when the form is submitted,
    // and creation does NOT auto-navigate — the new card appears on the
    // dashboard and must be clicked to enter the canvas page.
    // i18n keys: dashboard.createCanvas → "Create canvas" (en) / "建立畫布" (zh-TW).
    const canvasTitle = `agent-viewer-${Date.now()}`;
    await ownerPage
      .getByRole("button", { name: /create canvas|建立畫布/i })
      .first()
      .click();
    const createDialog = ownerPage.getByRole("dialog");
    await expect(createDialog).toBeVisible({ timeout: 5_000 });
    await createDialog.getByRole("textbox").first().fill(canvasTitle);
    // Dialog submit button label is the literal "Create" (not yet
    // i18n-keyed at the time of writing).
    await createDialog.getByRole("button", { name: /^create$/i }).click();
    // Card appears on the dashboard. CanvasCard wraps the thumbnail in a
    // <Link to="/canvas/:id"> but the title <p> lives outside that link
    // (sibling, not child), so hasText filter can't match. Wait for the
    // title to render — confirming the card is mounted — and click the
    // only canvas link on the page (this test starts with a clean user).
    await expect(ownerPage.getByText(canvasTitle).first()).toBeVisible({ timeout: 10_000 });
    const cardLink = ownerPage.locator('a[href^="/canvas/"]').first();
    await cardLink.click();
    await ownerPage.waitForURL(/\/canvas\//);
    const canvasUrl = ownerPage.url();
    const canvasId = canvasUrl.match(/\/canvas\/([^/?#]+)/)?.[1];
    expect(canvasId).toBeTruthy();

    // Owner sees the AI toggle (sanity check we wired it for editor role).
    await expect(ownerPage.getByTestId("topbar-ai-panel-toggle")).toBeVisible();

    // Switch the share link to "view" mode via the server API. The
    // ShareDialog UI uses a `copyLink` button that writes to the
    // clipboard rather than rendering the URL as a textbox, so reading
    // the link through the UI is brittle. Use the documented endpoints:
    //   PUT  /api/canvas/:id/share/link   {mode: "view"}
    //   GET  /api/canvas/:id/share        → data.link.token
    // Construct the public URL with the same template the frontend uses
    // (apps/web/src/canvas/ShareDialog.tsx:191): `{origin}/canvas/:id?share=:token`.
    const apiBase = canvasUrl.match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3002";
    const cookies = await ownerCtx.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const putResp = await fetch(`${apiBase}/api/canvas/${canvasId}/share/link`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: cookieHeader, origin: apiBase },
      body: JSON.stringify({ mode: "view" }),
    });
    expect(putResp.ok).toBe(true);
    const getResp = await fetch(`${apiBase}/api/canvas/${canvasId}/share`, {
      headers: { cookie: cookieHeader, origin: apiBase },
    });
    expect(getResp.ok).toBe(true);
    const state = (await getResp.json()) as {
      data: { link: { token: string; mode: string } | null };
    };
    expect(state.data.link?.mode).toBe("view");
    const publicViewUrl = `${apiBase}/canvas/${canvasId}?share=${state.data.link!.token}`;

    // Anonymous context: visit the public link.
    const anonCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(publicViewUrl!);
    await anonPage.waitForURL(/\/canvas\//);

    // Toggle button must NOT be present for the viewer.
    await expect(anonPage.getByTestId("topbar-ai-panel-toggle")).toHaveCount(0, {
      timeout: 5_000,
    });
    // The side-panel mount point must also be absent (it only renders
    // when the toggle has been clicked, but the toggle itself is hidden).
    await expect(anonPage.getByTestId("ai-side-panel")).toHaveCount(0);

    await anonCtx.close();
    await ownerCtx.close();
  });
});
