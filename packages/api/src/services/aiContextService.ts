/**
 * AI Context Service
 *
 * Provides business logic for AI session context operations.
 * Enables AI sessions to leave structured breadcrumbs for successor sessions.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";
import type {
  AiNote,
  AiNoteType,
  AiContextResponse,
  EntityType,
} from "../schemas/aiContext.js";

// =============================================================================
// Types
// =============================================================================

export interface AppendAiNoteInput {
  type: AiNoteType;
  content: string;
  sessionId?: string | undefined;
}

export interface SetAiContextInput {
  context: string;
  sessionId?: string | undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse aiNotes from JSON string to array
 */
function parseAiNotes(aiNotes: string | null): AiNote[] {
  if (!aiNotes) return [];
  try {
    const parsed = JSON.parse(aiNotes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Stringify aiNotes array to JSON
 */
function stringifyAiNotes(notes: AiNote[]): string {
  return JSON.stringify(notes);
}

// =============================================================================
// Feature AI Context Operations
// =============================================================================

/**
 * Get AI context for a feature
 */
export async function getFeatureAiContext(
  featureId: string
): Promise<AiContextResponse> {
  const feature = await prisma.feature.findFirst({
    where: { id: featureId },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  return {
    aiContext: feature.aiContext,
    aiNotes: parseAiNotes(feature.aiNotes),
    lastAiSessionId: feature.lastAiSessionId,
    lastAiUpdateAt: feature.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Set AI context for a feature (replaces entire context)
 */
export async function setFeatureAiContext(
  featureId: string,
  input: SetAiContextInput
): Promise<AiContextResponse> {
  // Verify feature exists
  const existing = await prisma.feature.findFirst({
    where: { id: featureId },
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  const now = new Date();

  const updated = await prisma.feature.update({
    where: { id: featureId },
    data: {
      aiContext: input.context,
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Append an AI note to a feature (non-destructive)
 */
export async function appendFeatureAiNote(
  featureId: string,
  input: AppendAiNoteInput
): Promise<AiContextResponse> {
  // Verify feature exists and get current notes
  const existing = await prisma.feature.findFirst({
    where: { id: featureId },
    select: {
      aiNotes: true,
    },
  });

  if (!existing) {
    throw new NotFoundError(`Feature with id '${featureId}' not found`);
  }

  const currentNotes = parseAiNotes(existing.aiNotes);
  const newNote: AiNote = {
    timestamp: new Date().toISOString(),
    type: input.type,
    content: input.content,
    ...(input.sessionId && { sessionId: input.sessionId }),
  };

  currentNotes.push(newNote);
  const now = new Date();

  const updated = await prisma.feature.update({
    where: { id: featureId },
    data: {
      aiNotes: stringifyAiNotes(currentNotes),
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

// =============================================================================
// Task AI Context Operations
// =============================================================================

/**
 * Get AI context for a task
 */
export async function getTaskAiContext(
  taskId: string
): Promise<AiContextResponse> {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  if (!task) {
    throw new NotFoundError(`Task with id '${taskId}' not found`);
  }

  return {
    aiContext: task.aiContext,
    aiNotes: parseAiNotes(task.aiNotes),
    lastAiSessionId: task.lastAiSessionId,
    lastAiUpdateAt: task.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Set AI context for a task (replaces entire context)
 */
export async function setTaskAiContext(
  taskId: string,
  input: SetAiContextInput
): Promise<AiContextResponse> {
  // Verify task exists
  const existing = await prisma.task.findFirst({
    where: { id: taskId },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${taskId}' not found`);
  }

  const now = new Date();

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      aiContext: input.context,
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Append an AI note to a task (non-destructive)
 */
export async function appendTaskAiNote(
  taskId: string,
  input: AppendAiNoteInput
): Promise<AiContextResponse> {
  // Verify task exists and get current notes
  const existing = await prisma.task.findFirst({
    where: { id: taskId },
    select: {
      aiNotes: true,
    },
  });

  if (!existing) {
    throw new NotFoundError(`Task with id '${taskId}' not found`);
  }

  const currentNotes = parseAiNotes(existing.aiNotes);
  const newNote: AiNote = {
    timestamp: new Date().toISOString(),
    type: input.type,
    content: input.content,
    ...(input.sessionId && { sessionId: input.sessionId }),
  };

  currentNotes.push(newNote);
  const now = new Date();

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      aiNotes: stringifyAiNotes(currentNotes),
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

// =============================================================================
// Epic AI Context Operations
// =============================================================================

/**
 * Get AI context for an epic
 */
export async function getEpicAiContext(
  epicId: string
): Promise<AiContextResponse> {
  const epic = await prisma.epic.findFirst({
    where: { id: epicId },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  if (!epic) {
    throw new NotFoundError(`Epic with id '${epicId}' not found`);
  }

  return {
    aiContext: epic.aiContext,
    aiNotes: parseAiNotes(epic.aiNotes),
    lastAiSessionId: epic.lastAiSessionId,
    lastAiUpdateAt: epic.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Set AI context for an epic (replaces entire context)
 */
export async function setEpicAiContext(
  epicId: string,
  input: SetAiContextInput
): Promise<AiContextResponse> {
  // Verify epic exists
  const existing = await prisma.epic.findFirst({
    where: { id: epicId },
  });

  if (!existing) {
    throw new NotFoundError(`Epic with id '${epicId}' not found`);
  }

  const now = new Date();

  const updated = await prisma.epic.update({
    where: { id: epicId },
    data: {
      aiContext: input.context,
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

/**
 * Append an AI note to an epic (non-destructive)
 */
export async function appendEpicAiNote(
  epicId: string,
  input: AppendAiNoteInput
): Promise<AiContextResponse> {
  // Verify epic exists and get current notes
  const existing = await prisma.epic.findFirst({
    where: { id: epicId },
    select: {
      aiNotes: true,
    },
  });

  if (!existing) {
    throw new NotFoundError(`Epic with id '${epicId}' not found`);
  }

  const currentNotes = parseAiNotes(existing.aiNotes);
  const newNote: AiNote = {
    timestamp: new Date().toISOString(),
    type: input.type,
    content: input.content,
    ...(input.sessionId && { sessionId: input.sessionId }),
  };

  currentNotes.push(newNote);
  const now = new Date();

  const updated = await prisma.epic.update({
    where: { id: epicId },
    data: {
      aiNotes: stringifyAiNotes(currentNotes),
      lastAiSessionId: input.sessionId ?? null,
      lastAiUpdateAt: now,
    },
    select: {
      aiContext: true,
      aiNotes: true,
      lastAiSessionId: true,
      lastAiUpdateAt: true,
    },
  });

  return {
    aiContext: updated.aiContext,
    aiNotes: parseAiNotes(updated.aiNotes),
    lastAiSessionId: updated.lastAiSessionId,
    lastAiUpdateAt: updated.lastAiUpdateAt?.toISOString() ?? null,
  };
}

// =============================================================================
// Generic Operations (for MCP tools)
// =============================================================================

/**
 * Get AI context for either a feature or task
 */
export async function getAiContext(
  entityType: EntityType,
  entityId: string
): Promise<AiContextResponse> {
  if (entityType === "feature") {
    return getFeatureAiContext(entityId);
  } else if (entityType === "epic") {
    return getEpicAiContext(entityId);
  } else {
    return getTaskAiContext(entityId);
  }
}

/**
 * Set AI context for either a feature or task
 */
export async function setAiContext(
  entityType: EntityType,
  entityId: string,
  input: SetAiContextInput
): Promise<AiContextResponse> {
  if (entityType === "feature") {
    return setFeatureAiContext(entityId, input);
  } else if (entityType === "epic") {
    return setEpicAiContext(entityId, input);
  } else {
    return setTaskAiContext(entityId, input);
  }
}

/**
 * Append an AI note to either a feature or task
 */
export async function appendAiNote(
  entityType: EntityType,
  entityId: string,
  input: AppendAiNoteInput
): Promise<AiContextResponse> {
  if (entityType === "feature") {
    return appendFeatureAiNote(entityId, input);
  } else if (entityType === "epic") {
    return appendEpicAiNote(entityId, input);
  } else {
    return appendTaskAiNote(entityId, input);
  }
}
