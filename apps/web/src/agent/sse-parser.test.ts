/**
 * sse-parser.test.ts — frontend SSE event consumer tests.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "SSE consumer parses streaming-channel events"
 */

import { describe, expect, test } from "bun:test";
import { parseSseStream } from "./sse-parser";

const RUN = "11111111-1111-4111-8111-111111111111";

function chunksToReadable(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

const enc = new TextEncoder();

describe("parseSseStream — basic event framing", () => {
  test("yields exactly one event per blank-line boundary", async () => {
    const stream = chunksToReadable([
      enc.encode(`data: {"type":"text","runId":"${RUN}","delta":"hi"}\n\n`),
      enc.encode(`data: {"type":"done","runId":"${RUN}","usage":null}\n\n`),
    ]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    expect(events.length).toBe(2);
    expect((events[0] as { type: string }).type).toBe("text");
    expect((events[1] as { type: string }).type).toBe("done");
  });

  test("buffers partial lines across chunks", async () => {
    const full = `data: {"type":"text","runId":"${RUN}","delta":"hello"}\n\n`;
    const split = Math.floor(full.length / 2);
    const stream = chunksToReadable([
      enc.encode(full.slice(0, split)),
      enc.encode(full.slice(split)),
    ]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    expect(events.length).toBe(1);
    expect((events[0] as { delta: string }).delta).toBe("hello");
  });

  test("discards SSE comment lines (heartbeat) without yielding events", async () => {
    const stream = chunksToReadable([
      enc.encode(`: hb\n\n`),
      enc.encode(`data: {"type":"done","runId":"${RUN}","usage":null}\n\n`),
    ]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    expect(events.length).toBe(1);
    expect((events[0] as { type: string }).type).toBe("done");
  });

  test("discards events whose JSON fails the agent-events zod schema", async () => {
    // type=text but no delta — invalid per zod schema.
    const stream = chunksToReadable([
      enc.encode(`data: {"type":"text","runId":"${RUN}"}\n\n`),
      enc.encode(`data: {"type":"done","runId":"${RUN}","usage":null}\n\n`),
    ]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    // The malformed text event is silently dropped; only `done` survives.
    expect(events.length).toBe(1);
    expect((events[0] as { type: string }).type).toBe("done");
  });

  test("multi-byte UTF-8 split across chunks decodes correctly", async () => {
    const event = `data: {"type":"text","runId":"${RUN}","delta":"测试"}\n\n`;
    const bytes = enc.encode(event);
    // 测 in UTF-8 is e6 b5 8b — 3 bytes. Split between byte 1 and byte 2 of 测.
    const cutIdx = bytes.indexOf(0xe6) + 2;
    const stream = chunksToReadable([bytes.slice(0, cutIdx), bytes.slice(cutIdx)]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    expect(events.length).toBe(1);
    expect((events[0] as { delta: string }).delta).toBe("测试");
  });

  test("handles a stream that never ends with blank line (closes cleanly)", async () => {
    const stream = chunksToReadable([
      enc.encode(`data: {"type":"done","runId":"${RUN}","usage":null}\n\n`),
      enc.encode(`data: not-a-complete-frame\n`), // missing trailing \n\n
    ]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    // Trailing partial frame is dropped on stream close.
    expect(events.length).toBe(1);
  });
});

describe("parseSseStream — full agent run sequence", () => {
  test("text → tool_call → tool_result → text → done", async () => {
    const seq = [
      { type: "text", runId: RUN, delta: "I will create a shape." },
      { type: "tool_call", runId: RUN, callId: "c1", name: "createShape", args: {} },
      { type: "tool_result", runId: RUN, callId: "c1", result: { ok: true } },
      { type: "text", runId: RUN, delta: " Done." },
      {
        type: "done",
        runId: RUN,
        usage: { input: 100, output: 50, provider: "openai", model: "gpt-4o-mini" },
      },
    ];
    const body = seq.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
    const stream = chunksToReadable([enc.encode(body)]);
    const events: unknown[] = [];
    for await (const ev of parseSseStream(stream)) events.push(ev);
    expect(events.map((e) => (e as { type: string }).type)).toEqual([
      "text",
      "tool_call",
      "tool_result",
      "text",
      "done",
    ]);
  });
});
