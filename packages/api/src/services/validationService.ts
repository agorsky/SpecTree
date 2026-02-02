/**
 * Validation Service
 *
 * Provides operations for managing validation checks on tasks.
 * Validation checks are executable criteria that define "done" in a verifiable way.
 */

import { randomUUID } from "crypto";
import { prisma } from "../lib/db.js";
import type { Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import type {
  ValidationCheck,
  ValidationCheckStatus,
  AddValidationCheckInput,
  ListValidationsResult,
} from "../schemas/validation.js";

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Task identifier pattern (e.g., "ENG-123-1")
 */
const TASK_IDENTIFIER_REGEX = /^[A-Z]+-\d+-\d+$/i;

/**
 * Get task by ID or identifier with validation checks
 */
async function getTask(idOrIdentifier: string): Promise<Task> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  const isIdentifier = TASK_IDENTIFIER_REGEX.test(idOrIdentifier);

  const whereClause = isUuid
    ? { id: idOrIdentifier }
    : isIdentifier
      ? { identifier: idOrIdentifier }
      : { title: idOrIdentifier };

  const task = await prisma.task.findFirst({
    where: whereClause,
  });

  if (!task) {
    throw new NotFoundError(`Task '${idOrIdentifier}' not found`);
  }

  return task;
}

/**
 * Parse validation checks from task's JSON field
 */
function parseValidationChecks(task: Task): ValidationCheck[] {
  if (!task.validationChecks) return [];
  try {
    return JSON.parse(task.validationChecks) as ValidationCheck[];
  } catch {
    return [];
  }
}

/**
 * Save validation checks to task
 */
async function saveValidationChecks(taskId: string, checks: ValidationCheck[]): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: {
      validationChecks: JSON.stringify(checks),
    },
  });
}

/**
 * Add a validation check to a task
 */
export async function addValidationCheck(
  taskIdOrIdentifier: string,
  input: AddValidationCheckInput
): Promise<ValidationCheck> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const newCheck: ValidationCheck = {
    id: randomUUID(),
    type: input.type,
    description: input.description,
    status: "pending",
    ...(input.command && { command: input.command }),
    ...(input.expectedExitCode !== undefined && { expectedExitCode: input.expectedExitCode }),
    ...(input.timeoutMs !== undefined && { timeoutMs: input.timeoutMs }),
    ...(input.filePath && { filePath: input.filePath }),
    ...(input.searchPattern && { searchPattern: input.searchPattern }),
    ...(input.testCommand && { testCommand: input.testCommand }),
  };

  checks.push(newCheck);
  await saveValidationChecks(task.id, checks);

  return newCheck;
}

/**
 * List all validation checks for a task
 */
export async function listValidationChecks(
  taskIdOrIdentifier: string
): Promise<ListValidationsResult> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const summary = {
    total: checks.length,
    passed: checks.filter(c => c.status === "passed").length,
    failed: checks.filter(c => c.status === "failed").length,
    pending: checks.filter(c => c.status === "pending").length,
  };

  return {
    taskId: task.id,
    identifier: task.identifier,
    checks,
    summary,
  };
}

/**
 * Get a single validation check by ID
 */
export async function getValidationCheck(
  taskIdOrIdentifier: string,
  checkId: string
): Promise<ValidationCheck> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const check = checks.find(c => c.id === checkId);
  if (!check) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  return check;
}

/**
 * Remove a validation check from a task
 */
export async function removeValidationCheck(
  taskIdOrIdentifier: string,
  checkId: string
): Promise<void> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const index = checks.findIndex(c => c.id === checkId);
  if (index === -1) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  checks.splice(index, 1);
  await saveValidationChecks(task.id, checks);
}

/**
 * Update a validation check's status
 */
export async function updateValidationCheckStatus(
  taskIdOrIdentifier: string,
  checkId: string,
  status: ValidationCheckStatus,
  error?: string,
  output?: string
): Promise<ValidationCheck> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const checkIndex = checks.findIndex(c => c.id === checkId);
  if (checkIndex === -1) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  const currentCheck = checks[checkIndex];
  if (!currentCheck) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  // Build updated check - only include defined properties
  const updatedCheck: ValidationCheck = {
    ...currentCheck,
    status,
    lastCheckedAt: new Date().toISOString(),
  };
  if (error !== undefined) {
    updatedCheck.lastError = error;
  } else {
    delete updatedCheck.lastError;
  }
  if (output !== undefined) {
    updatedCheck.lastOutput = output.substring(0, 5000);
  }
  checks[checkIndex] = updatedCheck;

  await saveValidationChecks(task.id, checks);

  return updatedCheck;
}

/**
 * Mark a manual validation check as passed
 */
export async function markManualValidated(
  taskIdOrIdentifier: string,
  checkId: string,
  notes?: string
): Promise<ValidationCheck> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const checkIndex = checks.findIndex(c => c.id === checkId);
  if (checkIndex === -1) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  const currentCheck = checks[checkIndex];
  if (!currentCheck) {
    throw new NotFoundError(`Validation check '${checkId}' not found`);
  }

  if (currentCheck.type !== "manual") {
    throw new ValidationError("Only manual validation checks can be marked as validated manually");
  }

  // Build updated check - clear error on manual pass
  const updatedCheck: ValidationCheck = {
    ...currentCheck,
    status: "passed",
    lastCheckedAt: new Date().toISOString(),
  };
  if (notes) {
    updatedCheck.lastOutput = notes;
  }
  delete updatedCheck.lastError;
  checks[checkIndex] = updatedCheck;

  await saveValidationChecks(task.id, checks);

  return updatedCheck;
}

/**
 * Reset all validation checks to pending status
 */
export async function resetValidationChecks(
  taskIdOrIdentifier: string
): Promise<ListValidationsResult> {
  const task = await getTask(taskIdOrIdentifier);
  const checks = parseValidationChecks(task);

  const resetChecks: ValidationCheck[] = checks.map(c => {
    // Create a new check object, omitting the status fields
    const { lastCheckedAt, lastError, lastOutput, ...rest } = c;
    return {
      ...rest,
      status: "pending" as ValidationCheckStatus,
    };
  });

  await saveValidationChecks(task.id, resetChecks);

  return listValidationChecks(task.id);
}

// Re-export for use by validation executor
export { getTask, parseValidationChecks, saveValidationChecks };
