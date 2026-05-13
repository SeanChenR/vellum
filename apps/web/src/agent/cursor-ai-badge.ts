/**
 * cursor-ai-badge.ts — sets the shared `aiActiveAtom` while mounted so
 * tldraw's presence derivation injects `meta.aiActive=true` into the
 * local presence record. Sync layer broadcasts it; remote tabs read it
 * via `CollaboratorCursorWithBadge`.
 *
 * Why this hook is now atom-only and no longer touches the store:
 *   tldraw's `createPresenceStateDerivation` re-computes the presence
 *   record on every reactive tick from `getDefaultUserPresence`, which
 *   hard-codes `meta: {}`. Direct `store.put` writes are immediately
 *   overwritten. The only durable path is to override the derivation
 *   via `useSync`'s `getUserPresence`, which `use-sync-store.ts` does
 *   by reading from `aiActiveAtom`.
 *
 * Trigger model — mount/unmount:
 *   The caller (`AiSidePanel`) is only mounted while the panel is open,
 *   so mount lifecycle == panel-is-open.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 */

import { useEffect } from "react";
import { aiActiveAtom } from "../canvas/ai-active-signal";

export function useCursorAiBadge(active = true): void {
  useEffect(() => {
    aiActiveAtom.set(active);
    return () => {
      aiActiveAtom.set(false);
    };
  }, [active]);
}
