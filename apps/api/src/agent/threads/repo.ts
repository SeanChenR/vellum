/**
 * repo.ts — ThreadRepo interface + two implementations.
 *
 * The agent runtime, HTTP handlers, and the title-generation background
 * task all depend on `ThreadRepo`. This file exposes:
 *
 *   buildThreadRepo({ db })       — drizzle-backed implementation (production)
 *   buildInMemoryThreadRepo()     — Map-backed implementation (tests / local dev)
 *
 * Both honor the same contract — see repo.test.ts for the contract tests
 * (which run against the in-memory impl; production behavior is verified
 * via integration tests + manual smoke).
 *
 * Spec ref:
 *   openspec/changes/add-ai-side-panel-and-threads/specs/ai-thread/spec.md
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/index";
import { aiMessages, aiThreads } from "../../db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AiThreadRow {
  id: string;
  userId: string;
  canvasId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiMessageRow {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "tool";
  content: unknown;
  toolName: string | null;
  toolCallId: string | null;
  tokenUsage: { input: number; output: number } | null;
  provider: string | null;
  model: string | null;
  runId: string | null;
  createdAt: Date;
}

export interface AppendMessageInput {
  role: "user" | "assistant" | "tool";
  content: unknown;
  toolName?: string;
  toolCallId?: string;
  provider?: string;
  model?: string;
  runId?: string;
}

export interface ThreadRepo {
  createThread(input: { userId: string; canvasId: string; title: string }): Promise<AiThreadRow>;
  listThreads(userId: string, canvasId: string): Promise<AiThreadRow[]>;
  getThread(threadId: string): Promise<AiThreadRow | null>;
  setTitle(threadId: string, title: string): Promise<void>;
  loadMessages(threadId: string): Promise<AiMessageRow[]>;
  appendMessage(threadId: string, input: AppendMessageInput): Promise<AiMessageRow>;
  setUsageOnLastAssistant(
    threadId: string,
    runId: string,
    usage: { input: number; output: number },
  ): Promise<void>;
  clearMessages(threadId: string): Promise<void>;
  deleteThread(threadId: string): Promise<void>;
  aggregateUsage(threadId: string): Promise<{ input: number; output: number }>;
  /** Test-only escape hatch — production callers SHALL ignore. */
  _test_advanceClock?(ms: number): void;
  /** Test-only seed helper — lets tests pre-create a thread with a fixed id. */
  _test_seedThread?(input: {
    id: string;
    userId: string;
    canvasId: string;
    title?: string;
  }): AiThreadRow;
}

// ---------------------------------------------------------------------------
// Drizzle-backed implementation
// ---------------------------------------------------------------------------

export interface ThreadRepoDeps {
  db: Database;
}

