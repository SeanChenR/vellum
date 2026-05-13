/**
 * SessionsPage tests — Aura redesign contract.
 *
 * Spec ref: openspec/specs/account/spec.md
 *   "SessionsPage renders each session as a card row with current-session badge"
 *   scenarios: "Current session is pinned with cyan badge",
 *              "Revoke requires confirmation"
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { SessionsPage } from "./SessionsPage";

const mockSessions = [
  {
    id: "sess-non-current",
    createdAt: "2026-05-12T00:00:00.000Z",
    lastSeenAt: "2026-05-12T00:00:00.000Z",
    ipAddress: "192.168.1.10",
    userAgent: "Chrome/120",
    isCurrent: false,
  },
  {
    id: "sess-current",
    createdAt: "2026-05-13T00:00:00.000Z",
    lastSeenAt: "2026-05-13T00:00:00.000Z",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    isCurrent: true,
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

beforeEach(async () => {
  await i18n.changeLanguage("en");
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
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
  test("renders the current session as the first row with a cyan This-device badge", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("current-session-badge")).not.toBeNull();
    });
    const badge = screen.getByTestId("current-session-badge");
    expect(badge.getAttribute("data-tone")).toBe("cyan");
    expect(badge.textContent).toContain("This device");

    // The row containing the badge must be the FIRST list item.
    const listItems = document.querySelectorAll("ul li");
    expect(listItems.length).toBeGreaterThan(1);
    expect(listItems[0]!.contains(badge)).toBe(true);
  });

  test("the current-session row has NO Revoke button", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("current-session-badge")).not.toBeNull();
    });
    const listItems = document.querySelectorAll("ul li");
    const currentRow = listItems[0]! as HTMLElement;
    expect(currentRow.querySelector("button")).toBeNull();
  });

  test("clicking Revoke on a non-current row opens a confirmation dialog before DELETE", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.queryAllByRole("button", { name: /sign out this device/i }).length).toBe(1);
    });

    // No DELETE call before user confirms.
    const beforeDeletes = mockFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit)?.method === "DELETE",
    ).length;
    expect(beforeDeletes).toBe(0);

    // Click the Revoke button on the non-current row.
    const revokeBtn = screen.getByRole("button", { name: /sign out this device/i });
    await user.click(revokeBtn);

    // Confirm dialog appears.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeNull();
    });

    // Still no DELETE.
    const midDeletes = mockFetch.mock.calls.filter(
      (c) => (c[1] as RequestInit)?.method === "DELETE",
    ).length;
    expect(midDeletes).toBe(0);

    // Confirm.
    const buttons = screen.queryAllByRole("button", { name: /sign out this device/i });
    // The second matching button is the confirmation in the dialog.
    await user.click(buttons[buttons.length - 1]!);

    await waitFor(() => {
      const deletes = mockFetch.mock.calls.filter(
        (c) => (c[1] as RequestInit)?.method === "DELETE",
      );
      expect(deletes.length).toBe(1);
      expect((deletes[0]![0] as string).endsWith("/sess-non-current")).toBe(true);
    });
  });
});
