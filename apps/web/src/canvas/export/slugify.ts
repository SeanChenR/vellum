/**
 * slugify — pure function that converts a canvas title into a
 * filesystem-safe filename stem. See specs/canvas-export
 * (Export filename derives from canvas title via slugify).
 *
 * Allowed verbatim:
 *   - ASCII letters (lowercased)
 *   - ASCII digits
 *   - CJK Unified Ideographs (U+4E00 – U+9FFF)
 *
 * Everything else is replaced with `-`. Consecutive hyphens collapse,
 * leading / trailing hyphens are trimmed. Empty result falls back to
 * "canvas".
 */

const FALLBACK = "canvas";

// Match characters that are NOT allowed verbatim. Anything outside this set
// becomes a hyphen. The `g` flag is required for `.replace` to act globally.
const DISALLOWED = /[^a-z0-9一-鿿]+/g;

export function slugify(input: string): string {
  const lowered = input.toLowerCase();
  const replaced = lowered.replace(DISALLOWED, "-");
  const trimmed = replaced.replace(/^-+|-+$/g, "");
  return trimmed === "" ? FALLBACK : trimmed;
}
