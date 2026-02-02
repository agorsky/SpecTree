/**
 * Decision Service
 * 
 * Provides CRUD operations for the Decision model.
 * Decisions are append-only records that preserve the rationale behind implementation choices.
 */

import { prisma } from "../lib/db.js";
import type { Decision } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { buildDateFilters } from "../utils/dateParser.js";

// Types for decision operations
export interface CreateDecisionInput {
  epicId: string;
  featureId?: string | undefined;
  taskId?: string | undefined;
  question: string;
  decision: string;
  rationale: string;
  alternatives?: string[] | undefined;
  madeBy?: string | undefined;
  category?: string | undefined;
  impact?: string | undefined;
}

export interface ListDecisionsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  epicId?: string | undefined;
  featureId?: string | undefined;
  taskId?: string | undefined;
  category?: string | undefined;
  impact?: string | undefined;
  /** Filter by createdAt on or after this date (ISO-8601 date or duration like -P7D) */
  createdAt?: string | undefined;
  /** Filter by createdAt before this date */
  createdBefore?: string | undefined;
}

export interface SearchDecisionsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  query: string;
  epicId?: string | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export interface DecisionWithContext extends Decision {
  epic: {
    id: string;
    name: string;
  };
  feature?: {
    id: string;
    identifier: string;
    title: string;
  } | null;
  task?: {
    id: string;
    identifier: string;
    title: string;
  } | null;
}

/**
 * Create a new decision record.
 * Decisions are append-only - once created, they cannot be modified.
 */
export async function createDecision(input: CreateDecisionInput): Promise<Decision> {
  // Validate required fields
  if (!input.question || input.question.trim() === "") {
    throw new ValidationError("Question is required");
  }
  if (!input.decision || input.decision.trim() === "") {
    throw new ValidationError("Decision is required");
  }
  if (!input.rationale || input.rationale.trim() === "") {
    throw new ValidationError("Rationale is required");
  }

  // Verify epic exists
  const epic = await prisma.epic.findUnique({
    where: { id: input.epicId },
    select: { id: true, isArchived: true },
  });

  if (!epic) {
    throw new NotFoundError(`Epic with id '${input.epicId}' not found`);
  }

  if (epic.isArchived) {
    throw new ValidationError("Cannot add decisions to an archived epic");
  }

  // Verify feature exists if provided
  if (input.featureId) {
    const feature = await prisma.feature.findUnique({
      where: { id: input.featureId },
      select: { id: true, epicId: true },
    });

    if (!feature) {
      throw new NotFoundError(`Feature with id '${input.featureId}' not found`);
    }

    // Verify feature belongs to the specified epic
    if (feature.epicId !== input.epicId) {
      throw new ValidationError("Feature does not belong to the specified epic");
    }
  }

  // Verify task exists if provided
  if (input.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { id: true, featureId: true, feature: { select: { epicId: true } } },
    });

    if (!task) {
      throw new NotFoundError(`Task with id '${input.taskId}' not found`);
    }

    // Verify task belongs to the specified epic (via feature)
    if (task.feature.epicId !== input.epicId) {
      throw new ValidationError("Task does not belong to the specified epic");
    }

    // If featureId was provided, verify task belongs to that feature
    if (input.featureId && task.featureId !== input.featureId) {
      throw new ValidationError("Task does not belong to the specified feature");
    }
  }

  // Build data object
  const data: {
    epicId: string;
    featureId?: string;
    taskId?: string;
    question: string;
    decision: string;
    rationale: string;
    alternatives?: string;
    madeBy: string;
    category?: string;
    impact?: string;
  } = {
    epicId: input.epicId,
    question: input.question.trim(),
    decision: input.decision.trim(),
    rationale: input.rationale.trim(),
    madeBy: input.madeBy ?? "AI",
  };

  if (input.featureId !== undefined) {
    data.featureId = input.featureId;
  }
  if (input.taskId !== undefined) {
    data.taskId = input.taskId;
  }
  if (input.alternatives !== undefined && input.alternatives.length > 0) {
    data.alternatives = JSON.stringify(input.alternatives);
  }
  if (input.category !== undefined) {
    data.category = input.category;
  }
  if (input.impact !== undefined) {
    data.impact = input.impact;
  }

  return prisma.decision.create({ data });
}

/**
 * Get a single decision by ID with related context.
 */
export async function getDecisionById(id: string): Promise<DecisionWithContext | null> {
  return prisma.decision.findUnique({
    where: { id },
    include: {
      epic: {
        select: { id: true, name: true },
      },
      feature: {
        select: { id: true, identifier: true, title: true },
      },
      task: {
        select: { id: true, identifier: true, title: true },
      },
    },
  });
}

/**
 * List decisions with cursor-based pagination and optional filters.
 * Ordered by madeAt (newest first).
 */
