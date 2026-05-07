/**
 * byok-validator.ts — Zod schemas for the BYOK REST surface.
 *
 * Spec ref: openspec/changes/add-byok-multi-provider-and-pricing/specs/byok-keys/spec.md
 *
 * `apiKey` length bounds (8 ≤ len ≤ 512) are conservative: real
 * provider keys are well within this range, but the cap defends the
 * encryption + DB + log paths from pathologically long inputs.
 *
 * `provider` is the 3-element union `'anthropic' | 'openai' | 'google'`
 * — kept aligned with `ProviderId` in
 * `@vellum/shared/byok-pricing`.
 */

import { z } from "zod";

export const byokSaveBodySchema = z.object({
  apiKey: z.string().min(8).max(512),
});

export type BYOKSaveBody = z.infer<typeof byokSaveBodySchema>;

export const byokProviderParamSchema = z.enum(["anthropic", "openai", "google"]);

export type BYOKProviderParam = z.infer<typeof byokProviderParamSchema>;
