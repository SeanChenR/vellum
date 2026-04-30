/**
 * Drizzle schema — tables added incrementally as Phase 1 specs apply.
 *
 * Spec → tables:
 *   M1 auth                → users, sessions, accounts, verifications
 *   M2 canvas-folder-crud  → folders, canvases
 *   M5 sharing             → canvas_shares, canvas_share_links
 *
 * Schema changes are generated via `bun run db:generate` and applied via
 * `bun run db:migrate` (or `db:studio` for the GUI).
 *
 * Auth tables are defined in packages/shared/src/db/auth-schema.ts and
 * re-exported here so drizzle-kit picks them up from a single schema file.
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
