/**
 * Structured Description Service
 *
 * Provides business logic for structured description operations.
 * Enables AI agents to work with structured, machine-readable sections
 * instead of unstructured freeform text.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import {
  structuredDescriptionSchema,
  type StructuredDescription,
  type StructuredDescriptionSection,
  type ExternalLink,
} from "../schemas/structuredDescription.js";

// =============================================================================
// Types
// =============================================================================

export interface StructuredDescriptionResponse {
  structuredDesc: StructuredDescription | null;
  updatedAt: string;
}

export type EntityType = "feature" | "task";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse structuredDesc from JSON string
 */
function parseStructuredDesc(structuredDesc: string | null): StructuredDescription | null {
  if (!structuredDesc) return null;
  try {
    const parsed = JSON.parse(structuredDesc);
    // Validate against schema
    const result = structuredDescriptionSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // If validation fails, still return the parsed data but it may be partial
    return parsed as StructuredDescription;
  } catch {
    return null;
  }
}

/**
 * Stringify structuredDesc to JSON
 */
function stringifyStructuredDesc(desc: StructuredDescription): string {
  return JSON.stringify(desc);
}

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feature identifier pattern (e.g., "ENG-123")
 */
const FEATURE_IDENTIFIER_REGEX = /^[A-Z]+-\d+$/i;

/**
 * Task identifier pattern (e.g., "ENG-123-1")
 */
const TASK_IDENTIFIER_REGEX = /^[A-Z]+-\d+-\d+$/i;

// =============================================================================
// Feature Structured Description Operations
// =============================================================================

/**
 * Resolve a feature ID from UUID, identifier, or title
 */
