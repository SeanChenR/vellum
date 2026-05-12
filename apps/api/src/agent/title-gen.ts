/**
 * title-gen.ts — Background AI thread title generation.
 *
 * Triggered after the first agent run for a thread reaches `done` (and only
 * if the thread title still equals the fallback computed at thread creation).
 * The task is fire-and-forget — it MUST NOT block the SSE done event, MUST
 * NOT consume the AGENT_RUN_RULE rate-limit budget, and MUST log Pino
 * warnings on failure rather than surface them to the client.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *   - "Background title generation after first run"
 *   openspec/changes/add-ai-side-panel-and-threads/specs/agent-runtime/spec.md
 *   - "First-run completion triggers background title generation"
 */

import type { Logger } from "pino";
import type { Vault } from "../byok/vault";
import type { ThreadRepo } from "./threads/repo";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TitleGenProvider = "openai" | "anthropic" | "google";

/**
 * Provider → economy-tier model used for title summarization.
 *
 * Adding a new provider requires extending this map AND the BYOK pricing
 * table (packages/shared/src/byok-pricing.ts) so cost calculations remain
 * coherent. The runtime route enforces the provider type so unknown
 * providers never reach this map.
 */
export const PROVIDER_TITLE_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-2.5-flash-lite",
} as const satisfies Record<TitleGenProvider, string>;

export interface CallLlmInput {
  provider: TitleGenProvider;
  model: string;
  apiKey: string;
  prompt: string;
}

/**
 * Dependencies. Notably absent: `RateLimiter`. Title generation is a
 * server-initiated background task and SHALL NOT consume the per-user
 * AGENT_RUN_RULE bucket. The omission here is intentional — see spec
 * "First-run completion triggers background title generation".
 */
export interface TitleGenDeps {
  repo: ThreadRepo;
  vault: Vault;
  /** Returns the user's encrypted BYOK blob for the given provider, or null. */
  fetchEncryptedKey(userId: string, provider: string): Promise<string | null>;
  /** LLM single-turn summarization call. Returns the raw model output string. */
  callLlm(input: CallLlmInput): Promise<string>;
  logger: Pick<Logger, "warn" | "info" | "error" | "debug">;
}

export interface GenerateTitleArgs {
  threadId: string;
  userId: string;
  provider: TitleGenProvider;
  firstUserMessage: string;
}

// ---------------------------------------------------------------------------
// Fallback title (deterministic, no LLM)
// ---------------------------------------------------------------------------

const FALLBACK_MAX_LEN = 30;

/**
 * 30-char fallback title from the first user message. Empty input → empty
 * string. Strings ≤30 chars are returned trimmed without ellipsis. Longer
 * strings are cut at a word boundary at or before 30 chars; an ellipsis
 * (`…`) is appended.
 */
export function buildFallbackTitle(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length <= FALLBACK_MAX_LEN) return trimmed;

  // Find last whitespace at or before FALLBACK_MAX_LEN.
  const head = trimmed.slice(0, FALLBACK_MAX_LEN);
  const lastSpace = head.lastIndexOf(" ");
  const cut = lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${cut}…`;
}

// ---------------------------------------------------------------------------
// Background title generation
// ---------------------------------------------------------------------------

const TITLE_PROMPT_PREFIX = "Summarize this user request in 5-10 words, no quotes, no period: ";

/**
 * Trim trailing/leading whitespace, surrounding quotes, and trailing
 * punctuation that small models sometimes append despite the prompt
 * (period, exclamation, question mark).
 */
function cleanLlmTitle(raw: string): string {
  let s = raw.trim();
  // Strip outer matching quotes (single or double, possibly nested once).
  for (let i = 0; i < 2; i++) {
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith("「") && s.endsWith("」")) ||
      (s.startsWith("“") && s.endsWith("”"))
    ) {
      s = s.slice(1, -1).trim();
    } else {
      break;
    }
  }
  // Strip trailing terminal punctuation.
  s = s.replace(/[.!?。！？]+$/u, "").trim();
  return s;
}

export async function generateTitleInBackground(
  deps: TitleGenDeps,
  args: GenerateTitleArgs,
): Promise<void> {
  const { repo, vault, fetchEncryptedKey, callLlm, logger } = deps;
  const { threadId, userId, provider, firstUserMessage } = args;

  try {
    // Resolve BYOK key. Missing = silent fallback (most common cause: user
    // revoked the key between run start and our background run).
    const encrypted = await fetchEncryptedKey(userId, provider);
    if (!encrypted) {
      logger.warn(
        { event: "ai_title_gen_failed", reason: "byok_missing", threadId, provider },
        "title generation skipped: BYOK key missing",
      );
      return;
    }

    const apiKey = vault.decryptApiKey(encrypted);
    const model = PROVIDER_TITLE_MODELS[provider];

    const raw = await callLlm({
      provider,
      model,
      apiKey,
      prompt: `${TITLE_PROMPT_PREFIX}${firstUserMessage}`,
    });

    const cleaned = cleanLlmTitle(raw);
    if (cleaned.length === 0) {
      logger.warn(
        { event: "ai_title_gen_failed", reason: "empty_response", threadId, provider },
        "title generation skipped: model returned empty string",
      );
      return;
    }

    await repo.setTitle(threadId, cleaned);
  } catch (err) {
    // Silent failure path. Pino structured warning, no SSE leak, no retry.
    logger.warn(
      {
        event: "ai_title_gen_failed",
        reason: "exception",
        threadId,
        provider,
        err: err instanceof Error ? err.message : String(err),
      },
      "title generation failed; thread will retain fallback title",
    );
  }
}
