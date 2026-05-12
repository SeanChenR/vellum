/**
 * agent-setup.ts — shared e2e setup helpers for the AI Side Panel specs.
 *
 * The three agent specs (cancel / multi-tab-badge / rate-limit-toast) each
 * need:
 *   1. A signed-in user (magic-link via Mailpit)
 *   2. A canvas they own
 *   3. A BYOK key configured for the run's provider
 *
 * Centralising the three flows here keeps the assertion bodies of each
 * spec readable and avoids drift when the dashboard / dialog UI moves.
 */

import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";

const MAILPIT_API = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";

/**
 * Pick which BYOK provider the agent specs should use, based on env vars
 * the developer (or CI) set. The first matching provider wins; if none
 * is set, returns null and the calling test SHALL `test.skip`.
 *
 * Accepts either an OpenAI or Gemini key — both providers expose enough
 * of the agent tool surface for the assertion bodies to run, and they
 * support BYOK validation. Anthropic is not yet wired here because the
 * agent run prompt set is small and one provider is enough to cover
 * the streaming / cancel / rate-limit paths.
 */
export function pickEnabledByokKey(): { provider: "openai" | "google"; apiKey: string } | null {
  const openai = process.env["E2E_TEST_USER_BYOK_OPENAI"];
  if (openai) return { provider: "openai", apiKey: openai };
  const gemini = process.env["E2E_TEST_USER_BYOK_GEMINI"];
  if (gemini) return { provider: "google", apiKey: gemini };
  return null;
}

/**
 * Sign a user in via magic-link by reading the email from Mailpit and
 * visiting the verify URL. The user is auto-provisioned on first
 * sign-in. The dev API rate-limit can be bypassed by setting
 * DISABLE_AUTH_RATE_LIMIT=1 on the upstream dev process.
 */
export async function signInWithMagicLink(page: Page, email: string): Promise<void> {
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

/**
 * Create a canvas via the dashboard dialog and navigate into it. Returns
 * the canvas id and the full canvas URL. The flow mirrors what a real
 * user does: click "Create canvas" → fill title → submit → click the
 * new card on the dashboard.
 */
export async function createCanvasViaDashboard(
  page: Page,
  title: string,
): Promise<{ canvasId: string; canvasUrl: string }> {
  await page
    .getByRole("button", { name: /create canvas|建立畫布/i })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByRole("textbox").first().fill(title);
  await dialog.getByRole("button", { name: /^create$/i }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  const cardLink = page.locator('a[href^="/canvas/"]').first();
  await cardLink.click();
  await page.waitForURL(/\/canvas\//);
  const canvasUrl = page.url();
  const canvasId = canvasUrl.match(/\/canvas\/([^/?#]+)/)?.[1];
  if (!canvasId) throw new Error(`Could not extract canvasId from ${canvasUrl}`);
  return { canvasId, canvasUrl };
}

/**
 * Save a BYOK key for the signed-in session via the API. The server
 * runs validate-then-encrypt-then-upsert so this hits the provider's
 * validation endpoint (small cost per key save). Returns nothing —
 * subsequent agent runs will pick the key up automatically.
 */
export async function injectByokKey(
  request: APIRequestContext,
  provider: "openai" | "anthropic" | "google",
  apiKey: string,
): Promise<void> {
  const resp = await request.post(`/api/account/byok/${provider}`, {
    data: { apiKey },
  });
  expect(resp.ok()).toBe(true);
}

/**
 * One-shot helper: spin up a fresh browser context, sign in a fresh
 * user, create a canvas, inject a BYOK key, and return the page +
 * canvas details. Used by single-user agent specs.
 */
export async function setupAgentUserAndCanvas(
  browser: Browser,
  byok: { provider: "openai" | "google"; apiKey: string },
  opts: { emailPrefix?: string; canvasTitle?: string } = {},
): Promise<{
  page: Page;
  email: string;
  canvasId: string;
  canvasUrl: string;
  cleanup: () => Promise<void>;
}> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const ts = Date.now();
  const email = `${opts.emailPrefix ?? "agent"}-${ts}@vellum-test.local`;
  await signInWithMagicLink(page, email);
  await injectByokKey(page.request, byok.provider, byok.apiKey);
  const { canvasId, canvasUrl } = await createCanvasViaDashboard(
    page,
    opts.canvasTitle ?? `agent-spec-${ts}`,
  );
  return {
    page,
    email,
    canvasId,
    canvasUrl,
    cleanup: async () => {
      await ctx.close();
    },
  };
}
