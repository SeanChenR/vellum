/**
 * main.test.ts — verifies the theme bootstrap is the first effectful
 * statement in main.tsx so React renders against the correct
 * `data-theme`.
 *
 * Spec ref: openspec/specs/theme-switching/spec.md
 *   "Document theme is applied before React mount"
 *
 * We test this by inspecting the source: the first non-side-effect-free
 * statement after the imports MUST be `applyInitialTheme()`. Source
 * inspection is the right tool here — actually loading main.tsx in a
 * test would also boot React + tldraw, which is not what we are
 * asserting about.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAIN_SRC = readFileSync(fileURLToPath(new URL("./main.tsx", import.meta.url)), "utf-8");

describe("main.tsx", () => {
  test("imports applyInitialTheme from ./theme/bootstrap-theme", () => {
    expect(MAIN_SRC).toMatch(
      /import\s*\{\s*applyInitialTheme\s*\}\s*from\s*["']\.\/theme\/bootstrap-theme["']/,
    );
  });

  test("calls applyInitialTheme() before any other side-effectful statement", () => {
    // Strip line comments and block comments, then collect non-import
    // top-level statements in source order.
    const stripped = MAIN_SRC.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter((line) => line.length > 0);
    const firstNonImport = stripped.find((line) => !line.startsWith("import"));
    expect(firstNonImport).toBe("applyInitialTheme();");
  });
});
