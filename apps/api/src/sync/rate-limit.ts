/**
 * Sync connect rate-limit gate.
 *
 * Two independent rules enforced before WebSocket upgrade:
 *   1. Concurrent connection cap per (userId, canvasId)
 *      — counter-based; tracked here in a `ConcurrentConnectionRegistry`
 *   2. New-connection rate per source IP
 *      — token-bucket; tracked via the shared `RateLimiter`
 *
 * Design: "WebSocket 連線層 rate limit"
 */

import type { RateLimiter } from "../lib/rate-limiter";
import {
  SYNC_CONNECT_PER_IP_RULE,
  SYNC_CONNECT_PER_USER_CANVAS_MAX,
} from "../lib/rate-limit-rules";

export interface ConcurrentConnectionRegistry {
  /** Current open-connection count for (userId, canvasId). */
  count(userId: string, canvasId: string): number;
  /** Increment the counter (call from ws.open). */
  add(userId: string, canvasId: string): void;
  /** Decrement the counter (call from ws.close). Clamps at 0. */
  remove(userId: string, canvasId: string): void;
}

export type SyncRateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const PER_USER_CANVAS_RETRY_AFTER_SECONDS = 5;

function userCanvasKey(userId: string, canvasId: string): string {
  return `${userId}::${canvasId}`;
}

function ipKey(ip: string): string {
  return `ws:connect:ip:${ip}`;
}

export function createConcurrentConnectionRegistry(): ConcurrentConnectionRegistry {
  const counts = new Map<string, number>();
  return {
    count(userId, canvasId) {
      return counts.get(userCanvasKey(userId, canvasId)) ?? 0;
    },
    add(userId, canvasId) {
      const k = userCanvasKey(userId, canvasId);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    },
    remove(userId, canvasId) {
      const k = userCanvasKey(userId, canvasId);
      const next = (counts.get(k) ?? 0) - 1;
      if (next <= 0) counts.delete(k);
      else counts.set(k, next);
    },
  };
}

/**
 * Check both rules in sequence. Either denial short-circuits with the
 * matching `retryAfterSeconds` so callers can emit `Retry-After`.
 *
 * NOTE: this function consumes a token from the per-IP bucket on every call,
 * including denied ones — that matches existing RateLimiter semantics and
 * defends against attackers spamming through to find an allowed combination.
 */
export function checkSyncConnectLimits(
  rateLimiter: RateLimiter,
  registry: ConcurrentConnectionRegistry,
  ctx: { userId: string; canvasId: string; ip: string },
): SyncRateLimitResult {
  if (registry.count(ctx.userId, ctx.canvasId) >= SYNC_CONNECT_PER_USER_CANVAS_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: PER_USER_CANVAS_RETRY_AFTER_SECONDS,
    };
  }

  const ip = rateLimiter.limit(ipKey(ctx.ip), SYNC_CONNECT_PER_IP_RULE);
  if (!ip.allowed) {
    return { allowed: false, retryAfterSeconds: ip.retryAfterSeconds };
  }

  return { allowed: true };
}
