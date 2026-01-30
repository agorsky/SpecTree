/**
 * Test Factory Functions for SpecTree API
 *
 * These factories create test entities in the database with sensible defaults.
 * Each factory accepts optional overrides for customization.
 *
 * Usage:
 *   const user = await createTestUser({ name: 'Custom Name' });
 *   const team = await createTestTeam();
 *   const epic = await createTestEpic(team.id);
 */

import { getTestPrisma } from "../setup.js";
import type {
  User,
  Team,
  Membership,
  Epic,
  Status,
  Feature,
  Task,
} from "../../src/generated/prisma/index.js";

// =============================================================================
// Type Definitions for Factory Inputs
// =============================================================================

export interface UserInput {
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export interface TeamInput {
  name: string;
  key: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isArchived?: boolean;
}

export interface MembershipInput {
  userId: string;
  teamId: string;
  role?: string;
}

export interface EpicInput {
  teamId: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

export interface StatusInput {
  teamId: string;
  name: string;
  category: string;
  color?: string | null;
  position?: number;
}

export interface FeatureInput {
  epicId: string;
  identifier: string;
  title: string;
  description?: string | null;
  statusId?: string | null;
  assigneeId?: string | null;
  sortOrder?: number;
}

export interface TaskInput {
  featureId: string;
  identifier: string;
  title: string;
  description?: string | null;
  statusId?: string | null;
  assigneeId?: string | null;
  sortOrder?: number;
}

// =============================================================================
// Unique ID Generators
// =============================================================================

let counter = 0;

/**
 * Generates a unique suffix for test entities to avoid conflicts.
 */
function uniqueId(): string {
  counter++;
  return `${Date.now()}_${counter}`;
}

/**
 * Generates a unique email address for test users.
 */
function uniqueEmail(): string {
  return `test-user-${uniqueId()}@example.com`;
}

/**
 * Generates a unique team key (max 10 chars).
 */
function uniqueTeamKey(): string {
  // Use counter to keep keys short and unique
  return `TT${counter}${Date.now() % 10000}`.slice(0, 10);
}

/**
 * Generates a unique identifier for features/tasks.
 */
function uniqueIdentifier(prefix: string): string {
  return `${prefix}-${counter}`;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a test user in the database.
 *
 * @param overrides - Optional fields to override defaults
 * @returns The created User entity
 *
 * @example
 * const user = await createTestUser();
 * const admin = await createTestUser({ name: 'Admin User' });
 */
export async function createTestUser(
  overrides?: Partial<UserInput>
): Promise<User> {
  const prisma = getTestPrisma();

  const defaults: UserInput = {
    email: uniqueEmail(),
    name: "Test User",
    passwordHash: "$2b$10$hashedpasswordfortesting123456789", // Mock bcrypt hash
    avatarUrl: null,
    isActive: true,
  };

  const data = { ...defaults, ...overrides };

  return prisma.user.create({ data });
}

/**
 * Creates a test team in the database.
 *
 * @param overrides - Optional fields to override defaults
 * @returns The created Team entity
 *
 * @example
 * const team = await createTestTeam();
 * const devTeam = await createTestTeam({ name: 'Development', key: 'DEV' });
 */
export async function createTestTeam(
  overrides?: Partial<TeamInput>
): Promise<Team> {
  const prisma = getTestPrisma();

  const id = uniqueId();
  const defaults: TeamInput = {
    name: `Test Team ${id}`,
    key: uniqueTeamKey(),
    description: null,
    icon: null,
    color: null,
    isArchived: false,
  };

  const data = { ...defaults, ...overrides };

  return prisma.team.create({ data });
}

/**
 * Creates a test membership linking a user to a team.
 *
 * @param teamId - The team ID
 * @param userId - The user ID
 * @param overrides - Optional fields to override defaults
 * @returns The created Membership entity
 *
 * @example
 * const membership = await createTestMembership(team.id, user.id);
 * const adminMembership = await createTestMembership(team.id, user.id, { role: 'admin' });
 */
export async function createTestMembership(
  teamId: string,
  userId: string,
  overrides?: Partial<Omit<MembershipInput, "teamId" | "userId">>
): Promise<Membership> {
  const prisma = getTestPrisma();

  const defaults = {
    teamId,
    userId,
    role: "member" as const,
  };

  const data = { ...defaults, ...overrides };

  return prisma.membership.create({ data });
}

/**
 * Creates a test epic within a team.
 *
 * @param teamId - The team ID this epic belongs to
 * @param overrides - Optional fields to override defaults
 * @returns The created Epic entity
 *
 * @example
 * const epic = await createTestEpic(team.id);
 * const apiEpic = await createTestEpic(team.id, { name: 'API Epic' });
 */
export async function createTestEpic(
  teamId: string,
  overrides?: Partial<Omit<EpicInput, "teamId">>
): Promise<Epic> {
  const prisma = getTestPrisma();

  const id = uniqueId();
  const defaults = {
    teamId,
    name: `Test Epic ${id}`,
    description: null,
    icon: null,
    color: null,
    sortOrder: 0,
    isArchived: false,
  };

  const data = { ...defaults, ...overrides };

  return prisma.epic.create({ data });
}

/**
 * Creates a test status within a team.
 *
 * @param teamId - The team ID this status belongs to
 * @param overrides - Optional fields to override defaults
 * @returns The created Status entity
 *
 * @example
 * const status = await createTestStatus(team.id);
 * const inProgress = await createTestStatus(team.id, {
 *   name: 'In Progress',
 *   category: 'started'
 * });
 */
export async function createTestStatus(
  teamId: string,
  overrides?: Partial<Omit<StatusInput, "teamId">>
): Promise<Status> {
  const prisma = getTestPrisma();

  const id = uniqueId();
  const defaults = {
    teamId,
    name: `Status ${id}`,
    category: "unstarted",
    color: null,
    position: 0,
  };

  const data = { ...defaults, ...overrides };

  return prisma.status.create({ data });
}

/**
 * Creates a test feature within a epic.
 *
 * @param epicId - The epic ID this feature belongs to
 * @param overrides - Optional fields to override defaults
 * @returns The created Feature entity
 *
 * @example
 * const feature = await createTestFeature(epic.id);
 * const loginFeature = await createTestFeature(epic.id, {
 *   title: 'User Login',
 *   identifier: 'PROJ-1'
 * });
 */
export async function createTestFeature(
  epicId: string,
  overrides?: Partial<Omit<FeatureInput, "epicId">>
): Promise<Feature> {
  const prisma = getTestPrisma();

  const id = uniqueId();
  const defaults = {
    epicId,
    identifier: uniqueIdentifier("FEAT"),
    title: `Test Feature ${id}`,
    description: null,
    statusId: null,
    assigneeId: null,
    sortOrder: 0,
  };

  const data = { ...defaults, ...overrides };

  return prisma.feature.create({ data });
}

/**
 * Creates a test task within a feature.
 *
 * @param featureId - The feature ID this task belongs to
 * @param overrides - Optional fields to override defaults
 * @returns The created Task entity
 *
 * @example
 * const task = await createTestTask(feature.id);
 * const designTask = await createTestTask(feature.id, {
 *   title: 'Create mockups',
 *   identifier: 'FEAT-1-1'
 * });
 */
export async function createTestTask(
  featureId: string,
  overrides?: Partial<Omit<TaskInput, "featureId">>
): Promise<Task> {
  const prisma = getTestPrisma();

  const id = uniqueId();
  const defaults = {
    featureId,
    identifier: uniqueIdentifier("TASK"),
    title: `Test Task ${id}`,
    description: null,
    statusId: null,
    assigneeId: null,
    sortOrder: 0,
  };

  const data = { ...defaults, ...overrides };

  return prisma.task.create({ data });
}

// =============================================================================
// Composite Factory Functions
// =============================================================================

/**
 * Creates a complete test scenario with a team, user, and membership.
 * Useful for tests that need a fully set up user context.
 *
 * @param options - Optional overrides for user, team, and membership
 * @returns Object containing the created user, team, and membership
 *
 * @example
 * const { user, team, membership } = await createTestUserWithTeam();
 */
export async function createTestUserWithTeam(options?: {
  userOverrides?: Partial<UserInput>;
  teamOverrides?: Partial<TeamInput>;
  membershipOverrides?: Partial<Omit<MembershipInput, "teamId" | "userId">>;
}): Promise<{ user: User; team: Team; membership: Membership }> {
  const user = await createTestUser(options?.userOverrides);
  const team = await createTestTeam(options?.teamOverrides);
  const membership = await createTestMembership(
    team.id,
    user.id,
    options?.membershipOverrides
  );

  return { user, team, membership };
}

/**
 * Creates a complete epic hierarchy with team, epic, and optional features.
 *
 * @param options - Configuration options
 * @returns Object containing the created entities
 *
 * @example
 * const { team, epic, features } = await createTestEpicWithFeatures({
 *   featureCount: 3
 * });
 */
export async function createTestEpicWithFeatures(options?: {
  teamOverrides?: Partial<TeamInput>;
  epicOverrides?: Partial<Omit<EpicInput, "teamId">>;
  featureCount?: number;
  featureOverrides?: Partial<Omit<FeatureInput, "epicId">>;
}): Promise<{ team: Team; epic: Epic; features: Feature[] }> {
  const team = await createTestTeam(options?.teamOverrides);
  const epic = await createTestEpic(team.id, options?.epicOverrides);

  const featureCount = options?.featureCount ?? 0;
  const features: Feature[] = [];

  for (let i = 0; i < featureCount; i++) {
    const feature = await createTestFeature(epic.id, options?.featureOverrides);
    features.push(feature);
  }

  return { team, epic, features };
}

/**
 * Creates a complete workflow setup with team, statuses, epic, and feature.
 * Includes default workflow statuses (Backlog, To Do, In Progress, Done).
 *
 * @param options - Configuration options
 * @returns Object containing all created entities
 *
 * @example
 * const { team, statuses, epic, feature } = await createTestWorkflow();
 */
export async function createTestWorkflow(options?: {
  teamOverrides?: Partial<TeamInput>;
  epicOverrides?: Partial<Omit<EpicInput, "teamId">>;
  featureOverrides?: Partial<Omit<FeatureInput, "epicId">>;
}): Promise<{
  team: Team;
  statuses: {
    backlog: Status;
    todo: Status;
    inProgress: Status;
    done: Status;
  };
  epic: Epic;
  feature: Feature;
}> {
  const team = await createTestTeam(options?.teamOverrides);

  // Create workflow statuses
  const backlog = await createTestStatus(team.id, {
    name: "Backlog",
    category: "backlog",
    position: 0,
  });
  const todo = await createTestStatus(team.id, {
    name: "To Do",
    category: "unstarted",
    position: 1,
  });
  const inProgress = await createTestStatus(team.id, {
    name: "In Progress",
    category: "started",
    position: 2,
  });
  const done = await createTestStatus(team.id, {
    name: "Done",
    category: "completed",
    position: 3,
  });

  const epic = await createTestEpic(team.id, options?.epicOverrides);
  const feature = await createTestFeature(epic.id, {
    statusId: todo.id,
    ...options?.featureOverrides,
  });

  return {
    team,
    statuses: { backlog, todo, inProgress, done },
    epic,
    feature,
  };
}

/**
 * Resets the unique ID counter.
 * Call this in beforeEach if you need predictable IDs.
 */
export function resetFactoryCounter(): void {
  counter = 0;
}

// =============================================================================
// Invitation Factory Functions
// =============================================================================

export interface InvitationInput {
  email: string;
  code?: string;
  createdBy: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}

/**
 * Generates an 8-character invitation code using unambiguous characters.
 * Mimics the production code generation for test consistency.
 */
function generateTestInviteCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Creates a test invitation in the database.
 *
 * @param createdBy - The ID of the admin user creating the invitation
 * @param overrides - Optional fields to override defaults
 * @returns The created UserInvitation entity
 *
 * @example
 * const invitation = await createTestInvitation(admin.id);
 * const customInvitation = await createTestInvitation(admin.id, {
 *   email: 'custom@toro.com',
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
 * });
 */
export async function createTestInvitation(
  createdBy: string,
  overrides?: Partial<Omit<InvitationInput, "createdBy">>
) {
  const prisma = getTestPrisma();

  const defaults = {
    email: `invite-${uniqueId()}@toro.com`,
    code: generateTestInviteCode(),
    createdBy,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
    usedAt: null,
  };

  const data = { ...defaults, ...overrides };

  return prisma.userInvitation.create({ data });
}

/**
 * Creates an expired test invitation.
 *
 * @param createdBy - The ID of the admin user creating the invitation
 * @param email - Optional email override
 * @returns The created expired invitation
 *
 * @example
 * const expired = await createExpiredTestInvitation(admin.id);
 */
export async function createExpiredTestInvitation(
  createdBy: string,
  email?: string
) {
  return createTestInvitation(createdBy, {
    email: email ?? `expired-${uniqueId()}@toro.com`,
    expiresAt: new Date(Date.now() - 1000), // 1 second in the past
  });
}

/**
 * Creates a used (already activated) test invitation.
 *
 * @param createdBy - The ID of the admin user creating the invitation
 * @param email - Optional email override
 * @returns The created used invitation
 *
 * @example
 * const used = await createUsedTestInvitation(admin.id);
 */
export async function createUsedTestInvitation(
  createdBy: string,
  email?: string
) {
  return createTestInvitation(createdBy, {
    email: email ?? `used-${uniqueId()}@toro.com`,
    usedAt: new Date(),
  });
}

/**
 * Creates a global admin user for testing admin-only operations.
 *
 * @param overrides - Optional fields to override defaults
 * @returns The created global admin User entity
 *
 * @example
 * const admin = await createTestGlobalAdmin();
 * const invitation = await createTestInvitation(admin.id);
 */
export async function createTestGlobalAdmin(
  overrides?: Partial<UserInput>
): Promise<User> {
  const prisma = getTestPrisma();

  const defaults: UserInput & { isGlobalAdmin: boolean } = {
    email: `admin-${uniqueId()}@toro.com`,
    name: "Test Admin",
    passwordHash: "$2b$10$hashedpasswordfortesting123456789",
    avatarUrl: null,
    isActive: true,
    isGlobalAdmin: true,
  };

  const data = { ...defaults, ...overrides };

  return prisma.user.create({ data });
}
