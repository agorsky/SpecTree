import { prisma } from "../lib/db.js";
import type { Feature, Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// Types for feature operations
export interface CreateFeatureInput {
  title: string;
  projectId: string;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateFeatureInput {
  title?: string | undefined;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  sortOrder?: number | undefined;
}

export interface ListFeaturesOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  projectId?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
}

export interface FeatureWithCount extends Feature {
  _count: {
    tasks: number;
  };
}

export interface FeatureWithTasks extends Feature {
  tasks: Task[];
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Generate a unique identifier for a feature based on team key
 * Format: TEAM_KEY-NUMBER (e.g., "COM-123")
 */
async function generateIdentifier(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: true },
  });

  if (!project) {
    throw new NotFoundError(`Project with id '${projectId}' not found`);
  }

  const teamKey = project.team.key;

  // Count existing features in projects belonging to this team
  const count = await prisma.feature.count({
    where: {
      project: { teamId: project.teamId },
    },
  });

  return `${teamKey}-${String(count + 1)}`;
}

/**
 * List features with cursor-based pagination
 * Ordered by sortOrder (asc), then createdAt (desc)
 */
export async function listFeatures(
  options: ListFeaturesOptions = {}
): Promise<PaginatedResult<FeatureWithCount>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build where clause conditionally to avoid undefined values
  const whereClause: {
    projectId?: string;
    statusId?: string;
    assigneeId?: string;
  } = {};

  if (options.projectId !== undefined) {
    whereClause.projectId = options.projectId;
  }
  if (options.statusId !== undefined) {
    whereClause.statusId = options.statusId;
  }
  if (options.assigneeId !== undefined) {
    whereClause.assigneeId = options.assigneeId;
  }

  const features = (await prisma.feature.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { tasks: true } } },
  })) as FeatureWithCount[];

  const hasMore = features.length > limit;
  if (hasMore) {
    features.pop();
  }

  const lastFeature = features.at(-1);
  const nextCursor = hasMore && lastFeature ? lastFeature.id : null;

  return {
    data: features,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get a single feature by ID with nested tasks
 */
export async function getFeatureById(id: string): Promise<FeatureWithTasks | null> {
  return prisma.feature.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  }) as Promise<FeatureWithTasks | null>;
}

/**
 * Create a new feature with auto-generated identifier
 */
export async function createFeature(input: CreateFeatureInput): Promise<Feature> {
  // Validate required fields
  if (!input.title || input.title.trim() === "") {
    throw new ValidationError("Title is required");
  }
  if (!input.projectId || input.projectId.trim() === "") {
    throw new ValidationError("Project ID is required");
  }

  // Verify project exists and is not archived
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, isArchived: true },
  });

  if (!project || project.isArchived) {
    throw new NotFoundError(`Project with id '${input.projectId}' not found`);
  }

  // Verify status exists if provided
  if (input.statusId !== undefined) {
    const status = await prisma.status.findUnique({
      where: { id: input.statusId },
      select: { id: true },
    });
    if (!status) {
      throw new NotFoundError(`Status with id '${input.statusId}' not found`);
    }
  }

  // Verify assignee exists and is active if provided
  if (input.assigneeId) {
    const user = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) {
      throw new NotFoundError(`User with id '${input.assigneeId}' not found`);
    }
  }

  // Generate identifier
  const identifier = await generateIdentifier(input.projectId);

  // Build data object conditionally to avoid undefined values
  const data: {
    title: string;
    projectId: string;
    identifier: string;
    description?: string;
    statusId?: string;
    assigneeId?: string;
    sortOrder?: number;
  } = {
    title: input.title.trim(),
    projectId: input.projectId,
    identifier,
  };

  if (input.description !== undefined) {
    data.description = input.description.trim();
  }
  if (input.statusId !== undefined) {
    data.statusId = input.statusId;
  }
  if (input.assigneeId !== undefined) {
    data.assigneeId = input.assigneeId;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }

  return prisma.feature.create({ data });
}

/**
 * Update an existing feature
 */
export async function updateFeature(
  id: string,
  input: UpdateFeatureInput
): Promise<Feature> {
  // First check if feature exists
  const existing = await prisma.feature.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  // Validate fields if provided
  if (input.title?.trim() === "") {
    throw new ValidationError("Title cannot be empty");
  }

  // Verify status exists if provided
  if (input.statusId) {
    const status = await prisma.status.findUnique({
      where: { id: input.statusId },
      select: { id: true },
    });
    if (!status) {
      throw new NotFoundError(`Status with id '${input.statusId}' not found`);
    }
  }

  // Verify assignee exists and is active if provided
  if (input.assigneeId) {
    const user = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) {
      throw new NotFoundError(`User with id '${input.assigneeId}' not found`);
    }
  }

  // Build data object conditionally to avoid undefined values
  const data: {
    title?: string;
    description?: string;
    statusId?: string;
    assigneeId?: string;
    sortOrder?: number;
  } = {};

  if (input.title !== undefined) {
    data.title = input.title.trim();
  }
  if (input.description !== undefined) {
    data.description = input.description.trim();
  }
  if (input.statusId !== undefined) {
    data.statusId = input.statusId;
  }
  if (input.assigneeId !== undefined) {
    data.assigneeId = input.assigneeId;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }

  return prisma.feature.update({
    where: { id },
    data,
  });
}

/**
 * Delete a feature (hard delete - cascade will remove tasks)
 */
export async function deleteFeature(id: string): Promise<void> {
  // First check if feature exists
  const existing = await prisma.feature.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  await prisma.feature.delete({
    where: { id },
  });
}
