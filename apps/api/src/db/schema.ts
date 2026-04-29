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

export {
  users,
  sessions,
  accounts,
  verifications,
} from "@vellum/shared/db/auth-schema";

export type {
  User,
  Session,
  Account,
  Verification,
} from "@vellum/shared/db/auth-schema";
