import { prisma } from "../lib/db.js";
import type { Status } from "../generated/prisma/index.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/index.js";

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
}

/**
 * Validates that a category value is a valid StatusCategory
 */
function isValidCategory(category: string): category is StatusCategory {
  return VALID_CATEGORIES.includes(category as StatusCategory);
}

/**
 * List statuses with optional team filter, ordered by position
 */
export async function listStatuses(
  options: ListStatusesOptions = {}
): Promise<Status[]> {
  const where: { teamId?: string } = {};
  if (options.teamId !== undefined) {
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
