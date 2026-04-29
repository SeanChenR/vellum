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
import { folders, canvases } from "./schema";

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
