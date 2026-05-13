/**
 * methods/tools-list.ts — MCP `tools/list` handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "tools/list returns the full Vellum tool surface as MCP tool descriptors"
 *
 * Projects every entry in `tool-registry.ts` into an MCP tool descriptor:
 *   {name, description, inputSchema, annotations: {readOnlyHint}}
 *
 * `readOnlyHint = true` for read-kind tools (including `listCanvases`),
 * `false` for write-kind tools. The annotation lets MCP clients gate
 * write tools behind explicit user confirmation in their UI.
 *
 * Canvas binding:
 *   The in-process agent runtime knows its canvas out-of-band (the run
 *   is bound to one canvas) so the tool-registry Zod schemas omit
 *   `canvasId`. MCP has no such binding — the LLM must supply
 *   `canvasId` on every canvas-scoped call, and the dispatcher in
 *   `tools-call.ts` reads it from args. To keep schema and dispatcher
 *   honest we inject `canvasId: string` into every descriptor's
 *   inputSchema here (except `listCanvases`, which is user-scoped and
 *   ignores canvasId).
 */

import { toolRegistry } from "../../sync/tool-registry";
import { zodToJsonSchema, type JsonSchema } from "../zod-to-json-schema";

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: { readOnlyHint: boolean };
}

export interface ToolsListResult {
  tools: McpToolDescriptor[];
}

function injectCanvasId(schema: JsonSchema): JsonSchema {
  // The Zod-derived schema is always an `object` for our registry; add
  // `canvasId` to `properties` and `required`. Defensive: if the shape
  // is unexpected, return it untouched rather than risk corruption.
  const obj = schema as JsonSchema & {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (obj.type !== "object") return schema;
  const properties = {
    canvasId: {
      type: "string" as const,
      description:
        "The canvas to operate on. Call `listCanvases` first if you do not already know the id.",
    },
    ...obj.properties,
  };
  const required = ["canvasId", ...(obj.required ?? []).filter((k) => k !== "canvasId")];
  return { ...obj, properties, required } as JsonSchema;
}

export function handleToolsList(): ToolsListResult {
  const tools: McpToolDescriptor[] = [];
  for (const entry of Object.values(toolRegistry)) {
    const baseSchema = zodToJsonSchema(entry.schema);
    const inputSchema = entry.name === "listCanvases" ? baseSchema : injectCanvasId(baseSchema);
    tools.push({
      name: entry.name,
      description: entry.description,
      inputSchema,
      annotations: { readOnlyHint: entry.kind === "read" },
    });
  }
  return { tools };
}
