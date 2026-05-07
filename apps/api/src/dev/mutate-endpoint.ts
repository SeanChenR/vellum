/**
 * mutate-endpoint.ts — dev-only HTTP entry point for Server tldraw Mutator.
 *
 * Endpoint:
 *   POST /dev/canvas/:id/mutate
 *
 * Body shape: `{ mutations: Mutation[] }` (validated by the mutator's
 * Zod schema; endpoint just maps mutator results to HTTP status codes).
 *
 * Production gating: this endpoint is physically not registered when
 * `Bun.env.NODE_ENV === "production"`. Use `shouldRegisterDevMutate(env)`
 * before mounting the route.
 *
 * Rate limiting: per-user token-bucket via `DEV_MUTATE_RULE`
 * (apps/api/src/lib/rate-limit-rules.ts). 30 requests / 60s.
 *
 * Spec ref: openspec/changes/add-server-tldraw-mutator/specs/server-mutation-bridge/spec.md
 */

import { z } from "zod";
import { mutationSchema, type Mutation } from "@vellum/shared/mutation-types";
import { requireRole, type PermissionGuardDeps } from "../lib/permission-guard";
import { DEV_MUTATE_RULE } from "../lib/rate-limit-rules";
import type { RateLimiter, RateLimitRule } from "../lib/rate-limiter";
import type { MutationResult } from "../sync/mutator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevMutateDeps {
  rateLimiter: RateLimiter;
  applyMutation: (canvasId: string, mutations: Mutation[]) => Promise<MutationResult>;
  /**
   * Permission Guard deps — wired in apps/api/src/index.ts to the same
   * resolver the sync handshake uses. Tests inject a stub.
   */
  permissionGuard: PermissionGuardDeps;
}

interface SessionLike {
  userId: string;
}

const bodySchema = z.object({
  mutations: z.array(mutationSchema).min(1),
});

// ---------------------------------------------------------------------------
// Production gate (used by index.ts route registration)
// ---------------------------------------------------------------------------

/**
 * True when the dev mutate endpoint should be registered in the route
 * table. The single source of truth so callers never re-implement the
 * predicate. Any non-`"production"` value (including `undefined`) means
 * dev/test/staging — register the endpoint.
 */
export function shouldRegisterDevMutate(env: { NODE_ENV?: string | undefined }): boolean {
  return env.NODE_ENV !== "production";
}

// ---------------------------------------------------------------------------
// Startup-time rule presence check
// ---------------------------------------------------------------------------

/**
 * Wired at server startup. If the dev endpoint is enabled but the
 * rate-limit rule constant is missing or invalid, the server fails to
 * start — there's no scenario in which the endpoint should run without
 * an associated rule per project rate-limit discipline.
 */
export function assertDevMutateRuleRegistered(rule: RateLimitRule | undefined): void {
  if (!rule) {
    throw new Error(
      "dev.mutate rate-limit rule must be registered before the dev mutate endpoint is wired",
    );
  }
  if (rule.max <= 0 || rule.windowMs <= 0) {
    throw new Error(
      `dev.mutate rate-limit rule has invalid bounds: max=${rule.max}, windowMs=${rule.windowMs}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

const RATE_LIMIT_KEY_PREFIX = "api:dev.mutate";

function rlKey(userId: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}:user:${userId}`;
}

/**
 * Anonymous (null-session) requests are bucketed by client IP so the guard
 * stage stays after rate-limit admission per the spec ordering matrix.
 * Falls back to a fixed bucket when no IP header is present (covers test /
 * unproxied dev where x-forwarded-for is absent).
 */
function rlKeyAnon(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? (forwarded.split(",")[0]?.trim() ?? "unknown") : "unknown";
  return `${RATE_LIMIT_KEY_PREFIX}:ip:${ip}`;
}

function jsonResp(status: number, body: object, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

/**
 * Map a `MutationResult` errorKey to the HTTP status code documented in
 * the spec scenarios:
 *   invalidPayload         → 400
 *   canvasNotInActiveRoom  → 409
 *   mutationFailed         → 500
 */
function statusForErrorKey(errorKey: string): number {
  switch (errorKey) {
    case "errors.devMutate.invalidPayload":
      return 400;
    case "errors.devMutate.canvasNotInActiveRoom":
      return 409;
    case "errors.devMutate.mutationFailed":
    default:
      return 500;
  }
}

export async function handleDevMutateRequest(
  req: Request,
  session: SessionLike | null,
  deps: DevMutateDeps,
  canvasId: string,
): Promise<Response> {
  // Rate limit — fires before guard so even null-session requests are
  // bucketed (per add-permission-guard spec ordering matrix).
  const limiterKey = session ? rlKey(session.userId) : rlKeyAnon(req);
  const rl = deps.rateLimiter.limit(limiterKey, DEV_MUTATE_RULE);
  if (!rl.allowed) {
    return jsonResp(
      429,
      { ok: false, errorKey: "errors.rateLimit", retryAfter: rl.retryAfterSeconds },
      { "retry-after": String(rl.retryAfterSeconds) },
    );
  }

  // Permission Guard — runs after rate-limit, before payload validation.
  const guardResult = await requireRole(deps.permissionGuard, session, canvasId, [
    "owner",
    "editor",
  ]);
  if (!guardResult.ok) {
    return jsonResp(guardResult.status, { ok: false, errorKey: guardResult.errorKey });
  }

  // Parse JSON body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResp(400, { ok: false, errorKey: "errors.devMutate.invalidPayload" });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResp(400, { ok: false, errorKey: "errors.devMutate.invalidPayload" });
  }

  // Delegate to mutator.
  const result = await deps.applyMutation(canvasId, parsed.data.mutations);
  if (result.ok) {
    return jsonResp(200, { ok: true, appliedCount: result.appliedCount });
  }
  return jsonResp(statusForErrorKey(result.errorKey), {
    ok: false,
    errorKey: result.errorKey,
  });
}
