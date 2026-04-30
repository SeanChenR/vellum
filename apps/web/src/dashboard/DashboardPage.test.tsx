/**
 * DashboardPage component tests.
 *
 * Scenarios (spec: "Dashboard canvas list view"):
 * - Authenticated user sees "My Canvases" and "Shared with me" headings
 * - Empty owned section shows localized empty state
 * - Empty shared section shows localized empty state
 * - Unauthenticated visitor redirects to /login
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
  test("renders My Canvases and Shared with me headings", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      expect(screen.queryByText(/My Canvases|我的畫布/)).not.toBeNull();
      expect(screen.queryByText(/Shared with me|與我共用/)).not.toBeNull();
    });
  });

  test("empty owned section shows empty state message", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      // The empty state text should contain the create prompt
      expect(screen.queryByText(/No canvases yet|還沒有畫布/)).not.toBeNull();
    });
  });

  test("empty shared section shows empty state message", async () => {
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await waitFor(() => {
      expect(screen.queryByText(/Nothing has been shared|尚無共用畫布/)).not.toBeNull();
    });
  });

  test("header user menu exposes Profile, Sessions links and Sign out button", async () => {
    await i18n.changeLanguage("en");
    mockLogout.mockClear();
    const user = userEvent.setup();
    const qc = makeQC();
    render(React.createElement(Wrapper, { qc }, React.createElement(DashboardPage)));

    await user.click(screen.getByRole("button", { name: /user menu/i }));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeNull();
    });

    const profileLink = screen.getByRole("menuitem", { name: /^profile$/i });
    expect((profileLink as HTMLAnchorElement).getAttribute("href")).toBe("/account/profile");
    const sessionsLink = screen.getByRole("menuitem", {
      name: /active sessions/i,
    });
    expect((sessionsLink as HTMLAnchorElement).getAttribute("href")).toBe("/account/sessions");

    const signOutBtn = screen.getByRole("menuitem", { name: /sign out/i });
    await user.click(signOutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
