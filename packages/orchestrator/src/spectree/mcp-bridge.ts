/**
 * MCP Bridge for Copilot SDK Tools
 *
 * Wraps SpecTree API operations as tools compatible with the GitHub Copilot SDK.
 * These tools are provided to AI agents during task execution.
 *
 * Agent Tools (11):
 * - log_progress: Report incremental progress on a task
 * - log_decision: Record implementation decision
 * - link_code_file: Report modified file
 * - get_task_context: Get task requirements
 * - get_code_context: Get files/branch info
 * - report_blocker: Report when blocked
 * - get_ai_context: Read context from previous sessions
 * - append_ai_note: Leave notes for future sessions
 * - run_validation: Run a single validation check
 * - run_all_validations: Run all validation checks for a task
 * - get_structured_description: Get full task requirements
 *
 * Note: Orchestrator-only operations (start_work, complete_work, link_branch,
 * link_commit) are NOT exposed as agent tools. The orchestrator controls work
 * lifecycle externally via the API client directly.
 */

import { defineTool, type Tool } from "@github/copilot-sdk";
import {
  SpecTreeClient,
  type Task,
  type Feature,
  type LogProgressInput,
  type CodeContextResponse,
  type Decision,
  type DecisionCategory as ApiDecisionCategory,
  type ImpactLevel as ApiImpactLevel,
  type AiContext,
  type AiNote,
  type AiNoteType,
  type AppendAiNoteInput,
  type ValidationResult,
  type RunAllValidationsResult,
  type ReportBlockerInput,
  type StructuredDescription,
} from "./api-client.js";
import {
  wrapError,
  type SerializedError,
} from "../errors.js";

// =============================================================================
// Types
// =============================================================================

/** Result type for tool execution */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: SerializedError;
}

/** Decision categories for log_decision tool */
export type DecisionCategory =
  | "architecture"
  | "library"
  | "approach"
  | "scope"
  | "design"
  | "tradeoff"
  | "deferral";

/** Impact levels for decisions */
export type ImpactLevel = "low" | "medium" | "high";

/** Input for log_decision tool */
export interface LogDecisionInput {
  epicId: string;
  featureId?: string;
  taskId?: string;
  question: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  category?: DecisionCategory;
  impact?: ImpactLevel;
}

/** Code context response */
export interface CodeContext {
  files: string[];
  functions: string[];
  branch: string | null;
  commits: string[];
  pr: { number: number; url: string } | null;
}

// =============================================================================
// JSON Schemas for Tool Parameters (Copilot SDK format)
// =============================================================================

const logProgressParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier (e.g., 'COM-5' for features, 'COM-5-1' for tasks)",
    },
    message: {
      type: "string",
      minLength: 1,
      maxLength: 5000,
      description: "Progress update message describing what has been done or the current state",
    },
    percentComplete: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Optional: 0-100 completion percentage",
    },
  },
  required: ["type", "id", "message"],
} as const;

const logDecisionParams = {
  type: "object",
  properties: {
    epicId: {
      type: "string",
      format: "uuid",
      description: "The epic this decision relates to (required)",
    },
    featureId: {
      type: "string",
      format: "uuid",
      description: "Optional feature this decision relates to",
    },
    taskId: {
      type: "string",
      format: "uuid",
      description: "Optional task this decision relates to",
    },
    question: {
      type: "string",
      minLength: 1,
      maxLength: 1000,
      description: "What was being decided. Example: 'Which state management library to use'",
    },
    decision: {
      type: "string",
      minLength: 1,
      maxLength: 2000,
      description: "The choice that was made. Example: 'Use Zustand instead of Redux'",
    },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: 5000,
      description: "Why this choice was made. Include reasoning and tradeoffs considered",
    },
    alternatives: {
      type: "array",
      items: { type: "string", maxLength: 500 },
      maxItems: 10,
      description: "Other options considered but not chosen",
    },
    category: {
      type: "string",
      enum: ["architecture", "library", "approach", "scope", "design", "tradeoff", "deferral"],
      description: "Category: architecture, library, approach, scope, design, tradeoff, deferral",
    },
    impact: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Impact level: low (easily reversible), medium (some effort), high (significant effort)",
    },
  },
  required: ["epicId", "question", "decision", "rationale"],
} as const;

const linkCodeFileParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
    filePath: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description: "File path to link (e.g., 'src/services/user.ts')",
    },
  },
  required: ["type", "id", "filePath"],
} as const;

const getTaskContextParams = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Task identifier (e.g., 'COM-5-1' or UUID)",
    },
  },
  required: ["id"],
} as const;

const getCodeContextParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
  },
  required: ["type", "id"],
} as const;

const reportBlockerParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
    reason: {
      type: "string",
      minLength: 1,
      maxLength: 5000,
      description: "Description of what is blocking progress. Be specific about what needs to happen to unblock.",
    },
    blockedById: {
      type: "string",
      format: "uuid",
      description: "Optional: UUID of the feature or task that is blocking this item",
    },
  },
  required: ["type", "id", "reason"],
} as const;

const getAiContextParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
  },
  required: ["type", "id"],
} as const;

const appendAiNoteParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
    noteType: {
      type: "string",
      enum: ["observation", "decision", "blocker", "next-step", "context"],
      description:
        "Type of note: observation (what you noticed), decision (choice made), " +
        "blocker (preventing progress), next-step (what should happen next), context (background info)",
    },
    content: {
      type: "string",
      minLength: 1,
      maxLength: 10000,
      description: "The content of the note. Should be clear and actionable for future sessions.",
    },
  },
  required: ["type", "id", "noteType", "content"],
} as const;

const runValidationParams = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "Task identifier (e.g., 'COM-5-1' or UUID)",
    },
    checkId: {
      type: "string",
      format: "uuid",
      description: "The ID of the validation check to run",
    },
    workingDirectory: {
      type: "string",
      maxLength: 1000,
      description: "Optional: Working directory for command execution (defaults to cwd)",
    },
  },
  required: ["taskId", "checkId"],
} as const;

const runAllValidationsParams = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "Task identifier (e.g., 'COM-5-1' or UUID)",
    },
    workingDirectory: {
      type: "string",
      maxLength: 1000,
      description: "Optional: Working directory for command execution (defaults to cwd)",
    },
    stopOnFailure: {
      type: "boolean",
      description: "Optional: Stop running checks after the first failure (default: false)",
    },
  },
  required: ["taskId"],
} as const;

const getStructuredDescriptionParams = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["feature", "task"],
      description: "Whether this is a 'feature' or 'task'",
    },
    id: {
      type: "string",
      description: "Feature/task identifier",
    },
  },
  required: ["type", "id"],
} as const;

// =============================================================================
// Type Definitions for Tool Arguments
// =============================================================================

interface LogProgressArgs {
  type: "feature" | "task";
  id: string;
  message: string;
  percentComplete?: number;
}

interface LogDecisionArgs {
  epicId: string;
  featureId?: string;
  taskId?: string;
  question: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  category?: DecisionCategory;
  impact?: ImpactLevel;
}

interface LinkCodeFileArgs {
  type: "feature" | "task";
  id: string;
  filePath: string;
}

interface GetTaskContextArgs {
  id: string;
}

interface GetCodeContextArgs {
  type: "feature" | "task";
  id: string;
}

interface ReportBlockerArgs {
  type: "feature" | "task";
  id: string;
  reason: string;
  blockedById?: string;
}

interface GetAiContextArgs {
  type: "feature" | "task";
  id: string;
}

interface AppendAiNoteArgs {
  type: "feature" | "task";
  id: string;
  noteType: "observation" | "decision" | "blocker" | "next-step" | "context";
  content: string;
}

interface RunValidationArgs {
  taskId: string;
  checkId: string;
  workingDirectory?: string;
}

interface RunAllValidationsArgs {
  taskId: string;
  workingDirectory?: string;
  stopOnFailure?: boolean;
}

