/**
 * paste-detect — pure helper: does pasted clipboard text look like a
 * single http(s) URL?
 *
 * Returns `{ url }` for a single trimmed URL whose protocol is http(s)
 * and which parses without error. Returns null for empty / whitespace,
 * multi-line text, surrounding non-URL words, or non-http protocols
 * (file:, javascript:, data:, etc.).
 *
 * Spec: canvas-editor — "Pasting a URL onto an empty canvas region
 * creates a Link card shape".
 */

export interface DetectedUrl {
  url: string;
}

export function detectPastedUrl(input: string): DetectedUrl | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  // Reject any whitespace-bearing payload — multi-line / surrounded.
  if (/\s/.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // URL constructor accepts `https://` (no host) — reject empty hostname.
  if (parsed.hostname.length === 0) return null;
  return { url: trimmed };
}
