/**
 * ai-active-signal.ts — single shared `aiActiveAtom` instance that both
 * the producer (`useCursorAiBadge` in the AI Side Panel) and the
 * consumer (`useSyncStore`'s `getUserPresence` override) read.
 *
 * Why a `@tldraw/state` atom (not React state, Zustand, or a plain bool):
 *   The presence broadcaster reads the value inside tldraw's
 *   `getUserPresence` reactive computation. It MUST be a tldraw signal
 *   so any change invalidates the computed presence record and triggers
 *   a re-broadcast over sync. React state / Zustand are invisible to
 *   tldraw's reactivity layer.
 *
 * Why parked on `window` instead of a plain module-level `export`:
 *   Vite HMR can hot-swap a module, and pnpm/bun pnp/dedup can sometimes
 *   resolve the same import path to two distinct module instances when
 *   different bundle chunks import it. Either case produces two separate
 *   atoms — the producer writes to A, the consumer reads B, and the
 *   flag never propagates. Pinning the atom on `window` collapses both
 *   to one instance regardless of bundling.
 *
 * Spec ref: openspec/specs/ai-side-panel/spec.md
 *   "Cursor AI Badge surfaces aiActive presence flag"
 */

import { atom, type Atom } from "tldraw";

declare global {
  interface Window {
    __vellumAiActiveAtom?: Atom<boolean>;
  }
}

function resolveAtom(): Atom<boolean> {
  // SSR / non-browser fallback — module-local atom is fine because no
  // browser code is running.
  if (typeof window === "undefined") return atom("vellum:ai-active", false);
  if (!window.__vellumAiActiveAtom) {
    window.__vellumAiActiveAtom = atom("vellum:ai-active", false);
  }
  return window.__vellumAiActiveAtom;
}

export const aiActiveAtom: Atom<boolean> = resolveAtom();
