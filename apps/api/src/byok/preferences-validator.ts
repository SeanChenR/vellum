/**
 * preferences-validator.ts — Zod schema for PATCH /api/account/byok/preferences.
 *
 * Validates body against the BYOK pricing catalog: provider must be in
 * the supported 3-element union, model must exist in the catalog. The
 * schema does NOT enforce that the model's catalog entry matches the
 * supplied provider — the pricing catalog is the authority on (provider,
 * tier, model) tuples; the request only needs the (provider, model) to
 * be a known and supported pair.
 *
 * Spec ref:
 *   openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *     "PATCH preferences endpoint validates against pricing catalog"
 */

import { isKnownModel } from "@vellum/shared/byok-pricing";
import { z } from "zod";

export const byokPreferencesBodySchema = z.object({
  provider: z.enum(["anthropic", "openai", "google"]),
  model: z.string().refine(isKnownModel, {
    message: "errors.byok.invalidPreference",
  }),
});

export type BYOKPreferencesBody = z.infer<typeof byokPreferencesBodySchema>;
