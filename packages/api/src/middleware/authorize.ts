/**
 * Authorization middleware for team-scoping access control.
 * Restricts access to resources within user's teams.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { Membership } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";
import { ForbiddenError } from "../errors/index.js";
import type { MembershipRole } from "../services/membershipService.js";

/**
 * User's team membership info for authorization.
 * Cached on req.userTeams for reuse across middleware calls.
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
  }
}

/**
 * Fetches and caches user's team memberships on the request object.
 * If already cached, returns the cached value.
 *
 * @param request - The Fastify request object
 * @returns Array of user's team memberships
 */
async function getUserTeams(
  request: FastifyRequest
): Promise<UserTeamMembership[]> {
  // Return cached value if available
  if (request.userTeams) {
    return request.userTeams;
  }

  // User must be authenticated
  if (!request.user) {
    throw new ForbiddenError("User not authenticated");
  }

  // Fetch user's team memberships from database
  const memberships = await prisma.membership.findMany({
    where: { userId: request.user.id },
    select: { teamId: true, role: true },
  });

  // Cache on request for reuse
  request.userTeams = memberships;

  return memberships;
}

/**
 * Checks if user has access to the specified team.
 *
 * @param userTeams - User's team memberships
 * @param teamId - The team ID to check access for
 * @returns True if user is a member of the team
 */
function hasTeamAccess(
  userTeams: UserTeamMembership[],
  teamId: string
): boolean {
  return userTeams.some((membership) => membership.teamId === teamId);
}

/**
 * Looks up the team ID for a project.
 *
 * @param projectId - The project ID
 * @returns The team ID or null if project not found
 */
async function getTeamIdFromProject(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true },
  });
  return project?.teamId ?? null;
}

/**
 * Looks up the team ID for a feature (via its project).
 *
 * @param featureId - The feature ID
 * @returns The team ID or null if feature/project not found
 */
async function getTeamIdFromFeature(featureId: string): Promise<string | null> {
  const feature = await prisma.feature.findUnique({
    where: { id: featureId },
    select: { project: { select: { teamId: true } } },
  });
  return feature?.project.teamId ?? null;
}

/**
 * Looks up the team ID for a task (via feature → project).
 *
 * @param taskId - The task ID
 * @returns The team ID or null if task/feature/project not found
 */
async function getTeamIdFromTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { feature: { select: { project: { select: { teamId: true } } } } },
  });
  return task?.feature.project.teamId ?? null;
}

/**
 * Looks up the team ID for a status.
 *
 * @param statusId - The status ID
 * @returns The team ID or null if status not found
 */
async function getTeamIdFromStatus(statusId: string): Promise<string | null> {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { teamId: true },
  });
  return status?.teamId ?? null;
}

/**
 * Factory function that creates a preHandler hook for team access authorization.
 *
 * The middleware looks up the team ID from the specified parameter (or body),
 * fetches the user's team memberships, and verifies access.
 *
 * For nested resources (project, feature, task, status), the middleware performs
 * the necessary lookups to determine the associated team.
 *
 * @param teamIdParam - Name of the param or body field containing the team reference.
 *   Supports special values for nested resources:
 *   - "teamId" or "team_id": Direct team ID
 *   - "projectId" or "project_id": Lookup team via project
 *   - "featureId" or "feature_id": Lookup team via feature → project
 *   - "taskId" or "task_id": Lookup team via task → feature → project
 *   - "statusId" or "status_id": Lookup team via status
 *
 *   Also supports mapping syntax "paramName:resourceType" for routes where the
 *   param name differs from the resource type (e.g., "id:projectId" means
 *   read from params.id but treat it as a projectId).
 *
 * @returns A Fastify preHandler hook function
 *
 * @throws ForbiddenError if:
 *   - User is not authenticated
 *   - Team/resource ID is not provided
 *   - Resource is not found (for nested lookups)
 *   - User is not a member of the team
 *
 * @example
 * // Direct team access check
 * fastify.get(
 *   "/teams/:teamId/members",
 *   { preHandler: [authenticate, requireTeamAccess("teamId")] },
 *   async (request, reply) => { ... }
 * );
 *
 * @example
 * // Project-based team access check with mapped param
 * fastify.get(
 *   "/projects/:id",
 *   { preHandler: [authenticate, requireTeamAccess("id:projectId")] },
 *   async (request, reply) => { ... }
 * );
 *
 * @example
 * // Team ID from request body
 * fastify.post(
 *   "/projects",
 *   { preHandler: [authenticate, requireTeamAccess("teamId")] },
 *   async (request, reply) => { ... }
 * );
 */
export function requireTeamAccess(
  teamIdParam: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Get user's team memberships
    const userTeams = await getUserTeams(request);

    // Get the resource ID from params or body
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown> | undefined;

    // Support mapping syntax "paramName:resourceType" (e.g., "id:projectId")
    // This allows using a different param name than the resource type
    let paramName = teamIdParam;
    let resourceType = teamIdParam;
    if (teamIdParam.includes(":")) {
      const parts = teamIdParam.split(":");
      if (parts.length === 2 && parts[0] && parts[1]) {
        paramName = parts[0];
        resourceType = parts[1];
      }
    }

    const resourceId = params[paramName] ?? (body?.[paramName] as string | undefined);

    if (!resourceId) {
      throw new ForbiddenError(`Missing required parameter: ${paramName}`);
    }

    // Resolve team ID based on the resource type
    let teamId: string | null;
    const typeLower = resourceType.toLowerCase();

    if (typeLower === "teamid" || typeLower === "team_id") {
      // Direct team ID
      teamId = resourceId;
    } else if (typeLower === "projectid" || typeLower === "project_id") {
      // Lookup team via project
      teamId = await getTeamIdFromProject(resourceId);
      if (!teamId) {
        throw new ForbiddenError("Project not found");
      }
    } else if (typeLower === "featureid" || typeLower === "feature_id") {
      // Lookup team via feature → project
      teamId = await getTeamIdFromFeature(resourceId);
      if (!teamId) {
        throw new ForbiddenError("Feature not found");
      }
    } else if (typeLower === "taskid" || typeLower === "task_id") {
      // Lookup team via task → feature → project
      teamId = await getTeamIdFromTask(resourceId);
      if (!teamId) {
        throw new ForbiddenError("Task not found");
      }
    } else if (typeLower === "statusid" || typeLower === "status_id") {
      // Lookup team via status
      teamId = await getTeamIdFromStatus(resourceId);
      if (!teamId) {
        throw new ForbiddenError("Status not found");
      }
    } else {
      // Unknown resource type - treat as direct team ID
      teamId = resourceId;
    }

    // Check if user has access to the team
    if (!hasTeamAccess(userTeams, teamId)) {
      throw new ForbiddenError("Access denied: not a member of this team");
    }

    // Store the resolved teamId on the request for use by requireRole
    request.teamId = teamId;
  };
}

