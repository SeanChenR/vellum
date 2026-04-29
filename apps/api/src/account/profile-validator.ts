/**
 * Profile patch validation.
 *
 * Validates the PATCH /api/account/profile request body.
 * Only `name`, `image`, and `locale` are accepted — `email` and `id` are stripped.
 */

import { z } from "zod";

const httpsUrlOrNull = z
  .string()
  .nullable()
  .refine(
    (v) => {
      if (v === null) return true;
      try {
        const url = new URL(v);
        return url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "account.errors.invalidImageUrl" },
  );

const profilePatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  image: httpsUrlOrNull.optional(),
  locale: z
    .string()
    .refine((v) => v === "zh-TW" || v === "en", {
      message: "account.errors.unsupportedLocale",
    })
    .optional(),
});

type ProfilePatchInput = z.input<typeof profilePatchSchema> & {
  [key: string]: unknown;
};

export type ProfilePatchSuccess = {
  success: true;
  data: z.output<typeof profilePatchSchema>;
};

export type ProfilePatchFailure = {
  success: false;
  errorKey: string;
};

export type ProfilePatchResult = ProfilePatchSuccess | ProfilePatchFailure;

/**
 * Validate and strip the profile patch body.
 * Strips `email`, `id`, and any unrecognised keys.
 */
export function validateProfilePatch(
  body: ProfilePatchInput,
): ProfilePatchResult {
  // Strip disallowed fields before parsing
  const { name, image, locale } = body;
  const stripped = {
    ...(name !== undefined ? { name } : {}),
    ...(image !== undefined ? { image } : {}),
    ...(locale !== undefined ? { locale } : {}),
  };

  const result = profilePatchSchema.safeParse(stripped);
  if (!result.success) {
    // Return the first errorKey message
    const firstIssue = result.error.issues[0];
    const errorKey =
      firstIssue?.message ?? "account.errors.invalidInput";
    return { success: false, errorKey };
  }

  return { success: true, data: result.data };
}
