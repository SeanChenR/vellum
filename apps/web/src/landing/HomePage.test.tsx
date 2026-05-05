/**
 * HomePage tests — public-pages spec "Public root and about routes
 * render full landing surface".
 *
 * Asserts the homepage content includes hero (headline + tagline + CTA
 * to /login), features section listing the three core capabilities,
 * and a narrative band linking to /about.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";

// motion/react needs a stub here so test envs without RAF don't churn.
mock.module("motion/react", () => ({
  motion: {
    div: ({ children, ...rest }: { children?: React.ReactNode }) => <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const { HomePage } = await import("./HomePage");

function renderHome() {
  return render(
    <I18nextProvider i18n={i18n}>
      <HomePage />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("HomePage — hero", () => {
  test("renders the hero headline", () => {
    renderHome();
    expect(screen.getByText("A whiteboard built with care.")).not.toBeNull();
  });

  test("renders the hero tagline", () => {
    renderHome();
    expect(
      screen.getByText(/Light, fast, and made for thinking/i, { exact: false }),
    ).not.toBeNull();
  });

  test("renders the primary CTA linking to /login", () => {
    const { container } = renderHome();
    const cta = container.querySelector('a[href="/login"]');
    expect(cta).not.toBeNull();
    expect(cta!.textContent).toContain("Get started");
  });
});

describe("HomePage — features section", () => {
  test("contains a features heading", () => {
    renderHome();
    expect(screen.getByText("A tool for people who think slowly")).not.toBeNull();
  });

  test("lists all three feature cards by their titles", () => {
    renderHome();
    expect(screen.getByText("Infinite canvas")).not.toBeNull();
    expect(screen.getByText("Real-time multiplayer")).not.toBeNull();
    expect(screen.getByText("Yours to share")).not.toBeNull();
  });
});

describe("HomePage — narrative band", () => {
  test("renders the narrative heading and body", () => {
    renderHome();
    expect(screen.getByText("Why we wrote a whiteboard")).not.toBeNull();
    expect(screen.getByText(/Most tools today pile on features/i, { exact: false })).not.toBeNull();
  });

  test("renders the read-more link to /about", () => {
    const { container } = renderHome();
    const link = container.querySelector('a[href="/about"]');
    expect(link).not.toBeNull();
  });
});
