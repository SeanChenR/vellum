/**
 * Auth module entry point.
 *
 * Exports:
 * - `mountAuth(server, rateLimiter)` — registers /api/auth/* routes
 * - `getAuth()` — singleton accessor for the better-auth instance
 *
 * Rate-limiting is applied before delegating to better-auth:
 * - Magic-link send: per-email 3/10min + per-IP 10/hr
 * - Login attempts (magic-link verify, OAuth callback): per-IP 10/min
 *
 * Error responses always use the `{ error: { errorKey } }` envelope.
 */

import { applyAuthRateLimit } from "./rate-limit";
import { createAuth } from "./config";
import { createMailpitEmailService } from "../email/mailpit";
import { logger } from "../lib/logger";
import type { RateLimiter } from "../lib/rate-limiter";

let _auth: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!_auth) {
    const emailService = createMailpitEmailService({
      SMTP_HOST: Bun.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: Bun.env.SMTP_PORT ?? "1025",
      SMTP_FROM: Bun.env.SMTP_FROM ?? "noreply@vellum.local",
    });
    _auth = createAuth(emailService);
  }
  return _auth;
}

/**
 * Get the client IP from a request (x-forwarded-for first, then socket).
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

function errorJson(status: number, errorKey: string): Response {
  return Response.json({ error: { errorKey } }, { status });
}

/**
 * Mount /api/auth/* routes onto a Bun.serve handler.
 *
 * @returns A fetch handler that intercepts /api/auth/* requests.
 *          Returns null for other paths (caller continues routing).
 */
export function createAuthHandler(
  rateLimiter: RateLimiter,
): (req: Request) => Promise<Response | null> {
  const auth = getAuth();

  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url);
    const path = url.pathname;

    if (!path.startsWith("/api/auth")) {
      return null;
    }

    const ip = getClientIp(req);

    // Rate-limit: magic-link send (per-email + per-IP)
    if (
      path === "/api/auth/magic-link/send" ||
      path === "/api/auth/sign-in/magic-link"
    ) {
      let email: string | undefined;
      try {
        const body = await req.clone().json() as { email?: string };
        email = body.email;
      } catch {
        // body parse error — let better-auth handle validation
      }

      const rl = applyAuthRateLimit({ kind: "magic-link", ip, email }, rateLimiter);
      if (!rl.allowed) {
        const errorKey = email
          ? "auth.errors.emailRateLimited"
          : "auth.errors.ipRateLimited";
        return new Response(JSON.stringify({ error: { errorKey } }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": String(rl.retryAfterSeconds),
          },
        });
      }
    }

    // Rate-limit: login attempts (magic-link verify, OAuth callback)
    if (
      path.startsWith("/api/auth/magic-link/verify") ||
      path.startsWith("/api/auth/callback/")
    ) {
      const rl = applyAuthRateLimit({ kind: "login", ip }, rateLimiter);
      if (!rl.allowed) {
        return new Response(
          JSON.stringify({ error: { errorKey: "auth.errors.ipRateLimited" } }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "retry-after": String(rl.retryAfterSeconds),
            },
          },
        );
      }
    }

    try {
      return await auth.handler(req);
    } catch (err) {
      logger.error({ err, path }, "auth handler error");
      return errorJson(500, "auth.errors.internalError");
    }
  };
}
