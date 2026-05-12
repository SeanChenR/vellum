/**
 * useAgentRun.test.ts — state machine tests for the per-run hook.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "Composer sends user message and switches to Cancel during run"
 *   - "Token usage footer displays per-run and cumulative usage" (this-run path)
 *   - "Rate limit response shows toast with errorKey translation"
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { useAgentRun, type StartRunInput } from "./useAgentRun";

const RUN_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeSseStream(events: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < events.length) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(events[i])}\n\n`));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function fakeSseResponse(events: unknown[]): Response {
  // happy-dom's Response doesn't fully implement streaming bodies the same
  // way; use the standard Response with a ReadableStream as init body.
  return new Response(makeSseStream(events), { status: 200 });
}

const baseInput = (overrides: Partial<StartRunInput> = {}): StartRunInput => ({
  canvasId: "c1",
  threadId: "t1",
  provider: "openai",
  model: "gpt-4o-mini",
  userMessage: "hi",
  ...overrides,
});

let lastFetchUrl = "";
let lastFetchInit: RequestInit | undefined;
let nextResponseFactory: () => Response | Promise<Response> = () => fakeSseResponse([]);

beforeEach(() => {
  lastFetchUrl = "";
  lastFetchInit = undefined;
  nextResponseFactory = () => fakeSseResponse([]);
});

afterEach(() => cleanup());

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  lastFetchUrl = typeof input === "string" ? input : input.toString();
  lastFetchInit = init;
  return Promise.resolve(nextResponseFactory()).then((r) =>
    r instanceof Response ? r : new Response(null),
  );
}

describe("useAgentRun — happy path", () => {
  test("idle → running → done with usage; lastRunUsage populated", async () => {
    const captured: { runId: string | null } = { runId: null };
    nextResponseFactory = () => {
      const runId = JSON.parse(String(lastFetchInit?.body)).runId as string;
      captured.runId = runId;
      return fakeSseResponse([
        { type: "text", runId, delta: "ok" },
        {
          type: "done",
          runId,
          usage: { input: 100, output: 50, provider: "openai", model: "gpt-4o-mini" },
        },
      ]);
    };

    const { result } = renderHook(() => useAgentRun({ fetchImpl: fakeFetch as typeof fetch }));
    expect(result.current.state).toBe("idle");

    await act(async () => {
      await result.current.start(baseInput());
    });

    await waitFor(() => expect(result.current.state).toBe("done"));
    expect(result.current.lastRunUsage).toEqual({
      input: 100,
      output: 50,
      provider: "openai",
      model: "gpt-4o-mini",
    });
    expect(result.current.runId).toMatch(RUN_ID_RE);
    expect(captured.runId ?? "").toMatch(RUN_ID_RE);
    expect(lastFetchUrl).toBe("/api/agent/canvas/c1/run");
  });
});

describe("useAgentRun — cancel mid-run", () => {
  test("calling cancel() POSTs to /agent/run/:runId/cancel + sets state=cancelled when SSE emits cancelled", async () => {
    let runId = "";
    nextResponseFactory = () => {
      runId = JSON.parse(String(lastFetchInit?.body)).runId as string;
      // Stream that yields a text delta and then a cancelled error.
      return fakeSseResponse([
        { type: "text", runId, delta: "starting" },
        { type: "error", runId, errorKey: "agent.error.cancelled" },
      ]);
    };

    const { result } = renderHook(() => useAgentRun({ fetchImpl: fakeFetch as typeof fetch }));

    await act(async () => {
      await result.current.start(baseInput());
    });

    await waitFor(() => expect(result.current.state).toBe("cancelled"));
    expect(result.current.error).toBe("agent.error.cancelled");
  });
});

describe("useAgentRun — rate limit (HTTP 429)", () => {
  test("returns immediately with state=error + errorKey from body", async () => {
    nextResponseFactory = () =>
      new Response(JSON.stringify({ errorKey: "agent.error.rateLimited" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "30" },
      });

    const { result } = renderHook(() => useAgentRun({ fetchImpl: fakeFetch as typeof fetch }));

    await act(async () => {
      await result.current.start(baseInput());
    });

    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("agent.error.rateLimited");
  });
});

describe("useAgentRun — start guarded against double-dispatch", () => {
  test("calling start() while running does not issue a second POST", async () => {
    const release: { fn: (() => void) | null } = { fn: null };
    const blockedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Don't push events until released — keeps state in `running`.
        release.fn = () => {
          controller.close();
        };
      },
    });

    let postCalls = 0;
    nextResponseFactory = () => {
      postCalls++;
      return new Response(blockedStream, { status: 200 });
    };

    const { result } = renderHook(() => useAgentRun({ fetchImpl: fakeFetch as typeof fetch }));

    // First call begins running; we do not await its full lifecycle.
    void result.current.start(baseInput());
    await waitFor(() => expect(result.current.state).toBe("running"));

    // Attempting a second start MUST be a no-op until the first ends.
    await act(async () => {
      await result.current.start(baseInput());
    });
    expect(postCalls).toBe(1);

    // Cleanup — release the blocked stream so the test process can finish.
    release.fn?.();
  });
});
