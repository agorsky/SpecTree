/**
 * Shared TypeScript Types for Skill Pack Entities
 *
 * These types represent skill packs as they exist in the database and runtime,
 * separate from the manifest format. They include additional metadata like
 * installation status, version history, and usage tracking.
 */

import type { SkillPackManifest } from "./schema.js";

/**
 * SkillPack
 * Represents a skill pack registered in the system
 */
export interface SkillPack {
  /** Unique identifier for the skill pack */
  id: string;

  /** Pack name (from manifest) */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Description of the pack */
  description: string;

  /** Pack author or organization */
  author?: string;

  /** License identifier (e.g., 'MIT') */
  license?: string;

  /** URL to pack homepage */
  homepage?: string;

  /** URL to source repository */
  repository?: string;

  /** Keywords for discovery */
  keywords?: string[];

  /** Current version string (semantic versioning) */
  currentVersion: string;

  /** All available versions of this pack */
  versions: SkillPackVersion[];

  /** Whether this pack is published and available for installation */
  published: boolean;

  /** Whether this pack is official/verified */
  verified?: boolean;

  /** Number of times this pack has been installed */
  installCount?: number;

  /** Average rating (1-5) */
  rating?: number;

  /** Number of ratings */
  ratingCount?: number;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** User ID of the pack creator/owner */
  createdBy: string;
}

/**
 * SkillPackVersion
 * Represents a specific version of a skill pack
 */
export interface SkillPackVersion {
  /** Unique identifier for this version */
  id: string;

  /** Parent skill pack ID */
  skillPackId: string;

  /** Version string (semantic versioning) */
  version: string;

  /** Complete manifest for this version */
  manifest: SkillPackManifest;

  /** Changelog or release notes for this version */
  releaseNotes?: string;

  /** Whether this version is stable/production-ready */
  stable: boolean;

  /** Whether this version has been deprecated */
  deprecated: boolean;

  /** If deprecated, message explaining why */
  deprecationMessage?: string;

  /** Minimum SpecTree version required */
  minSpecTreeVersion?: string;

  /** Maximum SpecTree version supported */
  maxSpecTreeVersion?: string;

  /** SHA-256 hash of the manifest for integrity verification */
  manifestHash?: string;

  /** Download URL for this version's assets (if applicable) */
  downloadUrl?: string;

  /** Size in bytes of the pack assets */
  sizeBytes?: number;

  /** Timestamp when this version was published */
  publishedAt: string;

  /** User ID who published this version */
  publishedBy: string;
}

/**
 * InstalledSkillPack
 * Represents a skill pack installed in a user's workspace
 */
export interface InstalledSkillPack {
  /** Unique identifier for this installation */
  id: string;

  /** User ID who installed the pack */
  userId: string;

  /** Team ID if installed for a team (optional) */
  teamId?: string;

  /** Scope of installation: 'user' (personal) or 'team' */
  scope: "user" | "team";

  /** Reference to the skill pack */
  skillPackId: string;

  /** Reference to the installed version */
  versionId: string;

  /** The skill pack details */
  skillPack: SkillPack;

  /** The installed version details */
  version: SkillPackVersion;

  /** Whether this pack is currently enabled */
  enabled: boolean;

  /** User-defined configuration overrides */
  config?: Record<string, unknown>;

  /** Whether auto-updates are enabled for this installation */
  autoUpdate: boolean;

  /** Last time the pack was used */
  lastUsedAt?: string;

  /** Number of times this pack has been used */
  usageCount?: number;

  /** Installation timestamp */
  installedAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * SkillPackInstallation
 * Lightweight version for listing installed packs
 */
export interface SkillPackInstallation {
  /** Installation ID */
  id: string;

  /** Pack name */
  name: string;

  /** Display name */
  displayName: string;

  /** Installed version */
  version: string;

  /** Whether enabled */
  enabled: boolean;

  /** Installation scope */
  scope: "user" | "team";

  /** Installation date */
  installedAt: string;
}

/**
 * SkillPackSearchResult
 * Result from searching/browsing available skill packs
 */
export interface SkillPackSearchResult {
  /** Pack ID */
  id: string;

  /** Pack name */
  name: string;

  /** Display name */
  displayName: string;

  /** Description */
  description: string;

  /** Author */
  author?: string;

  /** Current version */
  currentVersion: string;

  /** Keywords */
  keywords?: string[];

  /** Whether official/verified */
  verified?: boolean;

  /** Install count */
  installCount?: number;

  /** Average rating */
  rating?: number;

  /** Whether user has this pack installed */
  installed?: boolean;

  /** If installed, the installed version */
  installedVersion?: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * SkillPackStats
 * Statistics about skill pack usage
 */
export interface SkillPackStats {
  /** Total number of packs available */
  totalPacks: number;

  /** Total number of installed packs (for user) */
  installedPacks: number;

  /** Total number of enabled packs */
  enabledPacks: number;

  /** Most popular packs */
  popularPacks: SkillPackSearchResult[];

  /** Recently updated packs */
  recentlyUpdated: SkillPackSearchResult[];

  /** User's recently used packs */
  recentlyUsed?: SkillPackInstallation[];
}
