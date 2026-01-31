/**
 * Admin Users Routes
 *
 * Protected routes for managing users.
 * All routes require authentication and global admin privileges.
 *
 * Prefix: /api/v1/admin/users
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../../middleware/authenticate.js";
import { requireGlobalAdmin } from "../../middleware/globalAdmin.js";
import { prisma } from "../../lib/db.js";
import { hardDeleteUser } from "../../services/userService.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";

interface ListUsersQuery {
  limit?: string;
  cursor?: string;
}

interface UserIdParams {
  id: string;
}

interface UpdateUserBody {
  isActive?: boolean;
  isGlobalAdmin?: boolean;
}

// Admin view includes isGlobalAdmin field
const adminUserSelectFields = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  isActive: true,
  isGlobalAdmin: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: false,
} as const;

/**
 * Admin users routes plugin.
 * All routes require authentication and global admin privileges.
 */
export default function adminUsersRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  // Apply authentication and admin check to all routes in this plugin
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireGlobalAdmin);

  /**
   * GET /api/v1/admin/users
   * List all users (admin only)
   */
  fastify.get<{ Querystring: ListUsersQuery }>(
    "/",
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      
      const users = await prisma.user.findMany({
        select: adminUserSelectFields,
        take: limit,
        orderBy: { createdAt: "desc" },
      });
      
      return reply.send({
        users,
        meta: {
          hasMore: users.length === limit,
          cursor: users.length > 0 ? users[users.length - 1]!.id : null,
        },
      });
    }
  );

  /**
   * PATCH /api/v1/admin/users/:id
   * Update user (activate/deactivate)
   */
  fastify.patch<{ Params: UserIdParams; Body: UpdateUserBody }>(
    "/:id",
    async (request, reply) => {
      const { id } = request.params;
      const { isActive, isGlobalAdmin } = request.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: adminUserSelectFields,
      });
      
      if (!existingUser) {
        throw new NotFoundError(`User with id '${id}' not found`);
      }

      // Prevent modifying yourself
      if (request.user?.id === id) {
        if (isActive === false) {
          throw new ForbiddenError("Cannot deactivate your own account");
        }
        if (isGlobalAdmin === false) {
          throw new ForbiddenError("Cannot remove your own admin privileges");
        }
      }

      // Prevent deactivating other global admins
      if (existingUser.isGlobalAdmin && isActive === false) {
        throw new ForbiddenError("Cannot deactivate a global admin");
      }

      // Check if removing the last global admin
      if (existingUser.isGlobalAdmin && isGlobalAdmin === false) {
        const adminCount = await prisma.user.count({
          where: { isGlobalAdmin: true, isActive: true },
        });
        if (adminCount <= 1) {
          throw new ForbiddenError("Cannot remove the last global admin");
        }
      }

      if (isActive === undefined && isGlobalAdmin === undefined) {
        return reply.send(existingUser);
      }

      // Build update data
      const updateData: { isActive?: boolean; isGlobalAdmin?: boolean } = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (isGlobalAdmin !== undefined) updateData.isGlobalAdmin = isGlobalAdmin;

      await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Fetch again with admin fields
      const updatedUser = await prisma.user.findUnique({
        where: { id },
        select: adminUserSelectFields,
      });

      return reply.send(updatedUser);
    }
  );

  /**
   * DELETE /api/v1/admin/users/:id
   * Permanently delete a user (admin only)
   */
  fastify.delete<{ Params: UserIdParams }>(
    "/:id",
    async (request, reply) => {
      const { id } = request.params;

      // Prevent deleting yourself
      if (request.user?.id === id) {
        throw new ForbiddenError("Cannot delete your own account");
      }

      // Check if user exists and is not a global admin
      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: adminUserSelectFields,
      });

      if (!existingUser) {
        throw new NotFoundError(`User with id '${id}' not found`);
      }

      // Prevent deleting global admins
      if (existingUser.isGlobalAdmin) {
        throw new ForbiddenError("Cannot delete a global admin");
      }

      const deleted = await hardDeleteUser(id);
      if (!deleted) {
        throw new NotFoundError(`User with id '${id}' not found`);
      }

      return reply.status(204).send();
    }
  );
}
