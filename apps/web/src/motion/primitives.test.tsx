/**
 * motion/primitives tests — covers tasks 3.1 (primitive APIs) + 3.2
 * (prefers-reduced-motion behaviour) of add-landing-and-branding.
 *
 * Spec: motion-system
 *   - "System provides four reusable motion primitives"
 *   - "All motion primitives respect prefers-reduced-motion"
 *
 * We don't test the real animation timing (motion lib drives that with
 * RAF / matchMedia which happy-dom doesn't fully simulate). Instead we
 * assert on the contract:
 *   - Children render
 *   - With reduced-motion=true, no transform is applied to the first
 *     paint (initial opacity 1, no x/y translate, scale 1).
 *   - Stagger primitive forwards an incremental `delay` prop to each
 *     direct child that accepts one.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// motion lib mock — replace with deterministic stubs so tests don't depend
// on framer-motion's real reactive behaviour.
// ---------------------------------------------------------------------------

let reducedMotion = false;

mock.module("motion/react", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      transition,
      className,
      ...rest
    }: {
      children?: React.ReactNode;
      initial?: Record<string, unknown>;
      animate?: Record<string, unknown>;
      transition?: { duration?: number; delay?: number };
      className?: string;
    } & Record<string, unknown>) => {
      // Surface motion props as data attributes so tests can inspect them.
      return (
        <div
          className={className}
          data-initial={JSON.stringify(initial ?? {})}
          data-animate={JSON.stringify(animate ?? {})}
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

const { FadeIn, SlideIn, ScaleIn, StaggerContainer } = await import("./primitives");

afterEach(() => {
  cleanup();
  reducedMotion = false;
});

// ---------------------------------------------------------------------------
// 3.1 Four primitives — render + contract
// ---------------------------------------------------------------------------

describe("FadeIn", () => {
  test("renders children", () => {
    render(<FadeIn>hello fade</FadeIn>);
    expect(screen.getByText("hello fade")).not.toBeNull();
  });

  test("default duration is 600ms (0.6s in motion's seconds unit)", () => {
    const { container } = render(<FadeIn>x</FadeIn>);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(transition.duration).toBeCloseTo(0.6, 5);
  });

  test("custom duration is passed through", () => {
    const { container } = render(<FadeIn duration={1200}>x</FadeIn>);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(transition.duration).toBeCloseTo(1.2, 5);
  });

  test("delay prop is forwarded", () => {
    const { container } = render(<FadeIn delay={150}>x</FadeIn>);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(transition.delay).toBeCloseTo(0.15, 5);
  });

  test("initial opacity is 0 by default (animate from invisible)", () => {
    const { container } = render(<FadeIn>x</FadeIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    expect(initial.opacity).toBe(0);
  });
});

describe("SlideIn", () => {
  test.each([
    ["left", "x", -1],
    ["right", "x", 1],
    ["top", "y", -1],
    ["bottom", "y", 1],
  ] as const)("from=%s sets non-zero initial %s with sign %d", (from, axis, sign) => {
    const { container } = render(<SlideIn from={from}>x</SlideIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    expect(initial[axis]).toBeDefined();
    if (sign === -1) expect(initial[axis]).toBeLessThan(0);
    else expect(initial[axis]).toBeGreaterThan(0);
  });

  test("animates back to zero offset", () => {
    const { container } = render(<SlideIn from="left">x</SlideIn>);
    const animate = JSON.parse((container.firstChild as Element).getAttribute("data-animate")!);
    expect(animate.x).toBe(0);
    expect(animate.opacity).toBe(1);
  });
});

describe("ScaleIn", () => {
  test("initial scale defaults to 0.95", () => {
    const { container } = render(<ScaleIn>x</ScaleIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    expect(initial.scale).toBeCloseTo(0.95, 5);
  });

  test("custom initialScale forwarded", () => {
    const { container } = render(<ScaleIn initialScale={0.8}>x</ScaleIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    expect(initial.scale).toBeCloseTo(0.8, 5);
  });
});

describe("StaggerContainer", () => {
  test("default staggerMs is 80 — children receive 0/80/160ms delays", () => {
    const { container } = render(
      <StaggerContainer>
        <FadeIn>a</FadeIn>
        <FadeIn>b</FadeIn>
        <FadeIn>c</FadeIn>
      </StaggerContainer>,
    );
    const children = Array.from(container.querySelectorAll("[data-transition]"));
    const delays = children.map((el) => JSON.parse(el.getAttribute("data-transition")!).delay ?? 0);
    expect(delays[0]).toBeCloseTo(0, 5);
    expect(delays[1]).toBeCloseTo(0.08, 5);
    expect(delays[2]).toBeCloseTo(0.16, 5);
  });

  test.each([
    [80, [0, 0.08, 0.16]],
    [100, [0, 0.1, 0.2]],
    [200, [0, 0.2, 0.4]],
  ])("staggerMs=%d produces delays %j (in seconds)", (staggerMs, expected) => {
    const { container } = render(
      <StaggerContainer staggerMs={staggerMs}>
        <FadeIn>a</FadeIn>
        <FadeIn>b</FadeIn>
        <FadeIn>c</FadeIn>
      </StaggerContainer>,
    );
    const children = Array.from(container.querySelectorAll("[data-transition]"));
    const delays = children.map((el) => JSON.parse(el.getAttribute("data-transition")!).delay ?? 0);
    for (let i = 0; i < expected.length; i += 1) {
      expect(delays[i]).toBeCloseTo(expected[i]!, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// 3.2 prefers-reduced-motion respect
// ---------------------------------------------------------------------------

describe("reduced-motion mode", () => {
  beforeEach(() => {
    reducedMotion = true;
  });

  test("FadeIn under reduced-motion: duration=0 and initial opacity=1", () => {
    const { container } = render(<FadeIn duration={1000}>x</FadeIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(initial.opacity).toBe(1);
    expect(transition.duration).toBe(0);
  });

  test("SlideIn under reduced-motion: duration=0 and no translation offset", () => {
    const { container } = render(<SlideIn from="left">x</SlideIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(initial.x ?? 0).toBe(0);
    expect(initial.opacity).toBe(1);
    expect(transition.duration).toBe(0);
  });

  test("ScaleIn under reduced-motion: scale starts at 1, duration 0", () => {
    const { container } = render(<ScaleIn initialScale={0.5}>x</ScaleIn>);
    const initial = JSON.parse((container.firstChild as Element).getAttribute("data-initial")!);
    const transition = JSON.parse(
      (container.firstChild as Element).getAttribute("data-transition")!,
    );
    expect(initial.scale).toBe(1);
    expect(transition.duration).toBe(0);
  });

  test("StaggerContainer under reduced-motion: every child delay is 0", () => {
    const { container } = render(
      <StaggerContainer>
        <FadeIn>a</FadeIn>
        <FadeIn>b</FadeIn>
        <FadeIn>c</FadeIn>
      </StaggerContainer>,
    );
    const children = Array.from(container.querySelectorAll("[data-transition]"));
    for (const el of children) {
      const t = JSON.parse(el.getAttribute("data-transition")!);
      expect(t.delay ?? 0).toBe(0);
      expect(t.duration).toBe(0);
    }
  });
});
