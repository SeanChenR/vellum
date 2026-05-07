/**
 * API contract — zod schemas and response envelope types.
 *
 * This module is the single source of truth for:
 * - Input validation schemas (used server-side with zod.parse)
 * - TypeScript request/response types (used client-side for fetch calls)
 * - ErrorKey enumeration (never pre-translated; client looks up i18n key)
 *
 * Design: "API contract 層" & "Error envelope 與 errorKey 命名" decisions.
 */

import { z } from "zod";

import type { ProviderId } from "./byok-pricing";
export type { ProviderId } from "./byok-pricing";

// ---------------------------------------------------------------------------
// ErrorKey — exhaustive list of error keys returned by the API
// ---------------------------------------------------------------------------

/**
 * All error keys that the API may return in `{ error: errorKey }` responses.
 * Server never returns translated strings — always a key; client calls t(key).
 */
export type ErrorKey =
  | "errors.auth.unauthorized"
  | "errors.canvas.notFound"
  | "errors.canvas.forbidden"
  | "errors.canvas.activeRoom"
  | "errors.folder.notFound"
  | "errors.folder.forbidden"
  | "errors.folder.notEmpty"
  | "errors.byok.invalidKey"
  | "errors.byok.outOfCredits"
  | "errors.byok.rateLimited"
  | "errors.byok.unreachable"
  | "errors.byok.providerUnknown"
  | "errors.byok.notAuthenticated"
  | "errors.byok.invalidPreference"
  | "errors.validation"
  | "errors.rateLimit"
  | "errors.internal";

// ---------------------------------------------------------------------------
// Response envelope types
// ---------------------------------------------------------------------------

export type ApiSuccess<T> = {
  data: T;
  meta?: { total: number };
};

export type ApiFailure = {
  error: ErrorKey;
  retryAfter?: number;
  /** Zod issues from schema validation — only present for errors.validation */
  details?: unknown;
};

// ---------------------------------------------------------------------------
// Canvas input schemas
// ---------------------------------------------------------------------------

/**
 * POST /api/canvas — create a new canvas.
 * title: 1-120 chars, folderId: optional uuid or explicit null (unfiled).
 */
export const canvasCreateInputSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().uuid().nullable().optional(),
});

export type CanvasCreateInput = z.infer<typeof canvasCreateInputSchema>;

/**
 * PATCH /api/canvas/:id — partial update of title, folderId, and/or
 * snapshot. All fields are optional (empty patch is a no-op).
 * folderId: null means "move to unfiled".
 *
 * `snapshot` is the full tldraw room snapshot blob. Snapshots are normally
 * persisted by the multiplayer-sync server's debounced flush; the HTTP path
 * is reserved for owner-only flows that run while no sync room is active
 * (export/import). The route handler MUST reject snapshot writes with
 * HTTP 409 `errors.canvas.activeRoom` when a sync room is currently open.
 */
export const canvasUpdateInputSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().uuid().nullable().optional(),
  snapshot: z.unknown().optional(),
});

export type CanvasUpdateInput = z.infer<typeof canvasUpdateInputSchema>;

// ---------------------------------------------------------------------------
// Folder input schemas
// ---------------------------------------------------------------------------

/**
 * POST /api/folder — create a new folder.
 * name: 1-80 chars.
 */
export const folderCreateInputSchema = z.object({
  name: z.string().min(1).max(80),
});

export type FolderCreateInput = z.infer<typeof folderCreateInputSchema>;

/**
 * PATCH /api/folder/:id — rename a folder.
 * name: 1-80 chars.
 */
export const folderUpdateInputSchema = z.object({
  name: z.string().min(1).max(80),
});

export type FolderUpdateInput = z.infer<typeof folderUpdateInputSchema>;

// ---------------------------------------------------------------------------
// BYOK (Phase 2, M11.1) — request / response shapes for /api/account/byok/*
// ---------------------------------------------------------------------------

/**
 * `GET /api/account/byok` — one entry per provider the user has saved
 * a key for. Plaintext / encrypted bytes never leave the server.
 */
export interface BYOKProviderListItem {
  /** One of the supported providers (`'anthropic' | 'openai' | 'google'`). */
  provider: ProviderId;
  createdAt: string;
  /** Touched by the agent runtime (M13.1+); null until then. */
  lastUsedAt: string | null;
}

/**
 * Single default-model preference row — what PATCH /preferences returns
 * for the addressed (provider, model) pair.
 */
export interface BYOKPreferences {
  provider: ProviderId;
  /** Canonical model identifier; member of the BYOK pricing catalog. */
  model: string;
  updatedAt: string;
}

/** Compact per-provider entry used inside the preferences map. */
export interface BYOKPreferenceEntry {
  model: string;
  updatedAt: string;
}

/**
 * Per-provider preferences map carried by GET /api/account/byok. A
 * missing key means "no preference set for that provider"; an empty
 * object `{}` is the empty state. Replaces the M11.3 nullable single-
 * preference shape with a per-provider record.
 */
export type BYOKPreferencesMap = Partial<Record<ProviderId, BYOKPreferenceEntry>>;

/**
 * `GET /api/account/byok` envelope. M11.2 / M11.3 extended the inner
 * shape from `BYOKProviderListItem[]` to `{ keys, preferences }` so a
 * single round-trip primes the Settings UI.
 */
export type BYOKListResponse = ApiSuccess<{
  keys: BYOKProviderListItem[];
  preferences: BYOKPreferencesMap;
}>;

/**
 * @deprecated kept as alias for downstream callers transitioning off the
 * old `{ data: BYOKProviderListItem[] }` envelope. New code should use
 * `BYOKListResponse`.
 */
export type BYOKProviderListResponse = BYOKListResponse;

/**
 * `POST /api/account/byok/:provider` — body shape; validated by
 * `byokSaveBodySchema` in apps/api/src/byok/byok-validator.ts.
 */
export interface BYOKSaveRequest {
  apiKey: string;
}

/**
 * `POST /api/account/byok/:provider` — success response. Mirrors the
 * shape of a list-item entry for the saved provider.
 */
export type BYOKSaveResponse = ApiSuccess<BYOKProviderListItem>;

/**
 * `PATCH /api/account/byok/preferences` — request body. Server runs the
 * same shape through `byokPreferencesBodySchema` (zod) for validation.
 */
export interface BYOKPreferencesPatchBody {
  provider: ProviderId;
  model: string;
}

/** `PATCH /api/account/byok/preferences` — success response. */
export type BYOKPreferencesResponse = ApiSuccess<BYOKPreferences>;
