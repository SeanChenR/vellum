/**
 * BYOK (Bring Your Own Key) schema — single `api_keys` table holding the
 * per-user, per-provider encrypted API keys for the AI co-pilot feature
 * (Phase 2, M11.1).
 *
 * Encryption details (AES-256-GCM, packed format) live in the API Key
 * Vault module — `apps/api/src/byok/vault.ts`. This schema only stores
 * the opaque packed string; nothing about the cipher algorithm leaks
 * into DB columns so the algorithm can be versioned via a packed-string
 * prefix without a schema migration.
 *
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 * "api_keys schema uses `text` user_id (not uuid) to align with
 * better-auth".
 *
 * Lives in packages/shared so both API server (CRUD + drizzle-kit
 * migrations) and any future client-side code (e.g. type re-exports)
 * reference the same definition. Auth tables follow the same pattern.
 */

import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

// ---------------------------------------------------------------------------
// api_keys — per-user × per-provider encrypted API key storage
// ---------------------------------------------------------------------------

/**
 * Composite PK `(user_id, provider)` enforces "one key per provider per
 * user" without a separate unique constraint. `user_id` is `text` to
 * align with better-auth's `users.id` (FK type must match).
 *
 * `encrypted_key` holds the AES-256-GCM packed string `base64(iv ‖ tag
 * ‖ ciphertext)` produced by the API Key Vault module — the DB knows
 * nothing about the cipher.
 *
 * `last_used_at` is reserved for the agent runtime (M13.1+) which will
 * touch it when consuming a key; M11.1 never writes to this column.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    /** FK → users.id (text PK from better-auth); cascade-delete with user. */
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Provider identifier — `'anthropic'` only in M11.1; M11.2 extends. */
    provider: text("provider").notNull(),
    /** AES-256-GCM packed string: base64(iv(12) ‖ tag(16) ‖ ciphertext). */
    encryptedKey: text("encrypted_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Touched by future agent runtime; null in M11.1. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.provider] })],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
