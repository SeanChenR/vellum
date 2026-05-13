/**
 * mcp/index.test.ts — full HTTP-level handler for /api/mcp.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "PAT authentication gate sits in front of JSON-RPC dispatch"
 *   - "MCP_TOOL_CALL_RULE rate-limits tools/call at 60 calls per 60 seconds per user"
 *   - "Last-used tracking updates at most once per 60 seconds per token"
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { handleMcpRequest, type McpServerDeps } from "./index";
import { buildInMemoryPatRepo, type PatRepo } from "../pat/repo";
import { hashTokenPlaintext } from "../pat/token-format";
import { RateLimiter } from "../lib/rate-limiter";
import type { CanvasRole, PermissionGuardDeps } from "../lib/permission-guard";
import type { LastUsedThrottle } from "../pat/auth";

const USER_A = "user-A";

function silentLogger() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop };
}

function buildDeps(opts: {
  patRepo?: PatRepo;
  role?: CanvasRole | null;
  canvasExists?: boolean;
  throttle?: LastUsedThrottle;
  clock?: { now(): number };
  rateLimiter?: RateLimiter;
  appliedMutations?: Array<{ canvasId: string; mutations: unknown[] }>;
}): McpServerDeps {
  const patRepo = opts.patRepo ?? buildInMemoryPatRepo();
  const applied = opts.appliedMutations ?? [];
  const permission: PermissionGuardDeps = {
    resolveCanvasRole: async () => ({
      canvasExists: opts.canvasExists ?? true,
      role: opts.role === undefined ? "owner" : opts.role,
    }),
  };
  return {
    serverVersion: "0.7.0-test",
    patRepo,
    rateLimiter: opts.rateLimiter ?? new RateLimiter({ capacity: 1_000 }),
    logger: silentLogger(),
    lastUsedThrottle: opts.throttle ?? new Map(),
    clock: opts.clock,
    toolsCallDeps: {
      permission,
      toolRegistryDeps: {
        registry: { getRoom: () => undefined } as never,
        applyMutation: (async (_d: unknown, canvasId: string, mutations: unknown[]) => {
          applied.push({ canvasId, mutations });
          return { ok: true as const, appliedCount: mutations.length };
        }) as never,
        sessionUserId: USER_A,
      } as never,
    },
  };
}

async function seedPlaintext(
  repo: PatRepo,
  opts: { expiresAt?: Date | null; revoke?: boolean } = {},
): Promise<{ plaintext: string }> {
  const plaintext = `vlm_pat_${"x".repeat(32)}`;
  const row = await repo.createToken({
    userId: USER_A,
    name: "test",
    tokenHash: hashTokenPlaintext(plaintext),
    tokenPrefix: plaintext.slice(0, 12),
    expiresAt: opts.expiresAt ?? null,
  });
  if (opts.revoke) await repo.revokeToken(USER_A, row.id);
  return { plaintext };
}

function reqBody(method: string, params?: unknown, opts: { plaintext?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.plaintext) headers["authorization"] = `Bearer ${opts.plaintext}`;
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
  });
}

let repo: PatRepo;
beforeEach(() => {
  repo = buildInMemoryPatRepo();
});

describe("handleMcpRequest — PAT auth gate", () => {
  test("missing Authorization header returns HTTP 401 with empty body", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "ping" }),
    });
    const resp = await handleMcpRequest(req, buildDeps({ patRepo: repo }));
    expect(resp.status).toBe(401);
    expect(await resp.text()).toBe("");
  });

  test("invalid token returns HTTP 401", async () => {
    const req = reqBody("ping", undefined, { plaintext: "vlm_pat_does_not_exist" });
    const resp = await handleMcpRequest(req, buildDeps({ patRepo: repo }));
    expect(resp.status).toBe(401);
  });

  test("expired token returns HTTP 401", async () => {
    const { plaintext } = await seedPlaintext(repo, {
      expiresAt: new Date(Date.now() - 1_000),
    });
    const resp = await handleMcpRequest(
      reqBody("ping", undefined, { plaintext }),
      buildDeps({ patRepo: repo }),
    );
    expect(resp.status).toBe(401);
  });

  test("revoked token returns HTTP 401", async () => {
    const { plaintext } = await seedPlaintext(repo, { revoke: true });
    const resp = await handleMcpRequest(
      reqBody("ping", undefined, { plaintext }),
      buildDeps({ patRepo: repo }),
    );
    expect(resp.status).toBe(401);
  });

  test("valid token returns HTTP 200 + JSON-RPC envelope", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const resp = await handleMcpRequest(
      reqBody("ping", undefined, { plaintext }),
      buildDeps({ patRepo: repo }),
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { result: unknown };
    expect(body.result).toEqual({});
  });
});

describe("handleMcpRequest — rate limit on tools/call", () => {
  test("61st tools/call within 60s returns HTTP 429 with Retry-After", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const limiter = new RateLimiter({ capacity: 100 });
    const deps = buildDeps({ patRepo: repo, rateLimiter: limiter });
    // Consume 60 tokens.
    for (let i = 0; i < 60; i++) {
      const resp = await handleMcpRequest(
        reqBody(
          "tools/call",
          {
            name: "createShape",
            arguments: { canvasId: "c1", id: `shape:${i}`, type: "geo", x: 0, y: 0, props: {} },
          },
          { plaintext },
        ),
        deps,
      );
      expect(resp.status).toBe(200);
    }
    const resp61 = await handleMcpRequest(
      reqBody(
        "tools/call",
        {
          name: "createShape",
          arguments: { canvasId: "c1", id: "shape:61", type: "geo", x: 0, y: 0, props: {} },
        },
        { plaintext },
      ),
      deps,
    );
    expect(resp61.status).toBe(429);
    expect(resp61.headers.get("retry-after")).toBeTruthy();
  });

  test("tools/list does NOT consume the bucket (still 200 after bucket exhausted)", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const limiter = new RateLimiter({ capacity: 100 });
    const deps = buildDeps({ patRepo: repo, rateLimiter: limiter });
    // Burn the bucket via tools/call.
    for (let i = 0; i < 60; i++) {
      await handleMcpRequest(
        reqBody(
          "tools/call",
          {
            name: "createShape",
            arguments: { canvasId: "c1", id: `shape:${i}`, type: "geo", x: 0, y: 0, props: {} },
          },
          { plaintext },
        ),
        deps,
      );
    }
    const respList = await handleMcpRequest(reqBody("tools/list", undefined, { plaintext }), deps);
    expect(respList.status).toBe(200);
  });

  test("two PATs from the same user share one bucket", async () => {
    // Two distinct plaintexts both owned by USER_A.
    const p1 = `vlm_pat_${"a".repeat(32)}`;
    const p2 = `vlm_pat_${"b".repeat(32)}`;
    await repo.createToken({
      userId: USER_A,
      name: "t1",
      tokenHash: hashTokenPlaintext(p1),
      tokenPrefix: p1.slice(0, 12),
      expiresAt: null,
    });
    await repo.createToken({
      userId: USER_A,
      name: "t2",
      tokenHash: hashTokenPlaintext(p2),
      tokenPrefix: p2.slice(0, 12),
      expiresAt: null,
    });
    const limiter = new RateLimiter({ capacity: 100 });
    const deps = buildDeps({ patRepo: repo, rateLimiter: limiter });
    // Consume 60 from p1, then the 61st via p2 should 429.
    for (let i = 0; i < 60; i++) {
      await handleMcpRequest(
        reqBody(
          "tools/call",
          {
            name: "createShape",
            arguments: { canvasId: "c1", id: `shape:${i}`, type: "geo", x: 0, y: 0, props: {} },
          },
          { plaintext: p1 },
        ),
        deps,
      );
    }
    const resp = await handleMcpRequest(
      reqBody(
        "tools/call",
        {
          name: "createShape",
          arguments: { canvasId: "c1", id: "shape:b1", type: "geo", x: 0, y: 0, props: {} },
        },
        { plaintext: p2 },
      ),
      deps,
    );
    expect(resp.status).toBe(429);
  });
});

describe("handleMcpRequest — last_used_at throttle", () => {
  test("two consecutive requests within 60s produce one DB write", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const throttle: LastUsedThrottle = new Map();
    let now = 1_700_000_000_000;
    const clock = { now: () => now };
    const deps = buildDeps({ patRepo: repo, throttle, clock });

    await handleMcpRequest(reqBody("ping", undefined, { plaintext }), deps);
    await new Promise((r) => setTimeout(r, 10)); // let the void task settle
    const after1 = await repo.findActiveTokenByHash(hashTokenPlaintext(plaintext));
    const firstWrite = after1?.lastUsedAt?.getTime();
    expect(firstWrite).toBe(1_700_000_000_000);

    now += 30_000;
    await handleMcpRequest(reqBody("ping", undefined, { plaintext }), deps);
    await new Promise((r) => setTimeout(r, 10));
    const after2 = await repo.findActiveTokenByHash(hashTokenPlaintext(plaintext));
    expect(after2?.lastUsedAt?.getTime()).toBe(firstWrite);
  });
});

describe("handleMcpRequest — protocol error responses", () => {
  test("malformed JSON body returns 200 + JSON-RPC -32700", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${plaintext}`,
      },
      body: "not json",
    });
    const resp = await handleMcpRequest(req, buildDeps({ patRepo: repo }));
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });

  test("unknown method returns 200 + JSON-RPC -32601", async () => {
    const { plaintext } = await seedPlaintext(repo);
    const resp = await handleMcpRequest(
      reqBody("resources/list", undefined, { plaintext }),
      buildDeps({ patRepo: repo }),
    );
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32601);
  });
});
