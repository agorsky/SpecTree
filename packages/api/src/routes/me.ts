import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { prisma } from "../lib/db.js";
import { authenticate } from "../middleware/authenticate.js";
import { NotFoundError, ValidationError, ConflictError } from "../errors/index.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import {
  createPersonalProjectSchema,
  createPersonalStatusSchema,
  type CreatePersonalProjectInput,
  type CreatePersonalStatusInput,
} from "../schemas/me.js";
import {
  createPersonalEpicRequestSchema,
  listEpicRequestsQuerySchema,
  type CreatePersonalEpicRequestInput,
  type EpicRequestStatus,
} from "../schemas/epicRequest.js";
import { getPersonalScope, createPersonalScope } from "../services/personalScopeService.js";
import { createEpicRequest } from "../services/epicRequestService.js";
import { getMyWork, getBlockedSummary } from "../services/summaryService.js";
import { validateBody, validateQuery } from "../middleware/validate.js";

// Request type definitions
interface ListPersonalProjectsQuery {
  cursor?: string;
  limit?: string;
}

interface ListPersonalEpicRequestsQuery {
  cursor?: string;
  limit?: string;
  status?: EpicRequestStatus;
}

/**
 * Me routes plugin - Personal Scope operations
 * Prefix: /api/v1/me
 *
 * All routes require authentication and operate on the current user's personal scope.
 */
