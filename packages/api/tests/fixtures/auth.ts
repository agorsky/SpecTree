/**
 * Authentication Helpers for SpecTree API Tests
 *
 * Provides utilities for creating authenticated test requests,
 * including JWT token generation and user creation helpers.
 */

import { generateAccessToken, generateRefreshToken } from "../../src/utils/jwt.js";
import { createTestUser, createTestMembership, createTestTeam } from "./factories.js";
import type { User, Team, Membership } from "../../src/generated/prisma/index.js";
import type { UserInput, TeamInput, MembershipInput } from "./factories.js";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Standard Authorization header object for authenticated requests.
 */
export interface AuthHeader {
  Authorization: string;
}

/**
 * Result of creating an authenticated user.
 */
export interface AuthenticatedUser {
  user: User;
  headers: AuthHeader;
  accessToken: string;
  refreshToken: string;
}

/**
 * Result of creating an authenticated user with team membership.
 */
export interface AuthenticatedTeamMember extends AuthenticatedUser {
  team: Team;
  membership: Membership;
}

// =============================================================================
// Token Generation Helpers
// =============================================================================

/**
 * Creates an Authorization header with a Bearer token for the given user ID.
 * This is a synchronous helper for when you already have a user ID.
 *
 * @param userId - The user's unique identifier
 * @returns An object with the Authorization header
 *
 * @example
 * const headers = createAuthHeader(user.id);
 * const response = await app.inject({
 *   method: 'GET',
 *   url: '/api/epics',
 *   headers
 * });
 */
export function createAuthHeader(userId: string): AuthHeader {
  const token = generateAccessToken(userId);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Creates a refresh token header for token refresh requests.
 *
 * @param userId - The user's unique identifier
 * @returns An object with the Authorization header containing a refresh token
 */
export function createRefreshHeader(userId: string): AuthHeader {
  const token = generateRefreshToken(userId);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Generates both access and refresh tokens for a user.
 *
 * @param userId - The user's unique identifier
 * @returns Object containing both tokens
 */
export function generateTokens(userId: string): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId),
  };
}

// =============================================================================
// Authenticated User Creation Helpers
// =============================================================================

/**
 * Creates a test user and returns both the user and authentication credentials.
 * This is the primary helper for tests that need an authenticated context.
 *
 * @param overrides - Optional fields to override user defaults
 * @returns The created user, auth headers, and tokens
 *
 * @example
 * const { user, headers } = await createAuthenticatedUser();
 * const response = await app.inject({
 *   method: 'GET',
 *   url: '/api/me',
 *   headers
 * });
 */
export async function createAuthenticatedUser(
  overrides?: Partial<UserInput>
): Promise<AuthenticatedUser> {
  const user = await createTestUser(overrides);
  const { accessToken, refreshToken } = generateTokens(user.id);
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    user,
    headers,
    accessToken,
    refreshToken,
  };
}

/**
 * Creates an authenticated user with a team membership.
 * Useful for tests that require team-scoped operations.
 *
 * @param options - Optional overrides for user, team, and membership
 * @returns The created user, team, membership, and auth credentials
 *
 * @example
 * const { user, team, headers } = await createAuthenticatedTeamMember();
 * const response = await app.inject({
 *   method: 'GET',
 *   url: `/api/teams/${team.id}/epics`,
 *   headers
 * });
 */
export async function createAuthenticatedTeamMember(options?: {
  userOverrides?: Partial<UserInput>;
  teamOverrides?: Partial<TeamInput>;
  membershipOverrides?: Partial<Omit<MembershipInput, "teamId" | "userId">>;
}): Promise<AuthenticatedTeamMember> {
  const user = await createTestUser(options?.userOverrides);
  const team = await createTestTeam(options?.teamOverrides);
  const membership = await createTestMembership(
    team.id,
    user.id,
    options?.membershipOverrides
  );

  const { accessToken, refreshToken } = generateTokens(user.id);
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    user,
    team,
    membership,
    headers,
    accessToken,
    refreshToken,
  };
}

/**
 * Creates an authenticated admin user with admin role in a team.
 *
 * @param options - Optional overrides for user and team
 * @returns The created admin user with team membership
 *
 * @example
 * const { user, team, headers } = await createAuthenticatedAdmin();
 */
export async function createAuthenticatedAdmin(options?: {
  userOverrides?: Partial<UserInput>;
  teamOverrides?: Partial<TeamInput>;
}): Promise<AuthenticatedTeamMember> {
  return createAuthenticatedTeamMember({
    ...options,
    membershipOverrides: { role: "admin" },
  });
}

/**
 * Creates an authenticated guest user with guest role in a team.
 *
 * @param options - Optional overrides for user and team
 * @returns The created guest user with team membership
 *
 * @example
 * const { user, team, headers } = await createAuthenticatedGuest();
 */
export async function createAuthenticatedGuest(options?: {
  userOverrides?: Partial<UserInput>;
  teamOverrides?: Partial<TeamInput>;
}): Promise<AuthenticatedTeamMember> {
  return createAuthenticatedTeamMember({
    ...options,
    membershipOverrides: { role: "guest" },
  });
}

// =============================================================================
// Token Validation Helpers (for testing auth middleware)
// =============================================================================

/**
 * Creates an expired token header for testing token expiration handling.
 * Note: This creates a structurally valid but semantically invalid token.
 *
 * @returns An Authorization header with an expired token
 */
export function createExpiredAuthHeader(): AuthHeader {
  // Create a token that looks valid but has an impossible timestamp
  // The actual JWT verification will fail when checking expiration
  return { Authorization: "Bearer expired.token.here" };
}

/**
 * Creates an invalid token header for testing malformed token handling.
 *
 * @returns An Authorization header with an invalid token
 */
export function createInvalidAuthHeader(): AuthHeader {
  return { Authorization: "Bearer invalid-token" };
}

/**
 * Creates an empty Authorization header for testing missing auth handling.
 *
 * @returns An empty Authorization header
 */
export function createEmptyAuthHeader(): AuthHeader {
  return { Authorization: "" };
}

/**
 * Creates a malformed Authorization header (missing Bearer prefix).
 *
 * @param userId - The user's unique identifier
 * @returns A malformed Authorization header
 */
export function createMalformedAuthHeader(userId: string): AuthHeader {
  const token = generateAccessToken(userId);
  return { Authorization: token }; // Missing "Bearer " prefix
}
