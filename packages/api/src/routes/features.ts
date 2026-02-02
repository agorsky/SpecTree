import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
} from "../services/featureService.js";
import {
  getFeatureAiContext,
  setFeatureAiContext,
  appendFeatureAiNote,
} from "../services/aiContextService.js";
import {
  getFeatureStructuredDesc,
  setFeatureStructuredDesc,
  updateFeatureSection,
  addAcceptanceCriterion,
  linkFile,
  addExternalLink,
} from "../services/structuredDescriptionService.js";
import {
  getFeatureCodeContext,
  linkFeatureFile as linkFeatureCodeFile,
  unlinkFeatureFile as unlinkFeatureCodeFile,
  linkFeatureFunction,
  linkFeatureBranch,
  linkFeatureCommit,
  linkFeaturePr,
} from "../services/codeContextService.js";
import {
  startWork,
  completeWork,
  logProgress,
  reportBlocker,
} from "../services/progressService.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { reorderFeatureSchema, type ReorderFeatureInput } from "../schemas/feature.js";
import {
  appendAiNoteSchema,
  setAiContextSchema,
  type AppendAiNoteInput,
  type SetAiContextInput,
} from "../schemas/aiContext.js";
import {
  structuredDescriptionSchema,
  updateSectionSchema,
  addAcceptanceCriterionSchema,
  linkFileSchema,
  addExternalLinkSchema,
  type StructuredDescription,
  type UpdateSectionInput,
  type AddAcceptanceCriterionInput,
  type LinkFileInput,
  type AddExternalLinkInput,
} from "../schemas/structuredDescription.js";
import {
  linkCodeFileSchema,
  unlinkCodeFileSchema,
  linkFunctionSchema,
  linkBranchSchema,
  linkCommitSchema,
  linkPrSchema,
  type LinkCodeFileInput,
  type UnlinkCodeFileInput,
  type LinkFunctionInput,
  type LinkBranchInput,
  type LinkCommitInput,
  type LinkPrInput,
} from "../schemas/codeContext.js";
import {
  startWorkSchema,
  completeWorkSchema,
  logProgressSchema,
  reportBlockerSchema,
  type StartWorkInput,
  type CompleteWorkInput,
  type LogProgressInput,
  type ReportBlockerInput,
} from "../schemas/progress.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";

// Request type definitions
interface ListFeaturesQuery {
  cursor?: string;
  limit?: string;
  epicId?: string;
  statusId?: string;
  /** Status filter - can be ID or name (single or array via repeated param) */
  status?: string | string[];
  /** Filter by status category (backlog, unstarted, started, completed, canceled) */
  statusCategory?: string;
  assigneeId?: string;
  /** Assignee filter - supports "me", "none", email, or UUID */
  assignee?: string;
  query?: string;
  createdAt?: string;
  createdBefore?: string;
  updatedAt?: string;
  updatedBefore?: string;
}

interface FeatureIdParams {
  id: string;
}

interface CreateFeatureBody {
  title: string;
  epicId: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

interface UpdateFeatureBody {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  sortOrder?: number;
}

interface BulkUpdateBody {
  ids: string[];
  statusId: string;
}

/**
 * Features routes plugin
 * Prefix: /api/v1/features
 */
export default function featuresRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/features
   * List features with cursor-based pagination
   * Optional query params: epicId, statusId, assigneeId
   * Includes _count: { tasks } in response
   * Requires authentication
   */
  fastify.get<{ Querystring: ListFeaturesQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: {
        cursor?: string;
        limit?: number;
        epicId?: string;
        statusId?: string;
        status?: string | string[];
        statusCategory?: string;
        assigneeId?: string;
        assignee?: string;
        currentUserId?: string;
        query?: string;
        createdAt?: string;
        createdBefore?: string;
        updatedAt?: string;
        updatedBefore?: string;
      } = {};

      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.epicId) {
        options.epicId = request.query.epicId;
      }
      // Enhanced status filtering (supports name, ID, array, category)
      if (request.query.status) {
        options.status = request.query.status;
      } else if (request.query.statusCategory) {
        options.statusCategory = request.query.statusCategory;
      } else if (request.query.statusId) {
        // Legacy support for direct statusId
        options.statusId = request.query.statusId;
      }
      // Enhanced assignee filtering
      if (request.query.assignee) {
        options.assignee = request.query.assignee;
        if (request.user?.id) {
          options.currentUserId = request.user.id;
        }
      } else if (request.query.assigneeId) {
        // Legacy support for direct assigneeId
        options.assigneeId = request.query.assigneeId;
      }
      if (request.query.query) {
        options.query = request.query.query;
      }
      if (request.query.createdAt) {
        options.createdAt = request.query.createdAt;
      }
      if (request.query.createdBefore) {
        options.createdBefore = request.query.createdBefore;
      }
      if (request.query.updatedAt) {
        options.updatedAt = request.query.updatedAt;
      }
      if (request.query.updatedBefore) {
        options.updatedBefore = request.query.updatedBefore;
      }

