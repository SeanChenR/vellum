/**
 * API contract — zod schema boundary tests.
 *
 * Validates that zod schemas correctly reject invalid inputs
 * and accept valid inputs at the edges of their constraints.
 *
 * Spec: "Error envelope 與 errorKey 命名" decisions
 */

import { describe, expect, test } from "bun:test";
import {
  canvasCreateInputSchema,
  canvasUpdateInputSchema,
  folderCreateInputSchema,
  folderUpdateInputSchema,
} from "./api-contract";

// ---------------------------------------------------------------------------
// canvasCreateInputSchema  (title: 1-120, folderId: optional uuid|null)
// ---------------------------------------------------------------------------

describe("canvasCreateInputSchema", () => {
  test("valid title passes", () => {
    const result = canvasCreateInputSchema.safeParse({ title: "My Canvas" });
    expect(result.success).toBe(true);
  });

  test("empty title is rejected", () => {
    const result = canvasCreateInputSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("title over 120 chars is rejected", () => {
    const result = canvasCreateInputSchema.safeParse({
      title: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  test("title exactly 120 chars passes", () => {
    const result = canvasCreateInputSchema.safeParse({
      title: "a".repeat(120),
    });
    expect(result.success).toBe(true);
  });

  test("valid uuid folderId passes", () => {
    const result = canvasCreateInputSchema.safeParse({
      title: "T",
      folderId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  test("folderId null is valid (unfiled canvas)", () => {
    const result = canvasCreateInputSchema.safeParse({
      title: "T",
      folderId: null,
    });
    expect(result.success).toBe(true);
  });

  test("non-uuid folderId is rejected", () => {
    const result = canvasCreateInputSchema.safeParse({
      title: "T",
      folderId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  test("missing folderId is allowed (optional)", () => {
    const result = canvasCreateInputSchema.safeParse({ title: "T" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canvasUpdateInputSchema  (partial — title optional, folderId optional)
// ---------------------------------------------------------------------------

describe("canvasUpdateInputSchema", () => {
  test("empty object is valid (no-op patch)", () => {
    const result = canvasUpdateInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("empty string title is rejected", () => {
    const result = canvasUpdateInputSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("title over 120 chars is rejected", () => {
    const result = canvasUpdateInputSchema.safeParse({
      title: "b".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  test("folderId null clears folder assignment", () => {
    const result = canvasUpdateInputSchema.safeParse({ folderId: null });
    expect(result.success).toBe(true);
  });

  test("non-uuid folderId is rejected", () => {
    const result = canvasUpdateInputSchema.safeParse({
      folderId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// folderCreateInputSchema  (name: 1-80)
// ---------------------------------------------------------------------------

describe("folderCreateInputSchema", () => {
  test("valid name passes", () => {
    const result = folderCreateInputSchema.safeParse({ name: "Sketches" });
    expect(result.success).toBe(true);
  });

  test("empty name is rejected", () => {
    const result = folderCreateInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("name over 80 chars is rejected", () => {
    const result = folderCreateInputSchema.safeParse({
      name: "c".repeat(81),
    });
    expect(result.success).toBe(false);
  });

  test("name exactly 80 chars passes", () => {
    const result = folderCreateInputSchema.safeParse({
      name: "c".repeat(80),
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// folderUpdateInputSchema  (name: 1-80)
// ---------------------------------------------------------------------------

describe("folderUpdateInputSchema", () => {
  test("valid name passes", () => {
    const result = folderUpdateInputSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });

  test("empty name is rejected", () => {
    const result = folderUpdateInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("name over 80 chars is rejected", () => {
    const result = folderUpdateInputSchema.safeParse({
      name: "d".repeat(81),
    });
    expect(result.success).toBe(false);
  });
});
