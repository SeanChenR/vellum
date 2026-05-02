/**
 * Sync handshake auth tests (task 2.1).
 *
 * Covers spec requirements:
 *   - "WebSocket handshake authenticates the user via session cookie"
 *   - "WebSocket handshake authorizes the user against the canvas"
 *
 * The auth module exposes `authenticateSyncHandshake(req, canvasId, deps)` to
 * keep tests free of better-auth and Postgres setup. Production wires `deps`
 * to the real session resolver and DB-backed canvas-role lookup.
 */

import { describe, expect, test } from "bun:test";
import { authenticateSyncHandshake, type SyncAuthDeps, type SyncAuthResult } from "./auth";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CANVAS_ID = "00000000-0000-0000-0000-000000000001";

function req(): Request {
  return new Request(`http://localhost/sync/${CANVAS_ID}`, { method: "GET" });
}

interface MockDepsSpec {
  userId: string | null;
  canvas: { exists: false } | { exists: true; role: "editor" | "viewer" | null };
  /** Optional public-link lookup result, keyed by token. */
  link?: Record<string, { canvasId: string; mode: "closed" | "view" | "edit" }>;
}

function mockDeps(spec: MockDepsSpec): SyncAuthDeps {
  return {
    async resolveSession() {
      return spec.userId ? { userId: spec.userId } : null;
    },
    async resolveCanvasRole(_userId, _canvasId) {
      if (!spec.canvas.exists) return { canvasExists: false, role: null };
      return { canvasExists: true, role: spec.canvas.role };
    },
    async resolveCanvasShareLink(token) {
      return spec.link?.[token] ?? null;
    },
  };
}

function reqWithToken(token: string, canvasId = CANVAS_ID): Request {
  return new Request(`http://localhost/sync/${canvasId}?token=${token}`, { method: "GET" });
}

// ---------------------------------------------------------------------------
// Authentication: session cookie
// ---------------------------------------------------------------------------

