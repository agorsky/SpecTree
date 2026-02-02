import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from "../services/taskService.js";
import {
  getTaskAiContext,
  setTaskAiContext,
  appendTaskAiNote,
} from "../services/aiContextService.js";
import {
  startWork,
  completeWork,
  logProgress,
  reportBlocker,
} from "../services/progressService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";
import { validateBody } from "../middleware/validate.js";
import {
  reorderTaskSchema,
  type ReorderTaskInput,
} from "../schemas/index.js";
import {
  appendAiNoteSchema,
  setAiContextSchema,
  type AppendAiNoteInput,
  type SetAiContextInput,
} from "../schemas/aiContext.js";
import {
  startWorkSchema,
  completeWorkSchema,
  logProgressSchema,
  reportBlockerSchema,
  type StartWorkInput,
  type CompleteWorkInput,
  type LogProgressInput,
  type ReportBlockerInput,
} from "../schemas/progress.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";

// Request type definitions
interface ListTasksQuery {
  cursor?: string;
  limit?: string;
  featureId?: string;
  /** Filter by epic ID (returns tasks across all features in the epic) */
  epicId?: string;
  statusId?: string;
  /** Status filter - can be ID or name (single or array via repeated param) */
  status?: string | string[];
  /** Filter by status category (backlog, unstarted, started, completed, canceled) */
  statusCategory?: string;
  assigneeId?: string;
  /** Assignee filter - supports "me", "none", email, or UUID */
  assignee?: string;
  query?: string;
  createdAt?: string;
  createdBefore?: string;
  updatedAt?: string;
  updatedBefore?: string;
}

interface TaskIdParams {
  id: string;
}

interface FeatureIdParams {
  featureId: string;
}

interface CreateTaskBody {
  title: string;
  featureId: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

interface UpdateTaskBody {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

interface BulkUpdateBody {
  ids: string[];
  statusId: string;
}

/**
 * Tasks routes plugin
 * Prefix: /api/v1/tasks
 */
export default function tasksRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/tasks
   * List tasks with cursor-based pagination
   * Optional query params: featureId, statusId, assigneeId
   * Requires authentication
   */
  fastify.get<{ Querystring: ListTasksQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        featureId?: string;
        epicId?: string;
        statusId?: string;
        status?: string | string[];
        statusCategory?: string;
        assigneeId?: string;
        assignee?: string;
        currentUserId?: string;
        query?: string;
        createdAt?: string;
        createdBefore?: string;
        updatedAt?: string;
        updatedBefore?: string;
      } = {};

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.featureId) {
        options.featureId = request.query.featureId;
      }
      if (request.query.epicId) {
        options.epicId = request.query.epicId;
      }
      // Enhanced status filtering (supports name, ID, array, category)
      if (request.query.status) {
        options.status = request.query.status;
      } else if (request.query.statusCategory) {
        options.statusCategory = request.query.statusCategory;
      } else if (request.query.statusId) {
        // Legacy support for direct statusId
        options.statusId = request.query.statusId;
      }
      // Enhanced assignee filtering
      if (request.query.assignee) {
        options.assignee = request.query.assignee;
        if (request.user?.id) {
          options.currentUserId = request.user.id;
        }
      } else if (request.query.assigneeId) {
        // Legacy support for direct assigneeId
        options.assigneeId = request.query.assigneeId;
      }
      if (request.query.query) {
        options.query = request.query.query;
      }
      if (request.query.createdAt) {
        options.createdAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.createdBefore = request.query.createdBefore;
      }
      if (request.query.updatedAt) {
        options.updatedAt = request.query.updatedAt;
      }
      if (request.query.updatedBefore) {
        options.updatedBefore = request.query.updatedBefore;
      }

