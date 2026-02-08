/**
 * MCP Tools for Changelog operations
 *
 * Provides tools for querying entity change history.
 * Changelogs are append-only records that track field-level changes.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Valid entity types
const entityTypes = ["epic", "feature", "task"] as const;

// Register all changelog tools
export function registerChangelogTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_changelog
  // ==========================================================================
  server.registerTool(
    "spectree__get_changelog",
    {
      description:
        "Query entity change history with formatted output. Returns field-level changes " +
        "showing what was modified, when, and by whom. Each entry shows 'field: oldValue → newValue'. " +
        "Useful for understanding how an entity evolved over time or tracking specific field changes.\n\n" +
        "Use cases:\n" +
        "- See all changes to a feature or task\n" +
        "- Track status changes over time\n" +
        "- Find who changed a specific field\n" +
        "- Audit changes within a date range\n" +
        "- Review epic-wide changes across all features/tasks",
      inputSchema: {
        entityType: z
          .enum(entityTypes)
          .describe(
            "Type of entity to query (required). 'epic' for epic changes, 'feature' for feature changes, " +
            "'task' for task changes."
          ),
        entityId: z
          .string()
          .describe(
            "UUID of the entity to query (required). The specific epic, feature, or task ID."
          ),
        epicId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Filter by epic ID (optional). When provided, only returns changes for entities within " +
            "this epic. Useful for narrowing down results in a multi-epic query."
          ),
        field: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Filter by specific field name (optional). Examples: 'statusId', 'title', 'assigneeId', " +
            "'description'. Only changes to this field will be returned."
          ),
        changedBy: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Filter by user ID who made the change (optional). Only returns changes made by this user."
          ),
        since: z
          .string()
          .optional()
          .describe(
            "Filter changes on or after this date (optional). Accepts ISO-8601 date (e.g., '2024-01-15') " +
            "or duration (e.g., '-P7D' for last 7 days, '-P1M' for last month)."
          ),
        until: z
          .string()
          .optional()
          .describe(
            "Filter changes before this date (optional). Accepts ISO-8601 date format."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of entries to return (default: 20, max: 100)."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response. Pass this to fetch the next page of results."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Call the API to get changelog
        const result = await apiClient.getChangelog({
          entityType: input.entityType,
          entityId: input.entityId,
          field: input.field,
          changedBy: input.changedBy,
          since: input.since,
          until: input.until,
          limit: input.limit,
          cursor: input.cursor,
        });

        // Format the changelog entries for AI consumption
        const formattedEntries = result.data.map((entry) => {
          // Parse old and new values (they're stored as JSON strings)
          const oldValue = entry.oldValue ? JSON.parse(entry.oldValue) : null;
          const newValue = entry.newValue ? JSON.parse(entry.newValue) : null;

          // Format as readable "old → new"
          const oldDisplay = oldValue === null ? "(empty)" : String(oldValue);
          const newDisplay = newValue === null ? "(empty)" : String(newValue);

          return {
            id: entry.id,
            field: entry.field,
            oldValue,
            newValue,
            formatted: `${entry.field}: ${oldDisplay} → ${newDisplay}`,
            changedBy: entry.changedBy,
            changedAt: entry.changedAt,
          };
        });

        // Build a human-readable summary
        const summary = formattedEntries.length > 0
          ? formattedEntries.map((e) => `[${e.changedAt}] ${e.formatted}`).join("\n")
          : "No changes found for the specified filters.";

        return createResponse({
          entityType: input.entityType,
          entityId: input.entityId,
          totalEntries: formattedEntries.length,
          entries: formattedEntries,
          summary,
          meta: result.meta,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error("Entity not found"));
        }
        return createErrorResponse(error);
      }
    }
  );
}
