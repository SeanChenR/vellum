/**
 * permission-guard.test.ts — unit tests for the write-side AI authorization guard.
 *
 * Covers the full decision matrix from
 * openspec/changes/add-permission-guard/specs/permission-guard/spec.md:
 *
 *   1. session === null                            → 401 errors.auth.unauthorized
 *   2. canvasExists === false                      → 404 errors.canvas.notFound
 *   3. canvasExists === true && role === null      → 403 errors.canvas.forbidden
 *   4. role exists but is not in allowed           → 403 errors.canvas.forbidden
 *   5. role is in allowed                          → { ok: true }
 *
 * Plus decision-precedence: the resolver MUST NOT be called when session
 * is null, even if it would otherwise return canvasExists: false.
 */

import { describe, expect, mock, test } from "bun:test";
import {
  requireRole,
  type CanvasRole,
  type PermissionGuardDeps,
  type RequireRoleResult,
} from "./permission-guard";

const CANVAS_ID = "canvas-1";
const USER_ID = "user-1";

function makeDeps(resolveResult: { canvasExists: boolean; role: CanvasRole | null }): {
  deps: PermissionGuardDeps;
  resolveCanvasRole: ReturnType<typeof mock>;
} {
  const resolveCanvasRole = mock(async () => resolveResult);
  const deps: PermissionGuardDeps = {
    resolveCanvasRole: resolveCanvasRole as unknown as PermissionGuardDeps["resolveCanvasRole"],
  };
  return { deps, resolveCanvasRole };
}

// ---------------------------------------------------------------------------
// Scenario 1.1 — null session → 401, resolver never called
// (spec: Unauthenticated request is rejected before any canvas lookup)
// ---------------------------------------------------------------------------

describe("requireRole — null session (step 1)", () => {
  test("anonymous public-link visitor is rejected with 401 before any canvas lookup", async () => {
    const { deps, resolveCanvasRole } = makeDeps({ canvasExists: true, role: "editor" });

    const result = await requireRole(deps, null, "canvas-public-edit-link", ["owner", "editor"]);

    expect(result).toEqual({
      ok: false,
      status: 401,
      errorKey: "errors.auth.unauthorized",
    } satisfies RequireRoleResult);
    expect(resolveCanvasRole).toHaveBeenCalledTimes(0);
  });

  test("null session returns 401 regardless of allowed list contents", async () => {
    const { deps, resolveCanvasRole } = makeDeps({ canvasExists: true, role: "owner" });

    const result = await requireRole(deps, null, CANVAS_ID, ["owner"]);

    expect(result).toEqual({
      ok: false,
      status: 401,
      errorKey: "errors.auth.unauthorized",
    });
    expect(resolveCanvasRole).toHaveBeenCalledTimes(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 1.2 — authenticated user + canvas does not exist → 404
// (spec: Authenticated request to non-existent canvas returns 404)
// ---------------------------------------------------------------------------

describe("requireRole — non-existent canvas (step 2)", () => {
  test("editor of another canvas asks about an unknown canvas → 404", async () => {
    const { deps, resolveCanvasRole } = makeDeps({ canvasExists: false, role: null });

    const result = await requireRole(deps, { userId: "user-A" }, "canvas-deleted", [
      "owner",
      "editor",
    ]);

    expect(result).toEqual({
      ok: false,
      status: 404,
      errorKey: "errors.canvas.notFound",
    });
    expect(resolveCanvasRole).toHaveBeenCalledTimes(1);
    expect(resolveCanvasRole).toHaveBeenCalledWith("user-A", "canvas-deleted");
  });
});

// ---------------------------------------------------------------------------
// Scenario 1.3 — authenticated user + canvas exists + role === null → 403
// (spec: Authenticated request to existing canvas with no role returns 403)
// ---------------------------------------------------------------------------

describe("requireRole — existing canvas with no role (step 3)", () => {
  test("stranger probes a private canvas → 403", async () => {
    const { deps } = makeDeps({ canvasExists: true, role: null });

    const result = await requireRole(deps, { userId: "user-stranger" }, "canvas-private", [
      "owner",
      "editor",
    ]);

    expect(result).toEqual({
      ok: false,
      status: 403,
      errorKey: "errors.canvas.forbidden",
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 1.4 — role exists but is not in allowed → 403
// (spec example table covers viewer×[owner,editor], editor×[owner], anon×[owner,editor])
// ---------------------------------------------------------------------------

describe("requireRole — role not in allowed list (step 4)", () => {
  const cases: ReadonlyArray<{ role: CanvasRole; allowed: ReadonlyArray<CanvasRole> }> = [
    { role: "viewer", allowed: ["owner", "editor"] },
    { role: "editor", allowed: ["owner"] },
    { role: "anon", allowed: ["owner", "editor"] },
  ];

  for (const { role, allowed } of cases) {
    test(`role=${role}, allowed=[${allowed.join(",")}] → 403 forbidden`, async () => {
      const { deps } = makeDeps({ canvasExists: true, role });

      const result = await requireRole(deps, { userId: USER_ID }, CANVAS_ID, allowed);

      expect(result).toEqual({
        ok: false,
        status: 403,
        errorKey: "errors.canvas.forbidden",
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Scenario 1.5 — role is in allowed → { ok: true }
// (spec example table covers owner×[owner,editor], editor×[owner,editor], owner×[owner])
// ---------------------------------------------------------------------------

describe("requireRole — role in allowed list (step 5)", () => {
  const cases: ReadonlyArray<{ role: CanvasRole; allowed: ReadonlyArray<CanvasRole> }> = [
    { role: "owner", allowed: ["owner", "editor"] },
    { role: "editor", allowed: ["owner", "editor"] },
    { role: "owner", allowed: ["owner"] },
  ];

  for (const { role, allowed } of cases) {
    test(`role=${role}, allowed=[${allowed.join(",")}] → ok: true`, async () => {
      const { deps } = makeDeps({ canvasExists: true, role });

      const result = await requireRole(deps, { userId: USER_ID }, CANVAS_ID, allowed);

      expect(result).toEqual({ ok: true });
    });
  }
});

// ---------------------------------------------------------------------------
// Scenario 1.6 — decision precedence: null-session before canvas-existence before role
// (spec: Decision precedence is null-session before canvas-existence before role)
// ---------------------------------------------------------------------------

describe("requireRole — decision precedence", () => {
  test("session=null wins even when resolver would return canvasExists: false", async () => {
    const { deps, resolveCanvasRole } = makeDeps({ canvasExists: false, role: null });

    const result = await requireRole(deps, null, CANVAS_ID, ["owner", "editor"]);

    expect(result).toEqual({
      ok: false,
      status: 401,
      errorKey: "errors.auth.unauthorized",
    });
    expect(resolveCanvasRole).toHaveBeenCalledTimes(0);
  });
});
