import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../services/projectService.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireTeamAccess, requireRole } from "../middleware/authorize.js";
import { generateSortOrderBetween } from "../utils/ordering.js";
import { reorderProjectSchema } from "../schemas/project.js";

// Request type definitions
interface ListProjectsQuery {
  cursor?: string;
  limit?: string;
  teamId?: string;
}

interface ProjectIdParams {
  id: string;
}

interface CreateProjectBody {
  name: string;
  teamId: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

interface ReorderProjectBody {
  afterId?: string;
  beforeId?: string;
}

/**
 * Projects routes plugin
 * Prefix: /api/v1/projects
 */
export default async function projectsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * GET /api/v1/projects
   * List projects with cursor-based pagination
   * Optional teamId query param to filter by team
   * Requires authentication
   */
  fastify.get<{ Querystring: ListProjectsQuery }>(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const options: { cursor?: string; limit?: number; teamId?: string } = {};
      if (request.query.cursor) {
        options.cursor = request.query.cursor;
      }
      if (request.query.limit) {
        options.limit = parseInt(request.query.limit, 10);
      }
      if (request.query.teamId) {
        options.teamId = request.query.teamId;
      }

      const result = await listProjects(options);
      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/projects/:id
   * Get a single project by ID
   * Requires authentication and team membership (guest+)
   */
  fastify.get<{ Params: ProjectIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:projectId"), requireRole("guest")] },
    async (request, reply) => {
      const project = await getProjectById(request.params.id);
      if (!project) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Project with id '${request.params.id}' not found`,
        });
      }
      return reply.send({ data: project });
    }
  );

  /**
   * POST /api/v1/projects
   * Create a new project
   * Requires authentication, team membership, and member+ role
   */
  fastify.post<{ Body: CreateProjectBody }>(
    "/",
    { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("member")] },
    async (request, reply) => {
      const { name, teamId, description, icon, color, sortOrder } = request.body;

      const input: {
        name: string;
        teamId: string;
        description?: string;
        icon?: string;
        color?: string;
        sortOrder?: number;
      } = {
        name,
        teamId,
      };
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const project = await createProject(input);
      return reply.status(201).send({ data: project });
    }
  );

  /**
   * PUT /api/v1/projects/:id
   * Update an existing project
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: ProjectIdParams; Body: UpdateProjectBody }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:projectId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { name, description, icon, color, sortOrder } = request.body;

      const input: {
        name?: string;
        description?: string;
        icon?: string;
        color?: string;
        sortOrder?: number;
      } = {};
      if (name !== undefined) input.name = name;
      if (description !== undefined) input.description = description;
      if (icon !== undefined) input.icon = icon;
      if (color !== undefined) input.color = color;
      if (sortOrder !== undefined) input.sortOrder = sortOrder;

      const project = await updateProject(id, input);
      return reply.send({ data: project });
    }
  );

  /**
   * DELETE /api/v1/projects/:id
   * Soft delete a project (set isArchived = true)
   * Requires authentication, team membership, and member+ role
   */
  fastify.delete<{ Params: ProjectIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:projectId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteProject(id);
      return reply.status(204).send();
    }
  );

  /**
   * PUT /api/v1/projects/:id/reorder
   * Reorder a project within its team
   * Requires authentication, team membership, and member+ role
   */
  fastify.put<{ Params: ProjectIdParams; Body: ReorderProjectBody }>(
    "/:id/reorder",
    { preHandler: [authenticate, requireTeamAccess("id:projectId"), requireRole("member")] },
    async (request, reply) => {
      const { id } = request.params;
      const { afterId, beforeId } = request.body;

      // Validate request body using Zod schema
      const validation = reorderProjectSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      // Fetch the project being reordered
      const project = await getProjectById(id);
      if (!project) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Project with id '${id}' not found`,
        });
      }

      let beforeSortOrder: number | null = null;
      let afterSortOrder: number | null = null;

      // If afterId provided, fetch that project and use its sortOrder as "before"
      if (afterId) {
        const afterProject = await getProjectById(afterId);
        if (!afterProject) {
          return reply.status(404).send({
            error: "Not Found",
            message: `Project with id '${afterId}' not found`,
          });
        }
        // Validate that afterId project belongs to the same team
        if (afterProject.teamId !== project.teamId) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "afterId project must belong to the same team",
          });
        }
        beforeSortOrder = afterProject.sortOrder;
      }

      // If beforeId provided, fetch that project and use its sortOrder as "after"
      if (beforeId) {
        const beforeProject = await getProjectById(beforeId);
        if (!beforeProject) {
          return reply.status(404).send({
            error: "Not Found",
            message: `Project with id '${beforeId}' not found`,
          });
        }
        // Validate that beforeId project belongs to the same team
        if (beforeProject.teamId !== project.teamId) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "beforeId project must belong to the same team",
          });
        }
        afterSortOrder = beforeProject.sortOrder;
      }

      // Calculate new sortOrder using generateSortOrderBetween
      const newSortOrder = generateSortOrderBetween(beforeSortOrder, afterSortOrder);

      // Update the project's sortOrder
      const updatedProject = await updateProject(id, { sortOrder: newSortOrder });

      return reply.send({ data: updatedProject });
    }
  );
}
