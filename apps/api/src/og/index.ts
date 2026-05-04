/**
 * og handler — POST /api/og endpoint.
 *
 * Responsibilities:
 *  1. Require authenticated session (401 otherwise — anonymous public-link
 *     visitors are not allowed; link card is editor-tier).
 *  2. Validate URL via `validateExternalUrl` (SSRF guard).
 *  3. Rate-limit at 30 req/min/user.
 *  4. LRU cache lookup (Tier 2 cache from design.md).
 *  5. Fetch + parse HTML for Open Graph metadata.
 *  6. Return envelope `{ data: OgMetadata + fetchedAt }` or
 *     `{ error: <i18n key> }`.
 *
 * Spec: canvas-shapes — "OG metadata endpoint returns sanitized parsed
 * result with two-tier cache".
 */

import { parseHtmlForOg, type OgMetadata } from "./parse-html";
import type { ValidationResult } from "../lib/validate-external-url";
import type { RateLimiter, RateLimitRule } from "../lib/rate-limiter";
import { OG_FETCH_RULE } from "../lib/rate-limit-rules";

export interface OgFetchResponse {
  ok: boolean;
  status: number;
  contentType: string;
  text: () => Promise<string>;
}

export interface OgHandlerDeps {
  validateExternalUrl(raw: string): Promise<ValidationResult>;
  fetch(url: string): Promise<OgFetchResponse>;
  now(): number;
}

export interface OgCacheEntry {
  metadata: OgMetadata;
  fetchedAt: string;
}

export interface OgCache {
  get(key: string): OgCacheEntry | null;
  set(key: string, value: OgCacheEntry, ttlMs: number): void;
}

export const OG_CACHE_TTL_MS = 30 * 60 * 1000;

export interface SessionLike {
  userId: string;
}

function err(status: number, errorKey: string, headers?: Record<string, string>): Response {
  return Response.json({ error: errorKey }, { status, headers });
}

function normalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    // Strip hash fragment; preserve query (different query → different OG).
    u.hash = "";
    return u.toString();
  } catch {
    return input;
  }
}

export async function handleOgRequest(
  req: Request,
  session: SessionLike | null,
  rateLimiter: RateLimiter,
  deps: OgHandlerDeps,
  cache: OgCache,
): Promise<Response> {
  if (!session) return err(401, "errors.auth.unauthorized");

  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return err(400, "errors.validation");
  }
  if (typeof body.url !== "string" || body.url.length === 0) {
    return err(400, "errors.validation");
  }
  const url = body.url;

  // Cache hit short-circuits BEFORE the rate limit (cache is the cheapest path).
  const cacheKey = normalizeUrl(url);
  const cached = cache.get(cacheKey);
  if (cached) {
    return Response.json({ data: { ...cached.metadata, fetchedAt: cached.fetchedAt } });
  }

  // Rate-limit only outbound-bound requests.
  const rl = rateLimiter.limit(`og:${session.userId}`, OG_FETCH_RULE);
  if (!rl.allowed) {
    return err(429, "errors.rateLimit", {
      "retry-after": String(rl.retryAfterSeconds),
    });
  }

  const validation = await deps.validateExternalUrl(url);
  if (!validation.ok) {
    return err(403, "errors.og.invalidUrl");
  }

  let resp: OgFetchResponse;
  try {
    resp = await deps.fetch(validation.url.toString());
  } catch {
    return err(502, "errors.og.fetchFailed");
  }
  if (!resp.ok) {
    return err(502, "errors.og.fetchFailed");
  }
  if (!/^text\/html\b/i.test(resp.contentType)) {
    return err(415, "errors.og.fetchFailed");
  }

  let html: string;
  try {
    html = await resp.text();
  } catch {
    return err(502, "errors.og.fetchFailed");
  }

  const metadata = parseHtmlForOg(html);
  const fetchedAt = new Date(deps.now()).toISOString();
  cache.set(cacheKey, { metadata, fetchedAt }, OG_CACHE_TTL_MS);
  return Response.json({ data: { ...metadata, fetchedAt } });
}

// ---------------------------------------------------------------------------
// In-memory LRU cache implementation
// ---------------------------------------------------------------------------

interface Stored extends OgCacheEntry {
  expiresAt: number;
}

export interface InMemoryOgCacheOptions {
  capacity?: number;
  now?: () => number;
}

export function createInMemoryOgCache(options: InMemoryOgCacheOptions = {}): OgCache {
  const capacity = options.capacity ?? 1_000;
  const now = options.now ?? Date.now;
  const map = new Map<string, Stored>();

  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        map.delete(key);
        return null;
      }
      // LRU touch.
      map.delete(key);
      map.set(key, entry);
      return { metadata: entry.metadata, fetchedAt: entry.fetchedAt };
    },
    set(key, value, ttlMs) {
      if (map.has(key)) map.delete(key);
      if (map.size >= capacity) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
      map.set(key, { ...value, expiresAt: now() + ttlMs });
    },
  };
}

// Re-export the rule constant for callers that wire the handler.
export { OG_FETCH_RULE };
