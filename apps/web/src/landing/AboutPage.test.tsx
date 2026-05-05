/**
 * AboutPage tests — public-pages spec "Public root and about routes
 * render full landing surface".
 *
 * Asserts the about page renders heading, lead paragraph, and at least
 * one narrative section.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

mock.module("motion/react", () => ({
  motion: {
    div: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

let mockAuthIsAuthenticated = false;
mock.module("../auth/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: mockAuthIsAuthenticated,
    logout: mock(() => {}),
  }),
}));

const { AboutPage } = await import("./AboutPage");

function renderAbout() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AboutPage />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("AboutPage", () => {
  test("renders the page heading", () => {
    renderAbout();
    expect(screen.getByRole("heading", { name: /About Vellum/i, level: 1 })).not.toBeNull();
  });

  test("renders the lead paragraph", () => {
    renderAbout();
    expect(
      screen.getByText(/Vellum is a whiteboard for the patient/i, { exact: false }),
    ).not.toBeNull();
  });

  test.each([["Why Vellum"], ["Who it's for"], ["Built with"]])(
    "renders the %s narrative section heading",
    (heading) => {
      renderAbout();
      expect(screen.getByText(heading)).not.toBeNull();
    },
  );

  test("anonymous visitor sees a closing CTA linking to /login", () => {
    mockAuthIsAuthenticated = false;
    const { container } = renderAbout();
    const cta = container.querySelector('a[href="/login"]');
    expect(cta).not.toBeNull();
    expect(cta!.textContent).toContain("Get started");
  });

  test("authenticated visitor sees the closing CTA linking to /dashboard instead", () => {
    mockAuthIsAuthenticated = true;
    const { container } = renderAbout();
    expect(container.querySelector('a[href="/login"]')).toBeNull();
    const cta = container.querySelector('a[href="/dashboard"]');
    expect(cta).not.toBeNull();
    expect(cta!.textContent).toContain("Get started");
    mockAuthIsAuthenticated = false;
  });
});
