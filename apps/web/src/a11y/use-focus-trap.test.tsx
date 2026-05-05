/**
 * useFocusTrap tests — a11y spec "System provides a reusable focus-trap
 * React hook".
 *
 * Verifies the four scenarios from the spec:
 *   - Activating the trap moves focus into the container
 *   - Tab from last → first
 *   - Shift+Tab from first → last
 *   - Deactivating restores focus to the previous element
 *
 * Plus the edge case: previous element unmounted before deactivation.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, fireEvent } from "@testing-library/react";
import React, { useRef } from "react";
import { useFocusTrap } from "./use-focus-trap";

afterEach(() => cleanup());

interface HarnessProps {
  active: boolean;
  buttons?: number;
  trigger?: HTMLElement;
}

function TrapHarness({ active, buttons = 3 }: HarnessProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap({ active, ref });
  return (
    <div ref={ref} data-testid="trap">
      {Array.from({ length: buttons }).map((_, i) => (
        <button key={i} data-testid={`b${i}`}>
          B{i}
        </button>
      ))}
    </div>
  );
}

describe("useFocusTrap — initial focus", () => {
  test("active=true on mount: first focusable receives focus", () => {
    const { getByTestId } = render(<TrapHarness active={true} />);
    expect(document.activeElement).toBe(getByTestId("b0"));
  });

  test("active=false on mount: focus stays where it was", () => {
    // External button outside the trap
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    render(<TrapHarness active={false} />);
    expect(document.activeElement).toBe(outside);

    document.body.removeChild(outside);
  });
});

describe("useFocusTrap — Tab cycle", () => {
  test("Tab from the last focusable wraps to the first", () => {
    const { getByTestId } = render(<TrapHarness active={true} buttons={3} />);
    const last = getByTestId("b2");
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(getByTestId("trap"), { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("b0"));
  });

  test("Tab from a non-last focusable does NOT wrap (browser default)", () => {
    const { getByTestId } = render(<TrapHarness active={true} buttons={3} />);
    const middle = getByTestId("b1");
    middle.focus();
    fireEvent.keyDown(getByTestId("trap"), { key: "Tab" });
    // The trap only intercepts at the boundaries. happy-dom does not
    // simulate native Tab focus advancement, so focus stays on b1 —
    // the assertion verifies the trap did not move focus elsewhere.
    expect(document.activeElement).toBe(middle);
  });

  test("Shift+Tab from the first focusable wraps to the last", () => {
    const { getByTestId } = render(<TrapHarness active={true} buttons={3} />);
    const first = getByTestId("b0");
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(getByTestId("trap"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(getByTestId("b2"));
  });
});

describe("useFocusTrap — focus restoration", () => {
  test("active toggling false → true → false: focus restored to previous element", () => {
    const outside = document.createElement("button");
    outside.textContent = "outside";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    function Toggle({ active }: { active: boolean }) {
      return <TrapHarness active={active} />;
    }
    const { rerender } = render(<Toggle active={true} />);
    // Trap moves focus into container.
    expect(document.activeElement).not.toBe(outside);

    rerender(<Toggle active={false} />);
    // After deactivation, focus returns to the previously-focused element.
    expect(document.activeElement).toBe(outside);

    document.body.removeChild(outside);
  });

  test("previous element unmounted before deactivation: no throw", () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    function Toggle({ active }: { active: boolean }) {
      return <TrapHarness active={active} />;
    }
    const { rerender } = render(<Toggle active={true} />);
    expect(document.activeElement).not.toBe(outside);

    // Remove the previously-focused element while the trap is still active.
    document.body.removeChild(outside);

    // Deactivation must NOT throw even though the previous element is gone.
    expect(() => {
      rerender(<Toggle active={false} />);
    }).not.toThrow();
  });
});
