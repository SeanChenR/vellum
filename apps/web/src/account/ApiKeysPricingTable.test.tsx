/**
 * ApiKeysPricingTable component tests.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Pricing table groups by provider with no repeated provider name"
 *
 * Three provider sections; provider name + vendor link rendered exactly
 * once per section; three tier rows per section; nine data rows total.
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { BYOK_PRICING } from "@vellum/shared/byok-pricing";
import i18n from "../i18n";
import { ApiKeysPricingTable } from "./ApiKeysPricingTable";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

function renderTable() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ApiKeysPricingTable />
    </I18nextProvider>,
  );
}

describe("ApiKeysPricingTable — composition", () => {
  test("renders exactly three provider sections (anthropic / openai / google)", () => {
    renderTable();
    expect(screen.getByTestId("byok-pricing-section-anthropic")).toBeTruthy();
    expect(screen.getByTestId("byok-pricing-section-openai")).toBeTruthy();
    expect(screen.getByTestId("byok-pricing-section-google")).toBeTruthy();
  });

  test("provider name appears exactly once per section header (no row-level repetition)", () => {
    renderTable();
    // Section header counts: 1 each = 3 total occurrences page-wide.
    expect(screen.getAllByTestId(/byok-pricing-header-/)).toHaveLength(3);
  });

  test("each provider section contains exactly three tier rows", () => {
    renderTable();
    for (const provider of ["anthropic", "openai", "google"] as const) {
      const section = screen.getByTestId(`byok-pricing-section-${provider}`);
      expect(within(section).getAllByTestId("byok-pricing-row")).toHaveLength(3);
    }
  });

  test("page-wide total is exactly nine data rows", () => {
    renderTable();
    expect(screen.getAllByTestId("byok-pricing-row")).toHaveLength(9);
  });
});

describe("ApiKeysPricingTable — content", () => {
  test("each section's vendor link points at the catalog vendorPricingUrl (one link per provider)", () => {
    renderTable();
    for (const providerId of ["anthropic", "openai", "google"] as const) {
      const expected = BYOK_PRICING.find((r) => r.providerId === providerId)!.vendorPricingUrl;
      const link = screen.getByTestId(`byok-pricing-vendor-link-${providerId}`);
      expect(link.getAttribute("href")).toBe(expected);
    }
  });

  test("each row's modelId text matches the catalog entry", () => {
    renderTable();
    for (const entry of BYOK_PRICING) {
      expect(screen.getByText(entry.modelId)).toBeTruthy();
    }
  });

  test("renders all three tier labels (i18n: Flagship / Balanced / Economy) once per section", () => {
    renderTable();
    expect(screen.getAllByText(/^Flagship$/)).toHaveLength(3);
    expect(screen.getAllByText(/^Balanced$/)).toHaveLength(3);
    expect(screen.getAllByText(/^Economy$/)).toHaveLength(3);
  });
});
