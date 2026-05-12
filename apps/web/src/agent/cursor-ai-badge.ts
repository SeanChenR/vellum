/**
 * cursor-ai-badge.ts — mirrors the local agent run lifecycle onto the
 * tldraw instance state's `meta.aiActive` flag.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "Cursor AI Badge surfaces aiActive presence flag"
 *
 * Why `updateInstanceState({ meta })` and NOT `user.updateUserPreferences({ meta })`:
 *   tldraw 4.5 `TLUserPreferences` has no `meta` field — the runtime
 *   schema validator rejects it with "At meta: Unexpected property".
 *   `TLInstance.meta: JsonObject` IS a real field, so it is the correct
 *   write target.
 *
 * Known limitation (M15+ follow-up):
 *   `TLInstance` is NOT broadcast through tldraw sync — only
 *   `TLInstancePresence` is. So today this only writes the local flag;
 *   cross-tab cursor badge on remote avatars needs a direct
 *   `editor.store.put` on the local `TLInstancePresence` record with a
 *   merged `meta` object. Deferred so the panel ships unblocked.
 */

import { useEffect } from "react";
import type { AgentRunState } from "./useAgentRun";

/**
 * Minimal surface this file touches on the tldraw editor — keeps tests
 * free of full tldraw type wiring. The real `Editor` from "tldraw"
 * satisfies this shape via `editor.updateInstanceState`.
 */
export interface AiBadgeEditor {
  updateInstanceState(partial: { meta?: Record<string, unknown> }): void;
}

/**
 * Reflects the agent run's lifecycle into instance state:
 *   running       → meta.aiActive = true
 *   any terminal  → meta.aiActive = false
 *   no editor     → noop (Editor is still mounting)
 *
 * Idempotent — repeated calls with the same state do not spam updates
 * beyond what tldraw's diffing already handles.
 */
export function useCursorAiBadge(editor: AiBadgeEditor | null, state: AgentRunState): void {
  useEffect(() => {
    if (!editor) return;
    const aiActive = state === "running";
    editor.updateInstanceState({ meta: { aiActive } });
  }, [editor, state]);
}

/**
 * Pure helper exposed for testing — given a run state, return whether the
 * cursor badge should be set true. Centralised so behavior is testable
 * without faking tldraw editor wiring.
 */
export function shouldShowAiBadge(state: AgentRunState): boolean {
  return state === "running";
}
