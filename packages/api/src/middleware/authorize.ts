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
 * Special marker for personal scope resources.
 * When a resource belongs to a personal scope (not a team), we use this
 * to indicate that team-based authorization should be bypassed in favor
 * of personal scope ownership checks.
 */
export const PERSONAL_SCOPE_MARKER = "__personal_scope__";

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
    /** The personal scope ID if the resource belongs to a personal scope */
    personalScopeId?: string;
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
 * Result of looking up a project for authorization.
 * Contains teamId (null for personal projects) and personalScopeId if applicable.
 */
interface ProjectAuthInfo {
  teamId: string | null;
  personalScopeId: string | null;
}

/**
 * Looks up the team ID for a project.
 * Supports both UUID and exact project name lookups.
 *
 * For personal scope projects (teamId = null), returns the personalScopeId
 * to enable ownership verification.
 *
 * @param projectIdOrName - The project ID (UUID) or exact name
 * @returns Project auth info or null if project not found
 */
async function getProjectAuthInfo(projectIdOrName: string): Promise<ProjectAuthInfo | null> {
  const isUuid = UUID_REGEX.test(projectIdOrName);
  const project = await prisma.project.findFirst({
    where: isUuid
      ? { id: projectIdOrName }
      : { name: projectIdOrName },
    select: { teamId: true, personalScopeId: true },
  });

  if (!project) {
    return null;
  }

  return {
    teamId: project.teamId,
    personalScopeId: project.personalScopeId,
  };
}

/**
 * Looks up the team ID for a project (legacy function for compatibility).
 * Use getProjectAuthInfo for full support including personal scope.
 *
 * @param projectIdOrName - The project ID (UUID) or exact name
 * @returns The team ID, PERSONAL_SCOPE_MARKER for personal projects, or null if not found
 */
async function getTeamIdFromProject(projectIdOrName: string): Promise<string | null> {
  const authInfo = await getProjectAuthInfo(projectIdOrName);
  if (!authInfo) {
    return null;
  }
  // For personal scope projects, return marker
  if (authInfo.teamId === null && authInfo.personalScopeId) {
    return PERSONAL_SCOPE_MARKER;
  }
  return authInfo.teamId;
}

/**
 * Looks up the team ID for a feature (via project).
 * Supports both UUID and identifier (e.g., "ENG-4") lookups.
 *
 * @param featureIdOrIdentifier - The feature ID (UUID) or identifier
 * @returns The team ID, PERSONAL_SCOPE_MARKER for personal features, or null if not found
 */
async function getTeamIdFromFeature(featureIdOrIdentifier: string): Promise<string | null> {
  const isUuid = UUID_REGEX.test(featureIdOrIdentifier);
  const feature = await prisma.feature.findFirst({
    where: isUuid
      ? { id: featureIdOrIdentifier }
      : { identifier: featureIdOrIdentifier },
    select: { project: { select: { teamId: true, personalScopeId: true } } },
  });
  if (!feature) {
    return null;
  }
  // For personal scope features, return marker
  if (feature.project.teamId === null && feature.project.personalScopeId) {
    return PERSONAL_SCOPE_MARKER;
  }
  return feature.project.teamId ?? null;
}

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Looks up the team ID for a task (via feature → project).
 * Supports both UUID and identifier (e.g., "ENG-4-1") lookups.
 *
 * @param taskIdOrIdentifier - The task ID (UUID) or identifier (e.g., "ENG-4-1")
 * @returns The team ID, PERSONAL_SCOPE_MARKER for personal tasks, or null if not found
 */
async function getTeamIdFromTask(taskIdOrIdentifier: string): Promise<string | null> {
  const isUuid = UUID_REGEX.test(taskIdOrIdentifier);
  const task = await prisma.task.findFirst({
    where: isUuid
      ? { id: taskIdOrIdentifier }
      : { identifier: taskIdOrIdentifier },
    select: { feature: { select: { project: { select: { teamId: true, personalScopeId: true } } } } },
  });
  if (!task) {
    return null;
  }
  // For personal scope tasks, return marker
  if (task.feature.project.teamId === null && task.feature.project.personalScopeId) {
    return PERSONAL_SCOPE_MARKER;
  }
  return task.feature.project.teamId ?? null;
}

