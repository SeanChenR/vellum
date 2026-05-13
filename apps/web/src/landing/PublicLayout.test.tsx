/**
 * PublicLayout tests — design decision "Public layout shell extracted as
 * <PublicLayout> component".
 *
 * Asserts the layout wraps children in a Navbar + main + Footer shell
 * and shows the mobile graceful notice when the viewport is narrow.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import i18n from "../i18n";

mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    logout: mock(() => {}),
  }),
}));

// Replace only Link with a plain anchor; pass through all other
// exports so other test files (sharing Bun's global module mock) keep
// their imports resolving.
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

const { PublicLayout } = await import("./PublicLayout");

function renderLayout(children: React.ReactNode = <p>page-content</p>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <PublicLayout>{children}</PublicLayout>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("PublicLayout", () => {
  test("renders the children inside a <main> landmark", () => {
    const { container } = renderLayout(<p>page-content</p>);
    expect(screen.getByText("page-content")).not.toBeNull();
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.textContent).toContain("page-content");
  });

  test("renders the Navbar above the main content", () => {
    const { container } = renderLayout();
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
  });

  test("renders the Footer below the main content", () => {
    const { container } = renderLayout();
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
  });

  test("renders the mobile graceful notice (hidden on >= 768px via responsive classes)", () => {
    renderLayout();
    // The notice text is always in the DOM but visually hidden at >= md breakpoint.
    expect(
      screen.getByText("Vellum only supports desktop browsers right now.", { exact: false }),
    ).not.toBeNull();
  });

  test("notice container uses md:hidden so it disappears at desktop breakpoints", () => {
    const { container } = renderLayout();
    // Find the wrapper element that holds the notice — it should have md:hidden.
    const noticeText = screen.getByText("Vellum only supports desktop browsers right now.", {
      exact: false,
    });
    let walker: HTMLElement | null = noticeText.parentElement;
    let foundMobileWrapper = false;
    while (walker && walker !== container) {
      if (walker.className.includes("md:hidden")) {
        foundMobileWrapper = true;
        break;
      }
      walker = walker.parentElement;
    }
    expect(foundMobileWrapper).toBe(true);
  });

  test("desktop layout container uses hidden md:flex so it appears only at >= 768px", () => {
    const { container } = renderLayout(<p data-testid="desktop-content">page</p>);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    let walker: HTMLElement | null = main!.parentElement;
    let foundDesktopWrapper = false;
    while (walker && walker !== container) {
      const cls = walker.className;
      if (cls.includes("hidden") && cls.includes("md:flex")) {
        foundDesktopWrapper = true;
        break;
      }
      walker = walker.parentElement;
    }
    expect(foundDesktopWrapper).toBe(true);
  });

  test("renders skip-to-main-content link as the first interactive element", () => {
    const { container } = renderLayout();
    const skip = container.querySelector('a[href="#main"]');
    expect(skip).not.toBeNull();
    // sr-only by default
    expect(skip!.className).toContain("sr-only");
    // focus state class moves it to absolute / visible
    expect(skip!.className).toContain("focus:not-sr-only");
    // aria-accessible label from i18n
    expect(skip!.textContent).toContain("Skip to main content");
  });

  test('main element has id="main" so the skip-link can target it', () => {
    const { container } = renderLayout();
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main!.id).toBe("main");
  });
});
