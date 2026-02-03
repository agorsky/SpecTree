/**
 * MCP Tools for Team Management
 *
 * Provides tools for listing teams in SpecTree.
 * Uses HTTP API client for all operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register all team tools
export function registerTeamTools(server: McpServer): void {
  // List teams tool
  server.registerTool(
    "spectree__list_teams",
    {
      description:
        "List teams the authenticated user has access to. Returns team names, keys, and IDs. " +
        "Use this to discover available teams before creating epics. If you don't know which " +
        "team to use for an epic, call this tool first and ask the user to choose.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.listTeams({ limit: 100 });

        // Return simplified team list with just the essential fields
        const teams = result.data.map((team) => ({
          id: team.id,
          name: team.name,
          key: team.key,
        }));

        return createResponse({
          teams,
          count: teams.length,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
