/**
 * Validation Executor
 *
 * Executes validation checks safely with proper sandboxing, timeout handling,
 * and security restrictions. This module handles the actual execution of
 * command, file, and test-based validations.
 */

import { spawn } from "child_process";
import { access, readFile } from "fs/promises";
import { constants } from "fs";
import type {
  ValidationCheckResult,
  RunAllValidationsResult,
} from "../schemas/validation.js";
import {
  getTask,
  parseValidationChecks,
  updateValidationCheckStatus,
} from "./validationService.js";

// Default timeout for command execution (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 300000; // 5 minutes max

// Maximum output length to capture
const MAX_OUTPUT_LENGTH = 10000;

/**
 * Security: List of dangerous command patterns to reject
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,           // rm -rf /
  /rm\s+-rf\s+~/i,            // rm -rf ~
  /mkfs/i,                    // Format commands
  /dd\s+if=/i,                // dd commands
  />\s*\/dev\//i,             // Write to device files
  /chmod\s+777/i,             // Overly permissive chmod
  /curl.*\|\s*(ba)?sh/i,      // Pipe to shell
  /wget.*\|\s*(ba)?sh/i,      // Pipe to shell
  /eval\s+/i,                 // eval command
  /:(){.*};:/,                // Fork bomb
  /\$\(.*\)/,                 // Command substitution (limited - may need refinement)
];

/**
 * Check if a command is potentially dangerous
 */
function isCommandDangerous(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Execute a shell command safely with timeout
 */
async function executeCommand(
  command: string,
  options: {
    expectedExitCode?: number;
    timeoutMs?: number;
    workingDirectory?: string;
  } = {}
): Promise<{ passed: boolean; exitCode: number; output: string; error?: string }> {
  const { expectedExitCode = 0, timeoutMs = DEFAULT_TIMEOUT_MS, workingDirectory } = options;
  const effectiveTimeout = Math.min(timeoutMs, MAX_TIMEOUT_MS);

  // Security check
  if (isCommandDangerous(command)) {
    return {
      passed: false,
      exitCode: -1,
      output: "",
      error: "Command rejected: potentially dangerous operation detected",
    };
  }

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    const child = spawn(command, {
      shell: true,
      cwd: workingDirectory || process.cwd(),
      env: {
        ...process.env,
        // Restrict some environment variables for safety
        SUDO_ASKPASS: undefined,
      },
      timeout: effectiveTimeout,
    });

    // Set up timeout handler
    const timeoutHandle = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1000);
    }, effectiveTimeout);

    child.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length < MAX_OUTPUT_LENGTH) {
        stdout += chunk.substring(0, MAX_OUTPUT_LENGTH - stdout.length);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length < MAX_OUTPUT_LENGTH) {
        stderr += chunk.substring(0, MAX_OUTPUT_LENGTH - stderr.length);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeoutHandle);
      resolve({
        passed: false,
        exitCode: -1,
        output: stdout,
        error: `Execution error: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      const exitCode = code ?? -1;
      const passed = !killed && exitCode === expectedExitCode;
      
      const response: { passed: boolean; exitCode: number; output: string; error?: string } = {
        passed,
        exitCode,
        output: stdout + (stderr ? `\n[stderr]: ${stderr}` : ""),
      };
      
      if (killed) {
        response.error = `Command timed out after ${effectiveTimeout}ms`;
      } else if (!passed) {
        response.error = `Exit code ${exitCode} (expected ${expectedExitCode})`;
      }
      
      resolve(response);
    });
  });
}

/**
 * Check if a file exists
 */
async function checkFileExists(
  filePath: string,
  workingDirectory?: string
): Promise<{ passed: boolean; error?: string }> {
  try {
    const fullPath = workingDirectory
      ? `${workingDirectory}/${filePath}`.replace(/\/+/g, "/")
      : filePath;

    await access(fullPath, constants.F_OK);
    return { passed: true };
  } catch {
    return {
      passed: false,
      error: `File not found: ${filePath}`,
    };
  }
}

/**
 * Check if a file contains a specific pattern
 */
async function checkFileContains(
  filePath: string,
  searchPattern: string,
  workingDirectory?: string
): Promise<{ passed: boolean; error?: string; output?: string }> {
  try {
    const fullPath = workingDirectory
      ? `${workingDirectory}/${filePath}`.replace(/\/+/g, "/")
      : filePath;

    const content = await readFile(fullPath, "utf-8");
    const regex = new RegExp(searchPattern);
    const match = regex.test(content);

    if (match) {
      return { passed: true, output: `Pattern found in ${filePath}` };
    } else {
      return {
        passed: false,
        error: `Pattern '${searchPattern}' not found in ${filePath}`,
      };
    }
  } catch (err) {
    return {
      passed: false,
      error: `Failed to read file: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Execute a single validation check
 */
export async function runValidation(
  taskIdOrIdentifier: string,
  checkId: string,
  workingDirectory?: string
): Promise<ValidationCheckResult> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);
  const check = checks.find(c => c.id === checkId);

  if (!check) {
    throw new Error(`Validation check '${checkId}' not found`);
  }

  const startTime = Date.now();
  let result: { passed: boolean; error?: string; output?: string };

  switch (check.type) {
    case "command":
      if (!check.command) {
        result = { passed: false, error: "No command specified" };
      } else {
        const cmdOptions: { expectedExitCode?: number; timeoutMs?: number; workingDirectory?: string } = {};
        if (check.expectedExitCode !== undefined) {
          cmdOptions.expectedExitCode = check.expectedExitCode;
        }
        if (check.timeoutMs !== undefined) {
          cmdOptions.timeoutMs = check.timeoutMs;
        }
        if (workingDirectory !== undefined) {
          cmdOptions.workingDirectory = workingDirectory;
        }
        const cmdResult = await executeCommand(check.command, cmdOptions);
        result = { passed: cmdResult.passed };
        if (cmdResult.error) {
          result.error = cmdResult.error;
        }
        if (cmdResult.output) {
          result.output = cmdResult.output;
        }
      }
      break;

    case "file_exists":
      if (!check.filePath) {
        result = { passed: false, error: "No file path specified" };
      } else {
        result = await checkFileExists(check.filePath, workingDirectory);
      }
      break;

    case "file_contains":
      if (!check.filePath || !check.searchPattern) {
        result = { passed: false, error: "File path and search pattern required" };
      } else {
        result = await checkFileContains(check.filePath, check.searchPattern, workingDirectory);
      }
      break;

    case "test_passes":
      if (!check.testCommand) {
        result = { passed: false, error: "No test command specified" };
      } else {
        const testOptions: { expectedExitCode?: number; timeoutMs?: number; workingDirectory?: string } = {
          expectedExitCode: 0,
          timeoutMs: check.timeoutMs ?? 120000, // Default 2 min for tests
        };
        if (workingDirectory !== undefined) {
          testOptions.workingDirectory = workingDirectory;
        }
        const testResult = await executeCommand(check.testCommand, testOptions);
        result = { passed: testResult.passed };
        if (testResult.error) {
          result.error = testResult.error;
        }
        if (testResult.output) {
          result.output = testResult.output;
        }
      }
      break;

    case "manual":
      // Manual checks cannot be run automatically
      result = { passed: check.status === "passed" };
      if (check.status !== "passed") {
        result.error = "Manual verification required";
      }
      if (check.lastOutput) {
        result.output = check.lastOutput;
      }
      break;

    default:
      result = { passed: false, error: `Unknown check type: ${check.type}` };
  }

  const durationMs = Date.now() - startTime;

  // Update the check status in the database (only for non-manual checks)
  if (check.type !== "manual") {
    await updateValidationCheckStatus(
      task.id,
      checkId,
      result.passed ? "passed" : "failed",
      result.error,
      result.output
    );
  }

  // Build result object conditionally
  const finalResult: ValidationCheckResult = {
    id: check.id,
    description: check.description,
    type: check.type,
    status: result.passed ? "passed" : "failed",
    passed: result.passed,
    durationMs,
  };
  if (result.error) {
    finalResult.error = result.error;
  }
  if (result.output) {
    finalResult.output = result.output;
  }

  return finalResult;
}

