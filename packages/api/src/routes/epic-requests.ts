import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listEpicRequests,
  getEpicRequestById,
  createEpicRequest,
  updateEpicRequest,
  deleteEpicRequest,
  upsertReaction,
  removeReaction,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  approveRequest,
  rejectRequest,
} from "../services/epicRequestService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireGlobalAdmin } from "../middleware/globalAdmin.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  createEpicRequestSchema,
  updateEpicRequestSchema,
  addReactionSchema,
  createCommentSchema,
  updateCommentSchema,
  listEpicRequestsQuerySchema,
  listCommentsQuerySchema,
  type CreateEpicRequestInput,
  type UpdateEpicRequestInput,
  type EpicRequestStatus,
  type AddReactionInput,
} from "../schemas/epicRequest.js";

// Request type definitions
interface ListEpicRequestsQuery {
  cursor?: string;
  limit?: string;
  status?: EpicRequestStatus;
  requestedById?: string;
}

interface EpicRequestIdParams {
  id: string;
}

interface CreateEpicRequestBody {
  title: string;
  description?: string;
  structuredDesc?: {
    problemStatement: string;
    proposedSolution: string;
    impactAssessment: string;
    targetAudience?: string;
    successMetrics?: string;
    alternatives?: string;
    dependencies?: string;
    estimatedEffort?: string;
  };
}

interface UpdateEpicRequestBody {
  title?: string;
  description?: string;
  structuredDesc?: {
    problemStatement: string;
    proposedSolution: string;
    impactAssessment: string;
    targetAudience?: string;
    successMetrics?: string;
    alternatives?: string;
    dependencies?: string;
    estimatedEffort?: string;
  };
  status?: EpicRequestStatus;
}

interface ListCommentsQuery {
  cursor?: string;
  limit?: string;
}

interface CommentIdParams {
  id: string;
  commentId: string;
}

interface CreateCommentBody {
  content: string;
}

interface UpdateCommentBody {
  content: string;
}

/**
 * Epic Requests routes plugin
 * Prefix: /api/v1/epic-requests
 */
