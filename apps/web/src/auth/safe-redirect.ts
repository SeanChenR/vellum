/**
 * safeRedirect — guard against open-redirect / phishing via `?redirect=` query.
 *
 * Accepts only same-origin path-style URLs:
 *   - must start with "/"
 *   - must NOT start with "//" (protocol-relative escape: //evil.com)
 *   - must NOT contain "\" (some browsers normalize \ to / in URLs)
 *
 * Returns the original value when safe, otherwise the fallback (default
 * "/dashboard"). Used by LoginPage and MagicLinkVerifyPage to forward an
 * invite-accept URL through the auth flow without becoming an open redirect.
 */

export function safeRedirect(input: string | null | undefined, fallback = "/dashboard"): string {
  if (!input || typeof input !== "string") return fallback;
  if (!input.startsWith("/")) return fallback;
  if (input.startsWith("//")) return fallback;
  if (input.includes("\\")) return fallback;
  return input;
}
