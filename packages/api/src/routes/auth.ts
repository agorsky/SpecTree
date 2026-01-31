import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import bcrypt from "bcrypt";
import {
  getUserByEmail,
  createUser,
  getUserByEmailWithPassword,
} from "../services/userService.js";
import {
  validateAndUseInvitation,
} from "../services/invitationService.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyTokenWithType,
} from "../utils/jwt.js";
import { UnauthorizedError, ForbiddenError, ConflictError, ValidationError } from "../errors/index.js";
import {
  loginSchema,
  refreshSchema,
  activateAccountSchema,
  type LoginInput,
  type RefreshInput,
  type ActivateAccountInput,
} from "../schemas/auth.js";
import { authenticate } from "../middleware/authenticate.js";

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

      // 1. Validate and consume invitation
      const invitation = await validateAndUseInvitation(email, code);

      // 2. Check email not already taken (race condition protection)
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError("An account with this email already exists");
      }

      // 3. Create user
      const user = await createUser({
        email,
        name,
        password,
      });

      // 4. Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      // 5. Log activation event
      request.log.info(
        { email, userId: user.id, invitationId: invitation.id },
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
