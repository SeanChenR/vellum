/**
 * streaming.ts — SSE event writer for the per-user agent channel.
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
 *
 * Frame format follows the W3C SSE spec:
 *
 *     event: <type>\n
 *     data: <json>\n
 *     \n
 *
 * The writer enforces a state machine internally so that calls after
 * close() are silently dropped — protecting against the runtime racing
 * the cancel handler to write a stray frame to a closed stream.
 */

import type { AgentEvent } from "@vellum/shared/agent-events";

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_FRAME = ":hb\n\n";
const textEncoder = new TextEncoder();

export interface SseWriterClock {
  now(): number;
}

const defaultClock: SseWriterClock = { now: () => Date.now() };

export function buildSseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}

function encodeEventFrame(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

type WriterState = "open" | "closed";

export class SseWriter {
  #controller: ReadableStreamDefaultController<Uint8Array>;
  #clock: SseWriterClock;
  #state: WriterState = "open";
  #lastWriteAt: number;
  #heartbeatActive = false;

  constructor(
    controller: ReadableStreamDefaultController<Uint8Array>,
    opts: Partial<SseWriterClock> = {},
  ) {
    this.#controller = controller;
    this.#clock = { now: opts.now ?? defaultClock.now };
    this.#lastWriteAt = this.#clock.now();
  }

  writeEvent(event: AgentEvent): void {
    if (this.#state !== "open") return;
    const frame = encodeEventFrame(event);
    this.#enqueue(frame);
    this.#lastWriteAt = this.#clock.now();
  }

  /**
   * Mark heartbeat as active. Actual emission happens via tickHeartbeat
   * which the runtime/endpoint schedules on a timer. This indirection
   * keeps the writer testable without fake timers.
   */
  startHeartbeat(): void {
    if (this.#state !== "open") return;
    this.#heartbeatActive = true;
  }

  tickHeartbeat(): void {
    if (this.#state !== "open" || !this.#heartbeatActive) return;
    const elapsed = this.#clock.now() - this.#lastWriteAt;
    if (elapsed < HEARTBEAT_INTERVAL_MS) return;
    this.#enqueue(HEARTBEAT_FRAME);
    this.#lastWriteAt = this.#clock.now();
  }

  close(): void {
    if (this.#state === "closed") return;
    this.#state = "closed";
    this.#heartbeatActive = false;
    try {
      this.#controller.close();
    } catch {
      // Controller may already be closed by the underlying stream
      // teardown — closing twice is a no-op contract.
    }
  }

  get isOpen(): boolean {
    return this.#state === "open";
  }

  #enqueue(frame: string): void {
    try {
      this.#controller.enqueue(textEncoder.encode(frame));
    } catch {
      // If the consumer disconnected, the controller's enqueue throws.
      // Treat that as a forced close so subsequent writes drop silently.
      this.#state = "closed";
      this.#heartbeatActive = false;
    }
  }
}
