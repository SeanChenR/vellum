/**
 * agent-events.test.ts — discriminated union for SSE events emitted by
 * the M13 agent runtime. The schema is the contract between server
 * (apps/api/src/agent/streaming.ts) and any future client consumer
 * (M14 Side Panel) so it lives in packages/shared.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/streaming-channel/spec.md
 *     "SSE event types are a closed discriminated union"
 */

import { describe, expect, it } from "bun:test";
import { agentErrorKeys, agentEventSchema, type AgentEvent } from "./agent-events";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const ALT_RUN_ID = "22222222-2222-4222-8222-222222222222";

describe("agentEventSchema — text variant", () => {
  it("round-trips a text delta", () => {
    const event = {
      type: "text" as const,
      runId: RUN_ID,
      delta: "I will create a shape.",
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("rejects a text event without delta", () => {
    expect(() => agentEventSchema.parse({ type: "text", runId: RUN_ID })).toThrow();
  });

  it("rejects a text event whose delta is not a string", () => {
    expect(() => agentEventSchema.parse({ type: "text", runId: RUN_ID, delta: 42 })).toThrow();
  });
});

describe("agentEventSchema — tool_call variant", () => {
  it("round-trips a tool_call", () => {
    const event = {
      type: "tool_call" as const,
      runId: RUN_ID,
      callId: "call_abc",
      name: "createShape",
      args: { id: "shape:md-1", type: "markdown", x: 0, y: 0 },
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("rejects a tool_call with empty name", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "tool_call",
        runId: RUN_ID,
        callId: "call_abc",
        name: "",
        args: {},
      }),
    ).toThrow();
  });

  it("rejects a tool_call missing callId", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "tool_call",
        runId: RUN_ID,
        name: "createShape",
        args: {},
      }),
    ).toThrow();
  });
});

describe("agentEventSchema — tool_result variant", () => {
  it("round-trips a successful tool_result", () => {
    const event = {
      type: "tool_result" as const,
      runId: RUN_ID,
      callId: "call_abc",
      result: { ok: true, shapeId: "shape:md-1" },
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("round-trips a tool_result whose payload carries an errorKey", () => {
    const event = {
      type: "tool_result" as const,
      runId: RUN_ID,
      callId: "call_abc",
      result: { errorKey: "agent.tool.unknownShape" },
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });
});

describe("agentEventSchema — error variant", () => {
  it("round-trips an error event with only errorKey", () => {
    const event = {
      type: "error" as const,
      runId: RUN_ID,
      errorKey: "agent.error.wallTimeout" as const,
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("round-trips an error event with optional detail", () => {
    const event = {
      type: "error" as const,
      runId: RUN_ID,
      errorKey: "agent.error.providerServer" as const,
      detail: "upstream returned 503 twice",
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("rejects an unknown errorKey (closed enum)", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "error",
        runId: RUN_ID,
        errorKey: "agent.error.unknown",
      }),
    ).toThrow();
  });

  it("rejects an error event whose detail is not a string", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "error",
        runId: RUN_ID,
        errorKey: "agent.error.internal",
        detail: { nested: true },
      }),
    ).toThrow();
  });
});

describe("agentEventSchema — done variant", () => {
  it("round-trips a done event with usage payload", () => {
    const event = {
      type: "done" as const,
      runId: RUN_ID,
      usage: {
        input: 1500,
        output: 800,
        provider: "openai" as const,
        model: "gpt-4o-mini",
      },
    };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("round-trips a done event with usage explicitly null (provider returned no usage)", () => {
    const event = { type: "done" as const, runId: RUN_ID, usage: null };
    const parsed = agentEventSchema.parse(event);
    expect(parsed).toEqual(event);
  });

  it("rejects a done event missing the usage field (M14 contract)", () => {
    expect(() => agentEventSchema.parse({ type: "done", runId: RUN_ID })).toThrow();
  });

  it("rejects a done event whose usage.provider is unknown", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "done",
        runId: RUN_ID,
        usage: { input: 1, output: 1, provider: "huggingface", model: "x" },
      }),
    ).toThrow();
  });

  it("rejects a done event whose usage.input is not a number", () => {
    expect(() =>
      agentEventSchema.parse({
        type: "done",
        runId: RUN_ID,
        usage: { input: "lots", output: 0, provider: "openai", model: "gpt-4o-mini" },
      }),
    ).toThrow();
  });

  it("rejects a done event with extra unknown field", () => {
    expect(() =>
      agentEventSchema.parse({ type: "done", runId: RUN_ID, usage: null, foo: "bar" }),
    ).toThrow();
  });
});

describe("agentEventSchema — discriminator", () => {
  it("rejects an unknown type", () => {
    expect(() => agentEventSchema.parse({ type: "heartbeat", runId: RUN_ID })).toThrow();
  });

  it("rejects when runId is not a UUID v4", () => {
    expect(() =>
      agentEventSchema.parse({ type: "text", runId: "not-a-uuid", delta: "x" }),
    ).toThrow();
  });

  it("preserves type narrowing on parse", () => {
    const event: AgentEvent = agentEventSchema.parse({
      type: "tool_call",
      runId: ALT_RUN_ID,
      callId: "c1",
      name: "getViewport",
      args: {},
    });
    if (event.type === "tool_call") {
      expect(event.name).toBe("getViewport");
    } else {
      throw new Error("expected tool_call");
    }
  });
});

describe("agentErrorKeys", () => {
  it("contains every i18n key referenced by the streaming/runtime specs", () => {
    expect(agentErrorKeys).toContain("agent.error.byokMissing");
    expect(agentErrorKeys).toContain("agent.error.providerAuth");
    expect(agentErrorKeys).toContain("agent.error.providerRateLimit");
    expect(agentErrorKeys).toContain("agent.error.providerServer");
    expect(agentErrorKeys).toContain("agent.error.wallTimeout");
    expect(agentErrorKeys).toContain("agent.error.toolCallCap");
    expect(agentErrorKeys).toContain("agent.error.permissionDenied");
    expect(agentErrorKeys).toContain("agent.error.cancelled");
    expect(agentErrorKeys).toContain("agent.error.internal");
    expect(agentErrorKeys).toContain("agent.error.invalidRequest");
    expect(agentErrorKeys).toContain("agent.error.runIdReused");
    expect(agentErrorKeys).toContain("agent.error.rateLimited");
  });
});
