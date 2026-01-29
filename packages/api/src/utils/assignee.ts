/**
 * Utility functions for resolving assignee filters.
 * Supports "me", "none", email addresses, and direct UUIDs.
 */

import { prisma } from "../lib/db.js";

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Special marker to indicate the query should filter for null assigneeId.
 * This is a Symbol to ensure it's unique and cannot be confused with any actual ID.
 */
export const ASSIGNEE_NONE = Symbol("ASSIGNEE_NONE");

/**
 * Special marker to indicate the assignee could not be resolved (invalid).
 * Queries should return empty results when this is returned.
 */
export const ASSIGNEE_INVALID = Symbol("ASSIGNEE_INVALID");

/**
 * Result type for resolveAssigneeId function
 */
export type ResolvedAssignee = string | typeof ASSIGNEE_NONE | typeof ASSIGNEE_INVALID;

/**
 * Resolves an assignee filter value to a user ID or special marker.
 *
 * Supports the following formats:
 * - "me" - resolves to the current authenticated user's ID
 * - "none" - returns ASSIGNEE_NONE marker for filtering unassigned items
 * - UUID format - returns the UUID as-is (existence not validated)
 * - email address - looks up user by email and returns their ID
 *
 * @param assignee - The assignee filter value from query params
 * @param currentUserId - The current authenticated user's ID (required for "me")
 * @returns The resolved user ID, ASSIGNEE_NONE, or ASSIGNEE_INVALID
 */
export async function resolveAssigneeId(
  assignee: string,
  currentUserId?: string
): Promise<ResolvedAssignee> {
  const normalizedAssignee = assignee.trim().toLowerCase();

  // Handle "me" - resolve to current user
  if (normalizedAssignee === "me") {
    if (!currentUserId) {
      return ASSIGNEE_INVALID;
    }
    return currentUserId;
  }

  // Handle "none" - filter for unassigned items
  if (normalizedAssignee === "none") {
    return ASSIGNEE_NONE;
  }

  // Check if it's a UUID format - return as-is
  if (UUID_REGEX.test(assignee)) {
    return assignee;
  }

  // Otherwise, treat as email and look up user
  const user = await prisma.user.findUnique({
    where: { email: assignee },
    select: { id: true, isActive: true },
  });

  // Return INVALID if user not found or inactive
  if (!user?.isActive) {
    return ASSIGNEE_INVALID;
  }

  return user.id;
}

/**
 * Checks if a resolved assignee is the ASSIGNEE_NONE marker
 */
export function isAssigneeNone(resolved: ResolvedAssignee): resolved is typeof ASSIGNEE_NONE {
  return resolved === ASSIGNEE_NONE;
}

/**
 * Checks if a resolved assignee is the ASSIGNEE_INVALID marker
 */
export function isAssigneeInvalid(resolved: ResolvedAssignee): resolved is typeof ASSIGNEE_INVALID {
  return resolved === ASSIGNEE_INVALID;
}
