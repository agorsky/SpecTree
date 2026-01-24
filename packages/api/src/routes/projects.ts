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
   * Requires authentication, team membership, and admin role
   */
  fastify.delete<{ Params: ProjectIdParams }>(
    "/:id",
    { preHandler: [authenticate, requireTeamAccess("id:projectId"), requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params;

      await deleteProject(id);
      return reply.status(204).send();
    }
  );
}
