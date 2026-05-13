/**
 * styles.test.ts — token contract for `apps/web/src/styles.css`.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Theme tokens are CSS custom properties switched by data-theme"
 *
 * Why this is a source-string test, not a `getComputedStyle` test:
 *   Tailwind v4 compiles `styles.css` at build time; happy-dom test
 *   environment does not run the Tailwind compiler. Asserting on the
 *   source declaration is a stable, fast contract that catches token
 *   drift without forcing a full bundler in the test sandbox.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STYLES = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf-8");

interface TokenSet {
  bg: string;
  surface: string;
  "surface-elevated": string;
  border: string;
  "text-primary": string;
  "text-muted": string;
  "accent-purple": string;
  "accent-cyan": string;
  "accent-pink": string;
  "accent-orange": string;
  "accent-red": string;
}

// Spec-frozen palette — derived from
// docs/design/aura-redesign/project/tokens.css.
const LIGHT: TokenSet = {
  bg: "#FAF9F6",
  surface: "#FFFFFF",
  "surface-elevated": "#F4F2EE",
  border: "#E5E3DC",
  "text-primary": "#21202E",
  "text-muted": "#6B6976",
  "accent-purple": "#7C3AED",
  "accent-cyan": "#0D9488",
  "accent-pink": "#DB2777",
  "accent-orange": "#EA580C",
  "accent-red": "#DC2626",
};

const DARK: TokenSet = {
  bg: "#21202E",
  surface: "#2C2A3A",
  "surface-elevated": "#3D3B4D",
  border: "#3D3B4D",
  "text-primary": "#EDECEE",
  "text-muted": "#A7A6B0",
  "accent-purple": "#A277FF",
  "accent-cyan": "#61FFCA",
  "accent-pink": "#FF6AD5",
  "accent-orange": "#FFCA85",
  "accent-red": "#FF6767",
};

/**
 * Find the first occurrence of `selector` followed by `{` (skipping
 * mentions of the selector inside comments). Returns the body between
 * `{` and the matching `}` (flat — no nested rules supported, which
 * is fine for our @theme inline / :root token blocks).
 */
function extractBlock(selector: string): string {
  let scan = 0;
  while (scan < STYLES.length) {
    const idx = STYLES.indexOf(selector, scan);
    expect(idx).toBeGreaterThan(-1);
    const afterSelector = STYLES.slice(idx + selector.length);
    // Skip any whitespace/comma chain between selector and `{`; reject
    // matches that are clearly inside a `/* ... */` block.
    const restMatch = /^[^{]*\{/.exec(afterSelector);
    if (!restMatch) {
      scan = idx + selector.length;
      continue;
    }
    // Determine if this match sits inside a CSS comment.
    const before = STYLES.slice(0, idx);
    const lastOpen = before.lastIndexOf("/*");
    const lastClose = before.lastIndexOf("*/");
    if (lastOpen > lastClose) {
      // Inside a comment — skip to next occurrence.
      scan = idx + selector.length;
      continue;
    }
    const openBrace = idx + selector.length + restMatch.index + restMatch[0].length - 1;
    const closeBrace = STYLES.indexOf("}", openBrace);
    return STYLES.slice(openBrace + 1, closeBrace);
  }
  throw new Error(`Could not locate block for selector: ${selector}`);
}

describe("styles.css — light theme tokens", () => {
  const lightBlock = extractBlock(':root[data-theme="light"]');

  test.each(Object.entries(LIGHT))("--%s is %s in light", (key, expected) => {
    // case-insensitive: hex letter case varies between editors / formatters.
    const pattern = new RegExp(`--${key}\\s*:\\s*${expected}\\b`, "i");
    expect(lightBlock).toMatch(pattern);
  });

  test("declares color-scheme: light", () => {
    expect(lightBlock).toMatch(/color-scheme:\s*light/);
  });
});

describe("styles.css — dark theme tokens", () => {
  const darkBlock = extractBlock(':root[data-theme="dark"]');

  test.each(Object.entries(DARK))("--%s is %s in dark", (key, expected) => {
    const pattern = new RegExp(`--${key}\\s*:\\s*${expected}\\b`, "i");
    expect(darkBlock).toMatch(pattern);
  });

  test("declares color-scheme: dark", () => {
    expect(darkBlock).toMatch(/color-scheme:\s*dark/);
  });
});

describe("styles.css — @theme inline exposes Tailwind utility names", () => {
  const themeBlock = extractBlock("@theme inline");

  test.each(Object.keys(LIGHT))("--color-%s maps to var(--%s)", (key) => {
    const pattern = new RegExp(`--color-${key}\\s*:\\s*var\\(\\s*--${key}\\s*\\)`);
    expect(themeBlock).toMatch(pattern);
  });

  test("legacy ink-navy / off-white / warm-sepia / parchment-cream aliases are removed", () => {
    // Aliases existed only during the redesign migration (task 1.4)
    // and were stripped by task 13.2 once components consumed the new
    // tokens. Their presence in @theme inline would mean a half-done
    // migration.
    expect(themeBlock).not.toMatch(/--color-ink-navy/);
    expect(themeBlock).not.toMatch(/--color-off-white/);
    expect(themeBlock).not.toMatch(/--color-warm-sepia/);
    expect(themeBlock).not.toMatch(/--color-parchment-cream/);
  });
});
