/**
 * Authentication middleware for JWT token verification.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the authenticated user to the request.
 *
 * Also supports API tokens (prefixed with st_) for programmatic access.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { User, ApiToken } from "../generated/prisma/index.js";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/db.js";
import { UnauthorizedError } from "../errors/index.js";
import { validateToken, updateTokenLastUsed } from "../services/tokenService.js";

/**
 * Authenticated user type without sensitive fields.
 * This is the user object attached to req.user after authentication.
 */
export type AuthenticatedUser = Omit<User, "passwordHash"> & {
  teamId: string | null;
  role: string | null;
};

/**
 * Extends FastifyRequest to include the authenticated user and optional API token.
 */
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    apiToken?: ApiToken;
  }
}

/**
 * Extracts the Bearer token from the Authorization header.
 *
 * @param authHeader - The Authorization header value
 * @returns The token string if valid Bearer format, null otherwise
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Authentication middleware that verifies JWT tokens OR API tokens and attaches users to requests.
 *
 * This middleware:
 * 1. Extracts the token from the Authorization header (Bearer scheme)
 * 2. If token starts with st_, validates as API token
 * 3. Otherwise, verifies as JWT token
 * 4. Fetches the user from the database
 * 5. Checks if the user is active
 * 6. Attaches the user (without passwordHash) to req.user
 *
 * @throws UnauthorizedError if:
 *   - No Authorization header is present
 *   - Token is not in Bearer format
 *   - Token is invalid or expired
 *   - User is not found in database
 *   - User is inactive (isActive = false)
 *
 * @example
 * // Use as a preHandler hook on protected routes
 * fastify.get(
 *   "/protected",
 *   { preHandler: [authenticate] },
 *   async (request, reply) => {
 *     const userId = request.user!.id;
 *     // ...
 *   }
 * );
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Extract token from Authorization header
  const authHeader = request.headers.authorization;
  let token = extractBearerToken(authHeader);

  // Fallback to query param for SSE (EventSource cannot send custom headers)
  if (!token && request.query && typeof (request.query as any).token === 'string') {
    token = (request.query as any).token;
  }

  if (!token) {
    throw new UnauthorizedError("Missing or invalid Authorization header or token query parameter");
  }

  // Check if this is an API token (st_ prefix)
  if (token.startsWith("st_")) {
    await authenticateWithApiToken(request, token);
    return;
  }

  // Check if this is a passphrase session token
  const passphrase = process.env.DISPATCHER_PASSPHRASE;
  if (passphrase && token === passphrase) {
    await authenticateWithPassphrase(request);
    return;
  }

  // Otherwise, treat as JWT token
  await authenticateWithJwt(request, token);
}

/**
 * Authenticates a request using an API token.
 */
async function authenticateWithApiToken(
  request: FastifyRequest,
  token: string
): Promise<void> {
  const apiToken = await validateToken(token);

  if (!apiToken) {
    throw new UnauthorizedError("Invalid or expired API token");
  }

  // Update last_used_at asynchronously (don't wait for it)
  updateTokenLastUsed(apiToken.id).catch(() => {
    // Silently ignore errors on tracking
  });

  // Get team membership for the user
  const membership = await prisma.membership.findFirst({
    where: { userId: apiToken.user.id },
    select: { teamId: true, role: true },
  });

  // Attach user to request (excluding passwordHash)
  const { passwordHash: _, ...userWithoutPassword } = apiToken.user;
  request.user = {
    ...userWithoutPassword,
    teamId: membership?.teamId ?? null,
    role: membership?.role ?? null,
  };
  request.apiToken = apiToken;
}

/**
 * Authenticates a request using a passphrase session token.
 * The raw passphrase is sent as a Bearer token. If it matches
 * SPECTREE_PASSPHRASE, the request is authenticated as the admin user.
 */
async function authenticateWithPassphrase(
  request: FastifyRequest
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { isGlobalAdmin: true, isActive: true },
    include: {
      memberships: {
        select: { teamId: true, role: true },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("No active admin user found");
  }

  const { passwordHash: _, memberships, ...userWithoutPassword } = user;
  const membership = memberships[0];
  request.user = {
    ...userWithoutPassword,
    teamId: membership?.teamId ?? null,
    role: membership?.role ?? null,
  };
}

/**
 * Authenticates a request using a JWT token.
 */
async function authenticateWithJwt(
  request: FastifyRequest,
  token: string
): Promise<void> {
  // Verify token signature and expiration
  const payload = verifyToken(token);

  if (!payload) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  // Fetch user from database with team membership
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      memberships: {
        select: {
          teamId: true,
          role: true,
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  // Check if user is active
  if (!user.isActive) {
    throw new UnauthorizedError("User account is inactive");
  }

  // Attach user to request (excluding passwordHash, flattening team membership)
  const { passwordHash: _, memberships, ...userWithoutPassword } = user;
  const membership = memberships[0];
  request.user = {
    ...userWithoutPassword,
    teamId: membership?.teamId ?? null,
    role: membership?.role ?? null,
  };
}
