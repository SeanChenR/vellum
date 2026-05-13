/**
 * AppLayout tests — public-pages spec "Authenticated routes share an
 * AppLayout shell that reuses the Navbar".
 *
 * AppLayout = Navbar + main(children). NO Footer, NO mobile graceful
 * notice (those are PublicLayout features only).
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import i18n from "../i18n";
import type { AuthUser } from "../auth/useAuth";

const fakeUser: AuthUser = {
  id: "u-1",
  email: "u@test.com",
  name: "User",
  image: null,
  locale: "en",
  createdAt: new Date().toISOString(),
};

mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: fakeUser,
    isLoading: false,
    isAuthenticated: true,
    logout: mock(() => {}),
  }),
}));

// Navbar's `Link` blows up without a RouterProvider; replace only it
// and pass through the rest of the module so other test files (sharing
// Bun's global module mock) keep their imports of `useNavigate` /
// `useSearch` / `useLocation` resolving correctly.
const RealRouter = await import("@tanstack/react-router");
mock.module("@tanstack/react-router", () => ({
  ...RealRouter,
  Link: (props: {
    to: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={props.to} className={props.className} aria-label={props["aria-label"]}>
      {props.children}
    </a>
  ),
}));

const { AppLayout } = await import("./AppLayout");

function renderLayout(children: React.ReactNode = <p>app-content</p>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <AppLayout>{children}</AppLayout>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("AppLayout", () => {
  test("renders the children inside a <main> landmark", () => {
    const { container } = renderLayout(<p>app-content</p>);
    expect(screen.getByText("app-content")).not.toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
  });

  test("renders the same Navbar as PublicLayout (logo + About link)", () => {
    const { container } = renderLayout();
    expect(container.querySelector("nav")).not.toBeNull();
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/about"]')).not.toBeNull();
  });

  test("does NOT render the public Footer", () => {
    const { container } = renderLayout();
    expect(container.querySelector("footer")).toBeNull();
  });

  test("does NOT render the mobile graceful notice", () => {
    renderLayout();
    expect(
      screen.queryByText("Vellum only supports desktop browsers right now.", { exact: false }),
    ).toBeNull();
  });
});
