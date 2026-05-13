/**
 * zod-to-json-schema.test.ts — Zod → JSON Schema converter.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "Zod-to-JSON-Schema conversion is in-tree and snapshot-tested per tool"
 *   - "createShape Zod schema converts to JSON Schema with correct required fields"
 *
 * The converter is a thin wrapper around Zod 4's `z.toJSONSchema()`.
 * Tests pin the contract by exercising every entry in `tool-registry.ts`
 * and asserting the key shape fields each tool's MCP `inputSchema` must
 * carry.
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { zodToJsonSchema } from "./zod-to-json-schema";
import { toolRegistry } from "../sync/tool-registry";

describe("zodToJsonSchema — drops $schema field", () => {
  test("strips $schema draft URL from output", () => {
    const out = zodToJsonSchema(z.object({ a: z.string() }).strict());
    expect("$schema" in out).toBe(false);
  });
});

describe("zodToJsonSchema — primitive coverage", () => {
  test("z.string() → {type: 'string'}", () => {
    expect(zodToJsonSchema(z.string())).toMatchObject({ type: "string" });
  });

  test("z.string().min(1) → carries minLength", () => {
    const out = zodToJsonSchema(z.string().min(1));
    expect(out).toMatchObject({ type: "string", minLength: 1 });
  });

  test("z.string().regex(...) → carries pattern source", () => {
    const out = zodToJsonSchema(z.string().regex(/^shape:[A-Za-z0-9_-]+$/));
    expect(out).toMatchObject({ type: "string", pattern: "^shape:[A-Za-z0-9_-]+$" });
  });

  test("z.number().finite() → {type: 'number'}", () => {
    expect(zodToJsonSchema(z.number().finite())).toMatchObject({ type: "number" });
  });

  test("z.literal('foo') → {const: 'foo'}", () => {
    expect(zodToJsonSchema(z.literal("foo"))).toMatchObject({ const: "foo" });
  });

  test("z.enum(['a','b','c']) → string + enum", () => {
    const out = zodToJsonSchema(z.enum(["a", "b", "c"]));
    expect(out).toMatchObject({ type: "string" });
    expect((out as { enum: string[] }).enum.sort()).toEqual(["a", "b", "c"]);
  });

  test("z.array(z.string()) → array with string items", () => {
    expect(zodToJsonSchema(z.array(z.string()))).toMatchObject({
      type: "array",
      items: { type: "string" },
    });
  });

  test("z.discriminatedUnion produces anyOf or oneOf of variants", () => {
    const u = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a"), x: z.number() }).strict(),
      z.object({ type: z.literal("b"), y: z.string() }).strict(),
    ]);
    const out = zodToJsonSchema(u);
    // Zod 4 emits "anyOf" by default (JSON Schema 2020-12 prefers anyOf).
    const variants =
      (out as { anyOf?: unknown[]; oneOf?: unknown[] }).anyOf ??
      (out as { oneOf?: unknown[] }).oneOf;
    expect(variants).toBeDefined();
    expect(variants).toHaveLength(2);
  });
});

describe("zodToJsonSchema — z.object().strict() → additionalProperties: false", () => {
  test("empty strict object", () => {
    expect(zodToJsonSchema(z.object({}).strict())).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  test("strict object with required field", () => {
    const out = zodToJsonSchema(z.object({ a: z.string() }).strict());
    expect(out).toMatchObject({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    });
    expect((out as { required: string[] }).required).toEqual(["a"]);
  });

  test("optional fields are NOT in required[]", () => {
    const out = zodToJsonSchema(z.object({ a: z.string(), b: z.string().optional() }).strict());
    expect((out as { required: string[] }).required).toEqual(["a"]);
    const props = (out as { properties: Record<string, unknown> }).properties;
    expect(props["a"]).toBeDefined();
    expect(props["b"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tool-registry coverage — exercise every entry's schema
// ---------------------------------------------------------------------------

describe("zodToJsonSchema — covers every tool-registry schema", () => {
  test("converter runs against all twelve tool schemas without throwing", () => {
    for (const entry of Object.values(toolRegistry)) {
      const schema = zodToJsonSchema(entry.schema);
      expect(schema).toBeDefined();
      expect(typeof schema).toBe("object");
      expect((schema as { type?: string }).type).toBeDefined();
    }
  });

  test("createShape converts to object with correct required keys + id pattern", () => {
    const out = zodToJsonSchema(toolRegistry.createShape.schema);
    expect(out).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    const sortedRequired = ((out as { required: string[] }).required ?? []).slice().sort();
    expect(sortedRequired).toEqual(["id", "props", "type", "x", "y"]);
    const props = (out as { properties: Record<string, { type?: string; pattern?: string }> })
      .properties;
    expect(props["id"]?.type).toBe("string");
    expect(props["id"]?.pattern).toBe("^shape:[A-Za-z0-9_-]+$");
    expect(props["type"]?.type).toBe("string");
    expect(props["x"]?.type).toBe("number");
    expect(props["y"]?.type).toBe("number");
    expect((props["props"] as { type?: string }).type).toBe("object");
  });

  test("getShape converts to {required: ['shapeId']}", () => {
    const out = zodToJsonSchema(toolRegistry.getShape.schema);
    expect((out as { required: string[] }).required).toEqual(["shapeId"]);
  });

  test("getCanvasBounds (empty input) is a closed empty object schema", () => {
    const out = zodToJsonSchema(toolRegistry.getCanvasBounds.schema);
    expect(out).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(Object.keys((out as { properties?: Record<string, unknown> }).properties ?? {})).toEqual(
      [],
    );
  });

  test("listCanvases (M15, empty input) is a closed empty object schema", () => {
    const out = zodToJsonSchema(toolRegistry.listCanvases.schema);
    expect(out).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  test("updateShape required keys are id + partial", () => {
    const out = zodToJsonSchema(toolRegistry.updateShape.schema);
    expect(out).toMatchObject({ type: "object" });
    const required = ((out as { required: string[] }).required ?? []).slice().sort();
    expect(required).toEqual(["id", "partial"]);
  });

  test("groupShapes shapeIds field is an array", () => {
    const out = zodToJsonSchema(toolRegistry.groupShapes.schema);
    const props = (out as { properties: Record<string, unknown> }).properties;
    expect(props["shapeIds"]).toMatchObject({ type: "array" });
  });

  test("listShapesInViewport viewport bounds are numbers", () => {
    const out = zodToJsonSchema(toolRegistry.listShapesInViewport.schema);
    const props = (out as { properties: Record<string, { type: string }> }).properties;
    expect(props["x"]?.type).toBe("number");
    expect(props["y"]?.type).toBe("number");
    expect(props["w"]?.type).toBe("number");
    expect(props["h"]?.type).toBe("number");
  });
});
