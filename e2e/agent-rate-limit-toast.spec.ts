/**
 * E2E: Rate-limited 6th run shows a toast with the rateLimited errorKey.
 *
 * Spec ref: ai-side-panel "Rate limit response shows toast with errorKey translation"
 *
 * Skipped when no BYOK env var is set. Accepts either
 * `E2E_TEST_USER_BYOK_OPENAI` or `E2E_TEST_USER_BYOK_GEMINI`.
 * Sending 6 short runs per spec consumes a small amount of quota — the
 * server-side rule is 5/60s per user, so the 6th MUST be 429.
 *
 * Flow:
 *   1. Sign in + open canvas + configure BYOK.
 *   2. Expand the AI panel.
 *   3. Burn the per-user run quota with 5 direct POSTs (faster than the
 *      UI Send round-trip so all 5 land inside the 60s window).
 *   4. Click Send for the 6th — the server returns 429 with the
 *      rateLimited errorKey and the UI surfaces a localized toast.
 *   5. The typed prompt MUST remain in the composer for retry.
 */

import { expect, test } from "@playwright/test";
import { pickEnabledByokKey, setupAgentUserAndCanvas } from "./helpers/agent-setup";

const byok = pickEnabledByokKey();

test.describe("AI panel — rate limit 429 surfaces a localized toast", () => {
  test.skip(
    byok === null,
    "Set E2E_TEST_USER_BYOK_OPENAI=<key> or E2E_TEST_USER_BYOK_GEMINI=<key> to run; this spec hits the real provider API.",
  );

  test("sixth run within 60s shows agent.error.rateLimited toast", async ({ browser }) => {
    test.setTimeout(120_000);
    const { page, canvasId, cleanup } = await setupAgentUserAndCanvas(browser, byok!, {
      emailPrefix: "agent-rate-limit",
    });
    try {
      await page.getByTestId("topbar-ai-panel-toggle").click();
      await expect(page.getByTestId("ai-side-panel")).toBeVisible();

      // Find the active thread so the bursts target a valid threadId.
      const threadsResp = await page.request.get(`/api/agent/threads/canvas/${canvasId}`);
      expect(threadsResp.ok()).toBe(true);
      const threadsBody = (await threadsResp.json()) as {
        data: { activeThreadId: string };
      };
      const threadId = threadsBody.data.activeThreadId;

      // Burn 5/5 of the per-user quota via direct POSTs. Each request
      // pulls one token from the bucket; the 6th UI Send below sees an
      // empty bucket and gets 429.
      const cheapestModel = byok!.provider === "google" ? "gemini-2.5-flash-lite" : "gpt-4o-mini";
      for (let i = 1; i <= 5; i++) {
        await page.request.post(`/api/agent/canvas/${canvasId}/run`, {
          data: {
            runId: crypto.randomUUID(),
            provider: byok!.provider,
            model: cheapestModel,
            threadId,
            userMessage: `quota-burn ${i}`,
          },
        });
      }

      // 6th — must be rejected with 429 + rateLimited errorKey, which
      // surfaces as a toast in the UI.
      const composer = page.getByTestId("chat-composer-textarea");
      await composer.fill("hi 6");
      await page.getByTestId("chat-composer-send").click();

      // Toast appears via testid (locale-agnostic) and contains the
      // localized message body.
      const toast = page.getByTestId("agent-error-toast");
      await expect(toast).toBeVisible({ timeout: 10_000 });
      await expect(toast).toContainText(/短時間內 AI 請求次數過多|Too many AI requests/i);

      // Composer preserves the typed text so the user can retry.
      await expect(composer).toHaveValue("hi 6");
    } finally {
      await cleanup();
    }
  });
});
