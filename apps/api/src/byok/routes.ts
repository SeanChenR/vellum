/**
 * routes.ts — REST handler for /api/account/byok/*.
 *
 *   GET    /api/account/byok                — list configured providers
 *   POST   /api/account/byok/:provider      — validate-then-encrypt-then-upsert
 *   DELETE /api/account/byok/:provider      — remove key for provider
 *
 * Auth: every route requires a session. Per design, we do NOT lazy-load
 * a session inside the handler — the caller resolves it once and passes
 * `null` for unauthenticated requests, which we map to 401 +
 * `errors.byok.notAuthenticated`.
 *
 * Persistence: handlers go through a small `ByokRepo` interface so
 * tests can inject an in-memory implementation. Production wires
 * `repo` to the Drizzle-backed repo in `byok-repo.ts`.
 *
 * Validate-before-persist: POST runs the provider adapter's `validateKey`
 * BEFORE any DB write. A failed validation never produces a row.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 * Design ref: openspec/changes/add-byok-anthropic/design.md decisions
 *   - "Validate-before-persist with single transaction window"
 *   - "ProviderAdapter strategy interface; one file per provider"
 *   - "Rate limits — 60 / 10 / 30 per minute per session for GET / POST / DELETE"
 */

import {
  BYOK_DELETE_RULE,
  BYOK_LIST_RULE,
  BYOK_PREFERENCE_RULE,
  BYOK_SAVE_RULE,
} from "../lib/rate-limit-rules";
import type { RateLimiter, RateLimitRule } from "../lib/rate-limiter";
import type { ProviderAdapter } from "./providers/types";
import type { Vault } from "./vault";
import { byokSaveBodySchema, byokProviderParamSchema } from "./byok-validator";
import { byokPreferencesBodySchema } from "./preferences-validator";

// ---------------------------------------------------------------------------
// Repo contract — minimal surface the handlers need from the persistence
// layer. Production: Drizzle-backed `byok-repo.ts`. Tests: in-memory.
// ---------------------------------------------------------------------------

/**
 * Stored row shape — encryptedKey + bookkeeping. Note the user_id is
 * carried separately because list/upsert/delete all scope by it.
 */
