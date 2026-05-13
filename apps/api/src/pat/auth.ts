/**
 * auth.ts — PAT authentication helper for the MCP server endpoint.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   "PAT authenticator resolves token plaintext to user id without
 *    exposing hashes"
 *
 * `authenticatePat(req, {repo, logger})` is the single entry point
 * called by /api/mcp before JSON-RPC dispatch. It reads the
 * Authorization header, hashes the plaintext, looks up an active
 * non-expired token, and returns `{userId, tokenId}` or `null`.
 *
 * `touchLastUsed(tokenId, repo, clock, throttle)` updates the token's
 * `last_used_at`, throttled to one write per 60 seconds per token via
 * an in-memory Map (passed in so the MCP server can keep a
 * process-wide instance).
 */

import { hashTokenPlaintext } from "./token-format";
import type { PatRepo } from "./repo";

const BEARER_PREFIX = "Bearer ";
const LAST_USED_THROTTLE_MS = 60_000;

export interface AuthLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

export interface AuthenticatePatDeps {
  repo: PatRepo;
  logger: AuthLogger;
}

export interface AuthenticatedPat {
  userId: string;
  tokenId: string;
}

/**
 * Resolve a request's `Authorization: Bearer <token>` header to a
 * user + token id. Returns null for every failure mode (missing
 * header, wrong prefix, unknown / expired / revoked token).
 *
 * Never logs the plaintext token. Log lines reference only the token
 * id (after a successful lookup) and the last 4 chars of the prefix
 * for diagnostic correlation.
 */
export async function authenticatePat(
  req: Request,
  deps: AuthenticatePatDeps,
): Promise<AuthenticatedPat | null> {
  const header = req.headers.get("authorization");
  if (!header) return null;
  if (!header.startsWith(BEARER_PREFIX)) return null;

  const plaintext = header.slice(BEARER_PREFIX.length).trim();
  if (plaintext.length === 0) return null;

  const hash = hashTokenPlaintext(plaintext);
  const row = await deps.repo.findActiveTokenByHash(hash);
  if (!row) {
    // Log just enough to correlate failed auth attempts without
    // surfacing any portion of the plaintext that could narrow brute
    // force. We include the last 4 chars of the supplied prefix only,
    // and only when the supplied value is long enough to be plausibly
    // a vellum PAT — junk headers don't get echoed back at all.
    if (plaintext.length >= 12) {
      deps.logger.warn(
        { component: "pat-auth", event: "pat_auth_miss", prefixLast4: plaintext.slice(8, 12) },
        "PAT authentication miss",
      );
    }
    return null;
  }

  return { userId: row.userId, tokenId: row.id };
}

// ---------------------------------------------------------------------------
// touchLastUsed throttle
// ---------------------------------------------------------------------------

/**
 * Per-token last-write tracker — keys are token ids, values are the
 * ms-epoch timestamp of the most recent UPDATE. Designed to be a
 * process-wide singleton constructed once in production wiring.
 */
export type LastUsedThrottle = Map<string, number>;

export interface ThrottleClock {
  now(): number;
}

/**
 * Throttled UPDATE of `personal_access_tokens.last_used_at`. Writes
 * at most once per `LAST_USED_THROTTLE_MS` (60 s) per token to avoid a
 * hot write path under heavy MCP traffic.
 */
export async function touchLastUsed(
  tokenId: string,
  repo: PatRepo,
  clock: ThrottleClock,
  throttle: LastUsedThrottle,
): Promise<void> {
  const now = clock.now();
  const last = throttle.get(tokenId);
  if (last !== undefined && now - last < LAST_USED_THROTTLE_MS) {
    return;
  }
  throttle.set(tokenId, now);
  await repo.touchLastUsed(tokenId, new Date(now));
}
