/**
 * slugify tests — driven by the spec example table in
 * specs/canvas-export (Export filename derives from canvas title via slugify).
 *
 * Pure function: takes the canvas title, returns a filesystem-safe
 * filename stem. Preserves ASCII letters, ASCII digits, and CJK
 * Unified Ideographs; collapses every other character to a single
 * hyphen; trims; lowercases ASCII; falls back to "canvas" if empty.
 */

import { describe, expect, test } from "bun:test";
import { slugify } from "./slugify";

describe("slugify — spec example table", () => {
  test.each([
    ["My Canvas", "my-canvas"],
    ["My  Canvas!!!", "my-canvas"],
    ["我的 Canvas (草稿)", "我的-canvas-草稿"],
    ["   ", "canvas"],
    ["////", "canvas"],
    ["已存檔-2026", "已存檔-2026"],
  ])("slugify(%j) === %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("slugify — additional invariants", () => {
  test("returns 'canvas' for empty string", () => {
    expect(slugify("")).toBe("canvas");
  });

  test("lowercases ASCII letters", () => {
    expect(slugify("HelloWorld")).toBe("helloworld");
    expect(slugify("MyDOC")).toBe("mydoc");
  });

  test("preserves CJK Unified Ideographs verbatim", () => {
    expect(slugify("筆記本")).toBe("筆記本");
  });

  test("collapses runs of disallowed characters into a single hyphen", () => {
    expect(slugify("a___b---c")).toBe("a-b-c");
    expect(slugify("a   b   c")).toBe("a-b-c");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
    expect(slugify("!!!world!!!")).toBe("world");
  });

  test("preserves ASCII digits", () => {
    expect(slugify("file-2026-04-30")).toBe("file-2026-04-30");
  });

  test("emoji and punctuation collapse to hyphen / fallback", () => {
    expect(slugify("🎨🎨")).toBe("canvas");
    expect(slugify("hello 🎨 world")).toBe("hello-world");
  });

  test("never returns empty string", () => {
    for (const input of ["", " ", "?!", "----", "🎉"]) {
      expect(slugify(input).length).toBeGreaterThan(0);
    }
  });

  test("is deterministic / idempotent on already-slugified input", () => {
    const once = slugify("My Canvas");
    expect(slugify(once)).toBe(once);
  });
});
