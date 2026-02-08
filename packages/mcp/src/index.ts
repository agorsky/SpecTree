#!/usr/bin/env node
/**
 * SpecTree MCP Server
 *
 * Model Context Protocol server exposing SpecTree operations to AI agents.
 * Uses stdio transport for CLI integration.
 *
 * Configuration:
 * - API_TOKEN: Required. SpecTree API token (starts with st_)
 * - API_BASE_URL: Optional. Base URL of SpecTree API (default: http://localhost:3001)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";
import { initializeApiClient } from "./api-client.js";

// Server metadata
const SERVER_NAME = "spectree-mcp";
const SERVER_VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Global error handlers - prevent silent crashes from unhandled errors
// ---------------------------------------------------------------------------
process.on("uncaughtException", (error: Error) => {
  console.error(`[${SERVER_NAME}] uncaughtException:`, error);
  // Keep the process alive - MCP tool handlers should catch their own errors
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error(`[${SERVER_NAME}] unhandledRejection:`, reason);
  // Keep the process alive - don't crash on stray rejected promises
});

// Validate required environment variables
function validateEnvironment(): { token: string; baseUrl: string } {
  const token = process.env.API_TOKEN;
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

  if (!token) {
    console.error("ERROR: API_TOKEN environment variable is required");
    console.error("");
    console.error("To configure the MCP server, add the following to your MCP config:");
    console.error("");
    console.error('  "spectree": {');
    console.error('    "command": "node",');
    console.error('    "args": ["/path/to/spectree-mcp/dist/index.js"],');
    console.error('    "env": {');
    console.error('      "API_TOKEN": "st_your-token-here",');
    console.error('      "API_BASE_URL": "http://localhost:3001"');
    console.error("    }");
    console.error("  }");
    console.error("");
    console.error("Generate a token at http://localhost:3001 (Settings > API Tokens)");
    process.exit(1);
  }

  return { token, baseUrl };
}

// Create the MCP server
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// Register all tools from the registry
registerAllTools(server);

// Main entry point
async function main(): Promise<void> {
  // Validate environment and initialize API client
  const { token, baseUrl } = validateEnvironment();
  initializeApiClient({ token, baseUrl });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio transport)`);
  console.error(`API endpoint: ${baseUrl}`);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function shutdown(): void {
  console.error(`[${SERVER_NAME}] shutting down...`);
  // Allow a brief window for in-flight responses, then exit
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
