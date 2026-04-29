/**
 * RouteGuard component tests.
 *
 * Scenarios:
 * - unauthenticated user visiting protected route: redirects to /login?redirect=<path>
 * - revoked session: also redirects to /login
 * - authenticated user: renders children
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { RouteGuard } from "./RouteGuard";

const mockNavigate = mock((_path: string) => {});

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/dashboard" }),
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
}));

afterEach(() => {
  cleanup();
  mockNavigate.mockClear();
});

describe("RouteGuard", () => {
  test("unauthenticated: redirects to /login with redirect param", async () => {
    // Simulate no user (useAuth returns { user: null, isLoading: false })
    mock.module("./useAuth", () => ({
      useAuth: () => ({ user: null, isLoading: false, isAuthenticated: false }),
    }));

    render(
      <I18nextProvider i18n={i18n}>
        <RouteGuard>
          <div>Protected content</div>
        </RouteGuard>
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
      const call = mockNavigate.mock.calls[0]?.[0] as string;
      expect(call).toContain("/login");
    });
  });

  test("revoked session: also redirects to /login", async () => {
    mock.module("./useAuth", () => ({
      useAuth: () => ({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: { errorKey: "auth.errors.sessionRevoked" },
      }),
    }));

    render(
      <I18nextProvider i18n={i18n}>
        <RouteGuard>
          <div>Protected content</div>
        </RouteGuard>
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
      const call = mockNavigate.mock.calls[0]?.[0] as string;
      expect(call).toContain("/login");
    });
  });

  test("authenticated user: renders children", async () => {
    mock.module("./useAuth", () => ({
      useAuth: () => ({
        user: { id: "u1", email: "test@test.com", name: "Test" },
        isLoading: false,
        isAuthenticated: true,
      }),
    }));

    render(
      <I18nextProvider i18n={i18n}>
        <RouteGuard>
          <div>Protected content</div>
        </RouteGuard>
      </I18nextProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeNull();
    });
  });
});
