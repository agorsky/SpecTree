/**
 * Workflow State Checker
 *
 * Implements the core logic that checks state and determines the next required action.
 * This module queries the SpecTree API to understand current state and provides
 * just-in-time guidance to AI agents.
 */

import { getApiClient, type Feature, type Task } from "../api-client.js";
import {
  type WorkflowContext,
  type RequirementCheck,
  getRequirements,
  getWorkflowStage,
} from "./workflowStages.js";

/**
 * Result of a state check
 */
export interface StateCheckResult {
  /** The check that was performed */
  check: string;
  /** Whether the check passed */
  passed: boolean;
  /** Additional context about the check result */
  details?: string;
}

/**
 * Current state of an entity (feature or task)
 */
export interface EntityState {
  /** Whether entity has structured description with summary */
  hasStructuredDescription: boolean;
  /** Whether entity has acceptance criteria */
  hasAcceptanceCriteria: boolean;
  /** Whether entity has execution order */
  hasExecutionOrder: boolean;
  /** Whether entity has complexity estimate */
  hasEstimatedComplexity: boolean;
  /** Number of tasks (for features only) */
  taskCount: number;
  /** Whether entity has linked code files */
  hasLinkedFiles: boolean;
  /** Whether entity has validation checks */
  hasValidations: boolean;
  /** Current status category */
  statusCategory: string | null;
  /** Whether all tasks are complete (for features) */
  allTasksComplete: boolean;
}

/**
 * The next action the agent should take
 */
export interface NextAction {
  /** Whether all requirements are met */
  allComplete: boolean;
  /** The action to take (if not complete) */
  action?: string;
  /** The tool to call */
  toolToCall?: string;
  /** Reason why this action is needed */
  reason?: string;
  /** Example of how to call the tool */
  example?: Record<string, unknown>;
  /** Additional context or hints */
  hints?: string[];
}

/**
 * Parse structured description from feature or task
 */
function parseStructuredDesc(entity: Feature | Task): { summary?: string; acceptanceCriteria?: string[] } | null {
  // Features and tasks have structuredDesc property that may not be in the base type
  // but comes from the API response
  const entityWithStructuredDesc = entity as { structuredDesc?: string | Record<string, unknown> };
  
  if (!entityWithStructuredDesc.structuredDesc) {
    return null;
  }
  
  try {
    if (typeof entityWithStructuredDesc.structuredDesc === "string") {
      return JSON.parse(entityWithStructuredDesc.structuredDesc);
    }
    return entityWithStructuredDesc.structuredDesc as { summary?: string; acceptanceCriteria?: string[] };
  } catch {
    return null;
  }
}

/**
 * Check the state of a feature
 */
export async function checkFeatureState(featureId: string): Promise<EntityState> {
  const apiClient = getApiClient();

  try {
    const { data: feature } = await apiClient.getFeature(featureId);
    const tasksResult = await apiClient.listTasks({ featureId: feature.id, limit: 100 });

    // Parse structured description
    const structuredDesc = parseStructuredDesc(feature);

    // To check task status categories, we need to fetch tasks with status info
    // The listTasks endpoint returns tasks with their status info
    // For now, check completed based on statusId and statusCategory param
    const taskParams = { featureId: feature.id, statusCategory: "completed", limit: 100 };
    const completedTasksResult = await apiClient.listTasks(taskParams);
    const completedTasks = completedTasksResult.data.length;
    const allTasksComplete =
      tasksResult.data.length > 0 && completedTasks === tasksResult.data.length;

    // Get code context for linked files
    let hasLinkedFiles = false;
    try {
      const { data: codeContextResponse } = await apiClient.getFeatureCodeContext(feature.id);
      hasLinkedFiles =
        (codeContextResponse.codeContext.files?.length ?? 0) > 0 ||
        (codeContextResponse.codeContext.functions?.length ?? 0) > 0;
    } catch {
      // Code context may not exist
    }

    // Get status category - need to look up from status if we have statusId
    let statusCategory: string | null = null;
    if (feature.statusId) {
      try {
        const { data: status } = await apiClient.getStatus(feature.statusId);
        statusCategory = status.category;
      } catch {
        // Status lookup failed
      }
    }

    return {
      hasStructuredDescription: !!(structuredDesc?.summary),
      hasAcceptanceCriteria: (structuredDesc?.acceptanceCriteria?.length ?? 0) > 0,
      hasExecutionOrder: feature.executionOrder !== null,
      hasEstimatedComplexity: feature.estimatedComplexity !== null,
      taskCount: tasksResult.data.length,
      hasLinkedFiles,
      hasValidations: false, // Features don't have validations
      statusCategory,
      allTasksComplete,
    };
  } catch {
    // Return empty state if feature not found
    return {
      hasStructuredDescription: false,
      hasAcceptanceCriteria: false,
      hasExecutionOrder: false,
      hasEstimatedComplexity: false,
      taskCount: 0,
      hasLinkedFiles: false,
      hasValidations: false,
      statusCategory: null,
      allTasksComplete: false,
    };
  }
}

