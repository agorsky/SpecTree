import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listTeamMembers,
  addMemberToTeam,
  updateMemberRole,
  removeMemberFromTeam,
  listUserTeams,
  isValidRole,
  VALID_ROLES,
  type MembershipRole,
} from "../services/membershipService.js";
import { ValidationError } from "../errors/index.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface TeamIdParams {
  teamId: string;
}

interface TeamMemberParams {
  teamId: string;
  userId: string;
}

interface UserIdParams {
  userId: string;
}

interface AddMemberBody {
  userId: string;
  role?: string;
}

interface UpdateMemberRoleBody {
  role: string;
}

/**
 * Team memberships routes plugin
 * Prefix: /api/v1/teams
 */
export async function teamMembershipsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * GET /api/v1/teams/:teamId/members
   * List all members of a team
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: TeamIdParams }>(
    "/:teamId/members",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("guest")] },
    async (request, reply) => {
      const members = await listTeamMembers(request.params.teamId);
      return reply.send({ data: members });
    }
  );

  /**
   * POST /api/v1/teams/:teamId/members
   * Add a user to a team
   * Requires authentication, team membership, and admin role
   */
  fastify.post<{ Params: TeamIdParams; Body: AddMemberBody }>(
    "/:teamId/members",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
    async (request, reply) => {
      const { teamId } = request.params;
      const { userId, role } = request.body;

      // Validate required fields
      if (!userId) {
        throw new ValidationError("userId is required");
      }

      // Validate role if provided
      if (role !== undefined && !isValidRole(role)) {
        throw new ValidationError(
          `Invalid role '${role}'. Must be one of: ${VALID_ROLES.join(", ")}`
        );
      }

      const input: { userId: string; role?: MembershipRole } = { userId };
      if (role !== undefined) {
        input.role = role;
      }

      const membership = await addMemberToTeam(teamId, input);
      return reply.status(201).send({ data: membership });
    }
  );

  /**
   * PUT /api/v1/teams/:teamId/members/:userId
   * Update a member's role in a team
   * Requires authentication, team membership, and admin role
   */
  fastify.put<{ Params: TeamMemberParams; Body: UpdateMemberRoleBody }>(
    "/:teamId/members/:userId",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
    async (request, reply) => {
      const { teamId, userId } = request.params;
      const { role } = request.body;

      // Validate required fields
      if (!role) {
        throw new ValidationError("role is required");
      }

      // Validate role
      if (!isValidRole(role)) {
        throw new ValidationError(
          `Invalid role '${role}'. Must be one of: ${VALID_ROLES.join(", ")}`
        );
      }

      const membership = await updateMemberRole(teamId, userId, {
        role,
      });
      return reply.send({ data: membership });
    }
  );

  /**
   * DELETE /api/v1/teams/:teamId/members/:userId
   * Remove a user from a team
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: TeamMemberParams }>(
    "/:teamId/members/:userId",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
    async (request, reply) => {
      const { teamId, userId } = request.params;

      await removeMemberFromTeam(teamId, userId);
      return reply.status(204).send();
    }
  );
}

/**
 * User teams routes plugin
 * Prefix: /api/v1/users
 */
export async function userTeamsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * GET /api/v1/users/:userId/teams
   * List all teams a user is a member of
   * Requires authentication
   */
  fastify.get<{ Params: UserIdParams }>(
    "/:userId/teams",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const teams = await listUserTeams(request.params.userId);
      return reply.send({ data: teams });
    }
  );
}
