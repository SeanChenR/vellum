/**
 * methods/tools-list.test.ts — MCP tools/list handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   - "tools/list returns the full Vellum tool surface as MCP tool descriptors"
 *   - "tools/list enumerates exactly thirteen tools"
 *   - "tools/list readOnlyHint annotation distinguishes write vs read"
 *   - "tools/list inputSchema is valid JSON Schema for createShape"
 */

import { describe, expect, test } from "bun:test";
import { handleToolsList } from "./tools-list";

describe("handleToolsList", () => {
  test("returns exactly thirteen tool descriptors", () => {
    const r = handleToolsList();
    expect(r.tools).toHaveLength(13);
  });

  test("tool names match the canonical tool-registry set", () => {
    const r = handleToolsList();
    const expected = [
      "createShape",
      "updateShape",
      "deleteShape",
      "groupShapes",
      "ungroupShape",
      "connectShapes",
      "listShapes",
      "listShapesInViewport",
      "listShapesInSelection",
      "getShape",
      "getCanvasBounds",
      "getViewport",
      "listCanvases",
    ].sort();
    expect(r.tools.map((t) => t.name).sort()).toEqual(expected);
  });

  test("every descriptor has a non-empty description", () => {
    const r = handleToolsList();
    for (const t of r.tools) {
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(20);
    }
  });

  test("every descriptor has a JSON Schema inputSchema with type: 'object'", () => {
    const r = handleToolsList();
    for (const t of r.tools) {
      expect((t.inputSchema as { type?: string }).type).toBe("object");
    }
  });

  test("createShape inputSchema lists canvasId + id/type/x/y/props as required", () => {
    const r = handleToolsList();
    const createShape = r.tools.find((t) => t.name === "createShape");
    expect(createShape).toBeDefined();
    const schema = createShape!.inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(schema.required.slice().sort()).toEqual(["canvasId", "id", "props", "type", "x", "y"]);
    expect(schema.properties["canvasId"]).toBeDefined();
  });

  test("listShapes inputSchema requires canvasId only (no other args)", () => {
    const r = handleToolsList();
    const listShapes = r.tools.find((t) => t.name === "listShapes");
    expect(listShapes).toBeDefined();
    const schema = listShapes!.inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(schema.required).toEqual(["canvasId"]);
    expect(Object.keys(schema.properties).sort()).toEqual(["canvasId"]);
  });

  test("listCanvases inputSchema does NOT include canvasId (user-scoped tool)", () => {
    const r = handleToolsList();
    const listCanvases = r.tools.find((t) => t.name === "listCanvases");
    expect(listCanvases).toBeDefined();
    const schema = listCanvases!.inputSchema as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    expect(schema.required ?? []).not.toContain("canvasId");
    expect(schema.properties?.["canvasId"]).toBeUndefined();
  });

  test("the six write tools have annotations.readOnlyHint = false", () => {
    const r = handleToolsList();
    const writeNames = new Set([
      "createShape",
      "updateShape",
      "deleteShape",
      "groupShapes",
      "ungroupShape",
      "connectShapes",
    ]);
    for (const t of r.tools) {
      if (writeNames.has(t.name)) {
        expect(t.annotations.readOnlyHint).toBe(false);
      }
    }
  });

  test("the seven read tools have annotations.readOnlyHint = true (including listShapes + listCanvases)", () => {
    const r = handleToolsList();
    const readNames = new Set([
      "listShapes",
      "listShapesInViewport",
      "listShapesInSelection",
      "getShape",
      "getCanvasBounds",
      "getViewport",
      "listCanvases",
    ]);
    for (const t of r.tools) {
      if (readNames.has(t.name)) {
        expect(t.annotations.readOnlyHint).toBe(true);
      }
    }
  });
});
