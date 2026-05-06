/**
 * byok-validator.ts — Zod schemas for the BYOK REST surface.
 *
 * Spec ref: openspec/changes/add-byok-anthropic/specs/byok-keys/spec.md
 *
 * `apiKey` length bounds (8 ≤ len ≤ 512) are conservative: real
 * provider keys are well within this range, but the cap defends the
 * encryption + DB + log paths from pathologically long inputs.
 *
 * `provider` is constrained to `'anthropic'` in M11.1; M11.2 will
 * extend the literal union to add `'openai' | 'google'`.
 */

import { z } from "zod";

export const byokSaveBodySchema = z.object({
  apiKey: z.string().min(8).max(512),
});

export type BYOKSaveBody = z.infer<typeof byokSaveBodySchema>;

export const byokProviderParamSchema = z.enum(["anthropic"]);

export type BYOKProviderParam = z.infer<typeof byokProviderParamSchema>;
