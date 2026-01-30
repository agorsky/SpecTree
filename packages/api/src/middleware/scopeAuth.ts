/**
 * Scope authorization middleware for personal and team scope access control.
 * Validates user access to scopes based on ownership (personal) or membership (team).
 *
 * Access Rules:
 * - Users ALWAYS have access to their own PersonalScope
 * - Users have access to teams they're members of
 * - Users have access to projects in accessible scopes
 * - Users have access to features/tasks in accessible projects
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/db.js";
import { ForbiddenError } from "../errors/index.js";

/**
 * Scope type enumeration.
 */
export type ScopeType = "personal" | "team";

/**
 * Resolved scope information attached to the request.
 */
export interface ResolvedScope {
  type: ScopeType;
  id: string;
  /** For personal scopes, this is the owner's user ID */
  ownerId?: string | undefined;
}

/**
 * Extends FastifyRequest to include the resolved scope.
 */
declare module "fastify" {
  interface FastifyRequest {
    scope?: ResolvedScope;
  }
}

/**
 * UUID v4 regex pattern for validation.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if a user has access to a personal scope.
 * Users can only access their own personal scope.
 *
 * @param personalScopeId - The personal scope ID to check
 * @param userId - The authenticated user's ID
 * @returns True if the user owns the personal scope
 */
async function hasPersonalScopeAccess(
  personalScopeId: string,
  userId: string
): Promise<boolean> {
  const scope = await prisma.personalScope.findUnique({
    where: { id: personalScopeId },
    select: { userId: true },
  });
  return scope?.userId === userId;
}

/**
 * Checks if a user has access to a team scope.
 * Users must be members of the team to access its scope.
 *
 * @param teamId - The team ID to check
 * @param userId - The authenticated user's ID
 * @returns True if the user is a member of the team
 */
async function hasTeamScopeAccess(
  teamId: string,
  userId: string
): Promise<boolean> {
  const membership = await prisma.membership.findFirst({
    where: {
      teamId,
      userId,
    },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * Resolves the scope from a project ID.
 * A project can belong to either a personal scope or a team scope.
 *
 * @param projectId - The project ID
 * @returns The resolved scope or null if project not found
 */
async function getScopeFromProject(projectId: string): Promise<ResolvedScope | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      teamId: true,
      personalScopeId: true,
      personalScope: {
        select: { userId: true },
      },
    },
  });

  if (!project) {
    return null;
  }

  if (project.personalScopeId) {
    return {
      type: "personal",
      id: project.personalScopeId,
      ownerId: project.personalScope?.userId,
    };
  }

  if (project.teamId) {
    return {
      type: "team",
      id: project.teamId,
    };
  }

  return null;
}

/**
 * Resolves the scope from a feature ID or identifier.
 * Traverses: feature → project → scope
 *
 * @param featureIdOrIdentifier - The feature ID (UUID) or identifier (e.g., "ENG-4")
 * @returns The resolved scope or null if feature not found
 */
