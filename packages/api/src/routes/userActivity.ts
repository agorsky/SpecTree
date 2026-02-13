import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { ForbiddenError, ValidationError } from "../errors/index.js";
import {
  getUserActivity,
  getActivityDetails,
  type ActivityInterval,
  type ActivityScope,
  type MetricType,
} from "../services/userActivityService.js";

export interface UserActivityQuerystring {
  interval: ActivityInterval;
  page?: number;
  limit?: number;
  timeZone?: string;
  scope?: ActivityScope;
  scopeId?: string;
}

/**
 * User Activity routes plugin
 * Prefix: /api/v1/user-activity
 */
export default function userActivityRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/user-activity
   * Returns aggregated user activity data for the authenticated user
   * 
   * Activity is attributed as follows:
   * - Features: counted for the user who created them (createdBy)
   * - Tasks: counted for the user who implemented them (implementedBy)
   * 
   * Admin users can specify scope to view activity for:
   * - 'self' (default): User's own activity (items created/implemented by them)
   * - 'all': All activity in the system (no user filtering)
   * - 'team': Activity for a specific team (requires scopeId, no user filtering)
   * - 'user': Activity for a specific user (requires scopeId, filtered by that user's created/implemented items)
   */
  fastify.get<{ Querystring: UserActivityQuerystring }>(
    "/",
    {
      preHandler: [authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const { 
        interval = "week", 
        page, 
        limit, 
        timeZone,
        scope = "self",
        scopeId,
      } = request.query;
      const userId = request.user!.id;
      const isAdmin = request.user!.isGlobalAdmin;

      // Validate scope parameter
      const validScopes: ActivityScope[] = ["self", "all", "team", "user"];
      if (!validScopes.includes(scope)) {
        throw new ValidationError(
          `Invalid scope. Must be one of: ${validScopes.join(", ")}`
        );
      }

      // Admin authorization check: non-self scopes require admin
      if (scope !== "self" && !isAdmin) {
        throw new ForbiddenError(
          "Global admin access required to view activity for other scopes"
        );
      }

      // Validate scopeId is provided when required
      if ((scope === "team" || scope === "user") && !scopeId) {
        throw new ValidationError(
          `scopeId is required when scope is '${scope}'`
        );
      }

      // Validate scopeId is NOT provided when not required
      if ((scope === "self" || scope === "all") && scopeId) {
        throw new ValidationError(
          `scopeId should not be provided when scope is '${scope}'`
        );
      }

      const parsedPage = Number(page) || 1;
      const parsedLimit = Number(limit) || 30;
      const clampedLimit = Math.min(Math.max(parsedLimit, 1), 100);
      const clampedPage = Math.max(parsedPage, 1);

      return getUserActivity({
        userId,
        interval,
        page: clampedPage,
        limit: clampedLimit,
        scope,
        ...(scopeId != null ? { scopeId } : {}),
        ...(timeZone ? { timeZone } : {}),
      });
    }
  );

  /**
   * GET /api/v1/user-activity/details
   * Returns detailed item records for a specific metric type
   * 
   * Respects attribution fields:
   * - Features are filtered by createdBy when scope is 'self' or 'user'
   * - Tasks are filtered by implementedBy when scope is 'self' or 'user'
   */
  fastify.get<{
    Querystring: {
      metricType: MetricType;
      interval?: ActivityInterval;
      page?: number;
      scope?: ActivityScope;
      scopeId?: string;
      timeZone?: string;
      limit?: number;
      cursor?: string;
    };
  }>(
    "/details",
    {
      preHandler: [authenticate],
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const {
        metricType,
        interval = "week",
        page,
        scope = "self",
        scopeId,
        timeZone,
        limit,
        cursor,
      } = request.query;

      const userId = request.user!.id;
      const isAdmin = request.user!.isGlobalAdmin;

      // Validate metricType
      const validMetrics: MetricType[] = ["features", "tasks", "decisions", "sessions"];
      if (!validMetrics.includes(metricType)) {
        throw new ValidationError(
          `Invalid metricType. Must be one of: ${validMetrics.join(", ")}`
        );
      }

      // Validate scope
      const validScopes: ActivityScope[] = ["self", "all", "team", "user"];
      if (!validScopes.includes(scope)) {
        throw new ValidationError(
          `Invalid scope. Must be one of: ${validScopes.join(", ")}`
        );
      }

      if (scope !== "self" && !isAdmin) {
        throw new ForbiddenError(
          "Global admin access required to view activity for other scopes"
        );
      }

      if ((scope === "team" || scope === "user") && !scopeId) {
        throw new ValidationError(
          `scopeId is required when scope is '${scope}'`
        );
      }

      const parsedPage = Number(page) || 1;
      const parsedLimit = Number(limit) || 50;

      return getActivityDetails({
        userId,
        metricType,
        interval,
        page: parsedPage,
        scope,
        ...(scopeId != null ? { scopeId } : {}),
        ...(timeZone ? { timeZone } : {}),
        limit: Math.min(Math.max(parsedLimit, 1), 100),
        ...(cursor ? { cursor } : {}),
      });
    }
  );
}
