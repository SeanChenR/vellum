/**
 * dialog motion integration test — task 10.5.
 *
 * Spec: motion-system — "Existing dialogs receive enter and exit motion"
 *   - duration MUST be 180ms when reduced-motion=false
 *   - duration MUST be 0ms when reduced-motion=true
 *
 * Strategy: render a dialog wrapped in DialogMotion + DialogPanel and
 * assert the underlying motion props (via the same data-attribute
 * surface used in primitives.test.tsx). Toggle the reduced-motion
 * mock between the two cases.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import React from "react";

let reducedMotion = false;

mock.module("motion/react", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      className,
      ...rest
    }: {
      children?: React.ReactNode;
      initial?: Record<string, unknown>;
      animate?: Record<string, unknown>;
      exit?: Record<string, unknown>;
      transition?: { duration?: number };
      className?: string;
    } & Record<string, unknown>) => {
      return (
        <div
          className={className}
          data-initial={JSON.stringify(initial ?? {})}
          data-animate={JSON.stringify(animate ?? {})}
          data-exit={JSON.stringify(exit ?? {})}
          data-transition={JSON.stringify(transition ?? {})}
          {...rest}
        >
          {children}
        </div>
      );
    },
  },
  useReducedMotion: () => reducedMotion,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const { DialogMotion, DialogPanel, DIALOG_MOTION_DURATION_MS } = await import("./dialog");

afterEach(() => {
  cleanup();
  reducedMotion = false;
});

describe("DialogMotion + DialogPanel — duration depends on reduced-motion", () => {
  test("with reduced-motion=false: overlay and panel both use 180ms", () => {
    reducedMotion = false;
    const { container } = render(
      <DialogMotion open={true} className="overlay">
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    const overlay = container.querySelector(".overlay") as HTMLElement;
    const panel = container.querySelector(".panel") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(panel).not.toBeNull();
    const overlayTransition = JSON.parse(overlay.getAttribute("data-transition")!);
    const panelTransition = JSON.parse(panel.getAttribute("data-transition")!);
    const expectedSeconds = DIALOG_MOTION_DURATION_MS / 1000;
    expect(overlayTransition.duration).toBeCloseTo(expectedSeconds, 5);
    expect(panelTransition.duration).toBeCloseTo(expectedSeconds, 5);
  });

  test("with reduced-motion=true: both overlay and panel transitions are 0", () => {
    reducedMotion = true;
    const { container } = render(
      <DialogMotion open={true} className="overlay">
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    const overlay = container.querySelector(".overlay") as HTMLElement;
    const panel = container.querySelector(".panel") as HTMLElement;
    expect(JSON.parse(overlay.getAttribute("data-transition")!).duration).toBe(0);
    expect(JSON.parse(panel.getAttribute("data-transition")!).duration).toBe(0);
  });

  test("with reduced-motion=true: panel starts at scale 1 (no scale offset)", () => {
    reducedMotion = true;
    const { container } = render(
      <DialogMotion open={true}>
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    const panel = container.querySelector(".panel") as HTMLElement;
    const initial = JSON.parse(panel.getAttribute("data-initial")!);
    expect(initial.scale).toBe(1);
  });

  test("with reduced-motion=false: panel initial scale is 0.95", () => {
    reducedMotion = false;
    const { container } = render(
      <DialogMotion open={true}>
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    const panel = container.querySelector(".panel") as HTMLElement;
    const initial = JSON.parse(panel.getAttribute("data-initial")!);
    expect(initial.scale).toBeCloseTo(0.95, 5);
  });
});

describe("DialogMotion — gating on `open`", () => {
  test("renders nothing when open=false (AnimatePresence handles unmount)", () => {
    reducedMotion = false;
    const { container } = render(
      <DialogMotion open={false} className="overlay">
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    expect(container.querySelector(".overlay")).toBeNull();
  });

  test("renders the overlay + panel when open=true", () => {
    const { container } = render(
      <DialogMotion open={true} className="overlay">
        <DialogPanel className="panel">content</DialogPanel>
      </DialogMotion>,
    );
    expect(container.querySelector(".overlay")).not.toBeNull();
    expect(container.querySelector(".panel")).not.toBeNull();
  });
});