async function getScopeFromFeature(
  featureIdOrIdentifier: string
): Promise<ResolvedScope | null> {
  const isUuid = UUID_REGEX.test(featureIdOrIdentifier);
  const feature = await prisma.feature.findFirst({
    where: isUuid
      ? { id: featureIdOrIdentifier }
      : { identifier: featureIdOrIdentifier },
    select: {
      project: {
        select: {
          teamId: true,
          personalScopeId: true,
          personalScope: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!feature?.project) {
    return null;
  }

  if (feature.project.personalScopeId) {
    return {
      type: "personal",
      id: feature.project.personalScopeId,
      ownerId: feature.project.personalScope?.userId,
    };
  }

  if (feature.project.teamId) {
    return {
      type: "team",
      id: feature.project.teamId,
    };
  }

  return null;
}

/**
 * Resolves the scope from a task ID or identifier.
 * Traverses: task → feature → project → scope
 *
 * @param taskIdOrIdentifier - The task ID (UUID) or identifier (e.g., "ENG-4-1")
 * @returns The resolved scope or null if task not found
 */
async function getScopeFromTask(
  taskIdOrIdentifier: string
): Promise<ResolvedScope | null> {
  const isUuid = UUID_REGEX.test(taskIdOrIdentifier);
  const task = await prisma.task.findFirst({
    where: isUuid
      ? { id: taskIdOrIdentifier }
      : { identifier: taskIdOrIdentifier },
    select: {
      feature: {
        select: {
          project: {
            select: {
              teamId: true,
              personalScopeId: true,
              personalScope: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!task?.feature) {
    return null;
  }

  const project = task.feature.project;

  if (project.personalScopeId) {
    return {
      type: "personal",
      id: project.personalScopeId,
      ownerId: project.personalScope?.userId,
    };
  }

  if (project.teamId) {
    return {
      type: "team",
      id: project.teamId,
    };
  }

  return null;
}

/**
 * Resolves the scope from a status ID.
 * A status can belong to either a personal scope or a team.
 *
 * @param statusId - The status ID
 * @returns The resolved scope or null if status not found
 */
async function getScopeFromStatus(statusId: string): Promise<ResolvedScope | null> {
  const status = await prisma.status.findUnique({
    where: { id: statusId },
    select: {
      teamId: true,
      personalScopeId: true,
      personalScope: {
        select: { userId: true },
      },
    },
  });

  if (!status) {
    return null;
  }

  if (status.personalScopeId) {
    return {
      type: "personal",
      id: status.personalScopeId,
      ownerId: status.personalScope?.userId,
    };
  }

  if (status.teamId) {
    return {
      type: "team",
      id: status.teamId,
    };
  }

  return null;
}

/**
 * Validates that a user has access to a resolved scope.
 *
 * @param scope - The resolved scope
 * @param userId - The authenticated user's ID
 * @returns True if the user has access
 */
async function validateScopeAccess(
  scope: ResolvedScope,
  userId: string
): Promise<boolean> {
  if (scope.type === "personal") {
    // For personal scopes, the user must be the owner
    // If ownerId is already resolved, use it directly
    if (scope.ownerId) {
      return scope.ownerId === userId;
    }
    // Otherwise, look it up
    return hasPersonalScopeAccess(scope.id, userId);
  }

  // For team scopes, check membership
  return hasTeamScopeAccess(scope.id, userId);
}

/**
 * Resource types supported for scope resolution.
 */
export type ResourceType =
  | "personalScopeId"
  | "personal_scope_id"
  | "teamId"
  | "team_id"
  | "projectId"
  | "project_id"
  | "featureId"
  | "feature_id"
  | "taskId"
  | "task_id"
  | "statusId"
  | "status_id";

/**
 * Factory function that creates a preHandler hook for scope access authorization.
 *
 * The middleware resolves the scope from the specified parameter (or body),
 * validates user access, and attaches the resolved scope to the request.
 *
 * @param scopeParam - Name of the param or body field containing the scope reference.
 *   Supports special values for different resource types:
 *   - "personalScopeId" or "personal_scope_id": Direct personal scope ID
 *   - "teamId" or "team_id": Direct team ID (treated as team scope)
 *   - "projectId" or "project_id": Resolve scope via project
 *   - "featureId" or "feature_id": Resolve scope via feature → project
 *   - "taskId" or "task_id": Resolve scope via task → feature → project
 *   - "statusId" or "status_id": Resolve scope via status
 *
 *   Also supports mapping syntax "paramName:resourceType" for routes where the
 *   param name differs from the resource type (e.g., "id:projectId" means
 *   read from params.id but treat it as a projectId).
 *
 * @returns A Fastify preHandler hook function
 *
 * @throws ForbiddenError if:
 *   - User is not authenticated
 *   - Scope/resource ID is not provided
 *   - Resource is not found
 *   - User does not have access to the scope
 *
 * @example
 * // Direct personal scope access check
 * fastify.get(
 *   "/personal/:personalScopeId/projects",
 *   { preHandler: [authenticate, requireScopeAccess("personalScopeId")] },
 *   async (request, reply) => { ... }
 * );
 *
 * @example
 * // Project-based scope access check with mapped param
 * fastify.get(
 *   "/projects/:id",
 *   { preHandler: [authenticate, requireScopeAccess("id:projectId")] },
 *   async (request, reply) => { ... }
 * );
 */
export function requireScopeAccess(
  scopeParam: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // User must be authenticated
    if (!request.user) {
      throw new ForbiddenError("User not authenticated");
    }

    const userId = request.user.id;

    // Get the resource ID from params or body
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, unknown> | undefined;

    // Support mapping syntax "paramName:resourceType" (e.g., "id:projectId")
    let paramName = scopeParam;
    let resourceType = scopeParam;
    if (scopeParam.includes(":")) {
      const parts = scopeParam.split(":");
      if (parts.length === 2 && parts[0] && parts[1]) {
        paramName = parts[0];
        resourceType = parts[1];
      }
    }

    const resourceId = params[paramName] ?? (body?.[paramName] as string | undefined);

    if (!resourceId) {
      throw new ForbiddenError(`Missing required parameter: ${paramName}`);
    }

    // Resolve scope based on the resource type
    let scope: ResolvedScope | null = null;
    const typeLower = resourceType.toLowerCase();

    if (typeLower === "personalscopeid" || typeLower === "personal_scope_id") {
      // Direct personal scope ID
      scope = {
        type: "personal",
        id: resourceId,
      };
    } else if (typeLower === "teamid" || typeLower === "team_id") {
      // Direct team ID - treat as team scope
      scope = {
        type: "team",
        id: resourceId,
      };
    } else if (typeLower === "projectid" || typeLower === "project_id") {
      // Resolve scope via project
      scope = await getScopeFromProject(resourceId);
      if (!scope) {
        throw new ForbiddenError("Project not found");
      }
    } else if (typeLower === "featureid" || typeLower === "feature_id") {
      // Resolve scope via feature → project
      scope = await getScopeFromFeature(resourceId);
      if (!scope) {
        throw new ForbiddenError("Feature not found");
      }
    } else if (typeLower === "taskid" || typeLower === "task_id") {
      // Resolve scope via task → feature → project
      scope = await getScopeFromTask(resourceId);
      if (!scope) {
        throw new ForbiddenError("Task not found");
      }
    } else if (typeLower === "statusid" || typeLower === "status_id") {
      // Resolve scope via status
      scope = await getScopeFromStatus(resourceId);
      if (!scope) {
        throw new ForbiddenError("Status not found");
      }
    } else {
      // Unknown resource type - treat as direct team ID for backward compatibility
      scope = {
        type: "team",
        id: resourceId,
      };
    }

    // Validate user has access to the scope
    const hasAccess = await validateScopeAccess(scope, userId);

    if (!hasAccess) {
      if (scope.type === "personal") {
        throw new ForbiddenError("Access denied: not the owner of this personal scope");
      } else {
        throw new ForbiddenError("Access denied: not a member of this team");
      }
    }

    // Attach resolved scope to request for use by route handlers
    request.scope = scope;
  };
}

// Export helper functions for direct use in services
export {
  hasPersonalScopeAccess,
  hasTeamScopeAccess,
  getScopeFromProject,
  getScopeFromFeature,
  getScopeFromTask,
  getScopeFromStatus,
  validateScopeAccess,
};
