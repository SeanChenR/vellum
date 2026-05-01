/**
 * CanvasPage.test.tsx — Tests for the CanvasPage route component.
 *
 * Covers spec:
 *   - "Canvas editor route renders Vellum chrome around tldraw" (loading/error states)
 *   - "Share button placeholder triggers a not-yet-available toast"
 *
 * Mocks tldraw (heavy) and useCanvasQuery.  Intentionally does NOT mock:
 *   - "./Editor"        (mocking it would corrupt Editor.test.tsx via shared registry)
 *   - "./persistence"   (mocking it would corrupt persistence.test.ts via materialized ESM namespace)
 *   - "./use-autosave"  (real hook with null editor is a no-op — no side effects)
 *
 * The tldraw mock renders the TopPanel slot so the real TopBar (and its
 * Share button) appears in the DOM for the share-click test.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock TanStack Router params
mock.module("@tanstack/react-router", () => ({
  useParams: () => ({ id: "canvas-1" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  createRoute: mock(() => ({})),
  createRouter: mock(() => ({})),
  useNavigate: () => mock(() => {}),
  useSearch: () => ({}),
  Outlet: () => null,
  createRootRoute: mock(() => ({})),
  RouterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock tldraw — renders TopPanel slot so the real TopBar (and Share button) appears.
// We skip calling onMount so editor stays null → useAutosave is a no-op.
mock.module("tldraw", () => ({
  Tldraw: ({
    components,
  }: {
    components?: Record<string, React.ComponentType | null | undefined>;
  }) => {
    const TopPanel = components?.TopPanel;
    return <div data-testid="tldraw-mock">{TopPanel ? <TopPanel /> : null}</div>;
  },
  getSnapshot: mock(() => ({})),
  Editor: () => undefined,
}));

// Mock shape-types
mock.module("@vellum/shared/shape-types", () => ({
  customShapeUtils: [],
  customShapeTools: [],
}));

// Mock the sync hook — Editor calls useSyncStore(canvasId). Returning
// `ready` keeps the success path testing the chrome wiring while avoiding
// the heavyweight @tldraw/sync initialization (which expects useValue/atom
// from the real tldraw module — incompatible with our local mock).
//
// `useSyncConnectionStore` must behave like a callable Zustand hook:
// invoking it with a selector returns the selected slice. ConnectionStatus
// (rendered inside TopBar) depends on that callable shape.
mock.module("./use-sync-store", () => {
  const fakeConnectionState = { state: "connected" as const, attempt: 0 };
  function useSyncConnectionStore<T>(selector: (s: typeof fakeConnectionState) => T): T {
    return selector(fakeConnectionState);
  }
  (useSyncConnectionStore as unknown as { getState: () => typeof fakeConnectionState }).getState =
    () => fakeConnectionState;
  (
    useSyncConnectionStore as unknown as {
      setState: (next: Partial<typeof fakeConnectionState>) => void;
    }
  ).setState = () => {};
  return {
    useSyncStore: mock(() => ({ status: "ready", store: { id: "mock-store" } })),
    useSyncConnectionStore,
  };
});

// Mock useCanvasList so CanvasPage's mutations are no-ops
mock.module("../dashboard/useCanvasList", () => ({
  useCanvasList: mock(() => ({
    canvases: [],
    isLoading: false,
    isError: false,
    renameCanvas: { mutate: mock(() => {}), isPending: false, mutateAsync: mock(async () => {}) },
    deleteCanvas: { mutate: mock(() => {}), isPending: false, mutateAsync: mock(async () => {}) },
    createCanvas: { mutate: mock(() => {}), isPending: false, mutateAsync: mock(async () => {}) },
  })),
}));

// useCanvasQuery mock — controlled state
type QueryState =
  | { status: "loading" }
  | { status: "success"; data: { id: string; title: string; folderId: null } }
  | { status: "error" };

let mockQueryState: QueryState = { status: "loading" };

mock.module("./useCanvasQuery", () => ({
  useCanvasQuery: () => mockQueryState,
}));

// useAuth mock
mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      email: "user@example.com",
      name: "Test User",
      image: null,
      locale: "en" as const,
      createdAt: new Date().toISOString(),
    },
    isAuthenticated: true,
    isLoading: false,
    logout: mock(async () => {}),
  }),
}));

// TanStack Query stub
mock.module("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mock(() => {}) }),
  useQuery: mock(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
  useMutation: mock(() => ({
    mutate: mock(() => {}),
    isPending: false,
    mutateAsync: mock(async () => {}),
  })),
  QueryClient: class {
    invalidateQueries() {}
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Import under test AFTER mocks
// ---------------------------------------------------------------------------

const { CanvasPage } = await import("./CanvasPage");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockQueryState = { status: "loading" };
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CanvasPage", () => {
  test("shows loading state while canvas is fetching", async () => {
    mockQueryState = { status: "loading" };
    render(
      <I18nextProvider i18n={i18n}>
        <CanvasPage />
      </I18nextProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("status")).not.toBeNull();
    });
  });

  test("renders tldraw on success", async () => {
    mockQueryState = {
      status: "success",
      data: { id: "canvas-1", title: "Test Canvas", folderId: null },
    };
    render(
      <I18nextProvider i18n={i18n}>
        <CanvasPage />
      </I18nextProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("tldraw-mock")).not.toBeNull();
    });
  });

  test("shows error state when canvas load fails", async () => {
    mockQueryState = { status: "error" };
    render(
      <I18nextProvider i18n={i18n}>
        <CanvasPage />
      </I18nextProvider>,
    );
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body.length).toBeGreaterThan(0);
    });
    // Canvas editor should NOT be rendered
    expect(screen.queryByTestId("tldraw-mock")).toBeNull();
  });

  test("onShareClick triggers toast with sharePlaceholderToast message", async () => {
    mockQueryState = {
      status: "success",
      data: { id: "canvas-1", title: "Test Canvas", folderId: null },
    };

    const toastEvents: string[] = [];
    const handler = (e: Event) => {
      toastEvents.push((e as CustomEvent<{ message: string }>).detail.message);
    };
    window.addEventListener("vellum:toast", handler);

    render(
      <I18nextProvider i18n={i18n}>
        <CanvasPage />
      </I18nextProvider>,
    );

    // Wait for the Share button in the real TopBar rendered by the tldraw mock
    await waitFor(() => {
      expect(screen.getByText("Share")).not.toBeNull();
    });

    // Click the Share button
    screen.getByText("Share").click();

    // Wait for toast event
    await waitFor(() => {
      expect(toastEvents.length).toBeGreaterThanOrEqual(1);
    });

    expect(toastEvents[0]).toMatch(/sharing/i);

    window.removeEventListener("vellum:toast", handler);
  });
});