      const result = await listFeatures(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/features/:id
   * Get a single feature by ID with nested tasks array
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("guest")] },
    async (request, reply) => {
      const feature = await getFeatureById(request.params.id);
      if (!feature) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Feature with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: feature });
    }
  );

  /**
   * POST /api/v1/features
   * Create a new feature (auto-generates identifier in format TEAM_KEY-NUMBER)
   * Requires authentication, team membership (via epicId), and member+ role
   */
  fastify.post<{ Body: CreateFeatureBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("epicId"), requireRole("member")] },
    async (request, reply) => {
      const { title, epicId, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title: string;
        epicId: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {
        title,
        epicId,
      };

      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const feature = await createFeature(input);
      return reply.status(201).send({ data: feature });
    }
  );

  /**
   * PUT /api/v1/features/:id
   * Update an existing feature
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: FeatureIdParams; Body: UpdateFeatureBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { title, description, statusId, assigneeId, sortOrder } =
        request.body;

      const input: {
        title?: string;
        description?: string;
        statusId?: string;
        assigneeId?: string;
        sortOrder?: number;
      } = {};

      if (title !== undefined) input.title = title;
      if (description !== undefined) input.description = description;
      if (statusId !== undefined) input.statusId = statusId;
      if (assigneeId !== undefined) input.assigneeId = assigneeId;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const feature = await updateFeature(id, input);
      return reply.send({ data: feature });
    }
  );

  /**
   * PUT /api/v1/features/:id/reorder
   * Reorder a feature within its epic
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: FeatureIdParams; Body: ReorderFeatureInput }>(
    "/:id/reorder",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(reorderFeatureSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Fetch the feature being reordered
      const feature = await prisma.feature.findUnique({
        where: { id },
        select: { id: true, epicId: true },
      });

      if (!feature) {
        throw new NotFoundError(`Feature with id '${id}' not found`);
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, the new position is after that feature
      // So "afterId" feature's sortOrder becomes our "before" value
      if (afterId) {
        const afterFeature = await prisma.feature.findUnique({
          where: { id: afterId },
          select: { id: true, epicId: true, sortOrder: true },
        });

        if (!afterFeature) {
          throw new NotFoundError(`Feature with id '${afterId}' not found`);
        }

        if (afterFeature.epicId !== feature.epicId) {
          throw new ValidationError("Cannot reorder: afterId feature belongs to a different epic");
        }

        beforeSortOrder = afterFeature.sortOrder;
      }

      // If beforeId provided, the new position is before that feature
      // So "beforeId" feature's sortOrder becomes our "after" value
      if (beforeId) {
        const beforeFeature = await prisma.feature.findUnique({
          where: { id: beforeId },
          select: { id: true, epicId: true, sortOrder: true },
        });

        if (!beforeFeature) {
          throw new NotFoundError(`Feature with id '${beforeId}' not found`);
        }

        if (beforeFeature.epicId !== feature.epicId) {
          throw new ValidationError("Cannot reorder: beforeId feature belongs to a different epic");
        }

        afterSortOrder = beforeFeature.sortOrder;
      }

      // Calculate the new sortOrder
      const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the feature's sortOrder
      const updatedFeature = await prisma.feature.update({
        where: { id },
        data: { sortOrder: newSortOrder },
      });

      return reply.send({ data: updatedFeature });
    }
  );

  /**
   * PUT /api/v1/features/bulk-update
   * Update status for multiple features at once
   * Requires authentication
   */
  fastify.put<{ Body: BulkUpdateBody }>(
    "/bulk-update",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { ids, statusId } = request.body;

      // Validate inputs
      if (ids.length === 0) {
        throw new ValidationError("ids array is required and cannot be empty");
      }
      if (!statusId) {
        throw new ValidationError("statusId is required");
      }

      // Verify status exists
      const status = await prisma.status.findUnique({
        where: { id: statusId },
        select: { id: true, teamId: true },
      });
      if (!status) {
        throw new NotFoundError(`Status with id '${statusId}' not found`);
      }

      // Verify all features exist and belong to epics in the status's team
      const features = await prisma.feature.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          epic: {
            select: { teamId: true },
          },
        },
      });

      if (features.length !== ids.length) {
        const foundIds = features.map((f) => f.id);
        const missingIds = ids.filter((id) => !foundIds.includes(id));
        throw new NotFoundError(
          `Features not found: ${missingIds.join(", ")}`
        );
      }

      // Verify all features belong to the same team as the status
      const invalidFeatures = features.filter(
        (f) => f.epic.teamId !== status.teamId
      );
      if (invalidFeatures.length > 0) {
        throw new ValidationError(
          `Some features do not belong to the same team as the status`
        );
      }

      // Update in transaction
      const result = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.feature.updateMany({
          where: { id: { in: ids } },
          data: { statusId },
        });
        return updateResult.count;
      });

      return reply.send({ updated: result });
    }
  );

  /**
   * DELETE /api/v1/features/:id
   * Delete a feature (hard delete, cascade will remove tasks)
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: FeatureIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteFeature(id);
      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // AI Context Endpoints
  // ===========================================================================

  /**
   * GET /api/v1/features/:id/ai-context
   * Get AI context for a feature
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/:id/ai-context",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("guest")] },
    async (request, reply) => {
      const { id } = request.params;
      const context = await getFeatureAiContext(id);
      return reply.send({ data: context });
    }
  );

  /**
   * PUT /api/v1/features/:id/ai-context
   * Set AI context for a feature (replaces entire context)
   * Requires authentication and team membership (member+)
   */
  fastify.put<{ Params: FeatureIdParams; Body: SetAiContextInput }>(
    "/:id/ai-context",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(setAiContextSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { context, sessionId } = request.body;
      const result = await setFeatureAiContext(id, { context, sessionId });
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/ai-note
   * Append an AI note to a feature (non-destructive)
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: AppendAiNoteInput }>(
    "/:id/ai-note",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(appendAiNoteSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { type, content, sessionId } = request.body;
      const result = await appendFeatureAiNote(id, { type, content, sessionId });
      return reply.status(201).send({ data: result });
    }
  );

  // ===========================================================================
  // Progress Tracking Routes
  // ===========================================================================

  /**
   * POST /api/v1/features/:id/progress/start
   * Start work on a feature - sets status to "In Progress" and records start time
   */
  fastify.post<{ Params: FeatureIdParams; Body: StartWorkInput }>(
    "/:id/progress/start",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(startWorkSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await startWork("feature", id, request.body);
      return reply.send({
        data: {
          ...result,
          startedAt: result.startedAt.toISOString(),
        },
      });
    }
  );

  /**
   * POST /api/v1/features/:id/progress/complete
   * Complete work on a feature - sets status to "Done" and records completion time
   */
  fastify.post<{ Params: FeatureIdParams; Body: CompleteWorkInput }>(
    "/:id/progress/complete",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(completeWorkSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await completeWork("feature", id, request.body);
      return reply.send({
        data: {
          ...result,
          startedAt: result.startedAt?.toISOString() ?? null,
          completedAt: result.completedAt.toISOString(),
        },
      });
    }
  );

  /**
   * POST /api/v1/features/:id/progress/log
   * Log progress on a feature without changing status
   */
  fastify.post<{ Params: FeatureIdParams; Body: LogProgressInput }>(
    "/:id/progress/log",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(logProgressSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await logProgress("feature", id, request.body);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/progress/blocker
   * Report a blocker on a feature
   */
  fastify.post<{ Params: FeatureIdParams; Body: ReportBlockerInput }>(
    "/:id/progress/blocker",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(reportBlockerSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await reportBlocker("feature", id, request.body);
      return reply.send({ data: result });
    }
  );

  // ===========================================================================
  // Structured Description Routes
  // ===========================================================================

  /**
   * GET /api/v1/features/:id/structured-desc
   * Get structured description for a feature
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/:id/structured-desc",
    { preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("guest")] },
    async (request, reply) => {
      const { id } = request.params;
      const result = await getFeatureStructuredDesc(id);
      return reply.send({ data: result });
    }
  );

  /**
   * PUT /api/v1/features/:id/structured-desc
   * Set structured description for a feature (replaces entire object)
   * Requires authentication and team membership (member+)
   */
  fastify.put<{ Params: FeatureIdParams; Body: StructuredDescription }>(
    "/:id/structured-desc",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(structuredDescriptionSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await setFeatureStructuredDesc(id, request.body);
      return reply.send({ data: result });
    }
  );

  /**
   * PATCH /api/v1/features/:id/structured-desc/section
   * Update a specific section of the structured description
   * Requires authentication and team membership (member+)
   */
  fastify.patch<{ Params: FeatureIdParams; Body: UpdateSectionInput }>(
    "/:id/structured-desc/section",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(updateSectionSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { section, value } = request.body;
      const result = await updateFeatureSection(id, section, value);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/structured-desc/acceptance-criteria
   * Add an acceptance criterion to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: AddAcceptanceCriterionInput }>(
    "/:id/structured-desc/acceptance-criteria",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(addAcceptanceCriterionSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { criterion } = request.body;
      const result = await addAcceptanceCriterion("feature", id, criterion);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/structured-desc/files
   * Link a file to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkFileInput }>(
    "/:id/structured-desc/files",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkFileSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { filePath } = request.body;
      const result = await linkFile("feature", id, filePath);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/structured-desc/links
   * Add an external link to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: AddExternalLinkInput }>(
    "/:id/structured-desc/links",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(addExternalLinkSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { url, title } = request.body;
      const result = await addExternalLink("feature", id, { url, title });
      return reply.status(201).send({ data: result });
    }
  );

  // ===========================================================================
  // Code Context Routes
  // ===========================================================================

  /**
   * GET /api/v1/features/:id/code-context
   * Get code context (files, functions, git info) for a feature
   * Requires authentication and team membership
   */
  fastify.get<{ Params: FeatureIdParams }>(
    "/:id/code-context",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId")],
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = await getFeatureCodeContext(id);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/code-context/files
   * Link a file to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkCodeFileInput }>(
    "/:id/code-context/files",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkCodeFileSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { filePath } = request.body;
      const result = await linkFeatureCodeFile(id, filePath);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * DELETE /api/v1/features/:id/code-context/files
   * Unlink a file from a feature
   * Requires authentication and team membership (member+)
   */
  fastify.delete<{ Params: FeatureIdParams; Body: UnlinkCodeFileInput }>(
    "/:id/code-context/files",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(unlinkCodeFileSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { filePath } = request.body;
      const result = await unlinkFeatureCodeFile(id, filePath);
      return reply.send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/code-context/functions
   * Link a function to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkFunctionInput }>(
    "/:id/code-context/functions",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkFunctionSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { filePath, functionName } = request.body;
      const result = await linkFeatureFunction(id, filePath, functionName);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/code-context/branch
   * Link a git branch to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkBranchInput }>(
    "/:id/code-context/branch",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkBranchSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { branchName } = request.body;
      const result = await linkFeatureBranch(id, branchName);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/code-context/commits
   * Link a commit to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkCommitInput }>(
    "/:id/code-context/commits",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkCommitSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { commitSha } = request.body;
      const result = await linkFeatureCommit(id, commitSha);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/features/:id/code-context/pr
   * Link a pull request to a feature
   * Requires authentication and team membership (member+)
   */
  fastify.post<{ Params: FeatureIdParams; Body: LinkPrInput }>(
    "/:id/code-context/pr",
    {
      preHandler: [authenticate, requireTeamAccess("id:featureId"), requireRole("member")],
      preValidation: [validateBody(linkPrSchema)],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { prNumber, prUrl } = request.body;
      const result = await linkFeaturePr(id, prNumber, prUrl);
      return reply.status(201).send({ data: result });
    }
  );
}
