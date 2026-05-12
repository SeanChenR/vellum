/**
 * useAgentRun.ts — React hook driving a single agent run end-to-end.
 *
 * Responsibilities:
 *   - POST /agent/canvas/:canvasId/run with {provider, model, threadId, userMessage}
 *   - read the SSE response body via parseSseStream
 *   - expose { state, events, lastRunUsage, error } as observable React state
 *   - provide cancel() that POSTs /agent/run/:runId/cancel
 *
 * State machine (matches agent-runtime spec lifecycle):
 *   idle → running → done | error | cancelled
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-side-panel/spec.md
 *   - "Composer sends user message and switches to Cancel during run"
 *   - "Token usage footer displays per-run and cumulative usage" (this-run path)
 *   - "Rate limit response shows toast with errorKey translation"
 */

import { useCallback, useRef, useState } from "react";
import type { AgentEvent } from "@vellum/shared/agent-events";
import { parseSseStream } from "./sse-parser";

export type AgentRunState = "idle" | "running" | "done" | "error" | "cancelled";

export interface AgentRunUsage {
  input: number;
  output: number;
  provider: "openai" | "anthropic" | "google";
  model: string;
}

export interface StartRunInput {
  canvasId: string;
  threadId: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  userMessage: string;
}

export interface UseAgentRunResult {
  state: AgentRunState;
  events: AgentEvent[];
  /** Populated on the SSE `done` event; null otherwise (or `null` from server). */
  lastRunUsage: AgentRunUsage | null;
  /** i18n errorKey when state === "error" / "cancelled"; null otherwise. */
  error: string | null;
  /** runId of the currently in-flight (or last-completed) run. */
  runId: string | null;
  start(input: StartRunInput): Promise<void>;
  cancel(): Promise<void>;
  reset(): void;
}

interface UseAgentRunOptions {
  /** Test seam — defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function useAgentRun(options: UseAgentRunOptions = {}): UseAgentRunResult {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const [state, setState] = useState<AgentRunState>("idle");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [lastRunUsage, setLastRunUsage] = useState<AgentRunUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const inFlightRef = useRef<{ runId: string; abort: AbortController } | null>(null);

  const reset = useCallback(() => {
    setState("idle");
    setEvents([]);
    setLastRunUsage(null);
    setError(null);
    setRunId(null);
    inFlightRef.current = null;
  }, []);

  const cancel = useCallback(async () => {
    const inFlight = inFlightRef.current;
    if (!inFlight) return;
    try {
      await fetchImpl(`/api/agent/run/${inFlight.runId}/cancel`, { method: "POST" });
    } catch {
      /* server-side cancel is best-effort; the abort below is the local one */
    }
    inFlight.abort.abort();
  }, [fetchImpl]);

  const start = useCallback(
    async (input: StartRunInput): Promise<void> => {
      // Guard: cannot dispatch a new run while one is in flight.
      if (state === "running") return;

      const newRunId = crypto.randomUUID();
      const ctrl = new AbortController();
      inFlightRef.current = { runId: newRunId, abort: ctrl };
      setRunId(newRunId);
      setState("running");
      setEvents([]);
      setLastRunUsage(null);
      setError(null);

      let res: Response;
      try {
        res = await fetchImpl(`/api/agent/canvas/${input.canvasId}/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            runId: newRunId,
            provider: input.provider,
            model: input.model,
            threadId: input.threadId,
            userMessage: input.userMessage,
          }),
          signal: ctrl.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState("cancelled");
          setError("agent.error.cancelled");
        } else {
          setState("error");
          setError("agent.error.internal");
        }
        inFlightRef.current = null;
        return;
      }

      if (!res.ok) {
        // Non-streaming error — body should be {errorKey}.
        let errorKey = "agent.error.internal";
        try {
          const body = (await res.json()) as { errorKey?: string };
          if (body.errorKey) errorKey = body.errorKey;
        } catch {
          /* ignore */
        }
        setState("error");
        setError(errorKey);
        inFlightRef.current = null;
        return;
      }

      if (!res.body) {
        setState("error");
        setError("agent.error.internal");
        inFlightRef.current = null;
        return;
      }

      try {
        for await (const ev of parseSseStream(res.body)) {
          setEvents((prev) => [...prev, ev]);
          if (ev.type === "done") {
            setLastRunUsage(ev.usage);
            setState("done");
          } else if (ev.type === "error") {
            setError(ev.errorKey);
            setState(ev.errorKey === "agent.error.cancelled" ? "cancelled" : "error");
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState("cancelled");
          setError("agent.error.cancelled");
        } else {
          setState("error");
          setError("agent.error.internal");
        }
      } finally {
        inFlightRef.current = null;
      }
    },
    [fetchImpl, state],
  );

  return {
    state,
    events,
    lastRunUsage,
    error,
    runId,
    start,
    cancel,
    reset,
  };
}
