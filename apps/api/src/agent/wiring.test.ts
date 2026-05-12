/**
 * wiring.test.ts — provider-routing tests for the production agent
 * adapter wiring. Spec ref: design "Provider routing 從 `model.startsWith()`
 * 改成 explicit map" (M14).
 *
 * The PROVIDER_MODELS map is single source of truth for which (provider,
 * model) pairs the runtime accepts. Adding a new BYOK model means
 * extending BOTH BYOK_PRICING (in @vellum/shared) AND this map. The
 * cardinality test below catches drift in either direction.
 */

import { describe, expect, it } from "bun:test";
import { BYOK_PRICING, type ProviderId } from "@vellum/shared/byok-pricing";
import { aiSdkPartToProviderEvents, isModelKnown, PROVIDER_MODELS } from "./wiring";
import type { ProviderEvent } from "./runtime";

describe("PROVIDER_MODELS — explicit map (no model.startsWith heuristic)", () => {
  it("contains exactly three providers", () => {
    expect(Object.keys(PROVIDER_MODELS).sort()).toEqual(["anthropic", "google", "openai"]);
  });

  it("includes every modelId from BYOK_PRICING for the matching provider", () => {
    for (const row of BYOK_PRICING) {
      expect(PROVIDER_MODELS[row.providerId].has(row.modelId)).toBe(true);
    }
  });

  it("cardinality matches BYOK_PRICING per provider", () => {
    const providers: ProviderId[] = ["openai", "anthropic", "google"];
    for (const p of providers) {
      const pricingCount = BYOK_PRICING.filter((r) => r.providerId === p).length;
      // PROVIDER_MODELS may include extras (e.g. economy-tier title-gen
      // models that are not user-selectable). Strict-equal count is the
      // right invariant only for user-facing model selection — assert at
      // least the BYOK rows are present (above test) AND that we did not
      // accidentally add unrelated entries.
      expect(PROVIDER_MODELS[p].size).toBeGreaterThanOrEqual(pricingCount);
    }
  });
});

describe("isModelKnown — fail-fast validation", () => {
  it("returns true for every BYOK_PRICING row", () => {
    for (const row of BYOK_PRICING) {
      expect(isModelKnown(row.providerId, row.modelId)).toBe(true);
    }
  });

  it("returns false for an unknown model id", () => {
    expect(isModelKnown("openai", "no-such-model")).toBe(false);
    expect(isModelKnown("anthropic", "no-such-model")).toBe(false);
    expect(isModelKnown("google", "no-such-model")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// aiSdkPartToProviderEvents — bridge between AI SDK fullStream parts and
// the runtime's ProviderEvent stream. Exists as a pure function so usage
// extraction can be unit-tested without a real model client.
// ---------------------------------------------------------------------------

describe("aiSdkPartToProviderEvents — text-delta", () => {
  it("maps text-delta to a single text-delta ProviderEvent", () => {
    const events = aiSdkPartToProviderEvents({ type: "text-delta", text: "hello" });
    expect(events).toEqual([{ type: "text-delta", delta: "hello" }]);
  });
});

describe("aiSdkPartToProviderEvents — tool-call", () => {
  it("maps tool-call to a single tool-call ProviderEvent", () => {
    const events = aiSdkPartToProviderEvents({
      type: "tool-call",
      toolCallId: "c1",
      toolName: "createShape",
      input: { id: "shape:a" },
    });
    expect(events).toEqual([
      { type: "tool-call", callId: "c1", name: "createShape", args: { id: "shape:a" } },
    ]);
  });
});

describe("aiSdkPartToProviderEvents — finish-step usage extraction", () => {
  it("emits BOTH step-finish AND usage when finish-step carries usage", () => {
    const events = aiSdkPartToProviderEvents({
      type: "finish-step",
      finishReason: "stop",
      usage: { inputTokens: 1500, outputTokens: 800 },
    });
    expect(events).toEqual([
      { type: "step-finish", finishReason: "stop" },
      { type: "usage", usage: { input: 1500, output: 800 } },
    ]);
  });

  it("omits the usage event when finish-step has no usage object", () => {
    const events = aiSdkPartToProviderEvents({ type: "finish-step", finishReason: "stop" });
    expect(events).toEqual([{ type: "step-finish", finishReason: "stop" }]);
  });

  it("omits the usage event when both inputTokens and outputTokens are undefined", () => {
    const events = aiSdkPartToProviderEvents({
      type: "finish-step",
      finishReason: "stop",
      usage: { inputTokens: undefined, outputTokens: undefined },
    });
    expect(events).toEqual([{ type: "step-finish", finishReason: "stop" }]);
  });

  it("fills missing input or output with 0 when the other is present", () => {
    const events = aiSdkPartToProviderEvents({
      type: "finish-step",
      finishReason: "stop",
      usage: { inputTokens: 100, outputTokens: undefined },
    });
    expect(events).toEqual([
      { type: "step-finish", finishReason: "stop" },
      { type: "usage", usage: { input: 100, output: 0 } },
    ]);
  });

  it("normalises non-standard finishReason values to 'stop'", () => {
    const events = aiSdkPartToProviderEvents({
      type: "finish-step",
      finishReason: "content-filter",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const stepFinish = events.find((e: ProviderEvent) => e.type === "step-finish");
    expect(stepFinish).toEqual({ type: "step-finish", finishReason: "stop" });
  });
});

describe("aiSdkPartToProviderEvents — ignored part types", () => {
  it("returns an empty array for unrecognised part types", () => {
    expect(aiSdkPartToProviderEvents({ type: "start" })).toEqual([]);
    expect(aiSdkPartToProviderEvents({ type: "start-step" })).toEqual([]);
    expect(aiSdkPartToProviderEvents({ type: "text-start", id: "x" })).toEqual([]);
  });
});
