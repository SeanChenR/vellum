/**
 * repo.test.ts — PatRepo behaviour (in-memory implementation).
 *
 * Spec ref:
 *   openspec/specs/personal-access-token/spec.md
 *     - "Personal access tokens are persisted as opaque hashed entries per user"
 *     - "GET /api/account/pat lists the signed-in user's active tokens"
 *     - "POST /api/account/pat creates a token and returns the plaintext exactly once"
 *     - "DELETE /api/account/pat/:id revokes a token via soft delete"
 *
 * Drizzle-backed implementation is covered by integration tests against
 * a real Postgres in handlers.test.ts; this file pins the in-memory
 * implementation that production routes use through dependency
 * injection in tests.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { buildInMemoryPatRepo, type PatRepo } from "./repo";

const USER_A = "user-A";
const USER_B = "user-B";

let repo: PatRepo;

beforeEach(() => {
  repo = buildInMemoryPatRepo();
});

describe("PatRepo.createToken", () => {
  test("stores hash + prefix + name; returns the row", async () => {
    const row = await repo.createToken({
      userId: USER_A,
      name: "Claude Desktop on Mac",
      tokenHash: "h".repeat(64),
      tokenPrefix: "vlm_pat_a3f2",
      expiresAt: null,
    });
    expect(row.userId).toBe(USER_A);
    expect(row.name).toBe("Claude Desktop on Mac");
    expect(row.tokenHash).toBe("h".repeat(64));
    expect(row.tokenPrefix).toBe("vlm_pat_a3f2");
    expect(row.expiresAt).toBeNull();
    expect(row.revokedAt).toBeNull();
    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
  });

  test("expiresAt stored as Date when provided", async () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const row = await repo.createToken({
      userId: USER_A,
      name: "scoped 90d",
      tokenHash: "x".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: future,
    });
    expect(row.expiresAt?.toISOString()).toBe(future.toISOString());
  });
});

describe("PatRepo.listTokens", () => {
  test("returns active tokens for that user ordered by created_at DESC", async () => {
    const t1 = await repo.createToken({
      userId: USER_A,
      name: "first",
      tokenHash: "1".repeat(64),
      tokenPrefix: "vlm_pat_001x",
      expiresAt: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    const t2 = await repo.createToken({
      userId: USER_A,
      name: "second",
      tokenHash: "2".repeat(64),
      tokenPrefix: "vlm_pat_002x",
      expiresAt: null,
    });
    const rows = await repo.listTokens(USER_A);
    expect(rows.map((r) => r.id)).toEqual([t2.id, t1.id]);
  });

  test("revoked tokens are NOT returned", async () => {
    const t1 = await repo.createToken({
      userId: USER_A,
      name: "active",
      tokenHash: "1".repeat(64),
      tokenPrefix: "vlm_pat_act_",
      expiresAt: null,
    });
    const t2 = await repo.createToken({
      userId: USER_A,
      name: "to-revoke",
      tokenHash: "2".repeat(64),
      tokenPrefix: "vlm_pat_rev_",
      expiresAt: null,
    });
    await repo.revokeToken(USER_A, t2.id);
    const rows = await repo.listTokens(USER_A);
    expect(rows.map((r) => r.id)).toEqual([t1.id]);
  });

  test("returns only tokens owned by the supplied user", async () => {
    await repo.createToken({
      userId: USER_A,
      name: "A's",
      tokenHash: "a".repeat(64),
      tokenPrefix: "vlm_pat_a___",
      expiresAt: null,
    });
    await repo.createToken({
      userId: USER_B,
      name: "B's",
      tokenHash: "b".repeat(64),
      tokenPrefix: "vlm_pat_b___",
      expiresAt: null,
    });
    const rowsA = await repo.listTokens(USER_A);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]!.name).toBe("A's");
  });
});

describe("PatRepo.revokeToken", () => {
  test("owner revokes their own token — sets revokedAt", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "1".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const ok = await repo.revokeToken(USER_A, t.id);
    expect(ok).toBe(true);
    const list = await repo.listTokens(USER_A);
    expect(list).toEqual([]);
  });

  test("cross-user revoke returns false and leaves the row untouched", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "A's",
      tokenHash: "1".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const ok = await repo.revokeToken(USER_B, t.id);
    expect(ok).toBe(false);
    // U1 still sees their token (not revoked).
    const list = await repo.listTokens(USER_A);
    expect(list).toHaveLength(1);
  });

  test("non-existent id returns false", async () => {
    const ok = await repo.revokeToken(USER_A, "does-not-exist");
    expect(ok).toBe(false);
  });
});

describe("PatRepo.findActiveTokenByHash", () => {
  test("returns the row when active + not expired", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "abcd".repeat(16),
      tokenPrefix: "vlm_pat_abcd",
      expiresAt: null,
    });
    const found = await repo.findActiveTokenByHash("abcd".repeat(16));
    expect(found?.id).toBe(t.id);
    expect(found?.userId).toBe(USER_A);
  });

  test("returns null for unknown hash", async () => {
    const found = await repo.findActiveTokenByHash("nope".repeat(16));
    expect(found).toBeNull();
  });

  test("returns null when the token is revoked", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "ef01".repeat(16),
      tokenPrefix: "vlm_pat_ef01",
      expiresAt: null,
    });
    await repo.revokeToken(USER_A, t.id);
    const found = await repo.findActiveTokenByHash("ef01".repeat(16));
    expect(found).toBeNull();
  });

  test("returns null when expires_at is in the past", async () => {
    await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "2222".repeat(16),
      tokenPrefix: "vlm_pat_2222",
      expiresAt: new Date(Date.now() - 1_000),
    });
    const found = await repo.findActiveTokenByHash("2222".repeat(16));
    expect(found).toBeNull();
  });

  test("returns the row when expires_at is in the future", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "3333".repeat(16),
      tokenPrefix: "vlm_pat_3333",
      expiresAt: future,
    });
    const found = await repo.findActiveTokenByHash("3333".repeat(16));
    expect(found?.id).toBe(t.id);
  });
});

describe("PatRepo.touchLastUsed", () => {
  test("sets lastUsedAt to the supplied Date", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "9".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const when = new Date(2026, 4, 13, 12, 0, 0);
    await repo.touchLastUsed(t.id, when);
    const found = await repo.findActiveTokenByHash("9".repeat(64));
    expect(found?.lastUsedAt?.toISOString()).toBe(when.toISOString());
  });
});
