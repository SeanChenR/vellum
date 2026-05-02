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
    mode: text("mode", { enum: ["closed", "view", "edit"] }).notNull().default("closed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("canvas_share_links_token_idx").on(table.token)],
);

export type CanvasShareLink = typeof canvasShareLinks.$inferSelect;
export type NewCanvasShareLink = typeof canvasShareLinks.$inferInsert;
