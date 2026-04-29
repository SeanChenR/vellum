/**
 * Account profile endpoint tests.
 *
 * Scenarios:
 * 1. valid name update succeeds
 * 2. non-https image URL is rejected
 * 3. locale change is persisted
 * 4. unsupported locale is rejected
 * 5. email field cannot be patched
 */

import { describe, expect, test } from "bun:test";
import { validateProfilePatch } from "./profile-validator";

// ---------------------------------------------------------------------------
// Unit-test the validation logic in isolation
// ---------------------------------------------------------------------------

describe("validateProfilePatch", () => {
  test("valid name (1-80 chars) passes", () => {
    const result = validateProfilePatch({ name: "Alice" });
    expect(result.success).toBe(true);
  });

  test("empty name is rejected", () => {
    const result = validateProfilePatch({ name: "" });
    expect(result.success).toBe(false);
  });

  test("name over 80 chars is rejected", () => {
    const result = validateProfilePatch({ name: "a".repeat(81) });
    expect(result.success).toBe(false);
  });

  test("https image URL is accepted", () => {
    const result = validateProfilePatch({
      image: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  test("http (non-https) image URL is rejected with invalidImageUrl", () => {
    const result = validateProfilePatch({
      image: "http://example.com/avatar.png",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorKey).toBe("account.errors.invalidImageUrl");
    }
  });

  test("relative image URL is rejected with invalidImageUrl", () => {
    const result = validateProfilePatch({ image: "/relative.png" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorKey).toBe("account.errors.invalidImageUrl");
    }
  });

  test("null image is accepted (clear avatar)", () => {
    const result = validateProfilePatch({ image: null });
    expect(result.success).toBe(true);
  });

  test("supported locale zh-TW is accepted", () => {
    const result = validateProfilePatch({ locale: "zh-TW" });
    expect(result.success).toBe(true);
  });

  test("supported locale en is accepted", () => {
    const result = validateProfilePatch({ locale: "en" });
    expect(result.success).toBe(true);
  });

  test("unsupported locale ja is rejected with unsupportedLocale", () => {
    const result = validateProfilePatch({ locale: "ja" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorKey).toBe("account.errors.unsupportedLocale");
    }
  });

  test("email field in patch body is ignored (not passed through)", () => {
    const result = validateProfilePatch({
      email: "evil@example.com",
      name: "Bob",
    } as Parameters<typeof validateProfilePatch>[0]);
    // Email key is stripped — success is true for valid name
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("email");
    }
  });
});
