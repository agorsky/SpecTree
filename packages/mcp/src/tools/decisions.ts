/**
 * MCP Tools for Decision Log operations
 *
 * Provides tools for logging and retrieving implementation decisions.
 * Decisions are append-only records that preserve the rationale behind choices.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Valid decision categories
const decisionCategories = [
  "architecture",
  "library",
  "approach",
  "scope",
  "design",
  "tradeoff",
  "deferral",
] as const;

// Valid impact levels
const impactLevels = ["low", "medium", "high"] as const;

// Register all decision tools
export function registerDecisionTools(server: McpServer): void {
  // ==========================================================================
  // spectree__log_decision
  // ==========================================================================
  server.registerTool(
    "spectree__log_decision",
    {
      description:
        "Record a decision with its rationale. Use this to preserve the reasoning behind " +
        "implementation choices, library selections, architectural decisions, or scope changes. " +
        "Decisions are append-only - once logged, they cannot be modified. This creates an " +
        "audit trail for future sessions to understand why choices were made.\n\n" +
        "When to log decisions:\n" +
        "- Choosing between multiple libraries/approaches\n" +
        "- Deciding to skip or defer something\n" +
        "- Making assumptions about requirements\n" +
        "- Changing direction from original plan",
      inputSchema: {
        epicId: z
          .string()
          .uuid()
          .describe(
            "The epic this decision relates to (required). All decisions must be associated " +
            "with an epic to maintain context."
          ),
        featureId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional feature this decision relates to. Use when the decision is specific " +
            "to a particular feature within the epic."
          ),
        taskId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional task this decision relates to. Use when the decision is specific " +
            "to a particular task within a feature."
          ),
        question: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            "What was being decided (required). A clear statement of the decision point. " +
            "Example: 'Which state management library to use for the dashboard'"
          ),
        decision: z
          .string()
          .min(1)
          .max(2000)
          .describe(
            "The choice that was made (required). A clear statement of what was decided. " +
            "Example: 'Use Zustand instead of Redux'"
          ),
        rationale: z
          .string()
          .min(1)
          .max(5000)
          .describe(
            "Why this choice was made (required). The reasoning behind the decision. " +
            "Example: 'Zustand has simpler API, smaller bundle size, and sufficient features " +
            "for our use case. Redux would be overkill for this project.'"
          ),
        alternatives: z
          .array(z.string().max(500))
          .max(10)
          .optional()
          .describe(
            "What other options were considered. List alternatives that were evaluated " +
            "but not chosen. Example: ['Redux', 'MobX', 'Jotai']"
          ),
        madeBy: z
          .string()
          .min(1)
          .max(255)
          .default("AI")
          .describe(
            "Who made the decision. Use 'AI' for AI-made decisions, 'human' for user decisions, " +
            "or a user ID for specific attribution. Default: 'AI'"
          ),
        category: z
          .enum(decisionCategories)
          .optional()
          .describe(
            "Category of the decision for filtering and grouping:\n" +
            "- 'architecture': System design decisions\n" +
            "- 'library': Package/dependency choices\n" +
            "- 'approach': Implementation strategy\n" +
            "- 'scope': Feature inclusion/exclusion\n" +
            "- 'design': UI/UX decisions\n" +
            "- 'tradeoff': Explicit tradeoff acknowledgment\n" +
            "- 'deferral': Postponed decisions"
          ),
        impact: z
          .enum(impactLevels)
          .optional()
          .describe(
            "Impact level of the decision:\n" +
            "- 'low': Minor impact, easily reversible\n" +
            "- 'medium': Moderate impact, some effort to change\n" +
            "- 'high': Major impact, significant effort to reverse"
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const { data: decision } = await apiClient.createDecision({
          epicId: input.epicId,
          featureId: input.featureId,
          taskId: input.taskId,
          question: input.question,
          decision: input.decision,
          rationale: input.rationale,
          alternatives: input.alternatives,
          madeBy: input.madeBy ?? "AI",
          category: input.category,
          impact: input.impact,
        });

        return createResponse({
          id: decision.id,
          question: decision.question,
          decision: decision.decision,
          rationale: decision.rationale,
          alternatives: decision.alternatives ? JSON.parse(decision.alternatives) : null,
          category: decision.category,
          impact: decision.impact,
          madeBy: decision.madeBy,
          madeAt: decision.madeAt,
          message: "Decision logged successfully",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic or referenced entity not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_decisions
  // ==========================================================================
  server.registerTool(
    "spectree__list_decisions",
    {
      description:
        "Get decisions for a specific context. Returns decisions filtered by epic, feature, " +
        "task, category, or impact level. Results are ordered by date (newest first). " +
        "Use this to review past decisions before making new ones, or to understand the " +
        "context of previous work.",
      inputSchema: {
        epicId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Filter by epic ID. Returns all decisions associated with this epic."
          ),
        featureId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Filter by feature ID. Returns decisions associated with this feature."
          ),
        taskId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Filter by task ID. Returns decisions associated with this task."
          ),
        category: z
          .enum(decisionCategories)
          .optional()
          .describe(
            "Filter by decision category (architecture, library, approach, scope, " +
            "design, tradeoff, deferral)."
          ),
        impact: z
          .enum(impactLevels)
          .optional()
          .describe(
            "Filter by impact level (low, medium, high)."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of decisions to return (default: 20, max: 100)."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const result = await apiClient.listDecisions({
          epicId: input.epicId,
          featureId: input.featureId,
          taskId: input.taskId,
          category: input.category,
          impact: input.impact,
          limit: input.limit,
          cursor: input.cursor,
        });

        // Parse alternatives JSON for each decision
        const decisions = result.data.map((d) => ({
          ...d,
          alternatives: d.alternatives ? JSON.parse(d.alternatives) : null,
        }));

        return createResponse({
          decisions,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__search_decisions
  // ==========================================================================
  server.registerTool(
    "spectree__search_decisions",
    {
      description:
        "Find relevant decisions by searching question, decision, and rationale text. " +
        "Use this to find past decisions that might be relevant to current work, " +
        "or to check if similar decisions have been made before.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Search query (required). Searches in question, decision, and rationale fields. " +
            "Example: 'authentication', 'database choice', 'performance optimization'"
          ),
        epicId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional: Limit search to a specific epic."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of results (default: 20, max: 100)."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const result = await apiClient.searchDecisions({
          query: input.query,
          epicId: input.epicId,
          limit: input.limit,
          cursor: input.cursor,
        });

        // Parse alternatives JSON for each decision
        const decisions = result.data.map((d) => ({
          ...d,
          alternatives: d.alternatives ? JSON.parse(d.alternatives) : null,
        }));

        return createResponse({
          query: input.query,
          decisions,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_decision_context
  // ==========================================================================
  server.registerTool(
    "spectree__get_decision_context",
    {
      description:
        "Get all decisions related to current work. Returns decisions organized by scope:\n" +
        "- Task-level decisions (if taskId provided)\n" +
        "- Feature-level decisions\n" +
        "- Epic-level decisions\n\n" +
        "This provides full decision history context for the current work item. " +
        "Use at the start of working on a task or feature to understand past decisions.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1'). " +
            "Returns decisions for the task, its parent feature, and the epic."
          )
          .optional(),
        featureId: z
          .string()
          .describe(
            "The feature identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123'). " +
            "Returns decisions for the feature and the epic. Use when not working on a specific task."
          )
          .optional(),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (!input.taskId && !input.featureId) {
          return createErrorResponse(new Error("Either taskId or featureId is required"));
        }

        // Get decisions based on context type
        if (input.taskId) {
          // Resolve task identifier to UUID if needed
          let taskId = input.taskId;
          if (!isUuid(taskId)) {
            // If it looks like an identifier (e.g., COM-123-1), get the task first
            const { data: task } = await apiClient.getTask(taskId);
            taskId = task.id;
          }

          const { data: context } = await apiClient.getTaskDecisionContext(taskId);

          // Parse alternatives for all decisions
          const parseDecisions = (decisions: typeof context.taskDecisions) =>
            decisions.map((d) => ({
              ...d,
              alternatives: d.alternatives ? JSON.parse(d.alternatives) : null,
            }));

          return createResponse({
            scope: "task",
            taskDecisions: parseDecisions(context.taskDecisions),
            featureDecisions: parseDecisions(context.featureDecisions),
            epicDecisions: parseDecisions(context.epicDecisions),
            totalDecisions:
              context.taskDecisions.length +
              context.featureDecisions.length +
              context.epicDecisions.length,
          });
        } else if (input.featureId) {
          // Resolve feature identifier to UUID if needed
          let featureId = input.featureId;
          if (!isUuid(featureId)) {
            const { data: feature } = await apiClient.getFeature(featureId);
            featureId = feature.id;
          }

          const { data: context } = await apiClient.getFeatureDecisionContext(featureId);

          // Parse alternatives for all decisions
          const parseDecisions = (decisions: typeof context.featureDecisions) =>
            decisions.map((d) => ({
              ...d,
              alternatives: d.alternatives ? JSON.parse(d.alternatives) : null,
            }));

          return createResponse({
            scope: "feature",
            featureDecisions: parseDecisions(context.featureDecisions),
            epicDecisions: parseDecisions(context.epicDecisions),
            totalDecisions:
              context.featureDecisions.length + context.epicDecisions.length,
          });
        }

        return createErrorResponse(new Error("Either taskId or featureId is required"));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error("Task or feature not found"));
        }
        return createErrorResponse(error);
      }
    }
  );
}

// Helper to check if a string is a UUID
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
