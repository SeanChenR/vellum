/**
 * cursor-ai-badge.test.ts — verifies the badge state-to-instance-meta mapping.
 *
 * Spec ref: ai-side-panel "Cursor AI Badge surfaces aiActive presence flag"
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderHook, cleanup } from "@testing-library/react";
import { shouldShowAiBadge, useCursorAiBadge, type AiBadgeEditor } from "./cursor-ai-badge";

afterEach(() => cleanup());

function fakeEditor(): { editor: AiBadgeEditor; calls: Array<{ meta?: unknown }> } {
  const calls: Array<{ meta?: unknown }> = [];
  return {
    calls,
    editor: {
      updateInstanceState: mock((partial: { meta?: unknown }) => {
        calls.push(partial);
      }) as AiBadgeEditor["updateInstanceState"],
    },
  };
}

describe("shouldShowAiBadge", () => {
  test("running → true", () => {
    expect(shouldShowAiBadge("running")).toBe(true);
  });

  test("idle / done / error / cancelled → false", () => {
    expect(shouldShowAiBadge("idle")).toBe(false);
    expect(shouldShowAiBadge("done")).toBe(false);
    expect(shouldShowAiBadge("error")).toBe(false);
    expect(shouldShowAiBadge("cancelled")).toBe(false);
  });
});

describe("useCursorAiBadge", () => {
  test("calls updateInstanceState with aiActive=true on mount when state=running", () => {
    const f = fakeEditor();
    renderHook(() => useCursorAiBadge(f.editor, "running"));
    expect(f.calls.length).toBe(1);
    const firstCall = f.calls[0]!;
    expect((firstCall.meta as { aiActive: boolean }).aiActive).toBe(true);
  });

  test("flips to aiActive=false when state moves to a terminal", () => {
    const f = fakeEditor();
    const { rerender } = renderHook(
      (args: { state: import("./useAgentRun").AgentRunState }) =>
        useCursorAiBadge(f.editor, args.state),
      { initialProps: { state: "running" as import("./useAgentRun").AgentRunState } },
    );

    rerender({ state: "done" });
    expect(f.calls.length).toBe(2);
    const secondCall = f.calls[1]!;
    expect((secondCall.meta as { aiActive: boolean }).aiActive).toBe(false);
  });

  test("noop when editor is null", () => {
    const f = fakeEditor();
    renderHook(() => useCursorAiBadge(null, "running"));
    expect(f.calls.length).toBe(0);
  });
});
