/**
 * markdown-parser tests — driven by the spec example table in
 * specs/canvas-shapes (Markdown shape parses and sanitizes content).
 *
 * The parser is a pure function (input string → safe HTML string). It
 * MUST NOT throw, MUST strip <script> + inline event handlers, MUST
 * support GFM (table / task-list / strike / autolink), and MUST treat
 * empty / garbage input as safe-empty rather than crashing.
 */

import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "./markdown-parser";

describe("parseMarkdown — spec example table", () => {
  test('"# Title" produces an <h1>Title</h1>', () => {
    const html = parseMarkdown("# Title");
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("</h1>");
  });

  test("task-list checkboxes render as input[checkbox]", () => {
    const html = parseMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain("<input ");
    expect(html).toContain('type="checkbox"');
    // Both states present
    expect(html).toMatch(/checked/);
    expect(html.match(/<input/g)?.length).toBe(2);
  });

  test("<script> injection is stripped", () => {
    const html = parseMarkdown("<script>alert(1)</script>hi");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).toContain("hi");
  });

  test("inline onclick handler is stripped", () => {
    const html = parseMarkdown('<a onclick="x()">x</a>');
    expect(html.toLowerCase()).not.toContain("onclick");
  });

  test("GFM table renders as <table>/<thead>/<tbody>", () => {
    const html = parseMarkdown("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("<tbody");
  });

  test("empty input returns empty/whitespace HTML, not throw", () => {
    expect(() => parseMarkdown("")).not.toThrow();
    const html = parseMarkdown("");
    expect(html.trim()).toBe("");
  });
});

describe("parseMarkdown — robustness", () => {
  test("does not throw on malformed input", () => {
    expect(() => parseMarkdown("<<<not really markdown<<")).not.toThrow();
    const html = parseMarkdown("<<<not really markdown<<");
    expect(typeof html).toBe("string");
  });

  test("strips inline event handlers (onload, onerror)", () => {
    const html1 = parseMarkdown('<img src="x" onerror="evil()" />');
    expect(html1.toLowerCase()).not.toContain("onerror");

    const html2 = parseMarkdown('<body onload="evil()">body</body>');
    expect(html2.toLowerCase()).not.toContain("onload");
  });

  test("strikethrough renders", () => {
    const html = parseMarkdown("~~struck~~");
    expect(html.toLowerCase()).toMatch(/<(del|s)\b/);
  });

  test("autolink converts bare URLs to anchors", () => {
    const html = parseMarkdown("Visit https://example.com today");
    expect(html.toLowerCase()).toContain("<a");
    expect(html).toContain("https://example.com");
  });

  test("does not enable raw HTML pass-through for arbitrary tags", () => {
    // marked default keeps simple inline HTML, but DOMPurify must strip
    // anything dangerous. <iframe> is the canonical dangerous tag.
    const html = parseMarkdown("<iframe src='evil.com'></iframe>safe");
    expect(html.toLowerCase()).not.toContain("<iframe");
    expect(html).toContain("safe");
  });
});
