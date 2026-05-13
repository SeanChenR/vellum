/**
 * cursor-ai-badge.test.ts — verifies that mounting the hook flips the
 * shared `aiActiveAtom` and unmounting clears it.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 *
 * Architecture note:
 *   The atom is read inside `useSyncStore`'s `getUserPresence` override
 *   so tldraw's presence derivation injects `meta.aiActive` into the
 *   local presence record. Sync broadcasts the record. We DO NOT write
 *   to the store directly — the previous attempt was overwritten on the
 *   next reactive tick because `getDefaultUserPresence` hard-codes
 *   `meta: {}`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderHook, cleanup } from "@testing-library/react";
import { aiActiveAtom } from "../canvas/ai-active-signal";
import { useCursorAiBadge } from "./cursor-ai-badge";

afterEach(() => cleanup());
beforeEach(() => {
  // Reset between tests so leakage from one test never reaches the next.
  aiActiveAtom.set(false);
});

describe("useCursorAiBadge", () => {
  test("sets the atom to true on mount", () => {
    expect(aiActiveAtom.get()).toBe(false);
    renderHook(() => useCursorAiBadge());
    expect(aiActiveAtom.get()).toBe(true);
  });

  test("clears the atom on unmount", () => {
    const { unmount } = renderHook(() => useCursorAiBadge());
    expect(aiActiveAtom.get()).toBe(true);
    unmount();
    expect(aiActiveAtom.get()).toBe(false);
  });

  test("respects an explicit active=false (caller wants no flag while mounted)", () => {
    renderHook(() => useCursorAiBadge(false));
    expect(aiActiveAtom.get()).toBe(false);
  });

  test("toggling active prop updates the atom reactively", () => {
    const { rerender } = renderHook((p: { active: boolean }) => useCursorAiBadge(p.active), {
      initialProps: { active: true },
    });
    expect(aiActiveAtom.get()).toBe(true);
    rerender({ active: false });
    expect(aiActiveAtom.get()).toBe(false);
    rerender({ active: true });
    expect(aiActiveAtom.get()).toBe(true);
  });
});