export default async function meRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // =========================================================================
  // GET /me/scope - Get user's personal scope
  // =========================================================================
  /**
   * GET /api/v1/me/scope
   * Get the authenticated user's personal scope.
   * Creates the personal scope if it doesn't exist (lazy initialization).
   * Requires authentication.
   */
  fastify.get(
    "/scope",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Try to get existing personal scope
      let personalScope = await getPersonalScope(userId);

      // If user doesn't have a personal scope yet, create one (lazy initialization)
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        // This shouldn't happen, but handle it gracefully
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      return reply.send({ data: personalScope });
    }
  );

  // =========================================================================
  // GET /me/projects - List personal projects
  // =========================================================================
  /**
   * GET /api/v1/me/projects
   * List all projects in the authenticated user's personal scope.
   * Supports cursor-based pagination.
   * Requires authentication.
   */
  fastify.get<{ Querystring: ListPersonalProjectsQuery }>(
    "/projects",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Get or create user's personal scope
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Parse pagination params
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? "20", 10)));
      const cursor = request.query.cursor;

      // Query epics in user's personal scope
      const epics = await prisma.epic.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor } } : {}),
        where: {
          personalScopeId: personalScope.id,
          isArchived: false,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: { _count: { select: { features: true } } },
      });

      const hasMore = epics.length > limit;
      if (hasMore) {
        epics.pop();
      }

      const lastEpic = epics.at(-1);
      const nextCursor = hasMore && lastEpic ? lastEpic.id : null;

      return reply.send({
        data: epics,
        meta: {
          cursor: nextCursor,
          hasMore,
        },
      });
    }
  );

  // =========================================================================
  // POST /me/projects - Create personal epic
  // =========================================================================
  /**
   * POST /api/v1/me/projects
   * Create a new epic in the authenticated user's personal scope.
   * Requires authentication.
   */
  fastify.post<{ Body: CreatePersonalProjectInput }>(
    "/projects",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Validate request body
      const parseResult = createPersonalProjectSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors[0]?.message ?? "Invalid request body"
        );
      }

      const { name, description, icon, color, sortOrder } = parseResult.data;

      // Get or create user's personal scope
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Auto-generate sortOrder if not provided
      let finalSortOrder = sortOrder;
      if (finalSortOrder === undefined) {
        const lastEpic = await prisma.epic.findFirst({
          where: { personalScopeId: personalScope.id, isArchived: false },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        finalSortOrder = generateSortOrderBetween(lastEpic?.sortOrder ?? null, null);
      }

      // Build data object
      const data: {
        name: string;
        personalScopeId: string;
        sortOrder: number;
        description?: string;
        icon?: string;
        color?: string;
      } = {
        name: name.trim(),
        personalScopeId: personalScope.id,
        sortOrder: finalSortOrder,
      };

      if (description !== undefined) {
        data.description = description.trim();
      }
      if (icon !== undefined) {
        data.icon = icon.trim();
      }
      if (color !== undefined) {
        data.color = color.trim();
      }

      const epic = await prisma.epic.create({ data });
      return reply.status(201).send({ data: epic });
    }
  );

  // =========================================================================
  // GET /me/statuses - List personal statuses
  // =========================================================================
  /**
   * GET /api/v1/me/statuses
   * List all statuses in the authenticated user's personal scope.
   * Requires authentication.
   */
  fastify.get(
    "/statuses",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Get or create user's personal scope
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Query statuses in user's personal scope
      const statuses = await prisma.status.findMany({
        where: { personalScopeId: personalScope.id },
        orderBy: { position: "asc" },
      });

      return reply.send({ data: statuses });
    }
  );

  // =========================================================================
  // POST /me/statuses - Create personal status
  // =========================================================================
  /**
   * POST /api/v1/me/statuses
   * Create a new status in the authenticated user's personal scope.
   * Requires authentication.
   */
  fastify.post<{ Body: CreatePersonalStatusInput }>(
    "/statuses",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;

      // Validate request body
      const parseResult = createPersonalStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors[0]?.message ?? "Invalid request body"
        );
      }

      const { name, category, color, position } = parseResult.data;

      // Get or create user's personal scope
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Check for duplicate status name in personal scope (case-insensitive)
      const existingStatuses = await prisma.status.findMany({
        where: {
          personalScopeId: personalScope.id,
        },
        select: { name: true },
      });

      const normalizedName = name.trim().toLowerCase();
      const duplicateName = existingStatuses.find(
        (s) => s.name.toLowerCase() === normalizedName
      );

      if (duplicateName) {
        throw new ConflictError(
          `A status with name '${name}' already exists in your personal scope`
        );
      }

      // Build data object
      const data: {
        name: string;
        personalScopeId: string;
        category: string;
        color?: string;
        position?: number;
      } = {
        name: name.trim(),
        personalScopeId: personalScope.id,
        category,
      };

      if (color !== undefined) {
        data.color = color.trim();
      }
      if (position !== undefined) {
        data.position = position;
      } else {
        // Auto-generate position if not provided
        const lastStatus = await prisma.status.findFirst({
          where: { personalScopeId: personalScope.id },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        data.position = (lastStatus?.position ?? -1) + 1;
      }

      const status = await prisma.status.create({ data });
      return reply.status(201).send({ data: status });
    }
  );

  // =========================================================================
  // POST /me/epic-requests - Create a personal epic request
  // =========================================================================
  /**
   * POST /api/v1/me/epic-requests
   * Create a new epic request in the authenticated user's personal scope.
   * The request is auto-approved (no admin review needed for personal requests).
   * Requires authentication.
   */
  fastify.post<{ Body: CreatePersonalEpicRequestInput }>(
    "/epic-requests",
    {
      preHandler: [authenticate],
      preValidation: [validateBody(createPersonalEpicRequestSchema)],
    },
    async (request, reply) => {
      const userId = request.user!.id;

      // Get or create user's personal scope (lazy initialization)
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Create the epic request with personalScopeId (triggers auto-approval)
      const epicRequest = await createEpicRequest(
        {
          title: request.body.title,
          description: request.body.description,
          structuredDesc: request.body.structuredDesc,
          personalScopeId: personalScope.id,
        },
        userId
      );

      return reply.status(201).send({ data: epicRequest });
    }
  );

  // =========================================================================
  // GET /me/epic-requests - List personal epic requests
  // =========================================================================
  /**
   * GET /api/v1/me/epic-requests
   * List all epic requests in the authenticated user's personal scope.
   * Supports cursor-based pagination and optional status filtering.
   * Requires authentication.
   */
  fastify.get<{ Querystring: ListPersonalEpicRequestsQuery }>(
    "/epic-requests",
    {
      preHandler: [authenticate],
      preValidation: [validateQuery(listEpicRequestsQuerySchema)],
    },
    async (request, reply) => {
      const userId = request.user!.id;

      // Get or create user's personal scope (lazy initialization)
      let personalScope = await getPersonalScope(userId);
      if (!personalScope) {
        await createPersonalScope(userId);
        personalScope = await getPersonalScope(userId);
      }

      if (!personalScope) {
        throw new NotFoundError("Unable to retrieve personal scope");
      }

      // Parse pagination params
      const limit = Math.min(100, Math.max(1, request.query.limit ? Number(request.query.limit) : 20));
      const cursor = request.query.cursor;

      // Build where clause for personal scope epic requests only
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: Record<string, any> = {
        personalScopeId: personalScope.id,
      };

      if (request.query.status) {
        whereClause.status = request.query.status;
      }

      // Query epic requests in user's personal scope
      const requests = await prisma.epicRequest.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      const hasMore = requests.length > limit;
      if (hasMore) {
        requests.pop();
      }

      const lastRequest = requests.at(-1);
      const nextCursor = hasMore && lastRequest ? lastRequest.id : null;

      return reply.send({
        data: requests,
        meta: {
          cursor: nextCursor,
          hasMore,
        },
      });
    }
  );

  // =========================================================================
  // GET /me/work - Get user's assigned work items
  // =========================================================================
  /**
   * GET /api/v1/me/work
   * Get all features and tasks assigned to the current user.
   * Prioritized by status (in-progress first) and execution order.
   * Requires authentication.
   */
  fastify.get(
    "/work",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const result = await getMyWork(userId);
      return reply.send({ data: result });
    }
  );

  // =========================================================================
  // GET /me/blocked - Get blocked items summary
  // =========================================================================
  /**
   * GET /api/v1/me/blocked
   * Get all blocked features and tasks across accessible epics.
   * Grouped by epic for easy navigation.
   * Requires authentication.
   */
  fastify.get(
    "/blocked",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const result = await getBlockedSummary(userId);
      return reply.send({ data: result });
    }
  );
}
