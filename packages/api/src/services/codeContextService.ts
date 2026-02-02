/**
 * Code Context Service
 *
 * Provides business logic for linking tasks/features to code artifacts
 * such as files, functions, git branches, commits, and pull requests.
 *
 * This enables AI agents to instantly understand the code context
 * for any task without needing to discover it through exploration.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// =============================================================================
// Types
// =============================================================================

export type EntityType = "feature" | "task";

export interface CodeContext {
  files: string[];
  functions: string[];
  branch: string | null;
  commits: string[];
  pr: {
    number: number;
    url: string;
  } | null;
}

export interface CodeContextResponse {
  entityType: EntityType;
  entityId: string;
  identifier: string;
  codeContext: CodeContext;
  updatedAt: string;
}

export interface LinkFileInput {
  filePath: string;
  reason?: string;
}

export interface LinkFunctionInput {
  filePath: string;
  functionName: string;
  reason?: string;
}

export interface LinkBranchInput {
  branchName: string;
}

export interface LinkCommitInput {
  commitSha: string;
  message?: string;
}

export interface LinkPrInput {
  prNumber: number;
  prUrl: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feature identifier pattern (e.g., "ENG-123")
 */
const FEATURE_IDENTIFIER_REGEX = /^[A-Z]+-\d+$/i;

/**
 * Task identifier pattern (e.g., "ENG-123-1")
 */
const TASK_IDENTIFIER_REGEX = /^[A-Z]+-\d+-\d+$/i;

/**
 * Parse JSON string to string array
 */
function parseJsonArray(jsonString: string | null): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Stringify array to JSON string
 */
function stringifyArray(arr: string[]): string {
  return JSON.stringify(arr);
}

/**
 * Resolve a feature ID from UUID, identifier, or title
 */
