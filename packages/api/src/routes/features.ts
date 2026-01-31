import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
} from "../services/featureService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { reorderFeatureSchema, type ReorderFeatureInput } from "../schemas/feature.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface ListFeaturesQuery {
  cursor?: string;
  limit?: string;
  epicId?: string;
  statusId?: string;
  /** Status filter - can be ID or name (single or array via repeated param) */
  status?: string | string[];
  /** Filter by status category (backlog, unstarted, started, completed, canceled) */
  statusCategory?: string;
  assigneeId?: string;
  /** Assignee filter - supports "me", "none", email, or UUID */
  assignee?: string;
  query?: string;
  createdAt?: string;
  createdBefore?: string;
  updatedAt?: string;
  updatedBefore?: string;
}

interface FeatureIdParams {
  id: string;
}

interface CreateFeatureBody {
  title: string;
  epicId: string;
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

interface BulkUpdateBody {
  ids: string[];
  statusId: string;
}

/**
 * Features routes plugin
 * Prefix: /api/v1/features
 */
export default function featuresRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/features
   * List features with cursor-based pagination
   * Optional query params: epicId, statusId, assigneeId
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
        epicId?: string;
        statusId?: string;
        status?: string | string[];
        statusCategory?: string;
        assigneeId?: string;
        assignee?: string;
        currentUserId?: string;
        query?: string;
        createdAt?: string;
        createdBefore?: string;
        updatedAt?: string;
        updatedBefore?: string;
      } = {};

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.epicId) {
        options.epicId = request.query.epicId;
      }
      // Enhanced status filtering (supports name, ID, array, category)
      if (request.query.status) {
        options.status = request.query.status;
      } else if (request.query.statusCategory) {
        options.statusCategory = request.query.statusCategory;
      } else if (request.query.statusId) {
        // Legacy support for direct statusId
        options.statusId = request.query.statusId;
      }
      // Enhanced assignee filtering
      if (request.query.assignee) {
        options.assignee = request.query.assignee;
        if (request.user?.id) {
          options.currentUserId = request.user.id;
        }
      } else if (request.query.assigneeId) {
        // Legacy support for direct assigneeId
        options.assigneeId = request.query.assigneeId;
      }
      if (request.query.query) {
        options.query = request.query.query;
      }
      if (request.query.createdAt) {
        options.createdAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.createdBefore = request.query.createdBefore;
      }
      if (request.query.updatedAt) {
        options.updatedAt = request.query.updatedAt;
      }
      if (request.query.updatedBefore) {
        options.updatedBefore = request.query.updatedBefore;
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
   * Requires authentication, team membership (via epicId), and member+ role
   */
  fastify.post<{ Body: CreateFeatureBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("epicId"), requireRole("member")] },
    async (request, reply) => {
      const { title, epicId, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title: string;
        epicId: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {
        title,
        epicId,
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
   * PUT /api/v1/features/:id/reorder
   * Reorder a feature within its epic
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: FeatureIdParams; Body: ReorderFeatureInput }>(
    "/:id/reorder",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(reorderFeatureSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Fetch the feature being reordered
      const feature = await prisma.feature.findUnique({
        where: { id },
        select: { id: true, epicId: true },
      });

      if (!feature) {
        throw new NotFoundError(`Feature with id '${id}' not found`);
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, the new position is after that feature
      // So "afterId" feature's sortOrder becomes our "before" value
      if (afterId) {
        const afterFeature = await prisma.feature.findUnique({
          where: { id: afterId },
          select: { id: true, epicId: true, sortOrder: true },
        });

        if (!afterFeature) {
          throw new NotFoundError(`Feature with id '${afterId}' not found`);
        }

        if (afterFeature.epicId !== feature.epicId) {
          throw new ValidationError("Cannot reorder: afterId feature belongs to a different epic");
        }

        beforeSortOrder = afterFeature.sortOrder;
      }

      // If beforeId provided, the new position is before that feature
      // So "beforeId" feature's sortOrder becomes our "after" value
      if (beforeId) {
        const beforeFeature = await prisma.feature.findUnique({
          where: { id: beforeId },
          select: { id: true, epicId: true, sortOrder: true },
        });

        if (!beforeFeature) {
          throw new NotFoundError(`Feature with id '${beforeId}' not found`);
        }

        if (beforeFeature.epicId !== feature.epicId) {
          throw new ValidationError("Cannot reorder: beforeId feature belongs to a different epic");
        }

        afterSortOrder = beforeFeature.sortOrder;
      }

      // Calculate the new sortOrder
      const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the feature's sortOrder
      const updatedFeature = await prisma.feature.update({
        where: { id },
        data: { sortOrder: newSortOrder },
      });

      return reply.send({ data: updatedFeature });
    }
  );

  /**
   * PUT /api/v1/features/bulk-update
   * Update status for multiple features at once
   * Requires authentication
   */
  fastify.put<{ Body: BulkUpdateBody }>(
    "/bulk-update",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { ids, statusId } = request.body;

      // Validate inputs
      if (ids.length === 0) {
        throw new ValidationError("ids array is required and cannot be empty");
      }
      if (!statusId) {
        throw new ValidationError("statusId is required");
      }

      // Verify status exists
      const status = await prisma.status.findUnique({
        where: { id: statusId },
        select: { id: true, teamId: true },
      });
      if (!status) {
        throw new NotFoundError(`Status with id '${statusId}' not found`);
      }

      // Verify all features exist and belong to epics in the status's team
      const features = await prisma.feature.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          epic: {
            select: { teamId: true },
          },
        },
      });

      if (features.length !== ids.length) {
        const foundIds = features.map((f) => f.id);
        const missingIds = ids.filter((id) => !foundIds.includes(id));
        throw new NotFoundError(
          `Features not found: ${missingIds.join(", ")}`
        );
      }

      // Verify all features belong to the same team as the status
      const invalidFeatures = features.filter(
        (f) => f.epic.teamId !== status.teamId
      );
      if (invalidFeatures.length > 0) {
        throw new ValidationError(
          `Some features do not belong to the same team as the status`
        );
      }

      // Update in transaction
      const result = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.feature.updateMany({
          where: { id: { in: ids } },
          data: { statusId },
        });
        return updateResult.count;
      });

      return reply.send({ updated: result });
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
