/**
 * Changelog Service
 * 
 * Provides operations for recording and querying entity change history.
 * Changelogs are append-only records that track field-level changes to entities.
 */

import { prisma } from "../lib/db.js";
import type { ChangeLog } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { buildDateFilters } from "../utils/dateParser.js";

// Types for changelog operations
export interface RecordChangeInput {
  entityType: "epic" | "feature" | "task";
  entityId: string;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedBy: string;
  epicId?: string; // Optional, will be resolved if not provided
}

export interface RecordChangesInput {
  entityType: "epic" | "feature" | "task";
  entityId: string;
  changes: Array<{
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  changedBy: string;
  epicId?: string; // Optional, will be resolved if not provided
}

export interface GetEntityChangelogOptions {
  entityType: "epic" | "feature" | "task";
  entityId: string;
  cursor?: string | undefined;
  limit?: number | undefined;
  /** Filter by specific field name */
  field?: string | undefined;
  /** Filter by changedBy user ID */
  changedBy?: string | undefined;
  /** Filter by changedAt on or after this date (ISO-8601 date or duration like -P7D) */
  changedAt?: string | undefined;
  /** Filter by changedAt before this date */
  changedBefore?: string | undefined;
}

export interface GetEpicChangelogOptions {
  epicId: string;
  cursor?: string | undefined;
  limit?: number | undefined;
  /** Filter by entity type */
  entityType?: "epic" | "feature" | "task" | undefined;
  /** Filter by specific field name */
  field?: string | undefined;
  /** Filter by changedBy user ID */
  changedBy?: string | undefined;
  /** Filter by changedAt on or after this date */
  changedAt?: string | undefined;
  /** Filter by changedAt before this date */
  changedBefore?: string | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export interface ChangeLogWithContext extends ChangeLog {
  entity?: {
    type: string;
    id: string;
    identifier?: string;
    name?: string;
    title?: string;
  };
}

// Fields to skip during diff (automatically managed fields)
const SKIP_FIELDS = new Set([
  "updatedAt",
  "createdAt",
  "id",
]);

/**
 * Resolve epicId for an entity.
 * For epics, returns the epic's own ID.
 * For features, returns the feature's epicId.
 * For tasks, looks up task -> feature -> epicId.
 */
async function resolveEpicId(
  entityType: "epic" | "feature" | "task",
  entityId: string
): Promise<string> {
  if (entityType === "epic") {
    return entityId;
  }

  if (entityType === "feature") {
    const feature = await prisma.feature.findUnique({
      where: { id: entityId },
      select: { epicId: true },
    });

    if (!feature) {
      throw new NotFoundError(`Feature with id '${entityId}' not found`);
    }

    return feature.epicId;
  }

  if (entityType === "task") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: {
        feature: {
          select: { epicId: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundError(`Task with id '${entityId}' not found`);
    }

    return task.feature.epicId;
  }

  throw new ValidationError(`Invalid entity type: ${entityType}`);
}

/**
 * Record a single change to an entity.
 * Values are JSON stringified before storage.
 * If epicId is not provided, it will be resolved based on the entity type.
 * 
 * Note: This function never throws errors during write to avoid breaking
 * the operation being audited. Errors are logged and swallowed.
 */
export async function recordChange(input: RecordChangeInput): Promise<ChangeLog | null> {
  try {
    // Validate required fields
    if (!input.entityType || !["epic", "feature", "task"].includes(input.entityType)) {
      throw new ValidationError("Invalid entity type");
    }
    if (!input.entityId || input.entityId.trim() === "") {
      throw new ValidationError("Entity ID is required");
    }
    if (!input.field || input.field.trim() === "") {
      throw new ValidationError("Field name is required");
    }
    if (!input.changedBy || input.changedBy.trim() === "") {
      throw new ValidationError("changedBy is required");
    }

    // Resolve epicId if not provided
    let epicId = input.epicId;
    if (!epicId) {
      epicId = await resolveEpicId(input.entityType, input.entityId);
    }

    // Build data object
    const data: {
      entityType: string;
      entityId: string;
      field: string;
      oldValue?: string | null;
      newValue?: string | null;
      changedBy: string;
      epicId: string;
    } = {
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field.trim(),
      changedBy: input.changedBy,
      epicId,
    };

    // JSON stringify values for storage
    if (input.oldValue !== undefined) {
      data.oldValue = JSON.stringify(input.oldValue);
    }
    if (input.newValue !== undefined) {
      data.newValue = JSON.stringify(input.newValue);
    }

    return await prisma.changeLog.create({ data });
  } catch (error) {
    // Log error but don't throw - changelog writes should never break the operation
    console.error("Failed to record change:", error);
    return null;
  }
}

/**
 * Record multiple changes to an entity in a single transaction.
 * Useful for recording all field changes from a single update operation.
 * 
 * Note: This function never throws errors during write to avoid breaking
 * the operation being audited. Errors are logged and swallowed.
 */
export async function recordChanges(input: RecordChangesInput): Promise<ChangeLog[] | null> {
  try {
    // Validate required fields
    if (!input.entityType || !["epic", "feature", "task"].includes(input.entityType)) {
      throw new ValidationError("Invalid entity type");
    }
    if (!input.entityId || input.entityId.trim() === "") {
      throw new ValidationError("Entity ID is required");
    }
    if (!input.changedBy || input.changedBy.trim() === "") {
      throw new ValidationError("changedBy is required");
    }
    if (!input.changes || input.changes.length === 0) {
      throw new ValidationError("At least one change is required");
    }

    // Resolve epicId if not provided
    let epicId = input.epicId;
    if (!epicId) {
      epicId = await resolveEpicId(input.entityType, input.entityId);
    }

    // Create all changelog entries in a transaction
    const changeLogs = await prisma.$transaction(
      input.changes.map((change) => {
        const data: {
          entityType: string;
          entityId: string;
          field: string;
          oldValue?: string | null;
          newValue?: string | null;
          changedBy: string;
          epicId: string;
        } = {
          entityType: input.entityType,
          entityId: input.entityId,
          field: change.field.trim(),
          changedBy: input.changedBy,
          epicId,
        };

        // JSON stringify values for storage
        if (change.oldValue !== undefined) {
          data.oldValue = JSON.stringify(change.oldValue);
        }
        if (change.newValue !== undefined) {
          data.newValue = JSON.stringify(change.newValue);
        }

        return prisma.changeLog.create({ data });
      })
    );

    return changeLogs;
  } catch (error) {
    // Log error but don't throw - changelog writes should never break the operation
    console.error("Failed to record changes:", error);
    return null;
  }
}

/**
 * Compare two object snapshots and record changes for each modified field.
 * Automatically skips auto-managed fields (updatedAt, createdAt, id).
 * 
 * Note: This function never throws errors during write to avoid breaking
 * the operation being audited. Errors are logged and swallowed.
 */
export async function diffAndRecord(
  entityType: "epic" | "feature" | "task",
  entityId: string,
  beforeSnapshot: Record<string, unknown>,
  afterSnapshot: Record<string, unknown>,
  changedBy: string,
  epicId?: string
): Promise<ChangeLog[] | null> {
  try {
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    // Get all unique keys from both snapshots
    const allKeys = new Set([
      ...Object.keys(beforeSnapshot),
      ...Object.keys(afterSnapshot),
    ]);

    // Compare each field
    for (const key of allKeys) {
      // Skip auto-managed fields
      if (SKIP_FIELDS.has(key)) {
        continue;
      }

      const oldValue = beforeSnapshot[key];
      const newValue = afterSnapshot[key];

      // Compare values (using JSON.stringify for deep comparison)
      const oldStr = JSON.stringify(oldValue);
      const newStr = JSON.stringify(newValue);

      if (oldStr !== newStr) {
        changes.push({
          field: key,
          oldValue,
          newValue,
        });
      }
    }

    // If no changes detected, return empty array
    if (changes.length === 0) {
      return [];
    }

    // Record all changes
    const recordInput: RecordChangesInput = {
      entityType,
      entityId,
      changes,
      changedBy,
    };
    
    if (epicId) {
      recordInput.epicId = epicId;
    }
    
    return await recordChanges(recordInput);
  } catch (error) {
    // Log error but don't throw - changelog writes should never break the operation
    console.error("Failed to diff and record changes:", error);
    return null;
  }
}

/**
 * Get changelog for a specific entity with cursor-based pagination.
 * Ordered by changedAt (newest first).
 */
export async function getEntityChangelog(
  options: GetEntityChangelogOptions
): Promise<PaginatedResult<ChangeLog>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build date filters
  const dateFilterOptions: {
    createdAt?: string;
    createdBefore?: string;
  } = {};
  if (options.changedAt !== undefined) {
    dateFilterOptions.createdAt = options.changedAt;
  }
  if (options.changedBefore !== undefined) {
    dateFilterOptions.createdBefore = options.changedBefore;
  }
  const dateFilters = buildDateFilters(dateFilterOptions);

  // Build where clause
  const whereClause: {
    entityType: string;
    entityId: string;
    field?: string;
    changedBy?: string;
    changedAt?: { gte?: Date; lt?: Date };
  } = {
    entityType: options.entityType,
    entityId: options.entityId,
  };

  if (options.field !== undefined) {
    whereClause.field = options.field;
  }
  if (options.changedBy !== undefined) {
    whereClause.changedBy = options.changedBy;
  }
  if (dateFilters.createdAt !== undefined) {
    whereClause.changedAt = dateFilters.createdAt;
  }

  const changeLogs = await prisma.changeLog.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ changedAt: "desc" }, { createdAt: "desc" }],
  });

  const hasMore = changeLogs.length > limit;
  if (hasMore) {
    changeLogs.pop();
  }

  const lastLog = changeLogs.at(-1);
  const nextCursor = hasMore && lastLog ? lastLog.id : null;

  return {
    data: changeLogs,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get changelog for an epic and all its child entities (features and tasks).
 * Uses the resolved epicId field for efficient filtering.
 * Ordered by changedAt (newest first).
 */
export async function getEpicChangelog(
  options: GetEpicChangelogOptions
): Promise<PaginatedResult<ChangeLog>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build date filters
  const dateFilterOptions: {
    createdAt?: string;
    createdBefore?: string;
  } = {};
  if (options.changedAt !== undefined) {
    dateFilterOptions.createdAt = options.changedAt;
  }
  if (options.changedBefore !== undefined) {
    dateFilterOptions.createdBefore = options.changedBefore;
  }
  const dateFilters = buildDateFilters(dateFilterOptions);

  // Build where clause
  const whereClause: {
    epicId: string;
    entityType?: string;
    field?: string;
    changedBy?: string;
    changedAt?: { gte?: Date; lt?: Date };
  } = {
    epicId: options.epicId,
  };

  if (options.entityType !== undefined) {
    whereClause.entityType = options.entityType;
  }
  if (options.field !== undefined) {
    whereClause.field = options.field;
  }
  if (options.changedBy !== undefined) {
    whereClause.changedBy = options.changedBy;
  }
  if (dateFilters.createdAt !== undefined) {
    whereClause.changedAt = dateFilters.createdAt;
  }

  const changeLogs = await prisma.changeLog.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ changedAt: "desc" }, { createdAt: "desc" }],
  });

  const hasMore = changeLogs.length > limit;
  if (hasMore) {
    changeLogs.pop();
  }

  const lastLog = changeLogs.at(-1);
  const nextCursor = hasMore && lastLog ? lastLog.id : null;

  return {
    data: changeLogs,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}
