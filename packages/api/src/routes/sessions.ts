import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  startSession,
  endSession,
  getActiveSession,
  getLastSession,
  getSessionHistory,
  getSession,
  logSessionWork,
  abandonSession,
} from "../services/sessionService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import {
  startSessionSchema,
  endSessionSchema,
  logSessionWorkSchema,
  type StartSessionInput,
  type EndSessionInput,
  type LogSessionWorkInput,
} from "../schemas/session.js";

// =============================================================================
// Request Type Definitions
// =============================================================================

interface SessionIdParams {
  id: string;
}

interface EpicIdParams {
  epicId: string;
}

interface SessionHistoryQuery {
  limit?: string;
}

// =============================================================================
// Routes
// =============================================================================

export default async function sessionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
): Promise<void> {
  // Apply authentication to all routes
  fastify.addHook("preHandler", authenticate);

  // ---------------------------------------------------------------------------
  // POST /api/v1/sessions/start - Start a new session
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: StartSessionInput;
  }>(
    "/start",
    {
      preHandler: validateBody(startSessionSchema),
    },
    async (request, reply) => {
      const result = await startSession(request.body);
      return reply.status(201).send({ data: result });
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/sessions/:epicId/end - End the active session for an epic
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: EpicIdParams;
    Body: EndSessionInput;
  }>(
    "/:epicId/end",
    {
      preHandler: validateBody(endSessionSchema),
    },
    async (request, reply) => {
      const result = await endSession(request.params.epicId, request.body);
      return reply.send({ data: result });
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/sessions/:epicId/active - Get active session for an epic
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: EpicIdParams;
  }>("/:epicId/active", async (request, reply) => {
    const result = await getActiveSession(request.params.epicId);
    if (!result) {
      return reply.status(404).send({
        error: "No active session found for this epic",
      });
    }
    return reply.send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/sessions/:epicId/last - Get the last completed session
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: EpicIdParams;
  }>("/:epicId/last", async (request, reply) => {
    const result = await getLastSession(request.params.epicId);
    if (!result) {
      return reply.status(404).send({
        error: "No completed sessions found for this epic",
      });
    }
    return reply.send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/sessions/:epicId/history - Get session history for an epic
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: EpicIdParams;
    Querystring: SessionHistoryQuery;
  }>("/:epicId/history", async (request, reply) => {
    const limit = request.query.limit
      ? Math.min(Math.max(parseInt(request.query.limit, 10), 1), 100)
      : 10;
    
    const result = await getSessionHistory(request.params.epicId, limit);
    return reply.send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/sessions/by-id/:id - Get a specific session by ID
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: SessionIdParams;
  }>("/by-id/:id", async (request, reply) => {
    const result = await getSession(request.params.id);
    return reply.send({ data: result });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/sessions/:epicId/log-work - Log work done during a session
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: EpicIdParams;
    Body: LogSessionWorkInput;
  }>(
    "/:epicId/log-work",
    {
      preHandler: validateBody(logSessionWorkSchema),
    },
    async (request, reply) => {
      const result = await logSessionWork(request.params.epicId, request.body);
      if (!result) {
        return reply.status(404).send({
          error: "No active session found for this epic",
        });
      }
      return reply.send({ data: result });
    }
  );

  // ---------------------------------------------------------------------------
  // POST /api/v1/sessions/by-id/:id/abandon - Abandon a session
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: SessionIdParams;
  }>("/by-id/:id/abandon", async (request, reply) => {
    const result = await abandonSession(request.params.id);
    return reply.send({ data: result });
  });
}
