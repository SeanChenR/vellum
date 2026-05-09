/**
 * cancel.ts — in-memory per-process registry mapping agent runId to its
 * AbortController.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/agent-runtime/spec.md
 *     "Cancellation registry releases resources on terminal state"
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Cancellation registry: in-memory per-process"
 *
 * The registry deliberately does not persist across server restarts —
 * single-binary architecture means a restart drops every in-flight SSE
 * connection, which clients observe as run termination. The 'no reused
 * runId' policy is enforced at the endpoint layer (streaming-channel
 * spec) so this module stays a pure data structure.
 */

/**
 * Deps interface that the agent runtime and SSE endpoint depend on.
 * Tests inject a fresh CancellationRegistry; production code shares a
 * single instance wired in apps/api/src/agent/wiring.ts.
 */
export interface CancellationRegistryDeps {
  register(runId: string): AbortController;
  has(runId: string): boolean;
  abort(runId: string): boolean;
  release(runId: string): void;
}

export class CancellationRegistry implements CancellationRegistryDeps {
  #controllers = new Map<string, AbortController>();

  register(runId: string): AbortController {
    if (this.#controllers.has(runId)) {
      throw new Error(`runId already registered: ${runId}`);
    }
    const controller = new AbortController();
    this.#controllers.set(runId, controller);
    return controller;
  }

  has(runId: string): boolean {
    return this.#controllers.has(runId);
  }

  abort(runId: string): boolean {
    const controller = this.#controllers.get(runId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  release(runId: string): void {
    this.#controllers.delete(runId);
  }

  get size(): number {
    return this.#controllers.size;
  }
}
