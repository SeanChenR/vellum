/**
 * PostLoginPage tests.
 *
 * After a magic-link or OAuth verify completes, better-auth redirects to
 * `/post-login?next=<encoded-path>`. This page reads `next`, validates it
 * with safeRedirect, and forwards via `window.location.assign` so the
 * destination can be a server endpoint (e.g. /api/share/invite/<t>/accept)
 * — TanStack Router's <Navigate> only supports SPA routes.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { PostLoginPage } from "./PostLoginPage";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function renderPage(searchOverride: string, navigate: (href: string) => void) {
  return render(
    <I18nextProvider i18n={i18n}>
      <PostLoginPage navigate={navigate} searchOverride={searchOverride} />
    </I18nextProvider>,
  );
}

describe("PostLoginPage — bounce", () => {
  test("forwards to safe `next` path (same-origin path that may be an API endpoint)", async () => {
    const navigate = mock(() => undefined);
    renderPage("?next=" + encodeURIComponent("/api/share/invite/tok123/accept"), navigate);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/api/share/invite/tok123/accept");
    });
  });

  test("forwards to /dashboard when `next` is missing", async () => {
    const navigate = mock(() => undefined);
    renderPage("", navigate);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("rejects unsafe (cross-origin) next, falls back to /dashboard", async () => {
    const navigate = mock(() => undefined);
    renderPage("?next=" + encodeURIComponent("https://evil.example.com/steal"), navigate);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("rejects protocol-relative next, falls back to /dashboard", async () => {
    const navigate = mock(() => undefined);
    renderPage("?next=" + encodeURIComponent("//evil.example.com/steal"), navigate);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("rejects backslash-injected next, falls back to /dashboard", async () => {
    const navigate = mock(() => undefined);
    renderPage("?next=" + encodeURIComponent("/safe\\evil"), navigate);
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
