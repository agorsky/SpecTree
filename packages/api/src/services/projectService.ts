import { prisma } from "../lib/db.js";
import type { Project } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// Types for project operations
export interface CreateProjectInput {
  name: string;
  teamId: string;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateProjectInput {
  name?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  color?: string | undefined;
  sortOrder?: number | undefined;
}

export interface ListProjectsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  teamId?: string | undefined;
}

export interface ProjectWithCount extends Project {
  _count: {
    features: number;
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
 * List projects with cursor-based pagination
 * Ordered by sortOrder, then createdAt
 */
export async function listProjects(
  options: ListProjectsOptions = {}
): Promise<PaginatedResult<ProjectWithCount>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build where clause conditionally to avoid undefined values
  const whereClause: { isArchived: boolean; teamId?: string } = { isArchived: false };
  if (options.teamId !== undefined) {
    whereClause.teamId = options.teamId;
  }

  const projects = await prisma.project.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
    where: whereClause,
    orderBy: [
      { sortOrder: "asc" },
      { createdAt: "desc" },
    ],
    include: { _count: { select: { features: true } } },
  }) as ProjectWithCount[];

  const hasMore = projects.length > limit;
  if (hasMore) {
    projects.pop();
  }

  const lastProject = projects.at(-1);
  const nextCursor = hasMore && lastProject ? lastProject.id : null;

  return {
    data: projects,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get a single project by ID
 */
export async function getProjectById(id: string): Promise<ProjectWithCount | null> {
  return prisma.project.findUnique({
    where: { id, isArchived: false },
    include: { _count: { select: { features: true } } },
  }) as Promise<ProjectWithCount | null>;
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  // Validate required fields
  if (!input.name || input.name.trim() === "") {
    throw new ValidationError("Name is required");
  }
  if (!input.teamId || input.teamId.trim() === "") {
    throw new ValidationError("Team ID is required");
  }

  // Verify team exists and is not archived
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, isArchived: true },
  });

  if (!team || team.isArchived) {
    throw new NotFoundError(`Team with id '${input.teamId}' not found`);
  }

  // Build data object conditionally to avoid undefined values
  const data: {
    name: string;
    teamId: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  } = {
    name: input.name.trim(),
    teamId: input.teamId,
  };

  if (input.description !== undefined) {
    data.description = input.description.trim();
  }
  if (input.icon !== undefined) {
    data.icon = input.icon.trim();
  }
  if (input.color !== undefined) {
    data.color = input.color.trim();
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }

  return prisma.project.create({ data });
}

/**
 * Update an existing project
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<Project> {
  // First check if project exists and is not archived
  const existing = await prisma.project.findUnique({
    where: { id },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Project with id '${id}' not found`);
  }

  // Validate fields if provided
  if (input.name?.trim() === "") {
    throw new ValidationError("Name cannot be empty");
  }

  // Build data object conditionally to avoid undefined values
  const data: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  } = {};

  if (input.name !== undefined) {
    data.name = input.name.trim();
  }
  if (input.description !== undefined) {
    data.description = input.description.trim();
  }
  if (input.icon !== undefined) {
    data.icon = input.icon.trim();
  }
  if (input.color !== undefined) {
    data.color = input.color.trim();
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }

  return prisma.project.update({
    where: { id },
    data,
  });
}

/**
 * Soft delete a project (set isArchived = true)
 */
export async function deleteProject(id: string): Promise<void> {
  // First check if project exists and is not already archived
  const existing = await prisma.project.findUnique({
    where: { id },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Project with id '${id}' not found`);
  }

  await prisma.project.update({
    where: { id },
    data: { isArchived: true },
  });
}
