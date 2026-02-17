/**
 * MCP Tools for Workflow Guidance
 *
 * Provides tools for analyzing work item state and suggesting next actions
 * to maintain compliance with SpecTree best practices.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

interface NextAction {
  priority: number;
  action: string;
  reason: string;
  toolName: string;
  exampleParameters: Record<string, unknown>;
}

// Register all workflow guidance tools
export function registerWorkflowTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_next_required_action
  // ==========================================================================
  server.registerTool(
    "spectree__get_next_required_action",
    {
      description:
        "Analyze current work item state and suggest the next required action to maintain " +
        "compliance with SpecTree best practices. Returns prioritized list of suggestions " +
        "with tool names and example parameters.\n\n" +
        "Use this when you're unsure what to do next with a feature, task, or epic to ensure " +
        "proper workflow compliance and tracking.",
      inputSchema: {
        itemId: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
          "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
        ),
        itemType: z.enum(["feature", "task", "epic"]).describe(
          "Whether this is a 'feature', 'task', or 'epic'."
        ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const suggestions: NextAction[] = [];

        // Fetch item with all metadata
        interface WorkItem {
          executionOrder?: number | null;
          estimatedComplexity?: string | null;
          structuredDesc?: {
            summary?: string;
            acceptanceCriteria?: string[];
            aiInstructions?: string;
          } | string | null;
          validationChecks?: { status: string }[];
          status?: { name?: string; category?: string } | null;
          startedAt?: string | null;
          title?: string;
          name?: string;
        }
        let item: WorkItem;
        if (input.itemType === "feature") {
          const { data } = await apiClient.getFeature(input.itemId);
          item = data;
        } else if (input.itemType === "task") {
          const { data } = await apiClient.getTask(input.itemId);
          item = data;
        } else {
          const { data } = await apiClient.getEpic(input.itemId);
          item = data;
        }

        // Analyze missing requirements and suggest actions

        // 1. Check execution metadata (features and tasks only)
        if (input.itemType !== "epic") {
          if (!item.executionOrder) {
            suggestions.push({
              priority: 1,
              action: "Set execution order",
              reason: "No execution order defined. This is required for proper planning and ordering.",
              toolName: "spectree__set_execution_metadata",
              exampleParameters: {
                id: input.itemId,
                type: input.itemType,
                executionOrder: 1,
                estimatedComplexity: "moderate",
              },
            });
          }

          if (!item.estimatedComplexity) {
            suggestions.push({
              priority: 1,
              action: "Set estimated complexity",
              reason: "No complexity estimate defined. This is required for effort estimation.",
              toolName: "spectree__set_execution_metadata",
              exampleParameters: {
                id: input.itemId,
                type: input.itemType,
                executionOrder: item.executionOrder ?? 1,
                estimatedComplexity: "moderate",
              },
            });
          }
        }

        // 2. Check structured description
        const rawDesc = item.structuredDesc;
        const structuredDesc = typeof rawDesc === 'string' ? null : rawDesc;
        if (!structuredDesc?.summary) {
          suggestions.push({
            priority: 2,
            action: "Add structured description with summary",
            reason: "No structured description found. Summary is required for documentation.",
            toolName: "spectree__manage_description",
            exampleParameters: {
              action: "set",
              id: input.itemId,
              type: input.itemType,
              structuredDesc: {
                summary: "Brief summary here",
                aiInstructions: "Instructions for AI implementation",
                acceptanceCriteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
              },
            },
          });
        } else {
          // Check acceptance criteria
          const criteriaCount = structuredDesc.acceptanceCriteria?.length ?? 0;
          const minCriteria = input.itemType === "task" ? 2 : 3;
          if (criteriaCount < minCriteria) {
            suggestions.push({
              priority: 2,
              action: "Add acceptance criteria",
              reason: `Only ${String(criteriaCount)} acceptance criteria defined. Minimum ${String(minCriteria)} required for ${input.itemType}s.`,
              toolName: "spectree__manage_description",
              exampleParameters: {
                action: "add_criterion",
                id: input.itemId,
                type: input.itemType,
                criterion: "New acceptance criterion",
              },
            });
          }

          // Check AI instructions for tasks
          if (input.itemType === "task" && !structuredDesc.aiInstructions) {
            suggestions.push({
              priority: 2,
              action: "Add AI instructions",
              reason: "No AI instructions defined. These are required for tasks to guide implementation.",
              toolName: "spectree__manage_description",
              exampleParameters: {
                action: "update_section",
                id: input.itemId,
                type: input.itemType,
                section: "aiInstructions",
                value: "Step-by-step instructions for AI agent implementation",
              },
            });
          }
        }

        // 3. Check validation checks for tasks
        if (input.itemType === "task") {
          const validationChecks = item.validationChecks;
          if (!validationChecks || validationChecks.length === 0) {
            suggestions.push({
              priority: 3,
              action: "Add validation checks",
              reason: "No validation checks defined. Tasks should have automated checks to verify completion.",
              toolName: "spectree__manage_validations",
              exampleParameters: {
                action: "add",
                taskId: input.itemId,
                type: "command",
                description: "Check that code builds successfully",
                command: "pnpm build",
                expectedExitCode: 0,
              },
            });
          }
        }

        // 4. Check work status and timing
        const status = item.status ?? {};
        const statusCategory = status.category ?? "backlog";

        if (statusCategory === "backlog" || statusCategory === "unstarted") {
          suggestions.push({
            priority: 4,
            action: "Start work",
            reason: "Item is in backlog. Use spectree__start_work to mark it in progress.",
            toolName: "spectree__start_work",
            exampleParameters: {
              id: input.itemId,
              type: input.itemType,
            },
          });
        } else if (statusCategory === "started" && !item.startedAt) {
          suggestions.push({
            priority: 4,
            action: "Mark work started",
            reason: "Item is in progress but startedAt timestamp is missing.",
            toolName: "spectree__start_work",
            exampleParameters: {
              id: input.itemId,
              type: input.itemType,
            },
          });
        }

        // 5. Check if all validations passed (for tasks)
        if (input.itemType === "task" && statusCategory === "started") {
          const validationChecks = item.validationChecks ?? [];
          const allPassed = validationChecks.length > 0 && 
            validationChecks.every((check) => check.status === "passed");
          
          if (allPassed) {
            suggestions.push({
              priority: 5,
              action: "Complete work",
              reason: "All validation checks passed. Ready to mark as complete.",
              toolName: "spectree__complete_work",
              exampleParameters: {
                id: input.itemId,
                type: input.itemType,
                summary: "Summary of work completed",
              },
            });
          } else if (validationChecks.length > 0) {
            const hasPending = validationChecks.some((check) => check.status === "pending");
            if (hasPending) {
              suggestions.push({
                priority: 5,
                action: "Run validations",
                reason: "Validation checks are pending. Run them before completing.",
                toolName: "spectree__run_all_validations",
                exampleParameters: {
                  taskId: input.itemId,
                },
              });
            }
          }
        }

        // Sort by priority
        suggestions.sort((a, b) => a.priority - b.priority);

        return createResponse({
          itemId: input.itemId,
          itemType: input.itemType,
          itemTitle: item.title ?? item.name,
          currentStatus: status.name ?? "Unknown",
          statusCategory,
          suggestions,
          message: suggestions.length > 0
            ? `Found ${String(suggestions.length)} suggested action(s) to maintain compliance`
            : "No suggestions - item appears to be properly configured",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`${input.itemType} '${input.itemId}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_session_state
  // ==========================================================================
  server.registerTool(
    "spectree__get_session_state",
    {
      description:
        "Get the current state of an AI session and allowed state transitions. " +
        "The session state machine tracks workflow progress through states: " +
        "STARTED → PLANNING → IMPLEMENTING → VALIDATING → COMPLETING.\n\n" +
        "Use this to understand where you are in the workflow and what transitions are allowed.",
      inputSchema: {
        sessionId: z.string().describe(
          "The session ID to query. Get this from spectree__start_session or spectree__get_active_session."
        ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Call the API to get session state
        const response = await apiClient.getSessionState(input.sessionId);

        return createResponse({
          sessionId: input.sessionId,
          currentState: response.data.currentState,
          allowedTransitions: response.data.allowedTransitions,
          message: `Session is in ${response.data.currentState} state. ` +
            (response.data.allowedTransitions.length > 0
              ? `Can transition to: ${response.data.allowedTransitions.join(", ")}`
              : "Terminal state reached"),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Session '${input.sessionId}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );
}
