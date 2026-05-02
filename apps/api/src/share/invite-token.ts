/**
 * Invite-token utility — 32 bytes of crypto-random base64url, plus a 7-day
 * expiry helper.
 *
 * Tokens are not secrets per se (they only grant the right to claim a
 * specific invite, and acceptance is bound to the recipient email at
 * `apps/api/src/share/index.ts`'s accept handler). The 32-byte length
 * makes brute-force enumeration computationally pointless.
 *
 * Spec: sharing — "Owner invites an unknown email creates a pending invite
 * and sends mail" / "Invite acceptance route requires email match and
 * writes a share"
 */

const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function bytesToBase64Url(bytes: Uint8Array): string {
  // Bun.serve runs on V8 with btoa available; encode → base64 → swap to
  // URL-safe alphabet → strip padding.
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateInviteToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToBase64Url(buf);
}

export function computeInviteExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + INVITE_LIFETIME_MS);
}
