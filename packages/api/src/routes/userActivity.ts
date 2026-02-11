import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import {
  getUserActivity,
  type ActivityInterval,
} from "../services/userActivityService.js";

export interface UserActivityQuerystring {
  interval: ActivityInterval;
  page?: number;
  limit?: number;
  timeZone?: string;
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
      const { interval = "week", page, limit, timeZone } = request.query;
      const userId = request.user!.id;

      const parsedPage = Number(page) || 1;
      const parsedLimit = Number(limit) || 30;
      const clampedLimit = Math.min(Math.max(parsedLimit, 1), 100);
      const clampedPage = Math.max(parsedPage, 1);

      return getUserActivity({
        userId,
        interval,
        page: clampedPage,
        limit: clampedLimit,
        ...(timeZone ? { timeZone } : {}),
      });
    }
  );
}
