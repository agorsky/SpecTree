import { prisma } from "../lib/db.js";
import type { Project } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { getAccessibleScopes, hasAccessibleScopes } from "../utils/scopeContext.js";

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

export type ProjectOrderBy = 'sortOrder' | 'createdAt' | 'updatedAt';

export interface ListProjectsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  teamId?: string | undefined;
  orderBy?: ProjectOrderBy | undefined;
  /** Current user ID - when provided, filters to only show projects in accessible scopes */
  currentUserId?: string | undefined;
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
 * When currentUserId is provided, filters to only show projects in accessible scopes
 */
export async function listProjects(
  options: ListProjectsOptions = {}
): Promise<PaginatedResult<ProjectWithCount>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build where clause conditionally to avoid undefined values
  const whereClause: {
    isArchived: boolean;
    teamId?: string;
    OR?: Array<{ teamId?: { in: string[] }; personalScopeId?: string | { in: string[] } }>;
  } = { isArchived: false };

  // Apply scope-based filtering when currentUserId is provided
  if (options.currentUserId) {
    const accessibleScopes = await getAccessibleScopes(options.currentUserId);

    // If user has no accessible scopes, return empty result
    if (!hasAccessibleScopes(accessibleScopes)) {
      return {
        data: [],
        meta: { cursor: null, hasMore: false },
      };
    }

    // Build OR clause for accessible scopes
    const scopeConditions: Array<{ teamId?: { in: string[] }; personalScopeId?: string }> = [];

    if (accessibleScopes.teamIds.length > 0) {
      scopeConditions.push({ teamId: { in: accessibleScopes.teamIds } });
    }
    if (accessibleScopes.personalScopeId) {
      scopeConditions.push({ personalScopeId: accessibleScopes.personalScopeId });
    }

    whereClause.OR = scopeConditions;
  }

  // If teamId filter is provided, apply it (overrides scope filter for specific team queries)
  if (options.teamId !== undefined) {
    // When teamId is explicitly provided, use it directly
    // The scope filter above already ensures user can only see their accessible projects
    // But if explicitly requesting a team, we filter to just that team
    delete whereClause.OR;
    whereClause.teamId = options.teamId;
  }

  // Determine order by field
  const orderByField = options.orderBy ?? 'sortOrder';
  const orderBy = orderByField === 'sortOrder'
    ? [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }]
    : [{ [orderByField]: "desc" as const }];

  const projects = await prisma.project.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
    where: whereClause,
    orderBy,
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
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Get a single project by ID or name.
 * Supports both UUID (e.g., "550e8400-e29b-41d4-a716-446655440000") and
 * exact project name (case-sensitive) lookups.
 */
export async function getProjectById(idOrName: string): Promise<ProjectWithCount | null> {
  const isUuid = UUID_REGEX.test(idOrName);
  return prisma.project.findFirst({
    where: isUuid
      ? { id: idOrName, isArchived: false }
      : { name: idOrName, isArchived: false },
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

  // Auto-generate sortOrder if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const lastProject = await prisma.project.findFirst({
      where: { teamId: input.teamId, isArchived: false },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = generateSortOrderBetween(lastProject?.sortOrder ?? null, null);
  }

  // Build data object conditionally to avoid undefined values
  const data: {
    name: string;
    teamId: string;
    sortOrder: number;
    description?: string;
    icon?: string;
    color?: string;
  } = {
    name: input.name.trim(),
    teamId: input.teamId,
    sortOrder,
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

  return prisma.project.create({ data });
}

/**
 * Update an existing project.
 * Supports both UUID and exact project name lookups.
 */
export async function updateProject(
  idOrName: string,
  input: UpdateProjectInput
): Promise<Project> {
  // First check if project exists and is not archived
  const isUuid = UUID_REGEX.test(idOrName);
  const existing = await prisma.project.findFirst({
    where: isUuid
      ? { id: idOrName }
      : { name: idOrName },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Project with id '${idOrName}' not found`);
  }

  // Use the resolved UUID for the update
  const id = existing.id;

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
 * Soft delete a project (set isArchived = true).
 * Supports both UUID and exact project name lookups.
 */
export async function deleteProject(idOrName: string): Promise<void> {
  // First check if project exists and is not already archived
  const isUuid = UUID_REGEX.test(idOrName);
  const existing = await prisma.project.findFirst({
    where: isUuid
      ? { id: idOrName }
      : { name: idOrName },
  });

  if (!existing || existing.isArchived) {
    throw new NotFoundError(`Project with id '${idOrName}' not found`);
  }

  await prisma.project.update({
    where: { id: existing.id },
    data: { isArchived: true },
  });
}
