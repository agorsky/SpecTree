import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  createSkillPack,
  updateSkillPack,
  publishVersion,
  listSkillPacks,
  getSkillPack,
  getSkillPackWithVersions,
  getSkillPackVersion,
  installSkillPack,
  uninstallSkillPack,
  listInstalledSkillPacks,
  setSkillPackEnabled,
  getLatestVersion,
  bundleVersionFiles,
  type CreateSkillPackInput,
  type UpdateSkillPackInput,
  type PublishVersionInput,
  type InstallSkillPackInput,
} from "../services/skill-pack-registry.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireGlobalAdmin } from "../middleware/globalAdmin.js";
import { NotFoundError } from "../errors/index.js";

// Request type definitions
interface ListSkillPacksQuery {
  cursor?: string;
  limit?: string;
  isOfficial?: string;
  query?: string;
}

interface SkillPackIdParams {
  id: string;
}

interface VersionParams {
  id: string;
  version: string;
}

interface CreateSkillPackBody {
  name: string;
  displayName: string;
  description?: string;
  authorName?: string;
  authorUrl?: string;
  homepageUrl?: string;
  isOfficial?: boolean;
}

interface UpdateSkillPackBody {
  displayName?: string;
  description?: string;
  authorName?: string;
  authorUrl?: string;
  homepageUrl?: string;
  isOfficial?: boolean;
  isDeprecated?: boolean;
}

interface PublishVersionBody {
  version: string;
  manifest: {
    name: string;
    version: string;
    description?: string;
    agents?: Array<{
      name: string;
      path: string;
      description?: string;
    }>;
    skills?: Array<{
      name: string;
      path: string;
      description?: string;
    }>;
    instructions?: Array<{
      name: string;
      path: string;
      description?: string;
    }>;
    dependencies?: Record<string, string>;
  };
  releaseNotes?: string;
  isPrerelease?: boolean;
}

interface InstallSkillPackBody {
  version: string;
}

interface SetEnabledBody {
  isEnabled: boolean;
}

/**
 * Skill Packs routes plugin
 * Prefix: /api/v1/skill-packs
 */
