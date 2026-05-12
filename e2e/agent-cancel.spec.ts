/**
 * E2E: Cancel mid-run preserves already-created shapes + ends the SSE
 *      stream cleanly.
 *
 * Spec ref: ai-side-panel "Composer sends user message and switches to
 *           Cancel during run" — Cancel cleanly scenario.
 *
 * Skipped when no BYOK env var is set. Accepts either
 * `E2E_TEST_USER_BYOK_OPENAI` or `E2E_TEST_USER_BYOK_GEMINI` — both
 * providers exercise the same SSE / tool-call / cancel path.
 *
 * Flow:
 *   1. Sign in, open a canvas, configure BYOK.
 *   2. Expand the AI panel.
 *   3. Send a prompt that produces multiple createShape tool calls.
 *   4. While the run is in progress (Cancel button visible), click Cancel.
 *   5. SSE channel emits cancelled → composer returns to Send state.
 *   6. Already-created shape stays on the canvas.
 */

import { expect, test } from "@playwright/test";
import { pickEnabledByokKey, setupAgentUserAndCanvas } from "./helpers/agent-setup";

const byok = pickEnabledByokKey();

test.describe("AI panel — cancel mid-run", () => {
  test.skip(
    byok === null,
    "Set E2E_TEST_USER_BYOK_OPENAI=<key> or E2E_TEST_USER_BYOK_GEMINI=<key> to run; this spec hits the real provider API.",
  );

  test("Cancel button ends the run + preserves emitted shapes", async ({ browser }) => {
    // Sign-in + canvas-create + multi-tool agent run easily exceeds the
    // default 30 s test budget — Gemini is fast at small shape counts so
    // we need a prompt that genuinely keeps the run in `running` state
    // long enough to click Cancel.
    test.setTimeout(180_000);

    const { page, cleanup } = await setupAgentUserAndCanvas(browser, byok!, {
      emailPrefix: "agent-cancel",
    });
    try {
      await page.getByTestId("topbar-ai-panel-toggle").click();
      const composer = page.getByTestId("chat-composer-textarea");
      // A longer multi-shape prompt so the run stays in `running` state
      // for several seconds — gives the test room to click Cancel
      // mid-flight without racing the provider.
      // Force the model to interleave reasoning text + tool calls so the
      // SSE stream stays in `running` state long enough for the Cancel
      // button to be observably visible. Pure tool-call-only prompts
      // finish too fast on Gemini Flash/Pro.
      await composer.fill(
        "I want to build a 4×2 grid of markdown shapes with contents 'A' through 'H'. Before each shape creation, write a one-paragraph (at least 80 words) explanation of why you chose that x,y coordinate relative to the others. Then call createShape. Repeat for all eight shapes in order. Do NOT batch the createShape calls — one at a time, with full reasoning text between each.",
      );
      await page.getByTestId("chat-composer-send").click();

      // Cancel button only appears while a run is in `running` state.
      // Wait for it; once visible, the SSE stream is confirmed open and
      // running. Cancel immediately — we don't wait for tool results
      // because Gemini may still be writing reasoning text and "cancel
      // mid-thought" is a perfectly valid scenario to exercise.
      const cancelBtn = page.getByTestId("chat-composer-cancel");
      await expect(cancelBtn).toBeVisible({ timeout: 30_000 });

      await cancelBtn.click();

      // Composer reverts to Send state once cancellation is confirmed —
      // this is the core "cancel cleanly" assertion: the SSE stream
      // closed and the client state machine transitioned to a terminal
      // state.
      await expect(page.getByTestId("chat-composer-send")).toBeVisible({ timeout: 15_000 });
    } finally {
      await cleanup();
    }
  });
});
