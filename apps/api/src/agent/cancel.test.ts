/**
 * cancel.test.ts — in-memory cancellation registry for agent runs.
 *
 * Spec ref:
 *   openspec/changes/add-agent-runtime-streaming/specs/agent-runtime/spec.md
 *     "Cancellation registry releases resources on terminal state"
 *
 * Design ref:
 *   openspec/changes/add-agent-runtime-streaming/design.md
 *     "Cancellation registry: in-memory per-process"
 */

import { describe, expect, it } from "bun:test";
import { CancellationRegistry } from "./cancel";

const RUN_A = "11111111-1111-4111-8111-111111111111";
const RUN_B = "22222222-2222-4222-8222-222222222222";

describe("CancellationRegistry.register", () => {
  it("returns a fresh AbortController whose signal is not aborted", () => {
    const registry = new CancellationRegistry();
    const controller = registry.register(RUN_A);
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);
  });

  it("makes the run discoverable via has()", () => {
    const registry = new CancellationRegistry();
    expect(registry.has(RUN_A)).toBe(false);
    registry.register(RUN_A);
    expect(registry.has(RUN_A)).toBe(true);
  });

  it("rejects re-registering the same runId (would leak controller)", () => {
    const registry = new CancellationRegistry();
    registry.register(RUN_A);
    expect(() => registry.register(RUN_A)).toThrow();
  });
});

describe("CancellationRegistry.abort", () => {
  it("aborts the AbortController for the given runId", () => {
    const registry = new CancellationRegistry();
    const controller = registry.register(RUN_A);
    const aborted = registry.abort(RUN_A);
    expect(aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it("returns false for an unknown runId (idempotent cancel)", () => {
    const registry = new CancellationRegistry();
    expect(registry.abort(RUN_A)).toBe(false);
  });

  it("only aborts the targeted run", () => {
    const registry = new CancellationRegistry();
    const a = registry.register(RUN_A);
    const b = registry.register(RUN_B);
    registry.abort(RUN_A);
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);
  });
});

describe("CancellationRegistry.release", () => {
  it("removes the runId from the registry on terminal transition", () => {
    const registry = new CancellationRegistry();
    registry.register(RUN_A);
    expect(registry.has(RUN_A)).toBe(true);
    registry.release(RUN_A);
    expect(registry.has(RUN_A)).toBe(false);
  });

  it("does not abort the controller (release is for done/error/timeout)", () => {
    const registry = new CancellationRegistry();
    const controller = registry.register(RUN_A);
    registry.release(RUN_A);
    expect(controller.signal.aborted).toBe(false);
  });

  it("is a no-op for unknown runId", () => {
    const registry = new CancellationRegistry();
    expect(() => registry.release(RUN_A)).not.toThrow();
  });

  it("allows the same runId to be reused after release (rejected by endpoint, not registry)", () => {
    // The 'no reused runId' policy is enforced at the endpoint layer
    // (streaming-channel spec "Connection close on terminal state").
    // The registry itself permits register-after-release so per-process
    // recycling stays simple.
    const registry = new CancellationRegistry();
    registry.register(RUN_A);
    registry.release(RUN_A);
    expect(() => registry.register(RUN_A)).not.toThrow();
  });
});

describe("CancellationRegistry.size", () => {
  it("reports the number of currently tracked runs", () => {
    const registry = new CancellationRegistry();
    expect(registry.size).toBe(0);
    registry.register(RUN_A);
    registry.register(RUN_B);
    expect(registry.size).toBe(2);
    registry.abort(RUN_A);
    registry.release(RUN_A);
    expect(registry.size).toBe(1);
  });
});
