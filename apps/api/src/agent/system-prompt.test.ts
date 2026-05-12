/**
 * system-prompt.test.ts — buildSystemPrompt unit tests.
 *
 * The system prompt is prepended to every agent run's conversation by
 * runtime.ts. It carries (1) static behavioural discipline so the model
 * doesn't fabricate canvas changes or stack shapes at the origin, and
 * (2) a dynamic snapshot digest of the current canvas state so the
 * model has spatial awareness before its first tool call.
 */

import { describe, expect, test } from "bun:test";
import { buildSystemPrompt, type SystemPromptInput } from "./system-prompt";

function input(overrides: Partial<SystemPromptInput> = {}): SystemPromptInput {
  return {
    canvasBounds: null,
    shapes: [],
    stateAvailable: true,
    ...overrides,
  };
}

describe("buildSystemPrompt — static behavioural discipline", () => {
  test("instructs the model to read before creating multiple shapes", () => {
    const p = buildSystemPrompt(input());
    expect(p.toLowerCase()).toContain("before placing");
    expect(p).toMatch(/getCanvasBounds|listShapesInViewport|listAllShapes|canvas state/i);
  });

  test("instructs the model to avoid overlap and keep spacing", () => {
    const p = buildSystemPrompt(input());
    expect(p).toMatch(/overlap|spacing|space between|gap/i);
  });

  test("instructs the model to call getShape before updateShape", () => {
    const p = buildSystemPrompt(input());
    expect(p).toContain("getShape");
    expect(p).toContain("updateShape");
  });

  test("instructs the model not to claim a change it did not make", () => {
    const p = buildSystemPrompt(input());
    expect(p.toLowerCase()).toMatch(/do not claim|never claim|don't claim|honest|actually/);
  });

  test("specifies a concrete minimum spacing of at least 80 px", () => {
    const p = buildSystemPrompt(input());
    // 32 px was too tight in M14 verification (arrow + label between shapes
    // needs more room). Spec the new floor at 80 px.
    expect(p).toMatch(/80\s*px/);
  });

  test("instructs the model to lay branching structures left-right, not stacked vertically", () => {
    const p = buildSystemPrompt(input());
    expect(p.toLowerCase()).toMatch(/branch/);
    expect(p.toLowerCase()).toMatch(/left[- ]?right|side[- ]?by[- ]?side|horizontally|same\s+y/);
  });

  test("instructs the model to plan layout in plain text before issuing tool calls", () => {
    const p = buildSystemPrompt(input());
    expect(p.toLowerCase()).toMatch(/plan|sketch|outline/);
    expect(p.toLowerCase()).toMatch(/before|first|prior to/);
  });
});

describe("buildSystemPrompt — dynamic canvas digest", () => {
  test("reports an empty canvas explicitly when there are no shapes", () => {
    const p = buildSystemPrompt(input({ shapes: [], canvasBounds: null }));
    expect(p.toLowerCase()).toContain("empty");
  });

  test("lists existing shapes with id, type, x, y, w, h", () => {
    const p = buildSystemPrompt(
      input({
        canvasBounds: { x: 0, y: 0, w: 300, h: 200 },
        shapes: [
          {
            id: "shape:a",
            type: "markdown",
            x: 100,
            y: 100,
            w: 200,
            h: 100,
            parentId: "page:page",
            rotation: 0,
            meta: {},
            props: {},
          },
        ],
      }),
    );
    expect(p).toContain("shape:a");
    expect(p).toContain("markdown");
    expect(p).toMatch(/100/);
    expect(p).toMatch(/200/);
  });

  test("reports overall canvas bounds when provided", () => {
    const p = buildSystemPrompt(
      input({
        canvasBounds: { x: -50, y: -50, w: 1000, h: 800 },
        shapes: [
          {
            id: "shape:a",
            type: "callout",
            x: 0,
            y: 0,
            w: 100,
            h: 50,
            parentId: "page:page",
            rotation: 0,
            meta: {},
            props: {},
          },
        ],
      }),
    );
    expect(p).toMatch(/-50/);
    expect(p).toMatch(/1000/);
    expect(p).toMatch(/800/);
  });

  test("truncates the per-shape list when there are too many shapes", () => {
    const shapes = Array.from({ length: 60 }, (_, i) => ({
      id: `shape:s${i}`,
      type: "markdown",
      x: i * 10,
      y: i * 10,
      w: 50,
      h: 50,
      parentId: "page:page",
      rotation: 0,
      meta: {},
      props: {},
    }));
    const p = buildSystemPrompt(
      input({
        canvasBounds: { x: 0, y: 0, w: 1000, h: 1000 },
        shapes,
      }),
    );
    // Don't dump 60 lines — must indicate truncation.
    expect(p).toMatch(/more|truncated|\.\.\.|omitted/i);
    expect(p).toContain("60");
  });

  test("flags unavailable state explicitly so the model knows to call read tools first", () => {
    const p = buildSystemPrompt(input({ stateAvailable: false }));
    expect(p.toLowerCase()).toMatch(/unavailable|not available|cannot read/);
  });
});