interface GetStructuredDescriptionArgs {
  type: "feature" | "task";
  id: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a success result
 */
function successResult<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

/**
 * Create an error result from an unknown error
 */
function errorResult(error: unknown): ToolResult {
  const wrapped = wrapError(error);
  return {
    success: false,
    error: wrapped.toJSON(),
  };
}

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * Create the log_progress tool
 */
function createLogProgressTool(client: SpecTreeClient): Tool<LogProgressArgs> {
  return defineTool("log_progress", {
    description:
      "Report incremental progress on a feature or task without changing its status. " +
      "Use this for long-running work to record progress, decisions made, or notable observations. " +
      "The message will be logged as an AI note for future reference.",
    parameters: logProgressParams,
    handler: async (args: LogProgressArgs) => {
      try {
        const input: LogProgressInput = {
          message: args.message,
        };
        if (args.percentComplete !== undefined) {
          input.percentComplete = args.percentComplete;
        }

        const result = await client.logProgress(args.type, args.id, input);
        
        return successResult({
          id: result.id,
          identifier: result.identifier,
          status: result.status,
          percentComplete: result.percentComplete,
          message: `Progress logged for ${args.type} ${args.id}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the log_decision tool
 */
function createLogDecisionTool(client: SpecTreeClient): Tool<LogDecisionArgs> {
  return defineTool("log_decision", {
    description:
      "Record an implementation decision with its rationale. Use this to preserve " +
      "the reasoning behind choices like library selections, architectural decisions, " +
      "or scope changes. Decisions are append-only and create an audit trail for " +
      "future sessions to understand why choices were made.\n\n" +
      "When to use:\n" +
      "- Choosing between multiple libraries/approaches\n" +
      "- Deciding to skip or defer something\n" +
      "- Making assumptions about requirements\n" +
      "- Changing direction from original plan",
    parameters: logDecisionParams,
    handler: async (args: LogDecisionArgs) => {
      try {
        // Build input object, only including defined optional fields
        const input: Parameters<typeof client.logDecision>[0] = {
          epicId: args.epicId,
          question: args.question,
          decision: args.decision,
          rationale: args.rationale,
        };
        if (args.featureId) input.featureId = args.featureId;
        if (args.taskId) input.taskId = args.taskId;
        if (args.alternatives) input.alternatives = args.alternatives;
        if (args.category) input.category = args.category as ApiDecisionCategory;
        if (args.impact) input.impact = args.impact as ApiImpactLevel;

        const decision: Decision = await client.logDecision(input);

        return successResult({
          id: decision.id,
          question: args.question,
          decision: args.decision,
          category: decision.category,
          impact: decision.impact,
          message: "Decision logged successfully",
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the link_code_file tool
 */
function createLinkCodeFileTool(client: SpecTreeClient): Tool<LinkCodeFileArgs> {
  return defineTool("link_code_file", {
    description:
      "Link a file to a feature or task. Records which files are involved in " +
      "implementing the work item. Use this as you work on files to build context " +
      "for future sessions. Duplicates are ignored.",
    parameters: linkCodeFileParams,
    handler: async (args: LinkCodeFileArgs) => {
      try {
        // Link the file using the code context API
        await client.linkCodeFile(args.type, args.id, args.filePath);

        // Get the item to return its identifier
        let item: Feature | Task;
        if (args.type === "feature") {
          item = await client.getFeature(args.id);
        } else {
          item = await client.getTask(args.id);
        }

        return successResult({
          type: args.type,
          id: item.id,
          identifier: item.identifier,
          filePath: args.filePath,
          message: `File '${args.filePath}' linked to ${args.type} ${item.identifier}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the get_task_context tool
 */
function createGetTaskContextTool(client: SpecTreeClient): Tool<GetTaskContextArgs> {
  return defineTool("get_task_context", {
    description:
      "Get detailed context for a task including its title, description, acceptance criteria, " +
      "parent feature info, and execution metadata. Use this at the start of working on a task " +
      "to understand what needs to be done.",
    parameters: getTaskContextParams,
    handler: async (args: GetTaskContextArgs) => {
      try {
        const task = await client.getTask(args.id);
        
        // Get the parent feature for additional context
        const feature = await client.getFeature(task.featureId);

        return successResult({
          task: {
            id: task.id,
            identifier: task.identifier,
            title: task.title,
            description: task.description,
            status: task.status?.name ?? null,
            executionOrder: task.executionOrder,
            estimatedComplexity: task.estimatedComplexity,
            canParallelize: task.canParallelize,
            parallelGroup: task.parallelGroup,
          },
          parentFeature: {
            id: feature.id,
            identifier: feature.identifier,
            title: feature.title,
            description: feature.description,
          },
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the get_code_context tool
 */
function createGetCodeContextTool(client: SpecTreeClient): Tool<GetCodeContextArgs> {
  return defineTool("get_code_context", {
    description:
      "Get all code artifacts linked to a feature or task. Returns files involved, " +
      "functions modified, git branch, commits, and pull request info. Use this at " +
      "the start of a session to instantly understand the code context without " +
      "separate exploration.",
    parameters: getCodeContextParams,
    handler: async (args: GetCodeContextArgs) => {
      try {
        // Get the item
        let item: Feature | Task;
        if (args.type === "feature") {
          item = await client.getFeature(args.id);
        } else {
          item = await client.getTask(args.id);
        }

        // Fetch the actual code context from the API
        const apiContext: CodeContextResponse = await client.getCodeContext(args.type, args.id);

        // Map API response to tool output format
        const codeContext: CodeContext = {
          files: apiContext.relatedFiles ?? [],
          functions: apiContext.relatedFunctions ?? [],
          branch: apiContext.gitBranch ?? null,
          commits: apiContext.gitCommits ?? [],
          pr: apiContext.gitPrNumber
            ? { number: apiContext.gitPrNumber, url: apiContext.gitPrUrl ?? "" }
            : null,
        };

        return successResult({
          type: args.type,
          id: item.id,
          identifier: item.identifier,
          title: item.title,
          codeContext,
          message: codeContext.files.length > 0 
            ? `Found ${codeContext.files.length} files linked to ${args.type}`
            : `No code context linked yet for ${args.type} ${item.identifier}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the report_blocker tool
 */
function createReportBlockerTool(client: SpecTreeClient): Tool<ReportBlockerArgs> {
  return defineTool("report_blocker", {
    description:
      "Report that a feature or task is blocked and cannot proceed. Use this when you " +
      "encounter something preventing progress. Include a clear description of what " +
      "is blocking and what needs to happen to unblock. Optionally link to the blocking item.",
    parameters: reportBlockerParams,
    handler: async (args: ReportBlockerArgs) => {
      try {
        const input: ReportBlockerInput = {
          reason: args.reason,
        };
        if (args.blockedById) input.blockedById = args.blockedById;

        const result = await client.reportBlocker(args.type, args.id, input);

        return successResult({
          type: args.type,
          id: result.id,
          identifier: result.identifier,
          status: result.status?.name ?? null,
          blockerReason: result.blockerReason,
          message: `Reported blocker for ${args.type} ${result.identifier}: ${args.reason}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the get_ai_context tool
 */
function createGetAiContextTool(client: SpecTreeClient): Tool<GetAiContextArgs> {
  return defineTool("get_ai_context", {
    description:
      "Retrieve AI context from previous sessions. Returns structured context that " +
      "was set by previous AI sessions, along with an array of AI notes (observations, " +
      "decisions, blockers, next-steps). Use this at the start of a session to understand " +
      "previous work and continue from where the last session left off.",
    parameters: getAiContextParams,
    handler: async (args: GetAiContextArgs) => {
      try {
        const context: AiContext = await client.getAiContext(args.type, args.id);

        return successResult({
          type: args.type,
          id: args.id,
          context: context.context,
          notes: context.notes.map((n: AiNote) => ({
            type: n.noteType,
            content: n.content,
            createdAt: n.createdAt,
            sessionId: n.sessionId,
          })),
          noteCount: context.notes.length,
          message: context.notes.length > 0
            ? `Found ${context.notes.length} notes from previous sessions`
            : `No AI context found for ${args.type}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the append_ai_note tool
 */
function createAppendAiNoteTool(client: SpecTreeClient): Tool<AppendAiNoteArgs> {
  return defineTool("append_ai_note", {
    description:
      "Append a note to a feature or task's AI notes array. Notes are never overwritten, " +
      "only appended. Use this to log observations, decisions, blockers, or next-steps " +
      "as you work. Each note is timestamped and can include a session identifier.\n\n" +
      "Note types:\n" +
      "- observation: What you noticed or discovered\n" +
      "- decision: A choice made and why\n" +
      "- blocker: What's preventing progress\n" +
      "- next-step: What should happen next\n" +
      "- context: General background information",
    parameters: appendAiNoteParams,
    handler: async (args: AppendAiNoteArgs) => {
      try {
        const input: AppendAiNoteInput = {
          noteType: args.noteType as AiNoteType,
          content: args.content,
        };

        const note: AiNote = await client.appendAiNote(args.type, args.id, input);

        return successResult({
          type: args.type,
          id: args.id,
          note: {
            id: note.id,
            type: note.noteType,
            content: note.content,
            createdAt: note.createdAt,
          },
          message: `Added ${args.noteType} note to ${args.type}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the run_validation tool
 */
function createRunValidationTool(client: SpecTreeClient): Tool<RunValidationArgs> {
  return defineTool("run_validation", {
    description:
      "Run a single validation check and update its status. Returns the result " +
      "including whether the check passed, any error message, and captured output.",
    parameters: runValidationParams,
    handler: async (args: RunValidationArgs) => {
      try {
        const options: { workingDirectory?: string } = {};
        if (args.workingDirectory) options.workingDirectory = args.workingDirectory;

        const result: ValidationResult = await client.runValidation(
          args.taskId,
          args.checkId,
          Object.keys(options).length > 0 ? options : undefined
        );

        return successResult({
          taskId: args.taskId,
          checkId: args.checkId,
          passed: result.passed,
          description: result.check.description,
          type: result.check.type,
          error: result.error,
          output: result.output,
          duration: result.duration,
          message: result.passed
            ? `✓ Validation passed: ${result.check.description}`
            : `✗ Validation failed: ${result.check.description}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the run_all_validations tool
 */
function createRunAllValidationsTool(client: SpecTreeClient): Tool<RunAllValidationsArgs> {
  return defineTool("run_all_validations", {
    description:
      "Run all validation checks for a task. Returns a summary with pass/fail counts " +
      "and individual results. Use this to verify all acceptance criteria are met " +
      "before marking a task complete.",
    parameters: runAllValidationsParams,
    handler: async (args: RunAllValidationsArgs) => {
      try {
        const options: { workingDirectory?: string; stopOnFailure?: boolean } = {};
        if (args.workingDirectory) options.workingDirectory = args.workingDirectory;
        if (args.stopOnFailure !== undefined) options.stopOnFailure = args.stopOnFailure;

        const result: RunAllValidationsResult = await client.runAllValidations(
          args.taskId,
          Object.keys(options).length > 0 ? options : undefined
        );

        return successResult({
          taskId: result.taskId,
          identifier: result.identifier,
          allPassed: result.allPassed,
          totalChecks: result.totalChecks,
          passedChecks: result.passedChecks,
          failedChecks: result.failedChecks,
          results: result.results.map((r: ValidationResult) => ({
            description: r.check.description,
            type: r.check.type,
            passed: r.passed,
            error: r.error,
          })),
          message: result.allPassed
            ? `✓ All ${result.totalChecks} validations passed`
            : `✗ ${result.failedChecks}/${result.totalChecks} validations failed`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

/**
 * Create the get_structured_description tool
 */
function createGetStructuredDescriptionTool(client: SpecTreeClient): Tool<GetStructuredDescriptionArgs> {
  return defineTool("get_structured_description", {
    description:
      "Get the structured description for a feature or task. Returns parsed sections " +
      "like summary, aiInstructions, acceptanceCriteria, filesInvolved, etc. Use this " +
      "to extract specific information about what needs to be done without parsing freeform text.",
    parameters: getStructuredDescriptionParams,
    handler: async (args: GetStructuredDescriptionArgs) => {
      try {
        const structuredDesc: StructuredDescription | null = await client.getStructuredDescription(args.type, args.id);

        if (!structuredDesc) {
          return successResult({
            type: args.type,
            id: args.id,
            hasStructuredDescription: false,
            message: `No structured description found for ${args.type}`,
          });
        }

        return successResult({
          type: args.type,
          id: args.id,
          hasStructuredDescription: true,
          summary: structuredDesc.summary,
          aiInstructions: structuredDesc.aiInstructions ?? null,
          acceptanceCriteria: structuredDesc.acceptanceCriteria ?? [],
          filesInvolved: structuredDesc.filesInvolved ?? [],
          functionsToModify: structuredDesc.functionsToModify ?? [],
          testingStrategy: structuredDesc.testingStrategy ?? null,
          testFiles: structuredDesc.testFiles ?? [],
          technicalNotes: structuredDesc.technicalNotes ?? null,
          riskLevel: structuredDesc.riskLevel ?? null,
          estimatedEffort: structuredDesc.estimatedEffort ?? null,
          message: `Retrieved structured description for ${args.type}`,
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Array of all agent tool names
 */
export const agentToolNames = [
  "log_progress",
  "log_decision",
  "link_code_file",
  "get_task_context",
  "get_code_context",
  "report_blocker",
  "get_ai_context",
  "append_ai_note",
  "run_validation",
  "run_all_validations",
  "get_structured_description",
] as const;

export type AgentToolName = typeof agentToolNames[number];

/**
 * Create all agent tools with a client instance.
 *
 * These tools are passed to the Copilot SDK session for agent use.
 * The orchestrator controls work lifecycle (start/complete) separately.
 *
 * @param client - SpecTree API client instance
 * @returns Array of Tool objects for SDK consumption
 */
export function createAgentTools(client: SpecTreeClient): Tool<unknown>[] {
  return [
    createLogProgressTool(client) as Tool<unknown>,
    createLogDecisionTool(client) as Tool<unknown>,
    createLinkCodeFileTool(client) as Tool<unknown>,
    createGetTaskContextTool(client) as Tool<unknown>,
    createGetCodeContextTool(client) as Tool<unknown>,
    createReportBlockerTool(client) as Tool<unknown>,
    createGetAiContextTool(client) as Tool<unknown>,
    createAppendAiNoteTool(client) as Tool<unknown>,
    createRunValidationTool(client) as Tool<unknown>,
    createRunAllValidationsTool(client) as Tool<unknown>,
    createGetStructuredDescriptionTool(client) as Tool<unknown>,
  ];
}

/**
 * Create a single agent tool by name.
 *
 * @param name - Tool name
 * @param client - SpecTree API client instance
 * @returns Tool object or undefined if not found
 */
export function createAgentTool(
  name: AgentToolName,
  client: SpecTreeClient
): Tool<unknown> | undefined {
  switch (name) {
    case "log_progress":
      return createLogProgressTool(client) as Tool<unknown>;
    case "log_decision":
      return createLogDecisionTool(client) as Tool<unknown>;
    case "link_code_file":
      return createLinkCodeFileTool(client) as Tool<unknown>;
    case "get_task_context":
      return createGetTaskContextTool(client) as Tool<unknown>;
    case "get_code_context":
      return createGetCodeContextTool(client) as Tool<unknown>;
    case "report_blocker":
      return createReportBlockerTool(client) as Tool<unknown>;
    case "get_ai_context":
      return createGetAiContextTool(client) as Tool<unknown>;
    case "append_ai_note":
      return createAppendAiNoteTool(client) as Tool<unknown>;
    case "run_validation":
      return createRunValidationTool(client) as Tool<unknown>;
    case "run_all_validations":
      return createRunAllValidationsTool(client) as Tool<unknown>;
    case "get_structured_description":
      return createGetStructuredDescriptionTool(client) as Tool<unknown>;
    default:
      return undefined;
  }
}
