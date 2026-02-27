import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyTokenWithType,
} from "../utils/jwt.js";
import { UnauthorizedError } from "../errors/index.js";
import {
  loginSchema,
  refreshSchema,
  type LoginInput,
  type RefreshInput,
} from "../schemas/auth.js";
import { authenticate } from "../middleware/authenticate.js";
import { prisma } from "../lib/db.js";

/**
 * Auth routes plugin
 * Prefix: /api/v1/auth
 */
export default function authRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * POST /api/v1/auth/login
   * Authenticate with a passphrase to obtain tokens for the admin user
   */
  fastify.post<{ Body: LoginInput }>(
    "/login",
    async (request, reply) => {
      const parseResult = loginSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const { passphrase } = parseResult.data;

      // Validate passphrase against env var
      const expectedPassphrase = process.env.SPECTREE_PASSPHRASE;
      if (!expectedPassphrase || passphrase !== expectedPassphrase) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Look up the admin user
      const user = await prisma.user.findFirst({
        where: { isGlobalAdmin: true, isActive: true },
      });
      if (!user) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      const { passwordHash: _, ...userWithoutPassword } = user;

      return reply.send({
        accessToken,
        refreshToken,
        user: userWithoutPassword,
      });
    }
  );

  /**
   * POST /api/v1/auth/refresh
   * Get a new access token using a valid refresh token
   */
  fastify.post<{ Body: RefreshInput }>(
    "/refresh",
    async (request, reply) => {
      // Validate request body
      const parseResult = refreshSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new UnauthorizedError("Invalid refresh token");
      }

      const { refreshToken } = parseResult.data;

      // Verify the refresh token and check its type
      const payload = verifyTokenWithType(refreshToken, "refresh");
      if (!payload) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }

      // Generate a new access token
      const accessToken = generateAccessToken(payload.sub);

      return reply.send({
        accessToken,
      });
    }
  );

  /**
   * GET /api/v1/auth/me
   * Get the current authenticated user
   * Requires authentication
   */
  fastify.get(
    "/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      // User is already attached to request by authenticate middleware
      return reply.send(request.user);
    }
  );

  /**
   * POST /api/v1/auth/logout
   * Invalidate the refresh token (stateless for MVP - no token blacklist)
   * Requires authentication
   */
  fastify.post(
    "/logout",
    { preHandler: [authenticate] },
    async (_request, reply) => {
      // For MVP: stateless JWT implementation
      // The client is responsible for discarding tokens
      // In a production system, you would add the refresh token to a blacklist
      // or remove it from a database of active tokens

      return reply.status(200).send({
        message: "Logged out successfully",
      });
    }
  );
}