/**
 * Looks up the team ID for a status.
 * For personal statuses, returns PERSONAL_SCOPE_MARKER.
 *
 * @param statusId - The status ID
 * @returns The team ID, PERSONAL_SCOPE_MARKER for personal statuses, or null if not found
 */
async function getTeamIdFromStatus(statusId: string): Promise<string | null> {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: { teamId: true, personalScopeId: true },
  });
  if (!status) {
    return null;
  }
  // For personal scope statuses, return marker
  if (status.teamId === null && status.personalScopeId) {
    return PERSONAL_SCOPE_MARKER;
  }
  return status.teamId ?? null;
}

/**
 * Resolves a team ID, name, or key to the actual team UUID.
 * Supports UUID (e.g., "550e8400-..."), team key (e.g., "ENG"), or team name (e.g., "Engineering").
 *
 * @param teamIdOrNameOrKey - The team ID (UUID), name, or key
 * @returns The team UUID or null if not found
 */
async function resolveTeamId(teamIdOrNameOrKey: string): Promise<string | null> {
  const isUuid = UUID_REGEX.test(teamIdOrNameOrKey);

  if (isUuid) {
    // Verify the UUID exists
    const team = await prisma.team.findUnique({
      where: { id: teamIdOrNameOrKey, isArchived: false },
      select: { id: true },
    });
    return team?.id ?? null;
  }

  // Try lookup by key first (exact match)
  let team = await prisma.team.findFirst({
    where: {
      key: teamIdOrNameOrKey,
      isArchived: false,
    },
    select: { id: true },
  });

  if (team) {
    return team.id;
  }

  // Try key uppercase (keys are typically uppercase like "ENG")
  team = await prisma.team.findFirst({
    where: {
      key: teamIdOrNameOrKey.toUpperCase(),
      isArchived: false,
    },
    select: { id: true },
  });

  if (team) {
    return team.id;
  }

  // Fall back to name lookup (exact match)
  team = await prisma.team.findFirst({
    where: {
      name: teamIdOrNameOrKey,
      isArchived: false,
    },
    select: { id: true },
  });

  return team?.id ?? null;
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
      // Direct team ID - resolve name/key to UUID if needed
      teamId = await resolveTeamId(resourceId);
      if (!teamId) {
        throw new ForbiddenError("Team not found");
      }
    } else if (typeLower === "projectid" || typeLower === "project_id") {
      // Lookup team via project (supports UUID and name)
      teamId = await getTeamIdFromProject(resourceId);
      if (teamId === null) {
        throw new ForbiddenError("Project not found");
      }
    } else if (typeLower === "featureid" || typeLower === "feature_id") {
      // Lookup team via feature → project
      teamId = await getTeamIdFromFeature(resourceId);
      if (teamId === null) {
        throw new ForbiddenError("Feature not found");
      }
    } else if (typeLower === "taskid" || typeLower === "task_id") {
      // Lookup team via task → feature → project
      teamId = await getTeamIdFromTask(resourceId);
      if (teamId === null) {
        throw new ForbiddenError("Task not found");
      }
    } else if (typeLower === "statusid" || typeLower === "status_id") {
      // Lookup team via status
      teamId = await getTeamIdFromStatus(resourceId);
      if (teamId === null) {
        throw new ForbiddenError("Status not found");
      }
    } else {
      // Unknown resource type - try to resolve as team ID/name/key
      teamId = await resolveTeamId(resourceId);
      if (!teamId) {
        // Not a known team, treat as direct ID (for backwards compatibility)
        teamId = resourceId;
      }
    }

    // Handle personal scope resources - allow access if user owns the personal scope
    if (teamId === PERSONAL_SCOPE_MARKER) {
      // Personal scope resources don't require team membership
      // The resource itself validates ownership (via user's personal scope ID)
      // Don't set teamId - leave it undefined for personal scope
      return;  // Allow access - actual ownership validated by route handler
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

    // If no team context, this is a personal scope resource
    // For personal scope, the user has full access to their own resources
    // (ownership is validated by the API token, which links to the user's personal scope)
    if (!teamId) {
      // Personal scope - allow access (user owns their personal resources)
      return;
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
