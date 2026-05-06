/**
 * BYOK schema unit tests — structural assertions on the `api_keys` table.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 * "api_keys schema uses `text` user_id (not uuid) to align with
 * better-auth".
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { apiKeys, type ApiKey, type NewApiKey } from "./byok-schema";

describe("Schema: api_keys", () => {
  test("required columns exist (userId, provider, encryptedKey, createdAt, lastUsedAt)", () => {
    const cols = getTableColumns(apiKeys);
    expect("userId" in cols).toBe(true);
    expect("provider" in cols).toBe(true);
    expect("encryptedKey" in cols).toBe(true);
    expect("createdAt" in cols).toBe(true);
    expect("lastUsedAt" in cols).toBe(true);
  });

  test("userId is text (aligns with better-auth users.id) and notNull", () => {
    const cols = getTableColumns(apiKeys);
    const userId = cols["userId"] as { columnType: string; notNull: boolean } | undefined;
    expect(userId?.columnType).toBe("PgText");
    expect(userId?.notNull).toBe(true);
  });

  test("provider is text and notNull", () => {
    const cols = getTableColumns(apiKeys);
    const provider = cols["provider"] as { columnType: string; notNull: boolean } | undefined;
    expect(provider?.columnType).toBe("PgText");
    expect(provider?.notNull).toBe(true);
  });

  test("encryptedKey is text and notNull", () => {
    const cols = getTableColumns(apiKeys);
    const encryptedKey = cols["encryptedKey"] as
      | { columnType: string; notNull: boolean }
      | undefined;
    expect(encryptedKey?.columnType).toBe("PgText");
    expect(encryptedKey?.notNull).toBe(true);
  });

  test("lastUsedAt is nullable (reserved for agent runtime, M11.1 never writes)", () => {
    const cols = getTableColumns(apiKeys);
    const lastUsedAt = cols["lastUsedAt"] as { notNull: boolean } | undefined;
    expect(lastUsedAt?.notNull).toBe(false);
  });

  test("ApiKey + NewApiKey types are exported", () => {
    // Compile-time presence; runtime check is a no-op tautology that
    // proves the type aliases compile (test would fail to compile if
    // exports went missing).
    const select: ApiKey | undefined = undefined;
    const insert: NewApiKey | undefined = undefined;
    expect(select).toBeUndefined();
    expect(insert).toBeUndefined();
  });
});
