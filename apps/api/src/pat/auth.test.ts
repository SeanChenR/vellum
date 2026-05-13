/**
 * auth.test.ts — PAT authentication helper.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   "PAT authenticator resolves token plaintext to user id without
 *    exposing hashes"
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { authenticatePat, touchLastUsed, type LastUsedThrottle } from "./auth";
import { buildInMemoryPatRepo, type PatRepo } from "./repo";
import { hashTokenPlaintext } from "./token-format";

type LogCall = { level: string; obj: unknown; msg: string };

function makeFakeLogger(): {
  calls: LogCall[];
  logger: Parameters<typeof authenticatePat>[1]["logger"];
} {
  const calls: LogCall[] = [];
  const push = (level: string) => (obj: unknown, msg?: string) =>
    calls.push({ level, obj, msg: msg ?? "" });
  return {
    calls,
    logger: {
      info: push("info"),
      warn: push("warn"),
      error: push("error"),
      debug: push("debug"),
    },
  };
}

function makeFakeReq(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/mcp", { method: "POST", headers });
}

let repo: PatRepo;
const USER = "user-A";

beforeEach(() => {
  repo = buildInMemoryPatRepo();
});

describe("authenticatePat", () => {
  test("returns null when Authorization header is missing", async () => {
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({});
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toBeNull();
  });

  test("returns null when Authorization header lacks Bearer prefix", async () => {
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: "vlm_pat_abc" });
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toBeNull();
  });

  test("returns null when no token matches the supplied plaintext", async () => {
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: "Bearer vlm_pat_does_not_exist" });
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toBeNull();
  });

  test("returns {userId, tokenId} when the token is active", async () => {
    const plaintext = "vlm_pat_K9mPq3vWxN2fT4hY8jZc1bR5sLgD7eAu";
    const row = await repo.createToken({
      userId: USER,
      name: "test",
      tokenHash: hashTokenPlaintext(plaintext),
      tokenPrefix: plaintext.slice(0, 12),
      expiresAt: null,
    });
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: `Bearer ${plaintext}` });
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toEqual({ userId: USER, tokenId: row.id });
  });

  test("returns null when the token is revoked", async () => {
    const plaintext = "vlm_pat_revokedrevokedrevokedrevokedab";
    const row = await repo.createToken({
      userId: USER,
      name: "t",
      tokenHash: hashTokenPlaintext(plaintext),
      tokenPrefix: plaintext.slice(0, 12),
      expiresAt: null,
    });
    await repo.revokeToken(USER, row.id);
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: `Bearer ${plaintext}` });
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toBeNull();
  });

  test("returns null when the token has expired", async () => {
    const plaintext = "vlm_pat_expiredexpiredexpiredexpiredabcd";
    await repo.createToken({
      userId: USER,
      name: "t",
      tokenHash: hashTokenPlaintext(plaintext),
      tokenPrefix: plaintext.slice(0, 12),
      expiresAt: new Date(Date.now() - 1_000),
    });
    const { logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: `Bearer ${plaintext}` });
    const result = await authenticatePat(req, { repo, logger });
    expect(result).toBeNull();
  });

  test("never logs the plaintext token (security)", async () => {
    const plaintext = "vlm_pat_K9mPq3vWxN2fT4hY8jZc1bR5sLgD7eAu";
    await repo.createToken({
      userId: USER,
      name: "test",
      tokenHash: hashTokenPlaintext(plaintext),
      tokenPrefix: plaintext.slice(0, 12),
      expiresAt: null,
    });
    const { calls, logger } = makeFakeLogger();
    const req = makeFakeReq({ Authorization: `Bearer ${plaintext}` });
    await authenticatePat(req, { repo, logger });
    // ALSO try a bad token to exercise the warn path.
    const badReq = makeFakeReq({ Authorization: "Bearer vlm_pat_invalidinvalid" });
    await authenticatePat(badReq, { repo, logger });
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain(plaintext);
    // The body random portion must also not leak.
    expect(serialized).not.toContain("K9mPq3vWxN2fT4hY8jZc1bR5sLgD7eAu");
  });
});

describe("touchLastUsed throttle", () => {
  test("writes only once within a 60-second window per token", async () => {
    const row = await repo.createToken({
      userId: USER,
      name: "t",
      tokenHash: "h".repeat(64),
      tokenPrefix: "vlm_pat_thro",
      expiresAt: null,
    });
    const throttle: LastUsedThrottle = new Map();
    const t0 = 1_700_000_000_000;
    let now = t0;
    const clock = { now: () => now };

    await touchLastUsed(row.id, repo, clock, throttle);
    const after1 = await repo.findActiveTokenByHash("h".repeat(64));
    const firstWrite = after1?.lastUsedAt?.getTime();
    expect(firstWrite).toBe(t0);

    // 30 s later — second call must be a no-op.
    now = t0 + 30_000;
    await touchLastUsed(row.id, repo, clock, throttle);
    const after2 = await repo.findActiveTokenByHash("h".repeat(64));
    expect(after2?.lastUsedAt?.getTime()).toBe(firstWrite);
  });

  test("writes again after the throttle window elapses (>= 60 s gap)", async () => {
    const row = await repo.createToken({
      userId: USER,
      name: "t",
      tokenHash: "g".repeat(64),
      tokenPrefix: "vlm_pat_grpe",
      expiresAt: null,
    });
    const throttle: LastUsedThrottle = new Map();
    const t0 = 1_700_000_000_000;
    let now = t0;
    const clock = { now: () => now };

    await touchLastUsed(row.id, repo, clock, throttle);
    now = t0 + 90_000;
    await touchLastUsed(row.id, repo, clock, throttle);
    const after = await repo.findActiveTokenByHash("g".repeat(64));
    expect(after?.lastUsedAt?.getTime()).toBe(t0 + 90_000);
  });
});