export interface StoredApiKey {
  userId: string;
  provider: string;
  encryptedKey: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Handler-facing list-item — what we return over the wire. No bytes,
 * no plaintext. `userId` is implicit (resolved from session).
 */
export interface ListedApiKey {
  provider: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** One default-model preference row — one row per (user, provider) pair. */
export interface StoredPreferences {
  provider: string;
  model: string;
  updatedAt: Date;
}

export interface ByokRepo {
  list(userId: string): Promise<ListedApiKey[]>;
  upsert(userId: string, provider: string, encryptedKey: string): Promise<ListedApiKey>;
  delete(userId: string, provider: string): Promise<void>;
  /**
   * Returns every preference row (one per provider) for the user. Empty
   * array when the user has not set any preferences. Caller (route
   * handler) is responsible for shaping into a Record / map.
   */
  getPreferences(userId: string): Promise<StoredPreferences[]>;
  /**
   * Insert-or-update by composite PK `(user_id, provider)`. Refreshes
   * `updated_at` to NOW(). Other providers' rows are left untouched.
   */
  upsertPreferences(userId: string, provider: string, model: string): Promise<StoredPreferences>;
}

// ---------------------------------------------------------------------------
// Handler dependencies
// ---------------------------------------------------------------------------

export interface ByokDeps {
  repo: ByokRepo;
  vault: Vault;
  /** One adapter per supported provider. Looked up by ProviderId. */
  adapters: Record<string, ProviderAdapter>;
  rateLimiter: RateLimiter;
}

interface SessionLike {
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PATH_LIST = /^\/api\/account\/byok\/?$/;
const PATH_PREFERENCES = /^\/api\/account\/byok\/preferences\/?$/;
const PATH_PROVIDER = /^\/api\/account\/byok\/([^/]+)\/?$/;

function jsonResp(status: number, body: object, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function errorResp(status: number, error: string): Response {
  return jsonResp(status, { error });
}

function rateLimitResp(retryAfterSeconds: number): Response {
  return jsonResp(
    429,
    { error: "errors.rateLimit", retryAfter: retryAfterSeconds },
    { "retry-after": String(retryAfterSeconds) },
  );
}

function rlKey(action: string, userId: string): string {
  return `byok:${action}:${userId}`;
}

function checkRate(
  rateLimiter: RateLimiter,
  action: string,
  userId: string,
  rule: RateLimitRule,
): Response | null {
  const r = rateLimiter.limit(rlKey(action, userId), rule);
  return r.allowed ? null : rateLimitResp(r.retryAfterSeconds);
}

function notAuthenticated(): Response {
  return errorResp(401, "errors.byok.notAuthenticated");
}

function listToDto(items: ListedApiKey[]): {
  provider: string;
  createdAt: string;
  lastUsedAt: string | null;
}[] {
  return items.map((i) => ({
    provider: i.provider,
    createdAt: i.createdAt.toISOString(),
    lastUsedAt: i.lastUsedAt ? i.lastUsedAt.toISOString() : null,
  }));
}

function preferencesArrayToMap(
  prefs: StoredPreferences[],
): Record<string, { model: string; updatedAt: string }> {
  const out: Record<string, { model: string; updatedAt: string }> = {};
  for (const p of prefs) {
    out[p.provider] = { model: p.model, updatedAt: p.updatedAt.toISOString() };
  }
  return out;
}

function preferenceRowToDto(prefs: StoredPreferences): {
  provider: string;
  model: string;
  updatedAt: string;
} {
  return {
    provider: prefs.provider,
    model: prefs.model,
    updatedAt: prefs.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a `/api/account/byok/*` request.
 * Returns `undefined` when the path doesn't match — caller falls through
 * to the next handler in its chain.
 */
export async function handleByokRequest(
  req: Request,
  session: SessionLike | null,
  deps: ByokDeps,
): Promise<Response | undefined> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (PATH_LIST.test(path)) {
    if (req.method === "GET") return handleList(session, deps);
    return errorResp(405, "errors.validation");
  }

  // Preferences endpoint must match BEFORE the generic :provider regex
  // (otherwise `/byok/preferences` would be parsed as provider="preferences"
  // and rejected with `errors.byok.providerUnknown`).
  if (PATH_PREFERENCES.test(path)) {
    if (req.method === "PATCH") return handlePreferences(req, session, deps);
    return errorResp(405, "errors.validation");
  }

  const providerMatch = PATH_PROVIDER.exec(path);
  if (providerMatch) {
    const providerParam = providerMatch[1]!;
    if (req.method === "POST") return handleSave(req, session, deps, providerParam);
    if (req.method === "DELETE") return handleDelete(session, deps, providerParam);
    return errorResp(405, "errors.validation");
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Per-route handlers
// ---------------------------------------------------------------------------

async function handleList(session: SessionLike | null, deps: ByokDeps): Promise<Response> {
  if (!session) return notAuthenticated();
  const rl = checkRate(deps.rateLimiter, "list", session.userId, BYOK_LIST_RULE);
  if (rl) return rl;

  const [items, prefs] = await Promise.all([
    deps.repo.list(session.userId),
    deps.repo.getPreferences(session.userId),
  ]);
  return jsonResp(200, {
    data: { keys: listToDto(items), preferences: preferencesArrayToMap(prefs) },
  });
}

async function handlePreferences(
  req: Request,
  session: SessionLike | null,
  deps: ByokDeps,
): Promise<Response> {
  if (!session) return notAuthenticated();
  const rl = checkRate(deps.rateLimiter, "pref", session.userId, BYOK_PREFERENCE_RULE);
  if (rl) return rl;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResp(400, "errors.byok.invalidPreference");
  }
  const parsed = byokPreferencesBodySchema.safeParse(raw);
  if (!parsed.success) {
    return errorResp(400, "errors.byok.invalidPreference");
  }

  const stored = await deps.repo.upsertPreferences(
    session.userId,
    parsed.data.provider,
    parsed.data.model,
  );
  return jsonResp(200, { data: preferenceRowToDto(stored) });
}

async function handleSave(
  req: Request,
  session: SessionLike | null,
  deps: ByokDeps,
  providerParam: string,
): Promise<Response> {
  if (!session) return notAuthenticated();
  const rl = checkRate(deps.rateLimiter, "save", session.userId, BYOK_SAVE_RULE);
  if (rl) return rl;

  // Validate provider id BEFORE doing anything else — guarantees we
  // never accidentally call into an adapter that doesn't exist.
  const providerCheck = byokProviderParamSchema.safeParse(providerParam);
  if (!providerCheck.success) {
    return errorResp(400, "errors.byok.providerUnknown");
  }
  const provider = providerCheck.data;

  // Parse body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResp(400, "errors.validation");
  }
  const bodyCheck = byokSaveBodySchema.safeParse(raw);
  if (!bodyCheck.success) {
    return errorResp(400, "errors.validation");
  }

  // Validate-before-persist: ping vendor first.
  const adapter = deps.adapters[provider];
  if (!adapter) {
    // Defensive: if adapters table is incomplete, treat as unknown
    // provider rather than crashing the handler.
    return errorResp(400, "errors.byok.providerUnknown");
  }
  const validation = await adapter.validateKey(bodyCheck.data.apiKey);
  if (!validation.ok) {
    return errorResp(400, validation.errorKey);
  }

  // Encrypt + upsert.
  const encrypted = deps.vault.encryptApiKey(bodyCheck.data.apiKey);
  const stored = await deps.repo.upsert(session.userId, provider, encrypted);
  return jsonResp(200, {
    data: {
      provider: stored.provider,
      createdAt: stored.createdAt.toISOString(),
      lastUsedAt: stored.lastUsedAt ? stored.lastUsedAt.toISOString() : null,
    },
  });
}

async function handleDelete(
  session: SessionLike | null,
  deps: ByokDeps,
  providerParam: string,
): Promise<Response> {
  if (!session) return notAuthenticated();
  const rl = checkRate(deps.rateLimiter, "delete", session.userId, BYOK_DELETE_RULE);
  if (rl) return rl;

  const providerCheck = byokProviderParamSchema.safeParse(providerParam);
  if (!providerCheck.success) {
    return errorResp(400, "errors.byok.providerUnknown");
  }

  await deps.repo.delete(session.userId, providerCheck.data);
  return new Response(null, { status: 204 });
}