/**
 * Check the state of a task
 */
export async function checkTaskState(taskId: string): Promise<EntityState> {
  const apiClient = getApiClient();

  try {
    const { data: task } = await apiClient.getTask(taskId);

    // Parse structured description
    const structuredDesc = parseStructuredDesc(task);

    // Get validation checks
    let hasValidations = false;
    try {
      const { data: validations } = await apiClient.listValidations(task.id);
      hasValidations = validations.checks.length > 0;
    } catch {
      // Validations may not exist
    }

    // Get code context for linked files
    let hasLinkedFiles = false;
    try {
      const { data: codeContextResponse } = await apiClient.getTaskCodeContext(task.id);
      hasLinkedFiles =
        (codeContextResponse.codeContext.files?.length ?? 0) > 0 ||
        (codeContextResponse.codeContext.functions?.length ?? 0) > 0;
    } catch {
      // Code context may not exist
    }

    // Get status category
    let statusCategory: string | null = null;
    if (task.statusId) {
      try {
        const { data: status } = await apiClient.getStatus(task.statusId);
        statusCategory = status.category;
      } catch {
        // Status lookup failed
      }
    }

    return {
      hasStructuredDescription: !!(structuredDesc?.summary),
      hasAcceptanceCriteria: (structuredDesc?.acceptanceCriteria?.length ?? 0) > 0,
      hasExecutionOrder: task.executionOrder !== null,
      hasEstimatedComplexity: task.estimatedComplexity !== null,
      taskCount: 0, // Not applicable for tasks
      hasLinkedFiles,
      hasValidations,
      statusCategory,
      allTasksComplete: false, // Not applicable for tasks
    };
  } catch {
    // Return empty state if task not found
    return {
      hasStructuredDescription: false,
      hasAcceptanceCriteria: false,
      hasExecutionOrder: false,
      hasEstimatedComplexity: false,
      taskCount: 0,
      hasLinkedFiles: false,
      hasValidations: false,
      statusCategory: null,
      allTasksComplete: false,
    };
  }
}

/**
 * Check if there is an active session for an epic
 */
