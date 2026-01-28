/**
 * API Token Routes for SpecTree API
 *
 * Provides endpoints for creating, listing, and revoking API tokens.
 * These long-lived tokens are used by MCP and other programmatic clients.
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  createToken,
  listTokens,
  getTokenById,
  revokeToken,
} from "../services/tokenService.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../errors/index.js";

// =============================================================================
// Request/Response Types
// =============================================================================

interface CreateTokenBody {
  name: string;
  scopes?: string[];
  expiresAt?: string; // ISO 8601 date string
}

interface TokenIdParams {
  id: string;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * Token routes plugin
 * Prefix: /api/v1/tokens
 */
export default async function tokensRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/tokens
   * Create a new API token
   * Requires authentication (JWT)
   *
   * The plaintext token is only returned in this response - save it immediately!
   */
  fastify.post<{ Body: CreateTokenBody }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { name, scopes, expiresAt } = request.body;
      const userId = request.user!.id;

      // Validate name is provided
      if (!name || name.trim().length === 0) {
        throw new BadRequestError("Token name is required");
      }

      // Validate name length
      if (name.length > 255) {
        throw new BadRequestError("Token name must be 255 characters or less");
      }

      // Parse and validate expiration date
      let parsedExpiresAt: Date | undefined;
      if (expiresAt) {
        parsedExpiresAt = new Date(expiresAt);
        if (isNaN(parsedExpiresAt.getTime())) {
          throw new BadRequestError("Invalid expiration date format");
        }
        if (parsedExpiresAt <= new Date()) {
          throw new BadRequestError("Expiration date must be in the future");
        }
      }

      const token = await createToken({
        name: name.trim(),
        userId,
        scopes,
        expiresAt: parsedExpiresAt ?? null,
      });

      return reply.status(201).send({
        data: token,
        message:
          "Token created successfully. Save this token - it will not be shown again!",
      });
    }
  );

  /**
   * GET /api/v1/tokens
   * List all tokens for the authenticated user
   * Returns metadata only - token values are never exposed
   */
  fastify.get(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const tokens = await listTokens(userId);

      return reply.send({ data: tokens });
    }
  );

  /**
   * GET /api/v1/tokens/:id
   * Get a single token by ID
   * Returns metadata only - token value is never exposed
   */
  fastify.get<{ Params: TokenIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      const token = await getTokenById(id);

      if (!token) {
        throw new NotFoundError("Token not found", { id });
      }

      // Ensure user owns this token
      if (token.userId !== userId) {
        throw new ForbiddenError("Access denied");
      }

      // Remove userId from response
      const { userId: _, ...tokenData } = token;
      return reply.send({ data: tokenData });
    }
  );

  /**
   * DELETE /api/v1/tokens/:id
   * Revoke (delete) an API token
   * The token is immediately invalidated
   */
  fastify.delete<{ Params: TokenIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user!.id;

      // Get the token first to check ownership
      const token = await getTokenById(id);

      if (!token) {
        throw new NotFoundError("Token not found", { id });
      }

      // Ensure user owns this token
      if (token.userId !== userId) {
        throw new ForbiddenError("Access denied");
      }

      await revokeToken(id);

      return reply.status(204).send();
    }
  );
}
