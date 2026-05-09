/**
 * Rate-limit rule constants for canvas and folder REST endpoints.
 *
 * Rules are defined at the endpoint level and consumed by the route handlers.
 * Each rule key follows `<resource>:<action>` naming.
 *
 * Limits intentionally differentiated by write/read profile:
 * - Write ops (create/delete): 10/60s — generous for human interaction
 * - Update ops: 30-60/60s — optimistic update paths benefit from headroom
 * - Read ops: 60-100/60s — GET /canvas/:id set high for collab editor polling
 *
 * Key format for actual limiter calls:
 *   `api:<rule-name>:<userId>`
 *
 * Design: "Rate limit 規則表" decision
 */

import type { RateLimitRule } from "./rate-limiter";

const s = (seconds: number) => seconds * 1_000;

/** POST /api/canvas — 10 creates per 60 seconds per user */
export const CANVAS_CREATE_RULE: RateLimitRule = { windowMs: s(60), max: 10 };

/** PATCH /api/canvas/:id — 60 updates per 60 seconds per user */
export const CANVAS_UPDATE_RULE: RateLimitRule = { windowMs: s(60), max: 60 };

/** DELETE /api/canvas/:id — 30 deletes per 60 seconds per user */
export const CANVAS_DELETE_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

/** GET /api/canvas — 60 list requests per 60 seconds per user */
export const CANVAS_LIST_RULE: RateLimitRule = { windowMs: s(60), max: 60 };

/**
 * GET /api/canvas/:id — 100 reads per 60 seconds per user.
 * Permissive: add-canvas-editor-shell may poll for freshness frequently.
 */
export const CANVAS_READ_RULE: RateLimitRule = { windowMs: s(60), max: 100 };

/** POST /api/folder — 10 creates per 60 seconds per user */
export const FOLDER_CREATE_RULE: RateLimitRule = { windowMs: s(60), max: 10 };

/** PATCH /api/folder/:id — 30 renames per 60 seconds per user */
export const FOLDER_UPDATE_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

/** DELETE /api/folder/:id — 10 deletes per 60 seconds per user */
export const FOLDER_DELETE_RULE: RateLimitRule = { windowMs: s(60), max: 10 };

/** GET /api/folder — 60 list requests per 60 seconds per user */
export const FOLDER_LIST_RULE: RateLimitRule = { windowMs: s(60), max: 60 };

/**
 * WS /sync/:canvasId — concurrent connection cap of 5 per (userId, canvasId).
 *
 * Tracked outside the token-bucket RateLimiter (it is a connection counter,
 * not a rate). Caps the same user's open tabs against one canvas; defends
 * against runaway scripts that re-open without disconnecting.
 *
 * Design: "WebSocket 連線層 rate limit"
 */
export const SYNC_CONNECT_PER_USER_CANVAS_MAX = 5;

/**
 * WS /sync/:canvasId — token-bucket cap of 30 new connections per minute per
 * source IP. Defends against rapid reconnect loops.
 */
export const SYNC_CONNECT_PER_IP_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

/**
 * POST /api/canvas/:id/share/invite — 10 invites per 60 seconds per owner.
 * Defends against scripted invite enumeration / mailbomb attempts.
 */
export const SHARE_INVITE_RULE: RateLimitRule = { windowMs: s(60), max: 10 };

/**
 * POST /api/canvas/:id/share/link/rotate — 5 rotations per 60 seconds per
 * owner. Rotation is normally manual; the cap exists to prevent runaway
 * scripts from invalidating links.
 */
export const SHARE_LINK_ROTATE_RULE: RateLimitRule = { windowMs: s(60), max: 5 };

/**
 * POST /api/og — 30 OG fetches per 60 seconds per authenticated user.
 * The two-tier cache (snapshot + LRU 30 min) absorbs most repeat hits;
 * this rate limit covers cache misses and intentional refreshes.
 *
 * Design: docs/adr/0010-link-card-cache-two-tier.md
 */
export const OG_FETCH_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

/**
 * POST /dev/canvas/:id/mutate — 30 mutations per 60 seconds per
 * authenticated user. Dev-only endpoint for the Server tldraw Mutator
 * spike (M12.1). Generous enough for human iteration; tight enough to
 * stop runaway test scripts. The endpoint is physically not registered
 * when `Bun.env.NODE_ENV === "production"` (see add-server-tldraw-mutator
 * design "Dev endpoint 的物理隔離 — production 完全不註冊").
 *
 * Rule key for limiter calls: `api:dev.mutate:<userId>`
 */
export const DEV_MUTATE_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

// ---------------------------------------------------------------------------
// BYOK (Phase 2, M11.1) — /api/account/byok/* per-session limits.
// Bucket key format: `byok:<list|save|delete>:<userId>`.
// Design: "Rate limits — 60 / 10 / 30 per minute per session".
// ---------------------------------------------------------------------------

/** GET /api/account/byok — 60 list requests per 60s per user. */
export const BYOK_LIST_RULE: RateLimitRule = { windowMs: s(60), max: 60 };

/**
 * POST /api/account/byok/:provider — 10 saves per 60s per user.
 * Tighter cap because each save triggers a real ping to the provider;
 * it would otherwise be a password oracle.
 */
export const BYOK_SAVE_RULE: RateLimitRule = { windowMs: s(60), max: 10 };

/** DELETE /api/account/byok/:provider — 30 deletes per 60s per user. */
export const BYOK_DELETE_RULE: RateLimitRule = { windowMs: s(60), max: 30 };

/**
 * PATCH /api/account/byok/preferences — 60 writes per 60s per user.
 * Same envelope as BYOK_LIST_RULE: no vendor ping on write, so the
 * oracle-prevention pressure that drives BYOK_SAVE_RULE down to 10/min
 * doesn't apply. 60/min is generous enough that picker fiddling never
 * trips the limit.
 */
export const BYOK_PREFERENCE_RULE: RateLimitRule = { windowMs: s(60), max: 60 };

// ---------------------------------------------------------------------------
// Agent runtime (Phase 2, M13.7) — POST /agent/canvas/:id/run.
// Bucket key format: `api:agent.run:user:<userId>`.
// Spec: openspec/specs/streaming-channel/spec.md "AGENT_RUN_RULE rate limit".
// ---------------------------------------------------------------------------

/**
 * POST /agent/canvas/:canvasId/run — 5 runs per 60s per user.
 * Single source of truth for the rule; the agent endpoint imports this.
 * The cancel endpoint (/agent/run/:runId/cancel) is intentionally NOT
 * rate-limited because cancel is a stop-loss action that must always be
 * permitted.
 */
export const AGENT_RUN_RULE: RateLimitRule = { windowMs: s(60), max: 5 };
