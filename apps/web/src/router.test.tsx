/**
 * Router tests — /dashboard auth guard.
 *
 * Scenarios (spec: "Dashboard canvas list view" — unauthenticated redirect):
 * - Unauthenticated visitor to /dashboard → redirected to /login
 * - Authenticated user to /dashboard → DashboardPage renders
 *
 * Strategy: we test the RouteGuard wrapper that /dashboard uses rather than
 * spinning up a full TanStack Router instance (which requires JSDOM history
 * and is effectively integration-tested by E2E). We render the same
 * <RouteGuard><DashboardPage /></RouteGuard> combination the route uses.
 */

import "./i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "./i18n";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = mock((_path: string) => {});

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/dashboard", search: "" }),
  Navigate: ({
    to,
    search,
  }: {
    to: string;
    search?: Record<string, string>;
  }) => {
    const searchStr = search
      ? "?" + new URLSearchParams(search).toString()
      : "";
    mockNavigate(`${to}${searchStr}`);
    return null;
  },
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    React.createElement("a", { href: to }, children),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
});

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: makeQC() },
    React.createElement(I18nextProvider, { i18n }, children),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/dashboard route guard", () => {
  test("unauthenticated user is redirected to /login", async () => {
    mock.module("./auth/useAuth", () => ({
      useAuth: () => ({ user: null, isLoading: false, isAuthenticated: false }),
    }));

    // Import lazily so mock takes effect
    const { RouteGuard } = await import("./auth/RouteGuard");
    const { DashboardPage } = await import("./dashboard/DashboardPage");

    render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(
          RouteGuard,
          null,
          React.createElement(DashboardPage),
        ),
      ),
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
      const destination = mockNavigate.mock.calls[0]?.[0] as string;
      expect(destination).toContain("/login");
    });
  });

  test("authenticated user can access /dashboard", async () => {
    mock.module("./auth/useAuth", () => ({
      useAuth: () => ({
        user: { id: "u1", email: "user@test.com", name: "User" },
        isLoading: false,
        isAuthenticated: true,
      }),
    }));

    const { RouteGuard } = await import("./auth/RouteGuard");
    const { DashboardPage } = await import("./dashboard/DashboardPage");

    render(
      React.createElement(
        Wrapper,
        null,
        React.createElement(
          RouteGuard,
          null,
          React.createElement(DashboardPage),
        ),
      ),
    );

    await waitFor(() => {
      // Dashboard headings confirm DashboardPage rendered
      expect(
        screen.queryByText(/My Canvases|我的畫布/),
      ).not.toBeNull();
    });
  });
});
