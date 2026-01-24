import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from "../services/taskService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface ListTasksQuery {
  cursor?: string;
  limit?: string;
  featureId?: string;
  statusId?: string;
  assigneeId?: string;
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

/**
 * Tasks routes plugin
 * Prefix: /api/v1/tasks
 */
export default async function tasksRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
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
        statusId?: string;
        assigneeId?: string;
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
      if (request.query.statusId) {
        options.statusId = request.query.statusId;
      }
      if (request.query.assigneeId) {
        options.assigneeId = request.query.assigneeId;
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
}

/**
 * Feature tasks nested routes plugin
 * Prefix: /api/v1/features/:featureId/tasks
 * This plugin should be registered with the features prefix
 */
export async function featureTasksRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
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
        assigneeId?: string;
      } = {
        featureId: request.params.featureId,
      };

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.statusId) {
        options.statusId = request.query.statusId;
      }
      if (request.query.assigneeId) {
        options.assigneeId = request.query.assigneeId;
      }

      const result = await listTasks(options);
      return reply.send(result);
    }
  );
}
