/**
 * errorKey contract test.
 *
 * Ensures that every error key returned by auth + account endpoints exists
 * in BOTH zh-TW.json AND en.json locale files.
 *
 * This test imports the locale files directly and checks the known set of
 * errorKeys defined in the spec.
 */

import { describe, expect, test } from "bun:test";
import zhTW from "@vellum/shared/locales/zh-TW.json";
import en from "@vellum/shared/locales/en.json";

// ---------------------------------------------------------------------------
// All errorKeys defined in the auth + account spec
// ---------------------------------------------------------------------------

const AUTH_ERROR_KEYS = [
  "auth.errors.invalidEmail",
  "auth.errors.invalidCredentials",
  "auth.errors.magicLinkExpired",
  "auth.errors.googleOauthFailed",
  "auth.errors.emailRateLimited",
  "auth.errors.ipRateLimited",
  "auth.errors.notAuthenticated",
  "auth.errors.sessionRevoked",
  "auth.errors.magicLinkSendFailed",
] as const;

const ACCOUNT_ERROR_KEYS = [
  "account.errors.invalidImageUrl",
  "account.errors.unsupportedLocale",
  "account.errors.confirmEmailMismatch",
  "account.errors.sessionNotFound",
  "account.errors.cannotDeleteOnlyOwner",
] as const;

const ALL_ERROR_KEYS = [...AUTH_ERROR_KEYS, ...ACCOUNT_ERROR_KEYS];

// ---------------------------------------------------------------------------
// Helper: resolve dot-notation key against a JSON object
// ---------------------------------------------------------------------------

function getNestedValue(
  obj: Record<string, unknown>,
  dotPath: string,
): unknown {
  return dotPath
    .split(".")
    .reduce<unknown>((acc, key) => {
      if (acc !== null && typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("errorKey i18n contract", () => {
  for (const key of ALL_ERROR_KEYS) {
    test(`${key} exists in zh-TW.json`, () => {
      const value = getNestedValue(
        zhTW as unknown as Record<string, unknown>,
        key,
      );
      expect(value).not.toBeUndefined();
      expect(typeof value).toBe("string");
    });

    test(`${key} exists in en.json`, () => {
      const value = getNestedValue(
        en as unknown as Record<string, unknown>,
        key,
      );
      expect(value).not.toBeUndefined();
      expect(typeof value).toBe("string");
    });
  }

  test("zh-TW.json and en.json have matching key sets for auth.*", () => {
    const zhAuthErrors = (zhTW as { auth?: { errors?: object } }).auth?.errors;
    const enAuthErrors = (en as { auth?: { errors?: object } }).auth?.errors;
    expect(Object.keys(zhAuthErrors ?? {})).toEqual(
      Object.keys(enAuthErrors ?? {}),
    );
  });

  test("zh-TW.json and en.json have matching key sets for account.*", () => {
    const zhAccountErrors = (zhTW as { account?: { errors?: object } }).account
      ?.errors;
    const enAccountErrors = (en as { account?: { errors?: object } }).account
      ?.errors;
    expect(Object.keys(zhAccountErrors ?? {})).toEqual(
      Object.keys(enAccountErrors ?? {}),
    );
  });
});
