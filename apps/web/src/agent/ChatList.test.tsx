/**
 * ChatList.test.tsx — message variant rendering + streaming caret behavior.
 *
 * Spec ref: ai-side-panel "Panel renders chat list with four message kinds"
 */

import "../i18n";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ChatList } from "./ChatList";
import type { AiMessage } from "./useAgentThread";

afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

function msg(overrides: Partial<AiMessage> & { id: string; role: AiMessage["role"] }): AiMessage {
  return {
    id: overrides.id,
    threadId: "t1",
    role: overrides.role,
    content: overrides.content ?? {},
    toolName: overrides.toolName ?? null,
    toolCallId: overrides.toolCallId ?? null,
    tokenUsage: overrides.tokenUsage ?? null,
    provider: overrides.provider ?? null,
    model: overrides.model ?? null,
    runId: overrides.runId ?? null,
    createdAt: overrides.createdAt ?? "2026-05-09T00:00:00Z",
  };
}

describe("ChatList — four message kinds", () => {
  test("renders user / assistant / tool_call / tool_result with distinct test ids", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "user", content: { text: "hi" } }),
      msg({ id: "2", role: "assistant", content: { text: "hello" } }),
      msg({
        id: "3",
        role: "tool",
        content: { kind: "call", name: "createShape", args: { type: "markdown" } },
        toolName: "createShape",
        toolCallId: "c1",
      }),
      msg({
        id: "4",
        role: "tool",
        content: { kind: "result", result: { ok: true, shapeId: "shape:abc" } },
        toolName: "createShape",
        toolCallId: "c1",
      }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    expect(screen.getByTestId("chat-message-user")).toBeDefined();
    expect(screen.getByTestId("chat-message-assistant")).toBeDefined();
    expect(screen.getByTestId("chat-message-tool-call")).toBeDefined();
    expect(screen.getByTestId("chat-message-tool-result")).toBeDefined();
  });
});

describe("ChatList — streaming caret on the last assistant", () => {
  test("caret shown when isStreaming=true and message is the last assistant", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "user", content: { text: "hi" } }),
      msg({ id: "2", role: "assistant", content: { text: "partial..." } }),
    ];
    wrap(<ChatList messages={messages} isStreaming={true} />);
    const bubble = screen.getByTestId("chat-message-assistant");
    expect(bubble.textContent ?? "").toContain("▍");
  });

  test("caret hidden when run is no longer streaming", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "user", content: { text: "hi" } }),
      msg({ id: "2", role: "assistant", content: { text: "done" } }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    const bubble = screen.getByTestId("chat-message-assistant");
    expect(bubble.textContent ?? "").not.toContain("▍");
  });
});

describe("ChatList — assistant bubbles render markdown", () => {
  test("bold syntax `**text**` renders as a <strong> element", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "assistant", content: { text: "this is **bold** text" } }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    const bubble = screen.getByTestId("chat-message-assistant");
    const strong = bubble.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("bold");
  });

  test("list syntax renders as a <ul> with <li> children", () => {
    const messages: AiMessage[] = [
      msg({
        id: "1",
        role: "assistant",
        content: { text: "Done:\n- created shape:a\n- created shape:b" },
      }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    const bubble = screen.getByTestId("chat-message-assistant");
    const ul = bubble.querySelector("ul");
    expect(ul).not.toBeNull();
    const items = ul?.querySelectorAll("li") ?? [];
    expect(items.length).toBe(2);
  });

  test("inline code syntax `` `code` `` renders as a <code> element", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "assistant", content: { text: "I called `createShape`." } }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    const bubble = screen.getByTestId("chat-message-assistant");
    const code = bubble.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("createShape");
  });

  test("user message bubbles do NOT render markdown (plain text only)", () => {
    const messages: AiMessage[] = [
      msg({ id: "1", role: "user", content: { text: "show me **bold**" } }),
    ];
    wrap(<ChatList messages={messages} isStreaming={false} />);
    const bubble = screen.getByTestId("chat-message-user");
    // The literal asterisks remain — user input is rendered as plain text
    // to avoid prompt-injection-via-markdown attack surface.
    expect(bubble.textContent ?? "").toContain("**bold**");
    expect(bubble.querySelector("strong")).toBeNull();
  });

  test("streaming bubble renders markdown as it streams", () => {
    wrap(<ChatList messages={[]} isStreaming={true} streamingText="Result: **success**" />);
    const stream = screen.getByTestId("chat-message-assistant-streaming");
    const strong = stream.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe("success");
  });
});
