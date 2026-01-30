import { prisma } from "../lib/db.js";
import type { Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { buildDateFilters } from "../utils/dateParser.js";
import {
  resolveAssigneeId,
  isAssigneeNone,
  isAssigneeInvalid,
} from "../utils/assignee.js";
import {
  resolveStatusesToIds,
  getStatusIdsByCategory,
  getDefaultBacklogStatus,
} from "./statusService.js";
import { emitStatusChanged } from "../events/index.js";
import { getAccessibleScopes, hasAccessibleScopes } from "../utils/scopeContext.js";

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

export type TaskOrderBy = 'sortOrder' | 'createdAt' | 'updatedAt';

export interface ListTasksOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  featureId?: string | undefined;
  /** Filter by epic ID (returns tasks across all features in the epic) */
  epicId?: string | undefined;
  /** @deprecated Use `status` instead for enhanced filtering */
  statusId?: string | undefined;
  /** Status filter - can be ID or name (single or array) */
  status?: string | string[] | undefined;
  /** Filter by status category (backlog, unstarted, started, completed, canceled) */
  statusCategory?: string | undefined;
  /** @deprecated Use `assignee` instead for enhanced filtering */
  assigneeId?: string | undefined;
  /** Assignee filter - supports "me", "none", email, or UUID */
  assignee?: string | undefined;
  /** Current user ID - required for resolving "me" assignee filter */
  currentUserId?: string | undefined;
  orderBy?: TaskOrderBy | undefined;
  query?: string | undefined;
  /** Filter by createdAt on or after this date (ISO-8601 date or duration like -P7D) */
  createdAt?: string | undefined;
  /** Filter by createdAt before this date (ISO-8601 date or duration like -P7D) */
  createdBefore?: string | undefined;
  /** Filter by updatedAt on or after this date (ISO-8601 date or duration like -P7D) */
  updatedAt?: string | undefined;
  /** Filter by updatedAt before this date (ISO-8601 date or duration like -P7D) */
  updatedBefore?: string | undefined;
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
 * 
 * Uses MAX(identifier suffix) + 1 to avoid race conditions when multiple
 * tasks are created concurrently for the same feature.
 */
async function generateIdentifier(featureId: string): Promise<string> {
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    select: { identifier: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  // Find the highest existing task number for this feature
  // Using MAX on identifier suffix to get the true highest number
  const existingTasks = await prisma.task.findMany({
    where: { featureId },
    select: { identifier: true },
    orderBy: { createdAt: 'desc' },
  });

  let maxNumber = 0;
  const prefix = `${feature.identifier}-`;
  
  for (const task of existingTasks) {
    if (task.identifier.startsWith(prefix)) {
      const suffix = task.identifier.slice(prefix.length);
      const num = parseInt(suffix, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `${feature.identifier}-${maxNumber + 1}`;
}

/**
 * List tasks with cursor-based pagination
 * Ordered by sortOrder (asc), then createdAt (desc)
 * When currentUserId is provided, filters to only show tasks in accessible scopes
 */
export async function listTasks(
  options: ListTasksOptions = {}
): Promise<PaginatedResult<Task>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build date filters from options (only include defined values)
  const dateFilterOptions: {
    createdAt?: string;
    createdBefore?: string;
    updatedAt?: string;
    updatedBefore?: string;
  } = {};
  if (options.createdAt !== undefined) {
    dateFilterOptions.createdAt = options.createdAt;
  }
  if (options.createdBefore !== undefined) {
    dateFilterOptions.createdBefore = options.createdBefore;
  }
  if (options.updatedAt !== undefined) {
    dateFilterOptions.updatedAt = options.updatedAt;
  }
  if (options.updatedBefore !== undefined) {
    dateFilterOptions.updatedBefore = options.updatedBefore;
  }
  const dateFilters = buildDateFilters(dateFilterOptions);

  // Build where clause conditionally to avoid undefined values
  const whereClause: {
    featureId?: string;
    feature?: {
      epicId?: string;
      epic?: {
        OR?: Array<{ teamId?: { in: string[] }; personalScopeId?: string }>;
      };
    };
    statusId?: string | { in: string[] };
    assigneeId?: string | null;
    createdAt?: { gte?: Date; lt?: Date };
    updatedAt?: { gte?: Date; lt?: Date };
    OR?: {
      title?: { contains: string };
      description?: { contains: string };
    }[];
  } = {};

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

    // Build OR clause for epics in accessible scopes (via feature → epic)
    const scopeConditions: Array<{ teamId?: { in: string[] }; personalScopeId?: string }> = [];

    if (accessibleScopes.teamIds.length > 0) {
      scopeConditions.push({ teamId: { in: accessibleScopes.teamIds } });
    }
    if (accessibleScopes.personalScopeId) {
      scopeConditions.push({ personalScopeId: accessibleScopes.personalScopeId });
    }

    whereClause.feature = { epic: { OR: scopeConditions } };
  }

  if (options.featureId !== undefined) {
    whereClause.featureId = options.featureId;
  }

  // Filter by epic (returns tasks across all features in the epic)
  if (options.epicId !== undefined) {
    // Merge with existing feature filter if scope filtering applied
    if (whereClause.feature) {
      whereClause.feature.epicId = options.epicId;
    } else {
      whereClause.feature = { epicId: options.epicId };
    }
  }

  // Handle status filtering (supports statusId, status name/array, and statusCategory)
  if (options.statusId !== undefined) {
    whereClause.statusId = options.statusId;
  } else if (options.status !== undefined) {
    // Normalize to array (status can be single string or array)
    const statusValues = Array.isArray(options.status) ? options.status : [options.status];
    const statusIds = await resolveStatusesToIds(statusValues);
    if (statusIds.length === 0) {
      // No matching statuses found - return empty result
      return { data: [], meta: { cursor: null, hasMore: false } };
    }
    whereClause.statusId = { in: statusIds };
  } else if (options.statusCategory !== undefined) {
    const statusIds = await getStatusIdsByCategory(options.statusCategory);
    if (statusIds.length === 0) {
      // No matching statuses found - return empty result
      return { data: [], meta: { cursor: null, hasMore: false } };
    }
    whereClause.statusId = { in: statusIds };
  }

  // Handle assignee filtering with enhanced resolution
  if (options.assignee !== undefined) {
    const resolvedAssignee = await resolveAssigneeId(options.assignee, options.currentUserId);
    if (isAssigneeInvalid(resolvedAssignee)) {
      // Invalid assignee - return empty result (not an error per requirements)
      return { data: [], meta: { cursor: null, hasMore: false } };
    }
    if (isAssigneeNone(resolvedAssignee)) {
      // Filter for unassigned items (null assigneeId)
      whereClause.assigneeId = null;
    } else {
      // Use the resolved user ID
      whereClause.assigneeId = resolvedAssignee;
    }
  } else if (options.assigneeId !== undefined) {
    // Legacy support for direct assigneeId
    whereClause.assigneeId = options.assigneeId;
  }

  if (options.query !== undefined && options.query.trim() !== "") {
    // Note: SQL Server is case-insensitive by default with most collations
    // so we don't need the mode: "insensitive" option (which is PostgreSQL-specific)
    whereClause.OR = [
      { title: { contains: options.query } },
      { description: { contains: options.query } },
    ];
  }

  // Apply date filters
  if (dateFilters.createdAt !== undefined) {
    whereClause.createdAt = dateFilters.createdAt;
  }
  if (dateFilters.updatedAt !== undefined) {
    whereClause.updatedAt = dateFilters.updatedAt;
  }

  // Determine order by field
  const orderByField = options.orderBy ?? 'sortOrder';
  const orderBy = orderByField === 'sortOrder'
    ? [{ sortOrder: "asc" as const }, { identifier: "asc" as const }]
    : [{ [orderByField]: "desc" as const }];

  const tasks = await prisma.task.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy,
    include: {
      status: true,
      assignee: true,
      feature: {
        select: {
          id: true,
          identifier: true,
          title: true,
        },
      },
    },
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
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Get a single task by ID or identifier.
 * Supports both UUID (e.g., "550e8400-e29b-41d4-a716-446655440000") and
 * identifier (e.g., "ENG-4-1") lookups.
 */
export async function getTaskById(idOrIdentifier: string): Promise<Task | null> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  return prisma.task.findFirst({
    where: isUuid
      ? { id: idOrIdentifier }
      : { identifier: idOrIdentifier },
  });
}

/**
 * Create a new task with auto-generated identifier.
 * Defaults to "Backlog" status if no status is provided.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // Validate required fields
  if (!input.title || input.title.trim() === "") {
    throw new ValidationError("Title is required");
  }
  if (!input.featureId || input.featureId.trim() === "") {
    throw new ValidationError("Feature ID is required");
  }

  // Verify feature exists and get teamId for status lookup
  const feature = await prisma.feature.findUnique({
    where: { id: input.featureId },
    select: { 
      id: true, 
      epic: { 
        select: { teamId: true } 
      } 
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${input.featureId}' not found`);
  }

  // Determine statusId: use provided, or default to Backlog
  let statusId = input.statusId;
  if (statusId !== undefined) {
    // Verify provided status exists
    const status = await prisma.status.findUnique({
      where: { id: statusId },
      select: { id: true },
    });
    if (!status) {
      throw new NotFoundError(`Status with id '${statusId}' not found`);
    }
  } else if (feature.epic.teamId) {
    // Default to Backlog status for the team
    const backlogStatus = await getDefaultBacklogStatus(feature.epic.teamId);
    if (backlogStatus) {
      statusId = backlogStatus.id;
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

  // Auto-generate sortOrder if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const lastTask = await prisma.task.findFirst({
      where: { featureId: input.featureId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = generateSortOrderBetween(lastTask?.sortOrder ?? null, null);
  }

  // Retry loop to handle concurrent task creation (unique constraint on identifier)
  const maxRetries = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Generate identifier based on parent feature (re-generate on retry)
      const identifier = await generateIdentifier(input.featureId);

      // Build data object conditionally to avoid undefined values
      const data: {
        title: string;
        featureId: string;
        identifier: string;
        sortOrder: number;
        description?: string;
        statusId?: string;
        assigneeId?: string;
      } = {
        title: input.title.trim(),
        featureId: input.featureId,
        identifier,
        sortOrder,
      };

      if (input.description !== undefined) {
        data.description = input.description.trim();
      }
      if (statusId !== undefined) {
        data.statusId = statusId;
      }
      if (input.assigneeId !== undefined) {
        data.assigneeId = input.assigneeId;
      }

      return await prisma.task.create({ data });
    } catch (error) {
      lastError = error;
      // Check if this is a unique constraint error on identifier
      const isUniqueConstraintError = 
        error instanceof Error && 
        (error.message.includes('Unique constraint') || 
         error.message.includes('unique constraint') ||
         error.message.includes('duplicate key'));
      
      if (!isUniqueConstraintError || attempt === maxRetries - 1) {
        throw error;
      }
      // Small delay before retry to reduce collision likelihood
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }

  throw lastError;
}

/**
 * Update an existing task
 */
export async function updateTask(
  idOrIdentifier: string,
  input: UpdateTaskInput
): Promise<Task> {
  // Resolve identifier to UUID if needed
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  
  // First check if task exists
  const existing = await prisma.task.findFirst({
    where: isUuid
      ? { id: idOrIdentifier }
      : { identifier: idOrIdentifier },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${idOrIdentifier}' not found`);
  }

  // Use the actual UUID for all subsequent operations
  const id = existing.id;

  // Validate fields if provided
  if (input.title?.trim() === "") {
    throw new ValidationError("Title cannot be empty");
  }

  // Verify status exists and belongs to the same team if provided
  if (input.statusId) {
    const status = await prisma.status.findUnique({
      where: { id: input.statusId },
      select: { id: true, teamId: true },
    });
    if (!status) {
      throw new NotFoundError(`Status with id '${input.statusId}' not found`);
    }

    // Fetch the task with its feature and epic to get the team
    const taskWithFeatureProject = await prisma.task.findUnique({
      where: { id },
      include: { feature: { include: { epic: { select: { teamId: true } } } } },
    });

    if (taskWithFeatureProject && status.teamId !== taskWithFeatureProject.feature.epic.teamId) {
      throw new ValidationError("Cannot change status: status belongs to a different team");
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

  // Track old status for event emission
  const oldStatusId = existing.statusId;

  const updatedTask = await prisma.task.update({
    where: { id },
    data,
  });

  // Emit status changed event if status was updated
  if (input.statusId !== undefined && input.statusId !== oldStatusId) {
    emitStatusChanged({
      entityType: "task",
      entityId: id,
      oldStatusId,
      newStatusId: input.statusId,
      timestamp: new Date(),
    });
  }

  return updatedTask;
}

/**
 * Delete a task (hard delete)
 */
export async function deleteTask(idOrIdentifier: string): Promise<void> {
  // Resolve identifier to UUID if needed
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  
  // First check if task exists
  const existing = await prisma.task.findFirst({
    where: isUuid
      ? { id: idOrIdentifier }
      : { identifier: idOrIdentifier },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${idOrIdentifier}' not found`);
  }

  await prisma.task.delete({
    where: { id: existing.id },
  });
}
