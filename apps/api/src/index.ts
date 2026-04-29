/**
 * Vellum API entry point — single Bun.serve process.
 *
 * Route priority:
 *   1. /health   — always available (no auth)
 *   2. /api/auth/* — better-auth handler (rate-limited)
 *   3. /api/account/* — account management (protected)
 *   4. Catch-all stub
 *
 * Middleware order:
 *   RateLimiter singleton → Auth handler → Account handler → Fallback
 */

import { VELLUM_VERSION } from "@vellum/shared";
import { logger } from "./lib/logger";
import { RateLimiter } from "./lib/rate-limiter";
import { createAuthHandler } from "./auth/index";
import { handleAccountRequest } from "./account/routes";

const PORT = Number(Bun.env.PORT ?? 3000);

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter({ capacity: 10_000 });
const authHandler = createAuthHandler(rateLimiter);

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const start = performance.now();

    const respond = (response: Response) => {
      const duration = Math.round(performance.now() - start);
      logger.debug(
        {
          method: req.method,
          path: url.pathname,
          status: response.status,
          duration,
        },
        "request",
      );
      return response;
    };

    // Health check
    if (url.pathname === "/health") {
      return respond(
        Response.json({ status: "ok", version: VELLUM_VERSION }),
      );
    }

    // Auth routes
    if (url.pathname.startsWith("/api/auth")) {
      const authResponse = await authHandler(req);
      if (authResponse) return respond(authResponse);
    }

    // Account routes (protected)
    if (url.pathname.startsWith("/api/account")) {
      const accountResponse = await handleAccountRequest(req);
      if (accountResponse) return respond(accountResponse);
    }

    // Fallback stub
    return respond(
      new Response("Vellum API — see docs/PRD.md.", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
  },
});

logger.info(
  { port: server.port, version: VELLUM_VERSION },
  "vellum api listening",
);
