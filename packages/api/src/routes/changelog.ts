import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  getEntityChangelog,
  getEpicChangelog,
} from "../services/changelogService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateQuery, validateParams } from "../middleware/validate.js";
import {
  entityChangelogQuerySchema,
  epicChangelogQuerySchema,
  entityTypeParamSchema,
  entityIdParamSchema,
  epicIdParamSchema,
  type EntityChangelogQuery,
  type EpicChangelogQuery,
  type EntityType,
} from "../schemas/changelog.js";

// Request type definitions
interface EntityChangelogParams {
  entityType: EntityType;
  entityId: string;
}

interface EpicChangelogParams {
  epicId: string;
}

/**
 * Changelog routes plugin
 * Prefix: /api/v1/changelog
 */
export default function changelogRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/changelog/:entityType/:entityId
   * Get changelog for a specific entity (epic, feature, or task)
   * Returns paginated history of field-level changes
   * Requires authentication
   * 
   * Query parameters:
   * - cursor: Pagination cursor
   * - limit: Results per page (default: 20, max: 100)
   * - field: Filter by specific field name
   * - changedBy: Filter by user ID who made the change
   * - since: Filter changes on or after this date (ISO-8601 date or duration)
   * - until: Filter changes before this date
   */
  fastify.get<{
    Params: EntityChangelogParams;
    Querystring: EntityChangelogQuery;
  }>(
    "/:entityType/:entityId",
    {
      preHandler: [authenticate],
      preValidation: [
        validateParams(entityTypeParamSchema.merge(entityIdParamSchema)),
        validateQuery(entityChangelogQuerySchema),
      ],
    },
    async (request, reply) => {
      const { entityType, entityId } = request.params;

      // Build options for service call
      const options: {
        entityType: EntityType;
        entityId: string;
        cursor?: string;
        limit?: number;
        field?: string;
        changedBy?: string;
        changedAt?: string;
        changedBefore?: string;
      } = {
        entityType,
        entityId,
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
      if (request.query.field) {
        options.field = request.query.field;
      }
      if (request.query.changedBy) {
        options.changedBy = request.query.changedBy;
      }
      if (request.query.createdAt) {
        options.changedAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.changedBefore = request.query.createdBefore;
      }

      const result = await getEntityChangelog(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/changelog/epic/:epicId
   * Get changelog for an entire epic hierarchy
   * Returns paginated history of all changes across the epic, its features, and tasks
   * Requires authentication
   * 
   * Query parameters:
   * - cursor: Pagination cursor
   * - limit: Results per page (default: 20, max: 100)
   * - entityType: Filter by entity type (epic, feature, task)
   * - field: Filter by specific field name
   * - changedBy: Filter by user ID who made the change
   * - since: Filter changes on or after this date (ISO-8601 date or duration)
   * - until: Filter changes before this date
   */
  fastify.get<{
    Params: EpicChangelogParams;
    Querystring: EpicChangelogQuery;
  }>(
    "/epic/:epicId",
    {
      preHandler: [authenticate],
      preValidation: [
        validateParams(epicIdParamSchema),
        validateQuery(epicChangelogQuerySchema),
      ],
    },
    async (request, reply) => {
      const { epicId } = request.params;

      // Build options for service call
      const options: {
        epicId: string;
        cursor?: string;
        limit?: number;
        entityType?: EntityType;
        field?: string;
        changedBy?: string;
        changedAt?: string;
        changedBefore?: string;
      } = {
        epicId,
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
      if (request.query.entityType) {
        options.entityType = request.query.entityType;
      }
      if (request.query.field) {
        options.field = request.query.field;
      }
      if (request.query.changedBy) {
        options.changedBy = request.query.changedBy;
      }
      if (request.query.createdAt) {
        options.changedAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.changedBefore = request.query.createdBefore;
      }

      const result = await getEpicChangelog(options);
      return reply.send(result);
    }
  );
}
