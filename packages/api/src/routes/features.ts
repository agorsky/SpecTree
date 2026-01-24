import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
} from "../services/featureService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface ListFeaturesQuery {
  cursor?: string;
  limit?: string;
  projectId?: string;
  statusId?: string;
  assigneeId?: string;
}

interface FeatureIdParams {
  id: string;
}

interface CreateFeatureBody {
  title: string;
  projectId: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

interface UpdateFeatureBody {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

/**
 * Features routes plugin
 * Prefix: /api/v1/features
 */
export default async function featuresRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * GET /api/v1/features
   * List features with cursor-based pagination
   * Optional query params: projectId, statusId, assigneeId
   * Includes _count: { tasks } in response
   * Requires authentication
   */
  fastify.get<{ Querystring: ListFeaturesQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        projectId?: string;
        statusId?: string;
        assigneeId?: string;
      } = {};

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.projectId) {
        options.projectId = request.query.projectId;
      }
      if (request.query.statusId) {
        options.statusId = request.query.statusId;
      }
      if (request.query.assigneeId) {
        options.assigneeId = request.query.assigneeId;
      }

      const result = await listFeatures(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/features/:id
   * Get a single feature by ID with nested tasks array
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("guest")] },
    async (request, reply) => {
      const feature = await getFeatureById(request.params.id);
      if (!feature) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Feature with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: feature });
    }
  );

  /**
   * POST /api/v1/features
   * Create a new feature (auto-generates identifier in format TEAM_KEY-NUMBER)
   * Requires authentication, team membership (via projectId), and member+ role
   */
  fastify.post<{ Body: CreateFeatureBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("projectId"), requireRole("member")] },
    async (request, reply) => {
      const { title, projectId, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title: string;
        projectId: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {
        title,
        projectId,
      };

      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const feature = await createFeature(input);
      return reply.status(201).send({ data: feature });
    }
  );

  /**
   * PUT /api/v1/features/:id
   * Update an existing feature
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: FeatureIdParams; Body: UpdateFeatureBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { title, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title?: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {};

      if (title !== undefined) input.title = title;
      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const feature = await updateFeature(id, input);
      return reply.send({ data: feature });
    }
  );

  /**
   * DELETE /api/v1/features/:id
   * Delete a feature (hard delete, cascade will remove tasks)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: FeatureIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteFeature(id);
      return reply.status(204).send();
    }
  );
}
