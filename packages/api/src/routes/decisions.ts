import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  createDecision,
  getDecisionById,
  listDecisions,
  searchDecisions,
  getDecisionContext,
  getFeatureDecisionContext,
} from "../services/decisionService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  createDecisionSchema,
  listDecisionsQuerySchema,
  searchDecisionsQuerySchema,
  type CreateDecisionInput,
  type ListDecisionsQuery,
  type SearchDecisionsQuery,
} from "../schemas/decision.js";

// Request type definitions
interface DecisionIdParams {
  id: string;
}

interface TaskIdParams {
  taskId: string;
}

interface FeatureIdParams {
  featureId: string;
}

/**
 * Decisions routes plugin
 * Prefix: /api/v1/decisions
 */
export default function decisionsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * POST /api/v1/decisions
   * Create a new decision record
   * Decisions are append-only - once created, they cannot be modified
   * Requires authentication
   */
  fastify.post<{ Body: CreateDecisionInput }>(
    "/",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(createDecisionSchema)],
    },
    async (request, reply) => {
      const decision = await createDecision(request.body);
      return reply.status(201).send({ data: decision });
    }
  );

  /**
   * GET /api/v1/decisions
   * List decisions with optional filters and cursor-based pagination
   * Ordered by madeAt (newest first)
   * Requires authentication
   */
  fastify.get<{ Querystring: ListDecisionsQuery }>(
    "/",
    {
      preHandler: [authenticate],
      preValidation: [validateQuery(listDecisionsQuerySchema)],
    },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        epicId?: string;
        featureId?: string;
        taskId?: string;
        category?: string;
        impact?: string;
        createdAt?: string;
        createdBefore?: string;
      } = {};

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit =
          typeof request.query.limit === "string"
            ? parseInt(request.query.limit, 10)
            : request.query.limit;
      }
      if (request.query.epicId) {
        options.epicId = request.query.epicId;
      }
      if (request.query.featureId) {
        options.featureId = request.query.featureId;
      }
      if (request.query.taskId) {
        options.taskId = request.query.taskId;
      }
      if (request.query.category) {
        options.category = request.query.category;
      }
      if (request.query.impact) {
        options.impact = request.query.impact;
      }
      if (request.query.createdAt) {
        options.createdAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.createdBefore = request.query.createdBefore;
      }

      const result = await listDecisions(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/decisions/search
   * Search decisions by query string in question, decision, and rationale fields
   * Requires authentication
   */
  fastify.get<{ Querystring: SearchDecisionsQuery }>(
    "/search",
    {
      preHandler: [authenticate],
      preValidation: [validateQuery(searchDecisionsQuerySchema)],
    },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        query: string;
        epicId?: string;
      } = {
        query: request.query.query ?? "",
      };

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit =
          typeof request.query.limit === "string"
            ? parseInt(request.query.limit, 10)
            : request.query.limit;
      }
      if (request.query.epicId) {
        options.epicId = request.query.epicId;
      }

      const result = await searchDecisions(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/decisions/context/task/:taskId
   * Get all decisions related to a task's context
   * Returns decisions for the task, its parent feature, and the epic
   * Requires authentication
   */
  fastify.get<{ Params: TaskIdParams }>(
    "/context/task/:taskId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await getDecisionContext(request.params.taskId);
      return reply.send({ data: result });
    }
  );

  /**
   * GET /api/v1/decisions/context/feature/:featureId
   * Get all decisions related to a feature's context
   * Returns decisions for the feature and the epic
   * Requires authentication
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/context/feature/:featureId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await getFeatureDecisionContext(request.params.featureId);
      return reply.send({ data: result });
    }
  );

  /**
   * GET /api/v1/decisions/:id
   * Get a single decision by ID with related context
   * Requires authentication
   */
  fastify.get<{ Params: DecisionIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const decision = await getDecisionById(request.params.id);
      if (!decision) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Decision with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: decision });
    }
  );
}
