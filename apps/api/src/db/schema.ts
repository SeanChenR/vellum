/**
 * Drizzle schema — tables added incrementally as Phase 1 specs apply.
 *
 * Spec → tables:
 *   M1 auth                → users, sessions, accounts, verifications
 *   M2 canvas-folder-crud  → folders, canvases
 *   M5 sharing             → canvas_shares, canvas_invites, canvas_share_links
 *
 * Schema changes are generated via `bun run db:generate` and applied via
 * `bun run db:migrate` (or `db:studio` for the GUI).
 *
 * Auth tables are defined in packages/shared/src/db/auth-schema.ts and
 * re-exported here so drizzle-kit picks them up from a single schema file.
 */

import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "@vellum/shared/db/auth-schema";

export { users, sessions, accounts, verifications } from "@vellum/shared/db/auth-schema";

export type { User, Session, Account, Verification } from "@vellum/shared/db/auth-schema";

// BYOK (Phase 2, M11.1) — per-user × per-provider encrypted API keys.
// M11.2 / M11.3 add `user_ai_preferences` for the user's default model
// selection (one row per user, PK = user_id).
export { apiKeys, userAiPreferences } from "@vellum/shared/db/byok-schema";
export type {
  ApiKey,
  NewApiKey,
  UserAiPreference,
  NewUserAiPreference,
} from "@vellum/shared/db/byok-schema";

// ---------------------------------------------------------------------------
// folders — flat, 1-level only (no parent_id)
// ---------------------------------------------------------------------------

/**
 * Folders provide a single-level organisational layer for canvases.
 * Folders are private to the owner — they are never shared directly.
 *
 * No parent_id column: nesting is explicitly out of scope (PRD US #13).
 */
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK → users.id (text PK from better-auth); cascade-delete with user. */
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("folders_owner_id_name_idx").on(table.ownerId, table.name)],
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;

// ---------------------------------------------------------------------------
// canvases
// ---------------------------------------------------------------------------

/**
 * A canvas owned by a user. Optionally assigned to a folder.
 *
 * folder_id is nullable with ON DELETE SET NULL so that deleting a folder
 * does not cascade-delete its canvases — they revert to "unfiled".
 *
 * snapshot is a jsonb blob that add-canvas-editor-shell will write tldraw
 * state into; default is an empty JSON object so new canvases are valid
 * without any editor interaction.
 */
export const canvases = pgTable(
  "canvases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** FK → users.id (text PK from better-auth); cascade-delete with user. */
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Nullable FK → folders.id.  ON DELETE SET NULL — deleting a folder
     * reverts the canvas to unfiled rather than deleting it.
     */
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    /** tldraw document state; written by add-canvas-editor-shell. */
    snapshot: jsonb("snapshot")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Primary sort for dashboard list: recency descending, scoped by owner. */
    index("canvases_owner_id_updated_at_idx").on(table.ownerId, table.updatedAt),
  ],
);

export type Canvas = typeof canvases.$inferSelect;
export type NewCanvas = typeof canvases.$inferInsert;

// ---------------------------------------------------------------------------
// canvas_shares — accepted shared members (canvas_id, user_id pair)
// ---------------------------------------------------------------------------

/**
 * One row per accepted share. Composite PK `(canvas_id, user_id)` ensures
 * a single relationship per pair; re-inviting a user updates the existing
 * row's role rather than inserting a duplicate (per `add-sharing` spec
 * "Re-inviting an existing share updates the role").
 *
 * Both FK columns cascade-delete: removing the canvas or the user drops
 * any share rows referencing them.
 */
export const canvasShares = pgTable(
  "canvas_shares",
  {
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "editor" grants read+write; "viewer" grants read-only. */
    role: text("role", { enum: ["editor", "viewer"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.canvasId, table.userId] }),
    /** Dashboard "Shared with me" query: filter by user, sort by canvas recency. */
    index("canvas_shares_user_id_idx").on(table.userId),
  ],
);

export type CanvasShare = typeof canvasShares.$inferSelect;
export type NewCanvasShare = typeof canvasShares.$inferInsert;

// ---------------------------------------------------------------------------
// canvas_invites — pending invitations for emails not yet bound to a user
// ---------------------------------------------------------------------------

/**
 * Email-only invites that have not been accepted. Once the recipient
 * registers / logs in and visits `/api/share/invite/:token/accept`, the
 * server inserts a `canvas_shares` row and deletes the invite.
 *
 * `email` is stored lowercase (normalised at write time) so duplicate
 * detection is case-insensitive without a functional index.
 *
 * `expires_at` defaults to 7 days after creation (caller passes the value;
 * the schema default exists as a safety net for direct DB inserts).
 */
export const canvasInvites = pgTable(
  "canvas_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["editor", "viewer"] }).notNull(),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("canvas_invites_token_idx").on(table.token),
    /** Avoid sending duplicate invites for the same (canvas, email) pair. */
    uniqueIndex("canvas_invites_canvas_email_idx").on(table.canvasId, table.email),
  ],
);

export type CanvasInvite = typeof canvasInvites.$inferSelect;
export type NewCanvasInvite = typeof canvasInvites.$inferInsert;

// ---------------------------------------------------------------------------
// canvas_share_links — exactly one public-link record per canvas
// ---------------------------------------------------------------------------

/**
 * One row per canvas. The PK is `canvas_id` so we can never have two
 * public links pointing at the same canvas (per PRD "永遠一張 canvas 對應
 * 一個 link record"). Mode toggling updates the `mode` column; rotation
 * regenerates `token` and bumps `rotated_at`.
 *
 * Lazy-created on first share interaction (any of the share endpoints
 * inserts the row with `mode='closed'` if it does not yet exist).
 */
