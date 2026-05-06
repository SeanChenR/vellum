/**
 * providers/index.ts — Strategy registry for BYOK validation.
 *
 * M11.1 only registers `anthropic`. M11.2 adds `openai` + `google` by
 * importing sibling adapter factories and adding entries below;
 * `routes.ts` is unchanged.
 *
 * Design ref: openspec/changes/add-byok-anthropic/design.md decision
 * "ProviderAdapter strategy interface; one file per provider".
 */

import { createAnthropicAdapter } from "./anthropic";
import type { ProviderAdapter, ProviderId } from "./types";

const ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com";

export interface ProviderAdaptersOptions {
  /** Inject a fetch implementation; defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Override Anthropic base URL (integration tests point at a stub server). */
  anthropicBaseUrl?: string;
}

/**
 * Build the strategy table. `routes.ts` calls `adapters[provider]` to
 * dispatch; new providers extend `ProviderId` and add an entry here.
 */
export function createProviderAdapters(
  options: ProviderAdaptersOptions = {},
): Record<ProviderId, ProviderAdapter> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const anthropicBaseUrl =
    options.anthropicBaseUrl ?? Bun.env.ANTHROPIC_API_BASE_URL ?? ANTHROPIC_DEFAULT_BASE;

  return {
    anthropic: createAnthropicAdapter(anthropicBaseUrl, fetchImpl),
  };
}

export type { ProviderAdapter, ProviderId, ValidationResult } from "./types";
