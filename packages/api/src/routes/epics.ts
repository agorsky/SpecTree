import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listEpics,
  getEpicById,
  createEpic,
  updateEpic,
  deleteEpic,
  archiveEpic,
  unarchiveEpic,
} from "../services/epicService.js";
import { getProgressSummary } from "../services/summaryService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { reorderEpicSchema } from "../schemas/epic.js";

// Request type definitions
interface ListEpicsQuery {
  cursor?: string;
  limit?: string;
  teamId?: string;
  includeArchived?: string;
}

interface EpicIdParams {
  id: string;
}

interface CreateEpicBody {
  name: string;
  teamId: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

interface UpdateEpicBody {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

interface ReorderEpicBody {
  afterId?: string;
  beforeId?: string;
}

/**
 * Epics routes plugin
 * Prefix: /api/v1/epics
 */
export default function epicsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/epics
   * List epics with cursor-based pagination
   * Optional teamId query param to filter by team
   * Optional includeArchived query param to include archived epics
   * Requires authentication
   */
  fastify.get<{ Querystring: ListEpicsQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: { cursor?: string; limit?: number; teamId?: string; currentUserId?: string; includeArchived?: boolean } = {};
      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.teamId) {
        options.teamId = request.query.teamId;
      }
      if (request.query.includeArchived === "true") {
        options.includeArchived = true;
      }
      // Always pass currentUserId for scope-based filtering
      if (request.user?.id) {
        options.currentUserId = request.user.id;
      }

      const result = await listEpics(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/epics/:id
   * Get a single epic by ID
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: EpicIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("guest")] },
    async (request, reply) => {
      const epic = await getEpicById(request.params.id);
      if (!epic) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Epic with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: epic });
    }
  );

  /**
   * POST /api/v1/epics
   * Create a new epic
   * Requires authentication, team membership, and member+ role
   */
  fastify.post<{ Body: CreateEpicBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("member")] },
    async (request, reply) => {
      const { name, teamId, description, icon, color, sortOrder } = request.body;

      const input: {
        name: string;
        teamId: string;
        description?: string;
        icon?: string;
        color?: string;
        sortOrder?: number;
      } = {
        name,
        teamId,
      };
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const epic = await createEpic(input);
      return reply.status(201).send({ data: epic });
    }
  );

  /**
   * PUT /api/v1/epics/:id
   * Update an existing epic
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: EpicIdParams; Body: UpdateEpicBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, icon, color, sortOrder } = request.body;

      const input: {
        name?: string;
        description?: string;
        icon?: string;
        color?: string;
        sortOrder?: number;
      } = {};
      if (name !== undefined) input.name = name;
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const epic = await updateEpic(id, input);
      return reply.send({ data: epic });
    }
  );

  /**
   * DELETE /api/v1/epics/:id
   * Soft delete an epic (set isArchived = true)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: EpicIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteEpic(id);
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/v1/epics/:id/archive
   * Archive an epic (set isArchived = true)
   * Requires authentication, team membership, and member+ role
   */
  fastify.post<{ Params: EpicIdParams }>(
    "/:id/archive",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;

      const epic = await archiveEpic(id);
      return reply.send({ data: epic });
    }
  );

  /**
   * POST /api/v1/epics/:id/unarchive
   * Unarchive an epic (set isArchived = false)
   * Requires authentication, team membership, and member+ role
   */
  fastify.post<{ Params: EpicIdParams }>(
    "/:id/unarchive",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;

      const epic = await unarchiveEpic(id);
      return reply.send({ data: epic });
    }
  );

  /**
   * PUT /api/v1/epics/:id/reorder
   * Reorder an epic within its team
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: EpicIdParams; Body: ReorderEpicBody }>(
    "/:id/reorder",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Validate request body using Zod schema
      const validation = reorderEpicSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      // Fetch the epic being reordered
      const epic = await getEpicById(id);
      if (!epic) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Epic with id '${id}' not found`,
        });
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, fetch that epic and use its sortOrder as "before"
      if (afterId) {
        const afterEpic = await getEpicById(afterId);
        if (!afterEpic) {
          return reply.status(404).send({
            error: "Not Found",
            message: `Epic with id '${afterId}' not found`,
          });
        }
        // Validate that afterId epic belongs to the same team
        if (afterEpic.teamId !== epic.teamId) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "afterId epic must belong to the same team",
          });
        }
        beforeSortOrder = afterEpic.sortOrder;
      }

      // If beforeId provided, fetch that epic and use its sortOrder as "after"
      if (beforeId) {
        const beforeEpic = await getEpicById(beforeId);
        if (!beforeEpic) {
          return reply.status(404).send({
            error: "Not Found",
            message: `Epic with id '${beforeId}' not found`,
          });
        }
        // Validate that beforeId epic belongs to the same team
        if (beforeEpic.teamId !== epic.teamId) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "beforeId epic must belong to the same team",
          });
        }
        afterSortOrder = beforeEpic.sortOrder;
      }

      // Calculate new sortOrder using generateSortOrderBetween
      const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the epic's sortOrder
      const updatedEpic = await updateEpic(id, { sortOrder: newSortOrder });

      return reply.send({ data: updatedEpic });
    }
  );

  /**
   * GET /api/v1/epics/:id/progress-summary
   * Get comprehensive progress summary for an epic
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: EpicIdParams }>(
    "/:id/progress-summary",
    { preHandler: [authenticate, requireTeamAccess("id:epicId"), requireRole("guest")] },
    async (request, reply) => {
      const summary = await getProgressSummary(request.params.id);
      return reply.send({ data: summary });
    }
  );
}
