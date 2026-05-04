/**
 * markdown-parser — parse + sanitize user-authored markdown into safe HTML.
 *
 * Pipeline: `marked` (GFM extensions: table, task-list, strikethrough,
 * autolink) → `DOMPurify` (strip scripts, inline event handlers, dangerous
 * tags). Pure function — never throws, returns a string for any input.
 *
 * Spec: canvas-shapes — "Markdown shape parses and sanitizes content via
 * a deep module".
 *
 * ADR: docs/adr/0008-markdown-engine-marked.md (engine choice + alternatives).
 */

import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Convert markdown source to safe HTML.
 *
 * - Always returns a string (no throws even for malformed input).
 * - Strips `<script>`, `<iframe>`, inline event handlers (`onclick=`,
 *   `onload=`, `onerror=`, etc.) — DOMPurify defaults handle this.
 * - Empty input → empty string.
 * - GFM enabled: tables, task-lists, strikethrough, autolinks.
 */
export function parseMarkdown(input: string): string {
  if (!input) return "";
  let raw: string;
  try {
    // marked.parse returns string when async option is off (default).
    raw = marked.parse(input, { async: false }) as string;
  } catch {
    return "";
  }
  return DOMPurify.sanitize(raw);
}

/**
 * Inline-only markdown render — used by Callout shape body where block
 * elements (headings, lists, tables, code blocks) must NOT appear.
 *
 * Uses marked's `parseInline` API (no paragraph wrap, no block parsing)
 * then sanitizes the same way as `parseMarkdown`.
 */
export function parseMarkdownInline(input: string): string {
  if (!input) return "";
  let raw: string;
  try {
    raw = marked.parseInline(input, { async: false }) as string;
  } catch {
    return "";
  }
  return DOMPurify.sanitize(raw);
}
