/**
 * Locale parity tests.
 *
 * Verifies that zh-TW.json and en.json have identical key sets —
 * prevents single-language drift where one locale has keys the other lacks.
 *
 * Also verifies that the required dashboard/canvas/folder/error keys
 * introduced by add-canvas-folder-crud exist in both files.
 *
 * Spec: "Localized strings synchronized across zh-TW and en"
 *       "Localized strings for folder UI synchronized across zh-TW and en"
 */

import { describe, expect, test } from "bun:test";
import zhTW from "./zh-TW.json";
import en from "./en.json";

// ---------------------------------------------------------------------------
// Helper — get all leaf key paths from a nested object
// ---------------------------------------------------------------------------

function getLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...getLeafKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Parity test — same key sets
// ---------------------------------------------------------------------------

describe("Locale key parity (zh-TW ↔ en)", () => {
  const zhKeys = new Set(getLeafKeys(zhTW as unknown as Record<string, unknown>));
  const enKeys = new Set(getLeafKeys(en as unknown as Record<string, unknown>));

  test("zh-TW has no extra keys missing from en", () => {
    const onlyInZh = [...zhKeys].filter((k) => !enKeys.has(k));
    expect(onlyInZh).toEqual([]);
  });

  test("en has no extra keys missing from zh-TW", () => {
    const onlyInEn = [...enKeys].filter((k) => !zhKeys.has(k));
    expect(onlyInEn).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Required dashboard canvas keys
// ---------------------------------------------------------------------------

describe("Dashboard canvas heading keys", () => {
  const requiredKeys = [
    "dashboard.myCanvases",
    "dashboard.sharedWithMe",
    "dashboard.createCanvas",
    "dashboard.empty.owned",
    "dashboard.empty.shared",
    "canvas.card.lastEdited",
    "canvas.card.menu.rename",
    "canvas.card.menu.move",
    "canvas.card.menu.delete",
    "canvas.dialog.create.title",
    "canvas.dialog.rename.title",
    "canvas.dialog.delete.title",
    "canvas.dialog.delete.confirm",
  ];

  for (const key of requiredKeys) {
    test(`zh-TW has key: ${key}`, () => {
      const zhKeys = new Set(getLeafKeys(zhTW as unknown as Record<string, unknown>));
      expect(zhKeys.has(key)).toBe(true);
    });

    test(`en has key: ${key}`, () => {
      const enKeys = new Set(getLeafKeys(en as unknown as Record<string, unknown>));
      expect(enKeys.has(key)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Required canvas error keys
// ---------------------------------------------------------------------------

describe("Canvas error keys", () => {
  const errorKeys = [
    "errors.canvas.notFound",
    "errors.canvas.forbidden",
    "errors.auth.unauthorized",
    "errors.validation",
    "errors.rateLimit",
    "errors.internal",
  ];

  for (const key of errorKeys) {
    test(`zh-TW has key: ${key}`, () => {
      const zhKeys = new Set(getLeafKeys(zhTW as unknown as Record<string, unknown>));
      expect(zhKeys.has(key)).toBe(true);
    });

    test(`en has key: ${key}`, () => {
      const enKeys = new Set(getLeafKeys(en as unknown as Record<string, unknown>));
      expect(enKeys.has(key)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Required folder UI keys
// ---------------------------------------------------------------------------

describe("Folder UI keys", () => {
  const folderKeys = [
    "folder.allCanvases",
    "folder.unfiled",
    "folder.create",
    "folder.rename",
    "folder.delete",
    "folder.deleteConfirm",
    "errors.folder.notFound",
    "errors.folder.forbidden",
    "errors.folder.notEmpty",
  ];

  for (const key of folderKeys) {
    test(`zh-TW has key: ${key}`, () => {
      const zhKeys = new Set(getLeafKeys(zhTW as unknown as Record<string, unknown>));
      expect(zhKeys.has(key)).toBe(true);
    });

    test(`en has key: ${key}`, () => {
      const enKeys = new Set(getLeafKeys(en as unknown as Record<string, unknown>));
      expect(enKeys.has(key)).toBe(true);
    });
  }
});
