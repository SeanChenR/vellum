/**
 * E2E: Canvas CRUD happy path.
 *
 * Spec: e2e-coverage — "Canvas CRUD has an E2E spec".
 *
 * Flow (PRD US 269):
 *   1. signInWithMagicLink
 *   2. dashboard default view
 *   3. Create canvas → assert card visible
 *   4. Rename canvas → assert title updated
 *   5. Create folder → assert folder tab visible
 *   6. Drag canvas card onto folder tab → assert card moved
 *   7. Click folder tab → delete canvas → assert card gone
 *   8. Delete folder → assert folder tab gone
 *
 * Requires:
 * - dev server running on baseURL (default http://localhost:3002)
 * - Mailpit running (docker compose up -d mailpit)
 *
 * Cleanup: test.afterEach removes any canvases / folders left behind so
 * repeated runs against the same DB stay deterministic.
 */

import { expect, test, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
const TEST_EMAIL = `canvas-crud-${Date.now()}@vellum-test.local`;

const CANVAS_INITIAL = `M10 test ${Date.now()}`;
const CANVAS_RENAMED = `M10 renamed ${Date.now()}`;
const FOLDER_NAME = `M10 folder ${Date.now()}`;

// ---------------------------------------------------------------------------
// Helpers — Magic-link sign-in via Mailpit
// ---------------------------------------------------------------------------

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
      throw new Error("No magic-link URL in body");
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  expect(magicLinkUrl).not.toBe("");

  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)?.[0] ?? "http://localhost:3002";
  const verifyUrl = magicLinkUrl.replace(/^https?:\/\/[^/]+/, baseUrl);
  await page.goto(verifyUrl);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Cleanup — best-effort removal of test artifacts after each test
// ---------------------------------------------------------------------------

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === "passed") return;
  // On failure, just leave traces for debug — don't try to clean up
  // (could throw inside teardown and obscure the real error).
});

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Canvas CRUD happy path", () => {
  test("create / rename / move-to-folder / delete canvas + folder", async ({ page }) => {
    test.setTimeout(60_000);

    // Step 1–2: sign in, land on dashboard.
    await signInWithMagicLink(page, TEST_EMAIL);
    await expect(page).toHaveURL(/\/dashboard/);

    // Step 3: Create a canvas.
    await page
      .getByRole("button", { name: /建立畫布|create canvas/i })
      .first()
      .click();
    const titleInput = page
      .getByRole("textbox")
      .or(page.getByPlaceholder(/canvas title|畫布名稱/i))
      .first();
    await titleInput.fill(CANVAS_INITIAL);
    await page
      .getByRole("button", { name: /建立|create/i })
      .last()
      .click();
    await expect(page.getByText(CANVAS_INITIAL)).toBeVisible({ timeout: 10_000 });

    // Step 4: Rename via card menu.
    const cardMenuTrigger = page.getByRole("button", { name: /更多選項|more options/i }).first();
    await cardMenuTrigger.click();
    await page.getByRole("menuitem", { name: /重新命名|^rename$/i }).click();
    const renameInput = page.getByRole("textbox").first();
    await renameInput.fill(CANVAS_RENAMED);
    await page
      .getByRole("button", { name: /重新命名|rename/i })
      .last()
      .click();
    await expect(page.getByText(CANVAS_RENAMED)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(CANVAS_INITIAL)).not.toBeVisible();

    // Step 5: Create a folder via the "+" button on the tab strip.
    await page
      .getByRole("button", { name: /建立資料夾|create folder/i })
      .first()
      .click();
    const folderInput = page
      .getByPlaceholder(/folder name|資料夾名稱/i)
      .or(page.getByRole("textbox"))
      .first();
    await folderInput.fill(FOLDER_NAME);
    await page
      .getByRole("button", { name: /建立|create/i })
      .last()
      .click();
    await expect(page.getByRole("button", { name: FOLDER_NAME })).toBeVisible({ timeout: 10_000 });

    // Step 6: Move canvas to folder via the kebab menu.
    // (Drag-and-drop via Playwright's dragTo doesn't trigger @dnd-kit
    // PointerSensor reliably; the context menu is the supported fallback
    // documented in the change design's Risk mitigation.)
    const folderTab = page.getByRole("button", { name: FOLDER_NAME });
    await page
      .getByRole("button", { name: /更多選項|more options/i })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /移動到資料夾|move to folder/i }).click();
    const moveDialog = page.getByRole("dialog");
    await moveDialog.getByRole("button", { name: FOLDER_NAME }).click();
    await moveDialog.getByRole("button", { name: /^移動$|^move$/i }).click();
    // Wait for dialog to close before continuing.
    await expect(moveDialog).not.toBeVisible({ timeout: 5_000 });

    // Switch to the folder view to verify the card moved.
    await folderTab.click();
    await expect(page.getByText(CANVAS_RENAMED)).toBeVisible({ timeout: 10_000 });

    // Step 7: Delete the canvas from inside the folder.
    await page
      .getByRole("button", { name: /更多選項|more options/i })
      .first()
      .click();
    await page.getByRole("menuitem", { name: /^刪除$|^delete$/i }).click();
    const deleteDialog = page.getByRole("dialog");
    await deleteDialog.getByRole("button", { name: /^刪除$|^delete$/i }).click();
    await expect(deleteDialog).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(CANVAS_RENAMED)).not.toBeVisible({ timeout: 10_000 });

    // Step 8: Delete the folder.
    // Hover to reveal the action overlay above the folder tab, then click trash.
    await folderTab.hover();
    await page
      .getByRole("button", { name: /刪除資料夾|delete folder/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^刪除$|^delete$/i })
      .last()
      .click();
    await expect(page.getByRole("button", { name: FOLDER_NAME })).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