/**
 * Role hierarchy for permission checks.
 * Higher number = more permissions.
 * admin (2) > member (1) > guest (0)
 */
const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  admin: 2,
  member: 1,
  guest: 0,
};

/**
 * Gets the user's role for a specific team from their cached memberships.
 *
 * @param userTeams - User's team memberships (cached on request)
 * @param teamId - The team ID to get the role for
 * @returns The user's role in the team, or null if not a member
 */
function getUserRoleInTeam(
  userTeams: UserTeamMembership[],
  teamId: string
): MembershipRole | null {
  const membership = userTeams.find((m) => m.teamId === teamId);
  return membership ? (membership.role as MembershipRole) : null;
}

/**
 * Checks if a user's role meets the minimum required role.
 * Uses role hierarchy: admin > member > guest
 *
 * @param userRole - The user's actual role
 * @param requiredRoles - Array of roles that are allowed
 * @returns True if the user's role is in the allowed roles or has higher privileges
 */
function hasRequiredRole(
  userRole: MembershipRole,
  requiredRoles: MembershipRole[]
): boolean {
  // Admin can do everything - always allowed
  if (userRole === "admin") {
    return true;
  }

  // Get the minimum required hierarchy level from the allowed roles
  const minRequiredLevel = Math.min(
    ...requiredRoles.map((role) => ROLE_HIERARCHY[role])
  );

  // Check if user's role level meets or exceeds the minimum required
  return ROLE_HIERARCHY[userRole] >= minRequiredLevel;
}

/**
 * Extracts the team ID from the request context.
 * First checks for teamId cached by requireTeamAccess, then params/body.
 *
 * @param request - The Fastify request object
 * @returns The team ID or null if not found
 */
function getTeamIdFromRequest(request: FastifyRequest): string | null {
  // First check for teamId cached by requireTeamAccess middleware
  if (request.teamId) {
    return request.teamId;
  }

  const params = request.params as Record<string, string>;
  const body = request.body as Record<string, unknown> | undefined;

  // Check common parameter names for team ID
  const teamIdFields = ["teamId", "team_id"];

  for (const field of teamIdFields) {
    if (params[field]) {
      return params[field];
    }
    if (body?.[field] && typeof body[field] === "string") {
      return body[field];
    }
  }

  return null;
}

/**
 * Factory function that creates a preHandler hook for role-based authorization.
 *
 * This middleware should be used AFTER requireTeamAccess so that:
 * 1. userTeams is already populated on the request
 * 2. The team context has been established
 *
 * Role hierarchy (admin > member > guest):
 * - guest: read only
 * - member: read, create, update own resources
 * - admin: full CRUD, manage team members
 *
 * @param roles - Array of minimum roles required for this endpoint.
 *   If multiple roles are specified, the user needs to have at least one of them
 *   (or a role higher in the hierarchy).
 *
 * @returns A Fastify preHandler hook function
 *
 * @throws ForbiddenError if:
 *   - User's team memberships are not available (requireTeamAccess not called)
 *   - Team context cannot be determined
 *   - User's role is insufficient for the operation
 *
 * @example
 * // Require admin role
 * fastify.delete(
 *   "/teams/:teamId/members/:userId",
 *   { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
 *   async (request, reply) => { ... }
 * );
 *
 * @example
 * // Require member or admin role (member can create)
 * fastify.post(
 *   "/teams/:teamId/projects",
 *   { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("member")] },
 *   async (request, reply) => { ... }
 * );
 *
 * @example
 * // Guest can read (any role allowed)
 * fastify.get(
 *   "/teams/:teamId/projects",
 *   { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("guest")] },
 *   async (request, reply) => { ... }
 * );
 */
export function requireRole(
  ...roles: MembershipRole[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Ensure userTeams is available (requireTeamAccess must be called first)
    if (!request.userTeams) {
      throw new ForbiddenError(
        "Authorization context not established. Ensure requireTeamAccess is called first."
      );
    }

    // Get team ID from request context
    const teamId = getTeamIdFromRequest(request);

    if (!teamId) {
      throw new ForbiddenError(
        "Team context not found. Unable to determine team for role check."
      );
    }

    // Get user's role in this team
    const userRole = getUserRoleInTeam(request.userTeams, teamId);

    if (!userRole) {
      throw new ForbiddenError("Access denied: not a member of this team");
    }

    // Check if user has required role
    if (!hasRequiredRole(userRole, roles)) {
      const requiredRolesStr = roles.join(" or ");
      throw new ForbiddenError(
        `Access denied: requires ${requiredRolesStr} role. Your role: ${userRole}`
      );
    }
  };
}
