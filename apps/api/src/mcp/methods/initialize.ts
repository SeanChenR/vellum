/**
 * methods/initialize.ts — MCP `initialize` handler.
 *
 * Spec ref: openspec/specs/mcp-server/spec.md
 *   "initialize returns server capabilities advertising tools support"
 *
 * Returns server metadata + the advertised `capabilities.tools` slot
 * (empty object signals "tools supported, no listChanged notifications").
 *
 * The protocol version returned is the version Vellum's MCP server
 * implements; if the client requested a different version we still
 * answer with our own — clients can choose to reconnect or downgrade.
 */

// Version of the MCP protocol Vellum's server implements.
const VELLUM_MCP_PROTOCOL_VERSION = "2024-11-05";

// Server name advertised in `initialize` result. Stable identifier
// MCP clients use in their UI ("Connected to vellum-mcp-server").
const VELLUM_MCP_SERVER_NAME = "vellum-mcp-server";

export interface InitializeResult {
  protocolVersion: string;
  capabilities: { tools: Record<string, never> };
  serverInfo: { name: string; version: string };
  instructions: string;
}

export interface InitializeDeps {
  serverVersion: string;
}

export function handleInitialize(deps: InitializeDeps): InitializeResult {
  return {
    protocolVersion: VELLUM_MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: {
      name: VELLUM_MCP_SERVER_NAME,
      version: deps.serverVersion,
    },
    instructions:
      "Vellum is a canvas-native co-pilot backend. Call `listCanvases` first to discover available canvases, then use canvas-scoped tools with `canvasId` in their arguments. All write tools require owner/editor role on the target canvas; read tools require any role.",
  };
}
