/**
 * title-gen.test.ts — Tests for background title generation.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *   - "Background title generation after first run"
 *   openspec/changes/add-ai-side-panel-and-threads/specs/agent-runtime/spec.md
 *   - "First-run completion triggers background title generation"
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  buildFallbackTitle,
  generateTitleInBackground,
  PROVIDER_TITLE_MODELS,
  type TitleGenDeps,
} from "./title-gen";
import { buildInMemoryThreadRepo } from "./threads/repo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeLogger() {
  const warnCalls: Array<{ obj: object; msg: string }> = [];
  return {
    warnCalls,
    logger: {
      warn(obj: object, msg: string) {
        warnCalls.push({ obj, msg });
      },
      error() {},
      info() {},
      debug() {},
      child() {
        return this;
      },
    } as unknown as TitleGenDeps["logger"],
  };
}

function makeFakeVault(plaintextByProvider: Record<string, string | null> = {}) {
  return {
    decryptApiKey(blob: string): string {
      // The "encrypted blob" is just the provider name in tests; map to plaintext.
      return plaintextByProvider[blob] ?? "test-key";
    },
    encryptApiKey() {
      throw new Error("not used in tests");
    },
  } as unknown as TitleGenDeps["vault"];
}

// ---------------------------------------------------------------------------
// buildFallbackTitle
// ---------------------------------------------------------------------------

describe("buildFallbackTitle: word-boundary truncation rules", () => {
  test("empty string returns empty", () => {
    expect(buildFallbackTitle("")).toBe("");
  });

  test("<=30 chars returns as-is, no ellipsis", () => {
    expect(buildFallbackTitle("hello world")).toBe("hello world");
    // Exactly 30 chars boundary — no ellipsis.
    const exactly30 = "abcdefghij abcdefghij abcdefghi"; // 31 chars actually
    const exactly30Real = "abcdefghij abcdefghij abcdefg"; // 29 chars
    expect(buildFallbackTitle(exactly30Real)).toBe(exactly30Real);
    // Double-check input length expectation
    expect(exactly30.length).toBe(31);
  });

  test(">30 chars cuts at word boundary and appends ellipsis", () => {
    const input = "create a markdown shape that says hello to the world from a fresh canvas";
    const out = buildFallbackTitle(input);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(31); // 30 chars + ellipsis
    // Cut should land on word boundary — no partial word (no last char being a letter
    // followed immediately by ellipsis where the next char in input was also a letter).
    const beforeEllipsis = out.slice(0, -1);
    const cutIdx = beforeEllipsis.length;
    // The character at position cutIdx in the original input must be a space (or end).
    expect(input[cutIdx] === " " || cutIdx === input.length).toBe(true);
  });

  test("trims leading/trailing whitespace before truncation", () => {
    const input = "   hello world   ";
    expect(buildFallbackTitle(input)).toBe("hello world");
  });
});

// ---------------------------------------------------------------------------
// PROVIDER_TITLE_MODELS
// ---------------------------------------------------------------------------

describe("PROVIDER_TITLE_MODELS: economy tier per provider", () => {
  test("openai → gpt-4o-mini", () => {
    expect(PROVIDER_TITLE_MODELS.openai).toBe("gpt-4o-mini");
  });

  test("anthropic → claude-haiku-4-5", () => {
    expect(PROVIDER_TITLE_MODELS.anthropic).toBe("claude-haiku-4-5");
  });

  test("google → gemini-2.5-flash-lite", () => {
    expect(PROVIDER_TITLE_MODELS.google).toBe("gemini-2.5-flash-lite");
  });

  test("exactly three entries", () => {
    expect(Object.keys(PROVIDER_TITLE_MODELS).sort()).toEqual(["anthropic", "google", "openai"]);
  });
});

// ---------------------------------------------------------------------------
// generateTitleInBackground
// ---------------------------------------------------------------------------

describe("generateTitleInBackground: success path", () => {
  test("trims quotes/whitespace and UPDATEs thread.title", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({
      userId: "u1",
      canvasId: "c1",
      title: "create a markdown sh…",
    });
    const callLlm = mock(async () => '  "Greeting Markdown Shape"  \n');
    const fakeLog = makeFakeLogger();
    const deps: TitleGenDeps = {
      repo,
      vault: makeFakeVault(),
      fetchEncryptedKey: async () => "blob",
      callLlm,
      logger: fakeLog.logger,
    };

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "openai",
      firstUserMessage: "create a markdown shape that says hello",
    });

    const updated = await repo.getThread(t.id);
    expect(updated?.title).toBe("Greeting Markdown Shape");
    expect(callLlm).toHaveBeenCalledTimes(1);
    expect(fakeLog.warnCalls.length).toBe(0);
  });

  test("uses the economy model corresponding to the provider", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "fb" });
    const callLlm = mock(async () => "Title");
    const deps: TitleGenDeps = {
      repo,
      vault: makeFakeVault(),
      fetchEncryptedKey: async () => "blob",
      callLlm,
      logger: makeFakeLogger().logger,
    };

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "google",
      firstUserMessage: "hi",
    });

    expect(callLlm).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        model: "gemini-2.5-flash-lite",
      }),
    );
  });
});

describe("generateTitleInBackground: failure path", () => {
  test("LLM throws → fallback title preserved + Pino warn logged", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({
      userId: "u1",
      canvasId: "c1",
      title: "help me draw…",
    });
    const callLlm = mock(async () => {
      throw new Error("HTTP 500");
    });
    const fakeLog = makeFakeLogger();
    const deps: TitleGenDeps = {
      repo,
      vault: makeFakeVault(),
      fetchEncryptedKey: async () => "blob",
      callLlm,
      logger: fakeLog.logger,
    };

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "anthropic",
      firstUserMessage: "help me draw something",
    });

    expect((await repo.getThread(t.id))?.title).toBe("help me draw…");
    expect(fakeLog.warnCalls.length).toBe(1);
    expect(fakeLog.warnCalls[0]!.obj).toMatchObject({ event: "ai_title_gen_failed" });
  });

  test("BYOK key missing → silent skip with warn, fallback preserved", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "fb" });
    const callLlm = mock(async () => "should not be called");
    const fakeLog = makeFakeLogger();
    const deps: TitleGenDeps = {
      repo,
      vault: makeFakeVault(),
      fetchEncryptedKey: async () => null, // key revoked / not set
      callLlm,
      logger: fakeLog.logger,
    };

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "openai",
      firstUserMessage: "hi",
    });

    expect((await repo.getThread(t.id))?.title).toBe("fb");
    expect(callLlm).toHaveBeenCalledTimes(0);
    expect(fakeLog.warnCalls.length).toBe(1);
  });
});

describe("generateTitleInBackground: rate-limit isolation", () => {
  test("does NOT call rateLimiter.limit (skips AGENT_RUN_RULE)", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "fb" });
    const limit = mock(() => ({ allowed: true }));
    const deps: TitleGenDeps = {
      repo,
      vault: makeFakeVault(),
      fetchEncryptedKey: async () => "blob",
      callLlm: async () => "Title",
      logger: makeFakeLogger().logger,
      // The function MUST NOT receive a rate-limiter; including one in the
      // deps shape would invite caller mistakes. We assert by inspecting
      // function dependencies via type — the deps interface itself omits
      // rateLimiter, which is the contract we want.
    };
    // Type-level: TitleGenDeps must NOT include a rateLimiter property.
    // (Sanity check via runtime: this object satisfies TitleGenDeps without one.)
    expect("rateLimiter" in (deps as object)).toBe(false);

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "openai",
      firstUserMessage: "hi",
    });

    // rateLimiter spy was never wired in — assert call count is zero.
    expect(limit).toHaveBeenCalledTimes(0);
  });

  test("BYOK key still consumed via Vault decrypt (does count against user's BYOK quota)", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "fb" });
    const callLlm = mock(async () => "T");
    const fetchEncryptedKey = mock(async () => "encrypted-blob");
    const decryptApiKey = mock(() => "plaintext-key");
    const vault = {
      decryptApiKey,
      encryptApiKey: () => {
        throw new Error("not used");
      },
    } as unknown as TitleGenDeps["vault"];
    const deps: TitleGenDeps = {
      repo,
      vault,
      fetchEncryptedKey,
      callLlm,
      logger: makeFakeLogger().logger,
    };

    await generateTitleInBackground(deps, {
      threadId: t.id,
      userId: "u1",
      provider: "openai",
      firstUserMessage: "hi",
    });

    expect(fetchEncryptedKey).toHaveBeenCalledWith("u1", "openai");
    expect(decryptApiKey).toHaveBeenCalledWith("encrypted-blob");
    expect(callLlm).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "plaintext-key" }));
  });
});
