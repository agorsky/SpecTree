import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  activateAccount,
} from "../services/userService.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyTokenWithType,
} from "../utils/jwt.js";
import { UnauthorizedError, ValidationError } from "../errors/index.js";
import {
  loginSchema,
  refreshSchema,
  activateAccountSchema,
  type LoginInput,
  type RefreshInput,
  type ActivateAccountInput,
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

  /**
   * POST /api/v1/auth/activate
   * Activate a new account using an invitation code
   * Public endpoint with rate limiting
   */
  fastify.post<{ Body: ActivateAccountInput }>(
    "/activate",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
          keyGenerator: (request: { ip: string }) => request.ip,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            message: "Too many activation attempts. Please try again in 15 minutes.",
          }),
        },
      },
    },
    async (request, reply) => {
      // Validate request body
      const parseResult = activateAccountSchema.safeParse(request.body);
      if (!parseResult.success) {
        const errors = parseResult.error.errors.reduce(
          (acc, e) => {
            acc[e.path.join(".")] = e.message;
            return acc;
          },
          {} as Record<string, string>
        );
        throw new ValidationError("Invalid request", errors);
      }

      const { email, code, name, password } = parseResult.data;

      // All steps (validate invitation, create user, provision personal scope)
      // run in a single transaction for atomicity
      const { user, invitationId } = await activateAccount({ email, code, name, password });

      // Generate tokens (outside transaction - no DB writes)
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // Log activation event
      request.log.info(
        { email, userId: user.id, invitationId },
        "Account activated"
      );

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    }
  );
}
