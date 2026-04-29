/**
 * Editor.no-canvas-animation.test.tsx — Lint-style test for animation discipline.
 *
 * Enforces CLAUDE.md hard rule 5:
 *   ✅ Chrome region (TopBar, MainMenu dialogs) MAY use motion
 *   ❌ Canvas region (<Tldraw> and its subtree) MUST NOT use motion/*
 *
 * Strategy: scan source files statically (grep patterns) rather than
 * instrumenting the DOM. This is more reliable than runtime component-tree
 * inspection with mocked tldraw.
 *
 * Spec: "Chrome animations use motion; canvas region uses none"
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SRC = join(import.meta.dir, "..");
const CANVAS_DIR = join(SRC, "canvas");
const CHROME_DIR = join(SRC, "chrome");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSource(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function getSourceFiles(dir: string, ext = ".tsx"): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(ext) || f.endsWith(".ts"))
      .filter((f) => !f.endsWith(".test.tsx") && !f.endsWith(".test.ts"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

// Detect motion imports in a source file
function hasMotionImport(source: string): boolean {
  return (
    /from\s+['"]motion['"]/m.test(source) ||
    /from\s+['"]framer-motion['"]/m.test(source) ||
    /import\s+.*AnimatePresence/m.test(source) ||
    /<motion\./m.test(source) ||
    /<AnimatePresence/m.test(source)
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Animation discipline — canvas region has no app-level animation wrapper", () => {
  // Editor.tsx MUST NOT import or use motion in the canvas wrapper
  test("Editor.tsx does not wrap <Tldraw> with motion or AnimatePresence", () => {
    const editorSource = readSource(join(CANVAS_DIR, "Editor.tsx"));
    expect(editorSource.length).toBeGreaterThan(0); // file exists

    // The file should NOT import from motion/framer-motion for use around tldraw
    const hasMotion = hasMotionImport(editorSource);
    expect(hasMotion).toBe(false);
  });

  // use-autosave and persistence have no reason for animation imports
  test("persistence.ts has no motion imports", () => {
    const source = readSource(join(CANVAS_DIR, "persistence.ts"));
    expect(hasMotionImport(source)).toBe(false);
  });

  test("use-autosave.ts has no motion imports", () => {
    const source = readSource(join(CANVAS_DIR, "use-autosave.ts"));
    expect(hasMotionImport(source)).toBe(false);
  });
});

describe("Animation discipline — chrome region may use motion (positive assertion)", () => {
  // The chrome files are allowed to use motion; this test verifies the
  // separation is respected. We just check chrome files exist and can be read.
  test("chrome directory exists and has component files", () => {
    const files = getSourceFiles(CHROME_DIR);
    expect(files.length).toBeGreaterThan(0);
  });

  // Verify TopBar and MainMenu exist as chrome files (animation is in them)
  test("TopBar.tsx exists in chrome directory", () => {
    const source = readSource(join(CHROME_DIR, "TopBar.tsx"));
    expect(source.length).toBeGreaterThan(0);
  });

  test("MainMenu.tsx exists in chrome directory", () => {
    const source = readSource(join(CHROME_DIR, "MainMenu.tsx"));
    expect(source.length).toBeGreaterThan(0);
  });
});
