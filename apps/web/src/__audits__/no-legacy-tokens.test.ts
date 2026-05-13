/**
 * no-legacy-tokens.test.ts — guard that the Aura redesign migration
 * does not leak the pre-redesign brand tokens into component class
 * strings.
 *
 * Spec ref: openspec/specs/public-pages/spec.md
 *   scenario: "Grep finds no legacy token usage in public-page components after archive"
 *
 * The forbidden tokens are the four brand identifiers introduced in
 * Phase 1 (`ink-navy`, `warm-sepia`, `parchment-cream`, `off-white`).
 * All component code SHALL consume Aura tokens instead. Legacy
 * aliases declared in `styles.css` are scoped to the @theme block
 * during migration; this audit scans only `.tsx` source.
 *
 * If this audit fails after the change is archived, either consume
 * the new token name or move the offending UI explicitly out of scope
 * with a comment naming the spec scenario it falls under.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const SCAN_DIRS = [
  "landing",
  "dashboard",
  "account",
  "auth",
  "chrome",
  "agent",
  "canvas",
  "components",
  "theme",
];

const FORBIDDEN = /\b(ink-navy|warm-sepia|parchment-cream|off-white)\b/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      yield full;
    }
  }
}

describe("no-legacy-tokens", () => {
  test("no .tsx source file references ink-navy / warm-sepia / parchment-cream / off-white", () => {
    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const dir of SCAN_DIRS) {
      const fullDir = join(ROOT, dir);
      let exists = true;
      try {
        statSync(fullDir);
      } catch {
        exists = false;
      }
      if (!exists) continue;
      for (const file of walk(fullDir)) {
        const src = readFileSync(file, "utf-8");
        const lines = src.split("\n");
        lines.forEach((line, idx) => {
          if (FORBIDDEN.test(line)) {
            violations.push({
              file: file.replace(ROOT, ""),
              line: idx + 1,
              text: line.trim(),
            });
          }
        });
      }
    }
    if (violations.length > 0) {
      const summary = violations.map((v) => `${v.file}:${v.line}  ${v.text}`).join("\n");
      // eslint-disable-next-line no-console
      console.error(`Found ${violations.length} legacy-token usage(s):\n${summary}`);
    }
    expect(violations).toHaveLength(0);
  });
});
