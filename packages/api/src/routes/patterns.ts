import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { prisma } from "../lib/db.js";
import { authenticate } from "../middleware/authenticate.js";
import { NotFoundError } from "../errors/index.js";

// Request type definitions
interface PatternIdParams {
  id: string;
}

interface ListPatternsQuery {
  epicId?: string;
  category?: string;
  global?: string;
  limit?: string;
}

interface CreatePatternBody {
  epicId?: string | null;
  name: string;
  category: string;
  description: string;
  examples?: string[];
  source: string;
  confidence?: number;
}

interface UpdatePatternBody {
  name?: string;
  category?: string;
  description?: string;
  examples?: string[];
  source?: string;
  confidence?: number;
  epicId?: string | null;
}

/**
 * Patterns routes plugin (ENG-65)
 * Prefix: /api/v1/patterns
 */
export default function patternsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/patterns
   * List patterns with optional filters
   */
  fastify.get<{ Querystring: ListPatternsQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicId, category, limit } = request.query;
      const isGlobal = request.query.global === "true";
      const take = limit ? parseInt(limit, 10) : 50;

      const where: Record<string, unknown> = {};
      if (epicId) {
        where.epicId = epicId;
      }
      if (isGlobal) {
        where.epicId = null;
      }
      if (category) {
        where.category = category;
      }

      const patterns = await prisma.pattern.findMany({
        where,
        take,
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        data: patterns.map(formatPattern),
      });
    }
  );

  /**
   * GET /api/v1/patterns/:id
   * Get a single pattern by ID
   */
  fastify.get<{ Params: PatternIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const pattern = await prisma.pattern.findUnique({
        where: { id: request.params.id },
      });

      if (!pattern) {
        throw new NotFoundError(`Pattern '${request.params.id}' not found`);
      }

      return reply.send({ data: formatPattern(pattern) });
    }
  );

  /**
   * POST /api/v1/patterns
   * Create a new pattern
   */
  fastify.post<{ Body: CreatePatternBody }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicId, name, category, description, examples, source, confidence } =
        request.body;

      const pattern = await prisma.pattern.create({
        data: {
          epicId: epicId ?? null,
          name,
          category,
          description,
          examples: examples ? JSON.stringify(examples) : null,
          source,
          confidence: confidence ?? 0.5,
        },
      });

      return reply.status(201).send({ data: formatPattern(pattern) });
    }
  );

  /**
   * PATCH /api/v1/patterns/:id
   * Update a pattern
   */
  fastify.patch<{ Params: PatternIdParams; Body: UpdatePatternBody }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const existing = await prisma.pattern.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        throw new NotFoundError(`Pattern '${request.params.id}' not found`);
      }

      const data: Record<string, unknown> = {};
      if (request.body.name !== undefined) data.name = request.body.name;
      if (request.body.category !== undefined) data.category = request.body.category;
      if (request.body.description !== undefined)
        data.description = request.body.description;
      if (request.body.examples !== undefined)
        data.examples = JSON.stringify(request.body.examples);
      if (request.body.source !== undefined) data.source = request.body.source;
      if (request.body.confidence !== undefined)
        data.confidence = request.body.confidence;
      if (request.body.epicId !== undefined) data.epicId = request.body.epicId;

      const pattern = await prisma.pattern.update({
        where: { id: request.params.id },
        data,
      });

      return reply.send({ data: formatPattern(pattern) });
    }
  );

  /**
   * DELETE /api/v1/patterns/:id
   * Delete a pattern
   */
  fastify.delete<{ Params: PatternIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const existing = await prisma.pattern.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        throw new NotFoundError(`Pattern '${request.params.id}' not found`);
      }

      await prisma.pattern.delete({
        where: { id: request.params.id },
      });

      return reply.status(204).send();
    }
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatPattern(pattern: {
  id: string;
  epicId: string | null;
  name: string;
  category: string;
  description: string;
  examples: string | null;
  source: string;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: pattern.id,
    epicId: pattern.epicId,
    name: pattern.name,
    category: pattern.category,
    description: pattern.description,
    examples: pattern.examples ? JSON.parse(pattern.examples) : [],
    source: pattern.source,
    confidence: pattern.confidence,
    createdAt: pattern.createdAt.toISOString(),
    updatedAt: pattern.updatedAt.toISOString(),
  };
}
