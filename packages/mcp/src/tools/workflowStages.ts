/**
 * Workflow Stages Definition
 *
 * Defines all workflow stages, their requirements, and the checks needed
 * for the guided workflow tool. This provides just-in-time guidance to AI agents.
 */

/**
 * Workflow context types that define what phase the agent is in
 */
export type WorkflowContext =
  | "session_start"
  | "creating_epic"
  | "feature_created"
  | "task_created"
  | "working"
  | "completing_task"
  | "completing_feature"
  | "session_end";

/**
 * A single requirement check with action guidance
 */
export interface RequirementCheck {
  /** What to check */
  check: string;
  /** Human-readable description of what's being verified */
  description: string;
  /** Action to take if check fails */
  action: string;
  /** Tool to call if action is needed */
  tool: string;
  /** Priority (lower = more important) */
  priority: number;
}

/**
 * Workflow stage definition
 */
export interface WorkflowStage {
  /** Stage identifier */
  id: WorkflowContext;
  /** Human-readable description */
  description: string;
  /** Requirement checks for this stage */
  requirements: RequirementCheck[];
  /** What triggers moving to the next stage */
  completionCriteria: string;
}

/**
 * All workflow stages with their requirements
 */
export const WORKFLOW_STAGES: Record<WorkflowContext, WorkflowStage> = {
  session_start: {
    id: "session_start",
    description: "Starting work on an epic - need to establish session context",
    requirements: [
      {
        check: "hasActiveSession",
        description: "Check if there is an active session for the epic",
        action: "Start a session to track your work and receive context from previous sessions",
        tool: "spectree__start_session",
        priority: 1,
      },
    ],
    completionCriteria: "Active session exists for the epic",
  },

  creating_epic: {
    id: "creating_epic",
    description: "Creating a new epic - need to follow template workflow",
    requirements: [
      {
        check: "hasListedTeams",
        description: "Check if available teams have been discovered",
        action: "List available teams to determine where to create the epic",
        tool: "spectree__list_teams",
        priority: 1,
      },
      {
        check: "hasListedTemplates",
        description: "Check if templates have been listed",
        action: "List available templates to use for epic creation",
        tool: "spectree__list_templates",
        priority: 2,
      },
      {
        check: "usedTemplate",
        description: "Check if a template was used for epic creation",
        action: "Use a template to create the epic with proper structure",
        tool: "spectree__create_from_template",
        priority: 3,
      },
    ],
    completionCriteria: "Epic created with features and tasks from template",
  },

  feature_created: {
    id: "feature_created",
    description: "Feature exists - need to ensure proper setup",
    requirements: [
      {
        check: "hasStructuredDescription",
        description: "Check if feature has a structured description with summary",
        action: "Set structured description for the feature with summary, aiInstructions, and acceptanceCriteria",
        tool: "spectree__set_structured_description",
        priority: 1,
      },
      {
        check: "hasExecutionOrder",
        description: "Check if feature has execution order set",
        action: "Set execution order for the feature to define work sequence",
        tool: "spectree__update_feature",
        priority: 2,
      },
      {
        check: "hasEstimatedComplexity",
        description: "Check if feature has complexity estimate",
        action: "Set estimated complexity (trivial, simple, moderate, complex)",
        tool: "spectree__update_feature",
        priority: 3,
      },
      {
        check: "hasMinimumTasks",
        description: "Check if feature has at least 3 tasks",
        action: "Create tasks to break down the feature into actionable work items",
        tool: "spectree__create_task",
        priority: 4,
      },
    ],
    completionCriteria: "Feature has structured description, execution metadata, and minimum 3 tasks",
  },

  task_created: {
    id: "task_created",
    description: "Task exists - need to ensure proper setup",
    requirements: [
      {
        check: "hasStructuredDescription",
        description: "Check if task has a structured description with summary",
        action: "Set structured description for the task with summary and aiInstructions",
        tool: "spectree__set_structured_description",
        priority: 1,
      },
      {
        check: "hasAcceptanceCriteria",
        description: "Check if task has acceptance criteria defined",
        action: "Add acceptance criteria to define what 'done' means",
        tool: "spectree__add_acceptance_criterion",
        priority: 2,
      },
    ],
    completionCriteria: "Task has structured description with summary and acceptance criteria",
  },

  working: {
    id: "working",
    description: "Actively working on a task - track progress and link artifacts",
    requirements: [
      {
        check: "taskInProgress",
        description: "Check if task status is 'In Progress'",
        action: "Start work on the task to set status and track time",
        tool: "spectree__start_work",
        priority: 1,
      },
      {
        check: "hasLinkedFiles",
        description: "Check if modified files are linked to the task",
        action: "Link code files that were modified as part of this work",
        tool: "spectree__link_code_file",
        priority: 2,
      },
      {
        check: "hasProgressLog",
        description: "Check if progress has been logged recently",
        action: "Log progress to record what has been done",
        tool: "spectree__log_progress",
        priority: 3,
      },
    ],
    completionCriteria: "Task in progress with linked files and logged progress",
  },

  completing_task: {
    id: "completing_task",
    description: "Finishing a task - validate and complete",
    requirements: [
      {
        check: "hasValidations",
        description: "Check if task has validation checks defined",
        action: "Add validation checks to verify acceptance criteria are met",
        tool: "spectree__add_validation",
        priority: 1,
      },
      {
        check: "validationsPassed",
        description: "Check if all validations pass",
        action: "Run all validations to verify the work is complete",
        tool: "spectree__run_all_validations",
        priority: 2,
      },
      {
        check: "taskCompleted",
        description: "Check if task is marked as complete",
        action: "Complete the task with a summary of work done",
        tool: "spectree__complete_work",
        priority: 3,
      },
    ],
    completionCriteria: "All validations pass and task is marked complete",
  },

  completing_feature: {
    id: "completing_feature",
    description: "Finishing a feature - ensure all tasks complete",
    requirements: [
      {
        check: "allTasksComplete",
        description: "Check if all tasks in the feature are complete",
        action: "Complete remaining tasks before completing the feature",
        tool: "spectree__get_feature",
        priority: 1,
      },
      {
        check: "featureCompleted",
        description: "Check if feature is marked as complete",
        action: "Complete the feature with a summary of work done",
        tool: "spectree__complete_work",
        priority: 2,
      },
    ],
    completionCriteria: "All tasks complete and feature is marked complete",
  },

  session_end: {
    id: "session_end",
    description: "Ending work session - handoff to next session",
    requirements: [
      {
        check: "hasSessionSummary",
        description: "Check if session has summary prepared",
        action: "Prepare a summary of work completed during this session",
        tool: "spectree__end_session",
        priority: 1,
      },
      {
        check: "hasNextSteps",
        description: "Check if next steps are documented",
        action: "Document next steps for the successor session",
        tool: "spectree__end_session",
        priority: 2,
      },
      {
        check: "decisionsLogged",
        description: "Check if important decisions were logged",
        action: "Log any decisions made during this session",
        tool: "spectree__log_decision",
        priority: 3,
      },
    ],
    completionCriteria: "Session ended with summary, next steps, and decisions logged",
  },
};

/**
 * Get the workflow stage definition by context
 */
export function getWorkflowStage(context: WorkflowContext): WorkflowStage {
  return WORKFLOW_STAGES[context];
}

/**
 * Get all requirement checks for a context, sorted by priority
 */
export function getRequirements(context: WorkflowContext): RequirementCheck[] {
  const stage = WORKFLOW_STAGES[context];
  return [...stage.requirements].sort((a, b) => a.priority - b.priority);
}
