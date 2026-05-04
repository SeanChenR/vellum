/**
 * InviteErrorPage tests.
 *
 * The page receives `?reason=email_mismatch|expired|not_found|<other>` and an
 * optional `expected` email + `token` from the server's `/invite-error`
 * redirect. It must render a localized message and (for email_mismatch)
 * offer a "switch account" action that signs out and redirects back to
 * `/login?redirect=<accept-url>` so the user can retry with the right
 * account.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { InviteErrorPage } from "./InviteErrorPage";

afterEach(cleanup);

interface RenderArgs {
  search: string;
  logout?: () => Promise<void>;
  navigate?: (href: string) => void;
}

function renderPage({ search, logout, navigate }: RenderArgs) {
  // Hard-set window.location.search via a Proxy on the URL instance — JSDOM
  // permits Object.defineProperty on window.location.
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      search,
      pathname: "/invite-error",
      assign: navigate ?? mock(() => undefined),
    },
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nextProvider i18n={i18n}>
        <InviteErrorPage logout={logout} navigate={navigate} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

describe("InviteErrorPage — reason rendering", () => {
  test("reason=email_mismatch shows the localized email-mismatch body with the expected email", () => {
    renderPage({ search: "?reason=email_mismatch&expected=bob%40example.com&token=tok123" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("無法接受邀請");
    expect(screen.getByText(/bob@example\.com/)).toBeTruthy();
  });

  test("reason=expired shows the localized expired body", () => {
    renderPage({ search: "?reason=expired" });
    expect(screen.getByText(/已過期/)).toBeTruthy();
  });

  test("reason=not_found shows the localized not-found body", () => {
    renderPage({ search: "?reason=not_found" });
    expect(screen.getByText(/找不到/)).toBeTruthy();
  });

  test("missing/unknown reason falls back to the unknown-reason body", () => {
    renderPage({ search: "" });
    expect(screen.getByText(/無法使用/)).toBeTruthy();
  });
});

describe("InviteErrorPage — switch-account action", () => {
  test("email_mismatch: clicking 'switch account' calls logout then navigates to /login?redirect=<accept-url>", async () => {
    const logout = mock(() => Promise.resolve());
    const navigate = mock(() => undefined);
    renderPage({
      search: "?reason=email_mismatch&expected=bob%40example.com&token=tok123",
      logout,
      navigate,
    });
    fireEvent.click(screen.getByRole("button", { name: /切換帳號/ }));
    await Promise.resolve();
    await Promise.resolve();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    const firstCall = navigate.mock.calls[0] as unknown as [string] | undefined;
    const target = firstCall?.[0] ?? "";
    expect(target.startsWith("/login?redirect=")).toBe(true);
    expect(target).toContain(encodeURIComponent("/api/share/invite/tok123/accept"));
  });

  test("non-email_mismatch reasons do NOT show the switch-account button", () => {
    renderPage({ search: "?reason=expired" });
    expect(screen.queryByRole("button", { name: /切換帳號/ })).toBeNull();
  });

  test("email_mismatch without token does NOT show the switch-account button (no retry target)", () => {
    renderPage({ search: "?reason=email_mismatch&expected=bob%40example.com" });
    expect(screen.queryByRole("button", { name: /切換帳號/ })).toBeNull();
  });
});

describe("InviteErrorPage — back link", () => {
  test("renders 'back to home' link pointing at /", () => {
    renderPage({ search: "?reason=expired" });
    const link = screen.getByRole("link", { name: /返回首頁/ });
    expect(link.getAttribute("href")).toBe("/");
  });
});
