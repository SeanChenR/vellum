/**
 * code-highlight tests — Shiki-backed syntax highlighting.
 *
 * Spec: canvas-shapes — "Code shape highlights via lazy-loaded Shiki".
 *
 * Tested behaviour:
 *  - SUPPORTED_LANGUAGES exports the agreed 12-language list
 *  - highlightCode("print('hi')", "python") → tokens for `print` and 'hi'
 *  - highlightCode(<source>, "klingon") → plain-text fallback + error key
 *  - highlightCode does not throw for any input
 */

import { describe, expect, test } from "bun:test";
import { highlightCode, SUPPORTED_LANGUAGES } from "./code-highlight";

describe("SUPPORTED_LANGUAGES", () => {
  test("includes the agreed 12-language set in canonical order", () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      "javascript",
      "typescript",
      "python",
      "go",
      "swift",
      "rust",
      "html",
      "css",
      "sql",
      "bash",
      "markdown",
      "json",
    ]);
  });
});

describe("highlightCode — supported language", () => {
  test("python source produces tokens for `print` identifier and 'hi' string", async () => {
    const result = await highlightCode("print('hi')", "python");
    expect(result.error).toBeNull();
    expect(result.tokens.length).toBeGreaterThanOrEqual(1);
    const flat = result.tokens.flat().map((t) => t.content);
    expect(flat.join("")).toContain("print");
    expect(flat.join("")).toContain("hi");
    // At least one token has color metadata (proves Shiki ran, not a plain-text bypass)
    const anyColored = result.tokens.flat().some((t) => Boolean(t.color));
    expect(anyColored).toBe(true);
  });

  test("javascript source highlights without error", async () => {
    const result = await highlightCode("const x = 1;", "javascript");
    expect(result.error).toBeNull();
    expect(
      result.tokens
        .flat()
        .map((t) => t.content)
        .join(""),
    ).toContain("const");
  });
});

describe("highlightCode — unknown language fallback", () => {
  test("unknown language returns plain text + i18n error key", async () => {
    const source = "anything goes here";
    const result = await highlightCode(source, "klingon");
    expect(result.error).toBe("errors.shape.code.unknownLanguage");
    // One row, source preserved verbatim, no color
    expect(result.tokens.length).toBe(1);
    expect(result.tokens[0]?.length).toBe(1);
    expect(result.tokens[0]?.[0]?.content).toBe(source);
  });

  test("does not throw for empty source", async () => {
    const result = await highlightCode("", "python");
    expect(typeof result).toBe("object");
    expect(Array.isArray(result.tokens)).toBe(true);
  });
});
