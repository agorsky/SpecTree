import { prisma } from "../lib/db.js";
import type { Membership } from "../generated/prisma/index.js";
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from "../errors/index.js";

// Valid membership roles (SQL Server doesn't support native enums)
export const VALID_ROLES = ["admin", "member", "guest"] as const;
export type MembershipRole = (typeof VALID_ROLES)[number];

/**
 * Validate that a role string is a valid MembershipRole
 */
export function isValidRole(role: string): role is MembershipRole {
  return VALID_ROLES.includes(role as MembershipRole);
}

// User fields to include (exclude passwordHash for security)
const userSelectFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
} as const;

// Team fields to include
const teamSelectFields = {
  id: true,
  name: true,
  key: true,
  description: true,
  icon: true,
  color: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Response types
export interface MembershipWithUser {
  id: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface MembershipWithTeam {
  id: string;
  role: string;
  createdAt: Date;
  team: {
    id: string;
    name: string;
    key: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

// Input types
export interface AddMemberInput {
  userId: string;
  role?: MembershipRole | undefined;
}

export interface UpdateMemberRoleInput {
  role: MembershipRole;
}

/**
 * Check if a team exists and is not archived
 */
async function assertTeamExists(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, isArchived: true },
  });

  if (!team || team.isArchived) {
    throw new NotFoundError(`Team with id '${teamId}' not found`);
  }
}

/**
 * Check if a user exists and is active
 */
async function assertUserExists(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user?.isActive) {
    throw new NotFoundError(`User with id '${userId}' not found`);
  }
}

/**
 * List all members of a team
 */
export async function listTeamMembers(teamId: string): Promise<MembershipWithUser[]> {
  await assertTeamExists(teamId);

  const memberships = await prisma.membership.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: userSelectFields,
      },
    },
  });

  return memberships;
}

/**
 * Add a user to a team
 */
export async function addMemberToTeam(
  teamId: string,
  input: AddMemberInput
): Promise<Membership> {
  // Validate role if provided
  if (input.role !== undefined && !isValidRole(input.role)) {
    throw new ValidationError(
      `Invalid role '${String(input.role)}'. Must be one of: ${VALID_ROLES.join(", ")}`
    );
  }

  // Check team exists
  await assertTeamExists(teamId);

  // Check user exists
  await assertUserExists(input.userId);

  // Check if membership already exists
  const existingMembership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: input.userId,
        teamId,
      },
    },
  });

  if (existingMembership) {
    throw new ConflictError("User is already a member of this team");
  }

  // Create membership
  const data: { userId: string; teamId: string; role?: string } = {
    userId: input.userId,
    teamId,
  };
  if (input.role !== undefined) {
    data.role = input.role;
  }

  return prisma.membership.create({
    data,
  });
}

/**
 * Update a member's role in a team
 */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  input: UpdateMemberRoleInput
): Promise<Membership> {
  // Validate role
  if (!isValidRole(input.role)) {
    throw new ValidationError(
      `Invalid role '${String(input.role)}'. Must be one of: ${VALID_ROLES.join(", ")}`
    );
  }

  // Check team exists
  await assertTeamExists(teamId);

  // Find existing membership
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (!membership) {
    throw new NotFoundError(
      `Membership for user '${userId}' in team '${teamId}' not found`
    );
  }

  // GUARDRAIL: Prevent demoting the last admin
  // Only check if we're demoting from admin to a non-admin role
  if (membership.role === "admin" && input.role !== "admin") {
    const userIsLastAdmin = await isLastAdmin(teamId, userId);
    if (userIsLastAdmin) {
      throw new ForbiddenError(
        "Cannot demote the last admin of a team. Promote another member to admin first."
      );
    }
  }

  // Update membership
  return prisma.membership.update({
    where: { id: membership.id },
    data: { role: input.role },
  });
}

/**
 * Remove a user from a team
 */
export async function removeMemberFromTeam(
  teamId: string,
  userId: string
): Promise<void> {
  // Check team exists
  await assertTeamExists(teamId);

  // Find existing membership
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  if (!membership) {
    throw new NotFoundError(
      `Membership for user '${userId}' in team '${teamId}' not found`
    );
  }

  // GUARDRAIL: Prevent removing the last admin
  if (membership.role === "admin") {
    const userIsLastAdmin = await isLastAdmin(teamId, userId);
    if (userIsLastAdmin) {
      throw new ForbiddenError(
        "Cannot remove the last admin from a team. Promote another member to admin first."
      );
    }
  }

  // Delete membership
  await prisma.membership.delete({
    where: { id: membership.id },
  });
}

/**
 * Check if a user is the last admin of a specific team.
 * Returns true if the user is an admin AND there are no other admins.
 */
export async function isLastAdmin(teamId: string, userId: string): Promise<boolean> {
  // Count admins for this team
  const adminCount = await prisma.membership.count({
    where: {
      teamId,
      role: "admin",
    },
  });

  // If more than one admin, user cannot be the last admin
  if (adminCount > 1) {
    return false;
  }

  // If exactly one admin, check if it's this user
  if (adminCount === 1) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      select: { role: true },
    });

    return membership?.role === "admin";
  }

  // No admins at all - user cannot be the last admin
  return false;
}

/**
 * Check if a user is the last admin of ANY team they belong to.
 * Returns array of team IDs where user is the last admin.
 */
export async function getTeamsWhereUserIsLastAdmin(userId: string): Promise<string[]> {
  // Get all teams where this user is an admin
  const adminMemberships = await prisma.membership.findMany({
    where: {
      userId,
      role: "admin",
    },
    select: { teamId: true },
  });

  const lastAdminTeamIds: string[] = [];

  for (const membership of adminMemberships) {
    // Count admins for this team
    const adminCount = await prisma.membership.count({
      where: {
        teamId: membership.teamId,
        role: "admin",
      },
    });

    // If only one admin (this user), add to the list
    if (adminCount === 1) {
      lastAdminTeamIds.push(membership.teamId);
    }
  }

  return lastAdminTeamIds;
}

/**
 * List all teams a user is a member of
 */
export async function listUserTeams(userId: string): Promise<MembershipWithTeam[]> {
  await assertUserExists(userId);

  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      team: {
        isArchived: false,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      team: {
        select: teamSelectFields,
      },
    },
  });

  return memberships;
}
