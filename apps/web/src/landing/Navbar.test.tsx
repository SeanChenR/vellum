/**
 * Navbar tests — public-pages spec "Navbar exposes product identity and
 * primary navigation".
 *
 * Asserts the navbar renders logo (linked to /), an About link to /about,
 * and a Sign-in link to /login. All visible strings come from i18n
 * namespace `nav.*`.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { Navbar } from "./Navbar";

function renderNavbar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Navbar />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("Navbar", () => {
  test("renders the brand logo wrapped in a link to /", () => {
    const { container } = renderNavbar();
    const homeLinks = container.querySelectorAll('a[href="/"]');
    expect(homeLinks.length).toBeGreaterThan(0);
    const logo = container.querySelector('a[href="/"] img');
    expect(logo).not.toBeNull();
  });

  test("renders an About link pointing to /about with the localized label", () => {
    const { container } = renderNavbar();
    const about = container.querySelector('a[href="/about"]');
    expect(about).not.toBeNull();
    // Localized "About" label must appear (i18n key nav.about → "About")
    expect(screen.getByText("About")).not.toBeNull();
  });

  test("renders a Sign-in link pointing to /login with the localized label", () => {
    const { container } = renderNavbar();
    const login = container.querySelector('a[href="/login"]');
    expect(login).not.toBeNull();
    // Localized i18n key nav.login → "Sign in"
    expect(screen.getByText("Sign in")).not.toBeNull();
  });

  test("renders the brand name from nav.brand i18n key", async () => {
    renderNavbar();
    expect(screen.getAllByText("Vellum").length).toBeGreaterThan(0);
  });
});
