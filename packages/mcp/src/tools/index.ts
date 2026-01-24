/**
 * MCP Tool Registry
 *
 * Central registry for all SpecTree MCP tools.
 * Tools are organized by domain and registered with the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Tool registration function type
export type ToolRegistrar = (server: McpServer) => void;

// Registry of all tool registration functions
const toolRegistrars: ToolRegistrar[] = [];

/**
 * Register a tool registrar function.
 * Called during module initialization.
 */
export function addToolRegistrar(registrar: ToolRegistrar): void {
  toolRegistrars.push(registrar);
}

/**
 * Register all tools with the MCP server.
 * Called once during server startup.
 */
export function registerAllTools(server: McpServer): void {
  for (const registrar of toolRegistrars) {
    registrar(server);
  }
}

// Import tool modules to trigger their registration
// These will be added as each tool file is created
import "./projects.js";
import "./features.js";
import "./tasks.js";
import "./statuses.js";
