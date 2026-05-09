/**
 * runtime.test.ts — agent runtime tool loop, streaming, cancel, and cap
 * semantics. Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/agent-runtime/spec.md
 */

import { describe, expect, it } from "bun:test";
import type { AgentEvent } from "@vellum/shared/agent-events";
import { CancellationRegistry } from "./cancel";
import {
  ProviderError,
  runAgent,
  type AgentRuntimeDeps,
  type ProviderAdapter,
  type ProviderEvent,
  type RunRequest,
} from "./runtime";
import { SseWriter } from "./streaming";

const RUN_A = "11111111-1111-4111-8111-111111111111";
const CANVAS_ID = "cnv_a";
const USER_ID = "user_a";
const SESSION_ID = "sess_a";

// ---------------------------------------------------------------------------
// Test fakes
// ---------------------------------------------------------------------------

function makeWriter() {
  const events: AgentEvent[] = [];
  const frames: string[] = [];
  const decoder = new TextDecoder();
  let closed = false;
  const fake = {
    enqueue(chunk: Uint8Array | string) {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
      frames.push(text);
      const lines = text.split("\n");
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(6)));
        } catch {
          /* heartbeat or malformed */
        }
      }
    },
    close() {
      closed = true;
    },
    error(_err: unknown) {
      closed = true;
    },
  } as unknown as ReadableStreamDefaultController<Uint8Array>;
  return {
    writer: new SseWriter(fake),
    events,
    frames,
    isClosed: () => closed,
  };
}

interface ScriptedProvider {
  /** Push events; the next provider.run() yields these in order. */
  scripts: ProviderEvent[][];
  errors: Array<ProviderError | null>;
  callCount: number;
}

function makeProvider(
  scripts: ProviderEvent[][],
  errors: Array<ProviderError | null> = [],
): {
  adapter: ProviderAdapter;
  state: ScriptedProvider;
} {
  const state: ScriptedProvider = { scripts, errors, callCount: 0 };
  const adapter: ProviderAdapter = {
    async run(input) {
      const idx = state.callCount;
      state.callCount += 1;
      const err = state.errors[idx];
      if (err) throw err;
      const events = state.scripts[idx] ?? [];
      input.signal.throwIfAborted?.();
      async function* gen(): AsyncGenerator<ProviderEvent> {
        for (const e of events) {
          if (input.signal.aborted) return;
          yield e;
        }
      }
      return { events: gen() };
    },
  };
  return { adapter, state };
}

function makeDeps(opts: {
  provider: ProviderAdapter;
  role?: "owner" | "editor" | "viewer" | null;
  canvasExists?: boolean;
  byokKey?: string | null;
  applyMutation?: AgentRuntimeDeps["toolRegistryDeps"]["applyMutation"];
  clockSeed?: number;
  wallTimeoutMs?: number;
  maxToolCalls?: number;
  retryDelaysMs?: number[];
  appliedMutations?: Array<{ canvasId: string; mutations: unknown[] }>;
  registry?: CancellationRegistry;
}): { deps: AgentRuntimeDeps; logs: Array<{ level: string; obj: unknown; msg: string }> } {
  const logs: Array<{ level: string; obj: unknown; msg: string }> = [];
  const role = opts.role === undefined ? "editor" : opts.role;
  const canvasExists = opts.canvasExists ?? true;
  let now = opts.clockSeed ?? 0;

  const applied = opts.appliedMutations ?? [];
  const applyMutation =
    opts.applyMutation ??
    (async (_d: unknown, canvasId: string, mutations: unknown[]) => {
      applied.push({ canvasId, mutations });
      return { ok: true as const, appliedCount: mutations.length };
    });

  const deps: AgentRuntimeDeps = {
    cancellation: opts.registry ?? new CancellationRegistry(),
    permission: {
      resolveCanvasRole: async () => ({
        canvasExists,
        role,
      }),
    },
    byok: {
      fetchKey: async () =>
        Object.prototype.hasOwnProperty.call(opts, "byokKey")
          ? (opts.byokKey ?? null)
          : "sk-test-fake",
    },
    toolRegistryDeps: {
      registry: {
        getRoom: () => undefined,
      } as unknown as AgentRuntimeDeps["toolRegistryDeps"]["registry"],
      applyMutation: applyMutation as AgentRuntimeDeps["toolRegistryDeps"]["applyMutation"],
    } as unknown as AgentRuntimeDeps["toolRegistryDeps"],
    digestDeps: {
      registry: {
        getRoom: () => undefined,
      } as unknown as AgentRuntimeDeps["digestDeps"]["registry"],
    },
    canvasTitle: async () => "test canvas",
    provider: opts.provider,
    clock: {
      now: () => now,
      advance: (ms: number) => {
        now += ms;
      },
    },
    sleep: async () => {
      /* fake sleep — no real delay in tests */
    },
    logger: {
      info: (obj: unknown, msg?: string) => logs.push({ level: "info", obj, msg: msg ?? "" }),
      warn: (obj: unknown, msg?: string) => logs.push({ level: "warn", obj, msg: msg ?? "" }),
      error: (obj: unknown, msg?: string) => logs.push({ level: "error", obj, msg: msg ?? "" }),
      debug: (obj: unknown, msg?: string) => logs.push({ level: "debug", obj, msg: msg ?? "" }),
    },
    wallTimeoutMs: opts.wallTimeoutMs,
    maxToolCalls: opts.maxToolCalls,
    retryDelaysMs: opts.retryDelaysMs,
  };
  return { deps, logs };
}

function makeRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    runId: RUN_A,
    canvasId: CANVAS_ID,
    sessionId: SESSION_ID,
    userId: USER_ID,
    provider: "openai",
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "hi" }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Group A — Run lifecycle states
// ---------------------------------------------------------------------------

describe("Group A: Agent run lifecycle states", () => {
  it("transitions pending → running → done and emits a done event", async () => {
    const { adapter } = makeProvider([
      [
        { type: "text-delta", delta: "ok" },
        { type: "step-finish", finishReason: "stop" },
      ],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("done");
    const types = w.events.map((e) => e.type);
    expect(types).toContain("text");
    expect(types[types.length - 1]).toBe("done");
  });

  it("releases the cancellation registry entry on terminal state", async () => {
    const registry = new CancellationRegistry();
    const { adapter } = makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, registry });

    expect(registry.has(RUN_A)).toBe(false);
    await runAgent(deps, makeRequest(), w.writer);
    expect(registry.has(RUN_A)).toBe(false);
  });

  it("emits exactly one terminal event per run", async () => {
    const { adapter } = makeProvider([
      [
        { type: "text-delta", delta: "a" },
        { type: "step-finish", finishReason: "stop" },
      ],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter });
    await runAgent(deps, makeRequest(), w.writer);

    const terminals = w.events.filter((e) => e.type === "done" || e.type === "error");
    expect(terminals).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Group B — Tool surface dispatch via M12.2 tool-registry
// ---------------------------------------------------------------------------

describe("Group B: Tool surface dispatch via M12.2 tool-registry", () => {
  it("dispatches a write tool through applyMutation and emits tool_call + tool_result", async () => {
    const applied: Array<{ canvasId: string; mutations: unknown[] }> = [];
    const { adapter } = makeProvider([
      [
        {
          type: "tool-call",
          callId: "c1",
          name: "createShape",
          args: { id: "shape:md-1", type: "markdown", x: 0, y: 0, props: {} },
        },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [{ type: "step-finish", finishReason: "stop" }],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, appliedMutations: applied });

    await runAgent(deps, makeRequest(), w.writer);

    expect(applied).toHaveLength(1);
    expect(applied[0]!.canvasId).toBe(CANVAS_ID);
    expect((applied[0]!.mutations[0] as { type: string }).type).toBe("createShape");

    const types = w.events.map((e) => e.type);
    expect(types).toEqual(["tool_call", "tool_result", "done"]);
  });

  it("validates tool args via tool-registry zod schema and emits error tool_result on bad payload", async () => {
    const applied: Array<{ canvasId: string; mutations: unknown[] }> = [];
    const { adapter } = makeProvider([
      [
        {
          type: "tool-call",
          callId: "c1",
          name: "createShape",
          args: { id: "not-a-valid-shape-id" /* missing required fields */ },
        },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [{ type: "step-finish", finishReason: "stop" }],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, appliedMutations: applied });

    await runAgent(deps, makeRequest(), w.writer);

    expect(applied).toHaveLength(0); // schema validation prevents apply
    const result = w.events.find((e) => e.type === "tool_result");
    expect(result).toBeDefined();
    expect((result as { result: { errorKey?: string } }).result.errorKey).toBeDefined();
  });

  it("executes parallel tool calls in one step serially in emit order", async () => {
    const applied: Array<{ canvasId: string; mutations: unknown[] }> = [];
    const order: string[] = [];
    const { adapter } = makeProvider([
      [
        {
          type: "tool-call",
          callId: "c1",
          name: "createShape",
          args: { id: "shape:a", type: "markdown", x: 0, y: 0, props: {} },
        },
        {
          type: "tool-call",
          callId: "c2",
          name: "createShape",
          args: { id: "shape:b", type: "code", x: 0, y: 0, props: {} },
        },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [{ type: "step-finish", finishReason: "stop" }],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({
      provider: adapter,
      appliedMutations: applied,
      applyMutation: async (_d, canvasId, mutations) => {
        const m = mutations[0] as { payload: { id: string } };
        order.push(m.payload.id);
        applied.push({ canvasId, mutations });
        return { ok: true, appliedCount: mutations.length };
      },
    });

    await runAgent(deps, makeRequest(), w.writer);
    expect(order).toEqual(["shape:a", "shape:b"]);
    const callIds = w.events
      .filter((e) => e.type === "tool_call")
      .map((e) => (e as { callId: string }).callId);
    expect(callIds).toEqual(["c1", "c2"]);
  });
});

// ---------------------------------------------------------------------------
// Group C — Wall-clock timeout + tool-call cap
// ---------------------------------------------------------------------------

describe("Group C: Timeout dual cap (wall + tool-call)", () => {
  it("emits wallTimeout error when wall-clock exceeds the cap before next step", async () => {
    const { adapter, state } = makeProvider([
      [
        { type: "text-delta", delta: "x" },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [{ type: "step-finish", finishReason: "stop" }],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, wallTimeoutMs: 1_000 });
    // Advance clock AFTER iter 1's events are fully consumed so iter 2's
    // top-of-loop wall check sees an exceeded budget. The advance hook is
    // appended to the event generator.
    const realRun = adapter.run.bind(adapter);
    adapter.run = async (input) => {
      const result = await realRun(input);
      return {
        events: (async function* () {
          for await (const ev of result.events) yield ev;
          if (state.callCount === 1) deps.clock.advance!(2_000);
        })(),
      };
    };

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("timeout");
    const err = w.events.find((e) => e.type === "error") as
      | { type: "error"; errorKey: string }
      | undefined;
    expect(err?.errorKey).toBe("agent.error.wallTimeout");
  });

  it("emits toolCallCap error when tool calls exceed the cap", async () => {
    // Provider keeps emitting tool-calls; runtime should refuse the 3rd dispatch when cap=2.
    const tcStep: ProviderEvent[] = [
      {
        type: "tool-call",
        callId: "c",
        name: "createShape",
        args: { id: "shape:x", type: "markdown", x: 0, y: 0, props: {} },
      },
      { type: "step-finish", finishReason: "tool-calls" },
    ];
    const { adapter } = makeProvider([
      tcStep,
      tcStep,
      tcStep,
      [{ type: "step-finish", finishReason: "stop" }],
    ]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, maxToolCalls: 2 });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("timeout");
    const err = w.events.find((e) => e.type === "error") as
      | { type: "error"; errorKey: string }
      | undefined;
    expect(err?.errorKey).toBe("agent.error.toolCallCap");
  });
});

// ---------------------------------------------------------------------------
// Group D — Cancel does not roll back in-flight mutation
// ---------------------------------------------------------------------------

describe("Group D: Cancel does not roll back in-flight mutation", () => {
  it("keeps in-flight applyMutation result and emits cancelled error without reverse mutation", async () => {
    const applied: Array<{ canvasId: string; mutations: unknown[] }> = [];
    const registry = new CancellationRegistry();
    const { adapter } = makeProvider([
      [
        {
          type: "tool-call",
          callId: "c1",
          name: "createShape",
          args: { id: "shape:a", type: "markdown", x: 0, y: 0, props: {} },
        },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [
        {
          type: "tool-call",
          callId: "c2",
          name: "createShape",
          args: { id: "shape:b", type: "markdown", x: 0, y: 0, props: {} },
        },
        { type: "step-finish", finishReason: "tool-calls" },
      ],
      [{ type: "step-finish", finishReason: "stop" }],
    ]);

    const w = makeWriter();
    const { deps } = makeDeps({
      provider: adapter,
      appliedMutations: applied,
      registry,
      applyMutation: async (_d, canvasId, mutations) => {
        applied.push({ canvasId, mutations });
        // Cancel arrives while the first mutation is mid-flight.
        registry.abort(RUN_A);
        return { ok: true, appliedCount: mutations.length };
      },
    });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("cancelled");

    // First mutation completed (broadcast normally).
    expect(applied).toHaveLength(1);
    expect((applied[0]!.mutations[0] as { payload: { id: string } }).payload.id).toBe("shape:a");

    // Second mutation never dispatched.
    expect(
      applied.find((a) => (a.mutations[0] as { payload: { id: string } }).payload.id === "shape:b"),
    ).toBeUndefined();

    // No reverse mutation issued.
    const reverseTypes = applied.flatMap((a) =>
      a.mutations.map((m) => (m as { type: string }).type),
    );
    expect(reverseTypes.every((t) => t === "createShape")).toBe(true);

    const err = w.events.find((e) => e.type === "error") as
      | { type: "error"; errorKey: string }
      | undefined;
    expect(err?.errorKey).toBe("agent.error.cancelled");
  });
});

// ---------------------------------------------------------------------------
// Group E — Permission gate
// ---------------------------------------------------------------------------

describe("Group E: Permission gate requires editor or owner role", () => {
  it("refuses a viewer immediately and emits permissionDenied without invoking provider", async () => {
    const { adapter, state } = makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, role: "viewer" });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("error");
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.permissionDenied");
    expect(state.callCount).toBe(0);
  });

  it("refuses an unknown canvas with permissionDenied", async () => {
    const { adapter } = makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, canvasExists: false });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("error");
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.permissionDenied");
  });
});

// ---------------------------------------------------------------------------
// Group F — BYOK + retry policy
// ---------------------------------------------------------------------------

describe("Group F: Provider request via BYOK Vault + 5xx retry", () => {
  it("emits byokMissing when the user has no key for the requested provider", async () => {
    const { adapter, state } = makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, byokKey: null });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("error");
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.byokMissing");
    expect(state.callCount).toBe(0);
  });

  it("retries on 503 then succeeds", async () => {
    const { adapter, state } = makeProvider(
      // Call 0 throws 503 (script unused). Call 1 returns the stop script.
      [[], [{ type: "step-finish", finishReason: "stop" }]],
      [new ProviderError(503, "upstream unavailable"), null],
    );
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, retryDelaysMs: [0, 0] });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("done");
    expect(state.callCount).toBe(2); // first 503, second OK
  });

  it("does not retry on 401 — emits providerAuth", async () => {
    const { adapter, state } = makeProvider([], [new ProviderError(401, "bad key")]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("error");
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.providerAuth");
    expect(state.callCount).toBe(1);
  });

  it("emits providerRateLimit on 429 without retry", async () => {
    const { adapter, state } = makeProvider([], [new ProviderError(429, "too many")]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.providerRateLimit");
    expect(state.callCount).toBe(1);
  });

  it("retries 5xx up to twice then emits providerServer", async () => {
    const { adapter, state } = makeProvider(
      [],
      [new ProviderError(503, "x"), new ProviderError(502, "x"), new ProviderError(500, "x")],
    );
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter, retryDelaysMs: [0, 0] });

    const outcome = await runAgent(deps, makeRequest(), w.writer);
    expect(outcome.state).toBe("error");
    expect((outcome as { errorKey: string }).errorKey).toBe("agent.error.providerServer");
    expect(state.callCount).toBe(3); // 1 + 2 retries
  });
});

// ---------------------------------------------------------------------------
// Group G — Error events emit i18n errorKey only
// ---------------------------------------------------------------------------

describe("Group G: Error events emit i18n errorKey only (no leakage)", () => {
  it("does not include the provider error message in the error event", async () => {
    const sensitive = "the user prompt was 'super secret'";
    const { adapter } = makeProvider([], [new ProviderError(401, sensitive)]);
    const w = makeWriter();
    const { deps } = makeDeps({ provider: adapter });

    await runAgent(deps, makeRequest(), w.writer);

    const err = w.events.find((e) => e.type === "error");
    expect(err).toBeDefined();
    const eventJson = JSON.stringify(err);
    expect(eventJson).not.toContain("super secret");
    expect(eventJson).not.toContain("the user prompt was");
  });

  it("does not include the BYOK key in any event or log entry's serialized payload", async () => {
    const apiKey = "sk-very-secret-key-xyz";
    const { adapter } = makeProvider([[{ type: "step-finish", finishReason: "stop" }]]);
    const w = makeWriter();
    const { deps, logs } = makeDeps({ provider: adapter, byokKey: apiKey });

    await runAgent(deps, makeRequest(), w.writer);

    const eventJson = JSON.stringify(w.events);
    expect(eventJson).not.toContain(apiKey);
    const logJson = JSON.stringify(logs);
    expect(logJson).not.toContain(apiKey);
  });
});
