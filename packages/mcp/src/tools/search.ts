/**
 * MCP Tools for Search Operations
 *
 * Provides a unified search tool for searching across features and tasks
 * in the SpecTree application with various filter options.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  featureService,
  taskService,
  userService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";
import { isValidUUID } from "../utils.js";

/**
 * Helper to resolve "me" assignee value to actual user ID
 */
async function resolveCurrentUserId(): Promise<string | undefined> {
  const currentUser = await userService.getCurrentUser();
  return currentUser?.id;
}

/**
 * Helper to resolve project name/ID to project ID
 */
async function resolveProjectId(project: string): Promise<string> {
  // First try to find by ID (UUID) - only if it's a valid UUID format
  if (isValidUUID(project)) {
    const projectById = await prisma.project.findUnique({
      where: { id: project },
      select: { id: true },
    });

    if (projectById) return projectById.id;
  }

  // Try to find by name
  const projectByName = await prisma.project.findFirst({
    where: { name: project, isArchived: false },
    select: { id: true },
  });

  if (projectByName) return projectByName.id;

  throw new NotFoundError(`Project '${project}' not found`);
}

/**
 * Create MCP-compliant response
 */
function createResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Create MCP error response
 */
function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// Search result item with type indicator
interface SearchResultItem {
  type: "feature" | "task";
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  statusId: string | null;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Feature-specific fields
  projectId?: string;
  // Task-specific fields
  featureId?: string;
}

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
        "Supports text search, filtering by project, status, assignee, and date ranges. " +
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
        project: z
          .string()
          .optional()
          .describe(
            "Filter by project. Accepts project ID (UUID) or exact project name. " +
            "Only features in this project (and their tasks) will be returned. " +
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
        const searchType = input.type ?? "all";
        const limit = input.limit ?? 50;

        // Resolve project ID if provided
        let projectId: string | undefined;
        if (input.project) {
          projectId = await resolveProjectId(input.project);
        }

        // Get current user ID for resolving "me" in assignee filter
        const currentUserId = await resolveCurrentUserId();

        // Build common filter options
        const commonFilters = {
          query: input.query,
          status: input.status,
          statusCategory: input.statusCategory,
          assignee: input.assignee,
          currentUserId,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
        };

        const results: SearchResultItem[] = [];
        let featureCursor: string | null = null;
        let taskCursor: string | null = null;
        let hasMoreFeatures = false;
        let hasMoreTasks = false;

        // Parse cursor if provided
        if (input.cursor) {
          if (input.cursor.startsWith("feature:")) {
            featureCursor = input.cursor.slice(8) || null;
          } else if (input.cursor.startsWith("task:")) {
            taskCursor = input.cursor.slice(5) || null;
          } else if (input.cursor.startsWith("combined:")) {
            // Parse combined cursor format: combined:feature_cursor|task_cursor
            const parts = input.cursor.slice(9).split("|");
            featureCursor = parts[0] && parts[0] !== "null" ? parts[0] : null;
            taskCursor = parts[1] && parts[1] !== "null" ? parts[1] : null;
          }
        }

        // Search features if requested
        if (searchType === "feature" || searchType === "all") {
          const featureResult = await featureService.listFeatures({
            ...commonFilters,
            projectId,
            limit: searchType === "all" ? limit : limit,
            cursor: featureCursor ?? undefined,
            orderBy: "createdAt",
          });

          hasMoreFeatures = featureResult.meta.hasMore;
          featureCursor = featureResult.meta.cursor;

          for (const feature of featureResult.data) {
            results.push({
              type: "feature",
              id: feature.id,
              identifier: feature.identifier,
              title: feature.title,
              description: feature.description,
              statusId: feature.statusId,
              assigneeId: feature.assigneeId,
              createdAt: feature.createdAt,
              updatedAt: feature.updatedAt,
              projectId: feature.projectId,
            });
          }
        }

        // Search tasks if requested
        if (searchType === "task" || searchType === "all") {
          // For tasks, we need to filter by project indirectly through features
          // The task service doesn't have a projectId filter, so we'll rely on the
          // other filters and filter client-side if project is specified.
          const taskResult = await taskService.listTasks({
            ...commonFilters,
            limit: searchType === "all" ? limit : limit,
            cursor: taskCursor ?? undefined,
            orderBy: "createdAt",
          });

          hasMoreTasks = taskResult.meta.hasMore;
          taskCursor = taskResult.meta.cursor;

          // If project filter is specified and we're searching tasks,
          // we need to filter tasks by their parent feature's project
          let filteredTasks = taskResult.data;
          if (projectId) {
            // Get feature IDs that belong to this project
            const featureIds = new Set(
              (await prisma.feature.findMany({
                where: { projectId },
                select: { id: true },
              })).map(f => f.id)
            );
            
            filteredTasks = filteredTasks.filter(task => 
              featureIds.has(task.featureId)
            );
          }

          for (const task of filteredTasks) {
            results.push({
              type: "task",
              id: task.id,
              identifier: task.identifier,
              title: task.title,
              description: task.description,
              statusId: task.statusId,
              assigneeId: task.assigneeId,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
              featureId: task.featureId,
            });
          }
        }

        // Sort combined results by createdAt (newest first)
        if (searchType === "all") {
          results.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          // Trim to limit
          if (results.length > limit) {
            results.length = limit;
          }
        }

        // Build pagination cursor
        let nextCursor: string | null = null;
        const hasMore = searchType === "all" 
          ? hasMoreFeatures || hasMoreTasks
          : searchType === "feature" 
            ? hasMoreFeatures 
            : hasMoreTasks;

        if (hasMore) {
          if (searchType === "feature") {
            nextCursor = featureCursor ? `feature:${featureCursor}` : null;
          } else if (searchType === "task") {
            nextCursor = taskCursor ? `task:${taskCursor}` : null;
          } else {
            // Combined cursor for "all" type
            nextCursor = `combined:${featureCursor ?? "null"}|${taskCursor ?? "null"}`;
          }
        }

        return createResponse({
          results,
          meta: {
            total: results.length,
            cursor: nextCursor,
            hasMore,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
