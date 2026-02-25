import { prisma } from "../lib/db.js";
import type { PersonalScope, Status, Prisma } from "../generated/prisma/index.js";
import { NotFoundError, ConflictError } from "../errors/index.js";

type TransactionClient = Prisma.TransactionClient;

// Valid StatusCategory values (same as statusService)
const VALID_CATEGORIES = ["backlog", "unstarted", "started", "completed", "canceled"] as const;
type StatusCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Default status configurations for new personal scopes.
 * Same structure as team default statuses for consistency.
 */
const DEFAULT_PERSONAL_STATUSES: Array<{
  name: string;
  category: StatusCategory;
  position: number;
}> = [
  { name: "Backlog", category: "backlog", position: 0 },
  { name: "Todo", category: "unstarted", position: 1 },
  { name: "In Progress", category: "started", position: 2 },
  { name: "Done", category: "completed", position: 3 },
  { name: "Canceled", category: "canceled", position: 4 },
];

// Types for PersonalScope operations
export interface PersonalScopeWithCount extends PersonalScope {
  _count: {
    epics: number;
    statuses: number;
  };
}

/**
 * Get a PersonalScope by its ID.
 * Returns null if not found.
 */
export async function getPersonalScopeById(id: string): Promise<PersonalScopeWithCount | null> {
  return prisma.personalScope.findUnique({
    where: { id },
    include: { _count: { select: { epics: true, statuses: true } } },
  }) as Promise<PersonalScopeWithCount | null>;
}

/**
 * Get a PersonalScope by user ID.
 * Returns null if the user has no personal scope.
 */
export async function getPersonalScopeByUserId(userId: string): Promise<PersonalScopeWithCount | null> {
  return prisma.personalScope.findUnique({
    where: { userId },
    include: { _count: { select: { epics: true, statuses: true } } },
  }) as Promise<PersonalScopeWithCount | null>;
}

/**
 * Get a user's PersonalScope.
 * Returns null if the user has no personal scope.
 * Alias for getPersonalScopeByUserId for cleaner API usage.
 */
export async function getPersonalScope(userId: string): Promise<PersonalScopeWithCount | null> {
  return getPersonalScopeByUserId(userId);
}

/**
 * Check if a user already has a PersonalScope.
 */
export async function userHasPersonalScope(userId: string): Promise<boolean> {
  const scope = await prisma.personalScope.findUnique({
    where: { userId },
    select: { id: true },
  });
  return scope !== null;
}

/**
 * Create a PersonalScope for a user.
 * Enforces the constraint that each user can only have one PersonalScope.
 * Creates default statuses for the new scope.
 *
 * @throws ConflictError if the user already has a PersonalScope
 * @throws NotFoundError if the user does not exist
 */
export async function createPersonalScope(userId: string): Promise<PersonalScope> {
  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundError(`User with id '${userId}' not found`);
  }

  // Check if user already has a PersonalScope
  if (await userHasPersonalScope(userId)) {
    throw new ConflictError(`User already has a PersonalScope`);
  }

  // Create PersonalScope and default statuses in a transaction
  return prisma.$transaction(async (tx) => {
    return createPersonalScopeInTransaction(tx, userId);
  });
}

/**
 * Create a PersonalScope within an existing Prisma transaction.
 * Used by createUser to ensure user + personal scope are created atomically.
 */
export async function createPersonalScopeInTransaction(
  tx: TransactionClient,
  userId: string
): Promise<PersonalScope> {
  const personalScope = await tx.personalScope.create({
    data: { userId },
  });

  for (const statusConfig of DEFAULT_PERSONAL_STATUSES) {
    await tx.status.create({
      data: {
        name: statusConfig.name,
        personalScopeId: personalScope.id,
        category: statusConfig.category,
        position: statusConfig.position,
      },
    });
  }

  return personalScope;
}

/**
 * Create default statuses for an existing PersonalScope.
 * Useful for migration scenarios where a PersonalScope exists but has no statuses.
 *
 * @throws NotFoundError if the PersonalScope does not exist
 */
export async function createDefaultStatuses(personalScopeId: string): Promise<Status[]> {
  // Verify PersonalScope exists
  const scope = await prisma.personalScope.findUnique({
    where: { id: personalScopeId },
    select: { id: true },
  });
  if (!scope) {
    throw new NotFoundError(`PersonalScope with id '${personalScopeId}' not found`);
  }

  return prisma.$transaction(async (tx) => {
    const statuses: Status[] = [];

    for (const statusConfig of DEFAULT_PERSONAL_STATUSES) {
      const status = await tx.status.create({
        data: {
          name: statusConfig.name,
          personalScopeId,
          category: statusConfig.category,
          position: statusConfig.position,
        },
      });
      statuses.push(status);
    }

    return statuses;
  });
}

/**
 * Get the default "Backlog" status for a PersonalScope.
 * Returns null if no backlog status exists.
 */
export async function getDefaultBacklogStatus(personalScopeId: string): Promise<Status | null> {
  return prisma.status.findFirst({
    where: {
      personalScopeId,
      category: "backlog",
    },
    orderBy: { position: "asc" },
  });
}

/**
 * Check if an epic belongs to a user's personal scope.
 * Useful for authorization checks.
 */
export async function isEpicInPersonalScope(epicId: string, userId: string): Promise<boolean> {
  const epic = await prisma.epic.findFirst({
    where: {
      id: epicId,
      personalScope: { userId },
    },
    select: { id: true },
  });
  return epic !== null;
}

/**
 * Check if an epic request belongs to a user's personal scope.
 * Returns true if the epic request has a personalScopeId and that scope belongs to the given user.
 * Useful for authorization checks on personal epic requests.
 */
export async function isEpicRequestInPersonalScope(epicRequestId: string, userId: string): Promise<boolean> {
  const epicRequest = await prisma.epicRequest.findFirst({
    where: {
      id: epicRequestId,
      personalScope: { userId },
    },
    select: { id: true },
  });
  return epicRequest !== null;
}

/**
 * Check if a user owns a specific PersonalScope.
 */
export async function isPersonalScopeOwner(personalScopeId: string, userId: string): Promise<boolean> {
  const scope = await prisma.personalScope.findUnique({
    where: { id: personalScopeId },
    select: { userId: true },
  });
  return scope?.userId === userId;
}
