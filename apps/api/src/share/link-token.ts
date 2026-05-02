/**
 * Public-link token utility — 32 bytes of crypto-random base64url.
 *
 * Same shape as `invite-token` but kept independent so future divergence
 * (e.g., higher-entropy public-link tokens) does not require touching
 * invite logic.
 *
 * Spec: sharing — "Owner toggles the public link mode" / "Owner rotates
 * the public link token"
 */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateLinkToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToBase64Url(buf);
}
