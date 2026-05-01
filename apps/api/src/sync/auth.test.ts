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
  };
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
