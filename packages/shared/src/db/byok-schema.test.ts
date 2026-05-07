/**
 * BYOK schema unit tests — structural assertions on `api_keys` and
 * `user_ai_preferences` tables.
 *
 * Spec refs:
 *   openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "Persist user default-model preference"
 *
 * The user_ai_preferences table holds one row per user (PK = user_id)
 * carrying their last-selected (provider, model) — read by AI side panel
 * default selection (M14.1) and written by the PATCH preferences endpoint.
 */

import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test } from "bun:test";
import {
  apiKeys,
  userAiPreferences,
  type ApiKey,
  type NewApiKey,
  type UserAiPreference,
  type NewUserAiPreference,
} from "./byok-schema";

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

describe("Schema: user_ai_preferences", () => {
  test("required columns exist (userId, provider, model, updatedAt)", () => {
    const cols = getTableColumns(userAiPreferences);
    expect("userId" in cols).toBe(true);
    expect("provider" in cols).toBe(true);
    expect("model" in cols).toBe(true);
    expect("updatedAt" in cols).toBe(true);
  });

  test("userId is text and notNull (PK is composite, not single-column)", () => {
    const cols = getTableColumns(userAiPreferences);
    const userId = cols["userId"] as { columnType: string; notNull: boolean } | undefined;
    expect(userId?.columnType).toBe("PgText");
    expect(userId?.notNull).toBe(true);
  });

  test("provider is text and notNull", () => {
    const cols = getTableColumns(userAiPreferences);
    const col = cols["provider"] as { columnType: string; notNull: boolean } | undefined;
    expect(col?.columnType).toBe("PgText");
    expect(col?.notNull).toBe(true);
  });

  test("model is text and notNull", () => {
    const cols = getTableColumns(userAiPreferences);
    const col = cols["model"] as { columnType: string; notNull: boolean } | undefined;
    expect(col?.columnType).toBe("PgText");
    expect(col?.notNull).toBe(true);
  });

  test("updatedAt is timestamp, notNull, with a default", () => {
    const cols = getTableColumns(userAiPreferences);
    const col = cols["updatedAt"] as
      | { columnType: string; notNull: boolean; hasDefault: boolean }
      | undefined;
    expect(col?.columnType).toBe("PgTimestamp");
    expect(col?.notNull).toBe(true);
    expect(col?.hasDefault).toBe(true);
  });

  test("primary key is composite (user_id, provider)", () => {
    const cfg = getTableConfig(userAiPreferences);
    expect(cfg.primaryKeys).toHaveLength(1);
    const pk = cfg.primaryKeys[0]!;
    const colNames = pk.columns.map((c) => c.name).sort();
    expect(colNames).toEqual(["provider", "user_id"]);
  });

  test("userId references users.id with ON DELETE CASCADE", () => {
    const cfg = getTableConfig(userAiPreferences);
    const fk = cfg.foreignKeys.find((f) => f.reference().columns.some((c) => c.name === "user_id"));
    expect(fk).toBeDefined();
    const ref = fk!.reference();
    expect(getTableName(ref.foreignTable)).toBe("users");
    expect(ref.foreignColumns.some((c) => c.name === "id")).toBe(true);
    expect(fk!.onDelete).toBe("cascade");
  });

  test("UserAiPreference + NewUserAiPreference types are exported", () => {
    const select: UserAiPreference | undefined = undefined;
    const insert: NewUserAiPreference | undefined = undefined;
    expect(select).toBeUndefined();
    expect(insert).toBeUndefined();
  });
});
