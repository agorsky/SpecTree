import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import {
  listTeams,
  getTeamByIdOrNameOrKey,
  createTeam,
  updateTeam,
  deleteTeam,
} from "../services/teamService.js";
import { addMemberToTeam } from "../services/membershipService.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  createTeamSchema,
  updateTeamSchema,
  uuidParamSchema,
  flexibleIdParamSchema,
  paginationQuerySchema,
  type CreateTeamInput,
  type UpdateTeamInput,
  type UuidParam,
  type PaginationQuery,
} from "../schemas/index.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";
import { UnauthorizedError } from "../errors/index.js";

/**
 * Get the authenticated user ID from a request.
 * Throws UnauthorizedError if not authenticated.
 */
function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.user) {
    throw new UnauthorizedError("Authentication required");
  }
  return request.user.id;
}

/**
 * Flexible ID parameter type - can be UUID, name, or key
 */
interface FlexibleIdParam {
  id: string;
}

/**
 * Teams routes plugin
 * Prefix: /api/v1/teams
 */
export default function teamsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/teams
   * List teams with cursor-based pagination
   * Requires authentication
   */
  fastify.get<{ Querystring: PaginationQuery }>(
    "/",
    {
      preHandler: [authenticate],
      preValidation: [validateQuery(paginationQuerySchema)],
    },
    async (request, reply) => {
      const options: { cursor?: string; limit?: number } = {};
      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = request.query.limit;
      }

      const result = await listTeams(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/teams/:id
   * Get a single team by ID, name, or key
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FlexibleIdParam }>(
    "/:id",
    {
      preHandler: [authenticate, requireTeamAccess("id"), requireRole("guest")],
      preValidation: [validateParams(flexibleIdParamSchema)],
    },
    async (request, reply) => {
      const team = await getTeamByIdOrNameOrKey(request.params.id);
      if (!team) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Team '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: team });
    }
  );

  /**
   * POST /api/v1/teams
   * Create a new team
   * Requires authentication (any authenticated user can create teams)
   */
  fastify.post<{ Body: CreateTeamInput }>(
    "/",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(createTeamSchema)],
    },
    async (request, reply) => {
      const { name, key, description, icon, color } = request.body;

      const input: { name: string; key: string; description?: string; icon?: string; color?: string } = {
        name,
        key,
      };
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;

      const team = await createTeam(input);

      // Add the creator as an admin member of the team
      await addMemberToTeam(team.id, {
        userId: getAuthenticatedUserId(request),
        role: "admin",
      });

      return reply.status(201).send({ data: team });
    }
  );

  /**
   * PUT /api/v1/teams/:id
   * Update an existing team
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: UuidParam; Body: UpdateTeamInput }>(
    "/:id",
    {
      preHandler: [authenticate, requireTeamAccess("id"), requireRole("member")],
      preValidation: [
        validateParams(uuidParamSchema),
        validateBody(updateTeamSchema),
      ],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name, key, description, icon, color } = request.body;

      const input: { name?: string; key?: string; description?: string; icon?: string; color?: string } = {};
      if (name !== undefined) input.name = name;
      if (key !== undefined) input.key = key;
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;

      const team = await updateTeam(id, input);
      return reply.send({ data: team });
    }
  );

  /**
   * DELETE /api/v1/teams/:id
   * Soft delete a team (set isArchived = true)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: UuidParam }>(
    "/:id",
    {
      preHandler: [authenticate, requireTeamAccess("id"), requireRole("admin")],
      preValidation: [validateParams(uuidParamSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;

      await deleteTeam(id);
      return reply.status(204).send();
    }
  );
}
