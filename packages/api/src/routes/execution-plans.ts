import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { getExecutionPlan } from "../services/execution-plan.js";
import { authenticate } from "../middleware/authenticate.js";

interface GetExecutionPlanQuery {
  epicId: string;
}

export default function executionPlansRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/execution-plans?epicId=...
   * Returns an execution plan for the given epic, including task phases, parallel groups, and dependencies.
   * Requires authentication.
   */
  fastify.get<{ Querystring: GetExecutionPlanQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicId } = request.query;
      const plan = await getExecutionPlan(epicId);
      return reply.send({ data: plan });
    }
  );
}
