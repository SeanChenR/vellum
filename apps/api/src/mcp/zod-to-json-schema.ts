/**
 * zod-to-json-schema.ts — JSON Schema converter for the MCP server's
 * `tools/list` response.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "Zod-to-JSON-Schema conversion is in-tree and snapshot-tested per tool"
 *
 * Implementation: thin wrapper around Zod 4's built-in `z.toJSONSchema()`.
 * The design originally planned a hand-rolled converter (to avoid pulling
 * in `zod-to-json-schema` npm), but Zod 4 ships native JSON Schema export
 * — same outcome with zero extra code or maintenance.
 *
 * Customizations:
 *   - Strip the `$schema` draft URL field — MCP `tools/list` doesn't
 *     need it and most MCP clients ignore it.
 *   - Snapshot-tested in `zod-to-json-schema.test.ts` against every
 *     entry in `tool-registry.ts` so any future Zod-internals drift
 *     surfaces immediately.
 */

import { z, type ZodTypeAny } from "zod";

export type JsonSchema = Record<string, unknown>;

/**
 * Convert a Zod schema to its JSON Schema (draft 2020-12) representation.
 *
 * Drops the `$schema` field from Zod's output so the result is a clean
 * MCP tool `inputSchema`.
 */
export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const out = z.toJSONSchema(schema) as JsonSchema;
  if ("$schema" in out) {
    const { $schema: _drop, ...rest } = out as { $schema?: unknown } & JsonSchema;
    void _drop;
    return rest;
  }
  return out;
}
