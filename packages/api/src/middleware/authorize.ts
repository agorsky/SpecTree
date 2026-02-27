/**
 * Authorization middleware — single-user pass-through.
 *
 * All multi-user scope/role checks have been removed.
 * Every authenticated user passes through automatically.
 * Function signatures are preserved for call-site compatibility.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { Membership } from "../generated/prisma/index.js";
import { ForbiddenError } from "../errors/index.js";
import type { MembershipRole } from "../services/membershipService.js";

/**
 * Special marker for personal scope resources.
 * Retained for call-site compatibility.
 */
export const PERSONAL_SCOPE_MARKER = "__personal_scope__";

/**
 * User's team membership info for authorization.
 * Retained for type compatibility.
 */
export type UserTeamMembership = Pick<Membership, "teamId" | "role">;

/**
 * Extends FastifyRequest to include the user's team memberships and resolved team ID.
 */
declare module "fastify" {
  interface FastifyRequest {
    userTeams?: UserTeamMembership[];
    /** The resolved team ID from requireTeamAccess middleware */
    teamId?: string;
    /** The personal scope ID if the resource belongs to a personal scope */
    personalScopeId?: string;
  }
}

/**
 * Factory function that creates a preHandler hook for team access authorization.
 *
 * Simplified to single-user pass-through: verifies the user is authenticated,
 * then allows access unconditionally.
 *
 * @param teamIdParam - Name of the param or body field containing the team reference.
 *   Supports special values for nested resources:
 *   - "teamId" or "team_id": Direct team ID
 *   - "epicId" or "epic_id": Lookup team via epic
 *   - "featureId" or "feature_id": Lookup team via feature → epic
 *   - "taskId" or "task_id": Lookup team via task → feature → epic
 *   - "statusId" or "status_id": Lookup team via status
 *
 *   Also supports mapping syntax "paramName:resourceType" for routes where the
 *   param name differs from the resource type (e.g., "id:epicId" means
 *   read from params.id but treat it as an epicId).
 *
 * @returns A Fastify preHandler hook function
 *
 * @throws ForbiddenError if user is not authenticated
 *
 * @example
 * // Direct team access check
 * fastify.get(
 *   "/teams/:teamId/members",
 *   { preHandler: [authenticate, requireTeamAccess("teamId")] },
 *   async (request, reply) => { ... }
 * );
 */
export function requireTeamAccess(
  teamIdParam: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new ForbiddenError("User not authenticated");
    }

    // Parse the param name (keep param-extraction logic so teamId is set on request)
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown> | undefined;

    let paramName = teamIdParam;
    let bodyOnly = false;

    if (teamIdParam.startsWith("body.")) {
      paramName = teamIdParam.slice(5);
      bodyOnly = true;
    } else if (teamIdParam.includes(":")) {
      const parts = teamIdParam.split(":");
      if (parts.length === 2 && parts[0] && parts[1]) {
        paramName = parts[0];
      }
    }

    const resourceId = bodyOnly
      ? (body?.[paramName] as string | undefined)
      : (params[paramName] ?? (body?.[paramName] as string | undefined));

    // Store resourceId as teamId on request for downstream compatibility
    if (resourceId) {
      request.teamId = resourceId;
    }

    // Populate userTeams for downstream requireRole compatibility
    request.userTeams = request.userTeams ?? [];
  };
}

/**
 * Factory function that creates a preHandler hook for role-based authorization.
 *
 * Simplified to single-user pass-through: verifies the user is authenticated,
 * then allows access unconditionally.
 *
 * @param roles - Array of minimum roles required for this endpoint.
 *
 * @returns A Fastify preHandler hook function
 *
 * @throws ForbiddenError if user is not authenticated
 *
 * @example
 * // Require admin role
 * fastify.delete(
 *   "/teams/:teamId/members/:userId",
 *   { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
 *   async (request, reply) => { ... }
 * );
 */
export function requireRole(
  ..._roles: MembershipRole[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new ForbiddenError("User not authenticated");
    }
    // Single-user mode: every authenticated user passes through
  };
}
