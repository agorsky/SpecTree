/**
 * Manifest Parsing and Validation Utilities
 *
 * Provides utilities for loading, parsing, and validating skill pack manifests
 * from various sources (files, JSON strings, objects) with comprehensive error handling.
 */

import { readFile } from "fs/promises";
import { ZodError } from "zod";
import {
  validateSkillPackManifest,
  safeValidateSkillPackManifest,
  type SkillPackManifest,
} from "./schema.js";

/**
 * Error thrown when manifest parsing fails
 */
export class ManifestParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly validationErrors?: string[]
  ) {
    super(message);
    this.name = "ManifestParseError";
  }
}

/**
 * Error thrown when manifest validation fails
 */
export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

/**
 * Result type for parse operations
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: string[] };

/**
 * Parse a manifest from a JSON string
 *
 * @param jsonString - JSON string to parse
 * @returns Validated manifest object
 * @throws {ManifestParseError} If JSON parsing fails
 * @throws {ManifestValidationError} If validation fails
 */
export function parseManifest(jsonString: string): SkillPackManifest {
  let parsed: unknown;

  // Step 1: Parse JSON
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new ManifestParseError(
      "Failed to parse manifest JSON",
      err,
      [err instanceof Error ? err.message : "Invalid JSON"]
    );
  }

  // Step 2: Validate schema
  try {
    return validateSkillPackManifest(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      const validationErrors = err.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      throw new ManifestValidationError(
        "Manifest validation failed",
        validationErrors
      );
    }
    throw new ManifestParseError("Manifest validation failed", err);
  }
}

/**
 * Safely parse a manifest without throwing
 *
 * @param jsonString - JSON string to parse
 * @returns Parse result with success/error
 */
export function safeParseManifest(
  jsonString: string
): ParseResult<SkillPackManifest> {
  try {
    const manifest = parseManifest(jsonString);
    return { success: true, data: manifest };
  } catch (err) {
    if (err instanceof ManifestValidationError) {
      return {
        success: false,
        error: err.message,
        details: err.validationErrors,
      };
    }
    if (err instanceof ManifestParseError) {
      const result: ParseResult<SkillPackManifest> = {
        success: false,
        error: err.message,
      };
      if (err.validationErrors) {
        result.details = err.validationErrors;
      }
      return result;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Load and parse a manifest from a file
 *
 * @param filePath - Path to the manifest JSON file
 * @returns Validated manifest object
 * @throws {ManifestParseError} If file reading or JSON parsing fails
 * @throws {ManifestValidationError} If validation fails
 */
export async function loadManifestFromFile(
  filePath: string
): Promise<SkillPackManifest> {
  let content: string;

  // Step 1: Read file
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    throw new ManifestParseError(
      `Failed to read manifest file: ${filePath}`,
      err,
      [err instanceof Error ? err.message : "File read error"]
    );
  }

  // Step 2: Parse and validate
  try {
    return parseManifest(content);
  } catch (err) {
    if (err instanceof ManifestParseError || err instanceof ManifestValidationError) {
      throw err;
    }
    throw new ManifestParseError("Failed to parse manifest", err);
  }
}

/**
 * Safely load and parse a manifest from a file without throwing
 *
 * @param filePath - Path to the manifest JSON file
 * @returns Parse result with success/error
 */
export async function safeLoadManifestFromFile(
  filePath: string
): Promise<ParseResult<SkillPackManifest>> {
  try {
    const manifest = await loadManifestFromFile(filePath);
    return { success: true, data: manifest };
  } catch (err) {
    if (err instanceof ManifestValidationError) {
      return {
        success: false,
        error: err.message,
        details: err.validationErrors,
      };
    }
    if (err instanceof ManifestParseError) {
      const result: ParseResult<SkillPackManifest> = {
        success: false,
        error: err.message,
      };
      if (err.validationErrors) {
        result.details = err.validationErrors;
      }
      return result;
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Validate a manifest object (already parsed)
 *
 * @param data - The manifest object to validate
 * @returns Validated manifest object
 * @throws {ManifestValidationError} If validation fails
 */
export function validateManifest(data: unknown): SkillPackManifest {
  try {
    return validateSkillPackManifest(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const validationErrors = err.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      throw new ManifestValidationError(
        "Manifest validation failed",
        validationErrors
      );
    }
    throw new ManifestParseError("Manifest validation failed", err);
  }
}

/**
 * Safely validate a manifest object without throwing
 *
 * @param data - The manifest object to validate
 * @returns Parse result with success/error
 */
export function safeValidateManifest(
  data: unknown
): ParseResult<SkillPackManifest> {
  const result = safeValidateSkillPackManifest(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    const validationErrors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`
    );
    return {
      success: false,
      error: "Manifest validation failed",
      details: validationErrors,
    };
  }
}

/**
 * Normalize a pack name to standard format
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes invalid characters
 * - Ensures starts and ends with alphanumeric
 *
 * @param name - The pack name to normalize
 * @returns Normalized pack name
 * @throws {Error} If name cannot be normalized to valid format
 */
export function normalizePackName(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error("Pack name cannot be empty");
  }

  // Convert to lowercase and replace spaces/underscores with hyphens
  let normalized = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");

  // Remove invalid characters (keep only alphanumeric and hyphens)
  normalized = normalized.replace(/[^a-z0-9-]/g, "");

  // Remove leading/trailing hyphens
  normalized = normalized.replace(/^-+|-+$/g, "");

  // Replace multiple consecutive hyphens with single hyphen
  normalized = normalized.replace(/-+/g, "-");

  // Validate the result
  if (normalized.length === 0) {
    throw new Error(`Pack name "${name}" contains no valid characters`);
  }

  if (!/^[a-z0-9]/.test(normalized)) {
    throw new Error(
      `Pack name "${name}" must start with an alphanumeric character`
    );
  }

  if (!/[a-z0-9]$/.test(normalized)) {
    throw new Error(
      `Pack name "${name}" must end with an alphanumeric character`
    );
  }

  if (normalized.length > 255) {
    throw new Error(`Pack name "${name}" is too long (max 255 characters)`);
  }

  return normalized;
}

/**
 * Extract summary information from a manifest for display
 *
 * @param manifest - The manifest to summarize
 * @returns Summary object with key information
 */
export function summarizeManifest(manifest: SkillPackManifest): {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author?: string;
  agentCount: number;
  skillCount: number;
  instructionCount: number;
  mcpServerCount: number;
} {
  const result: {
    name: string;
    version: string;
    displayName: string;
    description: string;
    author?: string;
    agentCount: number;
    skillCount: number;
    instructionCount: number;
    mcpServerCount: number;
  } = {
    name: manifest.name,
    version: manifest.version,
    displayName: manifest.displayName,
    description: manifest.description,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- arrays may be undefined when called outside Zod validation
    agentCount: manifest.agents?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    skillCount: manifest.skills?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    instructionCount: manifest.instructions?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    mcpServerCount: manifest.mcpServers?.length ?? 0,
  };
  
  if (manifest.author) {
    result.author = manifest.author;
  }
  
  return result;
}
