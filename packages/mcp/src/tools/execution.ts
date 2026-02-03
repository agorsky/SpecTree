/**
 * MCP Tools for Execution Planning
 *
 * Provides tools for AI agents to understand task ordering,
 * dependencies, and parallelization opportunities.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Valid complexity values
const complexityValues = ["trivial", "simple", "moderate", "complex"] as const;

// Register all execution tools
export function registerExecutionTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_execution_plan
  // ==========================================================================
  server.registerTool(
    "spectree__get_execution_plan",
    {
      description:
        "Get an ordered execution plan for features in an epic. Returns phases with items " +
        "grouped by dependencies and parallel execution capability. Use this to understand " +
        "what order to work on features, which can run in parallel, and estimated complexity. " +
        "Items are ordered by their execution metadata (executionOrder, dependencies, parallelGroup).",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to generate an execution plan for. Accepts epic ID (UUID) or " +
            "exact epic name (e.g., 'Mobile App Redesign')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve epic name to ID if needed
        const { data: epic } = await apiClient.getEpic(input.epicId);

        const plan = await apiClient.getExecutionPlan(epic.id);

        return createResponse(plan);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__set_execution_metadata
  // ==========================================================================
  server.registerTool(
    "spectree__set_execution_metadata",
    {
      description:
        "Set execution metadata for a feature or task. Use this to define execution order, " +
        "dependencies, parallelization, and complexity estimates. This metadata helps AI agents " +
        "understand how to approach work items.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier to update. Accepts UUID or human-readable " +
            "identifier (e.g., 'COM-123' for features, 'COM-123-1' for tasks)."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        executionOrder: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Suggested execution order (1, 2, 3...). Items with lower numbers should be " +
            "worked on first. Items without executionOrder are processed after numbered items."
          ),
        canParallelize: z
          .boolean()
          .optional()
          .describe(
            "Whether this item can run alongside other items. Set to true if the work " +
            "is independent and doesn't conflict with other parallel work."
          ),
        parallelGroup: z
          .string()
          .max(100)
          .optional()
          .describe(
            "Group identifier for items that can run together. Items in the same " +
            "parallelGroup with canParallelize=true will be grouped in the same execution phase."
          ),
        dependencies: z
          .array(z.string().uuid())
          .optional()
          .describe(
            "Array of feature/task UUIDs that must be completed before this item. " +
            "The execution plan will ensure dependencies are scheduled in earlier phases."
          ),
        estimatedComplexity: z
          .enum(complexityValues)
          .optional()
          .describe(
            "Estimated complexity of the work: 'trivial' (< 1 hour), 'simple' (1-4 hours), " +
            "'moderate' (1-3 days), or 'complex' (> 3 days). Helps with planning and prioritization."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const updateData = {
          executionOrder: input.executionOrder,
          canParallelize: input.canParallelize,
          parallelGroup: input.parallelGroup,
          dependencies: input.dependencies,
          estimatedComplexity: input.estimatedComplexity,
        };

        let result;
        if (input.type === "feature") {
          const { data: feature } = await apiClient.updateFeature(input.id, updateData);
          result = feature;
        } else {
          const { data: task } = await apiClient.updateTask(input.id, updateData);
          result = task;
        }

        // Validate that the response matches what we sent
        const validationErrors: string[] = [];
        if (input.executionOrder !== undefined && result.executionOrder !== input.executionOrder) {
          validationErrors.push(`executionOrder: expected ${input.executionOrder}, got ${result.executionOrder}`);
        }
        if (input.canParallelize !== undefined && result.canParallelize !== input.canParallelize) {
          validationErrors.push(`canParallelize: expected ${input.canParallelize}, got ${result.canParallelize}`);
        }
        if (input.parallelGroup !== undefined && result.parallelGroup !== input.parallelGroup) {
          validationErrors.push(`parallelGroup: expected ${input.parallelGroup}, got ${result.parallelGroup}`);
        }
        if (input.estimatedComplexity !== undefined && result.estimatedComplexity !== input.estimatedComplexity) {
          validationErrors.push(`estimatedComplexity: expected ${input.estimatedComplexity}, got ${result.estimatedComplexity}`);
        }
        // For dependencies, compare arrays
        if (input.dependencies !== undefined) {
          const expectedDeps = new Set(input.dependencies);
          // Handle dependencies which may be stored as JSON string or array
          const resultDeps = typeof result.dependencies === 'string' 
            ? JSON.parse(result.dependencies) 
            : (result.dependencies || []);
          const actualDeps = new Set(resultDeps as string[]);
          if (expectedDeps.size !== actualDeps.size || 
              ![...expectedDeps].every(d => actualDeps.has(d))) {
            validationErrors.push(`dependencies: expected [${input.dependencies.join(', ')}], got [${resultDeps.join(', ')}]`);
          }
        }

        if (validationErrors.length > 0) {
          return createErrorResponse(new Error(
            `Execution metadata was not persisted correctly. Validation errors:\n${validationErrors.join('\n')}\n\n` +
            `This may indicate a bug in the API. The response was:\n${JSON.stringify(result, null, 2)}`
          ));
        }

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__mark_blocked
  // ==========================================================================
  server.registerTool(
    "spectree__mark_blocked",
    {
      description:
        "Mark a feature or task as blocked by another item. Adds the blocker to the " +
        "item's dependencies, ensuring the blocker is completed first in execution plans.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task that is blocked. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether the blocked item is a 'feature' or 'task'."),
        blockedById: z
          .string()
          .uuid()
          .describe(
            "The UUID of the feature or task that is blocking this item. " +
            "This item will be added to the dependencies list."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Get current item to access existing dependencies
        let currentDeps: string[] = [];
        
        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          currentDeps = feature.dependencies ? JSON.parse(feature.dependencies) as string[] : [];
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          currentDeps = task.dependencies ? JSON.parse(task.dependencies) as string[] : [];
        }

        // Add new dependency if not already present
        if (!currentDeps.includes(input.blockedById)) {
          currentDeps.push(input.blockedById);
        }

        // Update the item
        if (input.type === "feature") {
          const { data: feature } = await apiClient.updateFeature(input.id, {
            dependencies: currentDeps,
          });
          return createResponse({
            ...feature,
            message: `Feature '${input.id}' is now blocked by '${input.blockedById}'`,
          });
        } else {
          const { data: task } = await apiClient.updateTask(input.id, {
            dependencies: currentDeps,
          });
          return createResponse({
            ...task,
            message: `Task '${input.id}' is now blocked by '${input.blockedById}'`,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__mark_unblocked
  // ==========================================================================
  server.registerTool(
    "spectree__mark_unblocked",
    {
      description:
        "Remove a blocker from a feature or task. Removes the specified item from " +
        "the dependencies list, allowing it to be scheduled without waiting for the blocker.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task to unblock. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether the item is a 'feature' or 'task'."),
        unblockedFromId: z
          .string()
          .uuid()
          .describe(
            "The UUID of the feature or task to remove from dependencies."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Get current item to access existing dependencies
        let currentDeps: string[] = [];
        
        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          currentDeps = feature.dependencies ? JSON.parse(feature.dependencies) as string[] : [];
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          currentDeps = task.dependencies ? JSON.parse(task.dependencies) as string[] : [];
        }

        // Remove the dependency
        const newDeps = currentDeps.filter((dep) => dep !== input.unblockedFromId);

        // Update the item
        if (input.type === "feature") {
          const { data: feature } = await apiClient.updateFeature(input.id, {
            dependencies: newDeps,
          });
          return createResponse({
            ...feature,
            message: `Feature '${input.id}' is no longer blocked by '${input.unblockedFromId}'`,
          });
        } else {
          const { data: task } = await apiClient.updateTask(input.id, {
            dependencies: newDeps,
          });
          return createResponse({
            ...task,
            message: `Task '${input.id}' is no longer blocked by '${input.unblockedFromId}'`,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
