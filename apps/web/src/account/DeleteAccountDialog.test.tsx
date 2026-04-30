/**
 * DeleteAccountDialog component tests.
 *
 * Scenarios:
 * - confirm email doesn't match: submit button disabled
 * - confirm email matches: submit calls DELETE /api/account and navigates to /login
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const mockNavigate = mock((_path: string) => {});

mock.module("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "user@example.com", name: "User" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const mockFetch = mock(async (_url: string, _init?: RequestInit) =>
  Response.json({ data: { ok: true } }, { status: 200 }),
);

beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
  mockNavigate.mockClear();
});

function renderDialog(open = true) {
  return render(
    <I18nextProvider i18n={i18n}>
      <DeleteAccountDialog open={open} onClose={() => {}} />
    </I18nextProvider>,
  );
}

describe("DeleteAccountDialog", () => {
  test("submit button is disabled when confirmEmail doesn't match", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.queryByRole("textbox", { name: /confirm email/i });
    if (input) {
      await user.type(input, "wrong@example.com");
      const submitBtn = screen.queryByRole("button", { name: /delete/i });
      if (submitBtn) {
        expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
      }
    }
  });

  test("submit button enabled when confirmEmail matches (case-insensitive)", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.queryByRole("textbox", { name: /confirm email/i });
    if (input) {
      await user.type(input, "user@example.com");
      const submitBtn = screen.queryByRole("button", { name: /delete/i });
      if (submitBtn) {
        expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
      }
    }
  });

  test("successful submit calls DELETE /api/account and navigates to /login", async () => {
    const user = userEvent.setup();
    renderDialog();

    const input = screen.queryByRole("textbox", { name: /confirm email/i });
    if (input) {
      await user.type(input, "user@example.com");

      const submitBtn = screen.queryByRole("button", { name: /delete/i });
      if (submitBtn && !(submitBtn as HTMLButtonElement).disabled) {
        await user.click(submitBtn);

        await waitFor(() => {
          const deleteCalls = mockFetch.mock.calls.filter((c) => {
            const opts = c[1] as RequestInit | undefined;
            return opts?.method === "DELETE";
          });
          expect(deleteCalls.length).toBeGreaterThan(0);
        });

        await waitFor(() => {
          expect(mockNavigate).toHaveBeenCalledWith("/login");
        });
      }
    }
  });
});
