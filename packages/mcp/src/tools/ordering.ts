/**
 * MCP Tools for Ordering/Reordering operations
 *
 * Provides tools for reordering projects, features, and tasks in SpecTree.
 * Enables AI agents to programmatically organize work items.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  prisma,
  NotFoundError,
  ValidationError,
} from "@spectree/api/src/services/index.js";
import { generateSortOrderBetween } from "@spectree/api/src/utils/ordering.js";

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

/**
 * Register all ordering-related tools
 */
export function registerOrderingTools(server: McpServer): void {
  // ==========================================================================
  // spectree__reorder_project
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_project",
    {
      description:
        "Reorder a project within its team's project list. Use this to change the " +
        "position of a project relative to other projects. Provide afterId to place " +
        "the project after another one, or beforeId to place it before another one, " +
        "or both to place it precisely between two projects. " +
        "Projects must belong to the same team.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the project to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the project to place this project after. " +
            "If not provided, the project will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the project to place this project before. " +
            "If not provided, the project will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          throw new ValidationError("At least one of afterId or beforeId must be provided");
        }

        // Fetch the project being reordered
        const project = await prisma.project.findUnique({
          where: { id: input.id },
          select: { id: true, teamId: true, isArchived: true },
        });

        if (!project || project.isArchived) {
          throw new NotFoundError(`Project with id '${input.id}' not found`);
        }

        let beforeSortOrder: number | null = null;
        let afterSortOrder: number | null = null;

        // If afterId is provided, fetch that project's sortOrder
        if (input.afterId) {
          const afterProject = await prisma.project.findUnique({
            where: { id: input.afterId },
            select: { teamId: true, sortOrder: true, isArchived: true },
          });

          if (!afterProject || afterProject.isArchived) {
            throw new NotFoundError(`After project with id '${input.afterId}' not found`);
          }

          if (afterProject.teamId !== project.teamId) {
            throw new ValidationError("Projects must belong to the same team");
          }

          beforeSortOrder = afterProject.sortOrder;
        }

        // If beforeId is provided, fetch that project's sortOrder
        if (input.beforeId) {
          const beforeProject = await prisma.project.findUnique({
            where: { id: input.beforeId },
            select: { teamId: true, sortOrder: true, isArchived: true },
          });

          if (!beforeProject || beforeProject.isArchived) {
            throw new NotFoundError(`Before project with id '${input.beforeId}' not found`);
          }

          if (beforeProject.teamId !== project.teamId) {
            throw new ValidationError("Projects must belong to the same team");
          }

          afterSortOrder = beforeProject.sortOrder;
        }

        // Calculate the new sortOrder
        const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

        // Update the project's sortOrder
        const updatedProject = await prisma.project.update({
          where: { id: input.id },
          data: { sortOrder: newSortOrder },
          include: {
            team: { select: { id: true, name: true, key: true } },
          },
        });

        return createResponse({
          id: updatedProject.id,
          name: updatedProject.name,
          sortOrder: updatedProject.sortOrder,
          team: updatedProject.team,
          updatedAt: updatedProject.updatedAt.toISOString(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reorder_feature
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_feature",
    {
      description:
        "Reorder a feature within its project. Use this to change the position of " +
        "a feature relative to other features. Provide afterId to place the feature " +
        "after another one, or beforeId to place it before another one, or both to " +
        "place it precisely between two features. " +
        "Features must belong to the same project.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the feature to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the feature to place this feature after. " +
            "If not provided, the feature will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the feature to place this feature before. " +
            "If not provided, the feature will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          throw new ValidationError("At least one of afterId or beforeId must be provided");
        }

        // Fetch the feature being reordered
        const feature = await prisma.feature.findUnique({
          where: { id: input.id },
          select: { id: true, projectId: true, identifier: true },
        });

        if (!feature) {
          throw new NotFoundError(`Feature with id '${input.id}' not found`);
        }

        let beforeSortOrder: number | null = null;
        let afterSortOrder: number | null = null;

        // If afterId is provided, fetch that feature's sortOrder
        if (input.afterId) {
          const afterFeature = await prisma.feature.findUnique({
            where: { id: input.afterId },
            select: { projectId: true, sortOrder: true },
          });

          if (!afterFeature) {
            throw new NotFoundError(`After feature with id '${input.afterId}' not found`);
          }

          if (afterFeature.projectId !== feature.projectId) {
            throw new ValidationError("Features must belong to the same project");
          }

          beforeSortOrder = afterFeature.sortOrder;
        }

        // If beforeId is provided, fetch that feature's sortOrder
        if (input.beforeId) {
          const beforeFeature = await prisma.feature.findUnique({
            where: { id: input.beforeId },
            select: { projectId: true, sortOrder: true },
          });

          if (!beforeFeature) {
            throw new NotFoundError(`Before feature with id '${input.beforeId}' not found`);
          }

          if (beforeFeature.projectId !== feature.projectId) {
            throw new ValidationError("Features must belong to the same project");
          }

          afterSortOrder = beforeFeature.sortOrder;
        }

        // Calculate the new sortOrder
        const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

        // Update the feature's sortOrder
        const updatedFeature = await prisma.feature.update({
          where: { id: input.id },
          data: { sortOrder: newSortOrder },
          include: {
            project: { select: { id: true, name: true } },
          },
        });

        return createResponse({
          id: updatedFeature.id,
          identifier: updatedFeature.identifier,
          title: updatedFeature.title,
          sortOrder: updatedFeature.sortOrder,
          project: updatedFeature.project,
          updatedAt: updatedFeature.updatedAt.toISOString(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reorder_task
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_task",
    {
      description:
        "Reorder a task within its parent feature. Use this to change the position " +
        "of a task relative to other tasks. Provide afterId to place the task after " +
        "another one, or beforeId to place it before another one, or both to place " +
        "it precisely between two tasks. " +
        "Tasks must belong to the same feature.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the task to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the task to place this task after. " +
            "If not provided, the task will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the task to place this task before. " +
            "If not provided, the task will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          throw new ValidationError("At least one of afterId or beforeId must be provided");
        }

        // Fetch the task being reordered
        const task = await prisma.task.findUnique({
          where: { id: input.id },
          select: { id: true, featureId: true, identifier: true },
        });

        if (!task) {
          throw new NotFoundError(`Task with id '${input.id}' not found`);
        }

        let beforeSortOrder: number | null = null;
        let afterSortOrder: number | null = null;

        // If afterId is provided, fetch that task's sortOrder
        if (input.afterId) {
          const afterTask = await prisma.task.findUnique({
            where: { id: input.afterId },
            select: { featureId: true, sortOrder: true },
          });

          if (!afterTask) {
            throw new NotFoundError(`After task with id '${input.afterId}' not found`);
          }

          if (afterTask.featureId !== task.featureId) {
            throw new ValidationError("Tasks must belong to the same feature");
          }

          beforeSortOrder = afterTask.sortOrder;
        }

        // If beforeId is provided, fetch that task's sortOrder
        if (input.beforeId) {
          const beforeTask = await prisma.task.findUnique({
            where: { id: input.beforeId },
            select: { featureId: true, sortOrder: true },
          });

          if (!beforeTask) {
            throw new NotFoundError(`Before task with id '${input.beforeId}' not found`);
          }

          if (beforeTask.featureId !== task.featureId) {
            throw new ValidationError("Tasks must belong to the same feature");
          }

          afterSortOrder = beforeTask.sortOrder;
        }

        // Calculate the new sortOrder
        const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

        // Update the task's sortOrder
        const updatedTask = await prisma.task.update({
          where: { id: input.id },
          data: { sortOrder: newSortOrder },
          include: {
            feature: { select: { id: true, identifier: true, title: true } },
          },
        });

        return createResponse({
          id: updatedTask.id,
          identifier: updatedTask.identifier,
          title: updatedTask.title,
          sortOrder: updatedTask.sortOrder,
          feature: updatedTask.feature,
          updatedAt: updatedTask.updatedAt.toISOString(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