/**
 * Run all validation checks for a task
 */
export async function runAllValidations(
  taskIdOrIdentifier: string,
  options: {
    stopOnFailure?: boolean;
    workingDirectory?: string;
  } = {}
): Promise<RunAllValidationsResult> {
  const { stopOnFailure = false, workingDirectory } = options;
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const results: ValidationCheckResult[] = [];
  let passed = 0;
  let failed = 0;
  let pending = 0;

  for (const check of checks) {
    if (check.type === "manual") {
      // Include manual checks in results but don't run them
      const manualResult: ValidationCheckResult = {
        id: check.id,
        description: check.description,
        type: check.type,
        status: check.status,
        passed: check.status === "passed",
      };
      if (check.status !== "passed") {
        manualResult.error = "Manual verification required";
      }
      results.push(manualResult);

      if (check.status === "passed") {
        passed++;
      } else if (check.status === "failed") {
        failed++;
      } else {
        pending++;
      }
      continue;
    }

    try {
      const result = await runValidation(task.id, check.id, workingDirectory);
      results.push(result);

      if (result.passed) {
        passed++;
      } else {
        failed++;
        if (stopOnFailure) {
          // Mark remaining checks as pending
          const remainingIndex = checks.indexOf(check) + 1;
          for (let i = remainingIndex; i < checks.length; i++) {
            const remainingCheck = checks[i];
            if (remainingCheck) {
              results.push({
                id: remainingCheck.id,
                description: remainingCheck.description,
                type: remainingCheck.type,
                status: "pending",
                passed: false,
                error: "Skipped due to previous failure",
              });
            }
            pending++;
          }
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.push({
        id: check.id,
        description: check.description,
        type: check.type,
        status: "failed",
        passed: false,
        error: errorMessage,
      });
      failed++;

      if (stopOnFailure) {
        break;
      }
    }
  }

  return {
    taskId: task.id,
    identifier: task.identifier,
    totalChecks: checks.length,
    passed,
    failed,
    pending,
    allPassed: failed === 0 && pending === 0 && passed === checks.length,
    results,
  };
}

// Re-export for convenience
export { getTask };
