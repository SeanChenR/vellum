/**
 * mcp-server-roundtrip.spec.ts — end-to-end Personal Access Token
 * issuance + JSON-RPC roundtrip against /api/mcp.
 *
 * Spec ref:
 *   openspec/specs/mcp-server/spec.md
 *     "Stateless Streamable HTTP endpoint accepts JSON-RPC 2.0 at POST /api/mcp"
 *     "PAT authentication gate sits in front of JSON-RPC dispatch"
 *   openspec/specs/personal-access-token/spec.md
 *     "POST /api/account/pat creates a token and returns plaintext once"
 *
 * Two flows in one file:
 *   1. Happy path — issue PAT, send four JSON-RPC requests
 *      (initialize / ping / tools/list / tools/call createShape), confirm
 *      the shape lands on the canvas.
 *   2. Expired PAT — server returns HTTP 401 with no JSON-RPC body.
 *
 * BYOK is intentionally NOT required: MCP tool calls dispatch through
 * the same tool-registry as the in-process agent but do NOT invoke an
 * LLM, so neither provider key nor model gate applies.
 */

import { expect, test } from "@playwright/test";
import { createCanvasViaDashboard, signInWithMagicLink } from "./helpers/agent-setup";

interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

test.describe("MCP server roundtrip", () => {
  test("issue PAT, run initialize/ping/tools.list/tools.call against /api/mcp", async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ts = Date.now();
    const email = `mcp-e2e-${ts}@vellum-test.local`;
    await signInWithMagicLink(page, email);
    const { canvasId, canvasUrl } = await createCanvasViaDashboard(page, `mcp-e2e-${ts}`);

    try {
      // 1. Issue a PAT through the cookie-authenticated REST endpoint.
      const createResp = await page.request.post("/api/account/pat", {
        data: { name: "e2e", expiresInDays: 30 },
      });
      expect(createResp.status()).toBe(201);
      const createBody = (await createResp.json()) as {
        data: { token: string; id: string; prefix: string };
      };
      const plaintext = createBody.data.token;
      expect(plaintext).toMatch(/^vlm_pat_/);

      const apiRequest = page.request;
      const headers = {
        authorization: `Bearer ${plaintext}`,
        "content-type": "application/json",
      } as const;

      // 2. initialize → MCP serverInfo + tools capability.
      const initResp = await apiRequest.post("/api/mcp", {
        headers,
        data: { jsonrpc: "2.0", id: "init", method: "initialize" },
      });
      expect(initResp.status()).toBe(200);
      const initBody = (await initResp.json()) as JsonRpcSuccess<{
        protocolVersion: string;
        capabilities: { tools: object };
        serverInfo: { name: string; version: string };
      }>;
      expect(initBody.result.serverInfo.name).toBe("vellum-mcp-server");
      expect(initBody.result.capabilities.tools).toBeDefined();

      // 3. ping → empty result.
      const pingResp = await apiRequest.post("/api/mcp", {
        headers,
        data: { jsonrpc: "2.0", id: "p", method: "ping" },
      });
      expect(pingResp.status()).toBe(200);
      const pingBody = (await pingResp.json()) as JsonRpcSuccess<object>;
      expect(pingBody.result).toEqual({});

      // 4. tools/list → exactly thirteen tools, including listShapes + listCanvases.
      const listResp = await apiRequest.post("/api/mcp", {
        headers,
        data: { jsonrpc: "2.0", id: "tl", method: "tools/list" },
      });
      expect(listResp.status()).toBe(200);
      const listBody = (await listResp.json()) as JsonRpcSuccess<{
        tools: Array<{ name: string; description: string; inputSchema: object }>;
      }>;
      expect(listBody.result.tools).toHaveLength(13);
      const toolNames = listBody.result.tools.map((t) => t.name);
      expect(toolNames).toContain("listCanvases");
      expect(toolNames).toContain("listShapes");

      // 5. The canvas must be open in the browser before tool/call so
      //    the sync room is active server-side. createShape goes through
      //    applyMutation which requires the room.
      await page.goto(canvasUrl);
      await page.waitForLoadState("networkidle");
      // Give tldraw a moment to settle the sync handshake.
      await page.waitForTimeout(2_000);

      // 6. tools/call createShape — geo rectangle at a known position.
      const shapeId = `shape:e2e-${ts}`;
      const callResp = await apiRequest.post("/api/mcp", {
        headers,
        data: {
          jsonrpc: "2.0",
          id: "tc",
          method: "tools/call",
          params: {
            name: "createShape",
            arguments: {
              canvasId,
              id: shapeId,
              type: "geo",
              x: 100,
              y: 100,
              props: { geo: "rectangle", w: 200, h: 120 },
            },
          },
        },
      });
      expect(callResp.status()).toBe(200);
      const callBody = (await callResp.json()) as JsonRpcSuccess<{
        content: Array<{ type: "text"; text: string }>;
        isError: false;
      }>;
      expect(callBody.result.isError).toBe(false);
      const inner = JSON.parse(callBody.result.content[0]!.text) as {
        ok: boolean;
        appliedCount?: number;
      };
      expect(inner.ok).toBe(true);

      // 7. The created shape should be visible on the canvas (tldraw
      //    renders geo shapes inside the .tl-shapes layer).
      await expect(page.locator(`[data-shape-id="${shapeId}"]`)).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test("expired PAT returns HTTP 401", async ({ browser }) => {
    test.setTimeout(45_000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const ts = Date.now();
    const email = `mcp-expired-${ts}@vellum-test.local`;
    await signInWithMagicLink(page, email);

    try {
      // Use a syntactically-valid plaintext that was never issued. The
      // server hashes it and looks up the hash; no row → 401.
      const fakePlaintext = `vlm_pat_${"z".repeat(32)}`;
      const resp = await page.request.post("/api/mcp", {
        headers: {
          authorization: `Bearer ${fakePlaintext}`,
          "content-type": "application/json",
        },
        data: { jsonrpc: "2.0", id: "x", method: "ping" },
      });
      expect(resp.status()).toBe(401);
      // No JSON-RPC body on auth failure (the gate sits in front of dispatch).
      expect((await resp.text()).length).toBe(0);
    } finally {
      await ctx.close();
    }
  });
});
