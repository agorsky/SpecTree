import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { NotFoundError } from "../errors/index.js";
import { compileBriefing } from "../services/memoryCompilerService.js";
import { prisma } from "../lib/db.js";

interface EpicIdParams {
  epicId: string;
}

/**
 * Briefings routes plugin (ENG-66)
 * Prefix: /api/v1/epics (nested under epics)
 */
export default function briefingsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/epics/:epicId/briefing
   * Compile and return a briefing for the epic
   */
  fastify.get<{ Params: EpicIdParams }>(
    "/:epicId/briefing",
    { preHandler: [authenticate] },
    async (request, reply) => {
      // Resolve epic ID (could be name or UUID)
      const epic = await prisma.epic.findFirst({
        where: {
          OR: [
            { id: request.params.epicId },
            { name: request.params.epicId },
          ],
        },
      });

      if (!epic) {
        throw new NotFoundError(`Epic '${request.params.epicId}' not found`);
      }

      const briefing = await compileBriefing(epic.id);
      return reply.send({ data: briefing });
    }
  );
}