export const canvasShareLinks = pgTable(
  "canvas_share_links",
  {
    canvasId: uuid("canvas_id")
      .primaryKey()
      .references(() => canvases.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    /** "closed" rejects all link traffic; "view" → read-only; "edit" → read+write. */
    mode: text("mode", { enum: ["closed", "view", "edit"] })
      .notNull()
      .default("closed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("canvas_share_links_token_idx").on(table.token)],
);

export type CanvasShareLink = typeof canvasShareLinks.$inferSelect;
export type NewCanvasShareLink = typeof canvasShareLinks.$inferInsert;

// ---------------------------------------------------------------------------
// ai_threads — per-user × per-canvas AI conversation threads (M14)
// ---------------------------------------------------------------------------

/**
 * Per-user × per-canvas AI conversation threads. Multi-thread is allowed
 * (no unique constraint on (user_id, canvas_id)) so users can reset
 * context with "New chat" without losing prior conversations.
 *
 * Cascade chain: users / canvases → ai_threads → ai_messages.
 *
 * `title` defaults to empty string and is filled at thread creation with
 * a 30-char fallback derived from the first user message; the first
 * `done` event later replaces it with a small-model-generated summary.
 */
export const aiThreads = pgTable(
  "ai_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canvasId: uuid("canvas_id")
      .notNull()
      .references(() => canvases.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Latest-first thread list per (user, canvas). The DESC sort lives at
     * query time (Postgres can scan the index in either direction); naming
     * preserves intent for grep-ability.
     */
    index("ai_threads_user_canvas_updated_idx").on(table.userId, table.canvasId, table.updatedAt),
  ],
);

export type AiThread = typeof aiThreads.$inferSelect;
export type NewAiThread = typeof aiThreads.$inferInsert;

// ---------------------------------------------------------------------------
// ai_messages — ordered messages within an ai_thread (M14)
// ---------------------------------------------------------------------------

/**
 * One row per message within a thread. Role discriminates content shape:
 *   user      → { kind: "text", text: string }
 *   assistant → { kind: "text", text: string }
 *   tool      → { kind: "call", name, args } | { kind: "result", result }
 *
 * Only `role=assistant` rows populate `provider` / `model` / `run_id` /
 * `token_usage`; only `role=tool` rows populate `tool_name` / `tool_call_id`.
 */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => aiThreads.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
    content: jsonb("content").notNull(),
    toolName: text("tool_name"),
    toolCallId: text("tool_call_id"),
    /** { input: number, output: number } — only on the final assistant row of a run */
    tokenUsage: jsonb("token_usage"),
    /** Only on assistant rows — which provider/model produced this message */
    provider: text("provider"),
    model: text("model"),
    /** SSE runId that emitted this message — for replay correlation */
    runId: text("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** Ordered playback within a thread. */
    index("ai_messages_thread_created_idx").on(table.threadId, table.createdAt),
  ],
);

export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;

// ---------------------------------------------------------------------------
// personal_access_tokens — long-lived API tokens for MCP server auth (M15)
// ---------------------------------------------------------------------------

/**
 * Personal Access Tokens (PAT) authenticate third-party MCP clients
 * (Claude Desktop, Cursor, ...) to Vellum's MCP server at /api/mcp.
 *
 * Storage: SHA-256 hash of the plaintext is stored; plaintext is
 * returned to the user ONCE at creation time and never again.
 *
 * Format: `vlm_pat_<32 char base62>` (total 40 chars). The first 12
 * chars are stored in `tokenPrefix` for UI display + secret-scanner
 * detection.
 *
 * Permission model: tokens authenticate user only — per-canvas
 * permission is enforced at request time via existing permission-guard
 * against the user's role on the supplied canvasId.
 *
 * Lifecycle: soft delete via `revokedAt`; hard cleanup of revoked rows
 * after 30 days is a future maintenance job (not part of M15).
 *
 * Spec: openspec/specs/personal-access-token/spec.md
 */
export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    /** ulid (text PK) — time-sortable so created_at DESC is natural. */
    id: text("id").primaryKey(),
    /** FK → users.id; cascade-delete with user. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** User-supplied label, 1..64 chars (e.g. "Claude Desktop on Mac"). */
    name: text("name").notNull(),
    /** SHA-256 hex of the plaintext token. Never stores plaintext. */
    tokenHash: text("token_hash").notNull(),
    /** First 12 chars of plaintext (e.g. `"vlm_pat_a3f2"`) for UI + secret-scan. */
    tokenPrefix: text("token_prefix").notNull(),
    /** Reserved for future fine-grained scope; NULL = unrestricted in M15. */
    scope: text("scope"),
    /** NULL = never expires. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Throttled-write tracker; max one UPDATE per token per 60 s. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete marker; non-null = revoked. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    /** Latest-first list per user for Settings UI. */
    index("pat_user_idx").on(table.userId, table.createdAt),
    /**
     * Active-only unique index on token_hash. Permits a revoked hash to
     * be reused by a new token (extremely unlikely but spec-required).
     * Partial WHERE clause materializes only active rows.
     */
    uniqueIndex("pat_hash_active_idx")
      .on(table.tokenHash)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export type PersonalAccessToken = typeof personalAccessTokens.$inferSelect;
export type NewPersonalAccessToken = typeof personalAccessTokens.$inferInsert;
