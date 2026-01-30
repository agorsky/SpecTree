/**
 * Admin Invitation Routes
 *
 * Protected routes for managing user invitations.
 * All routes require authentication and global admin privileges.
 *
 * Prefix: /api/v1/admin/invitations
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { requireGlobalAdmin } from "../../middleware/globalAdmin.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import {
  createInvitationSchema,
  listInvitationsQuerySchema,
  invitationIdParamSchema,
  type CreateInvitationInput,
  type ListInvitationsQuery,
  type InvitationIdParam,
} from "../../schemas/invitation.js";
import * as invitationService from "../../services/invitationService.js";
import { NotFoundError } from "../../errors/index.js";

/**
 * Admin invitation routes plugin.
 * All routes require authentication and global admin privileges.
 */
export default function invitationRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  // Apply authentication and admin check to all routes in this plugin
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireGlobalAdmin);

  /**
   * POST /api/v1/admin/invitations
   * Create a new invitation
   */
  fastify.post<{ Body: CreateInvitationInput }>(
    "/",
    { preValidation: [validateBody(createInvitationSchema)] },
    async (request, reply) => {
      const { email } = request.body;
      // user is guaranteed to exist after authenticate middleware
      const userId = request.user?.id;
      if (!userId) {
        throw new NotFoundError("User not found");
      }
      const invitation = await invitationService.createInvitation(email, userId);
      return reply.status(201).send({ data: invitation });
    }
  );

  /**
   * GET /api/v1/admin/invitations
   * List invitations with optional filtering
   */
  fastify.get<{ Querystring: ListInvitationsQuery }>(
    "/",
    { preValidation: [validateQuery(listInvitationsQuerySchema)] },
    async (request, reply) => {
      const result = await invitationService.listInvitations(request.query);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/admin/invitations/:id
   * Get a specific invitation by ID
   */
  fastify.get<{ Params: InvitationIdParam }>(
    "/:id",
    { preValidation: [validateParams(invitationIdParamSchema)] },
    async (request, reply) => {
      const invitation = await invitationService.getInvitationById(request.params.id);
      if (!invitation) {
        throw new NotFoundError(`Invitation with id '${request.params.id}' not found`);
      }
      return reply.send({ data: invitation });
    }
  );

  /**
   * DELETE /api/v1/admin/invitations/:id
   * Revoke (delete) an invitation
   */
  fastify.delete<{ Params: InvitationIdParam }>(
    "/:id",
    { preValidation: [validateParams(invitationIdParamSchema)] },
    async (request, reply) => {
      await invitationService.revokeInvitation(request.params.id);
      return reply.status(204).send();
    }
  );
}
