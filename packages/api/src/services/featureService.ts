import { prisma } from "../lib/db.js";
import type { Feature, Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { buildDateFilters } from "../utils/dateParser.js";
import {
  resolveStatusesToIds,
  getStatusIdsByCategory,
  getDefaultBacklogStatus,
} from "./statusService.js";
import {
  resolveAssigneeId,
  isAssigneeNone,
  isAssigneeInvalid,
} from "../utils/assignee.js";
import { emitStatusChanged } from "../events/index.js";
import { getAccessibleScopes, hasAccessibleScopes } from "../utils/scopeContext.js";

// Types for feature operations
export interface CreateFeatureInput {
  title: string;
  epicId: string;
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

export type FeatureOrderBy = 'sortOrder' | 'createdAt' | 'updatedAt';

export interface ListFeaturesOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  epicId?: string | undefined;
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
  orderBy?: FeatureOrderBy | undefined;
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

export interface FeatureWithCount extends Feature {
  _count: {
    tasks: number;
  };
  completedTaskCount: number;
}

export interface FeatureWithTasks extends Feature {
  tasks: Task[];
  epic: {
    id: string;
    teamId: string;
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
 * Generate a unique identifier for a feature based on team key
 * Format: TEAM_KEY-NUMBER (e.g., "COM-123")
 */
async function generateIdentifier(epicId: string): Promise<string> {
  const epic = await prisma.epic.findUnique({
    where: { id: epicId },
    include: { team: true },
  });

  if (!epic) {
    throw new NotFoundError(`Epic with id '${epicId}' not found`);
  }

  if (!epic.team) {
    throw new Error(`Epic with id '${epicId}' has no associated team`);
  }

  const teamKey = epic.team.key;

  // Count existing features in epics belonging to this team
  const count = await prisma.feature.count({
    where: {
      epic: { teamId: epic.teamId },
    },
  });

  return `${teamKey}-${String(count + 1)}`;
}

/**
 * List features with cursor-based pagination
 * Ordered by sortOrder (asc), then createdAt (desc)
 * When currentUserId is provided, filters to only show features in accessible scopes
 */
export async function listFeatures(
  options: ListFeaturesOptions = {}
): Promise<PaginatedResult<FeatureWithCount>> {
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
    epicId?: string;
    epic?: {
      OR?: Array<{ teamId?: { in: string[] }; personalScopeId?: string }>;
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

    // Build OR clause for epics in accessible scopes
    const scopeConditions: Array<{ teamId?: { in: string[] }; personalScopeId?: string }> = [];

    if (accessibleScopes.teamIds.length > 0) {
      scopeConditions.push({ teamId: { in: accessibleScopes.teamIds } });
    }
    if (accessibleScopes.personalScopeId) {
      scopeConditions.push({ personalScopeId: accessibleScopes.personalScopeId });
    }

    whereClause.epic = { OR: scopeConditions };
  }

  if (options.epicId !== undefined) {
    whereClause.epicId = options.epicId;
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
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy support for direct assigneeId
  } else if (options.assigneeId !== undefined) {
    // Legacy support for direct assigneeId
    // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    ? [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }]
    : [{ [orderByField]: "desc" as const }];

  // First, get features with total task count and status info
  const featuresRaw = await prisma.feature.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy,
    include: {
      _count: { select: { tasks: true } },
      status: true,
      assignee: true,
    },
  });

  // Get completed task counts efficiently via a separate query
  const featureIds = featuresRaw.map((f) => f.id);
  const completedCounts = await prisma.task.groupBy({
    by: ["featureId"],
    where: {
      featureId: { in: featureIds },
      status: { category: "completed" },
    },
    _count: { id: true },
  });

  // Create a map for quick lookup
  const completedCountMap = new Map(
    completedCounts.map((c) => [c.featureId, c._count.id])
  );

  // Merge completed counts into features
  const features = featuresRaw.map((f) => ({
    ...f,
    completedTaskCount: completedCountMap.get(f.id) ?? 0,
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
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feature identifier pattern (e.g., "ENG-123")
 */
const IDENTIFIER_REGEX = /^[A-Z]+-\d+$/i;

/**
 * Get a single feature by ID, identifier, or title with nested tasks.
 * Supports UUID (e.g., "550e8400-e29b-41d4-a716-446655440000"),
 * identifier (e.g., "ENG-4"), or exact title (case-sensitive) lookups.
 */
export async function getFeatureById(idOrIdentifierOrTitle: string): Promise<FeatureWithTasks | null> {
  const isUuid = UUID_REGEX.test(idOrIdentifierOrTitle);
  const isIdentifier = IDENTIFIER_REGEX.test(idOrIdentifierOrTitle);
  
  // Determine lookup strategy: UUID > identifier > title
  const whereClause = isUuid
    ? { id: idOrIdentifierOrTitle }
    : isIdentifier
      ? { identifier: idOrIdentifierOrTitle }
      : { title: idOrIdentifierOrTitle };

  return prisma.feature.findFirst({
    where: whereClause,
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      epic: {
        select: {
          id: true,
          teamId: true,
        },
      },
    },
  }) as Promise<FeatureWithTasks | null>;
}

/**
 * Create a new feature with auto-generated identifier.
 * Defaults to "Backlog" status if no status is provided.
 */
export async function createFeature(input: CreateFeatureInput): Promise<Feature> {
  // Validate required fields
  if (!input.title || input.title.trim() === "") {
    throw new ValidationError("Title is required");
  }
  if (!input.epicId || input.epicId.trim() === "") {
    throw new ValidationError("Epic ID is required");
  }

  // Verify epic exists and is not archived, get teamId for status lookup
  const epic = await prisma.epic.findUnique({
    where: { id: input.epicId },
    select: { id: true, isArchived: true, teamId: true },
  });

  if (!epic || epic.isArchived) {
    throw new NotFoundError(`Epic with id '${input.epicId}' not found`);
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
  } else if (project.teamId) {
    // Default to Backlog status for the team
    const backlogStatus = await getDefaultBacklogStatus(epic.teamId);
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

  // Generate identifier
  const identifier = await generateIdentifier(input.epicId);

  // Auto-generate sortOrder if not provided
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const lastFeature = await prisma.feature.findFirst({
      where: { epicId: input.epicId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    sortOrder = generateSortOrderBetween(lastFeature?.sortOrder ?? null, null);
  }

  // Build data object conditionally to avoid undefined values
  const data: {
    title: string;
    epicId: string;
    identifier: string;
    sortOrder: number;
    description?: string;
    statusId?: string;
    assigneeId?: string;
  } = {
    title: input.title.trim(),
    epicId: input.epicId,
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

  return prisma.feature.create({ data });
}

/**
 * Update an existing feature.
 * Supports UUID, identifier (e.g., "ENG-4"), or exact title lookups.
 */
export async function updateFeature(
  idOrIdentifierOrTitle: string,
  input: UpdateFeatureInput
): Promise<Feature> {
  // Resolve to UUID using same logic as getFeatureById
  const isUuid = UUID_REGEX.test(idOrIdentifierOrTitle);
  const isIdentifier = IDENTIFIER_REGEX.test(idOrIdentifierOrTitle);
  
  const whereClause = isUuid
    ? { id: idOrIdentifierOrTitle }
    : isIdentifier
      ? { identifier: idOrIdentifierOrTitle }
      : { title: idOrIdentifierOrTitle };
  
  // First check if feature exists
  const existing = await prisma.feature.findFirst({
    where: whereClause,
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${idOrIdentifierOrTitle}' not found`);
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

    // Fetch the feature with its epic to get the team
    const featureWithEpic = await prisma.feature.findUnique({
      where: { id },
      include: { epic: { select: { teamId: true } } },
    });

    if (featureWithEpic && status.teamId !== featureWithEpic.epic.teamId) {
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

  const updatedFeature = await prisma.feature.update({
    where: { id },
    data,
  });

  // Emit status changed event if status was updated
  if (input.statusId !== undefined && input.statusId !== oldStatusId) {
    emitStatusChanged({
      entityType: "feature",
      entityId: id,
      oldStatusId,
      newStatusId: input.statusId,
      timestamp: new Date(),
    });
  }

  return updatedFeature;
}

/**
 * Delete a feature (hard delete - cascade will remove tasks).
 * Supports UUID, identifier (e.g., "ENG-4"), or exact title lookups.
 */
export async function deleteFeature(idOrIdentifierOrTitle: string): Promise<void> {
  // Resolve to UUID using same logic as getFeatureById
  const isUuid = UUID_REGEX.test(idOrIdentifierOrTitle);
  const isIdentifier = IDENTIFIER_REGEX.test(idOrIdentifierOrTitle);
  
  const whereClause = isUuid
    ? { id: idOrIdentifierOrTitle }
    : isIdentifier
      ? { identifier: idOrIdentifierOrTitle }
      : { title: idOrIdentifierOrTitle };
  
  // First check if feature exists
  const existing = await prisma.feature.findFirst({
    where: whereClause,
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${idOrIdentifierOrTitle}' not found`);
  }

  await prisma.feature.delete({
    where: { id: existing.id },
  });
}
