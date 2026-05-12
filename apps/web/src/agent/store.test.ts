/**
 * store.test.ts — Zustand AI Side Panel store.
 *
 * Spec ref: ai-side-panel "Side Panel docks into Editor and is collapsible"
 */

import { afterEach, describe, expect, test } from "bun:test";
import { useAiPanelStore } from "./store";

afterEach(() => {
  useAiPanelStore.setState({
    panelOpen: false,
    composerDraft: "",
    activeThreadId: null,
  });
});

describe("useAiPanelStore", () => {
  test("default state: panel closed, no draft, no active thread", () => {
    const s = useAiPanelStore.getState();
    expect(s.panelOpen).toBe(false);
    expect(s.composerDraft).toBe("");
    expect(s.activeThreadId).toBe(null);
  });

  test("togglePanel flips panelOpen", () => {
    useAiPanelStore.getState().togglePanel();
    expect(useAiPanelStore.getState().panelOpen).toBe(true);
    useAiPanelStore.getState().togglePanel();
    expect(useAiPanelStore.getState().panelOpen).toBe(false);
  });

  test("setComposerDraft replaces draft text", () => {
    useAiPanelStore.getState().setComposerDraft("create a markdown shape");
    expect(useAiPanelStore.getState().composerDraft).toBe("create a markdown shape");
  });

  test("setActiveThreadId tracks the active thread", () => {
    useAiPanelStore.getState().setActiveThreadId("t1");
    expect(useAiPanelStore.getState().activeThreadId).toBe("t1");
    useAiPanelStore.getState().setActiveThreadId(null);
    expect(useAiPanelStore.getState().activeThreadId).toBe(null);
  });
});