async function resolveFeatureId(idOrIdentifierOrTitle: string): Promise<{ id: string; identifier: string }> {
  const isUuid = UUID_REGEX.test(idOrIdentifierOrTitle);
  const isIdentifier = FEATURE_IDENTIFIER_REGEX.test(idOrIdentifierOrTitle);
  
  const whereClause = isUuid
    ? { id: idOrIdentifierOrTitle }
    : isIdentifier
      ? { identifier: idOrIdentifierOrTitle }
      : { title: idOrIdentifierOrTitle };

  const feature = await prisma.feature.findFirst({
    where: whereClause,
    select: { id: true, identifier: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature '${idOrIdentifierOrTitle}' not found`);
  }

  return feature;
}

/**
 * Resolve a task ID from UUID or identifier
 */
async function resolveTaskId(idOrIdentifier: string): Promise<{ id: string; identifier: string }> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  const isIdentifier = TASK_IDENTIFIER_REGEX.test(idOrIdentifier);
  
  const whereClause = isUuid
    ? { id: idOrIdentifier }
    : isIdentifier
      ? { identifier: idOrIdentifier }
      : { title: idOrIdentifier };

  const task = await prisma.task.findFirst({
    where: whereClause,
    select: { id: true, identifier: true },
  });

  if (!task) {
    throw new NotFoundError(`Task '${idOrIdentifier}' not found`);
  }

  return task;
}

// =============================================================================
// Feature Code Context Operations
// =============================================================================

/**
 * Get code context for a feature
 */
export async function getFeatureCodeContext(
  featureIdOrIdentifier: string
): Promise<CodeContextResponse> {
  const { id, identifier } = await resolveFeatureId(featureIdOrIdentifier);
  
  const feature = await prisma.feature.findUnique({
    where: { id },
    select: {
      relatedFiles: true,
      relatedFunctions: true,
      gitBranch: true,
      gitCommits: true,
      gitPrNumber: true,
      gitPrUrl: true,
      updatedAt: true,
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  return {
    entityType: "feature",
    entityId: id,
    identifier,
    codeContext: {
      files: parseJsonArray(feature.relatedFiles),
      functions: parseJsonArray(feature.relatedFunctions),
      branch: feature.gitBranch,
      commits: parseJsonArray(feature.gitCommits),
      pr: feature.gitPrNumber && feature.gitPrUrl
        ? { number: feature.gitPrNumber, url: feature.gitPrUrl }
        : null,
    },
    updatedAt: feature.updatedAt.toISOString(),
  };
}

/**
 * Link a file to a feature
 */
export async function linkFeatureFile(
  featureIdOrIdentifier: string,
  filePath: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  // Get current files
  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { relatedFiles: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  const currentFiles = parseJsonArray(feature.relatedFiles);

  // Add file if not already present (deduplication)
  if (!currentFiles.includes(filePath)) {
    currentFiles.push(filePath);
  }

  await prisma.feature.update({
    where: { id },
    data: {
      relatedFiles: stringifyArray(currentFiles),
    },
  });

  return getFeatureCodeContext(id);
}

/**
 * Unlink a file from a feature
 */
export async function unlinkFeatureFile(
  featureIdOrIdentifier: string,
  filePath: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { relatedFiles: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  const currentFiles = parseJsonArray(feature.relatedFiles);
  const updatedFiles = currentFiles.filter(f => f !== filePath);

  await prisma.feature.update({
    where: { id },
    data: {
      relatedFiles: stringifyArray(updatedFiles),
    },
  });

  return getFeatureCodeContext(id);
}

/**
 * Link a function to a feature
 */
export async function linkFeatureFunction(
  featureIdOrIdentifier: string,
  filePath: string,
  functionName: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { relatedFunctions: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  const functionRef = `${filePath}:${functionName}`;
  const currentFunctions = parseJsonArray(feature.relatedFunctions);

  // Add function if not already present (deduplication)
  if (!currentFunctions.includes(functionRef)) {
    currentFunctions.push(functionRef);
  }

  await prisma.feature.update({
    where: { id },
    data: {
      relatedFunctions: stringifyArray(currentFunctions),
    },
  });

  return getFeatureCodeContext(id);
}

/**
 * Link a git branch to a feature
 */
export async function linkFeatureBranch(
  featureIdOrIdentifier: string,
  branchName: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  await prisma.feature.update({
    where: { id },
    data: {
      gitBranch: branchName,
    },
  });

  return getFeatureCodeContext(id);
}

/**
 * Link a commit to a feature
 */
export async function linkFeatureCommit(
  featureIdOrIdentifier: string,
  commitSha: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { gitCommits: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  const currentCommits = parseJsonArray(feature.gitCommits);

  // Add commit if not already present (deduplication)
  if (!currentCommits.includes(commitSha)) {
    currentCommits.push(commitSha);
  }

  await prisma.feature.update({
    where: { id },
    data: {
      gitCommits: stringifyArray(currentCommits),
    },
  });

  return getFeatureCodeContext(id);
}

/**
 * Link a pull request to a feature
 */
export async function linkFeaturePr(
  featureIdOrIdentifier: string,
  prNumber: number,
  prUrl: string
): Promise<CodeContextResponse> {
  const { id } = await resolveFeatureId(featureIdOrIdentifier);

  // Validate URL
  try {
    new URL(prUrl);
  } catch {
    throw new ValidationError(`Invalid PR URL: ${prUrl}`);
  }

  await prisma.feature.update({
    where: { id },
    data: {
      gitPrNumber: prNumber,
      gitPrUrl: prUrl,
    },
  });

  return getFeatureCodeContext(id);
}

// =============================================================================
// Task Code Context Operations
// =============================================================================

/**
 * Get code context for a task
 */
export async function getTaskCodeContext(
  taskIdOrIdentifier: string
): Promise<CodeContextResponse> {
  const { id, identifier } = await resolveTaskId(taskIdOrIdentifier);
  
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      relatedFiles: true,
      relatedFunctions: true,
      gitBranch: true,
      gitCommits: true,
      gitPrNumber: true,
      gitPrUrl: true,
      updatedAt: true,
    },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  return {
    entityType: "task",
    entityId: id,
    identifier,
    codeContext: {
      files: parseJsonArray(task.relatedFiles),
      functions: parseJsonArray(task.relatedFunctions),
      branch: task.gitBranch,
      commits: parseJsonArray(task.gitCommits),
      pr: task.gitPrNumber && task.gitPrUrl
        ? { number: task.gitPrNumber, url: task.gitPrUrl }
        : null,
    },
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * Link a file to a task
 */
export async function linkTaskFile(
  taskIdOrIdentifier: string,
  filePath: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  const task = await prisma.task.findUnique({
    where: { id },
    select: { relatedFiles: true },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  const currentFiles = parseJsonArray(task.relatedFiles);

  // Add file if not already present (deduplication)
  if (!currentFiles.includes(filePath)) {
    currentFiles.push(filePath);
  }

  await prisma.task.update({
    where: { id },
    data: {
      relatedFiles: stringifyArray(currentFiles),
    },
  });

  return getTaskCodeContext(id);
}

/**
 * Unlink a file from a task
 */
export async function unlinkTaskFile(
  taskIdOrIdentifier: string,
  filePath: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  const task = await prisma.task.findUnique({
    where: { id },
    select: { relatedFiles: true },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  const currentFiles = parseJsonArray(task.relatedFiles);
  const updatedFiles = currentFiles.filter(f => f !== filePath);

  await prisma.task.update({
    where: { id },
    data: {
      relatedFiles: stringifyArray(updatedFiles),
    },
  });

  return getTaskCodeContext(id);
}

/**
 * Link a function to a task
 */
export async function linkTaskFunction(
  taskIdOrIdentifier: string,
  filePath: string,
  functionName: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  const task = await prisma.task.findUnique({
    where: { id },
    select: { relatedFunctions: true },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  const functionRef = `${filePath}:${functionName}`;
  const currentFunctions = parseJsonArray(task.relatedFunctions);

  // Add function if not already present (deduplication)
  if (!currentFunctions.includes(functionRef)) {
    currentFunctions.push(functionRef);
  }

  await prisma.task.update({
    where: { id },
    data: {
      relatedFunctions: stringifyArray(currentFunctions),
    },
  });

  return getTaskCodeContext(id);
}

/**
 * Link a git branch to a task
 */
export async function linkTaskBranch(
  taskIdOrIdentifier: string,
  branchName: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  await prisma.task.update({
    where: { id },
    data: {
      gitBranch: branchName,
    },
  });

  return getTaskCodeContext(id);
}

/**
 * Link a commit to a task
 */
export async function linkTaskCommit(
  taskIdOrIdentifier: string,
  commitSha: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  const task = await prisma.task.findUnique({
    where: { id },
    select: { gitCommits: true },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  const currentCommits = parseJsonArray(task.gitCommits);

  // Add commit if not already present (deduplication)
  if (!currentCommits.includes(commitSha)) {
    currentCommits.push(commitSha);
  }

  await prisma.task.update({
    where: { id },
    data: {
      gitCommits: stringifyArray(currentCommits),
    },
  });

  return getTaskCodeContext(id);
}

/**
 * Link a pull request to a task
 */
export async function linkTaskPr(
  taskIdOrIdentifier: string,
  prNumber: number,
  prUrl: string
): Promise<CodeContextResponse> {
  const { id } = await resolveTaskId(taskIdOrIdentifier);

  // Validate URL
  try {
    new URL(prUrl);
  } catch {
    throw new ValidationError(`Invalid PR URL: ${prUrl}`);
  }

  await prisma.task.update({
    where: { id },
    data: {
      gitPrNumber: prNumber,
      gitPrUrl: prUrl,
    },
  });

  return getTaskCodeContext(id);
}

// =============================================================================
// Generic Operations (for MCP tools)
// =============================================================================

/**
 * Get code context for either a feature or task
 */
export async function getCodeContext(
  entityType: EntityType,
  entityId: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return getFeatureCodeContext(entityId);
  } else {
    return getTaskCodeContext(entityId);
  }
}

/**
 * Link a file to either a feature or task
 */
export async function linkFile(
  entityType: EntityType,
  entityId: string,
  filePath: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return linkFeatureFile(entityId, filePath);
  } else {
    return linkTaskFile(entityId, filePath);
  }
}

/**
 * Unlink a file from either a feature or task
 */
export async function unlinkFile(
  entityType: EntityType,
  entityId: string,
  filePath: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return unlinkFeatureFile(entityId, filePath);
  } else {
    return unlinkTaskFile(entityId, filePath);
  }
}

/**
 * Link a function to either a feature or task
 */
export async function linkFunction(
  entityType: EntityType,
  entityId: string,
  filePath: string,
  functionName: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return linkFeatureFunction(entityId, filePath, functionName);
  } else {
    return linkTaskFunction(entityId, filePath, functionName);
  }
}

/**
 * Link a git branch to either a feature or task
 */
export async function linkBranch(
  entityType: EntityType,
  entityId: string,
  branchName: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return linkFeatureBranch(entityId, branchName);
  } else {
    return linkTaskBranch(entityId, branchName);
  }
}

/**
 * Link a commit to either a feature or task
 */
export async function linkCommit(
  entityType: EntityType,
  entityId: string,
  commitSha: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return linkFeatureCommit(entityId, commitSha);
  } else {
    return linkTaskCommit(entityId, commitSha);
  }
}

/**
 * Link a pull request to either a feature or task
 */
export async function linkPr(
  entityType: EntityType,
  entityId: string,
  prNumber: number,
  prUrl: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    return linkFeaturePr(entityId, prNumber, prUrl);
  } else {
    return linkTaskPr(entityId, prNumber, prUrl);
  }
}

/**
 * Clear all code context for a feature or task
 */
export async function clearCodeContext(
  entityType: EntityType,
  entityId: string
): Promise<CodeContextResponse> {
  if (entityType === "feature") {
    const { id } = await resolveFeatureId(entityId);
    await prisma.feature.update({
      where: { id },
      data: {
        relatedFiles: null,
        relatedFunctions: null,
        gitBranch: null,
        gitCommits: null,
        gitPrNumber: null,
        gitPrUrl: null,
      },
    });
    return getFeatureCodeContext(id);
  } else {
    const { id } = await resolveTaskId(entityId);
    await prisma.task.update({
      where: { id },
      data: {
        relatedFiles: null,
        relatedFunctions: null,
        gitBranch: null,
        gitCommits: null,
        gitPrNumber: null,
        gitPrUrl: null,
      },
    });
    return getTaskCodeContext(id);
  }
}
