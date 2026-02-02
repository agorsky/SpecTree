import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  createFromTemplate,
  saveAsTemplate,
  parseTemplateStructure,
  extractTemplateVariables,
} from "../services/templateService.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createFromTemplateSchema,
  saveAsTemplateSchema,
} from "../schemas/template.js";

// Request type definitions
interface TemplateIdParams {
  id: string;
}

interface PreviewBody {
  epicName: string;
  variables?: Record<string, string>;
}

interface CreateFromTemplateBody {
  epicName: string;
  teamId: string;
  variables?: Record<string, string>;
  epicDescription?: string;
  epicIcon?: string;
  epicColor?: string;
}

interface SaveAsTemplateBody {
  epicId: string;
  templateName: string;
  description?: string;
}

/**
 * Template routes plugin
 * Prefix: /api/v1/templates
 */
export default function templatesRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/templates
   * List all templates
   * Returns built-in templates first, then user templates
   * Requires authentication
   */
  fastify.get(
    "/",
    { preHandler: [authenticate] },
    async (_request, reply) => {
      const templates = await listTemplates();
      return reply.send({ data: templates });
    }
  );

  /**
   * GET /api/v1/templates/:id
   * Get a template by ID or name
   * Requires authentication
   */
  fastify.get<{ Params: TemplateIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const template = await getTemplate(request.params.id);
      if (!template) {
        return reply.status(404).send({
          error: "Not Found",
          message: `Template '${request.params.id}' not found`,
        });
      }

      // Parse structure and extract variables
      const structure = parseTemplateStructure(template.structure);
      const variables = extractTemplateVariables(structure);

      return reply.send({
        data: {
          ...template,
          structure,
          availableVariables: variables,
        },
      });
    }
  );

  /**
   * POST /api/v1/templates
   * Create a new user template
   * Requires authentication
   */
  fastify.post(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const validation = createTemplateSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      const template = await createTemplate({
        name: validation.data.name,
        description: validation.data.description,
        structure: validation.data.structure,
        createdById: request.user?.id,
      });

      return reply.status(201).send({ data: template });
    }
  );

  /**
   * PUT /api/v1/templates/:id
   * Update an existing user template (built-in templates cannot be modified)
   * Requires authentication
   */
  fastify.put<{ Params: TemplateIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const validation = updateTemplateSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      const template = await updateTemplate(request.params.id, validation.data);
      return reply.send({ data: template });
    }
  );

  /**
   * DELETE /api/v1/templates/:id
   * Delete a user template (built-in templates cannot be deleted)
   * Requires authentication
   */
  fastify.delete<{ Params: TemplateIdParams }>(
    "/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      await deleteTemplate(request.params.id);
      return reply.status(204).send();
    }
  );

  /**
   * POST /api/v1/templates/:id/preview
   * Preview what will be created from a template
   * Requires authentication
   */
  fastify.post<{ Params: TemplateIdParams; Body: PreviewBody }>(
    "/:id/preview",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { epicName, variables } = request.body;
      if (!epicName) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "epicName is required",
        });
      }

      const preview = await previewTemplate(
        request.params.id,
        epicName,
        variables ?? {}
      );

      return reply.send({ data: preview });
    }
  );

  /**
   * POST /api/v1/templates/:id/create
   * Create a full epic/feature/task structure from a template
   * Requires authentication
   */
  fastify.post<{ Params: TemplateIdParams; Body: CreateFromTemplateBody }>(
    "/:id/create",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = {
        templateName: request.params.id,
        ...request.body,
      };

      const validation = createFromTemplateSchema.safeParse(body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      const result = await createFromTemplate(validation.data);
      return reply.status(201).send({ data: result });
    }
  );

  /**
   * POST /api/v1/templates/save-from-epic
   * Save an existing epic as a new template
   * Requires authentication
   */
  fastify.post<{ Body: SaveAsTemplateBody }>(
    "/save-from-epic",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const validation = saveAsTemplateSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: validation.error.errors[0]?.message ?? "Invalid request body",
        });
      }

      const template = await saveAsTemplate(
        validation.data.epicId,
        validation.data.templateName,
        validation.data.description,
        request.user?.id
      );

      return reply.status(201).send({ data: template });
    }
  );
}