export default function skillPacksRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  // Helper: resolve pack ID from params (handles both UUID and @scope/name)
  function resolvePackId(params: { id: string; name?: string }): string {
    if (params.name) {
      return `@${params.id}/${params.name}`;
    }
    return params.id;
  }

  // Scoped package params: /@:scope/:name → "@scope/name"
  interface ScopedParams {
    id: string;
    name: string;
  }

  interface ScopedVersionParams extends ScopedParams {
    version: string;
  }
  /**
   * GET /api/v1/skill-packs
   * List skill packs with cursor-based pagination
   * Optional query params: isOfficial, query (search)
   * Public route - no authentication required
   */
  fastify.get<{
    Querystring: ListSkillPacksQuery;
  }>(
    "/",
    {},
    async (request, reply) => {
      const { cursor, limit, isOfficial, query } = request.query;

      const result = await listSkillPacks({
        cursor,
        limit: limit ? parseInt(limit, 10) : undefined,
        isOfficial: isOfficial === "true" ? true : isOfficial === "false" ? false : undefined,
        query,
      });

      return reply.send({
        data: result.data,
        meta: result.meta,
      });
    }
  );

  /**
   * GET /api/v1/skill-packs/:id
   * Get a single skill pack by ID or name
   * Public route - no authentication required
   */
  fastify.get<{
    Params: SkillPackIdParams;
  }>(
    "/:id",
    {},
    async (request, reply) => {
      const { id } = request.params;

      const skillPack = await getSkillPack(id);

      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      return reply.send(skillPack);
    }
  );

  /**
   * GET /api/v1/skill-packs/:id/versions
   * Get a skill pack with all its versions
   * Public route - no authentication required
   */
  fastify.get<{
    Params: SkillPackIdParams;
  }>(
    "/:id/versions",
    {},
    async (request, reply) => {
      const { id } = request.params;

      const skillPack = await getSkillPackWithVersions(id);

      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      return reply.send(skillPack);
    }
  );

  /**
   * GET /api/v1/skill-packs/:id/versions/:version
   * Get a specific version of a skill pack
   * Public route - no authentication required
   */
  fastify.get<{
    Params: VersionParams;
  }>(
    "/:id/versions/:version",
    {},
    async (request, reply) => {
      const { id, version } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const packVersion = await getSkillPackVersion(skillPack.id, version);

      if (!packVersion) {
        throw new NotFoundError(`Version '${version}' not found for skill pack '${skillPack.name}'`);
      }

      return reply.send(packVersion);
    }
  );

  /**
   * GET /api/v1/skill-packs/:id/latest
   * Get the latest stable version of a skill pack
   * Public route - no authentication required
   */
  fastify.get<{
    Params: SkillPackIdParams;
  }>(
    "/:id/latest",
    {},
    async (request, reply) => {
      const { id } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const latestVersion = await getLatestVersion(skillPack.id);

      if (!latestVersion) {
        throw new NotFoundError(`No stable versions found for skill pack '${skillPack.name}'`);
      }

      return reply.send(latestVersion);
    }
  );

  /**
   * GET /api/v1/skill-packs/:id/download
   * Download the latest version of a skill pack as a tarball
   * Public route - no authentication required
   */
  fastify.get<{
    Params: SkillPackIdParams;
  }>(
    "/:id/download",
    {},
    async (request, reply) => {
      const { id } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const latestVersion = await getLatestVersion(skillPack.id);

      if (!latestVersion) {
        throw new NotFoundError(`No stable versions found for skill pack '${skillPack.name}'`);
      }

      // Bundle files into tarball
      const tarball = await bundleVersionFiles(skillPack.id, latestVersion.version);

      // Send as downloadable file
      return reply
        .header("Content-Type", "application/gzip")
        .header(
          "Content-Disposition",
          `attachment; filename="${skillPack.name.replace(/[@\/]/g, "-")}-${latestVersion.version}.tar.gz"`
        )
        .send(tarball);
    }
  );

  /**
   * GET /api/v1/skill-packs/:id/versions/:version/download
   * Download a specific version of a skill pack as a tarball
   * Public route - no authentication required
   */
  fastify.get<{
    Params: VersionParams;
  }>(
    "/:id/versions/:version/download",
    {},
    async (request, reply) => {
      const { id, version } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      // Verify version exists
      const packVersion = await getSkillPackVersion(skillPack.id, version);
      if (!packVersion) {
        throw new NotFoundError(`Version '${version}' not found for skill pack '${skillPack.name}'`);
      }

      // Bundle files into tarball
      const tarball = await bundleVersionFiles(skillPack.id, version);

      // Send as downloadable file
      return reply
        .header("Content-Type", "application/gzip")
        .header(
          "Content-Disposition",
          `attachment; filename="${skillPack.name.replace(/[@\/]/g, "-")}-${version}.tar.gz"`
        )
        .send(tarball);
    }
  );

  // ============================================================
  // Scoped package routes: /@:id/:name/...
  // Handles @scope/name format where / in name breaks /:id routes
  // ============================================================

  fastify.get<{ Params: ScopedParams }>(
    "/@:id/:name", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPack(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      return reply.send(skillPack);
    }
  );

  fastify.get<{ Params: ScopedParams }>(
    "/@:id/:name/versions", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPackWithVersions(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      return reply.send(skillPack);
    }
  );

  fastify.get<{ Params: ScopedVersionParams }>(
    "/@:id/:name/versions/:version", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPack(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      const packVersion = await getSkillPackVersion(skillPack.id, request.params.version);
      if (!packVersion) throw new NotFoundError(`Version '${request.params.version}' not found for '${packName}'`);
      return reply.send(packVersion);
    }
  );

  fastify.get<{ Params: ScopedParams }>(
    "/@:id/:name/latest", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPack(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      const latestVersion = await getLatestVersion(skillPack.id);
      if (!latestVersion) throw new NotFoundError(`No stable versions found for '${packName}'`);
      return reply.send(latestVersion);
    }
  );

  fastify.get<{ Params: ScopedParams }>(
    "/@:id/:name/download", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPack(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      const latestVersion = await getLatestVersion(skillPack.id);
      if (!latestVersion) throw new NotFoundError(`No stable versions found for '${packName}'`);
      const tarball = await bundleVersionFiles(skillPack.id, latestVersion.version);
      return reply
        .header("Content-Type", "application/gzip")
        .header("Content-Disposition", `attachment; filename="${skillPack.name.replace(/[@\/]/g, "-")}-${latestVersion.version}.tar.gz"`)
        .send(tarball);
    }
  );

  fastify.get<{ Params: ScopedVersionParams }>(
    "/@:id/:name/versions/:version/download", {},
    async (request, reply) => {
      const packName = resolvePackId(request.params);
      const skillPack = await getSkillPack(packName);
      if (!skillPack) throw new NotFoundError(`Skill pack '${packName}' not found`);
      const packVersion = await getSkillPackVersion(skillPack.id, request.params.version);
      if (!packVersion) throw new NotFoundError(`Version '${request.params.version}' not found for '${packName}'`);
      const tarball = await bundleVersionFiles(skillPack.id, request.params.version);
      return reply
        .header("Content-Type", "application/gzip")
        .header("Content-Disposition", `attachment; filename="${skillPack.name.replace(/[@\/]/g, "-")}-${request.params.version}.tar.gz"`)
        .send(tarball);
    }
  );

  /**
   * POST /api/v1/skill-packs
   * Create a new skill pack
   * Requires authentication and global admin role
   */
  fastify.post<{
    Body: CreateSkillPackBody;
  }>(
    "/",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const input: CreateSkillPackInput = request.body;

      const skillPack = await createSkillPack(input);

      return reply.code(201).send(skillPack);
    }
  );

  /**
   * PATCH /api/v1/skill-packs/:id
   * Update a skill pack
   * Requires authentication and global admin role
   */
  fastify.patch<{
    Params: SkillPackIdParams;
    Body: UpdateSkillPackBody;
  }>(
    "/:id",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const { id } = request.params;
      const input: UpdateSkillPackInput = request.body;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const updated = await updateSkillPack(skillPack.id, input);

      return reply.send(updated);
    }
  );

  /**
   * POST /api/v1/skill-packs/:id/versions
   * Publish a new version of a skill pack
   * Requires authentication and global admin role
   */
  fastify.post<{
    Params: SkillPackIdParams;
    Body: PublishVersionBody;
  }>(
    "/:id/versions",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const { id } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const input: PublishVersionInput = {
        skillPackId: skillPack.id,
        version: request.body.version,
        manifest: request.body.manifest,
        releaseNotes: request.body.releaseNotes,
        isPrerelease: request.body.isPrerelease,
      };

      const version = await publishVersion(input);

      return reply.code(201).send(version);
    }
  );

  /**
   * GET /api/v1/skill-packs/installed
   * List all installed skill packs
   * Public route - no authentication required
   */
  fastify.get(
    "/installed",
    {},
    async (_request, reply) => {
      const installations = await listInstalledSkillPacks();

      return reply.send({
        data: installations,
      });
    }
  );

  /**
   * POST /api/v1/skill-packs/:id/install
   * Install a skill pack
   * Requires authentication and global admin role
   */
  fastify.post<{
    Params: SkillPackIdParams;
    Body: InstallSkillPackBody;
  }>(
    "/:id/install",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { version } = request.body;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const input: InstallSkillPackInput = {
        skillPackId: skillPack.id,
        version,
      };

      const installation = await installSkillPack(input);

      return reply.code(201).send(installation);
    }
  );

  /**
   * DELETE /api/v1/skill-packs/:id/install
   * Uninstall a skill pack
   * Requires authentication and global admin role
   */
  fastify.delete<{
    Params: SkillPackIdParams;
  }>(
    "/:id/install",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const { id } = request.params;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      await uninstallSkillPack(skillPack.id);

      return reply.code(204).send();
    }
  );

  /**
   * PATCH /api/v1/skill-packs/:id/enabled
   * Enable or disable an installed skill pack
   * Requires authentication and global admin role
   */
  fastify.patch<{
    Params: SkillPackIdParams;
    Body: SetEnabledBody;
  }>(
    "/:id/enabled",
    {
      preHandler: [authenticate, requireGlobalAdmin],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { isEnabled } = request.body;

      // Get the skill pack first to resolve ID
      const skillPack = await getSkillPack(id);
      if (!skillPack) {
        throw new NotFoundError(`Skill pack with id or name '${id}' not found`);
      }

      const updated = await setSkillPackEnabled(skillPack.id, isEnabled);

      return reply.send(updated);
    }
  );
}
