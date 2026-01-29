/**
 * MCP Tools for Task Operations
 *
 * Tasks are sub-issues under features. They inherit team scope
 * from their parent feature.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  taskService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";

/**
 * Helper to get task by ID or identifier (e.g., PROJ-123-1)
 */
async function getTaskByIdOrIdentifier(id: string) {
  // Check if this looks like a UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(id)) {
    return taskService.getTaskById(id);
  }

  // Try to find by identifier (e.g., PROJ-123-1)
  return prisma.task.findUnique({
    where: { identifier: id },
  });
}

/**
 * Helper to resolve feature ID by UUID or identifier
 */
async function resolveFeatureId(feature: string): Promise<string | null> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(feature)) {
    return feature;
  }

  // Look up by identifier
  const featureRecord = await prisma.feature.findUnique({
    where: { identifier: feature },
    select: { id: true },
  });

  return featureRecord?.id ?? null;
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

// Register all task tools
export function registerTaskTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_tasks
  // ==========================================================================
  server.registerTool(
    "spectree__list_tasks",
    {
      description:
        "List tasks in SpecTree with optional filtering by feature, status, or assignee. " +
        "Tasks are sub-issues that belong to a parent feature, used for breaking down work " +
        "into smaller pieces. Returns paginated results ordered by sort order then creation " +
        "date (newest first). Each task has an auto-generated identifier based on its parent " +
        "feature (e.g., if the feature is 'COM-123', tasks are 'COM-123-1', 'COM-123-2', etc.).",
      inputSchema: {
        feature: z
          .string()
          .optional()
          .describe(
            "Filter tasks by parent feature. Accepts feature ID (UUID) or identifier " +
            "(e.g., 'COM-123'). Use this to get all tasks for a specific feature."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status ID (UUID). Tasks use the same status system as features, " +
            "scoped to the feature's team."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "Filter by assignee user ID (UUID). Returns only tasks assigned to the " +
            "specified user."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of tasks to return per page (default: 20, max: 100). " +
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
        // Resolve feature ID if provided
        let featureId: string | undefined;
        if (input.feature) {
          const resolved = await resolveFeatureId(input.feature);
          if (!resolved) {
            throw new NotFoundError(`Feature '${input.feature}' not found`);
          }
          featureId = resolved;
        }

        const result = await taskService.listTasks({
          cursor: input.cursor,
          limit: input.limit,
          featureId,
          statusId: input.status,
          assigneeId: input.assignee,
        });

        return createResponse({
          tasks: result.data,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_task
  // ==========================================================================
  server.registerTool(
    "spectree__get_task",
    {
      description:
        "Get detailed information about a specific task by ID or identifier. " +
        "Returns the full task object including all metadata such as title, description, " +
        "status, assignee, and timestamps.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The task identifier to look up. Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123-1'). The identifier format is '{FEATURE_IDENTIFIER}-{NUMBER}'."
          ),
      },
    },
    async (input) => {
      try {
        const task = await getTaskByIdOrIdentifier(input.id);

        if (!task) {
          throw new NotFoundError(`Task '${input.id}' not found`);
        }

        return createResponse(task);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_task
  // ==========================================================================
  server.registerTool(
    "spectree__create_task",
    {
      description:
        "Create a new task under a feature. Tasks are sub-issues used to break down features " +
        "into smaller, actionable work items. Each task is automatically assigned a unique " +
        "identifier based on its parent feature (e.g., if the feature is 'COM-123', the task " +
        "might be 'COM-123-1'). Returns the created task with all metadata including the " +
        "generated identifier.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe(
            "The title of the task (required). Should be a concise, actionable description " +
            "(e.g., 'Implement password validation', 'Write unit tests for auth module')."
          ),
        feature_id: z
          .string()
          .describe(
            "The parent feature for this task (required). Accepts feature ID (UUID) or " +
            "identifier (e.g., 'COM-123'). The task inherits team scope from its parent feature."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A detailed description of the task in Markdown format. Can include implementation " +
            "notes, acceptance criteria, or technical details. Supports full Markdown syntax."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Initial status ID (UUID) for the task. Uses the same status system as features, " +
            "scoped to the parent feature's team. If not provided, the task is created without a status."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "User ID (UUID) to assign this task to. If not provided, the task is unassigned."
          ),
      },
    },
    async (input) => {
      try {
        // Resolve feature ID
        const featureId = await resolveFeatureId(input.feature_id);
        if (!featureId) {
          throw new NotFoundError(`Feature '${input.feature_id}' not found`);
        }

        const task = await taskService.createTask({
          title: input.title,
          featureId,
          description: input.description,
          statusId: input.status,
          assigneeId: input.assignee,
        });

        return createResponse(task);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_task
  // ==========================================================================
  server.registerTool(
    "spectree__update_task",
    {
      description:
        "Update an existing task. Only the fields you provide will be updated; omitted " +
        "fields retain their current values. Returns the updated task with all current " +
        "field values. Use this to change status, reassign, or modify content.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The task to update (required). Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123-1')."
          ),
        title: z
          .string()
          .min(1)
          .optional()
          .describe(
            "New title for the task. Only provide if you want to change the title " +
            "(e.g., 'Updated: Implement password validation')."
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
            "New status ID (UUID) for the task. Uses the same status system as features, " +
            "scoped to the parent feature's team."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "New assignee user ID (UUID) for the task."
          ),
      },
    },
    async (input) => {
      try {
        // First, find the task to get its UUID
        const existingTask = await getTaskByIdOrIdentifier(input.id);
        if (!existingTask) {
          throw new NotFoundError(`Task '${input.id}' not found`);
        }

        const task = await taskService.updateTask(existingTask.id, {
          title: input.title,
          description: input.description,
          statusId: input.status,
          assigneeId: input.assignee,
        });

        return createResponse(task);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
