/**
 * Global Admin Authorization Middleware
 *
 * Requires the authenticated user to have global admin privileges.
 * Must be used after the authenticate middleware.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../errors/index.js";

/**
 * Middleware that requires the authenticated user to be a global admin.
 *
 * @throws ForbiddenError if user is not authenticated or not a global admin
 *
 * @example
 * fastify.post('/admin/invitations', {
 *   preHandler: [authenticate, requireGlobalAdmin]
 * }, handler);
 */
export async function requireGlobalAdmin(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Assumes authenticate middleware has already run and set request.user
  if (!request.user) {
    throw new ForbiddenError("Authentication required");
  }

  if (!request.user.isGlobalAdmin) {
    throw new ForbiddenError("Global admin access required");
  }
}
