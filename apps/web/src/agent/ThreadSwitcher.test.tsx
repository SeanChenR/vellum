/**
 * ThreadSwitcher.test.tsx — switcher actions + ordering.
 *
 * Spec ref: ai-side-panel "Thread switcher allows multi-thread navigation"
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ThreadSwitcher } from "./ThreadSwitcher";
import type { AiThreadSummary } from "./useAgentThread";

afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const T1: AiThreadSummary = {
  id: "t1",
  title: "older",
  createdAt: "2026-05-08T00:00:00Z",
  updatedAt: "2026-05-08T00:00:00Z",
};
const T2: AiThreadSummary = {
  id: "t2",
  title: "newer",
  createdAt: "2026-05-09T00:00:00Z",
  updatedAt: "2026-05-09T00:00:00Z",
};

describe("ThreadSwitcher — selection + create", () => {
  test("clicking + New chat invokes onCreate", () => {
    const onCreate = mock(() => {});
    wrap(
      <ThreadSwitcher
        threads={[T2, T1]}
        activeThreadId="t2"
        onSelect={() => {}}
        onCreate={onCreate}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("thread-switcher-toggle"));
    fireEvent.click(screen.getByTestId("thread-switcher-new"));
    expect(onCreate).toHaveBeenCalled();
  });

  test("clicking a row invokes onSelect with that thread id", () => {
    const onSelect = mock(() => {});
    wrap(
      <ThreadSwitcher
        threads={[T2, T1]}
        activeThreadId="t2"
        onSelect={onSelect}
        onCreate={() => {}}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("thread-switcher-toggle"));
    const rows = screen.getAllByTestId("thread-switcher-row");
    // Click t1 (the second row, since t2 is the active+newest at top).
    const t1Row = rows.find((r) => r.getAttribute("data-thread-id") === "t1")!;
    fireEvent.click(t1Row.querySelector("button")!);
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  test("delete button invokes onDelete with thread id", () => {
    const onDelete = mock(() => {});
    wrap(
      <ThreadSwitcher
        threads={[T2, T1]}
        activeThreadId="t2"
        onSelect={() => {}}
        onCreate={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByTestId("thread-switcher-toggle"));
    const deletes = screen.getAllByTestId("thread-switcher-delete");
    fireEvent.click(deletes[0]!);
    expect(onDelete).toHaveBeenCalled();
  });
});
