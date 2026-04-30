/**
 * In-process rate limiter — token bucket with LRU eviction.
 *
 * Designed for single-instance Bun.serve. Multi-instance scaling would
 * need a Redis-backed variant; we explicitly scope this to phase 1
 * (single instance) per the architecture.
 *
 * Keys are application-defined (e.g. `auth:magic-link:${email}`,
 * `api:canvas-create:${userId}`, `ws:connect:${ip}`).
 */

export interface RateLimitRule {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Maximum requests per window. */
  max: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiterOptions {
  /** Maximum number of distinct keys tracked (LRU evicts oldest). */
  capacity?: number;
  /** Time source — injectable for tests. Defaults to `Date.now`. */
  now?: () => number;
}

const DEFAULT_CAPACITY = 10_000;

export class RateLimiter {
  readonly #capacity: number;
  readonly #now: () => number;
  readonly #buckets: Map<string, Bucket>;

  constructor(options: RateLimiterOptions = {}) {
    this.#capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.#now = options.now ?? Date.now;
    this.#buckets = new Map();
  }

  /**
   * Try to consume one token for `key` against `rule`.
   * Returns `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }`.
   */
  limit(key: string, rule: RateLimitRule): RateLimitResult {
    const t = this.#now();
    const refillRatePerMs = rule.max / rule.windowMs;

    const existing = this.#buckets.get(key);
    let tokens: number;

    if (existing === undefined) {
      tokens = rule.max;
    } else {
      // Reinsert at end to mark as most recently used (LRU touch).
      this.#buckets.delete(key);
      const elapsed = t - existing.lastRefill;
      tokens = Math.min(rule.max, existing.tokens + elapsed * refillRatePerMs);
    }

    if (tokens >= 1) {
      tokens -= 1;
      this.#evictIfFull();
      this.#buckets.set(key, { tokens, lastRefill: t });
      return { allowed: true };
    }

    // Not enough — keep bucket but don't decrement; report retry-after.
    this.#evictIfFull();
    this.#buckets.set(key, { tokens, lastRefill: t });
    const tokensNeeded = 1 - tokens;
    const msUntilOneToken = tokensNeeded / refillRatePerMs;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(msUntilOneToken / 1000)),
    };
  }

  /** Reset all buckets — primarily for tests. */
  clear(): void {
    this.#buckets.clear();
  }

  /** Number of tracked keys — primarily for tests. */
  size(): number {
    return this.#buckets.size;
  }

  #evictIfFull(): void {
    if (this.#buckets.size < this.#capacity) return;
    // Map iteration order is insertion order; evict oldest.
    const oldest = this.#buckets.keys().next().value;
    if (oldest !== undefined) this.#buckets.delete(oldest);
  }
}