export async function checkSessionState(epicId: string): Promise<boolean> {
  const apiClient = getApiClient();

  try {
    const result = await apiClient.getActiveSession(epicId);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * Evaluate a single requirement check against the current state
 */
function evaluateCheck(
  check: RequirementCheck,
  state: EntityState,
  hasActiveSession: boolean
): StateCheckResult {
  switch (check.check) {
    case "hasActiveSession":
      return {
        check: check.check,
        passed: hasActiveSession,
        details: hasActiveSession ? "Session is active" : "No active session found",
      };

    case "hasStructuredDescription":
      return {
        check: check.check,
        passed: state.hasStructuredDescription,
        details: state.hasStructuredDescription
          ? "Structured description exists"
          : "Missing structured description with summary",
      };

    case "hasAcceptanceCriteria":
      return {
        check: check.check,
        passed: state.hasAcceptanceCriteria,
        details: state.hasAcceptanceCriteria
          ? "Acceptance criteria defined"
          : "No acceptance criteria defined",
      };

    case "hasExecutionOrder":
      return {
        check: check.check,
        passed: state.hasExecutionOrder,
        details: state.hasExecutionOrder
          ? "Execution order is set"
          : "Execution order not set",
      };

    case "hasEstimatedComplexity":
      return {
        check: check.check,
        passed: state.hasEstimatedComplexity,
        details: state.hasEstimatedComplexity
          ? "Complexity estimate exists"
          : "No complexity estimate",
      };

    case "hasMinimumTasks":
      return {
        check: check.check,
        passed: state.taskCount >= 3,
        details:
          state.taskCount >= 3
            ? `Feature has ${state.taskCount} tasks`
            : `Feature has only ${state.taskCount} tasks (minimum 3 required)`,
      };

    case "taskInProgress":
      return {
        check: check.check,
        passed: state.statusCategory === "started",
        details:
          state.statusCategory === "started"
            ? "Task is in progress"
            : `Task status is '${state.statusCategory ?? "not set"}'`,
      };

    case "hasLinkedFiles":
      return {
        check: check.check,
        passed: state.hasLinkedFiles,
        details: state.hasLinkedFiles
          ? "Code files are linked"
          : "No code files linked yet",
      };

    case "hasValidations":
      return {
        check: check.check,
        passed: state.hasValidations,
        details: state.hasValidations
          ? "Validation checks exist"
          : "No validation checks defined",
      };

    case "validationsPassed":
      // This requires running validations, which is a side effect
      // For now, return false to prompt running them
      return {
        check: check.check,
        passed: false,
        details: "Run validations to verify acceptance criteria",
      };

    case "taskCompleted":
      return {
        check: check.check,
        passed: state.statusCategory === "completed",
        details:
          state.statusCategory === "completed"
            ? "Task is complete"
            : "Task not marked as complete",
      };

    case "allTasksComplete":
      return {
        check: check.check,
        passed: state.allTasksComplete,
        details: state.allTasksComplete
          ? "All tasks are complete"
          : "Some tasks are not complete",
      };

    case "featureCompleted":
      return {
        check: check.check,
        passed: state.statusCategory === "completed",
        details:
          state.statusCategory === "completed"
            ? "Feature is complete"
            : "Feature not marked as complete",
      };

    // These checks are informational and don't block workflow
    case "hasListedTeams":
    case "hasListedTemplates":
    case "usedTemplate":
    case "hasSessionSummary":
    case "hasNextSteps":
    case "decisionsLogged":
    case "hasProgressLog":
      return {
        check: check.check,
        passed: true, // Can't verify these without tracking state across calls
        details: "Information check - proceed if completed",
      };

    default:
      return {
        check: check.check,
        passed: true,
        details: "Unknown check - assuming passed",
      };
  }
}

/**
 * Generate example tool call parameters
 */
function generateExample(
  check: RequirementCheck,
  context: WorkflowContext,
  ids: { epicId?: string | undefined; featureId?: string | undefined; taskId?: string | undefined }
): Record<string, unknown> {
  const { epicId, featureId, taskId } = ids;

  switch (check.tool) {
    case "spectree__start_session":
      return { epicId: epicId ?? "<epic-id-or-name>" };

    case "spectree__list_teams":
      return {};

    case "spectree__list_templates":
      return {};

    case "spectree__create_from_template":
      return {
        templateName: "Code Feature",
        epicName: "<Your Epic Name>",
        team: "<team-name-or-id>",
        variables: { topic: "<feature-topic>" },
      };

    case "spectree__set_structured_description":
      if (context === "feature_created") {
        return {
          id: featureId ?? "<feature-identifier>",
          type: "feature",
          structuredDesc: {
            summary: "<Brief description of the feature>",
            aiInstructions: "<Step-by-step instructions for AI implementation>",
            acceptanceCriteria: ["<Criterion 1>", "<Criterion 2>"],
            filesInvolved: ["<path/to/file.ts>"],
            technicalNotes: "<Implementation notes>",
            riskLevel: "low",
            estimatedEffort: "medium",
          },
        };
      }
      return {
        id: taskId ?? "<task-identifier>",
        type: "task",
        structuredDesc: {
          summary: "<Brief description of the task>",
          aiInstructions: "<Implementation steps>",
          acceptanceCriteria: ["<Criterion 1>"],
        },
      };

    case "spectree__update_feature":
      return {
        id: featureId ?? "<feature-identifier>",
        executionOrder: 1,
        estimatedComplexity: "moderate",
      };

    case "spectree__create_task":
      return {
        title: "<Task title>",
        feature_id: featureId ?? "<feature-identifier>",
        status: "Backlog",
      };

    case "spectree__add_acceptance_criterion":
      return {
        id: taskId ?? featureId ?? "<identifier>",
        type: taskId ? "task" : "feature",
        criterion: "<Specific acceptance criterion>",
      };

    case "spectree__start_work":
      return {
        id: taskId ?? featureId ?? "<identifier>",
        type: taskId ? "task" : "feature",
      };

    case "spectree__link_code_file":
      return {
        id: taskId ?? featureId ?? "<identifier>",
        type: taskId ? "task" : "feature",
        filePath: "<path/to/modified/file.ts>",
      };

    case "spectree__log_progress":
      return {
        id: taskId ?? featureId ?? "<identifier>",
        type: taskId ? "task" : "feature",
        message: "<Description of progress made>",
        percentComplete: 50,
      };

    case "spectree__add_validation":
      return {
        taskId: taskId ?? "<task-identifier>",
        type: "command",
        description: "All tests pass",
        command: "pnpm test",
      };

    case "spectree__run_all_validations":
      return {
        taskId: taskId ?? "<task-identifier>",
      };

    case "spectree__complete_work":
      return {
        id: taskId ?? featureId ?? "<identifier>",
        type: taskId ? "task" : "feature",
        summary: "<Summary of completed work>",
      };

    case "spectree__get_feature":
      return {
        id: featureId ?? "<feature-identifier>",
      };

    case "spectree__end_session":
      return {
        epicId: epicId ?? "<epic-id-or-name>",
        summary: "<Summary of work completed this session>",
        nextSteps: ["<Next action 1>", "<Next action 2>"],
        blockers: [],
        decisions: [{ decision: "<Decision made>", rationale: "<Why>" }],
      };

    case "spectree__log_decision":
      return {
        epicId: epicId ?? "<epic-id>",
        question: "<What was being decided>",
        decision: "<The choice made>",
        rationale: "<Why this choice>",
        category: "approach",
      };

    default:
      return {};
  }
}

/**
 * Get the next required action based on context and state
 */
export async function getNextRequiredAction(
  context: WorkflowContext,
  ids: { epicId?: string | undefined; featureId?: string | undefined; taskId?: string | undefined }
): Promise<NextAction> {
  const { epicId, featureId, taskId } = ids;

  // Get the requirements for this context
  const requirements = getRequirements(context);
  const stage = getWorkflowStage(context);

  // Check session state if we have an epic
  let hasActiveSession = true; // Default to true if not checking
  if (epicId && context === "session_start") {
    hasActiveSession = await checkSessionState(epicId);
  }

  // Check entity state based on context
  let entityState: EntityState = {
    hasStructuredDescription: false,
    hasAcceptanceCriteria: false,
    hasExecutionOrder: false,
    hasEstimatedComplexity: false,
    taskCount: 0,
    hasLinkedFiles: false,
    hasValidations: false,
    statusCategory: null,
    allTasksComplete: false,
  };

  if (taskId && ["task_created", "working", "completing_task"].includes(context)) {
    entityState = await checkTaskState(taskId);
  } else if (
    featureId &&
    ["feature_created", "working", "completing_feature"].includes(context)
  ) {
    entityState = await checkFeatureState(featureId);
  }

  // Evaluate each requirement
  const failedChecks: Array<{
    requirement: RequirementCheck;
    result: StateCheckResult;
  }> = [];

  for (const requirement of requirements) {
    const result = evaluateCheck(requirement, entityState, hasActiveSession);
    if (!result.passed) {
      failedChecks.push({ requirement, result });
    }
  }

  // If all checks pass, return success
  if (failedChecks.length === 0) {
    return {
      allComplete: true,
      hints: [
        `All requirements for '${context}' stage are met.`,
        `Completion criteria: ${stage.completionCriteria}`,
      ],
    };
  }

  // Return the first (highest priority) failed check
  const firstFailed = failedChecks[0]!;
  const { requirement, result } = firstFailed;

  return {
    allComplete: false,
    action: requirement.action,
    toolToCall: requirement.tool,
    reason: result.details ?? requirement.description,
    example: generateExample(requirement, context, ids),
    hints: [
      `Stage: ${stage.description}`,
      `${failedChecks.length} requirement(s) not yet met`,
    ],
  };
}
