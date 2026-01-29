import { prisma } from "../lib/db.js";
import type { Team } from "../generated/prisma/index.js";
import { NotFoundError, ConflictError, ValidationError } from "../errors/index.js";
import { createDefaultStatuses } from "./statusService.js";

// Types for team operations
export interface CreateTeamInput {
  name: string;
  key: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
}

export interface UpdateTeamInput {
  name?: string | undefined;
  key?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
}

export interface ListTeamsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface TeamWithCount extends Team {
  _count: {
    memberships: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Check if a team key already exists
 */
export async function keyExists(key: string, excludeId?: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { key },
    select: { id: true },
  });
  if (!team) return false;
  if (excludeId && team.id === excludeId) return false;
  return true;
}

/**
 * List teams with cursor-based pagination
 */
export async function listTeams(
  options: ListTeamsOptions = {}
): Promise<PaginatedResult<TeamWithCount>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  const teams = await prisma.team.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { memberships: true } } },
  }) as TeamWithCount[];

  const hasMore = teams.length > limit;
  if (hasMore) {
    teams.pop();
  }

  const lastTeam = teams.at(-1);
  const nextCursor = hasMore && lastTeam ? lastTeam.id : null;

  return {
    data: teams,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get a single team by ID
 */
export async function getTeamById(id: string): Promise<TeamWithCount | null> {
  return prisma.team.findUnique({
    where: { id, isArchived: false },
    include: { _count: { select: { memberships: true } } },
  }) as Promise<TeamWithCount | null>;
}

/**
 * Create a new team with default statuses.
 * Uses a transaction to ensure atomicity (team + statuses created together or not at all).
 */
export async function createTeam(input: CreateTeamInput): Promise<Team> {
  // Validate required fields
  if (!input.name || input.name.trim() === "") {
    throw new ValidationError("Name is required");
  }
  if (!input.key || input.key.trim() === "") {
    throw new ValidationError("Key is required");
  }

  // Check for key uniqueness
  if (await keyExists(input.key)) {
    throw new ConflictError("A team with this key already exists");
  }

  // Create team and default statuses in a transaction
  const team = await prisma.team.create({
    data: {
      name: input.name.trim(),
      key: input.key.trim(),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.icon !== undefined ? { icon: input.icon.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color.trim() } : {}),
    },
  });

  // Create default statuses for the new team
  await createDefaultStatuses(team.id);

  return team;
}

/**
 * Update an existing team
 */
export async function updateTeam(
  id: string,
  input: UpdateTeamInput
): Promise<Team> {
  // First check if team exists and is not archived
  const existing = await prisma.team.findUnique({
    where: { id },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Team with id '${id}' not found`);
  }

  // Validate fields if provided
  if (input.name?.trim() === "") {
    throw new ValidationError("Name cannot be empty");
  }
  if (input.key?.trim() === "") {
    throw new ValidationError("Key cannot be empty");
  }

  // Check for key uniqueness if updating key
  if (input.key !== undefined && input.key !== existing.key) {
    if (await keyExists(input.key, id)) {
      throw new ConflictError("A team with this key already exists");
    }
  }

  return prisma.team.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.key !== undefined ? { key: input.key.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.icon !== undefined ? { icon: input.icon.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color.trim() } : {}),
    },
  });
}

/**
 * Soft delete a team (set isArchived = true)
 */
export async function deleteTeam(id: string): Promise<void> {
  // First check if team exists and is not already archived
  const existing = await prisma.team.findUnique({
    where: { id },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Team with id '${id}' not found`);
  }

  await prisma.team.update({
    where: { id },
    data: { isArchived: true },
  });
}
