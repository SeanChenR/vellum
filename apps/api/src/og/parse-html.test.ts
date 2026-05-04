/**
 * parse-html tests — pure HTML → OG metadata extractor.
 *
 * Spec: canvas-shapes — "OG metadata endpoint returns sanitized parsed
 * result with two-tier cache" (parser portion only — endpoint integration
 * tested in og/index.test.ts).
 */

import { describe, expect, test } from "bun:test";
import { parseHtmlForOg } from "./parse-html";

describe("parseHtmlForOg — example table", () => {
  const cases: Array<{
    label: string;
    html: string;
    expect: Partial<Record<"title" | "description" | "image" | "favicon" | "siteName", string>>;
  }> = [
    {
      label: "og:title meta → title field",
      html: `<html><head><meta property="og:title" content="Hi"></head><body></body></html>`,
      expect: { title: "Hi" },
    },
    {
      label: "og:description meta (name attr) → description field",
      html: `<html><head><meta name="og:description" content="d"></head></html>`,
      expect: { description: "d" },
    },
    {
      label: "og:image meta → image field",
      html: `<html><head><meta property="og:image" content="https://example.com/img.png"></head></html>`,
      expect: { image: "https://example.com/img.png" },
    },
    {
      label: "og:site_name meta → siteName field",
      html: `<html><head><meta property="og:site_name" content="Example"></head></html>`,
      expect: { siteName: "Example" },
    },
    {
      label: "<title> as fallback when og:title is missing",
      html: `<html><head><title>Backup</title></head></html>`,
      expect: { title: "Backup" },
    },
    {
      label: "<link rel=icon> → favicon field",
      html: `<html><head><link rel="icon" href="/x.ico"></head></html>`,
      expect: { favicon: "/x.ico" },
    },
  ];

  for (const c of cases) {
    test(c.label, () => {
      const result = parseHtmlForOg(c.html);
      for (const [k, v] of Object.entries(c.expect)) {
        expect(result[k as keyof typeof result]).toBe(v);
      }
    });
  }
});

describe("parseHtmlForOg — empty / missing fields", () => {
  test("none of the OG meta tags present → empty object (no falsy strings)", () => {
    const result = parseHtmlForOg("<html><head></head><body></body></html>");
    expect(result).toEqual({});
  });

  test("og:title takes precedence over <title> when both present", () => {
    const html = `<html><head><meta property="og:title" content="OG"><title>Plain</title></head></html>`;
    const result = parseHtmlForOg(html);
    expect(result.title).toBe("OG");
  });

  test("does not throw on malformed HTML", () => {
    expect(() => parseHtmlForOg("<<<not html<<<")).not.toThrow();
    expect(typeof parseHtmlForOg("<<<not html<<<")).toBe("object");
  });

  test("missing fields are omitted, not returned as empty strings", () => {
    const html = `<html><head><meta property="og:title" content="Only Title"></head></html>`;
    const result = parseHtmlForOg(html);
    expect(result.title).toBe("Only Title");
    expect("description" in result).toBe(false);
    expect("image" in result).toBe(false);
    expect("favicon" in result).toBe(false);
    expect("siteName" in result).toBe(false);
  });
});