export function buildThreadRepo({ db }: ThreadRepoDeps): ThreadRepo {
  return {
    async createThread({ userId, canvasId, title }) {
      const [row] = await db.insert(aiThreads).values({ userId, canvasId, title }).returning();
      if (!row) throw new Error("aiThreads insert returned no row");
      return rowToThread(row);
    },

    async listThreads(userId, canvasId) {
      const rows = await db
        .select()
        .from(aiThreads)
        .where(and(eq(aiThreads.userId, userId), eq(aiThreads.canvasId, canvasId)))
        .orderBy(desc(aiThreads.updatedAt));
      return rows.map(rowToThread);
    },

    async getThread(threadId) {
      const [row] = await db.select().from(aiThreads).where(eq(aiThreads.id, threadId)).limit(1);
      return row ? rowToThread(row) : null;
    },

    async setTitle(threadId, title) {
      await db
        .update(aiThreads)
        .set({ title, updatedAt: new Date() })
        .where(eq(aiThreads.id, threadId));
    },

    async loadMessages(threadId) {
      const rows = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.threadId, threadId))
        .orderBy(asc(aiMessages.createdAt));
      return rows.map(rowToMessage);
    },

    async appendMessage(threadId, input) {
      const [row] = await db
        .insert(aiMessages)
        .values({
          threadId,
          role: input.role,
          content: input.content,
          toolName: input.toolName ?? null,
          toolCallId: input.toolCallId ?? null,
          provider: input.provider ?? null,
          model: input.model ?? null,
          runId: input.runId ?? null,
        })
        .returning();
      if (!row) throw new Error("aiMessages insert returned no row");
      // Bump thread.updated_at so listThreads ordering reflects activity.
      await db.update(aiThreads).set({ updatedAt: new Date() }).where(eq(aiThreads.id, threadId));
      return rowToMessage(row);
    },

    async setUsageOnLastAssistant(threadId, runId, usage) {
      // Find the most recent assistant row matching the runId. A single
      // UPDATE-with-subquery would be ideal but drizzle's portable subquery
      // builder is awkward here; two queries are fine — this path runs
      // exactly once per terminal `done` event.
      const [last] = await db
        .select()
        .from(aiMessages)
        .where(
          and(
            eq(aiMessages.threadId, threadId),
            eq(aiMessages.role, "assistant"),
            eq(aiMessages.runId, runId),
          ),
        )
        .orderBy(desc(aiMessages.createdAt))
        .limit(1);
      if (!last) return;
      await db.update(aiMessages).set({ tokenUsage: usage }).where(eq(aiMessages.id, last.id));
    },

    async clearMessages(threadId) {
      await db.delete(aiMessages).where(eq(aiMessages.threadId, threadId));
    },

    async deleteThread(threadId) {
      // ai_messages cascade-deletes automatically via FK.
      await db.delete(aiThreads).where(eq(aiThreads.id, threadId));
    },

    async aggregateUsage(threadId) {
      const [row] = await db
        .select({
          input: sql<number>`coalesce(sum((token_usage->>'input')::int), 0)`,
          output: sql<number>`coalesce(sum((token_usage->>'output')::int), 0)`,
        })
        .from(aiMessages)
        .where(eq(aiMessages.threadId, threadId));
      return {
        input: Number(row?.input ?? 0),
        output: Number(row?.output ?? 0),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation (tests / local fallback)
// ---------------------------------------------------------------------------

export function buildInMemoryThreadRepo(): ThreadRepo {
  const threads = new Map<string, AiThreadRow>();
  const messages = new Map<string, AiMessageRow[]>();
  let clock = 1_700_000_000_000; // arbitrary fixed start
  let idCounter = 0;

  const nextId = () => `id-${++idCounter}`;
  const now = () => new Date(clock);

  return {
    async createThread({ userId, canvasId, title }) {
      const t: AiThreadRow = {
        id: nextId(),
        userId,
        canvasId,
        title,
        createdAt: now(),
        updatedAt: now(),
      };
      threads.set(t.id, t);
      messages.set(t.id, []);
      return t;
    },

    async listThreads(userId, canvasId) {
      return Array.from(threads.values())
        .filter((t) => t.userId === userId && t.canvasId === canvasId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getThread(threadId) {
      return threads.get(threadId) ?? null;
    },

    async setTitle(threadId, title) {
      const t = threads.get(threadId);
      if (!t) return;
      threads.set(threadId, { ...t, title, updatedAt: now() });
    },

    async loadMessages(threadId) {
      return [...(messages.get(threadId) ?? [])].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    },

    async appendMessage(threadId, input) {
      const m: AiMessageRow = {
        id: nextId(),
        threadId,
        role: input.role,
        content: input.content,
        toolName: input.toolName ?? null,
        toolCallId: input.toolCallId ?? null,
        tokenUsage: null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        runId: input.runId ?? null,
        createdAt: now(),
      };
      const list = messages.get(threadId) ?? [];
      list.push(m);
      messages.set(threadId, list);

      const t = threads.get(threadId);
      if (t) threads.set(threadId, { ...t, updatedAt: now() });
      return m;
    },

    async setUsageOnLastAssistant(threadId, runId, usage) {
      const list = messages.get(threadId) ?? [];
      // Walk in reverse to find the last assistant for this runId.
      for (let i = list.length - 1; i >= 0; i--) {
        const row = list[i]!;
        if (row.role === "assistant" && row.runId === runId) {
          list[i] = { ...row, tokenUsage: { ...usage } };
          return;
        }
      }
    },

    async clearMessages(threadId) {
      messages.set(threadId, []);
    },

    async deleteThread(threadId) {
      threads.delete(threadId);
      messages.delete(threadId);
    },

    async aggregateUsage(threadId) {
      const list = messages.get(threadId) ?? [];
      let input = 0;
      let output = 0;
      for (const r of list) {
        if (r.tokenUsage) {
          input += r.tokenUsage.input;
          output += r.tokenUsage.output;
        }
      }
      return { input, output };
    },

    _test_advanceClock(ms: number) {
      clock += ms;
    },
    _test_seedThread(input) {
      const t: AiThreadRow = {
        id: input.id,
        userId: input.userId,
        canvasId: input.canvasId,
        title: input.title ?? "",
        createdAt: now(),
        updatedAt: now(),
      };
      threads.set(t.id, t);
      messages.set(t.id, []);
      return t;
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rowToThread(row: typeof aiThreads.$inferSelect): AiThreadRow {
  return {
    id: row.id,
    userId: row.userId,
    canvasId: row.canvasId,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToMessage(row: typeof aiMessages.$inferSelect): AiMessageRow {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role as "user" | "assistant" | "tool",
    content: row.content,
    toolName: row.toolName,
    toolCallId: row.toolCallId,
    tokenUsage:
      row.tokenUsage &&
      typeof row.tokenUsage === "object" &&
      "input" in row.tokenUsage &&
      "output" in row.tokenUsage
        ? {
            input: Number((row.tokenUsage as { input: unknown }).input ?? 0),
            output: Number((row.tokenUsage as { output: unknown }).output ?? 0),
          }
        : null,
    provider: row.provider,
    model: row.model,
    runId: row.runId,
    createdAt: row.createdAt,
  };
}
