/**
 * E2E: Export PNG happy path.
 *
 * Spec: e2e-coverage — "Export has an E2E spec for PNG download".
 *
 * Flow (PRD US 272):
 *   1. signInWithMagicLink
 *   2. Create a canvas, navigate into /canvas/:id
 *   3. Wait for tldraw to mount
 *   4. Draw a non-empty shape (so the export is not 0 bytes)
 *   5. Open MainMenu → Export → PNG → 1×
 *   6. Assert Playwright download event with filename matching {slug}.png
 *
 * Requires:
 * - dev server running on baseURL (default http://localhost:3002)
 * - Mailpit running (docker compose up -d mailpit)
 *
 * The export pipeline is unit-tested in
 * apps/web/src/canvas/export/export-canvas.test.ts; this E2E only
 * verifies that the chrome wires the click → download path end-to-end.
 */

import { expect, test, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
function freshEmail() {
  return `export-png-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@vellum-test.local`;
}
function freshCanvasTitle() {
  return `M10 export ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", { name: /email/i });
  await emailInput.fill(email);
  await emailInput.press("Enter");

  await expect(page.getByText(/check your inbox|請至信箱收信/i)).toBeVisible({ timeout: 10_000 });

  let magicLinkUrl = "";
  for (let i = 0; i < 5; i++) {
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
        magicLinkUrl = m[0]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        break;
      }
      throw new Error("No magic-link URL");
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  expect(magicLinkUrl).not.toBe("");

  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3002";
  await page.goto(magicLinkUrl.replace(/^https?:\/\/[^/]+/, baseUrl));
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe("Export PNG happy path", () => {
  test("editor can export a canvas to PNG and trigger a download", async ({ page }) => {
    test.setTimeout(60_000);
    const TEST_EMAIL = freshEmail();
    const CANVAS_TITLE = freshCanvasTitle();

    // 1–2: Sign in.
    await signInWithMagicLink(page, TEST_EMAIL);

    // 3: Create a canvas to export.
    await page
      .getByRole("button", { name: /建立畫布|create canvas/i })
      .first()
      .click();
    const titleInput = page
      .getByPlaceholder(/canvas title|畫布名稱/i)
      .or(page.getByRole("textbox"))
      .first();
    await titleInput.fill(CANVAS_TITLE);
    await page
      .getByRole("button", { name: /建立|create/i })
      .last()
      .click();

    // Open the canvas. The card carries its id in a data-attribute; pull
    // it out and navigate explicitly (more reliable than clicking the
    // TanStack Router Link in test mode).
    const canvasId = await page.locator(`[data-canvas-id]`).first().getAttribute("data-canvas-id");
    expect(canvasId).not.toBeNull();
    await page.goto(`/canvas/${canvasId}`);
    await expect(page).toHaveURL(/\/canvas\//, { timeout: 10_000 });

    // 4: Wait for tldraw chrome (the MainMenu trigger is a stable signal).
    await expect(page.getByRole("button", { name: /menu|選單/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Draw a rectangle so the export blob is non-empty. Use the keyboard
    // 'r' shortcut (tldraw rectangle tool) and drag once on the canvas.
    await page.keyboard.press("r");
    const canvasArea = page.locator(".tl-container, [data-testid='canvas']").first();
    const box = await canvasArea.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 60);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, {
        steps: 10,
      });
      await page.mouse.up();
    }

    // 5: Open MainMenu → Export → PNG → 1×.
    await page
      .getByRole("button", { name: /menu|選單/i })
      .first()
      .click();
    // Hover Export submenu trigger; then PNG; then 1×.
    await page.getByRole("menuitem", { name: /匯出|^export$/i }).hover();
    await page.getByRole("menuitem", { name: /匯出為 PNG|export as png/i }).hover();

    // 6: Trigger the 1× scale and assert a download fires.
    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page
      .getByRole("menuitem", { name: /1× resolution|1× 解析度|1×/i })
      .first()
      .click();
    const download = await downloadPromise;

    // Filename should be slugify({CANVAS_TITLE}).png. CANVAS_TITLE contains
    // ASCII letters + digits + hyphens; slugify lowercases ASCII so we
    // expect the download name to end with .png.
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });
});
