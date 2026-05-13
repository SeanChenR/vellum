/**
 * methods/ping.test.ts — MCP ping handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "ping returns empty result for client health checks"
 */

import { describe, expect, test } from "bun:test";
import { handlePing } from "./ping";

describe("handlePing", () => {
  test("returns an empty object", () => {
    expect(handlePing()).toEqual({});
  });
});