export default function epicRequestsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/epic-requests
   * List epic requests with cursor-based pagination and optional filtering
   * Returns requests with aggregated reaction counts
   * Requires authentication
   */
  fastify.get<{ Querystring: ListEpicRequestsQuery }>(
    "/",
    { preHandler: [authenticate], preValidation: [validateQuery(listEpicRequestsQuerySchema)] },
    async (request, reply) => {
      const result = await listEpicRequests(
        {
          cursor: request.query.cursor,
          limit: request.query.limit ? Number(request.query.limit) : undefined,
          status: request.query.status,
          requestedById: request.query.requestedById,
        },
        request.user?.id
      );
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/epic-requests/:id
   * Get a single epic request by ID with reaction counts and user's own reaction
   * Requires authentication
   */
  fastify.get<{ Params: EpicRequestIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const epicRequest = await getEpicRequestById(
        request.params.id,
        request.user?.id
      );

      if (!epicRequest) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Epic request with id '${request.params.id}' not found`,
        });
      }

      return reply.send({ data: epicRequest });
    }
  );

  /**
   * POST /api/v1/epic-requests
   * Create a new epic request
   * Requires authentication
   */
  fastify.post<{ Body: CreateEpicRequestBody }>(
    "/",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(createEpicRequestSchema)],
    },
    async (request, reply) => {
      const input: CreateEpicRequestInput = {
        title: request.body.title,
      };
      if (request.body.description !== undefined) {
        input.description = request.body.description;
      }
      if (request.body.structuredDesc !== undefined) {
        input.structuredDesc = request.body.structuredDesc;
      }

      const epicRequest = await createEpicRequest(input, request.user!.id);
      return reply.status(201).send({ data: epicRequest });
    }
  );

  /**
   * PUT /api/v1/epic-requests/:id
   * Update an existing epic request
   * Requires authentication and ownership (or approved/converted status prevents edits)
   */
  fastify.put<{ Params: EpicRequestIdParams; Body: UpdateEpicRequestBody }>(
    "/:id",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(updateEpicRequestSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const input: UpdateEpicRequestInput = {};

      if (request.body.title !== undefined) {
        input.title = request.body.title;
      }
      if (request.body.description !== undefined) {
        input.description = request.body.description;
      }
      if (request.body.structuredDesc !== undefined) {
        input.structuredDesc = request.body.structuredDesc;
      }
      if (request.body.status !== undefined) {
        input.status = request.body.status;
      }

      const epicRequest = await updateEpicRequest(id, input, request.user!.id, request.user!.isGlobalAdmin);
      return reply.send({ data: epicRequest });
    }
  );

  /**
   * DELETE /api/v1/epic-requests/:id
   * Delete an epic request
   * Requires authentication and ownership OR global admin role
   */
  fastify.delete<{ Params: EpicRequestIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const isGlobalAdmin = request.user!.isGlobalAdmin;

      await deleteEpicRequest(id, request.user!.id, isGlobalAdmin);
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/v1/epic-requests/:id/approve
   * Approve an epic request (admin only)
   * Sets status to 'approved'
   * Requires authentication and global admin role
   * Only 'pending' requests can be approved
   */
  fastify.post<{ Params: EpicRequestIdParams }>(
    "/:id/approve",
    { preHandler: [authenticate, requireGlobalAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const epicRequest = await approveRequest(id, request.user!.id);
      return reply.send({ data: epicRequest });
    }
  );

  /**
   * POST /api/v1/epic-requests/:id/reject
   * Reject an epic request (admin only)
   * Sets status to 'rejected'
   * Requires authentication and global admin role
   * Only 'pending' requests can be rejected
   */
  fastify.post<{ Params: EpicRequestIdParams }>(
    "/:id/reject",
    { preHandler: [authenticate, requireGlobalAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const epicRequest = await rejectRequest(id, request.user!.id);
      return reply.send({ data: epicRequest });
    }
  );

  /**
   * POST /api/v1/epic-requests/:id/reactions
   * Add or update (upsert) a reaction on an epic request
   * Replaces any existing reaction from the same user
   * Requires authentication
   */
  fastify.post<{ Params: EpicRequestIdParams; Body: AddReactionInput }>(
    "/:id/reactions",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(addReactionSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { reactionType } = request.body;

      await upsertReaction(id, request.user!.id, reactionType);
      return reply.status(200).send({ 
        message: "Reaction added successfully",
        data: { reactionType } 
      });
    }
  );

  /**
   * DELETE /api/v1/epic-requests/:id/reactions
   * Remove user's reaction from an epic request
   * Requires authentication
   */
  fastify.delete<{ Params: EpicRequestIdParams }>(
    "/:id/reactions",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      await removeReaction(id, request.user!.id);
      return reply.status(204).send();
    }
  );

  /**
   * GET /api/v1/epic-requests/:id/comments
   * List comments for an epic request with pagination
   * Returns comments with author information (name, email)
   * Requires authentication
   */
  fastify.get<{ Params: EpicRequestIdParams; Querystring: ListCommentsQuery }>(
    "/:id/comments",
    { preHandler: [authenticate], preValidation: [validateQuery(listCommentsQuerySchema)] },
    async (request, reply) => {
      const { id } = request.params;
      const result = await listComments(id, {
        cursor: request.query.cursor,
        limit: request.query.limit ? Number(request.query.limit) : undefined,
      });
      return reply.send(result);
    }
  );

  /**
   * POST /api/v1/epic-requests/:id/comments
   * Create a new comment on an epic request
   * Current user is automatically set as the author
   * Requires authentication
   */
  fastify.post<{ Params: EpicRequestIdParams; Body: CreateCommentBody }>(
    "/:id/comments",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(createCommentSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { content } = request.body;

      const comment = await createComment(id, content, request.user!.id);
      return reply.status(201).send({ data: comment });
    }
  );

  /**
   * PUT /api/v1/epic-requests/:id/comments/:commentId
   * Update an existing comment
   * Requires authentication and ownership (author only)
   */
  fastify.put<{ Params: CommentIdParams; Body: UpdateCommentBody }>(
    "/:id/comments/:commentId",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(updateCommentSchema)],
    },
    async (request, reply) => {
      const { commentId } = request.params;
      const { content } = request.body;

      const comment = await updateComment(commentId, content, request.user!.id);
      return reply.send({ data: comment });
    }
  );

  /**
   * DELETE /api/v1/epic-requests/:id/comments/:commentId
   * Delete a comment
   * Requires authentication and ownership OR global admin role
   */
  fastify.delete<{ Params: CommentIdParams }>(
    "/:id/comments/:commentId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { commentId } = request.params;
      const isGlobalAdmin = request.user!.isGlobalAdmin;

      await deleteComment(commentId, request.user!.id, isGlobalAdmin);
      return reply.status(204).send();
    }
  );
}