async function resolveFeatureId(idOrIdentifierOrTitle: string): Promise<string> {
  const isUuid = UUID_REGEX.test(idOrIdentifierOrTitle);
  const isIdentifier = FEATURE_IDENTIFIER_REGEX.test(idOrIdentifierOrTitle);
  
  const whereClause = isUuid
    ? { id: idOrIdentifierOrTitle }
    : isIdentifier
      ? { identifier: idOrIdentifierOrTitle }
      : { title: idOrIdentifierOrTitle };

  const feature = await prisma.feature.findFirst({
    where: whereClause,
    select: { id: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature '${idOrIdentifierOrTitle}' not found`);
  }

  return feature.id;
}

/**
 * Resolve a task ID from UUID or identifier
 */
async function resolveTaskId(idOrIdentifier: string): Promise<string> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  const isIdentifier = TASK_IDENTIFIER_REGEX.test(idOrIdentifier);
  
  const whereClause = isUuid
    ? { id: idOrIdentifier }
    : isIdentifier
      ? { identifier: idOrIdentifier }
      : { title: idOrIdentifier };

  const task = await prisma.task.findFirst({
    where: whereClause,
    select: { id: true },
  });

  if (!task) {
    throw new NotFoundError(`Task '${idOrIdentifier}' not found`);
  }

  return task.id;
}

/**
 * Get structured description for a feature
 */
export async function getFeatureStructuredDesc(
  featureIdOrIdentifier: string
): Promise<StructuredDescriptionResponse> {
  const id = await resolveFeatureId(featureIdOrIdentifier);
  
  const feature = await prisma.feature.findUnique({
    where: { id },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  return {
    structuredDesc: parseStructuredDesc(feature.structuredDesc),
    updatedAt: feature.updatedAt.toISOString(),
  };
}

/**
 * Set structured description for a feature (replaces entire object)
 */
export async function setFeatureStructuredDesc(
  featureIdOrIdentifier: string,
  structuredDesc: StructuredDescription
): Promise<StructuredDescriptionResponse> {
  const id = await resolveFeatureId(featureIdOrIdentifier);

  // Validate the input
  const validationResult = structuredDescriptionSchema.safeParse(structuredDesc);
  if (!validationResult.success) {
    throw new ValidationError(`Invalid structured description: ${validationResult.error.message}`);
  }

  const updated = await prisma.feature.update({
    where: { id },
    data: {
      structuredDesc: stringifyStructuredDesc(validationResult.data),
    },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  return {
    structuredDesc: parseStructuredDesc(updated.structuredDesc),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Update a specific section of a feature's structured description
 */
export async function updateFeatureSection(
  featureIdOrIdentifier: string,
  section: StructuredDescriptionSection,
  value: unknown
): Promise<StructuredDescriptionResponse> {
  const id = await resolveFeatureId(featureIdOrIdentifier);

  // Get current structured description
  const feature = await prisma.feature.findUnique({
    where: { id },
    select: { structuredDesc: true },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${id}' not found`);
  }

  // Parse current or initialize new
  const current = parseStructuredDesc(feature.structuredDesc) ?? { summary: "" };
  
  // Update the specific section
  const updated = { ...current, [section]: value };
  
  // Validate the updated object
  const validationResult = structuredDescriptionSchema.safeParse(updated);
  if (!validationResult.success) {
    throw new ValidationError(`Invalid value for section '${section}': ${validationResult.error.message}`);
  }

  const result = await prisma.feature.update({
    where: { id },
    data: {
      structuredDesc: stringifyStructuredDesc(validationResult.data),
    },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  return {
    structuredDesc: parseStructuredDesc(result.structuredDesc),
    updatedAt: result.updatedAt.toISOString(),
  };
}

// =============================================================================
// Task Structured Description Operations
// =============================================================================

/**
 * Get structured description for a task
 */
export async function getTaskStructuredDesc(
  taskIdOrIdentifier: string
): Promise<StructuredDescriptionResponse> {
  const id = await resolveTaskId(taskIdOrIdentifier);
  
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  return {
    structuredDesc: parseStructuredDesc(task.structuredDesc),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * Set structured description for a task (replaces entire object)
 */
export async function setTaskStructuredDesc(
  taskIdOrIdentifier: string,
  structuredDesc: StructuredDescription
): Promise<StructuredDescriptionResponse> {
  const id = await resolveTaskId(taskIdOrIdentifier);

  // Validate the input
  const validationResult = structuredDescriptionSchema.safeParse(structuredDesc);
  if (!validationResult.success) {
    throw new ValidationError(`Invalid structured description: ${validationResult.error.message}`);
  }

  const updated = await prisma.task.update({
    where: { id },
    data: {
      structuredDesc: stringifyStructuredDesc(validationResult.data),
    },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  return {
    structuredDesc: parseStructuredDesc(updated.structuredDesc),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Update a specific section of a task's structured description
 */
export async function updateTaskSection(
  taskIdOrIdentifier: string,
  section: StructuredDescriptionSection,
  value: unknown
): Promise<StructuredDescriptionResponse> {
  const id = await resolveTaskId(taskIdOrIdentifier);

  // Get current structured description
  const task = await prisma.task.findUnique({
    where: { id },
    select: { structuredDesc: true },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${id}' not found`);
  }

  // Parse current or initialize new
  const current = parseStructuredDesc(task.structuredDesc) ?? { summary: "" };
  
  // Update the specific section
  const updated = { ...current, [section]: value };
  
  // Validate the updated object
  const validationResult = structuredDescriptionSchema.safeParse(updated);
  if (!validationResult.success) {
    throw new ValidationError(`Invalid value for section '${section}': ${validationResult.error.message}`);
  }

  const result = await prisma.task.update({
    where: { id },
    data: {
      structuredDesc: stringifyStructuredDesc(validationResult.data),
    },
    select: {
      structuredDesc: true,
      updatedAt: true,
    },
  });

  return {
    structuredDesc: parseStructuredDesc(result.structuredDesc),
    updatedAt: result.updatedAt.toISOString(),
  };
}

// =============================================================================
// Generic Operations (for MCP tools)
// =============================================================================

/**
 * Get structured description for either a feature or task
 */
export async function getStructuredDesc(
  entityType: EntityType,
  entityId: string
): Promise<StructuredDescriptionResponse> {
  if (entityType === "feature") {
    return getFeatureStructuredDesc(entityId);
  } else {
    return getTaskStructuredDesc(entityId);
  }
}

/**
 * Set structured description for either a feature or task
 */
export async function setStructuredDesc(
  entityType: EntityType,
  entityId: string,
  structuredDesc: StructuredDescription
): Promise<StructuredDescriptionResponse> {
  if (entityType === "feature") {
    return setFeatureStructuredDesc(entityId, structuredDesc);
  } else {
    return setTaskStructuredDesc(entityId, structuredDesc);
  }
}

/**
 * Update a specific section for either a feature or task
 */
export async function updateSection(
  entityType: EntityType,
  entityId: string,
  section: StructuredDescriptionSection,
  value: unknown
): Promise<StructuredDescriptionResponse> {
  if (entityType === "feature") {
    return updateFeatureSection(entityId, section, value);
  } else {
    return updateTaskSection(entityId, section, value);
  }
}

// =============================================================================
// Convenience Operations
// =============================================================================

/**
 * Add an acceptance criterion to a feature or task
 */
export async function addAcceptanceCriterion(
  entityType: EntityType,
  entityId: string,
  criterion: string
): Promise<StructuredDescriptionResponse> {
  const response = await getStructuredDesc(entityType, entityId);
  const current = response.structuredDesc ?? { summary: "" };
  const criteria = current.acceptanceCriteria ?? [];
  
  // Check for duplicate
  if (criteria.includes(criterion)) {
    return response; // Already exists, no change needed
  }
  
  return updateSection(entityType, entityId, "acceptanceCriteria", [...criteria, criterion]);
}

/**
 * Link a file to a feature or task
 */
export async function linkFile(
  entityType: EntityType,
  entityId: string,
  filePath: string
): Promise<StructuredDescriptionResponse> {
  const response = await getStructuredDesc(entityType, entityId);
  const current = response.structuredDesc ?? { summary: "" };
  const files = current.filesInvolved ?? [];
  
  // Check for duplicate
  if (files.includes(filePath)) {
    return response; // Already exists, no change needed
  }
  
  return updateSection(entityType, entityId, "filesInvolved", [...files, filePath]);
}

/**
 * Add an external link to a feature or task
 */
export async function addExternalLink(
  entityType: EntityType,
  entityId: string,
  link: ExternalLink
): Promise<StructuredDescriptionResponse> {
  const response = await getStructuredDesc(entityType, entityId);
  const current = response.structuredDesc ?? { summary: "" };
  const links = current.externalLinks ?? [];
  
  // Check for duplicate (by URL)
  if (links.some(l => l.url === link.url)) {
    return response; // Already exists, no change needed
  }
  
  return updateSection(entityType, entityId, "externalLinks", [...links, link]);
}

/**
 * Add a related item ID to a feature or task
 */
export async function addRelatedItem(
  entityType: EntityType,
  entityId: string,
  relatedItemId: string
): Promise<StructuredDescriptionResponse> {
  const response = await getStructuredDesc(entityType, entityId);
  const current = response.structuredDesc ?? { summary: "" };
  const relatedIds = current.relatedItemIds ?? [];
  
  // Check for duplicate
  if (relatedIds.includes(relatedItemId)) {
    return response; // Already exists, no change needed
  }
  
  return updateSection(entityType, entityId, "relatedItemIds", [...relatedIds, relatedItemId]);
}
