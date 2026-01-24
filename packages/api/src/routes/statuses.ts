import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listStatuses,
  getStatusById,
  createStatus,
  updateStatus,
  deleteStatus,
} from "../services/statusService.js";
import { authenticate } from "../middleware/authenticate.js";
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
export default async function statusesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
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
