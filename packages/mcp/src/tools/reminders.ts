/**
 * Tool Response Reminders
 *
 * Provides contextual reminders that are embedded in MCP tool responses.
 * When an agent calls a tool like create_feature, the response includes
 * reminders about next steps - providing guidance without extra tool calls.
 */

/**
 * Context passed to reminder rules for conditional evaluation
 */
export interface ReminderContext {
  /** The identifier of the created/updated item (e.g., 'ENG-123') */
  identifier?: string;
  /** The UUID of the item */
  id?: string;
  /** Whether structured description was already set */
  hasStructuredDesc?: boolean;
  /** Number of tasks (for features) */
  taskCount?: number;
  /** Whether this is the last task in the epic */
  isLastTask?: boolean;
  /** Whether there's an active session */
  hasActiveSession?: boolean;
  /** Any additional context */
  [key: string]: unknown;
}

/**
 * A single reminder with its display message and optional example
 */
export interface Reminder {
  /** The reminder message */
  message: string;
  /** Optional example tool call */
  example?: string | undefined;
}

/**
 * A reminder rule that conditionally produces a reminder
 */
interface ReminderRule {
  /** Function to determine if this reminder applies */
  condition: (context: ReminderContext) => boolean;
  /** The reminder message (can use {id} and {identifier} placeholders) */
  message: string;
  /** Optional example tool call (can use {id} and {identifier} placeholders) */
  example?: string;
}

/**
 * Reminder rules organized by tool name
 */
const REMINDER_RULES: Record<string, ReminderRule[]> = {
  create_feature: [
    {
      condition: () => true,
      message: "Set structured description with summary, acceptanceCriteria, and aiInstructions",
      example: "spectree__set_structured_description({ id: '{identifier}', type: 'feature', structuredDesc: { summary: '...', acceptanceCriteria: ['...'], aiInstructions: '...' } })",
    },
    {
      condition: () => true,
      message: "Create at least 3 tasks to break down this feature",
      example: "spectree__create_task({ title: '...', feature_id: '{identifier}' })",
    },
    {
      condition: (ctx) => !ctx.hasStructuredDesc,
      message: "Set execution metadata if not already provided (executionOrder, estimatedComplexity)",
    },
  ],

  create_task: [
    {
      condition: () => true,
      message: "Set structured description for this task with summary and aiInstructions",
      example: "spectree__set_structured_description({ id: '{identifier}', type: 'task', structuredDesc: { summary: '...', aiInstructions: '...' } })",
    },
    {
      condition: () => true,
      message: "Add validation checks to define 'done' criteria",
      example: "spectree__add_validation({ taskId: '{identifier}', type: 'command', description: '...', command: '...' })",
    },
  ],

  create_from_template: [
    {
      condition: () => true,
      message: "Verify all features and tasks have appropriate structured descriptions",
    },
    {
      condition: () => true,
      message: "Review the execution plan to understand work order",
      example: "spectree__get_execution_plan({ epicId: '{id}' })",
    },
    {
      condition: () => true,
      message: "Start a session to begin working on this epic",
      example: "spectree__start_session({ epicId: '{id}' })",
    },
  ],

  start_session: [
    {
      condition: () => true,
      message: "Get progress summary to understand current epic status",
      example: "spectree__get_progress_summary({ epicId: '{id}' })",
    },
    {
      condition: () => true,
      message: "Review the execution plan for next actionable items",
      example: "spectree__get_execution_plan({ epicId: '{id}' })",
    },
  ],

  complete_work: [
    {
      condition: (ctx) => ctx.isLastTask === true,
      message: "This was the last task - consider ending the session with a summary",
      example: "spectree__end_session({ epicId: '...', summary: '...' })",
    },
    {
      condition: (ctx) => ctx.hasActiveSession === true,
      message: "Link any modified code files to this item",
      example: "spectree__link_code_file({ id: '{identifier}', type: '{type}', filePath: '...' })",
    },
  ],
};

/**
 * Replace placeholders in a string with context values
 */
function replacePlaceholders(template: string, context: ReminderContext): string {
  let result = template;
  if (context.identifier) {
    result = result.replace(/\{identifier\}/g, context.identifier);
  }
  if (context.id) {
    result = result.replace(/\{id\}/g, context.id);
  }
  // Handle {type} placeholder for complete_work
  const typeValue = context.type;
  if (typeValue !== undefined && typeof typeValue === "string") {
    result = result.replace(/\{type\}/g, typeValue);
  }
  return result;
}

/**
 * Get applicable reminders for a tool based on context
 *
 * @param toolName - The name of the tool (without spectree__ prefix)
 * @param context - Context for evaluating conditional reminders
 * @returns Array of applicable reminders
 */
export function getReminders(toolName: string, context: ReminderContext = {}): Reminder[] {
  const rules = REMINDER_RULES[toolName];
  if (!rules) {
    return [];
  }

  const reminders: Reminder[] = [];
  for (const rule of rules) {
    if (rule.condition(context)) {
      reminders.push({
        message: replacePlaceholders(rule.message, context),
        example: rule.example ? replacePlaceholders(rule.example, context) : undefined,
      });
    }
  }

  return reminders;
}

/**
 * Add reminders to a response object
 *
 * @param response - The original response object
 * @param toolName - The name of the tool
 * @param context - Context for evaluating reminders
 * @param includeReminders - Whether to include reminders (allows disabling)
 * @returns Response object with reminders added
 */
export function addRemindersToResponse<T extends Record<string, unknown>>(
  response: T,
  toolName: string,
  context: ReminderContext = {},
  includeReminders = true
): T & { reminders?: Reminder[] } {
  if (!includeReminders) {
    return response;
  }

  const reminders = getReminders(toolName, context);
  if (reminders.length === 0) {
    return response;
  }

  return {
    ...response,
    reminders,
  };
}
