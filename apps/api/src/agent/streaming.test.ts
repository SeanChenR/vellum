/**
 * streaming.test.ts — SSE event writer for the per-user agent channel.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/streaming-channel/spec.md
 *     "SSE event types are a closed discriminated union"
 *     "Heartbeat every 15 seconds while streaming"
 *     "SSE response sets buffering-defeating headers"
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Streaming transport: SSE per-user, not shared WS room"
 */

import { describe, expect, it } from "bun:test";
import type { AgentEvent } from "@vellum/shared/agent-events";
import { SseWriter, buildSseHeaders } from "./streaming";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

interface CapturedFrame {
  text: string;
}

function makeFakeController() {
  const frames: CapturedFrame[] = [];
  let closed = false;
  const decoder = new TextDecoder();

  return {
    frames,
    isClosed: () => closed,
    controller: {
      enqueue(chunk: Uint8Array | string) {
        const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
        frames.push({ text });
      },
      close() {
        closed = true;
      },
      error(_err: unknown) {
        closed = true;
      },
    } as unknown as ReadableStreamDefaultController<Uint8Array>,
  };
}

describe("buildSseHeaders", () => {
  it("emits the buffering-defeating header set", () => {
    const headers = buildSseHeaders();
    expect(headers["Content-Type"]).toBe("text/event-stream; charset=utf-8");
    expect(headers["Cache-Control"]).toBe("no-cache, no-transform");
    expect(headers["Connection"]).toBe("keep-alive");
    expect(headers["X-Accel-Buffering"]).toBe("no");
  });
});

describe("SseWriter — event encoding", () => {
  it("encodes a text event as a single SSE frame with event: + data:", () => {
    const fake = makeFakeController();
    const writer = new SseWriter(fake.controller);

    const event: AgentEvent = {
      type: "text",
      runId: RUN_ID,
      delta: "hello world",
    };
    writer.writeEvent(event);

    expect(fake.frames).toHaveLength(1);
    const frame = fake.frames[0]!.text;
    expect(frame).toContain("event: text\n");
    expect(frame).toContain(`data: ${JSON.stringify(event)}\n`);
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  it("encodes a tool_call event with full payload", () => {
    const fake = makeFakeController();
    const writer = new SseWriter(fake.controller);

    const event: AgentEvent = {
      type: "tool_call",
      runId: RUN_ID,
      callId: "c1",
      name: "createShape",
      args: { id: "shape:md-1", type: "markdown", x: 0, y: 0 },
    };
    writer.writeEvent(event);

    const frame = fake.frames[0]!.text;
    expect(frame).toContain("event: tool_call\n");
    expect(frame).toContain('"name":"createShape"');
  });

  it("encodes terminal events (done / error) the same way as non-terminal", () => {
    const fake = makeFakeController();
    const writer = new SseWriter(fake.controller);

    writer.writeEvent({ type: "done", runId: RUN_ID });
    expect(fake.frames[0]!.text).toContain("event: done\n");

    writer.writeEvent({
      type: "error",
      runId: RUN_ID,
      errorKey: "agent.error.wallTimeout",
    });
    expect(fake.frames[1]!.text).toContain("event: error\n");
    expect(fake.frames[1]!.text).toContain('"errorKey":"agent.error.wallTimeout"');
  });
});

describe("SseWriter — heartbeat", () => {
  it("emits ':hb' comment when tickHeartbeat is invoked at the 15s boundary", () => {
    const fake = makeFakeController();
    let now = 0;
    const writer = new SseWriter(fake.controller, { now: () => now });

    writer.startHeartbeat();
    // Before any tick, no frames.
    expect(fake.frames).toHaveLength(0);

    now = 15_000;
    writer.tickHeartbeat();
    expect(fake.frames.at(-1)!.text).toBe(":hb\n\n");

    now = 30_000;
    writer.tickHeartbeat();
    expect(fake.frames.at(-1)!.text).toBe(":hb\n\n");
  });

  it("does not emit a heartbeat if a real event was written within the last 15s", () => {
    const fake = makeFakeController();
    let now = 0;
    const writer = new SseWriter(fake.controller, { now: () => now });
    writer.startHeartbeat();

    now = 5_000;
    writer.writeEvent({ type: "text", runId: RUN_ID, delta: "x" });

    now = 16_000;
    writer.tickHeartbeat();

    // Last frame should still be the text event, not :hb.
    expect(fake.frames.at(-1)!.text).toContain("event: text");
  });

  it("does not emit a heartbeat after close", () => {
    const fake = makeFakeController();
    let now = 0;
    const writer = new SseWriter(fake.controller, { now: () => now });
    writer.startHeartbeat();
    writer.close();

    now = 20_000;
    writer.tickHeartbeat();
    // Only no-frame state after close.
    expect(fake.frames).toHaveLength(0);
  });
});

describe("SseWriter — close lifecycle", () => {
  it("ignores writeEvent calls after close", () => {
    const fake = makeFakeController();
    const writer = new SseWriter(fake.controller);
    writer.close();
    writer.writeEvent({ type: "done", runId: RUN_ID });
    expect(fake.frames).toHaveLength(0);
  });

  it("closing twice is a no-op", () => {
    const fake = makeFakeController();
    const writer = new SseWriter(fake.controller);
    writer.close();
    expect(() => writer.close()).not.toThrow();
    expect(fake.isClosed()).toBe(true);
  });
});
