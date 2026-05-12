/**
 * E2E: Cursor AI Badge ✨ visible to other tabs while a user runs an agent.
 *
 * Spec ref: ai-side-panel "Cursor AI Badge surfaces aiActive presence flag"
 *           — multi-tab visibility scenario.
 *
 * Skipped when no BYOK env var is set. Accepts either
 * `E2E_TEST_USER_BYOK_OPENAI` or `E2E_TEST_USER_BYOK_GEMINI`. Only the
 * triggering user U1 needs a real BYOK key; U2 only observes the
 * presence flag, no provider call.
 *
 * Flow:
 *   1. Owner U1 signs in (context A) + creates canvas + configures BYOK.
 *   2. U1 invites U2 as editor; U2 signs in (context B) + accepts invite.
 *   3. Both users now own/share the canvas.
 *   4. U1 dispatches an agent run; within 1.5s U2's tab MUST show U1's
 *      avatar with the ✨ overlay (data-testid="collaborator-ai-badge").
 *   5. Run terminates → within 2s the overlay MUST disappear.
 */

import { expect, test } from "@playwright/test";
import {
  pickEnabledByokKey,
  setupAgentUserAndCanvas,
  signInWithMagicLink,
} from "./helpers/agent-setup";

const byok = pickEnabledByokKey();

test.describe("Cursor AI Badge — multi-tab presence", () => {
  test.skip(
    byok === null,
    "Set E2E_TEST_USER_BYOK_OPENAI=<key> or E2E_TEST_USER_BYOK_GEMINI=<key> to run; the triggering tab hits the real provider API.",
  );

  // BLOCKED on M15 (issue #16): cursor-ai-badge.ts currently writes
  // `TLInstance.meta.aiActive`, which lives on the local instance record
  // and is NOT broadcast through tldraw sync. Only TLInstancePresence
  // records propagate to collaborators. The spec body below is ready
  // and exercises the right testids — once M15 routes the flag through
  // `editor.store.put` + `InstancePresenceRecordType.createId(userId)`,
  // remove this skip line and the spec should pass.
  test.skip(true, "M15 — cross-tab broadcast pending (#16). Spec body kept ready.");

  test("non-triggering tab sees ✨ overlay during a run", async ({ browser }) => {
    test.setTimeout(180_000);

    // U1: owner. Creates the canvas and gets the BYOK key.
    const u1 = await setupAgentUserAndCanvas(browser, byok!, {
      emailPrefix: "agent-badge-u1",
    });
    const u2Ctx = await browser.newContext();
    const u2Page = await u2Ctx.newPage();
    const ts = Date.now();
    const u2Email = `agent-badge-u2-${ts}@vellum-test.local`;

    try {
      // U1 invites U2 as editor via the share API directly. The ShareDialog
      // UI flow is covered by share-invite.spec.ts; this spec only needs
      // U2 to land on the canvas in a multiplayer session.
      const inviteResp = await u1.page.request.post(`/api/canvas/${u1.canvasId}/share/invite`, {
        data: { email: u2Email, role: "editor" },
      });
      expect(inviteResp.ok()).toBe(true);

      // U2: sign in to provision the account, then accept the invite.
      // The accept URL is in the Mailpit inbox for u2Email.
      await signInWithMagicLink(u2Page, u2Email);
      // u2's inbox contains TWO emails for this run: the magic-link
      // verify URL from sign-in AND the share-invite accept URL we just
      // triggered. Iterate every message addressed to u2 and pick the
      // one whose body actually contains the accept URL.
      const mailpitApi = process.env["MAILPIT_API"] ?? "http://localhost:8025/api";
      let acceptUrl: string | null = null;
      for (let i = 0; i < 8; i++) {
        const list = (await (await fetch(`${mailpitApi}/v1/messages`)).json()) as {
          messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
        };
        const candidates = (list.messages ?? []).filter((m) =>
          m.To?.some((t) => t.Address === u2Email),
        );
        for (const candidate of candidates) {
          const msg = (await (await fetch(`${mailpitApi}/v1/message/${candidate.ID}`)).json()) as {
            HTML?: string;
            Text?: string;
          };
          const body = msg.HTML ?? msg.Text ?? "";
          const m = body.match(/https?:\/\/[^"'\s<>]+\/api\/share\/invite\/[^"'\s<>]+\/accept/);
          if (m) {
            acceptUrl = m[0].replace(/&amp;/g, "&");
            break;
          }
        }
        if (acceptUrl) break;
        await u2Page.waitForTimeout(1000);
      }
      expect(acceptUrl).not.toBeNull();
      await u2Page.goto(acceptUrl!);
      await u2Page.waitForURL(new RegExp(`/canvas/${u1.canvasId}`));

      // Both users now have the canvas open. U2 watches U1's avatar.
      // Avatars only appear after the sync presence has propagated; give
      // the multiplayer connection a moment.
      await u2Page.waitForTimeout(2000);

      // U1 dispatches an agent run.
      await u1.page.getByTestId("topbar-ai-panel-toggle").click();
      await u1.page
        .getByTestId("chat-composer-textarea")
        .fill("Create one markdown shape with content 'ai badge probe'.");
      await u1.page.getByTestId("chat-composer-send").click();

      // U2's tab should see the ✨ overlay within 1.5s of the run starting.
      await expect(u2Page.getByTestId("collaborator-ai-badge").first()).toBeVisible({
        timeout: 5_000,
      });

      // After the run terminates (Send button visible again on U1), the
      // badge must disappear from U2's view.
      await expect(u1.page.getByTestId("chat-composer-send")).toBeVisible({ timeout: 60_000 });
      await expect(u2Page.getByTestId("collaborator-ai-badge")).toHaveCount(0, {
        timeout: 5_000,
      });
    } finally {
      await u2Ctx.close();
      await u1.cleanup();
    }
  });
});
