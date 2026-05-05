/**
 * i18n-audit — static lint-style test that fails when JSX contains
 * hardcoded display strings.
 *
 * Spec: i18n-audit
 *   - "Static i18n audit fails when JSX contains hardcoded display strings"
 *   - "All visible Dashboard, Auth, and Account display strings come from i18n"
 *   - "i18n audit runs as part of the project test suite"
 *
 * Strategy: walk every .tsx / .ts source file under apps/web/src/
 * (excluding tests + this file) using the TypeScript compiler API.
 * For each JSX text node and each user-visible JSX attribute (aria-label,
 * placeholder, title, alt), reject literal strings unless they match an
 * allowlist (brand name, version pattern, single punctuation, single
 * ASCII chars, pure digits, emoji).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as ts from "typescript";

const ROOT = resolve(import.meta.dir);
const PROJECT_ROOT = resolve(ROOT, "../..");

// Attributes whose values are user-visible (so literals there must be i18n).
const USER_VISIBLE_ATTRS = new Set(["aria-label", "placeholder", "title", "alt"]);

// Allowlist patterns.
const BRAND_NAME = "Vellum";
const VERSION_RE = /^v\d+(\.\d+)*$/;
const PUNCT_ONLY_RE = /^[\s\p{P}\p{S}]+$/u;
const PURE_DIGITS_RE = /^\d+$/;
// Emoji range — broad coverage.
const EMOJI_RE = /^(?:[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F2FF}])+$/u;
// Locale picker native names — intentionally NOT translated (a user
// switching to "English" must see the word "English" regardless of
// current language).
const LOCALE_NATIVE_NAMES = new Set(["繁體中文", "English"]);

interface Violation {
  file: string;
  line: number;
  content: string;
  kind: "jsx-text" | "attr";
  attrName?: string;
}

function isAllowlisted(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length === 1) return true; // single char (punct, digit, letter)
  if (trimmed === BRAND_NAME) return true;
  if (VERSION_RE.test(trimmed)) return true;
  if (PUNCT_ONLY_RE.test(trimmed)) return true;
  if (PURE_DIGITS_RE.test(trimmed)) return true;
  if (EMOJI_RE.test(trimmed)) return true;
  if (LOCALE_NATIVE_NAMES.has(trimmed)) return true;
  return false;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip generated / vendor dirs.
      if (entry === "node_modules" || entry === "dist" || entry === "assets") continue;
      yield* walk(full);
    } else if (st.isFile()) {
      // Only TS / TSX source files; exclude tests + this file + generated CSS.
      if (!/\.(tsx?|ts)$/.test(entry)) continue;
      if (entry.endsWith(".test.tsx") || entry.endsWith(".test.ts")) continue;
      if (entry === "i18n-audit.test.ts") continue;
      if (entry.endsWith(".gen.css")) continue;
      yield full;
    }
  }
}

function findViolations(filePath: string): Violation[] {
  const source = readFileSync(filePath, "utf-8");
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  const rel = relative(PROJECT_ROOT, filePath);

  function visit(node: ts.Node) {
    // JSX text node — rendered as visible text.
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      if (raw.trim().length > 0 && !isAllowlisted(raw)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        violations.push({
          file: rel,
          line: line + 1,
          content: raw.trim(),
          kind: "jsx-text",
        });
      }
    }
    // JSX attribute with literal string value, only for user-visible attrs.
    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (USER_VISIBLE_ATTRS.has(name)) {
        // Initializer is either StringLiteral ("...") or JsxExpression ({...}).
        if (ts.isStringLiteral(node.initializer)) {
          const value = node.initializer.text;
          if (value.trim().length > 0 && !isAllowlisted(value)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.initializer.getStart(sf));
            violations.push({
              file: rel,
              line: line + 1,
              content: value,
              kind: "attr",
              attrName: name,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

const SRC_ROOT = resolve(ROOT);

describe("i18n-audit — JSX must use t(key) for display strings", () => {
  test("no hardcoded display strings in apps/web/src", () => {
    const allViolations: Violation[] = [];
    for (const file of walk(SRC_ROOT)) {
      allViolations.push(...findViolations(file));
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .map((v) => {
          const tag = v.kind === "attr" ? `${v.attrName}=` : "text:";
          return `  ${v.file}:${v.line}  ${tag} "${v.content}"`;
        })
        .join("\n");
      throw new Error(
        `Found ${allViolations.length} hardcoded display string(s):\n${summary}\n\nReplace each with t("key") and add the key to packages/shared/src/locales/{zh-TW,en}.json.`,
      );
    }

    expect(allViolations.length).toBe(0);
  });

  test("audit allowlist correctly accepts the brand name + version", () => {
    expect(isAllowlisted("Vellum")).toBe(true);
    expect(isAllowlisted("v0.9.0")).toBe(true);
    expect(isAllowlisted("v1.0")).toBe(true);
    expect(isAllowlisted("v0")).toBe(true);
  });

  test("audit allowlist correctly accepts single chars / punct / digits / emoji", () => {
    expect(isAllowlisted("…")).toBe(true);
    expect(isAllowlisted("·")).toBe(true);
    expect(isAllowlisted("→")).toBe(true);
    expect(isAllowlisted("12")).toBe(true);
    expect(isAllowlisted("?")).toBe(true);
    expect(isAllowlisted("🎨")).toBe(true);
  });

  test("audit allowlist rejects display strings that should be i18n", () => {
    expect(isAllowlisted("Cancel")).toBe(false);
    expect(isAllowlisted("your@email.com")).toBe(false);
    expect(isAllowlisted("Sign in to Vellum")).toBe(false);
    expect(isAllowlisted("Folders")).toBe(false);
  });
});
