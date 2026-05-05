/**
 * Footer tests — public-pages spec "Footer surfaces version and a single
 * attribution row".
 *
 * Asserts the footer renders the brand name + VELLUM_VERSION, and does
 * NOT contain any phase-2 surfaces (pricing, blog, social).
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import React from "react";
import i18n from "../i18n";
import { VELLUM_VERSION } from "@vellum/shared";
import { Footer } from "./Footer";

function renderFooter() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Footer />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

describe("Footer", () => {
  test("displays the product name", () => {
    renderFooter();
    expect(screen.getAllByText("Vellum").length).toBeGreaterThan(0);
  });

  test("displays the build version sourced from VELLUM_VERSION", () => {
    renderFooter();
    // versionLabel formats as "v{version}"; assert version substring appears.
    expect(screen.getByText(`v${VELLUM_VERSION}`)).not.toBeNull();
  });

  test.each([
    ["pricing", "/pricing"],
    ["blog", "/blog"],
    ["changelog", "/changelog"],
    ["twitter", "twitter.com"],
    ["linkedin", "linkedin.com"],
    ["discord", "discord.com"],
  ])("does NOT include phase 2 surface link to %s", (_label, fragment) => {
    const { container } = renderFooter();
    const html = container.innerHTML;
    expect(html).not.toContain(fragment);
  });
});
