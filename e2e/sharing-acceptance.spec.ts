/**
 * Visual acceptance run for task 38 (6.5).
 *
 * Walks the 5 sharing scenarios and saves screenshots to
 * `test-results/sharing-acceptance/` so the owner can sign off on the UX.
 * Not a regression test — assertions are minimal and only enough to keep
 * the scenario on-track. The screenshots are the deliverable.
 *
 *   1. share-dialog-empty       — fresh ShareDialog, three sections rendered
 *   2. share-dialog-pending     — after inviting an email, pending badge shown
 *   3. share-dialog-viewer      — member role flipped to viewer
 *   4. canvas-viewer-toolbar    — viewer's tldraw toolbar in read-only state
 *   5. public-link-view-mode    — anonymous visitor sees View only badge
 *   6. public-link-rotated      — old token returns 404/closed after rotate
 *   7. invite-email-mailpit     — Mailpit message preview (proof of mail)
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
const SHOT_DIR = join(process.cwd(), "test-results", "sharing-acceptance");

if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function getEmailBodyForRecipient(recipient: string): Promise<{ id: string; html: string }> {
  const list = (await (await fetch(`${MAILPIT_API}/v1/messages`)).json()) as {
    messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
  };
  const match = list.messages?.find((m) => m.To?.some((t) => t.Address === recipient));
  if (!match) throw new Error(`No email found in Mailpit for ${recipient}`);
  const msg = (await (await fetch(`${MAILPIT_API}/v1/message/${match.ID}`)).json()) as {
    HTML?: string;
    Text?: string;
  };
  return { id: match.ID, html: msg.HTML ?? msg.Text ?? "" };
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
  const { html } = await getEmailBodyForRecipient(email);
  const link = extractFirstUrl(html, /href=["']([^"']*\/api\/auth\/magic-link\/verify[^"']*)['"]/i);
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
  // DB default locale is zh-TW; force en so English selectors match.
  await page.request.patch("/api/account/profile", { data: { locale: "en" } });
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test.describe("Sharing visual acceptance", () => {
  test("share dialog: empty → invite → viewer demotion → public link rotate", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ts = Date.now();
    const ownerEmail = `owner-${ts}@vellum-test.local`;
    const inviteEmail = `invitee-${ts}@vellum-test.local`;

    const ownerCtx: BrowserContext = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await loginViaMagicLink(ownerPage, ownerEmail);

    await ownerPage.getByRole("button", { name: "Create canvas" }).first().click();
    await ownerPage.getByPlaceholder("Canvas title").fill("Sharing acceptance probe");
    await ownerPage.getByRole("button", { name: "Create" }).last().click();
    await expect(ownerPage.getByText("Sharing acceptance probe")).toBeVisible({ timeout: 10_000 });
    const newCanvasId = await ownerPage
      .locator(`[data-canvas-id]`)
      .first()
      .getAttribute("data-canvas-id");
    await ownerPage.goto(`/canvas/${newCanvasId}`);
    await ownerPage.waitForURL(/\/canvas\/[a-f0-9-]+/);
    const canvasUrl = ownerPage.url();
    const canvasId = canvasUrl.match(/\/canvas\/([a-f0-9-]+)/)![1]!;

    // 1. Empty ShareDialog
    await ownerPage.getByRole("button", { name: "Share", exact: true }).click();
    const shareDlg = ownerPage.getByRole("dialog");
    await expect(shareDlg).toBeVisible();
    await shot(ownerPage, "01-share-dialog-empty");

    // 2. Invite a fresh email → Pending badge
    await shareDlg.getByPlaceholder(/example\.com/i).fill(inviteEmail);
    await shareDlg.getByRole("button", { name: /send invite/i }).click();
    await expect(ownerPage.getByText("Pending").first()).toBeVisible();
    await shot(ownerPage, "02-share-dialog-pending");

    // Mailpit proof
    await ownerPage.waitForTimeout(500);
    const { id: mailId, html: inviteBody } = await getEmailBodyForRecipient(inviteEmail);
    const acceptUrl = extractFirstUrl(
      inviteBody,
      /href=["']([^"']*\/api\/share\/invite\/[^"']+\/accept)['"]/i,
    );

    // Snap Mailpit's web UI for the invite mail
    const mailPage = await ownerCtx.newPage();
    await mailPage.goto(`http://localhost:8025/view/${mailId}`);
    await mailPage.waitForLoadState("networkidle");
    await mailPage.screenshot({
      path: join(SHOT_DIR, "07-invite-email-mailpit.png"),
      fullPage: true,
    });
    await mailPage.close();

    // 3. Invitee accepts → becomes editor → owner demotes to viewer
    const inviteeCtx: BrowserContext = await browser.newContext();
    const inviteePage = await inviteeCtx.newPage();
    await inviteePage.goto(acceptUrl);
    await expect(inviteePage).toHaveURL(/\/login/);
    await loginViaMagicLink(inviteePage, inviteEmail);
    await inviteePage.goto(acceptUrl);
    await expect(inviteePage).toHaveURL(canvasUrl);

    // Owner's dialog reflects the new member; switch their role to viewer
    await ownerPage.bringToFront();
    // Reload share state — refetch via API path is inside the dialog
    await ownerPage
      .getByRole("button", { name: /close/i })
      .click()
      .catch(() => {});
    await ownerPage.getByRole("button", { name: "Share", exact: true }).click();
    // Find the role select for the invitee row and switch to viewer
    const roleSelect = ownerPage.getByLabel(new RegExp(`role for ${inviteEmail}`, "i"));
    if (await roleSelect.count()) {
      await roleSelect.selectOption("viewer");
    } else {
      // Fallback: pick the first non-owner role select
      await ownerPage
        .getByRole("combobox")
        .nth(0)
        .selectOption("viewer")
        .catch(() => {});
    }
    await ownerPage.waitForTimeout(500);
    await shot(ownerPage, "03-share-dialog-viewer");

    // 4. Invitee canvas reflects viewer (read-only) state
    await inviteePage.bringToFront();
    await inviteePage.reload();
    await expect(inviteePage.getByText(/view only/i)).toBeVisible({ timeout: 10_000 });
    await shot(inviteePage, "04-canvas-viewer-toolbar");

    // 5. Owner switches public link to view mode → anon visitor enters
    await ownerPage.bringToFront();
    await ownerPage.getByRole("radio", { name: /view only/i }).check();
    await ownerPage.waitForTimeout(300);

    // Read token via API (UI only exposes copy button)
    const stateResp = await ownerPage.request.get(`/api/canvas/${canvasId}/share`);
    const state = (await stateResp.json()) as {
      data: { link: { token: string; mode: string } };
    };
    const oldToken = state.data.link.token;
    expect(state.data.link.mode).toBe("view");

    const anonCtx: BrowserContext = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`/canvas/${canvasId}?share=${oldToken}`);
    await expect(anonPage).toHaveURL(new RegExp(`/canvas/${canvasId}`));
    await expect(anonPage.getByText(/view only/i)).toBeVisible({ timeout: 10_000 });
    await shot(anonPage, "05-public-link-view-mode");

    // 6. Owner rotates token → old token closes
    await ownerPage.bringToFront();
    const rotateBtn = ownerPage.getByRole("button", { name: /rotate/i });
    await rotateBtn.click();
    // Confirm dialog (if any)
    const confirmBtn = ownerPage.getByRole("button", { name: /confirm|rotate/i }).last();
    await confirmBtn.click().catch(() => {});
    await ownerPage.waitForTimeout(500);

    // Old anon page should drop / show banner
    await anonPage.bringToFront();
    // Either lost-connection banner or redirect
    const dropped = await Promise.race([
      anonPage
        .getByText(/lost connection/i)
        .waitFor({ timeout: 35_000 })
        .then(() => true),
      anonPage.waitForURL(/\/login/, { timeout: 35_000 }).then(() => true),
    ]).catch(() => false);
    await shot(anonPage, "06-public-link-rotated");
    expect(dropped, "anonymous client must be kicked after rotate").toBe(true);

    await ownerCtx.close();
    await inviteeCtx.close();
    await anonCtx.close();
  });
});
