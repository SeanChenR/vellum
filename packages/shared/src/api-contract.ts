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
  | "errors.folder.notFound"
  | "errors.folder.forbidden"
  | "errors.folder.notEmpty"
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
 * PATCH /api/canvas/:id — partial update of title and/or folderId.
 * All fields are optional (empty patch is a no-op).
 * folderId: null means "move to unfiled".
 */
export const canvasUpdateInputSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().uuid().nullable().optional(),
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
