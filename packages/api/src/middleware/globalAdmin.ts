/**
 * Global Admin Authorization Middleware — single-user pass-through.
 *
 * All global-admin checks have been removed.
 * Every authenticated user passes through automatically.
 * Function signature is preserved for call-site compatibility.
 */

import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Middleware that requires the authenticated user to be a global admin.
 *
 * Simplified to single-user pass-through: always allows access.
 *
 * @example
 * fastify.post('/admin/invitations', {
 *   preHandler: [authenticate, requireGlobalAdmin]
 * }, handler);
 */
export async function requireGlobalAdmin(
  _request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Single-user mode: every request passes through
}
