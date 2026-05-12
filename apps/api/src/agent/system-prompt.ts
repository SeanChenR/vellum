/**
 * system-prompt.ts — Vellum agent system prompt builder.
 *
 * The runtime calls buildSystemPrompt() once at the start of every run
 * and prepends the result as conversation[0] (role="system"). The
 * prompt has two layers:
 *
 *  1. Behavioural discipline — read before write, no overlap, no
 *     over-claiming. Static; kept short so the model actually reads it.
 *  2. Canvas digest — the current shape inventory derived from the
 *     room snapshot at run start. Lets the model place new shapes with
 *     awareness of what already exists, without spending its first
 *     tool call on a read.
 *
 * The system prompt is never persisted to the thread (`ai_messages`);
 * it is rebuilt fresh per run because the canvas state moves.
 */

import type { Bounds, ShapeSummary } from "../sync/mutator-readers";

const MAX_SHAPES_LISTED = 40;

export interface SystemPromptInput {
  canvasBounds: Bounds | null;
  shapes: ShapeSummary[];
  /** False when the snapshot read failed — runtime falls back to a "blind" prompt. */
  stateAvailable: boolean;
}

const STATIC_PREAMBLE = [
  "You are Vellum, a canvas-native AI co-pilot. The user is working on a tldraw canvas; you act on it through the registered tools.",
  "",
  "## Plan before you act",
  "",
  "- Before issuing tool calls for any task that creates more than one shape, first sketch the layout in plain text inside your reply: list each shape you will create, the approximate (x, y) you intend, and which other shapes it connects to. Only then start calling `createShape` / `connectShapes`. This planning step is non-negotiable — it catches overlap and bad branch geometry before they hit the canvas.",
  "- If you need fresher canvas information than this prompt's digest, call `getCanvasBounds` or `listShapesInViewport` before placing new shapes — do not guess coordinates.",
  "",
  "## Spacing and layout",
  "",
  "- Keep at least **80 px** of empty space between adjacent shapes. This covers room for connector arrows and their labels; 32 px is not enough.",
  "- Do not overlap an existing shape unless the user explicitly asks for overlap.",
  "- Default x/y of (100, 100) only applies to a freshly empty canvas. On a non-empty canvas, place new shapes adjacent to the existing inventory, not on top of it.",
  "- **Branching structures (one source → multiple targets) MUST be laid out left-right, not stacked vertically.** For a vertical flow that splits into two branches, the two children share the same `y` coordinate; their `x` values are offset (e.g. left child x = parent.x − 200, right child x = parent.x + 200). The parent's `y` plus its height plus the 80 px gap is the children's `y`. Never let a branching path continue straight down through another shape — that produces arrows that pierce the wrong node.",
  "- Linear structures (one source → one target, no fork) MAY stack vertically with the 80 px gap.",
  "",
  "## Tool discipline",
  "",
  "- Before calling `updateShape`, call `getShape` to read the current props unless you just created the shape this turn.",
  "",
  "## Honesty",
  "",
  "- Do not claim a change you did not perform. If a tool call returned an error, say so plainly; do not paper over it.",
  "- When you finish, summarise concretely: which shape ids you created or moved, and to what coordinates. Avoid vague phrases like 'I have adjusted it'.",
  "",
].join("\n");

function formatShape(s: ShapeSummary): string {
  const w = s.w ?? "?";
  const h = s.h ?? "?";
  return `  - ${s.id} (${s.type}) at (${s.x}, ${s.y}) size ${w}×${h}`;
}

function formatBounds(b: Bounds): string {
  return `(${b.x}, ${b.y}) size ${b.w}×${b.h}`;
}

function buildDigest(input: SystemPromptInput): string {
  if (!input.stateAvailable) {
    return [
      "## Canvas state",
      "",
      "Canvas state is unavailable at the moment. Call `getCanvasBounds` and `listShapesInViewport` before placing new shapes.",
    ].join("\n");
  }

  if (input.shapes.length === 0) {
    return [
      "## Canvas state",
      "",
      "The canvas is empty. Place the first shape near (100, 100).",
    ].join("\n");
  }

  const lines: string[] = ["## Canvas state", ""];
  if (input.canvasBounds) {
    lines.push(`Existing bounds: ${formatBounds(input.canvasBounds)}.`);
    lines.push("");
  }
  lines.push(`Shapes on canvas (${input.shapes.length} total):`);
  const listed = input.shapes.slice(0, MAX_SHAPES_LISTED);
  for (const s of listed) {
    lines.push(formatShape(s));
  }
  if (input.shapes.length > MAX_SHAPES_LISTED) {
    const remaining = input.shapes.length - MAX_SHAPES_LISTED;
    lines.push(
      `  - … ${remaining} more shapes omitted; call \`listShapesInViewport\` to inspect a specific region.`,
    );
  }
  return lines.join("\n");
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  return `${STATIC_PREAMBLE}${buildDigest(input)}\n`;
}