describe("authenticateSyncHandshake — session cookie", () => {
  test("missing/invalid session resolves to 401 errors.auth.unauthorized", async () => {
    const result: SyncAuthResult = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: null, canvas: { exists: true, role: "editor" } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(401);
    expect(result.error).toBe("errors.auth.unauthorized");
  });

  test("missing session does NOT call resolveCanvasRole (auth gates authz)", async () => {
    let canvasRoleCalled = false;
    const deps: SyncAuthDeps = {
      async resolveSession() {
        return null;
      },
      async resolveCanvasRole() {
        canvasRoleCalled = true;
        return { canvasExists: true, role: "editor" };
      },
      async resolveCanvasShareLink() {
        return null;
      },
    };
    const result = await authenticateSyncHandshake(req(), CANVAS_ID, deps);
    expect(result.ok).toBe(false);
    expect(canvasRoleCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Authorization: canvas role
// ---------------------------------------------------------------------------

describe("authenticateSyncHandshake — canvas authorization", () => {
  test("non-existent canvas resolves to 404 errors.canvas.notFound", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: "u1", canvas: { exists: false } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(404);
    expect(result.error).toBe("errors.canvas.notFound");
  });

  test("authenticated user without any role resolves to 403 errors.canvas.forbidden", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: "u-no-role", canvas: { exists: true, role: null } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(403);
    expect(result.error).toBe("errors.canvas.forbidden");
  });

  test("canvas owner resolves to ok with role=editor", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: "u-owner", canvas: { exists: true, role: "editor" } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.userId).toBe("u-owner");
    expect(result.role).toBe("editor");
  });

  test("shared editor resolves to ok with role=editor", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({
        userId: "u-shared-editor",
        canvas: { exists: true, role: "editor" },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.role).toBe("editor");
  });

  test("shared viewer resolves to ok with role=viewer", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({
        userId: "u-shared-viewer",
        canvas: { exists: true, role: "viewer" },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.role).toBe("viewer");
  });

  test("invalid canvasId still routes through DB lookup (no client-side filtering)", async () => {
    // The auth module SHALL NOT pre-filter canvasId shape — that is the
    // route handler's concern. Here we simply confirm that whatever the
    // resolver returns is honoured.
    const result = await authenticateSyncHandshake(
      req(),
      "not-a-uuid",
      mockDeps({ userId: "u1", canvas: { exists: false } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Failure ordering: auth → canvas existence → role
// ---------------------------------------------------------------------------

describe("authenticateSyncHandshake — failure ordering", () => {
  test("when session is missing AND canvas does not exist, returns 401 (auth wins)", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: null, canvas: { exists: false } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(401);
  });

  test("when session is valid AND canvas does not exist, returns 404 (existence wins over role)", async () => {
    const result = await authenticateSyncHandshake(
      req(),
      CANVAS_ID,
      mockDeps({ userId: "u1", canvas: { exists: false } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Public-link token path — added by add-sharing (task 2.6)
// Spec: multiplayer-sync MODIFIED "WebSocket handshake authenticates the
// user via session cookie" + MODIFIED "WebSocket handshake authorizes the
// user against the canvas".
// ---------------------------------------------------------------------------

const VIEW_TOKEN = "view-token-view-token-view-token-view-token";
const EDIT_TOKEN = "edit-token-edit-token-edit-token-edit-token";
const CLOSED_TOKEN = "closed-token-closed-token-closed-token-clos";
const OTHER_CANVAS = "00000000-0000-0000-0000-000000000099";

describe("authenticateSyncHandshake — public-link token path", () => {
  test("valid view-mode token grants role=viewer with anon: userId", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken(VIEW_TOKEN),
      CANVAS_ID,
      mockDeps({
        userId: null,
        canvas: { exists: true, role: null },
        link: { [VIEW_TOKEN]: { canvasId: CANVAS_ID, mode: "view" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.role).toBe("viewer");
    expect(result.userId.startsWith("anon:")).toBe(true);
  });

  test("valid edit-mode token grants role=editor with anon: userId", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken(EDIT_TOKEN),
      CANVAS_ID,
      mockDeps({
        userId: null,
        canvas: { exists: true, role: null },
        link: { [EDIT_TOKEN]: { canvasId: CANVAS_ID, mode: "edit" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.role).toBe("editor");
    expect(result.userId.startsWith("anon:")).toBe(true);
  });

  test("closed-mode token returns 403 errors.canvas.forbidden", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken(CLOSED_TOKEN),
      CANVAS_ID,
      mockDeps({
        userId: null,
        canvas: { exists: true, role: null },
        link: { [CLOSED_TOKEN]: { canvasId: CANVAS_ID, mode: "closed" } },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(403);
    expect(result.error).toBe("errors.canvas.forbidden");
  });

  test("token whose canvasId does not match the path returns 403", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken(VIEW_TOKEN, CANVAS_ID),
      CANVAS_ID,
      mockDeps({
        userId: null,
        canvas: { exists: true, role: null },
        link: { [VIEW_TOKEN]: { canvasId: OTHER_CANVAS, mode: "view" } },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(403);
  });

  test("unknown token returns 403 errors.canvas.forbidden", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken("nonexistent-token-nonexistent-token-nonexis"),
      CANVAS_ID,
      mockDeps({
        userId: null,
        canvas: { exists: true, role: null },
        link: {},
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(403);
  });

  test("session cookie wins when both cookie AND token are present", async () => {
    const result = await authenticateSyncHandshake(
      reqWithToken(VIEW_TOKEN),
      CANVAS_ID,
      mockDeps({
        userId: "u-real",
        canvas: { exists: true, role: "editor" },
        link: { [VIEW_TOKEN]: { canvasId: CANVAS_ID, mode: "view" } },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    // Cookie path → real user id, role from canvas_shares (editor), NOT viewer.
    expect(result.userId).toBe("u-real");
    expect(result.role).toBe("editor");
    expect(result.userId.startsWith("anon:")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full outcome matrix per the MODIFIED "WebSocket handshake authorizes the
// user against the canvas" spec example.
// ---------------------------------------------------------------------------

describe("authenticateSyncHandshake — full outcome matrix", () => {
  // Each row: [label, deps spec, request builder, expected outcome]
  type Outcome =
    | { kind: "ok"; role: "editor" | "viewer"; anon: boolean }
    | { kind: "fail"; status: 401 | 403 | 404; error: string };

  const cases: Array<{
    label: string;
    deps: MockDepsSpec;
    buildReq: () => Request;
    expected: Outcome;
  }> = [
    {
      label: "owner cookie",
      deps: { userId: "u-owner", canvas: { exists: true, role: "editor" } },
      buildReq: () => req(),
      expected: { kind: "ok", role: "editor", anon: false },
    },
    {
      label: "editor share cookie",
      deps: { userId: "u-ed", canvas: { exists: true, role: "editor" } },
      buildReq: () => req(),
      expected: { kind: "ok", role: "editor", anon: false },
    },
    {
      label: "viewer share cookie",
      deps: { userId: "u-vw", canvas: { exists: true, role: "viewer" } },
      buildReq: () => req(),
      expected: { kind: "ok", role: "viewer", anon: false },
    },
    {
      label: "no relation cookie",
      deps: { userId: "u-stranger", canvas: { exists: true, role: null } },
      buildReq: () => req(),
      expected: { kind: "fail", status: 403, error: "errors.canvas.forbidden" },
    },
    {
      label: "no cookie + valid view token",
      deps: {
        userId: null,
        canvas: { exists: true, role: null },
        link: { [VIEW_TOKEN]: { canvasId: CANVAS_ID, mode: "view" } },
      },
      buildReq: () => reqWithToken(VIEW_TOKEN),
      expected: { kind: "ok", role: "viewer", anon: true },
    },
    {
      label: "no cookie + valid edit token",
      deps: {
        userId: null,
        canvas: { exists: true, role: null },
        link: { [EDIT_TOKEN]: { canvasId: CANVAS_ID, mode: "edit" } },
      },
      buildReq: () => reqWithToken(EDIT_TOKEN),
      expected: { kind: "ok", role: "editor", anon: true },
    },
    {
      label: "no cookie + closed token",
      deps: {
        userId: null,
        canvas: { exists: true, role: null },
        link: { [CLOSED_TOKEN]: { canvasId: CANVAS_ID, mode: "closed" } },
      },
      buildReq: () => reqWithToken(CLOSED_TOKEN),
      expected: { kind: "fail", status: 403, error: "errors.canvas.forbidden" },
    },
    {
      label: "no cookie + invalid token",
      deps: { userId: null, canvas: { exists: true, role: null }, link: {} },
      buildReq: () => reqWithToken("bogus"),
      expected: { kind: "fail", status: 403, error: "errors.canvas.forbidden" },
    },
    {
      label: "canvas missing (cookie path)",
      deps: { userId: "u1", canvas: { exists: false } },
      buildReq: () => req(),
      expected: { kind: "fail", status: 404, error: "errors.canvas.notFound" },
    },
  ];

  for (const c of cases) {
    test(c.label, async () => {
      const result = await authenticateSyncHandshake(c.buildReq(), CANVAS_ID, mockDeps(c.deps));
      if (c.expected.kind === "ok") {
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("unreachable");
        expect(result.role).toBe(c.expected.role);
        expect(result.userId.startsWith("anon:")).toBe(c.expected.anon);
      } else {
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error("unreachable");
        expect(result.status).toBe(c.expected.status);
        expect(result.error).toBe(c.expected.error);
      }
    });
  }
});
