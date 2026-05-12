/**
 * repo.test.ts — Contract tests for the ThreadRepo interface.
 *
 * Tests run against the in-memory implementation (`buildInMemoryThreadRepo`)
 * which mirrors the DB-backed behavior. The same `ThreadRepo` contract is
 * what production wires in `wiring.ts` via the drizzle-backed builder, so
 * any handler / runtime that consumes the interface can swap fakes for
 * real without surprise.
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 *   - Thread messages are persisted in chronological order
 *   - Thread CRUD endpoints (repo level)
 *   - Background title generation after first run (fallback rules)
 */

import { describe, expect, test } from "bun:test";
import { buildInMemoryThreadRepo } from "./repo";

describe("ThreadRepo (in-memory): chronological message ordering", () => {
  test("loadMessages returns rows ordered by created_at ASC", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({
      userId: "u1",
      canvasId: "c1",
      title: "test",
    });
    const m1 = await repo.appendMessage(t.id, { role: "user", content: { text: "M1" } });
    // Force monotonic timestamps so ordering is deterministic regardless
    // of clock granularity (in-process test scheduling can produce ties).
    repo._test_advanceClock!(1);
    const m2 = await repo.appendMessage(t.id, { role: "assistant", content: { text: "M2" } });
    repo._test_advanceClock!(1);
    const m3 = await repo.appendMessage(t.id, {
      role: "tool",
      content: { kind: "call", name: "createShape" },
      toolName: "createShape",
      toolCallId: "c1",
    });
    repo._test_advanceClock!(1);
    const m4 = await repo.appendMessage(t.id, {
      role: "tool",
      content: { kind: "result", result: { ok: true } },
      toolName: "createShape",
      toolCallId: "c1",
    });
    repo._test_advanceClock!(1);
    const m5 = await repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "M5" },
    });

    const rows = await repo.loadMessages(t.id);
    expect(rows.map((r) => r.id)).toEqual([m1.id, m2.id, m3.id, m4.id, m5.id]);
  });

  test("appendMessage bumps thread.updated_at", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    const before = t.updatedAt.getTime();
    repo._test_advanceClock!(10);
    await repo.appendMessage(t.id, { role: "user", content: { text: "hi" } });
    const after = await repo.getThread(t.id);
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe("ThreadRepo (in-memory): setUsageOnLastAssistant", () => {
  test("only updates the most recent assistant row, scoped by run_id", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });

    await repo.appendMessage(t.id, { role: "user", content: { text: "hi" } });
    repo._test_advanceClock!(1);
    const a1 = await repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A1" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r1",
    });
    repo._test_advanceClock!(1);
    const a2 = await repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A2" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r1",
    });

    await repo.setUsageOnLastAssistant(t.id, "r1", { input: 1000, output: 500 });

    const rows = await repo.loadMessages(t.id);
    const a1After = rows.find((r) => r.id === a1.id);
    const a2After = rows.find((r) => r.id === a2.id);
    expect(a1After?.tokenUsage).toBeNull();
    expect(a2After?.tokenUsage).toEqual({ input: 1000, output: 500 });
  });

  test("noop when no assistant rows for the runId exist", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    await repo.appendMessage(t.id, { role: "user", content: { text: "hi" } });
    // No assistant row at all → must not throw, must not mutate.
    await repo.setUsageOnLastAssistant(t.id, "r1", { input: 50, output: 25 });
    const rows = await repo.loadMessages(t.id);
    expect(rows.every((r) => r.tokenUsage === null)).toBe(true);
  });
});

describe("ThreadRepo (in-memory): listThreads + multi-thread per (user, canvas)", () => {
  test("multiple threads coexist for the same (user, canvas) pair", async () => {
    const repo = buildInMemoryThreadRepo();
    const t1 = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    repo._test_advanceClock!(1);
    const t2 = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });

    const list = await repo.listThreads("u1", "c1");
    expect(list.length).toBe(2);
    expect(new Set(list.map((r) => r.id))).toEqual(new Set([t1.id, t2.id]));
  });

  test("listThreads returns threads ordered by updated_at DESC", async () => {
    const repo = buildInMemoryThreadRepo();
    const t1 = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    repo._test_advanceClock!(10);
    const t2 = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    repo._test_advanceClock!(10);
    // touch t1 by appending a message — should bring it to top
    await repo.appendMessage(t1.id, { role: "user", content: { text: "hi" } });

    const list = await repo.listThreads("u1", "c1");
    expect(list.map((r) => r.id)).toEqual([t1.id, t2.id]);
  });

  test("listThreads filters by both user and canvas", async () => {
    const repo = buildInMemoryThreadRepo();
    await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    await repo.createThread({ userId: "u1", canvasId: "c2", title: "" });
    await repo.createThread({ userId: "u2", canvasId: "c1", title: "" });

    const list = await repo.listThreads("u1", "c1");
    expect(list.length).toBe(1);
  });
});

describe("ThreadRepo (in-memory): clearMessages preserves thread row", () => {
  test("clearMessages drops rows but keeps thread", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "kept" });
    await repo.appendMessage(t.id, { role: "user", content: { text: "1" } });
    await repo.appendMessage(t.id, { role: "user", content: { text: "2" } });

    await repo.clearMessages(t.id);

    expect((await repo.loadMessages(t.id)).length).toBe(0);
    expect((await repo.getThread(t.id))?.id).toBe(t.id);
    expect((await repo.getThread(t.id))?.title).toBe("kept");
  });
});

describe("ThreadRepo (in-memory): deleteThread cascades", () => {
  test("deleteThread removes thread row + all messages", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    await repo.appendMessage(t.id, { role: "user", content: { text: "1" } });

    await repo.deleteThread(t.id);

    expect(await repo.getThread(t.id)).toBeNull();
    expect((await repo.loadMessages(t.id)).length).toBe(0);
  });
});

describe("ThreadRepo (in-memory): aggregateUsage", () => {
  test("aggregateUsage sums all non-null token_usage rows", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    await repo.appendMessage(t.id, { role: "user", content: { text: "hi" } });
    repo._test_advanceClock!(1);
    await repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A1" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r1",
    });
    await repo.setUsageOnLastAssistant(t.id, "r1", { input: 100, output: 50 });
    repo._test_advanceClock!(1);
    await repo.appendMessage(t.id, {
      role: "assistant",
      content: { text: "A2" },
      provider: "openai",
      model: "gpt-4o-mini",
      runId: "r2",
    });
    await repo.setUsageOnLastAssistant(t.id, "r2", { input: 200, output: 75 });

    const usage = await repo.aggregateUsage(t.id);
    expect(usage).toEqual({ input: 300, output: 125 });
  });

  test("aggregateUsage returns 0/0 for empty thread", async () => {
    const repo = buildInMemoryThreadRepo();
    const t = await repo.createThread({ userId: "u1", canvasId: "c1", title: "" });
    expect(await repo.aggregateUsage(t.id)).toEqual({ input: 0, output: 0 });
  });
});
