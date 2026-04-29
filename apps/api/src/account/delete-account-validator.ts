/**
 * Delete account validation.
 *
 * Validates that the `confirmEmail` field in the DELETE /api/account body
 * matches the authenticated user's email (case-insensitive).
 */

export type DeleteAccountResult =
  | { valid: true }
  | { valid: false; errorKey: string };

export function validateDeleteAccount(
  body: { confirmEmail?: string },
  userEmail: string,
): DeleteAccountResult {
  if (!body.confirmEmail) {
    return { valid: false, errorKey: "account.errors.confirmEmailMismatch" };
  }

  const normalizedConfirm = body.confirmEmail.toLowerCase().trim();
  const normalizedUser = userEmail.toLowerCase().trim();

  if (normalizedConfirm !== normalizedUser) {
    return { valid: false, errorKey: "account.errors.confirmEmailMismatch" };
  }

  return { valid: true };
}
