/**
 * routes.test.ts — PAT REST endpoints.
 *
 * Spec ref: openspec/specs/personal-access-token/spec.md
 *   - "GET /api/account/pat lists the signed-in user's active tokens"
 *   - "POST /api/account/pat creates a token and returns the plaintext exactly once"
 *   - "DELETE /api/account/pat/:id revokes a token via soft delete"
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { handlePatRequest, type PatRoutesDeps } from "./routes";
import { buildInMemoryPatRepo, type PatRepo } from "./repo";
import { hashTokenPlaintext } from "./token-format";

const USER_A = "user-A";
const USER_B = "user-B";

let repo: PatRepo;
let deps: PatRoutesDeps;

beforeEach(() => {
  repo = buildInMemoryPatRepo();
  deps = { repo };
});

function req(method: string, path: string, opts: { body?: unknown } = {}): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: opts.body ? { "content-type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe("GET /api/account/pat", () => {
  test("unauthenticated returns 401", async () => {
    const resp = await handlePatRequest(req("GET", "/api/account/pat"), null, deps);
    expect(resp?.status).toBe(401);
  });

  test("returns user's active tokens in created_at DESC order, no plaintext / hash", async () => {
    const t1 = await repo.createToken({
      userId: USER_A,
      name: "first",
      tokenHash: "h1".padEnd(64, "0"),
      tokenPrefix: "vlm_pat_1111",
      expiresAt: null,
    });
    await new Promise((r) => setTimeout(r, 5));
    const t2 = await repo.createToken({
      userId: USER_A,
      name: "second",
      tokenHash: "h2".padEnd(64, "0"),
      tokenPrefix: "vlm_pat_2222",
      expiresAt: null,
    });
    const resp = await handlePatRequest(req("GET", "/api/account/pat"), { userId: USER_A }, deps);
    expect(resp?.status).toBe(200);
    const body = (await resp!.json()) as { data: Array<{ id: string; name: string }> };
    expect(body.data.map((d) => d.id)).toEqual([t2.id, t1.id]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("token_hash");
    expect(serialized).not.toContain("plaintext");
  });

  test("does not return tokens belonging to other users", async () => {
    await repo.createToken({
      userId: USER_B,
      name: "B's",
      tokenHash: "x".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const resp = await handlePatRequest(req("GET", "/api/account/pat"), { userId: USER_A }, deps);
    const body = (await resp!.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });
});

describe("POST /api/account/pat", () => {
  test("unauthenticated returns 401", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", { body: { name: "x" } }),
      null,
      deps,
    );
    expect(resp?.status).toBe(401);
  });

  test("returns 201 + plaintext + id + prefix + expiresAt for valid create", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", {
        body: { name: "Claude Desktop on Mac", expiresInDays: 90 },
      }),
      { userId: USER_A },
      deps,
    );
    expect(resp?.status).toBe(201);
    const body = (await resp!.json()) as {
      data: { token: string; id: string; name: string; prefix: string; expiresAt: string | null };
    };
    expect(body.data.token.startsWith("vlm_pat_")).toBe(true);
    expect(body.data.token).toHaveLength(40);
    expect(body.data.prefix).toBe(body.data.token.slice(0, 12));
    expect(body.data.name).toBe("Claude Desktop on Mac");
    expect(typeof body.data.id).toBe("string");
    expect(body.data.expiresAt).toBeTruthy();
    const expires = new Date(body.data.expiresAt!);
    const expected = Date.now() + 90 * 24 * 60 * 60 * 1000;
    // Within 5 seconds is plenty.
    expect(Math.abs(expires.getTime() - expected)).toBeLessThan(5_000);
  });

  test("expiresInDays null = never expires (stored as null)", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", { body: { name: "perpetual", expiresInDays: null } }),
      { userId: USER_A },
      deps,
    );
    const body = (await resp!.json()) as { data: { expiresAt: null | string } };
    expect(body.data.expiresAt).toBeNull();
  });

  test("missing name returns 400 errors.validation", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", { body: {} }),
      { userId: USER_A },
      deps,
    );
    expect(resp?.status).toBe(400);
    const body = (await resp!.json()) as { error: string };
    expect(body.error).toBe("errors.validation");
  });

  test("name > 64 chars returns 400", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", { body: { name: "x".repeat(65) } }),
      { userId: USER_A },
      deps,
    );
    expect(resp?.status).toBe(400);
  });

  test("created row is hash-stored and discoverable by hash", async () => {
    const resp = await handlePatRequest(
      req("POST", "/api/account/pat", { body: { name: "t" } }),
      { userId: USER_A },
      deps,
    );
    const body = (await resp!.json()) as { data: { token: string; id: string } };
    const hash = hashTokenPlaintext(body.data.token);
    const found = await repo.findActiveTokenByHash(hash);
    expect(found?.id).toBe(body.data.id);
  });
});

describe("DELETE /api/account/pat/:id", () => {
  test("unauthenticated returns 401", async () => {
    const resp = await handlePatRequest(req("DELETE", "/api/account/pat/some-id"), null, deps);
    expect(resp?.status).toBe(401);
  });

  test("owner revokes own token returns 204 + row revoked", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "t",
      tokenHash: "h".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const resp = await handlePatRequest(
      req("DELETE", `/api/account/pat/${t.id}`),
      { userId: USER_A },
      deps,
    );
    expect(resp?.status).toBe(204);
    expect(await repo.listTokens(USER_A)).toEqual([]);
  });

  test("cross-user delete returns 404 (existence leak avoidance)", async () => {
    const t = await repo.createToken({
      userId: USER_A,
      name: "A's",
      tokenHash: "h".repeat(64),
      tokenPrefix: "vlm_pat_xxxx",
      expiresAt: null,
    });
    const resp = await handlePatRequest(
      req("DELETE", `/api/account/pat/${t.id}`),
      { userId: USER_B },
      deps,
    );
    expect(resp?.status).toBe(404);
    expect(await repo.listTokens(USER_A)).toHaveLength(1);
  });

  test("non-existent id returns 404", async () => {
    const resp = await handlePatRequest(
      req("DELETE", "/api/account/pat/does-not-exist"),
      { userId: USER_A },
      deps,
    );
    expect(resp?.status).toBe(404);
  });
});

describe("Path dispatch", () => {
  test("returns undefined for unrelated path so caller can fall through", async () => {
    const resp = await handlePatRequest(req("GET", "/api/other"), { userId: USER_A }, deps);
    expect(resp).toBeUndefined();
  });
});
