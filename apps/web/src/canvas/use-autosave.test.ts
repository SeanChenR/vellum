/**
 * use-autosave.test.ts — Tests for the useAutosave hook.
 *
 * Migrated from Editor.test.tsx task 7.1 (task 9.1 refactor).
 * Tests the hook directly using renderHook from @testing-library/react.
 *
 * Persistence is NOT mocked here. Instead, a tracking storage is injected
 * via _setStorage so we can count saveSnapshot calls and simulate quota
 * errors without polluting the shared ./persistence ESM namespace (which
 * would corrupt persistence.test.ts).
 *
 * Spec: "Editor autosaves snapshots on a debounced cadence and on page unload"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, renderHook, act } from "@testing-library/react";
// Static import — always resolves to real persistence module
import { _setStorage } from "./persistence";

// ---------------------------------------------------------------------------
// Tracking storage
// ---------------------------------------------------------------------------

let setItemCallCount = 0;
let throwQuota = false;

function makeTrackingStorage(): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: (k: string) => localStorage.getItem(k),
    setItem: (k: string, v: string) => {
      setItemCallCount++;
      if (throwQuota) {
        throw new DOMException("storage quota exceeded", "QuotaExceededError");
      }
      localStorage.setItem(k, v);
    },
  };
}

// ---------------------------------------------------------------------------
// Import after static imports
// ---------------------------------------------------------------------------

const { useAutosave } = await import("./use-autosave");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StoreListener = (entry: unknown) => void;

function makeMockEditor() {
  const listeners: StoreListener[] = [];
  const listenMock = mock((cb: StoreListener) => {
    listeners.push(cb);
    return () => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  });
  const editor = {
    store: { listen: listenMock },
  } as unknown as import("tldraw").Editor;
  return { editor, listeners, listenMock };
}

const fakeSnapshot = { store: {}, schema: {} } as unknown as ReturnType<
  typeof import("tldraw").getSnapshot
>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setItemCallCount = 0;
  throwQuota = false;
  localStorage.clear();
  _setStorage(makeTrackingStorage());
});

afterEach(() => {
  // Restore real localStorage so other test files are unaffected
  _setStorage(localStorage);
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAutosave", () => {
  // (c) burst of changes → single save after 800ms
  test("coalesces multiple store changes into single saveSnapshot after debounce", async () => {
    const { editor, listeners } = makeMockEditor();
    const getSnapshot = mock(() => fakeSnapshot);

    renderHook(() => useAutosave({ canvasId: "c1", editor, getSnapshot }));

    await act(async () => {
      for (let i = 0; i < 5; i++) {
        for (const listener of listeners) listener({ source: "user" });
        // eslint-disable-next-line no-await-in-loop -- intentional: spacing between fake events
        await new Promise((r) => setTimeout(r, 50));
      }
    });

    // Still in debounce window — should not have saved yet
    expect(setItemCallCount).toBe(0);

    // Advance past 800ms debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(setItemCallCount).toBe(1);
    // Verify the key has the correct canvasId prefix
    const stored = localStorage.getItem("vellum:canvas:c1:snapshot");
    expect(stored).not.toBeNull();
  });

  // (d) beforeunload flushes pending write
  test("beforeunload flushes pending debounced save synchronously", async () => {
    const { editor, listeners } = makeMockEditor();
    const getSnapshot = mock(() => fakeSnapshot);

    renderHook(() => useAutosave({ canvasId: "c1", editor, getSnapshot }));

    await act(async () => {
      for (const listener of listeners) listener({ source: "user" });
    });

    // Not yet saved (within debounce window)
    expect(setItemCallCount).toBe(0);

    window.dispatchEvent(new Event("beforeunload"));

    // Flush should be synchronous
    expect(setItemCallCount).toBe(1);
  });

  // (e) quota failure stops further writes
  test("quota failure blocks further saves", async () => {
    throwQuota = true;
    const { editor, listeners } = makeMockEditor();
    const getSnapshot = mock(() => fakeSnapshot);

    renderHook(() => useAutosave({ canvasId: "c1", editor, getSnapshot }));

    // First change — debounce fires, setItem throws, quota is detected
    await act(async () => {
      for (const listener of listeners) listener({ source: "user" });
      await new Promise((r) => setTimeout(r, 900));
    });

    // setItem was attempted (and failed)
    expect(setItemCallCount).toBeGreaterThanOrEqual(1);
    const callsAfterFirst = setItemCallCount;

    // Second change — quota flag is set, so no new save attempt
    await act(async () => {
      for (const listener of listeners) listener({ source: "user" });
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(setItemCallCount).toBe(callsAfterFirst);
  });
});
