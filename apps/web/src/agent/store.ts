/**
 * store.ts — Zustand store for AI Side Panel UI-only client state.
 *
 * Holds:
 *   - panelOpen: whether the docked panel is expanded (per-canvas localStorage)
 *   - composerDraft: textarea content during typing (not synced to server)
 *   - activeThreadId: currently focused thread id (mirrored from URL when present)
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "Side Panel docks into Editor and is collapsible"
 */

import { create } from "zustand";

export interface AiPanelState {
  panelOpen: boolean;
  composerDraft: string;
  activeThreadId: string | null;
  togglePanel(): void;
  setPanelOpen(open: boolean): void;
  setComposerDraft(draft: string): void;
  setActiveThreadId(id: string | null): void;
}

export const useAiPanelStore = create<AiPanelState>((set) => ({
  panelOpen: false,
  composerDraft: "",
  activeThreadId: null,
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setComposerDraft: (draft) => set({ composerDraft: draft }),
  setActiveThreadId: (id) => set({ activeThreadId: id }),
}));
