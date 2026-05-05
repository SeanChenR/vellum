/**
 * Editor.test.tsx — TDD tests for the sync-aware Editor (task 4.4).
 *
 * Covers spec requirement:
 *   "Editor mounts with a multiplayer-aware sync store"
 *
 * Strategy: Editor uses `useSyncStore(canvasId)` to obtain a tldraw sync
 * store. We mock the hook so each test controls the returned status (and
 * thus the Editor's render branch) without spinning up a real WebSocket.
 *
 * The localStorage persistence module is NOT touched; the Editor MUST NOT
 * import or call `loadSnapshot` / `saveSnapshot` after this change.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

let capturedTldrawProps: Record<string, unknown> = {};
let capturedChromeValue: { mainMenu?: Record<string, unknown> } | null = null;

mock.module("tldraw", () => ({
  Tldraw: (props: Record<string, unknown>) => {
    capturedTldrawProps = props;
    return null;
  },
  getSnapshot: mock(() => ({ store: {}, schema: {} })),
  createShapeId: () => "shape:test-id",
}));

const fakeShapeUtil = { type: "fake-shape" };
mock.module("@vellum/shared/shape-types", () => ({
  customShapeTools: [],
}));
mock.module("./shapes/shape-utils", () => ({
  customShapeUtilClasses: [fakeShapeUtil],
}));

const ChromeContextMock = React.createContext<unknown>(null);
mock.module("../chrome/index", () => ({
  VellumChromeContext: {
    ...ChromeContextMock,
    Provider: ({
      value,
      children,
    }: {
      value: { mainMenu?: Record<string, unknown> };
      children: React.ReactNode;
    }) => {
      capturedChromeValue = value;
      return React.createElement(ChromeContextMock.Provider, { value }, children);
    },
  },
  vellumChromeComponents: {},
}));

const exportCanvasMock = mock((_opts: unknown) => Promise.resolve());

// useSyncStore mock — controllable per-test via the helper below.
type SyncStatus = "loading" | "ready" | "error";
interface MockSyncStoreResult {
  status: SyncStatus;
  store: unknown | null;
}

let nextSyncResult: MockSyncStoreResult = { status: "loading", store: null };
const useSyncStoreCalls: string[] = [];
const disposedCanvasIds: string[] = [];

mock.module("./use-sync-store", () => ({
  useSyncStore: (canvasId: string) => {
    useSyncStoreCalls.push(canvasId);
    React.useEffect(() => {
      return () => {
        disposedCanvasIds.push(canvasId);
      };
    }, [canvasId]);
    return nextSyncResult;
  },
  useSyncConnectionStore: { getState: () => ({ state: "connecting", attempt: 0 }) },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks
// ---------------------------------------------------------------------------

const { Editor } = await import("./Editor");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEditorProps(overrides = {}) {
  return {
    canvasId: "c1",
    title: "Test Canvas",
    folder: null,
    ownerId: "u1",
    onRenameSubmit: mock((_t: string) => {}),
    onDuplicate: mock(() => {}),
    onDelete: mock(() => {}),
    currentUser: {
      id: "u1",
      email: "user@example.com",
      name: "Test User",
      image: null,
      locale: "en" as const,
      createdAt: new Date().toISOString(),
    },
    onSignOut: mock(() => {}),
    exportCanvasImpl: exportCanvasMock,
    ...overrides,
  };
}

function renderEditor(overrides = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <Editor {...makeEditorProps(overrides)} />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedTldrawProps = {};
  capturedChromeValue = null;
  exportCanvasMock.mockClear();
  useSyncStoreCalls.length = 0;
  disposedCanvasIds.length = 0;
  nextSyncResult = { status: "loading", store: null };
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Hook wiring
// ---------------------------------------------------------------------------

describe("Editor — sync store hook wiring", () => {
  test("Editor calls useSyncStore exactly once with the canvas id", () => {
    nextSyncResult = { status: "loading", store: null };
    renderEditor({ canvasId: "canvas-xyz" });
    expect(useSyncStoreCalls).toContain("canvas-xyz");
    expect(useSyncStoreCalls).toHaveLength(1);
  });

  test("Editor does NOT pass a `snapshot` prop derived from localStorage to tldraw", () => {
    nextSyncResult = {
      status: "ready",
      store: { id: "fake-store" },
    };
    renderEditor();
    // The new Editor MUST NOT supply `snapshot` — the sync store carries
    // initial state through tldraw's `store` prop.
    expect(capturedTldrawProps["snapshot"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("Editor — loading state until the sync store is ready", () => {
  test("renders a loading indicator and does NOT mount tldraw while status=loading", () => {
    nextSyncResult = { status: "loading", store: null };
    renderEditor();
    expect(capturedTldrawProps).toEqual({});
  });

  test("mounts tldraw with the sync store once status=ready", () => {
    const fakeStore = { id: "fake-store" };
    nextSyncResult = { status: "ready", store: fakeStore };
    renderEditor();
    expect(capturedTldrawProps["store"]).toBe(fakeStore);
  });
});

// ---------------------------------------------------------------------------
// Mount / dispose lifecycle
// ---------------------------------------------------------------------------

describe("Editor — remount on canvas id change", () => {
  test("changing canvasId disposes the previous sync store and reacquires for the new id", () => {
    nextSyncResult = { status: "ready", store: { id: "store-1" } };
    const { rerender } = renderEditor({ canvasId: "c1" });
    expect(useSyncStoreCalls).toEqual(["c1"]);

    nextSyncResult = { status: "ready", store: { id: "store-2" } };
    rerender(
      <I18nextProvider i18n={i18n}>
        <Editor {...makeEditorProps({ canvasId: "c2" })} />
      </I18nextProvider>,
    );
    // Cleanup ran for c1; useSyncStore re-invoked with c2.
    expect(disposedCanvasIds).toContain("c1");
    expect(useSyncStoreCalls).toContain("c2");
  });
});

// ---------------------------------------------------------------------------
// Tldraw integration props (still required after migration)
// ---------------------------------------------------------------------------

describe("Editor — tldraw props once mounted", () => {
  test("passes customShapeUtils from shape-types registry to Tldraw", () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor();
    const shapeUtils = capturedTldrawProps["shapeUtils"] as unknown[];
    expect(Array.isArray(shapeUtils)).toBe(true);
    expect(shapeUtils).toContain(fakeShapeUtil);
  });

  test("passes options.maxPages=1 to disable multi-page", () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor();
    const options = capturedTldrawProps["options"] as { maxPages?: number };
    expect(options).toBeDefined();
    expect(options.maxPages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6.1 mainMenu.onExport wiring — invokes exportCanvas with editor + slug filename
// ---------------------------------------------------------------------------

describe("Editor — mainMenu.onExport wiring (task 6.1)", () => {
  test("onExport(format, scale) calls exportCanvas with the captured editor and slugified title", async () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor({ title: "My  Doc!!!" });

    const onMount = capturedTldrawProps["onMount"] as (e: unknown) => void;
    expect(typeof onMount).toBe("function");
    const fakeEditor = {
      updateInstanceState: () => {},
      registerExternalContentHandler: () => {},
    };
    await act(async () => {
      onMount(fakeEditor);
    });

    const mainMenu = capturedChromeValue?.mainMenu as
      | {
          onExport?: (f: string, s?: number) => Promise<void>;
          isReadOnly?: boolean;
        }
      | undefined;
    expect(mainMenu?.onExport).toBeDefined();

    await mainMenu!.onExport!("png", 2);

    expect(exportCanvasMock).toHaveBeenCalledTimes(1);
    const arg = exportCanvasMock.mock.calls[0]![0] as {
      editor: unknown;
      format: string;
      scale?: number;
      filename: string;
    };
    expect(arg.format).toBe("png");
    expect(arg.scale).toBe(2);
    // Real slugify: "My  Doc!!!" → lowercase → collapse non-allowed → trim → "my-doc"
    expect(arg.filename).toBe("my-doc");
    // editor reference is the same object onMount captured
    expect(arg.editor).toBe(fakeEditor);
  });

  test("onExport before tldraw mounts throws (no editor instance yet)", async () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor({ title: "doc" });
    // intentionally do NOT invoke onMount

    const mainMenu = capturedChromeValue?.mainMenu as {
      onExport?: (f: string, s?: number) => Promise<void>;
    };
    await expect(mainMenu!.onExport!("svg")).rejects.toThrow();
    expect(exportCanvasMock).not.toHaveBeenCalled();
  });

  test("isReadOnly is forwarded to mainMenu (true when effectiveRole=viewer)", () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor({ effectiveRole: "viewer" });
    const mainMenu = capturedChromeValue?.mainMenu as { isReadOnly?: boolean };
    expect(mainMenu?.isReadOnly).toBe(true);
  });

  test("isReadOnly is false when effectiveRole=editor", () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    renderEditor({ effectiveRole: "editor" });
    const mainMenu = capturedChromeValue?.mainMenu as { isReadOnly?: boolean };
    expect(mainMenu?.isReadOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7.2 exportCanvas rejection does not crash Editor
// ---------------------------------------------------------------------------

describe("Editor — export rejection handling (task 7.2)", () => {
  test("exportCanvas rejection bubbles up so the chrome adapter can surface a toast", async () => {
    nextSyncResult = { status: "ready", store: { id: "ok" } };
    exportCanvasMock.mockImplementationOnce(() => Promise.reject(new Error("export.empty")));
    renderEditor({ title: "doc" });

    const onMount = capturedTldrawProps["onMount"] as (e: unknown) => void;
    await act(async () => {
      onMount({ updateInstanceState: () => {}, registerExternalContentHandler: () => {} });
    });

    const mainMenu = capturedChromeValue?.mainMenu as {
      onExport?: (f: string, s?: number) => Promise<void>;
    };
    await expect(mainMenu!.onExport!("pdf", 4)).rejects.toThrow("export.empty");
    // Editor itself does NOT crash — it remains rendered after the rejection.
    expect(capturedChromeValue).not.toBeNull();
  });
});
