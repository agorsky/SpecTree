/**
 * Authentication Helpers for SpecTree API Tests
 *
 * Provides utilities for creating authenticated test requests.
 * Primary authentication is via passphrase (POST /api/v1/auth/login).
 * Direct JWT token generation is available for tests needing specific user contexts.
 */

import type { FastifyInstance } from "fastify";
import { generateAccessToken, generateRefreshToken } from "../../src/utils/jwt.js";
import { createTestUser, createTestMembership, createTestTeam, createTestGlobalAdmin } from "./factories.js";
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

/**
 * Result of logging in via passphrase.
 */
export interface PassphraseLoginResult {
  user: Record<string, unknown>;
  headers: AuthHeader;
  accessToken: string;
  refreshToken: string;
}

// =============================================================================
// Passphrase Login Helper
// =============================================================================

/**
 * Authenticates via the passphrase login endpoint.
 * Creates a global admin user, then POSTs to /api/v1/auth/login
 * with the passphrase from SPECTREE_PASSPHRASE env var.
 *
 * @param app - Fastify app instance (from buildTestApp)
 * @param adminOverrides - Optional overrides for the admin user
 * @returns The authenticated user, auth headers, and tokens
 *
 * @example
 * const { headers } = await loginWithPassphrase(app);
 * const response = await app.inject({
 *   method: 'GET',
 *   url: '/api/v1/teams',
 *   headers
 * });
 */
export async function loginWithPassphrase(
  app: FastifyInstance,
  adminOverrides?: Partial<UserInput>
): Promise<PassphraseLoginResult> {
  await createTestGlobalAdmin(adminOverrides);

  const passphrase = process.env.SPECTREE_PASSPHRASE ?? "test-passphrase";

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { passphrase },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Passphrase login failed with status ${String(response.statusCode)}: ${response.body}`
    );
  }

  const body = JSON.parse(response.body) as {
    accessToken: string;
    refreshToken: string;
    user: Record<string, unknown>;
  };
  const { accessToken, refreshToken, user } = body;
  const headers: AuthHeader = { Authorization: `Bearer ${accessToken}` };

  return { user, headers, accessToken, refreshToken };
}

// =============================================================================
// Token Generation Helpers
// =============================================================================

/**
 * Creates an Authorization header with a Bearer token for the given user ID.
 *
 * @param userId - The user's unique identifier
 * @returns An object with the Authorization header
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
 * Uses direct JWT token generation for tests that need specific user contexts
 * (e.g., non-admin users, specific roles).
 *
 * @param overrides - Optional fields to override user defaults
 * @returns The created user, auth headers, and tokens
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
 */
export function createExpiredAuthHeader(): AuthHeader {
  return { Authorization: "Bearer expired.token.here" };
}

/**
 * Creates an invalid token header for testing malformed token handling.
 */
export function createInvalidAuthHeader(): AuthHeader {
  return { Authorization: "Bearer invalid-token" };
}

/**
 * Creates an empty Authorization header for testing missing auth handling.
 */
export function createEmptyAuthHeader(): AuthHeader {
  return { Authorization: "" };
}

/**
 * Creates a malformed Authorization header (missing Bearer prefix).
 */
export function createMalformedAuthHeader(userId: string): AuthHeader {
  const token = generateAccessToken(userId);
  return { Authorization: token };
}
