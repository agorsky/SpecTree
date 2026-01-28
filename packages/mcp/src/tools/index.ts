/**
 * MCP Tool Registry
 *
 * Central registry for all SpecTree MCP tools.
 * Tools are organized by domain and registered with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import tool modules - these export their registrar functions
import { registerProjectTools } from "./projects.js";
import { registerFeatureTools } from "./features.js";
import { registerTaskTools } from "./tasks.js";
import { registerStatusTools } from "./statuses.js";
import { registerOrderingTools } from "./ordering.js";
import { registerSearchTools } from "./search.js";

// Tool registration function type
export type ToolRegistrar = (server: McpServer) => void;

// Registry of all tool registration functions
const toolRegistrars: ToolRegistrar[] = [
  registerProjectTools,
  registerFeatureTools,
  registerTaskTools,
  registerStatusTools,
  registerOrderingTools,
  registerSearchTools,
];

/**
 * Register all tools with the MCP server.
 * Called once during server startup.
 */
export function registerAllTools(server: McpServer): void {
  for (const registrar of toolRegistrars) {
    registrar(server);
  }
}
