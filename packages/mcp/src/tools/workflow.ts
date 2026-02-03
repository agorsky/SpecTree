/**
 * MCP Tool for Guided Workflow
 *
 * Provides a tool that tells AI agents exactly what to do next based on
 * current context. Instead of relying on agents to read and remember
 * documentation, this tool provides just-in-time guidance.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse, createErrorResponse } from "./utils.js";
import { getNextRequiredAction } from "./workflowChecker.js";
import { WORKFLOW_STAGES, type WorkflowContext } from "./workflowStages.js";

// Valid workflow contexts
const WORKFLOW_CONTEXTS = [
  "session_start",
  "creating_epic",
  "feature_created",
  "task_created",
  "working",
  "completing_task",
  "completing_feature",
  "session_end",
] as const;

/**
 * Register workflow guidance tools
 */
export function registerWorkflowTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_next_required_action
  // ==========================================================================
  server.registerTool(
    "spectree__get_next_required_action",
    {
      description:
        "Get the next required action based on current workflow context. Call this when " +
        "unsure what to do next or to verify all requirements are met before proceeding.\n\n" +
        "This tool checks actual state (e.g., does the feature have structured description?) " +
        "and returns specific guidance including:\n" +
        "- The action to take\n" +
        "- Which tool to call\n" +
        "- Why the action is needed\n" +
        "- Example of how to call the tool\n\n" +
        "Workflow contexts:\n" +
        "- session_start: Beginning work on an epic\n" +
        "- creating_epic: Creating a new epic from template\n" +
        "- feature_created: Setting up a feature properly\n" +
        "- task_created: Setting up a task properly\n" +
        "- working: Actively implementing a task\n" +
        "- completing_task: Finishing and validating a task\n" +
        "- completing_feature: Finishing a feature after all tasks\n" +
        "- session_end: Wrapping up and handing off to next session",
      inputSchema: {
        context: z
          .enum(WORKFLOW_CONTEXTS)
          .describe(
            "The current workflow stage you are in. Choose the stage that best describes " +
            "what you are currently doing or about to do."
          ),
        epicId: z
          .string()
          .optional()
          .describe(
            "Epic ID or name (required for session_start, session_end, and creating_epic contexts). " +
            "Accepts UUID or exact epic name."
          ),
        featureId: z
          .string()
          .optional()
          .describe(
            "Feature ID or identifier (required for feature_created, working, and " +
            "completing_feature contexts). Accepts UUID or identifier like 'ENG-123'."
          ),
        taskId: z
          .string()
          .optional()
          .describe(
            "Task ID or identifier (required for task_created, working, and completing_task " +
            "contexts). Accepts UUID or identifier like 'ENG-123-1'."
          ),
      },
    },
    async (input) => {
      try {
        const context = input.context as WorkflowContext;

        // Validate required IDs based on context
        if (
          ["session_start", "session_end", "creating_epic"].includes(context) &&
          !input.epicId
        ) {
          return createErrorResponse(
            new Error(
              `Epic ID is required for '${context}' context. ` +
              "Provide epicId parameter with the epic's UUID or name."
            )
          );
        }

        if (
          ["feature_created", "completing_feature"].includes(context) &&
          !input.featureId
        ) {
          return createErrorResponse(
            new Error(
              `Feature ID is required for '${context}' context. ` +
              "Provide featureId parameter with the feature's UUID or identifier."
            )
          );
        }

        if (["task_created", "completing_task"].includes(context) && !input.taskId) {
          return createErrorResponse(
            new Error(
              `Task ID is required for '${context}' context. ` +
              "Provide taskId parameter with the task's UUID or identifier."
            )
          );
        }

        // Get the next required action
        const result = await getNextRequiredAction(context, {
          epicId: input.epicId ?? undefined,
          featureId: input.featureId ?? undefined,
          taskId: input.taskId ?? undefined,
        });

        return createResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_workflow_stages
  // ==========================================================================
  server.registerTool(
    "spectree__get_workflow_stages",
    {
      description:
        "Get information about all workflow stages and their requirements. Use this to " +
        "understand the full workflow and what is expected at each stage. Returns all stages " +
        "with their descriptions, requirements, and completion criteria.",
      inputSchema: {
        stage: z
          .enum([...WORKFLOW_CONTEXTS, "all"])
          .optional()
          .describe(
            "Specific stage to get information about, or 'all' to list all stages. " +
            "Defaults to 'all' if not specified."
          ),
      },
    },
    async (input) => {
      try {
        const stageFilter = input.stage ?? "all";

        if (stageFilter === "all") {
          // Return overview of all stages
          const stages = Object.values(WORKFLOW_STAGES).map((stage) => ({
            id: stage.id,
            description: stage.description,
            requirementCount: stage.requirements.length,
            completionCriteria: stage.completionCriteria,
          }));

          return createResponse({
            totalStages: stages.length,
            stages,
            usage:
              "Use spectree__get_next_required_action with a specific context to check " +
              "requirements and get guidance.",
          });
        }

        // Return details for a specific stage
        const stage = WORKFLOW_STAGES[stageFilter as WorkflowContext];
        if (!stage) {
          return createErrorResponse(new Error(`Unknown stage: ${stageFilter}`));
        }

        return createResponse({
          id: stage.id,
          description: stage.description,
          completionCriteria: stage.completionCriteria,
          requirements: stage.requirements.map((r) => ({
            check: r.check,
            description: r.description,
            action: r.action,
            tool: r.tool,
            priority: r.priority,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
