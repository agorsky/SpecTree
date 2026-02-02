import { z } from "zod";

/**
 * Validation Checklist Schemas
 *
 * Defines executable validation checks that define "done" in a verifiable way.
 * Tasks can have multiple validation checks that AI agents can execute to verify
 * their work is complete.
 */

/**
 * Validation check types
 */
export const validationCheckTypeValues = [
  "command",       // Run a shell command and check exit code
  "file_exists",   // Check if a file exists
  "file_contains", // Check if a file contains specific content (regex)
  "test_passes",   // Run a test command
  "manual",        // Manual verification by human
] as const;

export type ValidationCheckType = (typeof validationCheckTypeValues)[number];

/**
 * Validation check status values
 */
export const validationCheckStatusValues = ["pending", "passed", "failed"] as const;
export type ValidationCheckStatus = (typeof validationCheckStatusValues)[number];

/**
 * ValidationCheck interface - stored as JSON in the database
 */
export interface ValidationCheck {
  id: string;
  type: ValidationCheckType;
  description: string;

  // For command type
  command?: string;              // e.g., "pnpm test"
  expectedExitCode?: number;     // Default 0
  timeoutMs?: number;            // Max execution time (default: 30000)

  // For file_exists type
  filePath?: string;

  // For file_contains type
  searchPattern?: string;        // Regex or string to find in file

  // For test_passes type
  testCommand?: string;          // e.g., "pnpm test --filter userService"

  // Status tracking
  status: ValidationCheckStatus;
  lastCheckedAt?: string;        // ISO timestamp
  lastError?: string;
  lastOutput?: string;           // Captured stdout (truncated)
}

/**
 * Schema for creating a validation check
 */
export const addValidationCheckSchema = z.object({
  type: z.enum(validationCheckTypeValues).describe(
    "The type of validation check: 'command' (run shell command), " +
    "'file_exists' (check file exists), 'file_contains' (search file content), " +
    "'test_passes' (run test), 'manual' (human verification)."
  ),
  description: z.string().min(1).max(500).describe(
    "Human-readable description of what this check validates."
  ),

  // Command-type fields
  command: z.string().max(1000).optional().describe(
    "Shell command to run (for 'command' type). E.g., 'pnpm lint'."
  ),
  expectedExitCode: z.number().int().min(0).max(255).optional().describe(
    "Expected exit code for command (default: 0)."
  ),
  timeoutMs: z.number().int().min(1000).max(300000).optional().describe(
    "Timeout in milliseconds (default: 30000, max: 300000)."
  ),

  // File-type fields
  filePath: z.string().max(500).optional().describe(
    "File path for 'file_exists' or 'file_contains' checks."
  ),
  searchPattern: z.string().max(1000).optional().describe(
    "Regex pattern for 'file_contains' check."
  ),

  // Test-type fields
  testCommand: z.string().max(1000).optional().describe(
    "Test command to run (for 'test_passes' type). E.g., 'pnpm test --filter auth'."
  ),
}).refine(
  (data) => {
    // Validate required fields based on type
    switch (data.type) {
      case "command":
        return !!data.command;
      case "file_exists":
        return !!data.filePath;
      case "file_contains":
        return !!data.filePath && !!data.searchPattern;
      case "test_passes":
        return !!data.testCommand;
      case "manual":
        return true; // No additional fields required
      default:
        return false;
    }
  },
  {
    message: "Missing required fields for the specified validation type",
  }
);

export type AddValidationCheckInput = z.infer<typeof addValidationCheckSchema>;

/**
 * Schema for running a single validation
 */
export const runValidationSchema = z.object({
  checkId: z.string().uuid().describe(
    "The ID of the validation check to run."
  ),
  workingDirectory: z.string().max(1000).optional().describe(
    "Working directory for command execution (defaults to cwd)."
  ),
});

export type RunValidationInput = z.infer<typeof runValidationSchema>;

/**
 * Schema for running all validations
 */
export const runAllValidationsSchema = z.object({
  stopOnFailure: z.boolean().optional().describe(
    "If true, stops running checks after the first failure (default: false)."
  ),
  workingDirectory: z.string().max(1000).optional().describe(
    "Working directory for command execution (defaults to cwd)."
  ),
});

export type RunAllValidationsInput = z.infer<typeof runAllValidationsSchema>;

/**
 * Schema for marking a manual check as validated
 */
export const markManualValidatedSchema = z.object({
  checkId: z.string().uuid().describe(
    "The ID of the manual validation check to mark as validated."
  ),
  notes: z.string().max(1000).optional().describe(
    "Optional notes about the manual verification."
  ),
});

export type MarkManualValidatedInput = z.infer<typeof markManualValidatedSchema>;

/**
 * Schema for removing a validation check
 */
export const removeValidationCheckSchema = z.object({
  checkId: z.string().uuid().describe(
    "The ID of the validation check to remove."
  ),
});

export type RemoveValidationCheckInput = z.infer<typeof removeValidationCheckSchema>;

/**
 * Response for validation check operations
 */
export interface ValidationCheckResult {
  id: string;
  description: string;
  type: ValidationCheckType;
  status: ValidationCheckStatus;
  passed: boolean;
  error?: string;
  output?: string;
  durationMs?: number;
}

/**
 * Response for running all validations
 */
export interface RunAllValidationsResult {
  taskId: string;
  identifier: string;
  totalChecks: number;
  passed: number;
  failed: number;
  pending: number;
  allPassed: boolean;
  results: ValidationCheckResult[];
}

/**
 * Response for listing validations
 */
export interface ListValidationsResult {
  taskId: string;
  identifier: string;
  checks: ValidationCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  };
}
