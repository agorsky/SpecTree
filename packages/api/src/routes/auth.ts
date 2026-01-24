import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import bcrypt from "bcrypt";
import { getUserByEmailWithPassword } from "../services/userService.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyTokenWithType,
} from "../utils/jwt.js";
import { UnauthorizedError, ForbiddenError } from "../errors/index.js";
import {
  loginSchema,
  refreshSchema,
  type LoginInput,
  type RefreshInput,
} from "../schemas/auth.js";
import { authenticate } from "../middleware/authenticate.js";

/**
 * Auth routes plugin
 * Prefix: /api/v1/auth
 */
export default async function authRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/auth/login
   * Authenticate user with email and password
   */
  fastify.post<{ Body: LoginInput }>(
    "/login",
    async (request, reply) => {
      // Validate request body
      const parseResult = loginSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const { email, password } = parseResult.data;

      // Find user by email (including password hash for verification)
      const user = await getUserByEmailWithPassword(email);
      if (!user) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Check if user is active
      if (!user.isActive) {
        throw new ForbiddenError("Account is deactivated");
      }

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Return response without password_hash
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
