/**
 * DashboardPage component tests.
 *
 * Scenarios (spec: "Dashboard canvas list view"):
 * - Default view (activeFolderId === null) → My Canvases only
 * - Sidebar shows a "Shared with me" virtual item (Notion-style)
 * - Clicking "Shared with me" → main renders shared list, hides My Canvases
 * - Empty owned section shows localized empty state
 * - Empty shared section shows localized empty state (when sharedview active)
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { DashboardPage } from "./DashboardPage";

const mockNavigate = mock((_path: string) => {});

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/dashboard" }),
  Navigate: ({ to, search }: { to: string; search?: Record<string, string> }) => {
    const searchStr = search ? "?" + new URLSearchParams(search).toString() : "";
    mockNavigate(`${to}${searchStr}`);
    return null;
  },
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    React.createElement("a", { href: to }, children),
}));

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
});

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, qc }: { children?: React.ReactNode; qc: QueryClient }) {
  return React.createElement(
    QueryClientProvider,
    { client: qc },
    React.createElement(I18nextProvider, { i18n }, children),
  );
}

// Mock useAuth — authenticated
const mockLogout = mock(async () => {});
mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@test.com", name: "Test User" },
    isLoading: false,
    isAuthenticated: true,
    logout: mockLogout,
  }),
}));

// Mock API fetches
mock.module("./useCanvasList", () => ({
  canvasListKey: (scope: string) => ["canvas", "list", scope, "all"],
  useCanvasList: (_scope: string) => ({
    canvases: [],
    isLoading: false,
    isError: false,
    renameCanvas: { mutate: () => {} },
    moveCanvas: { mutate: () => {} },
    deleteCanvas: { mutate: () => {} },
    createCanvas: { mutate: () => {}, isPending: false },
  }),
}));

mock.module("./useFolderList", () => ({
  FOLDER_LIST_KEY: ["folder", "list"],
  useFolderList: () => ({
    folders: [],
    isLoading: false,
    isError: false,
    createFolder: { mutate: () => {}, isPending: false },
    renameFolder: { mutate: () => {} },
    deleteFolder: { mutate: () => {} },
  }),
}));

describe("DashboardPage", () => {
  test("default view shows My Canvases heading and a sidebar 'Shared with me' item", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      // My Canvases visible in main content
      expect(screen.queryByText(/My Canvases|我的畫布/)).not.toBeNull();
      // Shared with me visible somewhere (sidebar virtual item)
      expect(screen.queryByText(/Shared with me|與我共用/)).not.toBeNull();
    });
  });

  test("default view does NOT render the Shared with me section in main content", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      // Empty state for owned section should be visible (default view = owned)
      expect(screen.queryByText(/No canvases yet|還沒有畫布/)).not.toBeNull();
    });
    // The shared empty state should NOT appear in default view — it's only
    // rendered when the user navigates to the shared virtual folder.
    expect(screen.queryByText(/Nothing has been shared|尚無共用畫布/)).toBeNull();
  });

  test("clicking 'Shared with me' sidebar item swaps main to shared list and hides My Canvases", async () => {
    const user = userEvent.setup();
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByText(/My Canvases|我的畫布/)).not.toBeNull();
    });

    // Click the sidebar Shared item
    const sharedSidebarBtn = screen.getByRole("button", { name: /Shared with me|與我共用/ });
    await user.click(sharedSidebarBtn);

    await waitFor(() => {
      // Shared empty state now in main
      expect(screen.queryByText(/Nothing has been shared|尚無共用畫布/)).not.toBeNull();
    });
    // My Canvases heading is no longer rendered
    expect(screen.queryByRole("heading", { name: /My Canvases|我的畫布/ })).toBeNull();
  });

  test("empty owned section shows empty state message", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      expect(screen.queryByText(/No canvases yet|還沒有畫布/)).not.toBeNull();
    });
  });

  // The "user menu shows Profile / Sessions / Sign out" assertion moved to
  // UserAvatarMenu.test.tsx after unify-navbar — DashboardPage no longer
  // renders its own header (AppLayout provides Navbar at the route level).
});