      const result = await listTasks(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/tasks/:id
   * Get a single task by ID
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: TaskIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("guest")] },
    async (request, reply) => {
      const task = await getTaskById(request.params.id);
      if (!task) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Task with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: task });
    }
  );

  /**
   * POST /api/v1/tasks
   * Create a new task (auto-generates identifier based on parent feature)
   * Requires authentication, team membership (via featureId), and member+ role
   */
  fastify.post<{ Body: CreateTaskBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("featureId"), requireRole("member")] },
    async (request, reply) => {
      const { title, featureId, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title: string;
        featureId: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {
        title,
        featureId,
      };

      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const task = await createTask(input);
      return reply.status(201).send({ data: task });
    }
  );

  /**
   * PUT /api/v1/tasks/:id
   * Update an existing task
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: TaskIdParams; Body: UpdateTaskBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { title, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title?: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {};

      if (title !== undefined) input.title = title;
      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const task = await updateTask(id, input);
      return reply.send({ data: task });
    }
  );

  /**
   * PUT /api/v1/tasks/bulk-update
   * Update status for multiple tasks at once
   * Requires authentication
   */
  fastify.put<{ Body: BulkUpdateBody }>(
    "/bulk-update",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { ids, statusId } = request.body;

      // Validate inputs
      if (ids.length === 0) {
        throw new ValidationError("ids array is required and cannot be empty");
      }
      if (!statusId) {
        throw new ValidationError("statusId is required");
      }

      // Verify status exists
      const status = await prisma.status.findUnique({
        where: { id: statusId },
        select: { id: true, teamId: true },
      });
      if (!status) {
        throw new NotFoundError(`Status with id '${statusId}' not found`);
      }

      // Verify all tasks exist and belong to features in epics in the status's team
      const tasks = await prisma.task.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          feature: {
            select: {
              epic: {
                select: { teamId: true },
              },
            },
          },
        },
      });

      if (tasks.length !== ids.length) {
        const foundIds = tasks.map((t) => t.id);
        const missingIds = ids.filter((id) => !foundIds.includes(id));
        throw new NotFoundError(`Tasks not found: ${missingIds.join(", ")}`);
      }

      // Verify all tasks belong to the same team as the status
      const invalidTasks = tasks.filter(
        (t) => t.feature.epic.teamId !== status.teamId
      );
      if (invalidTasks.length > 0) {
        throw new ValidationError(
          `Some tasks do not belong to the same team as the status`
        );
      }

      // Update in transaction
      const result = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.task.updateMany({
          where: { id: { in: ids } },
          data: { statusId },
        });
        return updateResult.count;
      });

      return reply.send({ updated: result });
    }
  );

  /**
   * DELETE /api/v1/tasks/:id
   * Delete a task (hard delete)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: TaskIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteTask(id);
      return reply.status(204).send();
    }
  );

  /**
   * PUT /api/v1/tasks/:id/reorder
   * Reorder a task within its feature
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: TaskIdParams; Body: ReorderTaskInput }>(
    "/:id/reorder",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(reorderTaskSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Fetch the task being reordered
      const task = await getTaskById(id);
      if (!task) {
        throw new NotFoundError(`Task with id '${id}' not found`);
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, fetch that task and use its sortOrder as "before"
      // (the new task will be placed after it, so its sortOrder is the lower bound)
      if (afterId) {
        const afterTask = await prisma.task.findUnique({
          where: { id: afterId },
          select: { sortOrder: true, featureId: true },
        });

        if (!afterTask) {
          throw new NotFoundError(`Task with id '${afterId}' not found`);
        }

        // Validate that afterId task belongs to the same feature
        if (afterTask.featureId !== task.featureId) {
          throw new ValidationError(
            "Cannot reorder task: afterId task belongs to a different feature"
          );
        }

        beforeSortOrder = afterTask.sortOrder;
      }

      // If beforeId provided, fetch that task and use its sortOrder as "after"
      // (the new task will be placed before it, so its sortOrder is the upper bound)
      if (beforeId) {
        const beforeTask = await prisma.task.findUnique({
          where: { id: beforeId },
          select: { sortOrder: true, featureId: true },
        });

        if (!beforeTask) {
          throw new NotFoundError(`Task with id '${beforeId}' not found`);
        }

        // Validate that beforeId task belongs to the same feature
        if (beforeTask.featureId !== task.featureId) {
          throw new ValidationError(
            "Cannot reorder task: beforeId task belongs to a different feature"
          );
        }

        afterSortOrder = beforeTask.sortOrder;
      }

      // Calculate new sortOrder using generateSortOrderBetween
      const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the task's sortOrder
      const updatedTask = await updateTask(id, { sortOrder: newSortOrder });

      return reply.send({ data: updatedTask });
    }
  );

  // ===========================================================================
  // AI Context Endpoints
  // ===========================================================================

  /**
   * GET /api/v1/tasks/:id/ai-context
   * Get AI context for a task
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: TaskIdParams }>(
    "/:id/ai-context",
    { preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("guest")] },
    async (request, reply) => {
      const { id } = request.params;
      const context = await getTaskAiContext(id);
      return reply.send({ data: context });
    }
  );

  /**
   * PUT /api/v1/tasks/:id/ai-context
   * Set AI context for a task (replaces entire context)
   * Requires authentication and team membership (member+)
   */
  fastify.put<{ Params: TaskIdParams; Body: SetAiContextInput }>(
    "/:id/ai-context",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(setAiContextSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { context, sessionId } = request.body;
      const result = await setTaskAiContext(id, { context, sessionId });
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/tasks/:id/ai-note
   * Append an AI note to a task (non-destructive)
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: TaskIdParams; Body: AppendAiNoteInput }>(
    "/:id/ai-note",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(appendAiNoteSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { type, content, sessionId } = request.body;
      const result = await appendTaskAiNote(id, { type, content, sessionId });
      return reply.status(201).send({ data: result });
    }
  );

  // ===========================================================================
  // Progress Tracking Routes
  // ===========================================================================

  /**
   * POST /api/v1/tasks/:id/progress/start
   * Start work on a task - sets status to "In Progress" and records start time
   */
  fastify.post<{ Params: TaskIdParams; Body: StartWorkInput }>(
    "/:id/progress/start",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(startWorkSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await startWork("task", id, request.body);
      return reply.send({
        data: {
          ...result,
          startedAt: result.startedAt.toISOString(),
        },
      });
    }
  );

  /**
   * POST /api/v1/tasks/:id/progress/complete
   * Complete work on a task - sets status to "Done" and records completion time
   */
  fastify.post<{ Params: TaskIdParams; Body: CompleteWorkInput }>(
    "/:id/progress/complete",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(completeWorkSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await completeWork("task", id, request.body);
      return reply.send({
        data: {
          ...result,
          startedAt: result.startedAt?.toISOString() ?? null,
          completedAt: result.completedAt.toISOString(),
        },
      });
    }
  );

  /**
   * POST /api/v1/tasks/:id/progress/log
   * Log progress on a task without changing status
   */
  fastify.post<{ Params: TaskIdParams; Body: LogProgressInput }>(
    "/:id/progress/log",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(logProgressSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await logProgress("task", id, request.body);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/tasks/:id/progress/blocker
   * Report a blocker on a task
   */
  fastify.post<{ Params: TaskIdParams; Body: ReportBlockerInput }>(
    "/:id/progress/blocker",
    {
      preHandler: [authenticate, requireTeamAccess("id:taskId"), requireRole("member")],
      preValidation: [validateBody(reportBlockerSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await reportBlocker("task", id, request.body);
      return reply.send({ data: result });
    }
  );
}

/**
 * Feature tasks nested routes plugin
 * Prefix: /api/v1/features/:featureId/tasks
 * This plugin should be registered with the features prefix
 */
export function featureTasksRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/features/:featureId/tasks
   * List tasks for a specific feature with cursor-based pagination
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FeatureIdParams; Querystring: ListTasksQuery }>(
    "/:featureId/tasks",
    { preHandler: [authenticate, requireTeamAccess("featureId"), requireRole("guest")] },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        featureId: string;
        statusId?: string;
        status?: string | string[];
        statusCategory?: string;
        assigneeId?: string;
        assignee?: string;
        currentUserId?: string;
        query?: string;
        createdAt?: string;
        createdBefore?: string;
        updatedAt?: string;
        updatedBefore?: string;
      } = {
        featureId: request.params.featureId,
      };

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      // Enhanced status filtering (supports name, ID, array, category)
      if (request.query.status) {
        options.status = request.query.status;
      } else if (request.query.statusCategory) {
        options.statusCategory = request.query.statusCategory;
      } else if (request.query.statusId) {
        // Legacy support for direct statusId
        options.statusId = request.query.statusId;
      }
      // Enhanced assignee filtering
      if (request.query.assignee) {
        options.assignee = request.query.assignee;
        if (request.user?.id) {
          options.currentUserId = request.user.id;
        }
      } else if (request.query.assigneeId) {
        // Legacy support for direct assigneeId
        options.assigneeId = request.query.assigneeId;
      }
      if (request.query.query) {
        options.query = request.query.query;
      }
      if (request.query.createdAt) {
        options.createdAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.createdBefore = request.query.createdBefore;
      }
      if (request.query.updatedAt) {
        options.updatedAt = request.query.updatedAt;
      }
      if (request.query.updatedBefore) {
        options.updatedBefore = request.query.updatedBefore;
      }

      const result = await listTasks(options);
      return reply.send(result);
    }
  );
}
