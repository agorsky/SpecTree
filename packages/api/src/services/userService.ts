import bcrypt from "bcrypt";
import { prisma } from "../lib/db.js";
import { createPersonalScope } from "./personalScopeService.js";
import { getTeamsWhereUserIsLastAdmin } from "./membershipService.js";
import { ForbiddenError } from "../errors/index.js";

const SALT_ROUNDS = 10;

// Fields to select (excludes passwordHash for security)
const userSelectFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isActive: true,
  timeZone: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: false,
} as const;

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  timeZone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  avatarUrl?: string | null;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  timeZone?: string | null;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get paginated list of users
 */
export async function getUsers(
  params: PaginationParams = {}
): Promise<PaginatedResponse<UserResponse>> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: userSelectFields,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
  ]);

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single user by ID
 */
export async function getUserById(id: string): Promise<UserResponse | null> {
  return prisma.user.findUnique({
    where: { id },
    select: userSelectFields,
  });
}

/**
 * Get the current user (placeholder - returns first active user)
 */
export async function getCurrentUser(): Promise<UserResponse | null> {
  return prisma.user.findFirst({
    where: { isActive: true },
    select: userSelectFields,
  });
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<UserResponse | null> {
  return prisma.user.findUnique({
    where: { email },
    select: userSelectFields,
  });
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string, excludeId?: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;
  if (excludeId && user.id === excludeId) return false;
  return true;
}

/**
 * Create a new user
 * Automatically provisions a PersonalScope for the new user.
 * Users must be invited to teams (no auto-join).
 */
export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      avatarUrl: input.avatarUrl ?? null,
    },
    select: {
      ...userSelectFields,
      id: true,
    },
  });

  // Create PersonalScope for the new user (with default statuses)
  await createPersonalScope(user.id);

  return user;
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<UserResponse | null> {
  // Build update data
  const updateData: {
    email?: string;
    name?: string;
    passwordHash?: string;
    avatarUrl?: string | null;
    isActive?: boolean;
    timeZone?: string | null;
  } = {};

  if (input.email !== undefined) {
    updateData.email = input.email;
  }
  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }
  if (input.avatarUrl !== undefined) {
    updateData.avatarUrl = input.avatarUrl;
  }
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }
  if (input.timeZone !== undefined) {
    updateData.timeZone = input.timeZone;
  }

  try {
    return await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelectFields,
    });
  } catch {
    // User not found
    return null;
  }
}

/**
 * Soft delete a user (set isActive = false)
 * 
 * GUARDRAIL: Cannot delete a user if they are the last admin of any team.
 * This prevents orphaning teams without administrators.
 */
export async function softDeleteUser(id: string): Promise<UserResponse | null> {
  // GUARDRAIL: Check if user is the last admin of any team
  const lastAdminTeams = await getTeamsWhereUserIsLastAdmin(id);
  if (lastAdminTeams.length > 0) {
    // Get team names for a more helpful error message
    const teams = await prisma.team.findMany({
      where: { id: { in: lastAdminTeams } },
      select: { name: true },
    });
    const teamNames = teams.map((t) => t.name).join(", ");
    throw new ForbiddenError(
      `Cannot delete user who is the last admin of team(s): ${teamNames}. Promote another member to admin first.`
    );
  }

  try {
    return await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelectFields,
    });
  } catch {
    // User not found
    return null;
  }
}

/**
 * Hard delete a user (permanently remove from database)
 * 
 * GUARDRAIL: Cannot delete a user if they are the last admin of any team.
 * This prevents orphaning teams without administrators.
 */
export async function hardDeleteUser(id: string): Promise<boolean> {
  // GUARDRAIL: Check if user is the last admin of any team
  const lastAdminTeams = await getTeamsWhereUserIsLastAdmin(id);
  if (lastAdminTeams.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: lastAdminTeams } },
      select: { name: true },
    });
    const teamNames = teams.map((t) => t.name).join(", ");
    throw new ForbiddenError(
      `Cannot delete user who is the last admin of team(s): ${teamNames}. Promote another member to admin first.`
    );
  }

  try {
    await prisma.user.delete({
      where: { id },
    });
    return true;
  } catch {
    // User not found
    return false;
  }
}


/**
 * Get a user by email with password hash (for authentication)
 * This function is internal and should only be used for authentication purposes
 */
export async function getUserByEmailWithPassword(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash: string;
  teamId: string | null;
  role: string | null;
} | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      isGlobalAdmin: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
      memberships: {
        select: {
          teamId: true,
          role: true,
        },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const membership = user.memberships[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    isGlobalAdmin: user.isGlobalAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    passwordHash: user.passwordHash,
    teamId: membership?.teamId ?? null,
    role: membership?.role ?? null,
  };
}
