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
import type { SessionEvent } from "@spectree/shared";
import { eventHistory } from "../events/eventHistory.js";

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
   * Helper function to get the epic ID for an entity.
   * Returns null if not found or on error.
   */
  async function getEpicIdForEntity(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    try {
      if (entityType === "epic") {
        return entityId;
      } else if (entityType === "feature") {
        const feature = await prisma.feature.findUnique({
          where: { id: entityId },
          select: { epicId: true },
        });
        return feature?.epicId ?? null;
      } else if (entityType === "task") {
        const task = await prisma.task.findUnique({
          where: { id: entityId },
          include: { feature: { select: { epicId: true } } },
        });
        return task?.feature.epicId ?? null;
      }
      return null;
    } catch (error) {
      return null;
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
   * - eventTypes (optional): Comma-separated list of event types to filter (e.g., "SESSION_STARTED,SESSION_ENDED")
   * 
   * Headers:
   * - Last-Event-ID (optional): Resume from this event ID (replays missed events from buffer)
   */
  fastify.get<{ Querystring: { epicId?: string; eventTypes?: string } }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicId, eventTypes } = request.query;
      const lastEventId = request.headers['last-event-id'] as string | undefined;

      // Parse eventTypes filter
      const eventTypesFilter = eventTypes
        ? eventTypes.split(",").map((t) => t.trim())
        : null;

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

      // Replay missed events from circular buffer if Last-Event-ID is provided
      if (epicId && lastEventId) {
        try {
          const bufferedEvents = eventHistory.getEventsAfter(epicId, lastEventId);
          for (const event of bufferedEvents) {
            // Apply eventTypes filter if specified
            if (eventTypesFilter && event.type === "session.event") {
              const sessionEvent = event.data as SessionEvent;
              if (!eventTypesFilter.includes(sessionEvent.eventType.toString())) {
                continue;
              }
            }
            
            // Send buffered event in SSE format with id field
            reply.raw.write(`id: ${event.id}\ndata: ${JSON.stringify({ type: event.type, data: event.data })}\n\n`);
          }
        } catch (error) {
          fastify.log.error(error, "Error replaying buffered events");
        }
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

          // Determine epic ID for this event
          const eventEpicId = epicId || await getEpicIdForEntity(event.entityType, event.entityId);
          
          // Store in circular buffer and get event ID
          const eventId = eventEpicId ? eventHistory.addEvent(eventEpicId, "entity.created", event) : undefined;
          
          const data = JSON.stringify({
            type: "entity.created",
            data: event,
          });
          
          // Send in SSE format: id field on separate line, then data
          if (eventId) {
            reply.raw.write(`id: ${eventId}\ndata: ${data}\n\n`);
          } else {
            reply.raw.write(`data: ${data}\n\n`);
          }
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

          // Determine epic ID for this event
          const eventEpicId = epicId || await getEpicIdForEntity(event.entityType, event.entityId);
          
          // Store in circular buffer and get event ID
          const eventId = eventEpicId ? eventHistory.addEvent(eventEpicId, "entity.updated", event) : undefined;
          
          const data = JSON.stringify({
            type: "entity.updated",
            data: event,
          });
          
          // Send in SSE format: id field on separate line, then data
          if (eventId) {
            reply.raw.write(`id: ${eventId}\ndata: ${data}\n\n`);
          } else {
            reply.raw.write(`data: ${data}\n\n`);
          }
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

          // Determine epic ID for this event
          const eventEpicId = epicId || await getEpicIdForEntity(event.entityType, event.entityId);
          
          // Store in circular buffer and get event ID
          const eventId = eventEpicId ? eventHistory.addEvent(eventEpicId, "entity.deleted", event) : undefined;
          
          const data = JSON.stringify({
            type: "entity.deleted",
            data: event,
          });
          
          // Send in SSE format: id field on separate line, then data
          if (eventId) {
            reply.raw.write(`id: ${eventId}\ndata: ${data}\n\n`);
          } else {
            reply.raw.write(`data: ${data}\n\n`);
          }
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

          // Determine epic ID for this event
          const eventEpicId = epicId || await getEpicIdForEntity(event.entityType, event.entityId);
          
          // Store in circular buffer and get event ID
          const eventId = eventEpicId ? eventHistory.addEvent(eventEpicId, "progress.logged", event) : undefined;
          
          const data = JSON.stringify({
            type: "progress.logged",
            data: event,
          });
          
          // Send in SSE format: id field on separate line, then data
          if (eventId) {
            reply.raw.write(`id: ${eventId}\ndata: ${data}\n\n`);
          } else {
            reply.raw.write(`data: ${data}\n\n`);
          }
        } catch (error) {
          fastify.log.error(error, "Error handling progress.logged event");
        }
      };

      const handleSessionEvent = async (event: SessionEvent) => {
        try {
          // If epicId filter is set, check if event belongs to that epic
          if (epicId && event.epicId !== epicId) {
            return;
          }

          // If eventTypes filter is set, check if this event type should be included
          // Convert event.eventType (enum value) to string for comparison
          if (eventTypesFilter && !eventTypesFilter.includes(event.eventType.toString())) {
            return;
          }

          // Store in circular buffer and get event ID
          const eventId = eventHistory.addEvent(event.epicId, "session.event", event);
          
          const data = JSON.stringify({
            type: "session.event",
            data: event,
          });
          
          // Send in SSE format: id field on separate line, then data
          reply.raw.write(`id: ${eventId}\ndata: ${data}\n\n`);
        } catch (error) {
          fastify.log.error(error, "Error handling session.event");
        }
      };

      // Register event listeners
      eventEmitter.on(Events.ENTITY_CREATED, handleEntityCreated);
      eventEmitter.on(Events.ENTITY_UPDATED, handleEntityUpdated);
      eventEmitter.on(Events.ENTITY_DELETED, handleEntityDeleted);
      eventEmitter.on(Events.PROGRESS_LOGGED, handleProgressLogged);
      eventEmitter.on(Events.SESSION_EVENT, handleSessionEvent);

      // Cleanup on client disconnect
      const cleanup = () => {
        try {
          clearInterval(keepaliveInterval);
          eventEmitter.off(Events.ENTITY_CREATED, handleEntityCreated);
          eventEmitter.off(Events.ENTITY_UPDATED, handleEntityUpdated);
          eventEmitter.off(Events.ENTITY_DELETED, handleEntityDeleted);
          eventEmitter.off(Events.PROGRESS_LOGGED, handleProgressLogged);
          eventEmitter.off(Events.SESSION_EVENT, handleSessionEvent);
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
