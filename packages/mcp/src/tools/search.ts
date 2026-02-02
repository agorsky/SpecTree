/**
 * MCP Tools for Search Operations
 *
 * Provides a unified search tool for searching across features and tasks
 * in the SpecTree application. Uses HTTP API client for all operations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register search tool
export function registerSearchTools(server: McpServer): void {
  // ==========================================================================
  // spectree__search
  // ==========================================================================
  server.registerTool(
    "spectree__search",
    {
      description:
        "Search for features and tasks in SpecTree with various filters. " +
        "Supports text search, filtering by epic, status, assignee, and date ranges. " +
        "Can search features only, tasks only, or both combined. Results include a 'type' " +
        "field indicating whether each item is a 'feature' or 'task'. Features are the " +
        "primary work items, while tasks are sub-issues under features.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Text search query. Searches in title and description (case-insensitive). " +
            "For example, 'login' will match 'User Login Flow' and items with 'login' in description."
          ),
        epic: z
          .string()
          .optional()
          .describe(
            "Filter by epic. Accepts epic ID (UUID) or exact epic name. " +
            "Only features in this epic (and their tasks) will be returned. " +
            "Name matching is case-sensitive."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'In Progress', 'Done'). Status names are team-specific."
          ),
        statusCategory: z
          .string()
          .optional()
          .describe(
            "Filter by status category. Valid values are: 'backlog', 'unstarted', " +
            "'started', 'completed', 'canceled'. This filters items by the category " +
            "their status belongs to, rather than a specific status."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "Filter by assignee. Accepts user ID (UUID), email address, or special values: " +
            "'me' for the current authenticated user, 'none' for unassigned items."
          ),
        createdAt: z
          .string()
          .optional()
          .describe(
            "Filter by creation date. Accepts ISO-8601 date (e.g., '2024-01-15') or " +
            "ISO-8601 duration for relative dates (e.g., '-P7D' for last 7 days, " +
            "'-P1M' for last month). Returns items created on or after this date."
          ),
        updatedAt: z
          .string()
          .optional()
          .describe(
            "Filter by last update date. Accepts ISO-8601 date or duration format. " +
            "Returns items updated on or after this date. Useful for finding recently " +
            "modified items (e.g., '-P1D' for items updated in the last day)."
          ),
        type: z
          .enum(["feature", "task", "all"])
          .optional()
          .describe(
            "Type of items to search. 'feature' searches only features, 'task' searches " +
            "only tasks, 'all' searches both (default). When searching 'all', results " +
            "are combined and sorted by creation date (newest first)."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of results to return per page (default: 50, max: 100). " +
            "When type='all', this limit applies to the combined results. " +
            "Use with cursor for pagination."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response. Format: 'feature:{cursor}' or " +
            "'task:{cursor}' when searching a specific type, or a combined cursor when " +
            "searching all. Pass this to fetch the next page of results."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const result = await apiClient.search({
          query: input.query,
          epic: input.epic,
          status: input.status,
          statusCategory: input.statusCategory,
          assignee: input.assignee,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          type: input.type,
          limit: input.limit,
          cursor: input.cursor,
        });

        return createResponse({
          results: result.results,
          meta: result.meta,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epic ?? "unknown"}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
