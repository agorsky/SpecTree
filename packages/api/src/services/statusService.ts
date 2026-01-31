import { prisma } from "../lib/db.js";
import type { Status } from "../generated/prisma/index.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/index.js";
import { getAccessibleScopes, hasAccessibleScopes } from "../utils/scopeContext.js";

// Valid StatusCategory values
const VALID_CATEGORIES = ["backlog", "unstarted", "started", "completed", "canceled"] as const;
export type StatusCategory = (typeof VALID_CATEGORIES)[number];

// Types for status operations
export interface CreateStatusInput {
  name: string;
  teamId: string;
  category: string;
  color?: string | undefined;
  position?: number | undefined;
}

export interface UpdateStatusInput {
  name?: string | undefined;
  category?: string | undefined;
  color?: string | undefined;
  position?: number | undefined;
}

export interface ListStatusesOptions {
  teamId?: string | undefined;
  /** Current user ID - when provided, filters to only show statuses in accessible scopes */
  currentUserId?: string | undefined;
}

/**
 * Validates that a category value is a valid StatusCategory
 */
function isValidCategory(category: string): category is StatusCategory {
  return VALID_CATEGORIES.includes(category as StatusCategory);
}

/**
 * List statuses with optional team filter, ordered by position
 * When currentUserId is provided, filters to only show statuses in accessible scopes
 */
export async function listStatuses(
  options: ListStatusesOptions = {}
): Promise<Status[]> {
  const where: {
    teamId?: string;
    OR?: Array<{ teamId?: { in: string[] }; personalScopeId?: string | { in: string[] } }>;
  } = {};

  // Apply scope-based filtering when currentUserId is provided
  if (options.currentUserId) {
    const accessibleScopes = await getAccessibleScopes(options.currentUserId);

    // If user has no accessible scopes, return empty result
    if (!hasAccessibleScopes(accessibleScopes)) {
      return [];
    }

    // Build OR clause for accessible scopes
    const scopeConditions: Array<{ teamId?: { in: string[] }; personalScopeId?: string }> = [];

    if (accessibleScopes.teamIds.length > 0) {
      scopeConditions.push({ teamId: { in: accessibleScopes.teamIds } });
    }
    if (accessibleScopes.personalScopeId) {
      scopeConditions.push({ personalScopeId: accessibleScopes.personalScopeId });
    }

    where.OR = scopeConditions;
  }

  // If teamId filter is provided, apply it (overrides scope filter for specific team queries)
  if (options.teamId !== undefined) {
    delete where.OR;
    where.teamId = options.teamId;
  }

  return prisma.status.findMany({
    where,
    orderBy: { position: "asc" },
  });
}

/**
 * Get a single status by ID
 */
export async function getStatusById(id: string): Promise<Status | null> {
  return prisma.status.findUnique({
    where: { id },
  });
}

/**
 * Create a new status
 */
export async function createStatus(input: CreateStatusInput): Promise<Status> {
  // Validate required fields
  if (!input.name || input.name.trim() === "") {
    throw new ValidationError("Name is required");
  }
  if (!input.teamId || input.teamId.trim() === "") {
    throw new ValidationError("Team ID is required");
  }
  if (!input.category || input.category.trim() === "") {
    throw new ValidationError("Category is required");
  }

  // Validate category is a valid StatusCategory enum value
  if (!isValidCategory(input.category)) {
    throw new ValidationError(
      `Invalid category '${input.category}'. Must be one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  // Check that the team exists
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true },
  });
  if (!team) {
    throw new NotFoundError(`Team with id '${input.teamId}' not found`);
  }

  try {
    return await prisma.status.create({
      data: {
        name: input.name.trim(),
        teamId: input.teamId,
        category: input.category,
        ...(input.color !== undefined ? { color: input.color.trim() } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
  } catch (error) {
    // Handle unique constraint violation (teamId + name)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new ConflictError(
        `A status with name '${input.name}' already exists in this team`
      );
    }
    throw error;
  }
}

/**
 * Update an existing status
 */
export async function updateStatus(
  id: string,
  input: UpdateStatusInput
): Promise<Status> {
  // First check if status exists
  const existing = await prisma.status.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Status with id '${id}' not found`);
  }

  // Validate fields if provided
  if (input.name?.trim() === "") {
    throw new ValidationError("Name cannot be empty");
  }

  // Validate category if provided
  if (input.category !== undefined) {
    if (input.category.trim() === "") {
      throw new ValidationError("Category cannot be empty");
    }
    if (!isValidCategory(input.category)) {
      throw new ValidationError(
        `Invalid category '${input.category}'. Must be one of: ${VALID_CATEGORIES.join(", ")}`
      );
    }
  }

  try {
    return await prisma.status.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.color !== undefined ? { color: input.color.trim() } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
  } catch (error) {
    // Handle unique constraint violation (teamId + name)
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      throw new ConflictError(
        `A status with name '${String(input.name)}' already exists in this team`
      );
    }
    throw error;
  }
}

