/**
 * Drizzle schema — tables added incrementally as Phase 1 specs apply.
 *
 * Spec → tables:
 *   M1 auth                → users, sessions, accounts, magic_links
 *   M2 canvas-folder-crud  → folders, canvases
 *   M5 sharing             → canvas_shares, canvas_share_links
 *
 * Schema changes are generated via `bun run db:generate` and applied via
 * `bun run db:migrate` (or `db:studio` for the GUI).
 */

export {};
