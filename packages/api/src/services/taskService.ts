import { prisma } from "../lib/db.js";
import type { Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// Types for task operations
export interface CreateTaskInput {
  title: string;
  featureId: string;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateTaskInput {
  title?: string | undefined;
  description?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  sortOrder?: number | undefined;
}

export interface ListTasksOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  featureId?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Generate a unique identifier for a task based on parent feature identifier
 * Format: FEATURE_IDENTIFIER-NUMBER (e.g., "COM-123-1", "COM-123-2")
 */
async function generateIdentifier(featureId: string): Promise<string> {
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    select: { identifier: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  // Count existing tasks for this feature
  const count = await prisma.task.count({
    where: { featureId },
  });

  return `${feature.identifier}-${String(count + 1)}`;
}

/**
 * List tasks with cursor-based pagination
 * Ordered by sortOrder (asc), then createdAt (desc)
 */
export async function listTasks(
  options: ListTasksOptions = {}
): Promise<PaginatedResult<Task>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build where clause conditionally to avoid undefined values
  const whereClause: {
    featureId?: string;
    statusId?: string;
    assigneeId?: string;
  } = {};

  if (options.featureId !== undefined) {
    whereClause.featureId = options.featureId;
  }
  if (options.statusId !== undefined) {
    whereClause.statusId = options.statusId;
  }
  if (options.assigneeId !== undefined) {
    whereClause.assigneeId = options.assigneeId;
  }

  const tasks = await prisma.task.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const hasMore = tasks.length > limit;
  if (hasMore) {
    tasks.pop();
  }

  const lastTask = tasks.at(-1);
  const nextCursor = hasMore && lastTask ? lastTask.id : null;

  return {
    data: tasks,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get a single task by ID
 */
export async function getTaskById(id: string): Promise<Task | null> {
  return prisma.task.findUnique({
    where: { id },
  });
}

/**
 * Create a new task with auto-generated identifier
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // Validate required fields
  if (!input.title || input.title.trim() === "") {
    throw new ValidationError("Title is required");
  }
  if (!input.featureId || input.featureId.trim() === "") {
    throw new ValidationError("Feature ID is required");
  }

  // Verify feature exists
  const feature = await prisma.feature.findUnique({
    where: { id: input.featureId },
    select: { id: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${input.featureId}' not found`);
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

  // Generate identifier based on parent feature
  const identifier = await generateIdentifier(input.featureId);

  // Build data object conditionally to avoid undefined values
  const data: {
    title: string;
    featureId: string;
    identifier: string;
    description?: string;
    statusId?: string;
    assigneeId?: string;
    sortOrder?: number;
  } = {
    title: input.title.trim(),
    featureId: input.featureId,
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

  return prisma.task.create({ data });
}

/**
 * Update an existing task
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  // First check if task exists
  const existing = await prisma.task.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${id}' not found`);
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

  return prisma.task.update({
    where: { id },
    data,
  });
}

/**
 * Delete a task (hard delete)
 */
export async function deleteTask(id: string): Promise<void> {
  // First check if task exists
  const existing = await prisma.task.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  await prisma.task.delete({
    where: { id },
  });
}
