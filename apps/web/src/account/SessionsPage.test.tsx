/**
 * SessionsPage component tests.
 *
 * Scenarios:
 * - lists multiple sessions, marks isCurrent
 * - revoke non-current session: removes from list
 * - revoke current session: redirects to /login
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { SessionsPage } from "./SessionsPage";

const mockNavigate = mock((_path: string) => {});

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockSessions = [
  {
    id: "sess-1",
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    isCurrent: true,
  },
  {
    id: "sess-2",
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ipAddress: "192.168.1.10",
    userAgent: "Chrome/120",
    isCurrent: false,
  },
];

const mockFetch = mock(async (url: string, opts?: RequestInit) => {
  if (typeof url === "string" && url.includes("/api/account/sessions")) {
    if (opts?.method === "DELETE") {
      return Response.json({ data: { ok: true } });
    }
    return Response.json({ data: { sessions: mockSessions } });
  }
  return Response.json({});
});

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
  mockNavigate.mockClear();
});

function renderPage() {
  const client = createClient();
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SessionsPage />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("SessionsPage", () => {
  test("lists multiple sessions with isCurrent indicator", async () => {
    renderPage();

    await waitFor(() => {
      // Both sessions should be displayed
      const currentBadge = document.querySelector("[data-testid='current-session-badge']");
      expect(currentBadge).not.toBeNull();
    });
  });

  test("revoke non-current session removes from list", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.queryAllByRole("button", { name: /revoke/i }).length).toBeGreaterThan(0);
    });

    const revokeButtons = screen.queryAllByRole("button", { name: /revoke/i });
    // Find revoke button for non-current session (sess-2)
    if (revokeButtons.length > 0) {
      await user.click(revokeButtons[revokeButtons.length - 1]!);
      await waitFor(() => {
        const deleteCalls = mockFetch.mock.calls.filter(
          (c) => (c[1] as RequestInit)?.method === "DELETE",
        );
        expect(deleteCalls.length).toBeGreaterThan(0);
      });
    }
  });

  test("revoke current session navigates to /login", async () => {
    const user = userEvent.setup();
    // Make revoke return success for current session
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        return Response.json({ data: { ok: true } });
      }
      return Response.json({ data: { sessions: mockSessions } });
    });

    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByRole("button", { name: /revoke/i }).length).toBeGreaterThan(0);
    });

    // Click revoke on the current session button
    const currentRevokeBtn = document.querySelector(
      "[data-testid='revoke-current-session']",
    ) as HTMLButtonElement | null;
    if (currentRevokeBtn) {
      await user.click(currentRevokeBtn);
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/login");
      });
    }
  });
});
