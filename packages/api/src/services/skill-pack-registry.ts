import { prisma } from "../lib/db.js";
import type { SkillPack, SkillPackVersion, InstalledSkillPack } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import semver from "semver";

// Types for skill pack operations
export interface CreateSkillPackInput {
  name: string; // e.g., "@spectree/planning"
  displayName: string;
  description?: string | undefined;
  authorName?: string | undefined;
  authorUrl?: string | undefined;
  homepageUrl?: string | undefined;
  isOfficial?: boolean | undefined;
}

export interface UpdateSkillPackInput {
  displayName?: string | undefined;
  description?: string | undefined;
  authorName?: string | undefined;
  authorUrl?: string | undefined;
  homepageUrl?: string | undefined;
  isOfficial?: boolean | undefined;
  isDeprecated?: boolean | undefined;
}

export interface PublishVersionInput {
  skillPackId: string;
  version: string; // Semver string, e.g., "1.2.3"
  manifest: SkillPackManifest;
  releaseNotes?: string | undefined;
  isPrerelease?: boolean | undefined;
}

export interface SkillPackManifest {
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
  dependencies?: Record<string, string>; // Package name -> version range
}

export interface InstallSkillPackInput {
  skillPackId: string;
  version: string; // Specific version to install
}

export interface ListSkillPacksOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
  isOfficial?: boolean | undefined;
  query?: string | undefined; // Search in name or displayName
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Create a new skill pack in the registry
 */
