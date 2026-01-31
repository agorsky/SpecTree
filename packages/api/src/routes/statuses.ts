import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listStatuses,
  getStatusById,
  createStatus,
  updateStatus,
  deleteStatus,
} from "../services/statusService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { reorderStatusSchema, type ReorderStatusInput } from "../schemas/status.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface ListStatusesQuery {
  teamId?: string;
}

interface StatusIdParams {
  id: string;
}

interface CreateStatusBody {
  name: string;
  teamId: string;
  category: string;
  color?: string;
  position?: number;
}

interface UpdateStatusBody {
  name?: string;
  category?: string;
  color?: string;
  position?: number;
}

/**
 * Statuses routes plugin
 * Prefix: /api/v1/statuses
 */
export default function statusesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/statuses
   * List statuses with optional team filter
   * Requires authentication
   */
  fastify.get<{ Querystring: ListStatusesQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: { teamId?: string } = {};
      if (request.query.teamId) {
        options.teamId = request.query.teamId;
      }

      const statuses = await listStatuses(options);
      return reply.send({ data: statuses });
    }
  );

  /**
   * GET /api/v1/statuses/:id
   * Get a single status by ID
   * Requires authentication
   */
  fastify.get<{ Params: StatusIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const status = await getStatusById(request.params.id);
      if (!status) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Status with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: status });
    }
  );

  /**
   * POST /api/v1/statuses
   * Create a new status
   * Requires authentication, team membership, and member+ role
   */
  fastify.post<{ Body: CreateStatusBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("member")] },
    async (request, reply) => {
      const { name, teamId, category, color, position } = request.body;

      const input: {
        name: string;
        teamId: string;
        category: string;
        color?: string;
        position?: number;
      } = {
        name,
        teamId,
        category,
      };
      if (color !== undefined) input.color = color;
      if (position !== undefined) input.position = position;

      const status = await createStatus(input);
      return reply.status(201).send({ data: status });
    }
  );

  /**
   * PUT /api/v1/statuses/:id
   * Update an existing status
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: StatusIdParams; Body: UpdateStatusBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:statusId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { name, category, color, position } = request.body;

      const input: {
        name?: string;
        category?: string;
        color?: string;
        position?: number;
      } = {};
      if (name !== undefined) input.name = name;
      if (category !== undefined) input.category = category;
      if (color !== undefined) input.color = color;
      if (position !== undefined) input.position = position;

      const status = await updateStatus(id, input);
      return reply.send({ data: status });
    }
  );

  /**
   * PUT /api/v1/statuses/:id/reorder
   * Reorder a status within its team
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: StatusIdParams; Body: ReorderStatusInput }>(
    "/:id/reorder",
    {
      preHandler: [authenticate, requireTeamAccess("id:statusId"), requireRole("member")],
      preValidation: [validateBody(reorderStatusSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Fetch the status being reordered
      const status = await prisma.status.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!status) {
        throw new NotFoundError(`Status with id '${id}' not found`);
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, the new position is after that status
      // So "afterId" status's position becomes our "before" value
      if (afterId) {
        const afterStatus = await prisma.status.findUnique({
          where: { id: afterId },
          select: { id: true, teamId: true, position: true },
        });

        if (!afterStatus) {
          throw new NotFoundError(`Status with id '${afterId}' not found`);
        }

        if (afterStatus.teamId !== status.teamId) {
          throw new ValidationError("Cannot reorder: afterId status belongs to a different team");
        }

        beforeSortOrder = afterStatus.position;
      }

      // If beforeId provided, the new position is before that status
      // So "beforeId" status's position becomes our "after" value
      if (beforeId) {
        const beforeStatus = await prisma.status.findUnique({
          where: { id: beforeId },
          select: { id: true, teamId: true, position: true },
        });

        if (!beforeStatus) {
          throw new NotFoundError(`Status with id '${beforeId}' not found`);
        }

        if (beforeStatus.teamId !== status.teamId) {
          throw new ValidationError("Cannot reorder: beforeId status belongs to a different team");
        }

        afterSortOrder = beforeStatus.position;
      }

      // Calculate the new position
      const newPosition = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the status's position
      const updatedStatus = await prisma.status.update({
        where: { id },
        data: { position: newPosition },
      });

      return reply.send({ data: updatedStatus });
    }
  );

  /**
   * DELETE /api/v1/statuses/:id
   * Delete a status (only if not in use by any features or tasks)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: StatusIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:statusId"), requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteStatus(id);
      return reply.status(204).send();
    }
  );
}
