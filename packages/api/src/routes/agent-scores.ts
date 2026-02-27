import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  getScore,
  getLeaderboard,
  adjustScore,
} from "../services/agentScoreService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import {
  adjustScoreSchema,
  type AdjustScoreInput,
} from "../schemas/agentScore.js";

interface AgentNameParams {
  agentName: string;
}

/**
 * Agent Scores routes plugin
 * Prefix: /api/v1/agent-scores
 */
export default function agentScoresRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/agent-scores
   * Leaderboard — all agents sorted by totalScore desc, with rank
   */
  fastify.get(
    "/",
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const agents = await getLeaderboard();
      const ranked = agents.map((agent, index) => ({
        rank: index + 1,
        ...agent,
      }));
      return reply.send({ data: ranked });
    }
  );

  /**
   * GET /api/v1/agent-scores/:agentName
   * Single agent score
   */
  fastify.get<{ Params: AgentNameParams }>(
    "/:agentName",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const agent = await getScore(request.params.agentName);
      return reply.send({ data: agent });
    }
  );

  /**
   * PUT /api/v1/agent-scores/:agentName/adjust
   * Manual score adjustment
   */
  fastify.put<{ Params: AgentNameParams; Body: AdjustScoreInput }>(
    "/:agentName/adjust",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(adjustScoreSchema)],
    },
    async (request, reply) => {
      const { delta, reason } = request.body;
      const agent = await adjustScore(
        request.params.agentName,
        delta,
        reason
      );
      return reply.send({ data: agent });
    }
  );
}
