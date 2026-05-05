/**
 * Static guard — public-pages spec "Canvas editor is excluded from AppLayout".
 *
 * Asserts the canvas-editor source surface (CanvasPage.tsx and Editor.tsx)
 * does not import the AppLayout / PublicLayout shells. Canvas owns its own
 * TopBar chrome and must not be wrapped in either landing layout.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

const FORBIDDEN_PATTERNS = [
  /from\s+["'][./]+landing\/AppLayout["']/,
  /from\s+["'][./]+landing\/PublicLayout["']/,
];

const PROHIBITED_FILES = ["src/canvas/CanvasPage.tsx", "src/canvas/Editor.tsx"];

describe("AppLayout — canvas editor exclusion", () => {
  test.each(PROHIBITED_FILES)("%s does not import AppLayout or PublicLayout", (rel) => {
    const source = readFileSync(resolve(ROOT, rel), "utf-8");
    for (const pat of FORBIDDEN_PATTERNS) {
      expect(source).not.toMatch(pat);
    }
  });

  test("router.tsx wires canvasRoute WITHOUT wrapping in AppLayout", () => {
    const source = readFileSync(resolve(ROOT, "src/router.tsx"), "utf-8");
    // Locate the `canvasRoute = createRoute({ ... })` block and assert
    // AppLayout does not appear inside its component body.
    const start = source.indexOf("canvasRoute = createRoute");
    expect(start).toBeGreaterThan(-1);
    const segment = source.slice(start, start + 400);
    expect(segment).not.toContain("AppLayout");
    expect(segment).not.toContain("PublicLayout");
  });
});
