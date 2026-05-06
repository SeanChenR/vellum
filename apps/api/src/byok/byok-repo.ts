/**
 * byok-repo.ts — Drizzle-backed implementation of `ByokRepo`.
 *
 * Production wiring for the BYOK route handlers (`./routes.ts`). Tests
 * inject in-memory repos; this module exists so the handler stays
 * Drizzle-agnostic.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 *   "Validate-before-persist with single transaction window".
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db/index";
import { apiKeys } from "../db/schema";
import type { ByokRepo, ListedApiKey } from "./routes";

export function createDrizzleByokRepo(): ByokRepo {
  return {
    async list(userId): Promise<ListedApiKey[]> {
      const db = getDb();
      const rows = await db
        .select({
          provider: apiKeys.provider,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      return rows;
    },

    async upsert(userId, provider, encryptedKey): Promise<ListedApiKey> {
      const db = getDb();
      const [row] = await db
        .insert(apiKeys)
        .values({ userId, provider, encryptedKey })
        .onConflictDoUpdate({
          target: [apiKeys.userId, apiKeys.provider],
          set: { encryptedKey, createdAt: sql`NOW()` },
        })
        .returning({
          provider: apiKeys.provider,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
        });
      if (!row) {
        throw new Error("BYOK upsert returned no row");
      }
      return row;
    },

    async delete(userId, provider): Promise<void> {
      const db = getDb();
      await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)));
    },
  };
}
