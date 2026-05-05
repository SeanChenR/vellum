/**
 * dialog focus trap integration test — task 4.5.
 *
 * Spec: a11y — "All four existing dialogs trap keyboard focus while open".
 *
 * Renders a DialogMotion + DialogPanel with three buttons and verifies:
 *   - Focus is trapped: Tab from last wraps to first; Shift+Tab from
 *     first wraps to last
 *   - Escape still allows the host dialog to close (we simulate the host
 *     by listening for the escape on the trap container)
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, fireEvent } from "@testing-library/react";
import React from "react";

mock.module("motion/react", () => ({
  motion: {
    div: ({
      ref,
      children,
      ...rest
    }: {
      ref?: React.Ref<HTMLDivElement>;
      children?: React.ReactNode;
    } & Record<string, unknown>) => <div ref={ref}>{children}</div>,
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const { DialogMotion, DialogPanel } = await import("./dialog");

afterEach(() => cleanup());

describe("DialogPanel — focus trap integration", () => {
  test("Tab from last button wraps to first inside the panel", () => {
    const { getByTestId } = render(
      <DialogMotion open={true}>
        <DialogPanel className="panel">
          <button data-testid="b0">a</button>
          <button data-testid="b1">b</button>
          <button data-testid="b2">c</button>
        </DialogPanel>
      </DialogMotion>,
    );
    const last = getByTestId("b2");
    last.focus();
    fireEvent.keyDown(last.parentElement!, { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("b0"));
  });

  test("Shift+Tab from first button wraps to last", () => {
    const { getByTestId } = render(
      <DialogMotion open={true}>
        <DialogPanel className="panel">
          <button data-testid="b0">a</button>
          <button data-testid="b1">b</button>
          <button data-testid="b2">c</button>
        </DialogPanel>
      </DialogMotion>,
    );
    const first = getByTestId("b0");
    first.focus();
    fireEvent.keyDown(first.parentElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByTestId("b2"));
  });

  test("Escape on the panel does NOT itself close the dialog (host owns close)", () => {
    // The trap MUST NOT swallow Escape — the host dialog (via its own
    // useEffect keydown listener at the document level) handles it. This
    // test verifies the trap doesn't preventDefault on Escape.
    let prevented = false;
    const { getByTestId } = render(
      <DialogMotion open={true}>
        <DialogPanel className="panel">
          <button data-testid="b0">a</button>
        </DialogPanel>
      </DialogMotion>,
    );
    const first = getByTestId("b0");
    first.focus();
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    first.parentElement!.dispatchEvent(event);
    prevented = event.defaultPrevented;
    expect(prevented).toBe(false);
  });
});
