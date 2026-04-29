/**
 * Editor.test.tsx — TDD tests for snapshot loading and tldraw prop wiring.
 *
 * Strategy: Editor.tsx uses <Tldraw> which is a heavyweight DOM component.
 * We mock tldraw so tests run fast. The mock captures props for assertion.
 *
 * Persistence is NOT mocked here. Instead, we inject a custom storage via
 * _setStorage so that loadSnapshot returns controlled values without
 * polluting the shared ./persistence ESM namespace (which would break
 * persistence.test.ts).
 *
 * Autosave behaviour (debounce / beforeunload / quota) is tested in
 * use-autosave.test.ts — not duplicated here.
 *
 * Spec: "Editor autosaves snapshots on a debounced cadence and on page unload"
 * Spec: "Single-page document and custom shape registry are wired at the integration point"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
// Static import — always resolves to real persistence (no module mock registered)
import { _setStorage } from "./persistence";

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

// Track what props were passed to <Tldraw>
let capturedTldrawProps: Record<string, unknown> = {};

mock.module("tldraw", () => ({
  Tldraw: (props: Record<string, unknown>) => {
    capturedTldrawProps = props;
    // Simulate onMount once (matches real tldraw lifecycle — fires on mount only).
    React.useEffect(() => {
      if (typeof props.onMount === "function") {
        (props.onMount as (e: unknown) => void)({
          store: { listen: () => () => {} },
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  },
  getSnapshot: mock(() => ({ store: {}, schema: {} })),
}));

// Mock shape-types registry
const fakeShapeUtil = { type: "fake-shape" };
mock.module("@vellum/shared/shape-types", () => ({
  customShapeUtils: [fakeShapeUtil],
  customShapeTools: [],
}));

// Mock chrome context (avoids needing full chrome tree)
mock.module("../chrome/index", () => ({
  VellumChromeContext: React.createContext(null),
  vellumChromeComponents: {},
}));

// Mock use-autosave — autosave is tested in use-autosave.test.ts; here it
// should be a no-op so it doesn't interfere with snapshot assertions.
mock.module("./use-autosave", () => ({
  useAutosave: mock(() => {}),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER setting up mocks
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
    onRenameSubmit: mock((_t: string) => {}),
    onDuplicate: mock(() => {}),
    onDelete: mock(() => {}),
    onShareClick: mock(() => {}),
    currentUser: {
      id: "u1",
      email: "user@example.com",
      name: "Test User",
      image: null,
      locale: "en" as const,
      createdAt: new Date().toISOString(),
    },
    onSignOut: mock(() => {}),
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
  localStorage.clear();
  // Restore real localStorage so loadSnapshot reads from it by default
  _setStorage(localStorage);
});

afterEach(() => {
  cleanup();
  // Always restore real localStorage to avoid leaking custom storage
  _setStorage(localStorage);
});

// ---------------------------------------------------------------------------
// Task 7.1 — snapshot loading
// ---------------------------------------------------------------------------

describe("Editor — snapshot loading (task 7.1)", () => {
  // (a) non-null loadSnapshot → passed as initial snapshot to tldraw
  test("loads existing snapshot from persistence on mount", () => {
    const fakeSnapshot = { store: { shapes: [] }, schema: {} };
    // Inject a storage pre-populated with the snapshot for canvasId "c1"
    _setStorage({
      getItem: (k: string) =>
        k === "vellum:canvas:c1:snapshot" ? JSON.stringify(fakeSnapshot) : null,
      setItem: () => {},
    });
    renderEditor();
    expect(capturedTldrawProps["snapshot"]).toEqual(fakeSnapshot);
  });

  // (b) null loadSnapshot → snapshot prop is undefined (empty store)
  test("starts blank when loadSnapshot returns null", () => {
    // localStorage is empty (cleared in beforeEach) → loadSnapshot returns null
    renderEditor();
    expect(
      capturedTldrawProps["snapshot"] === null || capturedTldrawProps["snapshot"] === undefined,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 7.2 — shape registry and single-page (tldraw props)
// ---------------------------------------------------------------------------

describe("Editor — tldraw props (task 7.2)", () => {
  test("passes customShapeUtils from shape-types registry to Tldraw", () => {
    renderEditor();
    const shapeUtils = capturedTldrawProps["shapeUtils"] as unknown[];
    expect(Array.isArray(shapeUtils)).toBe(true);
    expect(shapeUtils).toContain(fakeShapeUtil);
  });

  test("passes options.maxPages=1 to disable multi-page", () => {
    renderEditor();
    const options = capturedTldrawProps["options"] as { maxPages?: number };
    expect(options).toBeDefined();
    expect(options.maxPages).toBe(1);
  });
});
