import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  getUsers,
  getUserById,
  updateUser,
  softDeleteUser,
  emailExists,
} from "../services/userService.js";
import { authenticate } from "../middleware/authenticate.js";
import { ForbiddenError } from "../errors/index.js";

// Request/Response type definitions
interface GetUsersQuery {
  page?: string;
  limit?: string;
}

interface UserIdParams {
  id: string;
}

interface CreateUserBody {
  email: string;
  name: string;
  password: string;
  avatarUrl?: string | null;
}

interface UpdateUserBody {
  email?: string;
  name?: string;
  password?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  timeZone?: string | null;
}

/**
 * Users routes plugin
 * Prefix: /api/v1/users
 */
export default function usersRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/users
   * List users with pagination
   * Requires authentication
   */
  fastify.get<{ Querystring: GetUsersQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const params: { page?: number; limit?: number } = {};
      if (request.query.page) {
        params.page = parseInt(request.query.page, 10);
      }
      if (request.query.limit) {
        params.limit = parseInt(request.query.limit, 10);
      }

      const result = await getUsers(params);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/users/me
   * Get current authenticated user
   * Requires authentication
   */
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      // User is guaranteed to exist after authenticate middleware
      return reply.send({ data: request.user });
    }
  );

  /**
   * GET /api/v1/users/:id
   * Get a single user by ID
   * Requires authentication
   */
  fastify.get<{ Params: UserIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = await getUserById(request.params.id);
      if (!user) {
        return reply.status(404).send({
          error: "Not Found",
          message: `User with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: user });
    }
  );

  /**
   * POST /api/v1/users
   * Registration endpoint - DISABLED
   * Self-registration is disabled. New users must be invited by an administrator.
   */
  fastify.post<{ Body: CreateUserBody }>(
    "/",
    async () => {
      throw new ForbiddenError(
        "Self-registration is disabled. Please contact an administrator for an invitation code."
      );
    }
  );

  /**
   * PUT /api/v1/users/:id
   * Update an existing user
   * Requires authentication
   */
  fastify.put<{ Params: UserIdParams; Body: UpdateUserBody }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { email, name, password, avatarUrl, isActive, timeZone } = request.body;

      // Check if user exists
      const existingUser = await getUserById(id);
      if (!existingUser) {
        return reply.status(404).send({
          error: "Not Found",
          message: `User with id '${id}' not found`,
        });
      }

      // If updating email, check for conflicts
      if (email && email !== existingUser.email) {
        if (await emailExists(email, id)) {
          return reply.status(409).send({
            error: "Conflict",
            message: "A user with this email already exists",
          });
        }
      }

      const updateInput: {
        email?: string;
        name?: string;
        password?: string;
        avatarUrl?: string | null;
        isActive?: boolean;
        timeZone?: string | null;
      } = {};
      if (email !== undefined) {
        updateInput.email = email;
      }
      if (name !== undefined) {
        updateInput.name = name;
      }
      if (password !== undefined) {
        updateInput.password = password;
      }
      if (avatarUrl !== undefined) {
        updateInput.avatarUrl = avatarUrl;
      }
      if (isActive !== undefined) {
        updateInput.isActive = isActive;
      }
      if (timeZone !== undefined) {
        updateInput.timeZone = timeZone;
      }

      const user = await updateUser(id, updateInput);
      if (!user) {
        return reply.status(404).send({
          error: "Not Found",
          message: `User with id '${id}' not found`,
        });
      }

      return reply.send({ data: user });
    }
  );

  /**
   * DELETE /api/v1/users/:id
   * Soft delete a user (set isActive = false)
   * Requires authentication
   */
  fastify.delete<{ Params: UserIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const user = await softDeleteUser(id);
      if (!user) {
        return reply.status(404).send({
          error: "Not Found",
          message: `User with id '${id}' not found`,
        });
      }

      return reply.status(204).send();
    }
  );
}
