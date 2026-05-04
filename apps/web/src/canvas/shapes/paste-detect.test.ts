/**
 * paste-detect tests — does pasted clipboard text look like a single URL?
 *
 * Spec: canvas-editor — "Pasting a URL onto an empty canvas region
 * creates a Link card shape".
 *
 * The detector is a pure function so the Editor.tsx paste handler can
 * call it without knowing tldraw's clipboard internals. Caller is still
 * responsible for *where* (canvas vs inside an open shape editor) — this
 * function only answers "is the payload a single http(s) URL?".
 */

import { describe, expect, test } from "bun:test";
import { detectPastedUrl } from "./paste-detect";

describe("detectPastedUrl — happy paths", () => {
  const cases: Array<{ label: string; input: string; expected: string }> = [
    { label: "exact https URL", input: "https://example.com", expected: "https://example.com" },
    {
      label: "URL with path + query",
      input: "https://example.com/post?q=1",
      expected: "https://example.com/post?q=1",
    },
    {
      label: "leading + trailing whitespace trimmed",
      input: "  https://example.com  ",
      expected: "https://example.com",
    },
    {
      label: "trailing newline trimmed",
      input: "https://example.com\n",
      expected: "https://example.com",
    },
    {
      label: "http (not https) accepted",
      input: "http://example.com",
      expected: "http://example.com",
    },
  ];
  for (const c of cases) {
    test(c.label, () => {
      const r = detectPastedUrl(c.input);
      expect(r).toEqual({ url: c.expected });
    });
  }
});

describe("detectPastedUrl — rejected cases", () => {
  const cases: Array<{ label: string; input: string }> = [
    { label: "empty string", input: "" },
    { label: "whitespace only", input: "   \n  " },
    { label: "plain text", input: "just some text" },
    {
      label: "two URLs on separate lines",
      input: "https://a.com\nhttps://b.com",
    },
    {
      label: "URL surrounded by other words",
      input: "see https://example.com for details",
    },
    { label: "non-http protocol (file://)", input: "file:///etc/passwd" },
    { label: "non-http protocol (javascript:)", input: "javascript:alert(1)" },
    { label: "data URL", input: "data:text/html,<script>" },
    { label: "malformed URL", input: "https://" },
  ];
  for (const c of cases) {
    test(`null: ${c.label}`, () => {
      expect(detectPastedUrl(c.input)).toBeNull();
    });
  }
});
