/**
 * forbidden-imports test — motion-system spec "Motion is allowed only on
 * listed surfaces".
 *
 * Statically asserts that the canvas-editor surface (Editor.tsx) and any
 * multiplayer cursor / presence renderers (CollaboratorAvatars.tsx) do
 * NOT import the `motion` library or any module under `apps/web/src/motion/`.
 * This is the "trip-wire" preventing future drift — if anyone adds
 * `import { motion } from "motion/react"` to Editor.tsx, this test fails.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

const FORBIDDEN_PATHS = [
  /from\s+["']motion["']/,
  /from\s+["']motion\/.+["']/,
  /from\s+["'][./]+motion\/primitives["']/,
  /from\s+["'][./]+motion\/dialog["']/,
];

const PROHIBITED_FILES = ["src/canvas/Editor.tsx", "src/canvas/CollaboratorAvatars.tsx"];

describe("motion-system — forbidden imports", () => {
  test.each(PROHIBITED_FILES)(
    "%s does not import motion library or local motion module",
    (relPath) => {
      const fullPath = resolve(ROOT, relPath);
      const source = readFileSync(fullPath, "utf-8");
      for (const pattern of FORBIDDEN_PATHS) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});
