/**
 * Card.motion.test.tsx — verifies the hover-ring transition contract.
 *
 * Spec ref: openspec/specs/motion-system/spec.md
 *   "Card hover-ring transition is bounded and respects reduced-motion"
 *   scenarios: "Card hover ring transitions within 200 ms by default",
 *              "Reduced-motion users see instant hover ring"
 */

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "./Card";

afterEach(() => cleanup());

describe("Card — hover-ring motion contract", () => {
  test("hover-ring variant carries the duration-150 transition class", () => {
    render(
      <Card data-testid="card" variant="hover-ring">
        c
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("transition-shadow");
    expect(el.className).toContain("duration-150");
  });

  test("hover-ring variant carries the v-card-hover-ring class so the reduced-motion @media rule can target it", () => {
    render(
      <Card data-testid="card" variant="hover-ring">
        c
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("v-card-hover-ring");
  });

  test("non-hover-ring variants do NOT carry the transition class", () => {
    render(
      <Card data-testid="card" variant="default">
        c
      </Card>,
    );
    expect(screen.getByTestId("card").className).not.toContain("transition-shadow");
  });

  test("styles.css declares the reduced-motion override for v-card-hover-ring", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf-8");
    expect(src).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
    expect(src).toMatch(/\.v-card-hover-ring\s*\{[^}]*transition-duration:\s*0s/);
  });
});

describe("Theme switching is instant — root style contract", () => {
  test("styles.css does NOT declare a transition on background/color at :root or html", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(fileURLToPath(new URL("../../styles.css", import.meta.url)), "utf-8");
    // Block-scan: extract every selector → body pair whose selector mentions :root or html.
    const blocks = src.match(/(?:[:.\w\s,\-[\]"=]+)\{[^}]*\}/g) ?? [];
    for (const block of blocks) {
      const isRootLike = /(:root\b|^|\s)html\b/.test(block.split("{")[0]!);
      if (!isRootLike) continue;
      const body = block.slice(block.indexOf("{") + 1, block.indexOf("}"));
      expect(body).not.toMatch(/transition[^;]*(background-color|color|border-color)/);
    }
  });
});
