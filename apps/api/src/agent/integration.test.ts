/**
 * integration.test.ts — agent runtime end-to-end against a real
 * TLSocketRoom-backed sync server.
 *
 * Wires the production agent endpoint factory against:
 *   - Real RoomRegistry + TLSocketRoom (so applyMutation lands in the
 *     authoritative store and snapshot reads reflect the change)
 *   - Real CancellationRegistry, RateLimiter, SseWriter
 *   - Fake ProviderAdapter scripted to emit one createShape tool-call
 *     followed by step-finish:stop (so the test does not call any real
 *     LLM provider — that's covered manually with a real BYOK key)
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/{agent-runtime,
 *   canvas-digest,streaming-channel}/spec.md
 *
 * What this test validates:
 *   - SSE event sequence contains tool_call + tool_result + done
 *   - The mutation reaches the room's authoritative snapshot
 *   - The wiring assembled in apps/api/src/agent/wiring.ts (minus the
 *     real provider) produces the same observable outcomes the spec
 *     prescribes
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { TLSocketRoom } from "@tldraw/sync-core";
import { CancellationRegistry } from "./cancel";
import { buildInMemoryThreadRepo } from "./threads/repo";
import { applyMutation } from "../sync/mutator";
import { vellumStoreSchema } from "../sync/shape-schemas";
import { RoomRegistry, type SyncRoomLike } from "../sync/room";
import { RateLimiter } from "../lib/rate-limiter";
import { AGENT_RUN_RULE } from "../lib/rate-limit-rules";
import { buildAgentEndpoints, type AgentEndpointDeps } from "./sse-endpoint";
import type { ProviderAdapter, ProviderEvent } from "./runtime";
import type { AgentEvent } from "@vellum/shared/agent-events";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const CANVAS_ID = "00000000-0000-0000-0000-bbbbbbbbbbbb";
const USER_ID = "00000000-0000-0000-0000-aaaaaaaaaaaa";
const SESSION_ID = "sess_int";

beforeAll(() => {
  if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});
afterAll(() => {
  if (!GlobalRegistrator.isRegistered) {
    GlobalRegistrator.register({ url: "http://localhost:3001" });
  }
});

function makeRegistry(): RoomRegistry<SyncRoomLike> {
  return new RoomRegistry<SyncRoomLike>({
    createRoom: (_canvasId, initialSnapshot) =>
      new TLSocketRoom({ initialSnapshot, schema: vellumStoreSchema }) as unknown as SyncRoomLike,
    loadSnapshot: async () => undefined,
    saveSnapshot: async () => {},
    setTimer: globalThis.setTimeout.bind(globalThis),
    clearTimer: globalThis.clearTimeout.bind(globalThis),
    idleReleaseMs: 60_000,
  });
}

function makeProvider(scripts: ProviderEvent[][]): ProviderAdapter {
  let i = 0;
  return {
    async run(input) {
      const idx = i;
      i += 1;
      const events =
        scripts[idx] ?? ([{ type: "step-finish", finishReason: "stop" }] as ProviderEvent[]);
      async function* gen(): AsyncGenerator<ProviderEvent> {
        for (const e of events) {
          if (input.signal.aborted) return;
          yield e;
        }
      }
      return { events: gen() };
    },
  };
}

function buildDeps(registry: RoomRegistry<SyncRoomLike>): AgentEndpointDeps {
  const provider = makeProvider([
    [
      {
        type: "tool-call",
        callId: "c1",
        name: "createShape",
        args: {
          id: "shape:hello-md",
          type: "markdown",
          x: 100,
          y: 100,
          props: { content: "hello from agent", w: 200, h: 100 },
        },
      },
      { type: "step-finish", finishReason: "tool-calls" },
    ],
    [{ type: "step-finish", finishReason: "stop" }],
  ]);

  return {
    cancellation: new CancellationRegistry(),
    permission: {
      async resolveCanvasRole(userId, canvasId) {
        return {
          canvasExists: canvasId === CANVAS_ID,
          role: userId === USER_ID ? "editor" : null,
        };
      },
    },
    byok: {
      async fetchKey() {
        return "sk-fake-test-key";
      },
    },
    toolRegistryDeps: { registry, applyMutation },
    digestDeps: { registry },
    canvasTitle: async () => "integration test canvas",
    provider,
    clock: { now: () => Date.now() },
    sleep: async () => {
      /* noop */
    },
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    rateLimiter: new RateLimiter(),
    rateLimitRule: AGENT_RUN_RULE,
    threadRepo: buildInMemoryThreadRepo(),
  };
}

async function readSse(response: Response): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  if (!response.body) return events;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        try {
          events.push(JSON.parse(dataLine.slice(6)) as AgentEvent);
        } catch {
          /* heartbeat */
        }
      }
    }
  }
  return events;
}

describe("agent endpoint → tool registry → mutator → sync room", () => {
  it("streams tool_call + tool_result + done and writes the shape into the room snapshot", async () => {
    const registry = makeRegistry();
    // Pre-acquire so the room exists when the agent dispatches the
    // createShape mutation.
    await registry.acquire(CANVAS_ID);

    const deps = buildDeps(registry);
    // Seed a thread the run endpoint will resolve as owned by USER_ID.
    deps.threadRepo._test_seedThread!({
      id: "thr_int_a",
      userId: USER_ID,
      canvasId: CANVAS_ID,
    });
    const endpoints = buildAgentEndpoints(deps);

    const req = new Request(`http://localhost/agent/canvas/${CANVAS_ID}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: RUN_ID,
        provider: "openai",
        model: "gpt-4o-mini",
        userMessage: "create a markdown shape",
        threadId: "thr_int_a",
      }),
    });

    const res = await endpoints.runHandler(req, CANVAS_ID, { userId: USER_ID });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream; charset=utf-8");

    const events = await readSse(res);
    const types = events.map((e) => e.type);
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types[types.length - 1]).toBe("done");

    // Verify the broadcast lands in the room snapshot.
    const room = registry.getRoom(CANVAS_ID);
    expect(room).toBeDefined();
    const snap = room!.getCurrentSnapshot();
    const shapeRecord = snap.documents
      .map((d) => d.state)
      .find((r) => (r as { id?: string }).id === "shape:hello-md");
    expect(shapeRecord).toBeDefined();
    expect((shapeRecord as { type?: string }).type).toBe("markdown");
  });
});
