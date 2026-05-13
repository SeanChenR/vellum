/**
 * methods/initialize.test.ts — MCP initialize handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "initialize returns server capabilities advertising tools support"
 */

import { describe, expect, test } from "bun:test";
import { handleInitialize } from "./initialize";

describe("handleInitialize", () => {
  test("returns protocolVersion 2024-11-05", () => {
    const r = handleInitialize({ serverVersion: "0.1.0" });
    expect(r.protocolVersion).toBe("2024-11-05");
  });

  test("returns capabilities.tools as an empty object (no listChanged)", () => {
    const r = handleInitialize({ serverVersion: "0.1.0" });
    expect(r.capabilities).toEqual({ tools: {} });
  });

  test("returns serverInfo.name = 'vellum-mcp-server'", () => {
    const r = handleInitialize({ serverVersion: "0.1.0" });
    expect(r.serverInfo.name).toBe("vellum-mcp-server");
  });

  test("returns serverInfo.version from supplied deps", () => {
    const r = handleInitialize({ serverVersion: "0.7.0-beta" });
    expect(r.serverInfo.version).toBe("0.7.0-beta");
  });

  test("includes non-empty instructions guiding listCanvases-first flow", () => {
    const r = handleInitialize({ serverVersion: "0.1.0" });
    expect(r.instructions.length).toBeGreaterThan(20);
    expect(r.instructions).toContain("listCanvases");
    expect(r.instructions).toContain("canvasId");
  });
});