/**
 * Check if a string is a valid UUID v4
 */
function isUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Resolve a status identifier (ID or name) to its UUID.
 * Returns null if the status is not found.
 * If the value is already a UUID, it checks if it exists.
 */
export async function resolveStatusToId(
  value: string,
  teamId?: string
): Promise<string | null> {
  if (isUuid(value)) {
    // Check if the status exists
    const status = await prisma.status.findUnique({
      where: { id: value },
      select: { id: true },
    });
    return status?.id ?? null;
  }

  // Look up by name (case-insensitive)
  const where: { name: { equals: string; mode: "insensitive" }; teamId?: string } = {
    name: { equals: value, mode: "insensitive" },
  };
  if (teamId) {
    where.teamId = teamId;
  }

  const status = await prisma.status.findFirst({
    where,
    select: { id: true },
  });

  return status?.id ?? null;
}

/**
 * Resolve multiple status identifiers (IDs or names) to their UUIDs.
 * Returns only the IDs that were found (filters out invalid ones).
 * Accepts either a single string or an array of strings.
 */
export async function resolveStatusesToIds(
  values: string | string[],
  teamId?: string
): Promise<string[]> {
  const valueArray = Array.isArray(values) ? values : [values];
  const ids: string[] = [];

  for (const value of valueArray) {
    const id = await resolveStatusToId(value, teamId);
    if (id) {
      ids.push(id);
    }
  }

  // Remove duplicates
  return [...new Set(ids)];
}

/**
 * Get all status IDs for a given category.
 * Returns an empty array if no statuses are found.
 */
export async function getStatusIdsByCategory(
  category: string,
  teamId?: string
): Promise<string[]> {
  // Validate category
  if (!isValidCategory(category)) {
    return [];
  }

  const where: { category: string; teamId?: string } = {
    category,
  };
  if (teamId) {
    where.teamId = teamId;
  }

  const statuses = await prisma.status.findMany({
    where,
    select: { id: true },
  });

  return statuses.map((s) => s.id);
}

/**
 * Default status configurations for new teams
 */
const DEFAULT_STATUSES: {
  name: string;
  category: StatusCategory;
  position: number;
}[] = [
  { name: "Backlog", category: "backlog", position: 0 },
  { name: "Todo", category: "unstarted", position: 1 },
  { name: "In Progress", category: "started", position: 2 },
  { name: "Done", category: "completed", position: 3 },
  { name: "Canceled", category: "canceled", position: 4 },
];

/**
 * Create default statuses for a new team.
 * Uses a transaction to ensure atomicity (all or nothing).
 */
export async function createDefaultStatuses(teamId: string): Promise<Status[]> {
  return prisma.$transaction(async (tx) => {
    const statuses: Status[] = [];

    for (const statusConfig of DEFAULT_STATUSES) {
      const status = await tx.status.create({
        data: {
          name: statusConfig.name,
          teamId,
          category: statusConfig.category,
          position: statusConfig.position,
        },
      });
      statuses.push(status);
    }

    return statuses;
  });
}

/**
 * Get the default "Backlog" status for a team.
 * Returns the first status with category "backlog" for the team.
 * Returns null if no backlog status exists.
 */
export async function getDefaultBacklogStatus(teamId: string): Promise<Status | null> {
  return prisma.status.findFirst({
    where: {
      teamId,
      category: "backlog",
    },
    orderBy: { position: "asc" },
  });
}

/**
 * Delete a status (only if not in use by any features or tasks)
 */
export async function deleteStatus(id: string): Promise<void> {
  // First check if status exists
  const existing = await prisma.status.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          features: true,
          tasks: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Status with id '${id}' not found`);
  }

  // Check if status is in use by any features or tasks
  if (existing._count.features > 0 || existing._count.tasks > 0) {
    throw new ConflictError("Status is in use and cannot be deleted");
  }

  await prisma.status.delete({
    where: { id },
  });
}
