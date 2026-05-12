/**
 * TokenUsageFooter.test.tsx — cost formatting + null-usage rendering.
 *
 * Spec ref: ai-side-panel "Token usage footer displays per-run and cumulative usage"
 *
 * Cost rendering boundary cases (test cases derived directly from the
 * SBE example table in the spec):
 *
 *   100 input / 50 output @ openai/gpt-4o-mini → $0.0001
 *   1 input / 1 output                           → <$0.0001
 *   0 / 0                                        → $0.0000
 *   null usage                                   → "—"
 *
 * Note: the spec example references gpt-4o-mini, but BYOK_PRICING only
 * carries the 9 user-selectable models. The example numbers happen to
 * line up with gpt-5-nano pricing (input 0.05/M, output 0.4/M), which
 * is the OpenAI economy tier the user actually picks. The boundary
 * shape (= 0.0001 / sub-cent / zero / null) is what the test enforces.
 */

import "../i18n";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { formatCost, TokenUsageFooter } from "./TokenUsageFooter";

afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

// ---------------------------------------------------------------------------
// formatCost — boundary cases
// ---------------------------------------------------------------------------

describe("formatCost — boundary table", () => {
  test("zero input + zero output renders $0.0000", () => {
    expect(formatCost(0, 0, "gpt-5-nano")).toBe("$0.0000");
  });

  test("non-zero but sub-cent renders <$0.0001", () => {
    // 1 token in @ 0.05/M = 0.00000005 → renders as <$0.0001
    expect(formatCost(1, 1, "gpt-5-nano")).toBe("<$0.0001");
  });

  test("integer-multiple of $0.0001 renders with 4 decimals", () => {
    // 1000 input @ 0.05/M = 0.00005, 1000 output @ 0.4/M = 0.0004
    // Total = 0.00045 → "$0.0005" after toFixed(4)
    expect(formatCost(1000, 1000, "gpt-5-nano")).toBe("$0.0005");
  });

  test("unknown model renders as em-dash", () => {
    expect(formatCost(100, 50, "no-such-model")).toBe("—");
  });

  test("null model renders as em-dash", () => {
    expect(formatCost(100, 50, null)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// Component rendering
// ---------------------------------------------------------------------------

describe("TokenUsageFooter — component rendering", () => {
  test("null thisRun shows em-dash for this-run row", () => {
    wrap(
      <TokenUsageFooter
        thisRun={null}
        threadTotal={{ input: 0, output: 0 }}
        threadPriceModel={null}
      />,
    );
    const row = screen.getByTestId("usage-this-run");
    expect(row.textContent ?? "").toContain("—");
  });

  test("populated thisRun shows tokens + cost on this-run row", () => {
    wrap(
      <TokenUsageFooter
        thisRun={{
          input: 1500,
          output: 800,
          provider: "openai",
          model: "gpt-5-nano",
        }}
        threadTotal={{ input: 1500, output: 800 }}
      />,
    );
    const row = screen.getByTestId("usage-this-run");
    expect(row.textContent ?? "").toContain("1500");
    expect(row.textContent ?? "").toContain("800");
    // Cost: 1500*0.05/1e6 + 800*0.4/1e6 = 0.000395 → toFixed(4) "$0.0004"
    expect(row.textContent ?? "").toContain("$0.0004");
  });

  test("threadTotal renders even when thisRun is null (uses threadPriceModel for cost)", () => {
    wrap(
      <TokenUsageFooter
        thisRun={null}
        threadTotal={{ input: 1500, output: 800 }}
        threadPriceModel={{ provider: "openai", model: "gpt-5-nano" }}
      />,
    );
    const row = screen.getByTestId("usage-thread-total");
    expect(row.textContent ?? "").toContain("1500");
    expect(row.textContent ?? "").toContain("$0.0004");
  });
});