export async function createSkillPack(
  input: CreateSkillPackInput
): Promise<SkillPack> {
  // Validate name format (e.g., @scope/name or name)
  if (!/^(@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(input.name)) {
    throw new ValidationError(
      "Invalid skill pack name. Must be alphanumeric with hyphens, optionally scoped (e.g., '@spectree/planning')"
    );
  }

  // Check if name already exists
  const existing = await prisma.skillPack.findUnique({
    where: { name: input.name },
  });

  if (existing) {
    throw new ValidationError(`Skill pack with name '${input.name}' already exists`);
  }

  const skillPack = await prisma.skillPack.create({
    data: {
      name: input.name,
      displayName: input.displayName,
      description: input.description ?? null,
      authorName: input.authorName ?? null,
      authorUrl: input.authorUrl ?? null,
      homepageUrl: input.homepageUrl ?? null,
      isOfficial: input.isOfficial ?? false,
    },
  });

  return skillPack;
}

/**
 * Update an existing skill pack
 */
export async function updateSkillPack(
  id: string,
  input: UpdateSkillPackInput
): Promise<SkillPack> {
  const existing = await prisma.skillPack.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Skill pack with id '${id}' not found`);
  }

  const updateData: Record<string, unknown> = {};
  
  if (input.displayName !== undefined) {
    updateData.displayName = input.displayName;
  }
  if (input.description !== undefined) {
    updateData.description = input.description ?? null;
  }
  if (input.authorName !== undefined) {
    updateData.authorName = input.authorName ?? null;
  }
  if (input.authorUrl !== undefined) {
    updateData.authorUrl = input.authorUrl ?? null;
  }
  if (input.homepageUrl !== undefined) {
    updateData.homepageUrl = input.homepageUrl ?? null;
  }
  if (input.isOfficial !== undefined) {
    updateData.isOfficial = input.isOfficial;
  }
  if (input.isDeprecated !== undefined) {
    updateData.isDeprecated = input.isDeprecated;
  }

  const skillPack = await prisma.skillPack.update({
    where: { id },
    data: updateData,
  });

  return skillPack;
}

/**
 * Publish a new version of a skill pack
 */
export async function publishVersion(
  input: PublishVersionInput
): Promise<SkillPackVersion> {
  // Validate semver format
  if (!semver.valid(input.version)) {
    throw new ValidationError(`Invalid semver version: '${input.version}'`);
  }

  // Check if skill pack exists
  const skillPack = await prisma.skillPack.findUnique({
    where: { id: input.skillPackId },
    include: { versions: true },
  });

  if (!skillPack) {
    throw new NotFoundError(`Skill pack with id '${input.skillPackId}' not found`);
  }

  // Check if this version already exists
  const existingVersion = skillPack.versions.find(
    (v) => v.version === input.version
  );

  if (existingVersion) {
    throw new ValidationError(
      `Version '${input.version}' already exists for skill pack '${skillPack.name}'`
    );
  }

  // Validate manifest
  if (input.manifest.name !== skillPack.name) {
    throw new ValidationError(
      `Manifest name '${input.manifest.name}' does not match skill pack name '${skillPack.name}'`
    );
  }

  if (input.manifest.version !== input.version) {
    throw new ValidationError(
      `Manifest version '${input.manifest.version}' does not match publish version '${input.version}'`
    );
  }

  // Create version and update latestVersion
  const version = await prisma.skillPackVersion.create({
    data: {
      skillPackId: input.skillPackId,
      version: input.version,
      manifest: JSON.stringify(input.manifest),
      releaseNotes: input.releaseNotes ?? null,
      isPrerelease: input.isPrerelease ?? false,
    },
  });

  // Update latestVersion if this is not a prerelease and is newer
  if (!input.isPrerelease) {
    const shouldUpdateLatest =
      !skillPack.latestVersion ||
      semver.gt(input.version, skillPack.latestVersion);

    if (shouldUpdateLatest) {
      await prisma.skillPack.update({
        where: { id: input.skillPackId },
        data: { latestVersion: input.version },
      });
    }
  }

  return version;
}

/**
 * List skill packs with pagination and filtering
 */
export async function listSkillPacks(
  options: ListSkillPacksOptions = {}
): Promise<PaginatedResult<SkillPack>> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));

  const whereClause: {
    isOfficial?: boolean;
    OR?: Array<{ name: { contains: string } } | { displayName: { contains: string } }>;
  } = {};

  if (options.isOfficial !== undefined) {
    whereClause.isOfficial = options.isOfficial;
  }

  if (options.query) {
    whereClause.OR = [
      { name: { contains: options.query } },
      { displayName: { contains: options.query } },
    ];
  }

  const cursorClause = options.cursor ? { id: options.cursor } : undefined;

  const skillPacks = await prisma.skillPack.findMany({
    where: whereClause,
    take: limit + 1,
    ...(cursorClause ? { skip: 1, cursor: cursorClause } : {}),
    orderBy: [
      { isOfficial: "desc" }, // Official packs first
      { name: "asc" },
    ],
  });

  const hasMore = skillPacks.length > limit;
  const data = hasMore ? skillPacks.slice(0, limit) : skillPacks;
  const cursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return {
    data,
    meta: { cursor, hasMore },
  };
}

/**
 * Get a single skill pack by ID or name
 */
export async function getSkillPack(
  idOrName: string
): Promise<SkillPack | null> {
  // Try by ID first
  let skillPack = await prisma.skillPack.findUnique({
    where: { id: idOrName },
  });

  // If not found, try by name
  if (!skillPack) {
    skillPack = await prisma.skillPack.findUnique({
      where: { name: idOrName },
    });
  }

  return skillPack;
}

/**
 * Get a skill pack with all versions
 */
export async function getSkillPackWithVersions(
  idOrName: string
): Promise<(SkillPack & { versions: SkillPackVersion[] }) | null> {
  // Try by ID first
  let skillPack = await prisma.skillPack.findUnique({
    where: { id: idOrName },
    include: {
      versions: {
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  // If not found, try by name
  if (!skillPack) {
    skillPack = await prisma.skillPack.findUnique({
      where: { name: idOrName },
      include: {
        versions: {
          orderBy: { publishedAt: "desc" },
        },
      },
    });
  }

  return skillPack;
}

/**
 * Get a specific version of a skill pack
 */
export async function getSkillPackVersion(
  skillPackId: string,
  version: string
): Promise<SkillPackVersion | null> {
  const packVersion = await prisma.skillPackVersion.findFirst({
    where: {
      skillPackId,
      version,
    },
  });

  return packVersion;
}

/**
 * Install a skill pack
 */
export async function installSkillPack(
  input: InstallSkillPackInput
): Promise<InstalledSkillPack> {
  // Validate that the version exists
  const version = await getSkillPackVersion(input.skillPackId, input.version);

  if (!version) {
    throw new NotFoundError(
      `Version '${input.version}' not found for skill pack with id '${input.skillPackId}'`
    );
  }

  // Check if already installed
  const existing = await prisma.installedSkillPack.findUnique({
    where: { skillPackId: input.skillPackId },
  });

  if (existing) {
    // Update to new version
    return await prisma.installedSkillPack.update({
      where: { skillPackId: input.skillPackId },
      data: {
        installedVersion: input.version,
        lastUpdatedAt: new Date(),
      },
    });
  }

  // Create new installation
  const installation = await prisma.installedSkillPack.create({
    data: {
      skillPackId: input.skillPackId,
      installedVersion: input.version,
    },
  });

  return installation;
}

/**
 * Uninstall a skill pack
 */
export async function uninstallSkillPack(skillPackId: string): Promise<void> {
  const existing = await prisma.installedSkillPack.findUnique({
    where: { skillPackId },
  });

  if (!existing) {
    throw new NotFoundError(`Skill pack with id '${skillPackId}' is not installed`);
  }

  await prisma.installedSkillPack.delete({
    where: { skillPackId },
  });
}

/**
 * List all installed skill packs
 */
export async function listInstalledSkillPacks(): Promise<
  Array<InstalledSkillPack & { skillPack: SkillPack }>
> {
  const installations = await prisma.installedSkillPack.findMany({
    include: {
      skillPack: true,
    },
    orderBy: {
      installedAt: "desc",
    },
  });

  return installations;
}

/**
 * Enable or disable an installed skill pack
 */
export async function setSkillPackEnabled(
  skillPackId: string,
  isEnabled: boolean
): Promise<InstalledSkillPack> {
  const existing = await prisma.installedSkillPack.findUnique({
    where: { skillPackId },
  });

  if (!existing) {
    throw new NotFoundError(`Skill pack with id '${skillPackId}' is not installed`);
  }

  return await prisma.installedSkillPack.update({
    where: { skillPackId },
    data: { isEnabled },
  });
}

/**
 * Get the latest stable version of a skill pack
 */
export async function getLatestVersion(
  skillPackId: string
): Promise<SkillPackVersion | null> {
  const skillPack = await prisma.skillPack.findUnique({
    where: { id: skillPackId },
    include: {
      versions: {
        where: { isPrerelease: false },
        orderBy: { publishedAt: "desc" },
      },
    },
  });

  if (!skillPack || skillPack.versions.length === 0) {
    return null;
  }

  // Sort versions by semver to find the latest
  const sortedVersions = skillPack.versions.sort((a, b) => {
    return semver.compare(b.version, a.version);
  });

  return sortedVersions[0] ?? null;
}

/**
 * Store file contents for a skill pack version
 */
export async function storeVersionFile(
  versionId: string,
  path: string,
  content: string,
  mimeType?: string
): Promise<void> {
  await prisma.skillPackFile.upsert({
    where: {
      versionId_path: {
        versionId,
        path,
      },
    },
    create: {
      versionId,
      path,
      content,
      mimeType: mimeType ?? null,
    },
    update: {
      content,
      mimeType: mimeType ?? null,
    },
  });
}

/**
 * Get all files for a skill pack version
 */
export async function getVersionFiles(versionId: string) {
  const files = await prisma.skillPackFile.findMany({
    where: { versionId },
    select: {
      path: true,
      content: true,
      mimeType: true,
    },
  });

  return files;
}

/**
 * Bundle skill pack version files into a tarball
 * Returns a Buffer containing the tar.gz archive
 */
export async function bundleVersionFiles(
  skillPackId: string,
  version: string
): Promise<Buffer> {
  // Get the version
  const packVersion = await getSkillPackVersion(skillPackId, version);
  if (!packVersion) {
    throw new NotFoundError(
      `Version '${version}' not found for skill pack with id '${skillPackId}'`
    );
  }

  // Get all files for this version
  const files = await getVersionFiles(packVersion.id);

  if (files.length === 0) {
    throw new NotFoundError(
      `No files found for version '${version}' of skill pack with id '${skillPackId}'`
    );
  }

  // Create tarball using tar library
  const tar = await import("tar");
  const fs = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");

  // Create a temporary directory for the files
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "spectree-pack-"));

  try {
    // Write all files to temp directory
    for (const file of files) {
      const filePath = path.join(tmpDir, file.path);
      const fileDir = path.dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(fileDir, { recursive: true });

      // Write file content
      await fs.writeFile(filePath, file.content, "utf-8");
    }

    // Create tar.gz archive
    const tarballPath = path.join(tmpDir, "pack.tar.gz");
    await tar.create(
      {
        gzip: true,
        portable: true,
        file: tarballPath,
        cwd: tmpDir,
      },
      files.map((f) => f.path)
    );

    // Read the tarball into a buffer
    const buffer = await fs.readFile(tarballPath);

    // Clean up temp directory
    await fs.rm(tmpDir, { recursive: true, force: true });

    return buffer;
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
