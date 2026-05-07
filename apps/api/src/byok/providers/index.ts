/**
 * providers/index.ts — Strategy registry for BYOK validation.
 *
 * Three adapters: anthropic / openai / google. The return type
 * `Record<ProviderId, ProviderAdapter>` is exhaustive — adding a fourth
 * provider id to the union forces this file to register an adapter for
 * it (compile error otherwise).
 *
 * Design ref: openspec/changes/add-byok-multi-provider-and-pricing/design.md
 *   "ProviderId becomes a 3-element union, exhaustiveness via
 *   Record<ProviderId, ProviderAdapter>".
 */

import { createAnthropicAdapter } from "./anthropic";
import { createGoogleAdapter } from "./google";
import { createOpenAIAdapter } from "./openai";
import type { ProviderAdapter, ProviderId } from "./types";

const ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com";
const OPENAI_DEFAULT_BASE = "https://api.openai.com";
const GOOGLE_DEFAULT_BASE = "https://generativelanguage.googleapis.com";

export interface ProviderAdaptersOptions {
  /** Inject a fetch implementation; defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override Anthropic base URL (integration tests point at a stub server). */
  anthropicBaseUrl?: string;
  /** Override OpenAI base URL. */
  openaiBaseUrl?: string;
  /** Override Google base URL. */
  googleBaseUrl?: string;
}

/**
 * Build the strategy table. `routes.ts` calls `adapters[provider]` to
 * dispatch; the union literal type guarantees exhaustiveness.
 */
export function createProviderAdapters(
  options: ProviderAdaptersOptions = {},
): Record<ProviderId, ProviderAdapter> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const anthropicBaseUrl =
    options.anthropicBaseUrl ?? Bun.env.ANTHROPIC_API_BASE_URL ?? ANTHROPIC_DEFAULT_BASE;
  const openaiBaseUrl = options.openaiBaseUrl ?? Bun.env.OPENAI_API_BASE_URL ?? OPENAI_DEFAULT_BASE;
  const googleBaseUrl = options.googleBaseUrl ?? Bun.env.GOOGLE_API_BASE_URL ?? GOOGLE_DEFAULT_BASE;

  return {
    anthropic: createAnthropicAdapter(anthropicBaseUrl, fetchImpl),
    openai: createOpenAIAdapter(openaiBaseUrl, fetchImpl),
    google: createGoogleAdapter(googleBaseUrl, fetchImpl),
  };
}

export type { ProviderAdapter, ProviderId, ValidationResult } from "./types";
