/**
 * Authentication middleware for JWT token verification.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the authenticated user to the request.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { User } from "../generated/prisma/index.js";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/db.js";
import { UnauthorizedError } from "../errors/index.js";

/**
 * Authenticated user type without sensitive fields.
 * This is the user object attached to req.user after authentication.
 */
export type AuthenticatedUser = Omit<User, "passwordHash"> & {
  teamId: string | null;
  role: string | null;
};

/**
 * Extends FastifyRequest to include the authenticated user.
 */
declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
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
 * Authentication middleware that verifies JWT tokens and attaches users to requests.
 *
 * This middleware:
 * 1. Extracts the JWT token from the Authorization header (Bearer scheme)
 * 2. Verifies the token signature and expiration
 * 3. Fetches the user from the database
 * 4. Checks if the user is active
 * 5. Attaches the user (without passwordHash) to req.user
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
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

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
