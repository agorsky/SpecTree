import bcrypt from "bcrypt";
import { prisma } from "../lib/db.js";

const SALT_ROUNDS = 10;

// Fields to select (excludes passwordHash for security)
const userSelectFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isActive: true,
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
 */
export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      avatarUrl: input.avatarUrl ?? null,
    },
    select: userSelectFields,
  });
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
 */
export async function softDeleteUser(id: string): Promise<UserResponse | null> {
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
 * Get a user by email with password hash (for authentication)
 * This function is internal and should only be used for authentication purposes
 */
export async function getUserByEmailWithPassword(email: string): Promise<{
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash: string;
} | null> {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      passwordHash: true,
    },
  });
}
