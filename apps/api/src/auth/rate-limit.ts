/**
 * Auth rate-limit helper.
 *
 * Applies the three rate-limit rules defined in design.md Decision 4:
 *   - magic-link:email  — 3 sends / 10 minutes per email
 *   - magic-link:ip     — 10 sends / hour per IP
 *   - login:ip          — 10 attempts / minute per IP
 *
 * Consumes the RateLimiter singleton. The returned result is either
 * `{ allowed: true }` or `{ allowed: false, retryAfterSeconds }` where
 * retryAfterSeconds takes the maximum across all applicable rules.
 */

import type { RateLimitResult, RateLimiter, RateLimitRule } from "../lib/rate-limiter";

export type AuthRateLimitKind = "magic-link" | "login";

export interface ApplyAuthRateLimitOptions {
  kind: AuthRateLimitKind;
  ip: string;
  email?: string;
}

const MAGIC_LINK_EMAIL_RULE: RateLimitRule = {
  windowMs: 10 * 60_000, // 10 minutes
  max: 3,
};

const MAGIC_LINK_IP_RULE: RateLimitRule = {
  windowMs: 60 * 60_000, // 1 hour
  max: 10,
};

const LOGIN_IP_RULE: RateLimitRule = {
  windowMs: 60_000, // 1 minute
  max: 10,
};

/**
 * Apply rate-limit rules for the given auth operation.
 *
 * For magic-link: checks both per-email and per-IP rules; the result is
 * blocked if either rule denies, with retryAfterSeconds = max(both).
 *
 * For login: checks the per-IP rule only.
 */
export function applyAuthRateLimit(
  opts: ApplyAuthRateLimitOptions,
  limiter: RateLimiter,
): RateLimitResult {
  // Dev / E2E bypass: avoid per-IP throttling when running locally so the
  // Playwright suite (and `bun run dev:up` smoke loops) does not exhaust
  // the 10/hr-per-IP magic-link budget on a single machine. NEVER set in
  // production — the limits are real abuse defenses there.
  if (Bun.env.DISABLE_AUTH_RATE_LIMIT === "1") {
    return { allowed: true };
  }

  if (opts.kind === "magic-link") {
    const ipKey = `auth:magic-link:ip:${opts.ip}`;
    const ipResult = limiter.limit(ipKey, MAGIC_LINK_IP_RULE);

    if (opts.email) {
      const emailKey = `auth:magic-link:email:${opts.email.toLowerCase()}`;
      const emailResult = limiter.limit(emailKey, MAGIC_LINK_EMAIL_RULE);

      if (!emailResult.allowed || !ipResult.allowed) {
        // Both were consumed — pick the larger retryAfterSeconds
        const emailSeconds = emailResult.allowed ? 0 : emailResult.retryAfterSeconds;
        const ipSeconds = ipResult.allowed ? 0 : ipResult.retryAfterSeconds;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(emailSeconds, ipSeconds, 1),
        };
      }
    } else if (!ipResult.allowed) {
      return ipResult;
    }

    return { allowed: true };
  }

  // login kind: per-IP only
  const loginKey = `auth:login:ip:${opts.ip}`;
  return limiter.limit(loginKey, LOGIN_IP_RULE);
}
