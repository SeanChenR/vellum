/**
 * SessionsTab structural tests — design Decision 10 + account spec
 * "SessionsPage renders each session as a card row with current-session badge".
 *
 * Behavior coverage (revoke flow, confirmation dialog) is in
 * SessionsPage.test.tsx via the re-export wrapper.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { SessionsTab } from "./SessionsTab";

const SESSIONS = [
  {
    id: "s-2",
    createdAt: "2026-05-12T10:00:00.000Z",
    lastSeenAt: "2026-05-12T11:00:00.000Z",
    ipAddress: "10.0.0.2",
    userAgent: "Chrome on macOS",
    isCurrent: false,
  },
  {
    id: "s-1",
    createdAt: "2026-05-13T10:00:00.000Z",
    lastSeenAt: "2026-05-13T11:00:00.000Z",
    ipAddress: "10.0.0.1",
    userAgent: "Safari on macOS",
    isCurrent: true,
  },
];

const mockFetch = mock(async () => Response.json({ data: { sessions: SESSIONS } }));

beforeEach(async () => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
  await i18n.changeLanguage("zh-TW");
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
});

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SessionsTab />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe("SessionsTab", () => {
  test("current session is pinned to first row with cyan badge", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.queryByTestId("current-session-badge")).not.toBeNull();
    });
    const badge = screen.getByTestId("current-session-badge");
    expect(badge.getAttribute("data-tone")).toBe("cyan");

    const items = document.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.textContent).toContain("Safari on macOS");
  });

  test("non-current sessions expose a Revoke button; current session does NOT", async () => {
    renderTab();
    await waitFor(() => {
      expect(screen.queryByTestId("current-session-badge")).not.toBeNull();
    });
    const items = document.querySelectorAll("li");
    const currentRow = items[0]!;
    const otherRow = items[1]!;
    expect(currentRow.querySelector('[aria-label*="撤銷"], [aria-label*="Revoke"]')).toBeNull();
    expect(otherRow.querySelector("button")).not.toBeNull();
  });
});
