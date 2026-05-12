/**
 * sse-parser.ts — minimal SSE event consumer for the agent streaming
 * channel. Consumes `Uint8Array` chunks from `fetch(...).body.getReader()`
 * (or any `ReadableStream<Uint8Array>`) and yields validated `AgentEvent`
 * instances.
 *
 * Behavior contract (see ai-side-panel spec "SSE consumer parses
 * streaming-channel events"):
 *   - buffers partial UTF-8 sequences across chunks via TextDecoder({stream:true})
 *   - dispatches a complete event on every blank-line boundary
 *   - validates each `data:` JSON payload against `agentEventSchema`
 *   - silently discards SSE comment lines (`:hb`)
 *   - silently discards JSON payloads that fail validation (with a
 *     console warning to surface developer-time mistakes)
 */

import { agentEventSchema, type AgentEvent } from "@vellum/shared/agent-events";

export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Dispatch on `\n\n` boundaries; keep any trailing partial frame for
      // the next read.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const ev = parseFrame(frame);
        if (ev !== null) yield ev;
      }
    }
    // Stream is over — flush the decoder, but do NOT attempt to dispatch
    // a frame that was never blank-line terminated. SSE convention treats
    // unfinished frames as discarded on connection close.
    const tail = decoder.decode();
    if (tail) buffer += tail;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse one already-buffered SSE frame (the text between two blank lines)
 * into a single `AgentEvent`. Returns null when the frame is a comment,
 * has no `data:` line, or fails zod validation.
 */
function parseFrame(frame: string): AgentEvent | null {
  // Per SSE spec, a frame is a sequence of lines. Comment lines start
  // with `:` and are ignored. Field lines have shape `<name>: <value>`.
  // We only consume `data:` lines (the closed agent-events schema does
  // not use `event:` named events; the `type` discriminator lives in the
  // JSON payload itself).
  let json: string | null = null;
  for (const line of frame.split("\n")) {
    if (line.length === 0) continue;
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      // Spec allows multiple `data:` lines per frame to be joined by
      // `\n`. The agent runtime emits exactly one — but be tolerant.
      const piece = line.slice(5).replace(/^\s/, "");
      json = json === null ? piece : `${json}\n${piece}`;
    }
    // Unknown field lines (event:, id:, retry:) are deliberately ignored.
  }

  if (json === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[sse-parser] dropped non-JSON data frame", json.slice(0, 80));
    return null;
  }

  const result = agentEventSchema.safeParse(parsed);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.warn("[sse-parser] dropped frame failing agent-events schema", {
      issues: result.error.issues.map((i) => i.message),
    });
    return null;
  }
  return result.data;
}
