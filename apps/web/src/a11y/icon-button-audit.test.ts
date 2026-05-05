/**
 * icon-button-audit — static lint-style test that fails when a `<button>`
 * with only an SVG / image child has no accessible name.
 *
 * Spec: a11y — "Icon-only buttons must declare an accessible label".
 *
 * Strategy: walk every TSX source under apps/web/src/, parse via the
 * TypeScript compiler API, and inspect each `<button>` JSX element. If
 * the button has no rendered text node child (only `<svg>` / `<img>`
 * children, no t(...) expression child, no plain text) AND no
 * `aria-label` / `aria-labelledby` attribute, fail and report the
 * file:line.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as ts from "typescript";

const ROOT = resolve(import.meta.dir, "..");
const PROJECT_ROOT = resolve(ROOT, "../..");

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "assets") continue;
      yield* walk(full);
    } else if (st.isFile()) {
      if (!entry.endsWith(".tsx")) continue;
      if (entry.endsWith(".test.tsx")) continue;
      yield full;
    }
  }
}

function getAttrName(attr: ts.JsxAttribute): string {
  return attr.name.getText();
}

function elementHasAccessibleName(
  opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
): boolean {
  for (const attr of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = getAttrName(attr);
    if (name === "aria-label" || name === "aria-labelledby") return true;
  }
  return false;
}

function hasOnlyIconChildren(element: ts.JsxElement): boolean {
  // True = all visible children are <svg> / <img>, with no rendered text.
  let sawIcon = false;
  for (const child of element.children) {
    if (ts.isJsxText(child)) {
      // Ignore whitespace-only text.
      if (child.getText().trim().length > 0) return false;
    } else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      const tag = ts.isJsxElement(child)
        ? child.openingElement.tagName.getText()
        : child.tagName.getText();
      if (tag === "svg" || tag === "img" || tag.endsWith("Icon")) {
        sawIcon = true;
      } else if (tag === "span" && ts.isJsxElement(child)) {
        // <span> may wrap an icon — recurse.
        if (hasOnlyIconChildren(child)) {
          sawIcon = true;
        } else {
          return false;
        }
      } else {
        // Any other element child means it's not pure icon (e.g. a text wrapper).
        return false;
      }
    } else if (ts.isJsxExpression(child)) {
      // {expr} child — could be t(...) which is text. Treat as text child.
      if (child.expression) return false;
    }
  }
  return sawIcon;
}

function findButtonViolations(filePath: string): Violation[] {
  const source = readFileSync(filePath, "utf-8");
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  const rel = relative(PROJECT_ROOT, filePath);

  function visit(node: ts.Node) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText();
      if (tag === "button") {
        if (hasOnlyIconChildren(node) && !elementHasAccessibleName(node.openingElement)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          violations.push({
            file: rel,
            line: line + 1,
            snippet: source.slice(
              node.getStart(sf),
              Math.min(node.getStart(sf) + 80, source.length),
            ),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

describe("icon-button-audit — icon-only buttons need aria-label", () => {
  test("no <button> with only icon children lacks aria-label / aria-labelledby", () => {
    const allViolations: Violation[] = [];
    for (const file of walk(ROOT)) {
      allViolations.push(...findButtonViolations(file));
    }

    if (allViolations.length > 0) {
      const summary = allViolations
        .map((v) => `  ${v.file}:${v.line}\n      ${v.snippet}`)
        .join("\n");
      throw new Error(
        `Found ${allViolations.length} icon-only <button> without accessible name:\n${summary}\n\nAdd aria-label={t("...")} or aria-labelledby to each.`,
      );
    }

    expect(allViolations.length).toBe(0);
  });
});
