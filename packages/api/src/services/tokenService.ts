/**
 * Token Service for API Token management
 *
 * Handles creation, validation, listing, and revocation of API tokens.
 * Tokens are hashed with SHA-256 before storage - plaintext is never stored.
 */

import crypto from "crypto";
import { prisma } from "../lib/db.js";
import type { ApiToken, User } from "../generated/prisma/index.js";

// =============================================================================
// Types
// =============================================================================

export interface CreateTokenInput {
  name: string;
  userId: string;
  scopes?: string[] | undefined;
  expiresAt?: Date | null;
}

export interface TokenResponse {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

export interface CreateTokenResponse extends TokenResponse {
  /** The plaintext token - only returned once at creation */
  token: string;
}

export interface TokenWithUser extends ApiToken {
  user: User;
}

// =============================================================================
// Token Generation Helpers
// =============================================================================

/**
 * Generates a cryptographically secure random token with st_ prefix.
 * The prefix allows easy identification of Dispatcher API tokens.
 *
 * @returns A random token string like "st_abc123xyz789..."
 */
export function generateToken(): string {
  const prefix = "st_";
  const randomPart = crypto.randomBytes(32).toString("base64url");
  return `${prefix}${randomPart}`;
}

/**
 * Hashes a token using SHA-256.
 * This is a one-way hash - the original token cannot be recovered.
 *
 * @param token - The plaintext token to hash
 * @returns The hex-encoded SHA-256 hash
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Creates a new API token for a user.
 * The plaintext token is only returned once and is never stored.
 *
 * @param input - Token creation parameters
 * @returns The created token with plaintext (only time it's visible)
 */
export async function createToken(
  input: CreateTokenInput
): Promise<CreateTokenResponse> {
  const { name, userId, scopes, expiresAt } = input;

  // Generate a cryptographically secure random token
  const plainTextToken = generateToken();
  const tokenHash = hashToken(plainTextToken);

  // Store only the hash in the database
  const apiToken = await prisma.apiToken.create({
    data: {
      name,
      tokenHash,
      userId,
      scopes: scopes ? JSON.stringify(scopes) : null,
      expiresAt: expiresAt ?? null,
    },
  });

  return {
    id: apiToken.id,
    name: apiToken.name,
    token: plainTextToken, // Only returned once!
    scopes: parseScopes(apiToken.scopes),
    expiresAt: apiToken.expiresAt,
    lastUsedAt: apiToken.lastUsedAt,
    createdAt: apiToken.createdAt,
  };
}

/**
 * Validates an API token and returns the associated user if valid.
 *
 * @param token - The plaintext token to validate
 * @returns The token with user data if valid, null otherwise
 */
export async function validateToken(
  token: string
): Promise<TokenWithUser | null> {
  // Hash the provided token for lookup
  const tokenHash = hashToken(token);

  // Find the token by hash
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!apiToken) {
    return null;
  }

  // Check if token has expired
  if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
    return null;
  }

  // Check if user is active
  if (!apiToken.user.isActive) {
    return null;
  }

  return apiToken;
}

/**
 * Updates the last_used_at timestamp for a token.
 * This is called asynchronously on each token use.
 *
 * @param tokenId - The token ID to update
 */
export async function updateTokenLastUsed(tokenId: string): Promise<void> {
  await prisma.apiToken.update({
    where: { id: tokenId },
    data: { lastUsedAt: new Date() },
  });
}

/**
 * Lists all tokens for a user (metadata only, no token values).
 *
 * @param userId - The user ID to list tokens for
 * @returns Array of token metadata
 */
export async function listTokens(userId: string): Promise<TokenResponse[]> {
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      // NOTE: tokenHash is intentionally excluded
    },
    orderBy: { createdAt: "desc" },
  });

  return tokens.map((token) => ({
    ...token,
    scopes: parseScopes(token.scopes),
  }));
}

/**
 * Gets a single token by ID (metadata only, no token value).
 *
 * @param tokenId - The token ID
 * @returns Token metadata if found, null otherwise
 */
export async function getTokenById(
  tokenId: string
): Promise<(TokenResponse & { userId: string }) | null> {
  const token = await prisma.apiToken.findUnique({
    where: { id: tokenId },
    select: {
      id: true,
      name: true,
      scopes: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      userId: true,
    },
  });

  if (!token) {
    return null;
  }

  return {
    ...token,
    scopes: parseScopes(token.scopes),
  };
}

/**
 * Revokes (deletes) an API token.
 *
 * @param tokenId - The token ID to revoke
 * @returns true if deleted, false if not found
 */
export async function revokeToken(tokenId: string): Promise<boolean> {
  try {
    await prisma.apiToken.delete({
      where: { id: tokenId },
    });
    return true;
  } catch {
    // Token not found
    return false;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parses the scopes JSON string into an array.
 *
 * @param scopes - The JSON string or null
 * @returns Array of scope strings
 */
function parseScopes(scopes: string | null): string[] {
  if (!scopes) {
    return [];
  }
  try {
    return JSON.parse(scopes) as string[];
  } catch {
    return [];
  }
}
