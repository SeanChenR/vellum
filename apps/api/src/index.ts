/**
 * Vellum API entry point — single Bun.serve process.
 *
 * Route priority:
 *   1. /health        — always available (no auth)
 *   2. /api/auth/*    — better-auth handler (rate-limited)
 *   3. /api/account/* — account management (protected)
 *   4. /api/canvas/*  — canvas CRUD (protected)
 *   5. /api/folder/*  — folder CRUD (protected)
 *   6. Catch-all stub
 *
 * Middleware order:
 *   RateLimiter singleton → Auth handler → Account handler →
 *   Canvas handler → Folder handler → Fallback
 *
 * Session resolution:
 *   Canvas and folder handlers receive the resolved session (or null) so
 *   they can be tested without an HTTP server.
 */

import { VELLUM_VERSION } from "@vellum/shared";
import { logger } from "./lib/logger";
import { RateLimiter } from "./lib/rate-limiter";
import { createAuthHandler, getAuth } from "./auth/index";
import { handleAccountRequest } from "./account/routes";
import { handleCanvasRequest } from "./canvas/index";
import { handleFolderRequest } from "./folder/index";

const PORT = Number(Bun.env.PORT ?? 3000);

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

const rateLimiter = new RateLimiter({ capacity: 10_000 });
const authHandler = createAuthHandler(rateLimiter);

/**
 * Resolve the authenticated session for a request.
 * Returns null for unauthenticated requests (canvas/folder handlers check this).
 */
async function getSession(req: Request): Promise<{ userId: string } | null> {
  const auth = getAuth();
  try {
    const result = await auth.api.getSession({ headers: req.headers });
    if (!result?.session) return null;
    const sess = result.session as { userId: string; revokedAt?: Date | null };
    if (sess.revokedAt) return null;
    return { userId: sess.userId };
  } catch {
    return null;
  }
}

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

    // Canvas routes (protected — resolve session once, pass to handler)
    if (url.pathname.startsWith("/api/canvas")) {
      const session = await getSession(req);
      const canvasResponse = await handleCanvasRequest(req, session, rateLimiter);
      if (canvasResponse) return respond(canvasResponse);
    }

    // Folder routes (protected — resolve session once, pass to handler)
    if (url.pathname.startsWith("/api/folder")) {
      const session = await getSession(req);
      const folderResponse = await handleFolderRequest(req, session, rateLimiter);
      if (folderResponse) return respond(folderResponse);
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
