/**
 * Utility functions for resolving user's accessible scopes.
 * Used by list queries to filter results based on visibility rules.
 */

import { prisma } from "../lib/db.js";

/**
 * Represents a user's accessible scopes (their personal scope + teams they're members of)
 */
export interface AccessibleScopes {
  /** User's personal scope ID (null if they don't have one) */
  personalScopeId: string | null;
  /** Array of team IDs the user has membership in */
  teamIds: string[];
}

/**
 * Get all accessible scopes for a user.
 * Returns the user's personal scope ID and all team IDs where they have membership.
 *
 * @param userId - The user's ID
 * @returns AccessibleScopes object with personalScopeId and teamIds
 */
export async function getAccessibleScopes(userId: string): Promise<AccessibleScopes> {
  // Run both queries in parallel for efficiency
  const [personalScope, memberships] = await Promise.all([
    prisma.personalScope.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.membership.findMany({
      where: {
        userId,
        team: { isArchived: false },
      },
      select: { teamId: true },
    }),
  ]);

  return {
    personalScopeId: personalScope?.id ?? null,
    teamIds: memberships.map((m) => m.teamId),
  };
}

/**
 * Check if a user has any accessible scopes.
 * Useful for early exit in list queries.
 *
 * @param scopes - The AccessibleScopes object
 * @returns true if the user has at least one accessible scope
 */
export function hasAccessibleScopes(scopes: AccessibleScopes): boolean {
  return scopes.personalScopeId !== null || scopes.teamIds.length > 0;
}
