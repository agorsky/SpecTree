#!/usr/bin/env node
/**
 * SpecTree MCP Server
 *
 * Model Context Protocol server exposing SpecTree operations to AI agents.
 * Uses stdio transport for CLI integration.
 */

// Load environment variables from the API package's .env file
// This must happen before any imports that use Prisma
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dist/, we need to go up to packages/mcp, then to packages/api
const apiEnvPath = resolve(__dirname, "../../api/.env");
config({ path: apiEnvPath });

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

// Server metadata
const SERVER_NAME = "spectree-mcp";
const SERVER_VERSION = "0.1.0";

// Create the MCP server
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// Register all tools from the registry
registerAllTools(server);

// Main entry point
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio transport)`);
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
