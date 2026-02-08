import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { prisma } from "../lib/db.js";
import {
  eventEmitter,
  Events,
  type EntityCreatedEvent,
  type EntityUpdatedEvent,
  type EntityDeletedEvent,
  type ProgressLoggedEvent,
} from "../events/index.js";

/**
 * SSE Events routes plugin
 * Prefix: /api/v1/events
 */
export default function eventsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * Helper function to check if an entity belongs to a specific epic.
   * For epics: direct match
   * For features: check epicId field
   * For tasks: check feature's epicId
   */
  async function entityBelongsToEpic(
    entityType: string,
    entityId: string,
    epicId: string
  ): Promise<boolean> {
    try {
      if (entityType === "epic") {
        return entityId === epicId;
      } else if (entityType === "feature") {
        const feature = await prisma.feature.findUnique({
          where: { id: entityId },
          select: { epicId: true },
        });
        return feature?.epicId === epicId;
      } else if (entityType === "task") {
        const task = await prisma.task.findUnique({
          where: { id: entityId },
          include: { feature: { select: { epicId: true } } },
        });
        return task?.feature.epicId === epicId;
      }
      return false;
    } catch (error) {
      // If query fails, default to not filtering
      return true;
    }
  }

  /**
   * GET /api/v1/events
   * Server-Sent Events (SSE) endpoint for real-time entity updates
   * 
   * Requires JWT authentication via Authorization: Bearer <token>
   * 
   * Query params:
   * - epicId (optional): Filter events to only include entities from this epic
   */
  fastify.get<{ Querystring: { epicId?: string } }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicId } = request.query;

      // Set SSE headers
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");

      // Send initial connection message
      try {
        reply.raw.write(`:connected\n\n`);
      } catch (error) {
        fastify.log.error(error, "Error sending SSE connection message");
        return;
      }

      // Keepalive interval - send comment every 30 seconds
      const keepaliveInterval = setInterval(() => {
        try {
          reply.raw.write(`:keepalive\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error sending SSE keepalive");
          clearInterval(keepaliveInterval);
        }
      }, 30000);

      // Event handlers with epicId filtering
      const handleEntityCreated = async (event: EntityCreatedEvent) => {
        try {
          // If epicId filter is set, check if entity belongs to that epic
          if (epicId) {
            const belongs = await entityBelongsToEpic(event.entityType, event.entityId, epicId);
            if (!belongs) return;
          }
          
          const data = JSON.stringify({
            type: "entity.created",
            data: event,
          });
          reply.raw.write(`data: ${data}\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error handling entity.created event");
        }
      };

      const handleEntityUpdated = async (event: EntityUpdatedEvent) => {
        try {
          // If epicId filter is set, check if entity belongs to that epic
          if (epicId) {
            const belongs = await entityBelongsToEpic(event.entityType, event.entityId, epicId);
            if (!belongs) return;
          }
          
          const data = JSON.stringify({
            type: "entity.updated",
            data: event,
          });
          reply.raw.write(`data: ${data}\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error handling entity.updated event");
        }
      };

      const handleEntityDeleted = async (event: EntityDeletedEvent) => {
        try {
          // If epicId filter is set, check if entity belongs to that epic
          if (epicId) {
            const belongs = await entityBelongsToEpic(event.entityType, event.entityId, epicId);
            if (!belongs) return;
          }
          
          const data = JSON.stringify({
            type: "entity.deleted",
            data: event,
          });
          reply.raw.write(`data: ${data}\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error handling entity.deleted event");
        }
      };

      const handleProgressLogged = async (event: ProgressLoggedEvent) => {
        try {
          // If epicId filter is set, check if entity belongs to that epic
          if (epicId) {
            const belongs = await entityBelongsToEpic(event.entityType, event.entityId, epicId);
            if (!belongs) return;
          }
          
          const data = JSON.stringify({
            type: "progress.logged",
            data: event,
          });
          reply.raw.write(`data: ${data}\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error handling progress.logged event");
        }
      };

      // Register event listeners
      eventEmitter.on(Events.ENTITY_CREATED, handleEntityCreated);
      eventEmitter.on(Events.ENTITY_UPDATED, handleEntityUpdated);
      eventEmitter.on(Events.ENTITY_DELETED, handleEntityDeleted);
      eventEmitter.on(Events.PROGRESS_LOGGED, handleProgressLogged);

      // Cleanup on client disconnect
      const cleanup = () => {
        try {
          clearInterval(keepaliveInterval);
          eventEmitter.off(Events.ENTITY_CREATED, handleEntityCreated);
          eventEmitter.off(Events.ENTITY_UPDATED, handleEntityUpdated);
          eventEmitter.off(Events.ENTITY_DELETED, handleEntityDeleted);
          eventEmitter.off(Events.PROGRESS_LOGGED, handleProgressLogged);
          fastify.log.info("SSE connection cleaned up");
        } catch (error) {
          fastify.log.error(error, "Error during SSE cleanup");
        }
      };

      request.raw.on("close", cleanup);
      request.raw.on("error", cleanup);
    }
  );
}
