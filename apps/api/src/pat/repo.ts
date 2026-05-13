/**
 * repo.ts — Personal Access Token persistence layer.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *
 * Two implementations:
 *   - `buildPatRepo({ db })` — Drizzle/Postgres for production
 *   - `buildInMemoryPatRepo()` — Map-backed, used by unit tests
 *     covering routes / auth without touching a real DB.
 *
 * Plaintext NEVER appears in this module. Callers (route handler)
 * generate the plaintext via `token-format.generateTokenPlaintext`,
 * hash it via `hashTokenPlaintext`, and pass the hash + prefix here.
 */

import { and, desc, eq, isNull, or, gt } from "drizzle-orm";
import { personalAccessTokens } from "../db/schema";
import type { Database } from "../db";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PatRow {
  id: string;
  userId: string;
  name: string;
  /** SHA-256 hex of plaintext. */
  tokenHash: string;
  /** First 12 chars of plaintext (e.g. "vlm_pat_a3f2"). */
  tokenPrefix: string;
  /** Reserved for future fine-grained scope; NULL = unrestricted (M15). */
  scope: string | null;
  /** NULL = never expires. */
  expiresAt: Date | null;
  /** Throttled write — set to last touch time (≥ 60s gap). */
  lastUsedAt: Date | null;
  createdAt: Date;
  /** Soft delete marker. NULL = active. */
  revokedAt: Date | null;
}

export interface CreateTokenInput {
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  /** NULL = never expires. */
  expiresAt: Date | null;
}

export interface PatRepo {
  createToken(input: CreateTokenInput): Promise<PatRow>;
  /** Return active (non-revoked) tokens for the user, newest first. */
  listTokens(userId: string): Promise<PatRow[]>;
  /**
   * Soft-delete the targeted token if and only if it belongs to the
   * supplied user and is not already revoked. Returns true on revoke,
   * false on miss / cross-user / already-revoked / unknown id.
   */
  revokeToken(userId: string, tokenId: string): Promise<boolean>;
  /**
   * Look up an active token by its plaintext SHA-256 hash. Returns
   * null when the token is missing, revoked, or expired.
   *
   * This is the read path that PAT authentication takes on every
   * `POST /api/mcp` request.
   */
  findActiveTokenByHash(tokenHash: string): Promise<PatRow | null>;
  /** Set `last_used_at` on the given token. */
  touchLastUsed(tokenId: string, when: Date): Promise<void>;
}

// ---------------------------------------------------------------------------
// Drizzle-backed implementation
// ---------------------------------------------------------------------------

export interface PatRepoDeps {
  db: Database;
}

export function buildPatRepo({ db }: PatRepoDeps): PatRepo {
  return {
    async createToken({ userId, name, tokenHash, tokenPrefix, expiresAt }) {
      const id = crypto.randomUUID();
      const [row] = await db
        .insert(personalAccessTokens)
        .values({ id, userId, name, tokenHash, tokenPrefix, expiresAt })
        .returning();
      if (!row) throw new Error("personal_access_tokens insert returned no row");
      return rowToPat(row);
    },

    async listTokens(userId) {
      const rows = await db
        .select()
        .from(personalAccessTokens)
        .where(and(eq(personalAccessTokens.userId, userId), isNull(personalAccessTokens.revokedAt)))
        .orderBy(desc(personalAccessTokens.createdAt));
      return rows.map(rowToPat);
    },

    async revokeToken(userId, tokenId) {
      const result = await db
        .update(personalAccessTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(personalAccessTokens.id, tokenId),
            eq(personalAccessTokens.userId, userId),
            isNull(personalAccessTokens.revokedAt),
          ),
        )
        .returning({ id: personalAccessTokens.id });
      return result.length > 0;
    },

    async findActiveTokenByHash(tokenHash) {
      const now = new Date();
      const [row] = await db
        .select()
        .from(personalAccessTokens)
        .where(
          and(
            eq(personalAccessTokens.tokenHash, tokenHash),
            isNull(personalAccessTokens.revokedAt),
            // expires_at NULL OR > now()
            or(isNull(personalAccessTokens.expiresAt), gt(personalAccessTokens.expiresAt, now)),
          ),
        )
        .limit(1);
      return row ? rowToPat(row) : null;
    },

    async touchLastUsed(tokenId, when) {
      await db
        .update(personalAccessTokens)
        .set({ lastUsedAt: when })
        .where(eq(personalAccessTokens.id, tokenId));
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests)
// ---------------------------------------------------------------------------

export function buildInMemoryPatRepo(): PatRepo {
  const store = new Map<string, PatRow>();

  return {
    async createToken({ userId, name, tokenHash, tokenPrefix, expiresAt }) {
      const id = crypto.randomUUID();
      const row: PatRow = {
        id,
        userId,
        name,
        tokenHash,
        tokenPrefix,
        scope: null,
        expiresAt,
        lastUsedAt: null,
        createdAt: new Date(),
        revokedAt: null,
      };
      store.set(id, row);
      return row;
    },

    async listTokens(userId) {
      return Array.from(store.values())
        .filter((r) => r.userId === userId && r.revokedAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    async revokeToken(userId, tokenId) {
      const row = store.get(tokenId);
      if (!row || row.userId !== userId || row.revokedAt !== null) return false;
      store.set(tokenId, { ...row, revokedAt: new Date() });
      return true;
    },

    async findActiveTokenByHash(tokenHash) {
      const now = Date.now();
      for (const row of store.values()) {
        if (row.tokenHash !== tokenHash) continue;
        if (row.revokedAt !== null) continue;
        if (row.expiresAt !== null && row.expiresAt.getTime() <= now) continue;
        return row;
      }
      return null;
    },

    async touchLastUsed(tokenId, when) {
      const row = store.get(tokenId);
      if (!row) return;
      store.set(tokenId, { ...row, lastUsedAt: when });
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToPat(r: typeof personalAccessTokens.$inferSelect): PatRow {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    tokenHash: r.tokenHash,
    tokenPrefix: r.tokenPrefix,
    scope: r.scope ?? null,
    expiresAt: r.expiresAt ?? null,
    lastUsedAt: r.lastUsedAt ?? null,
    createdAt: r.createdAt,
    revokedAt: r.revokedAt ?? null,
  };
}
