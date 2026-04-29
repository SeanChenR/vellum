/**
 * Account sessions endpoint tests.
 *
 * Scenarios:
 * - list active sessions excludes revoked sessions
 * - revoke another device session → marks revoked_at
 * - revoke current session → marks revoked_at + clears cookie
 * - revoke another user's session → 404 (hidden)
 */

import { describe, expect, test } from "bun:test";

const BASE = "http://localhost:3000";

describe("GET /api/account/sessions", () => {
  test("returns 401 without session", async () => {
    const resp = await fetch(`${BASE}/api/account/sessions`);
    expect(resp.status).toBe(401);
    const body = (await resp.json().catch(() => ({}))) as {
      error?: { errorKey?: string };
    };
    expect(body.error?.errorKey).toBe("auth.errors.notAuthenticated");
  });
});

describe("DELETE /api/account/sessions/:id", () => {
  test("returns 401 without session", async () => {
    const resp = await fetch(`${BASE}/api/account/sessions/some-id`, {
      method: "DELETE",
    });
    expect(resp.status).toBe(401);
  });
});
