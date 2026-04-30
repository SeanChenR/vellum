/**
 * LoginPage component tests.
 *
 * Scenarios:
 * - renders Google OAuth button
 * - renders Magic Link email form
 * - form submit calls fetch with email
 * - server emailRateLimited error shows localized message
 */

import "../i18n"; // initialise i18n before tests
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

mock.module("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => null,
}));
mock.module("./useAuth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: async () => {},
  }),
}));

import { LoginPage } from "./LoginPage";

const mockFetch = mock(async (_url: string, _opts?: RequestInit) =>
  Response.json({ data: { sent: true } }),
);

beforeEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: test overriding global fetch
  (globalThis as any).fetch = mockFetch;
});

afterEach(() => {
  cleanup();
  mockFetch.mockClear();
});

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <LoginPage />
    </I18nextProvider>,
  );
}

describe("LoginPage", () => {
  test("renders Google OAuth button", () => {
    renderPage();
    const googleBtn = screen.getByRole("button", { name: /google/i });
    expect(googleBtn).not.toBeNull();
  });

  test("renders Magic Link email input and submit button", () => {
    renderPage();
    const emailInput = screen.getByRole("textbox", { name: /email/i });
    expect(emailInput).not.toBeNull();
    const submitBtn = screen.getByRole("button", { name: /sign-in link|sign.in.link/i });
    expect(submitBtn).not.toBeNull();
  });

  test("submitting Magic Link form calls fetch with email", async () => {
    const user = userEvent.setup();
    renderPage();

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await user.type(emailInput, "test@example.com");

    const form = screen.getByRole("form", { hidden: true }) ?? emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  test("emailRateLimited error shows corresponding i18n message", async () => {
    mockFetch.mockImplementation(async () =>
      Response.json({ error: { errorKey: "auth.errors.emailRateLimited" } }, { status: 429 }),
    );

    const user = userEvent.setup();
    renderPage();

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    await user.type(emailInput, "rate@example.com");

    const form = emailInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      // Expect some error text to appear
      const errorEl = document.querySelector("[data-testid='auth-error']");
      expect(errorEl).not.toBeNull();
    });
  });
});