export async function listDecisions(
  options: ListDecisionsOptions = {}
): Promise<PaginatedResult<DecisionWithContext>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  // Build date filters
  const dateFilterOptions: {
    createdAt?: string;
    createdBefore?: string;
  } = {};
  if (options.createdAt !== undefined) {
    dateFilterOptions.createdAt = options.createdAt;
  }
  if (options.createdBefore !== undefined) {
    dateFilterOptions.createdBefore = options.createdBefore;
  }
  const dateFilters = buildDateFilters(dateFilterOptions);

  // Build where clause
  const whereClause: {
    epicId?: string;
    featureId?: string;
    taskId?: string;
    category?: string;
    impact?: string;
    createdAt?: { gte?: Date; lt?: Date };
  } = {};

  if (options.epicId !== undefined) {
    whereClause.epicId = options.epicId;
  }
  if (options.featureId !== undefined) {
    whereClause.featureId = options.featureId;
  }
  if (options.taskId !== undefined) {
    whereClause.taskId = options.taskId;
  }
  if (options.category !== undefined) {
    whereClause.category = options.category;
  }
  if (options.impact !== undefined) {
    whereClause.impact = options.impact;
  }
  if (dateFilters.createdAt !== undefined) {
    whereClause.createdAt = dateFilters.createdAt;
  }

  const decisions = await prisma.decision.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ madeAt: "desc" }, { createdAt: "desc" }],
    include: {
      epic: {
        select: { id: true, name: true },
      },
      feature: {
        select: { id: true, identifier: true, title: true },
      },
      task: {
        select: { id: true, identifier: true, title: true },
      },
    },
  });

  const hasMore = decisions.length > limit;
  if (hasMore) {
    decisions.pop();
  }

  const lastDecision = decisions.at(-1);
  const nextCursor = hasMore && lastDecision ? lastDecision.id : null;

  return {
    data: decisions,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Search decisions by query in question, decision, and rationale fields.
 * Returns matching decisions ordered by madeAt (newest first).
 */
export async function searchDecisions(
  options: SearchDecisionsOptions
): Promise<PaginatedResult<DecisionWithContext>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  if (!options.query || options.query.trim() === "") {
    throw new ValidationError("Search query is required");
  }

  const searchTerm = options.query.trim();

  // Build where clause with OR for full-text search
  const whereClause: {
    epicId?: string;
    OR: Array<{
      question?: { contains: string };
      decision?: { contains: string };
      rationale?: { contains: string };
    }>;
  } = {
    OR: [
      { question: { contains: searchTerm } },
      { decision: { contains: searchTerm } },
      { rationale: { contains: searchTerm } },
    ],
  };

  if (options.epicId !== undefined) {
    whereClause.epicId = options.epicId;
  }

  const decisions = await prisma.decision.findMany({
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    where: whereClause,
    orderBy: [{ madeAt: "desc" }, { createdAt: "desc" }],
    include: {
      epic: {
        select: { id: true, name: true },
      },
      feature: {
        select: { id: true, identifier: true, title: true },
      },
      task: {
        select: { id: true, identifier: true, title: true },
      },
    },
  });

  const hasMore = decisions.length > limit;
  if (hasMore) {
    decisions.pop();
  }

  const lastDecision = decisions.at(-1);
  const nextCursor = hasMore && lastDecision ? lastDecision.id : null;

  return {
    data: decisions,
    meta: {
      cursor: nextCursor,
      hasMore,
    },
  };
}

/**
 * Get all decisions related to a task's context.
 * Returns decisions for the task itself, its parent feature, and the epic.
 */
export async function getDecisionContext(
  taskId: string
): Promise<{
  taskDecisions: DecisionWithContext[];
  featureDecisions: DecisionWithContext[];
  epicDecisions: DecisionWithContext[];
}> {
  // Get task with its feature and epic IDs
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      featureId: true,
      feature: {
        select: {
          id: true,
          epicId: true,
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${taskId}' not found`);
  }

  const featureId = task.featureId;
  const epicId = task.feature.epicId;

  // Fetch all relevant decisions in parallel
  const [taskDecisions, featureDecisions, epicDecisions] = await Promise.all([
    // Decisions directly related to this task
    prisma.decision.findMany({
      where: { taskId },
      orderBy: [{ madeAt: "desc" }],
      include: {
        epic: { select: { id: true, name: true } },
        feature: { select: { id: true, identifier: true, title: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
    }),
    // Decisions related to the parent feature (but not to any specific task)
    prisma.decision.findMany({
      where: { featureId, taskId: null },
      orderBy: [{ madeAt: "desc" }],
      include: {
        epic: { select: { id: true, name: true } },
        feature: { select: { id: true, identifier: true, title: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
    }),
    // Decisions related to the epic (but not to any specific feature or task)
    prisma.decision.findMany({
      where: { epicId, featureId: null, taskId: null },
      orderBy: [{ madeAt: "desc" }],
      include: {
        epic: { select: { id: true, name: true } },
        feature: { select: { id: true, identifier: true, title: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
    }),
  ]);

  return {
    taskDecisions,
    featureDecisions,
    epicDecisions,
  };
}

/**
 * Get all decisions related to a feature's context.
 * Returns decisions for the feature itself and the epic.
 */
export async function getFeatureDecisionContext(
  featureId: string
): Promise<{
  featureDecisions: DecisionWithContext[];
  epicDecisions: DecisionWithContext[];
}> {
  // Get feature with its epic ID
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    select: {
      id: true,
      epicId: true,
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  const epicId = feature.epicId;

  // Fetch relevant decisions in parallel
  const [featureDecisions, epicDecisions] = await Promise.all([
    // Decisions related to this feature (including task-level decisions)
    prisma.decision.findMany({
      where: { featureId },
      orderBy: [{ madeAt: "desc" }],
      include: {
        epic: { select: { id: true, name: true } },
        feature: { select: { id: true, identifier: true, title: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
    }),
    // Decisions related to the epic (but not to any specific feature or task)
    prisma.decision.findMany({
      where: { epicId, featureId: null, taskId: null },
      orderBy: [{ madeAt: "desc" }],
      include: {
        epic: { select: { id: true, name: true } },
        feature: { select: { id: true, identifier: true, title: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
    }),
  ]);

  return {
    featureDecisions,
    epicDecisions,
  };
}
