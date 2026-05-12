/**
 * Schema unit tests.
 *
 * Validates structural constraints on the Drizzle schema that enforce
 * the 1-level folder depth rule (Folder schema enforces 1-level depth spec).
 *
 * These tests verify:
 * - folders table has no parentId column (flat, not nested)
 * - canvases.folderId is nullable (ON DELETE SET NULL is safe)
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "bun:test";
import { folders, canvases, aiThreads, aiMessages } from "./schema";

describe("Schema: folders table (1-level depth)", () => {
  test("folders has no parentId column", () => {
    const cols = getTableColumns(folders);
    expect("parentId" in cols).toBe(false);
  });

  test("folders has no parent_id column (cased check)", () => {
    // Drizzle uses camelCase keys even with snake_case casing config
    const cols = getTableColumns(folders);
    expect("parent_id" in cols).toBe(false);
  });

  test("folders has required columns: id, ownerId, name, createdAt, updatedAt", () => {
    const cols = getTableColumns(folders);
    expect("id" in cols).toBe(true);
    expect("ownerId" in cols).toBe(true);
    expect("name" in cols).toBe(true);
    expect("createdAt" in cols).toBe(true);
    expect("updatedAt" in cols).toBe(true);
  });
});

describe("Schema: canvases.folderId nullable (SET NULL guard)", () => {
  test("canvases.folderId is nullable (allows NULL)", () => {
    const cols = getTableColumns(canvases);
    const folderIdCol = cols["folderId"] as { notNull: boolean } | undefined;
    // Nullable column: notNull should be false
    expect(folderIdCol?.notNull ?? false).toBe(false);
  });

  test("canvases has required columns including snapshot jsonb", () => {
    const cols = getTableColumns(canvases);
    expect("id" in cols).toBe(true);
    expect("ownerId" in cols).toBe(true);
    expect("folderId" in cols).toBe(true);
    expect("title" in cols).toBe(true);
    expect("snapshot" in cols).toBe(true);
    expect("createdAt" in cols).toBe(true);
    expect("updatedAt" in cols).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M14 — ai_threads / ai_messages (Threads are persisted per user and canvas /
// Thread messages are persisted in chronological order)
// ---------------------------------------------------------------------------

describe("Schema: ai_threads (multi-thread per user-canvas)", () => {
  test("ai_threads has required columns: id, userId, canvasId, title, createdAt, updatedAt", () => {
    const cols = getTableColumns(aiThreads);
    expect("id" in cols).toBe(true);
    expect("userId" in cols).toBe(true);
    expect("canvasId" in cols).toBe(true);
    expect("title" in cols).toBe(true);
    expect("createdAt" in cols).toBe(true);
    expect("updatedAt" in cols).toBe(true);
  });

  test("ai_threads.title is non-null with default empty string", () => {
    const cols = getTableColumns(aiThreads);
    const titleCol = cols["title"] as { notNull: boolean; hasDefault: boolean } | undefined;
    expect(titleCol?.notNull).toBe(true);
    expect(titleCol?.hasDefault).toBe(true);
  });

  test("ai_threads.userId references users.id", () => {
    // Cascade delete is asserted via the migration SQL review (1.3); here we
    // ensure the column exists and is required.
    const cols = getTableColumns(aiThreads);
    const userIdCol = cols["userId"] as { notNull: boolean } | undefined;
    expect(userIdCol?.notNull).toBe(true);
  });

  test("ai_threads.canvasId is required (cascade FK enforced in migration)", () => {
    const cols = getTableColumns(aiThreads);
    const canvasIdCol = cols["canvasId"] as { notNull: boolean } | undefined;
    expect(canvasIdCol?.notNull).toBe(true);
  });
});

describe("Schema: ai_messages (chronological, role enum)", () => {
  test("ai_messages has required columns + nullable extras", () => {
    const cols = getTableColumns(aiMessages);
    // required
    expect("id" in cols).toBe(true);
    expect("threadId" in cols).toBe(true);
    expect("role" in cols).toBe(true);
    expect("content" in cols).toBe(true);
    expect("createdAt" in cols).toBe(true);
    // nullable
    expect("toolName" in cols).toBe(true);
    expect("toolCallId" in cols).toBe(true);
    expect("tokenUsage" in cols).toBe(true);
    expect("provider" in cols).toBe(true);
    expect("model" in cols).toBe(true);
    expect("runId" in cols).toBe(true);
  });

  test("ai_messages.role enum is exactly user/assistant/tool", () => {
    const cols = getTableColumns(aiMessages);
    const roleCol = cols["role"] as { enumValues?: readonly string[] } | undefined;
    expect(roleCol?.enumValues).toEqual(["user", "assistant", "tool"]);
  });

  test("ai_messages.tokenUsage is nullable jsonb (only assistant rows populate)", () => {
    const cols = getTableColumns(aiMessages);
    const usageCol = cols["tokenUsage"] as { notNull: boolean } | undefined;
    expect(usageCol?.notNull ?? false).toBe(false);
  });

  test("ai_messages.toolName / toolCallId nullable (only role=tool rows populate)", () => {
    const cols = getTableColumns(aiMessages);
    const toolNameCol = cols["toolName"] as { notNull: boolean } | undefined;
    const toolCallIdCol = cols["toolCallId"] as { notNull: boolean } | undefined;
    expect(toolNameCol?.notNull ?? false).toBe(false);
    expect(toolCallIdCol?.notNull ?? false).toBe(false);
  });
});
