/**
 * routes.ts — REST handlers for /api/account/pat/*.
 *
 *   GET    /api/account/pat        — list active tokens
 *   POST   /api/account/pat        — create token (returns plaintext once)
 *   DELETE /api/account/pat/:id    — soft-revoke
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 */

import { z } from "zod";
import {
  PAT_PLAINTEXT_PREFIX,
  extractTokenPrefix,
  generateTokenPlaintext,
  hashTokenPlaintext,
} from "./token-format";
import type { PatRepo, PatRow } from "./repo";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PatRoutesDeps {
  repo: PatRepo;
}

interface SessionLike {
  userId: string;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const createBodySchema = z.object({
  name: z.string().min(1).max(64),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.null()]).optional(),
});

// ---------------------------------------------------------------------------
// Path matchers
// ---------------------------------------------------------------------------

const PATH_LIST_OR_CREATE = /^\/api\/account\/pat\/?$/;
const PATH_REVOKE = /^\/api\/account\/pat\/([^/]+)\/?$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResp(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResp(status: number, error: string): Response {
  return jsonResp(status, { error });
}

function notAuthenticated(): Response {
  return errorResp(401, "errors.notAuthenticated");
}

function notFound(): Response {
  return errorResp(404, "errors.notFound");
}

function rowToListDto(row: PatRow): {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    name: row.name,
    prefix: row.tokenPrefix,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function computeExpiresAt(expiresInDays: 30 | 90 | null | undefined): Date | null {
  if (!expiresInDays) return null;
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

export async function handlePatRequest(
  req: Request,
  session: SessionLike | null,
  deps: PatRoutesDeps,
): Promise<Response | undefined> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (PATH_LIST_OR_CREATE.test(pathname)) {
    if (!session) return notAuthenticated();
    if (req.method === "GET") return handleList(session, deps);
    if (req.method === "POST") return handleCreate(req, session, deps);
    return errorResp(405, "errors.methodNotAllowed");
  }

  const revokeMatch = pathname.match(PATH_REVOKE);
  if (revokeMatch) {
    if (!session) return notAuthenticated();
    if (req.method === "DELETE") return handleRevoke(revokeMatch[1]!, session, deps);
    return errorResp(405, "errors.methodNotAllowed");
  }

  // Path not matched — caller falls through.
  return undefined;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleList(session: SessionLike, deps: PatRoutesDeps): Promise<Response> {
  const rows = await deps.repo.listTokens(session.userId);
  return jsonResp(200, { data: rows.map(rowToListDto) });
}

async function handleCreate(
  req: Request,
  session: SessionLike,
  deps: PatRoutesDeps,
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResp(400, "errors.validation");
  }
  const parsed = createBodySchema.safeParse(raw);
  if (!parsed.success) return errorResp(400, "errors.validation");
  const { name, expiresInDays } = parsed.data;

  const plaintext = generateTokenPlaintext();
  if (!plaintext.startsWith(PAT_PLAINTEXT_PREFIX)) {
    // Defensive: token generator contract guarantees prefix.
    throw new Error("generated plaintext lacks canonical prefix");
  }
  const tokenHash = hashTokenPlaintext(plaintext);
  const tokenPrefix = extractTokenPrefix(plaintext);

  const row = await deps.repo.createToken({
    userId: session.userId,
    name,
    tokenHash,
    tokenPrefix,
    expiresAt: computeExpiresAt(expiresInDays),
  });

  // CRITICAL: plaintext appears EXACTLY ONCE here — in the create
  // response body. No other endpoint surfaces it; the DB stores only
  // the SHA-256 hash.
  return jsonResp(201, {
    data: {
      token: plaintext,
      id: row.id,
      name: row.name,
      prefix: row.tokenPrefix,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

async function handleRevoke(
  tokenId: string,
  session: SessionLike,
  deps: PatRoutesDeps,
): Promise<Response> {
  const revoked = await deps.repo.revokeToken(session.userId, tokenId);
  if (!revoked) return notFound();
  return new Response(null, { status: 204 });
}
