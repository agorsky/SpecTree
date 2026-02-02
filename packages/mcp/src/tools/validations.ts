/**
 * MCP Tools for Validation Checklists
 *
 * Provides tools for managing validation checks on tasks - executable criteria
 * that define "done" in a verifiable way. AI agents can use these tools to:
 * - Define acceptance criteria as executable checks
 * - Run validations to verify their work
 * - Track validation status across sessions
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Validation check type enum for schema
const validationCheckTypes = [
  "command",
  "file_exists",
  "file_contains",
  "test_passes",
  "manual",
] as const;

// Register all validation tools
export function registerValidationTools(server: McpServer): void {
  // ==========================================================================
  // spectree__add_validation
  // ==========================================================================
  server.registerTool(
    "spectree__add_validation",
    {
      description:
        "Add a validation check to a task. Validation checks are executable criteria that define " +
        "'done' in a verifiable way. Types:\n" +
        "- 'command': Run a shell command, check exit code\n" +
        "- 'file_exists': Verify a file exists\n" +
        "- 'file_contains': Search file content with regex\n" +
        "- 'test_passes': Run a test command\n" +
        "- 'manual': Requires human verification\n\n" +
        "Use this to define acceptance criteria that can be automatically validated.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
        type: z
          .enum(validationCheckTypes)
          .describe(
            "The type of validation check."
          ),
        description: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "Human-readable description of what this check validates."
          ),
        command: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Shell command to run (required for 'command' type). E.g., 'pnpm lint'."
          ),
        expectedExitCode: z
          .number()
          .int()
          .min(0)
          .max(255)
          .optional()
          .describe(
            "Expected exit code for command (default: 0)."
          ),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .max(300000)
          .optional()
          .describe(
            "Timeout in milliseconds (default: 30000, max: 300000)."
          ),
        filePath: z
          .string()
          .max(500)
          .optional()
          .describe(
            "File path for 'file_exists' or 'file_contains' checks."
          ),
        searchPattern: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Regex pattern for 'file_contains' check."
          ),
        testCommand: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Test command for 'test_passes' type. E.g., 'pnpm test --filter auth'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);

        // Build input object conditionally to avoid undefined values
        const addInput: {
          type: typeof input.type;
          description: string;
          command?: string;
          expectedExitCode?: number;
          timeoutMs?: number;
          filePath?: string;
          searchPattern?: string;
          testCommand?: string;
        } = {
          type: input.type,
          description: input.description,
        };
        if (input.command !== undefined) addInput.command = input.command;
        if (input.expectedExitCode !== undefined) addInput.expectedExitCode = input.expectedExitCode;
        if (input.timeoutMs !== undefined) addInput.timeoutMs = input.timeoutMs;
        if (input.filePath !== undefined) addInput.filePath = input.filePath;
        if (input.searchPattern !== undefined) addInput.searchPattern = input.searchPattern;
        if (input.testCommand !== undefined) addInput.testCommand = input.testCommand;

        const { data: result } = await apiClient.addValidation(task.id, addInput);

        return createResponse({
          ...result,
          message: `Added validation check '${input.description}' to task ${task.identifier}`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_validations
  // ==========================================================================
  server.registerTool(
    "spectree__list_validations",
    {
      description:
        "List all validation checks for a task. Returns the checks with their current status " +
        "(pending, passed, failed) and a summary of validation state.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        const { data: result } = await apiClient.listValidations(task.id);

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__run_validation
  // ==========================================================================
  server.registerTool(
    "spectree__run_validation",
    {
      description:
        "Run a single validation check and update its status. Returns the result including " +
        "whether the check passed, any error message, and captured output.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
        checkId: z
          .string()
          .uuid()
          .describe(
            "The ID of the validation check to run."
          ),
        workingDirectory: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Working directory for command execution (defaults to cwd)."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        const { data: result } = await apiClient.runValidation(
          task.id,
          input.checkId,
          input.workingDirectory
        );

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' or check '${input.checkId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__run_all_validations
  // ==========================================================================
  server.registerTool(
    "spectree__run_all_validations",
    {
      description:
        "Run all validation checks for a task. Returns a summary with pass/fail counts and " +
        "individual results. Use this to verify all acceptance criteria are met before " +
        "marking a task complete.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
        stopOnFailure: z
          .boolean()
          .optional()
          .describe(
            "If true, stops running checks after the first failure (default: false)."
          ),
        workingDirectory: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Working directory for command execution (defaults to cwd)."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        
        // Build options conditionally
        const options: { stopOnFailure?: boolean; workingDirectory?: string } = {};
        if (input.stopOnFailure !== undefined) options.stopOnFailure = input.stopOnFailure;
        if (input.workingDirectory !== undefined) options.workingDirectory = input.workingDirectory;
        
        const { data: result } = await apiClient.runAllValidations(task.id, options);

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__mark_manual_validated
  // ==========================================================================
  server.registerTool(
    "spectree__mark_manual_validated",
    {
      description:
        "Mark a manual validation check as validated. Use this for checks that require " +
        "human verification and cannot be automated (e.g., 'UI looks correct', " +
        "'Documentation is clear').",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
        checkId: z
          .string()
          .uuid()
          .describe(
            "The ID of the manual validation check to mark as validated."
          ),
        notes: z
          .string()
          .max(1000)
          .optional()
          .describe(
            "Optional notes about the manual verification."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        const { data: result } = await apiClient.markManualValidated(
          task.id,
          input.checkId,
          input.notes
        );

        return createResponse({
          ...result,
          message: `Manual validation '${result.description}' marked as passed`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' or check '${input.checkId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__remove_validation
  // ==========================================================================
  server.registerTool(
    "spectree__remove_validation",
    {
      description:
        "Remove a validation check from a task. Use this to remove checks that are " +
        "no longer relevant or were added in error.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
        checkId: z
          .string()
          .uuid()
          .describe(
            "The ID of the validation check to remove."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        await apiClient.removeValidation(task.id, input.checkId);

        return createResponse({
          taskId: task.id,
          identifier: task.identifier,
          checkId: input.checkId,
          message: `Validation check removed from task ${task.identifier}`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' or check '${input.checkId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reset_validations
  // ==========================================================================
  server.registerTool(
    "spectree__reset_validations",
    {
      description:
        "Reset all validation checks for a task to pending status. Use this before " +
        "re-running validations after making changes.",
      inputSchema: {
        taskId: z
          .string()
          .describe(
            "The task identifier. Accepts UUID or human-readable identifier (e.g., 'COM-123-1')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve task identifier to UUID if needed
        const { data: task } = await apiClient.getTask(input.taskId);
        const { data: result } = await apiClient.resetValidations(task.id);

        return createResponse({
          ...result,
          message: `Reset ${result.summary.total} validation checks to pending`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Task '${input.taskId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
