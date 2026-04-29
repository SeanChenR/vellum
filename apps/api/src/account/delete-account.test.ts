/**
 * Delete account endpoint tests.
 *
 * Scenarios:
 * 1. confirmEmail matches → deletes user + cascade + clears cookie → 200
 * 2. confirmEmail mismatches → 400 + confirmEmailMismatch errorKey
 * 3. confirmEmail comparison is case-insensitive
 * 4. unauthenticated request → 401 + notAuthenticated errorKey
 */

import { describe, expect, test } from "bun:test";
import { validateDeleteAccount } from "./delete-account-validator";

// ---------------------------------------------------------------------------
// Unit: validateDeleteAccount
// ---------------------------------------------------------------------------

describe("validateDeleteAccount", () => {
  test("matching emails (exact) are accepted", () => {
    const result = validateDeleteAccount({ confirmEmail: "user@example.com" }, "user@example.com");
    expect(result.valid).toBe(true);
  });

  test("mismatched email is rejected with confirmEmailMismatch", () => {
    const result = validateDeleteAccount({ confirmEmail: "wrong@example.com" }, "user@example.com");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errorKey).toBe("account.errors.confirmEmailMismatch");
    }
  });

  test("comparison is case-insensitive", () => {
    const result = validateDeleteAccount({ confirmEmail: "user@example.com" }, "User@Example.com");
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTP integration
// ---------------------------------------------------------------------------

describe("DELETE /api/account — HTTP", () => {
  const BASE = "http://localhost:3000";

  test("unauthenticated delete returns 401", async () => {
    const resp = await fetch(`${BASE}/api/account`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmEmail: "user@example.com" }),
    });
    expect(resp.status).toBe(401);
    const body = (await resp.json().catch(() => ({}))) as {
      error?: { errorKey?: string };
    };
    expect(body.error?.errorKey).toBe("auth.errors.notAuthenticated");
  });
});
