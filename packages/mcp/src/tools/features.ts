/**
 * MCP Tools for Feature operations
 *
 * Provides tools for listing, getting, creating, and updating features
 * in the SpecTree application. Uses HTTP API client for all operations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";
import { addRemindersToResponse } from "./reminders.js";

// Register all feature tools
export function registerFeatureTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_features
  // ==========================================================================
  server.registerTool(
    "spectree__list_features",
    {
      description:
        "List features in SpecTree with optional filtering by epic, status, assignee, " +
        "or search query. Returns paginated results ordered by sort order then creation date " +
        "(newest first). Features are the primary work items in SpecTree, similar to issues " +
        "in other project management tools. Each feature has an auto-generated identifier " +
        "(e.g., 'COM-123') based on its team key.",
      inputSchema: {
        epic: z
          .string()
          .optional()
          .describe(
            "Filter by epic. Accepts epic ID (UUID) or exact epic name " +
            "(e.g., 'Mobile App Redesign' or '550e8400-e29b-41d4-a716-446655440000'). " +
            "Name matching is case-sensitive."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'In Progress', 'Done'). Status names are team-specific."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "Filter by assignee. Accepts user ID (UUID) or the special value 'me' " +
            "to filter by the current authenticated user. Use 'me' for 'my features' queries."
          ),
        query: z
          .string()
          .optional()
          .describe(
            "Search query to filter features by title (case-insensitive substring match). " +
            "For example, 'login' will match 'User Login Flow' and 'Login Page Redesign'."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of features to return per page (default: 20, max: 100). " +
            "Use with cursor for pagination through large result sets."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response's meta.cursor field. " +
            "Pass this to fetch the next page of results."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const result = await apiClient.listFeatures({
          epic: input.epic,
          status: input.status,
          assignee: input.assignee,
          query: input.query,
          limit: input.limit,
          cursor: input.cursor,
        });

        return createResponse({
          features: result.data,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_feature
  // ==========================================================================
  server.registerTool(
    "spectree__get_feature",
    {
      description:
        "Get detailed information about a specific feature by ID or identifier. " +
        "Returns the full feature object including all metadata and a list of all " +
        "tasks (sub-issues) associated with the feature. Tasks are ordered by sort " +
        "order then creation date (newest first).",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature identifier to look up. Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123'). The identifier format is '{TEAM_KEY}-{NUMBER}'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: feature } = await apiClient.getFeature(input.id);

        // Fetch tasks for this feature
        const tasksResult = await apiClient.listTasks({
          featureId: feature.id,
          limit: 100,
        });

        return createResponse({
          ...feature,
          tasks: tasksResult.data,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Feature '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_feature
  // ==========================================================================
  server.registerTool(
    "spectree__create_feature",
    {
      description:
        "Create a new feature in an epic. Features are the primary work items in SpecTree. " +
        "Each feature is automatically assigned a unique identifier based on the epic's " +
        "team key (e.g., if the team key is 'COM', the feature might be 'COM-123'). " +
        "Returns the created feature with all metadata including the generated identifier.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe(
            "The title of the feature (required). Should be a concise description of the work " +
            "(e.g., 'User Authentication Flow', 'Add Dark Mode Support')."
          ),
        epic: z
          .string()
          .describe(
            "The epic to add this feature to (required). Accepts epic ID (UUID) or " +
            "exact epic name (e.g., 'Mobile App Redesign'). The epic's team determines " +
            "the identifier prefix and available statuses."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A detailed description of the feature in Markdown format. Can include requirements, " +
            "acceptance criteria, technical notes, etc. Supports full Markdown syntax."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Initial status for the feature. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'Backlog', 'In Progress'). If not provided, the feature is created without a status. " +
            "Status names are resolved within the epic's team context."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "User to assign this feature to. Accepts user ID (UUID) or the special value 'me' " +
            "to assign to the current authenticated user. If not provided, the feature is unassigned."
          ),
        // Execution metadata
        executionOrder: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Suggested execution order (1, 2, 3...). Lower numbers are worked on first."
          ),
        canParallelize: z
          .boolean()
          .optional()
          .describe(
            "Whether this feature can run alongside other features in parallel."
          ),
        parallelGroup: z
          .string()
          .max(100)
          .optional()
          .describe(
            "Group identifier for features that can run together in parallel."
          ),
        dependencies: z
          .array(z.string().uuid())
          .optional()
          .describe(
            "Array of feature UUIDs that must be completed before this feature."
          ),
        estimatedComplexity: z
          .enum(["trivial", "simple", "moderate", "complex"])
          .optional()
          .describe(
            "Estimated complexity: 'trivial', 'simple', 'moderate', or 'complex'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve epic to get epicId and teamId
        const { data: epic } = await apiClient.getEpic(input.epic);

        // Resolve status name to ID if provided
        let statusId = input.status;
        if (statusId) {
          statusId = await apiClient.resolveStatusId(statusId, epic.teamId);
        }

        const { data: feature } = await apiClient.createFeature({
          title: input.title,
          epicId: epic.id,
          description: input.description,
          statusId,
          assigneeId: input.assignee,
          executionOrder: input.executionOrder,
          canParallelize: input.canParallelize,
          parallelGroup: input.parallelGroup,
          dependencies: input.dependencies,
          estimatedComplexity: input.estimatedComplexity,
        });

        // Add contextual reminders to guide next steps
        const responseWithReminders = addRemindersToResponse(
          feature as unknown as Record<string, unknown>,
          "create_feature",
          {
            id: feature.id,
            identifier: feature.identifier,
          }
        );

        return createResponse(responseWithReminders);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epic}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_feature
  // ==========================================================================
  server.registerTool(
    "spectree__update_feature",
    {
      description:
        "Update an existing feature. Only the fields you provide will be updated; " +
        "omitted fields retain their current values. Returns the updated feature with " +
        "all current field values. Use this to change status, reassign, or modify content.\n\n" +
        "TIP: After completing significant work on a feature, consider using:\n" +
        "- spectree__complete_work to mark it done (auto-calculates duration)\n" +
        "- spectree__log_progress to note partial progress\n" +
        "- spectree__start_work to begin work (sets status and timestamps)",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature to update (required). Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123')."
          ),
        title: z
          .string()
          .min(1)
          .optional()
          .describe(
            "New title for the feature. Only provide if you want to change the title " +
            "(e.g., 'Updated: User Authentication Flow')."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "New description in Markdown format. Replaces the entire description; " +
            "there is no append mode. Supports full Markdown syntax."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "New status for the feature. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'In Progress', 'Done'). Status names are resolved within the feature's " +
            "team context."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "New assignee for the feature. Accepts user ID (UUID) or the special value 'me' " +
            "to assign to the current authenticated user."
          ),
        // Execution metadata
        executionOrder: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Suggested execution order (1, 2, 3...). Lower numbers are worked on first."
          ),
        canParallelize: z
          .boolean()
          .optional()
          .describe(
            "Whether this feature can run alongside other features in parallel."
          ),
        parallelGroup: z
          .string()
          .max(100)
          .optional()
          .describe(
            "Group identifier for features that can run together in parallel."
          ),
        dependencies: z
          .array(z.string().uuid())
          .optional()
          .describe(
            "Array of feature UUIDs that must be completed before this feature."
          ),
        estimatedComplexity: z
          .enum(["trivial", "simple", "moderate", "complex"])
          .optional()
          .describe(
            "Estimated complexity: 'trivial', 'simple', 'moderate', or 'complex'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve status name to ID if provided
        let statusId = input.status;
        if (statusId) {
          // Get feature to find its team context
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: epic } = await apiClient.getEpic(feature.epicId);
          statusId = await apiClient.resolveStatusId(statusId, epic.teamId);
        }

        const { data: feature } = await apiClient.updateFeature(input.id, {
          title: input.title,
          description: input.description,
          statusId,
          assigneeId: input.assignee,
          executionOrder: input.executionOrder,
          canParallelize: input.canParallelize,
          parallelGroup: input.parallelGroup,
          dependencies: input.dependencies,
          estimatedComplexity: input.estimatedComplexity,
        });

        return createResponse(feature);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Feature '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
