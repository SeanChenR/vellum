/**
 * PricingTab tests — design Decision 11 / spec
 * "Pricing tab renders BYOK pricing as provider-grouped tier cards".
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { PricingTab } from "./PricingTab";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => cleanup());

function renderTab() {
  return render(
    <I18nextProvider i18n={i18n}>
      <PricingTab />
    </I18nextProvider>,
  );
}

describe("PricingTab", () => {
  test("renders exactly three elevated provider cards (Anthropic / OpenAI / Google)", () => {
    renderTab();
    const cards = [
      screen.getByTestId("pricing-card-anthropic"),
      screen.getByTestId("pricing-card-openai"),
      screen.getByTestId("pricing-card-google"),
    ];
    cards.forEach((c) => {
      expect(c.getAttribute("data-variant")).toBe("elevated");
    });
  });

  test("each card has flagship / balanced / economy rows in order", () => {
    renderTab();
    const card = screen.getByTestId("pricing-card-anthropic");
    const flagshipRow = card.querySelector('[data-testid="pricing-row-anthropic-flagship"]');
    const balancedRow = card.querySelector('[data-testid="pricing-row-anthropic-balanced"]');
    const economyRow = card.querySelector('[data-testid="pricing-row-anthropic-economy"]');
    expect(flagshipRow).not.toBeNull();
    expect(balancedRow).not.toBeNull();
    expect(economyRow).not.toBeNull();
    // Verify DOM order
    const pos1 = flagshipRow!.compareDocumentPosition(balancedRow!);
    expect(pos1 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const pos2 = balancedRow!.compareDocumentPosition(economyRow!);
    expect(pos2 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("each card renders the provider brand glyph + colored top border", () => {
    renderTab();
    for (const id of ["anthropic", "openai", "google"] as const) {
      const icon = screen.queryByTestId(`pricing-brand-icon-${id}`);
      expect(icon).not.toBeNull();
      const card = screen.getByTestId(`pricing-card-${id}`);
      const style = card.getAttribute("style") ?? "";
      expect(style).toMatch(/border-top-width:\s*3px/);
      expect(style).toMatch(/border-top-style:\s*solid/);
    }
  });

  test("brand icon is the cleaner brand PNG (claude / openai / gemini)", () => {
    renderTab();
    for (const [id, family] of [
      ["anthropic", "claude"],
      ["openai", "openai"],
      ["google", "gemini"],
    ] as const) {
      const img = screen.getByTestId(`pricing-brand-icon-${id}`) as HTMLImageElement;
      expect(img.tagName.toLowerCase()).toBe("img");
      const src = img.getAttribute("src") ?? "";
      expect(src.toLowerCase()).toContain(family);
    }
  });

  test("card heading renders the brand name (Claude / OpenAI / Gemini)", () => {
    renderTab();
    expect(screen.getByText("Claude")).not.toBeNull();
    expect(screen.getByText("OpenAI")).not.toBeNull();
    expect(screen.getByText("Gemini")).not.toBeNull();
  });

  test("each card renders a <table> with tier / input / output columns", () => {
    renderTab();
    for (const id of ["anthropic", "openai", "google"] as const) {
      const card = screen.getByTestId(`pricing-card-${id}`);
      const table = card.querySelector("table");
      expect(table).not.toBeNull();
      const cols = table!.querySelectorAll("thead th");
      expect(cols).toHaveLength(3);
    }
  });

  test("tier rows render as <tr> inside <tbody>", () => {
    renderTab();
    const card = screen.getByTestId("pricing-card-anthropic");
    const tbody = card.querySelector("tbody");
    expect(tbody).not.toBeNull();
    expect(tbody!.querySelectorAll("tr")).toHaveLength(3);
  });

  test("per-card footer 'USD / 1M tokens' is removed (unit moved to subtitle)", () => {
    renderTab();
    const cards = ["anthropic", "openai", "google"].map((id) =>
      screen.getByTestId(`pricing-card-${id}`),
    );
    for (const card of cards) {
      expect(card.textContent ?? "").not.toMatch(/USD\s*\/\s*1M/i);
    }
  });

  test("each tier row renders the lucide tier glyph (Sparkles/Scale/Leaf)", () => {
    renderTab();
    expect(screen.queryByTestId("pricing-tier-icon-anthropic-flagship")).not.toBeNull();
    expect(screen.queryByTestId("pricing-tier-icon-anthropic-balanced")).not.toBeNull();
    expect(screen.queryByTestId("pricing-tier-icon-anthropic-economy")).not.toBeNull();
  });

  test("tier badge tones map: flagship=purple / balanced=cyan / economy=sky", () => {
    renderTab();
    const card = screen.getByTestId("pricing-card-anthropic");
    const flagshipBadge = card
      .querySelector('[data-testid="pricing-row-anthropic-flagship"]')!
      .querySelector("[data-tone]");
    expect(flagshipBadge!.getAttribute("data-tone")).toBe("purple");
    const balancedBadge = card
      .querySelector('[data-testid="pricing-row-anthropic-balanced"]')!
      .querySelector("[data-tone]");
    expect(balancedBadge!.getAttribute("data-tone")).toBe("cyan");
    const economyBadge = card
      .querySelector('[data-testid="pricing-row-anthropic-economy"]')!
      .querySelector("[data-tone]");
    expect(economyBadge!.getAttribute("data-tone")).toBe("sky");
  });

  test("model identifiers render in font-mono", () => {
    renderTab();
    const card = screen.getByTestId("pricing-card-anthropic");
    const flagshipRow = card.querySelector('[data-testid="pricing-row-anthropic-flagship"]')!;
    const modelIdEl = Array.from(flagshipRow.querySelectorAll(".font-mono")).find((el) =>
      el.textContent?.startsWith("claude"),
    );
    expect(modelIdEl).toBeTruthy();
  });

  test("each card contains exactly one <table>", () => {
    renderTab();
    for (const id of ["anthropic", "openai", "google"] as const) {
      const card = screen.getByTestId(`pricing-card-${id}`);
      expect(card.querySelectorAll("table")).toHaveLength(1);
    }
  });

  test("provider headings appear in order: Anthropic / OpenAI / Google", () => {
    renderTab();
    const anthropic = screen.getByTestId("pricing-card-anthropic");
    const openai = screen.getByTestId("pricing-card-openai");
    const google = screen.getByTestId("pricing-card-google");
    expect(
      anthropic.compareDocumentPosition(openai) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(openai.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
