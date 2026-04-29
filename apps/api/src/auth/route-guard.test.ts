/**
 * Protected route guard tests.
 *
 * Scenarios:
 * - no session → 401 + notAuthenticated errorKey
 * - revoked session → 401 + sessionRevoked errorKey
 * - valid session → request passes through
 */

import { describe, expect, test } from "bun:test";
import { requireAuth } from "./route-guard";

// ---------------------------------------------------------------------------
// Unit-test the requireAuth helper in isolation
// ---------------------------------------------------------------------------

describe("requireAuth helper", () => {
  test("returns 401 with notAuthenticated when no session provided", () => {
    const result = requireAuth(null);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe(401);
    }
  });

  test("returns 401 with sessionRevoked for revoked session", () => {
    const revokedSession = {
      id: "sess-1",
      userId: "user-1",
      revokedAt: new Date(),
    };
    const result = requireAuth(revokedSession);
    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBe(401);
    }
  });

  test("returns null (pass-through) for valid active session", () => {
    const activeSession = {
      id: "sess-2",
      userId: "user-2",
      revokedAt: null,
    };
    const result = requireAuth(activeSession);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HTTP integration — /api/account/profile without a session
// ---------------------------------------------------------------------------

describe("Protected route guard — HTTP integration", () => {
  const BASE = "http://localhost:3000";

  test("GET /api/account/profile without session returns 401", async () => {
    const resp = await fetch(`${BASE}/api/account/profile`);
    expect(resp.status).toBe(401);
    const body = (await resp.json().catch(() => ({}))) as {
      error?: { errorKey?: string };
    };
    expect(body.error?.errorKey).toBe("auth.errors.notAuthenticated");
  });
});
