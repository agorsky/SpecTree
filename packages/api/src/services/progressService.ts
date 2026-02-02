/**
 * Progress Service
 *
 * Provides operations for tracking work progress on features and tasks.
 * Handles status transitions, timing calculations, and progress logging.
 */

import { prisma } from "../lib/db.js";
import type { Feature, Task } from "../generated/prisma/index.js";
import { NotFoundError, ValidationError } from "../errors/index.js";
import { appendFeatureAiNote, appendTaskAiNote } from "./aiContextService.js";
import { emitStatusChanged } from "../events/index.js";
import { logSessionWork } from "./sessionService.js";

// Entity type for progress operations
export type EntityType = "feature" | "task";

// Result types
export interface StartWorkResult {
  id: string;
  identifier: string;
  title: string;
  statusId: string | null;
  startedAt: Date;
  message: string;
}

export interface CompleteWorkResult {
  id: string;
  identifier: string;
  title: string;
  statusId: string | null;
  startedAt: Date | null;
  completedAt: Date;
  durationMinutes: number | null;
  message: string;
}

export interface LogProgressResult {
  id: string;
  identifier: string;
  title: string;
  percentComplete: number | null;
  message: string;
}

export interface ReportBlockerResult {
  id: string;
  identifier: string;
  title: string;
  statusId: string | null;
  blockerReason: string;
  blockedById: string | null;
  message: string;
}

// Input types
export interface StartWorkInput {
  sessionId?: string | undefined;
}

export interface CompleteWorkInput {
  summary?: string | undefined;
  sessionId?: string | undefined;
}

export interface LogProgressInput {
  message: string;
  percentComplete?: number | undefined;
  sessionId?: string | undefined;
}

export interface ReportBlockerInput {
  reason: string;
  blockedById?: string | undefined;
  sessionId?: string | undefined;
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

/**
 * Find "In Progress" status for a team (looks for category "started")
 */
async function findInProgressStatus(teamId: string | null, personalScopeId: string | null): Promise<string | null> {
  if (!teamId && !personalScopeId) return null;

  const status = await prisma.status.findFirst({
    where: {
      ...(teamId ? { teamId } : { personalScopeId }),
      category: "started",
    },
    select: { id: true },
  });

  return status?.id ?? null;
}

/**
 * Find "Done" status for a team (looks for category "completed")
 */
async function findDoneStatus(teamId: string | null, personalScopeId: string | null): Promise<string | null> {
  if (!teamId && !personalScopeId) return null;

  const status = await prisma.status.findFirst({
    where: {
      ...(teamId ? { teamId } : { personalScopeId }),
      category: "completed",
    },
    select: { id: true },
  });

  return status?.id ?? null;
}

/**
 * Find "Blocked" status for a team (looks for specific name)
 */
async function findBlockedStatus(teamId: string | null, personalScopeId: string | null): Promise<string | null> {
  if (!teamId && !personalScopeId) return null;

  // First try to find a status named "Blocked"
  const status = await prisma.status.findFirst({
    where: {
      ...(teamId ? { teamId } : { personalScopeId }),
      name: { contains: "Blocked" },
    },
    select: { id: true },
  });

  return status?.id ?? null;
}

/**
 * Get feature by ID or identifier
 */
async function getFeature(idOrIdentifier: string): Promise<Feature & { epic: { teamId: string | null; personalScopeId: string | null } }> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  const isIdentifier = FEATURE_IDENTIFIER_REGEX.test(idOrIdentifier);

  const whereClause = isUuid
    ? { id: idOrIdentifier }
    : isIdentifier
      ? { identifier: idOrIdentifier }
      : { title: idOrIdentifier };

  const feature = await prisma.feature.findFirst({
    where: whereClause,
    include: {
      epic: {
        select: { teamId: true, personalScopeId: true },
      },
    },
  });

  if (!feature) {
    throw new NotFoundError(`Feature '${idOrIdentifier}' not found`);
  }

  return feature;
}

/**
 * Get task by ID or identifier
 */
async function getTask(idOrIdentifier: string): Promise<Task & { feature: { epicId: string; epic: { teamId: string | null; personalScopeId: string | null } } }> {
  const isUuid = UUID_REGEX.test(idOrIdentifier);
  const isIdentifier = TASK_IDENTIFIER_REGEX.test(idOrIdentifier);

  const whereClause = isUuid
    ? { id: idOrIdentifier }
    : isIdentifier
      ? { identifier: idOrIdentifier }
      : { title: idOrIdentifier };

  const task = await prisma.task.findFirst({
    where: whereClause,
    include: {
      feature: {
        select: {
          epicId: true,
          epic: {
            select: { teamId: true, personalScopeId: true },
          },
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError(`Task '${idOrIdentifier}' not found`);
  }

  return task;
}

/**
 * Calculate duration in minutes between two dates
 */
function calculateDurationMinutes(startedAt: Date | null, completedAt: Date): number | null {
  if (!startedAt) return null;
  const durationMs = completedAt.getTime() - startedAt.getTime();
  return Math.round(durationMs / 60000);
}

/**
 * Start work on a feature or task.
 * Sets status to "In Progress" and records start timestamp.
 */
export async function startWork(
  type: EntityType,
  idOrIdentifier: string,
  input: StartWorkInput = {}
): Promise<StartWorkResult> {
  const now = new Date();

  if (type === "feature") {
    const feature = await getFeature(idOrIdentifier);
    const inProgressStatusId = await findInProgressStatus(feature.epic.teamId, feature.epic.personalScopeId);
    const oldStatusId = feature.statusId;

    const updated = await prisma.feature.update({
      where: { id: feature.id },
      data: {
        startedAt: now,
        ...(inProgressStatusId ? { statusId: inProgressStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (inProgressStatusId && inProgressStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "feature",
        entityId: feature.id,
        oldStatusId,
        newStatusId: inProgressStatusId,
        timestamp: now,
      });
    }

    // Log an AI note about starting work
    await appendFeatureAiNote(feature.id, {
      type: "context",
      content: `Work started on this feature.`,
      sessionId: input.sessionId,
    });

    // Log to active session (if any)
    await logSessionWork(feature.epicId, {
      itemId: feature.id,
      itemType: "feature",
      identifier: feature.identifier,
      action: "started",
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      startedAt: now,
      message: `Started work on feature ${updated.identifier}. Status set to "In Progress".`,
    };
  } else {
    const task = await getTask(idOrIdentifier);
    const inProgressStatusId = await findInProgressStatus(
      task.feature.epic.teamId,
      task.feature.epic.personalScopeId
    );
    const oldStatusId = task.statusId;

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        startedAt: now,
        ...(inProgressStatusId ? { statusId: inProgressStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (inProgressStatusId && inProgressStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "task",
        entityId: task.id,
        oldStatusId,
        newStatusId: inProgressStatusId,
        timestamp: now,
      });
    }

    // Log an AI note about starting work
    await appendTaskAiNote(task.id, {
      type: "context",
      content: `Work started on this task.`,
      sessionId: input.sessionId,
    });

    // Log to active session (if any)
    await logSessionWork(task.feature.epicId, {
      itemId: task.id,
      itemType: "task",
      identifier: task.identifier,
      action: "started",
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      startedAt: now,
      message: `Started work on task ${updated.identifier}. Status set to "In Progress".`,
    };
  }
}

/**
 * Complete work on a feature or task.
 * Sets status to "Done", records completion timestamp, and calculates duration.
 */
export async function completeWork(
  type: EntityType,
  idOrIdentifier: string,
  input: CompleteWorkInput = {}
): Promise<CompleteWorkResult> {
  const now = new Date();

  if (type === "feature") {
    const feature = await getFeature(idOrIdentifier);
    const doneStatusId = await findDoneStatus(feature.epic.teamId, feature.epic.personalScopeId);
    const durationMinutes = calculateDurationMinutes(feature.startedAt, now);
    const oldStatusId = feature.statusId;

    const updated = await prisma.feature.update({
      where: { id: feature.id },
      data: {
        completedAt: now,
        durationMinutes,
        percentComplete: 100,
        blockerReason: null, // Clear any blocker
        ...(doneStatusId ? { statusId: doneStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (doneStatusId && doneStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "feature",
        entityId: feature.id,
        oldStatusId,
        newStatusId: doneStatusId,
        timestamp: now,
      });
    }

    // Log completion note with optional summary
    const noteContent = input.summary
      ? `Work completed. Summary: ${input.summary}`
      : `Work completed.`;

    await appendFeatureAiNote(feature.id, {
      type: "context",
      content: noteContent,
      sessionId: input.sessionId,
    });

    // Log to active session (if any)
    await logSessionWork(feature.epicId, {
      itemId: feature.id,
      itemType: "feature",
      identifier: feature.identifier,
      action: "completed",
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      startedAt: feature.startedAt,
      completedAt: now,
      durationMinutes,
      message: `Completed feature ${updated.identifier}. Status set to "Done".${durationMinutes ? ` Duration: ${durationMinutes} minutes.` : ""}`,
    };
  } else {
    const task = await getTask(idOrIdentifier);
    const doneStatusId = await findDoneStatus(
      task.feature.epic.teamId,
      task.feature.epic.personalScopeId
    );
    const durationMinutes = calculateDurationMinutes(task.startedAt, now);
    const oldStatusId = task.statusId;

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        completedAt: now,
        durationMinutes,
        percentComplete: 100,
        blockerReason: null, // Clear any blocker
        ...(doneStatusId ? { statusId: doneStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (doneStatusId && doneStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "task",
        entityId: task.id,
        oldStatusId,
        newStatusId: doneStatusId,
        timestamp: now,
      });
    }

    // Log completion note with optional summary
    const noteContent = input.summary
      ? `Work completed. Summary: ${input.summary}`
      : `Work completed.`;

    await appendTaskAiNote(task.id, {
      type: "context",
      content: noteContent,
      sessionId: input.sessionId,
    });

    // Log to active session (if any)
    await logSessionWork(task.feature.epicId, {
      itemId: task.id,
      itemType: "task",
      identifier: task.identifier,
      action: "completed",
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      startedAt: task.startedAt,
      completedAt: now,
      durationMinutes,
      message: `Completed task ${updated.identifier}. Status set to "Done".${durationMinutes ? ` Duration: ${durationMinutes} minutes.` : ""}`,
    };
  }
}

/**
 * Log progress on a feature or task without changing status.
 */
export async function logProgress(
  type: EntityType,
  idOrIdentifier: string,
  input: LogProgressInput
): Promise<LogProgressResult> {
  // Validate percent complete if provided
  if (input.percentComplete !== undefined) {
    if (input.percentComplete < 0 || input.percentComplete > 100) {
      throw new ValidationError("percentComplete must be between 0 and 100");
    }
  }

  if (type === "feature") {
    const feature = await getFeature(idOrIdentifier);

    const updated = await prisma.feature.update({
      where: { id: feature.id },
      data: {
        ...(input.percentComplete !== undefined ? { percentComplete: input.percentComplete } : {}),
      },
    });

    // Log progress note
    const noteContent = input.percentComplete !== undefined
      ? `Progress update (${input.percentComplete}%): ${input.message}`
      : `Progress update: ${input.message}`;

    await appendFeatureAiNote(feature.id, {
      type: "observation",
      content: noteContent,
      sessionId: input.sessionId,
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      percentComplete: updated.percentComplete,
      message: `Logged progress on feature ${updated.identifier}.`,
    };
  } else {
    const task = await getTask(idOrIdentifier);

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(input.percentComplete !== undefined ? { percentComplete: input.percentComplete } : {}),
      },
    });

    // Log progress note
    const noteContent = input.percentComplete !== undefined
      ? `Progress update (${input.percentComplete}%): ${input.message}`
      : `Progress update: ${input.message}`;

    await appendTaskAiNote(task.id, {
      type: "observation",
      content: noteContent,
      sessionId: input.sessionId,
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      percentComplete: updated.percentComplete,
      message: `Logged progress on task ${updated.identifier}.`,
    };
  }
}

/**
 * Report a blocker on a feature or task.
 * Optionally links to a blocking item and updates status.
 */
export async function reportBlocker(
  type: EntityType,
  idOrIdentifier: string,
  input: ReportBlockerInput
): Promise<ReportBlockerResult> {
  if (type === "feature") {
    const feature = await getFeature(idOrIdentifier);
    const blockedStatusId = await findBlockedStatus(feature.epic.teamId, feature.epic.personalScopeId);
    const oldStatusId = feature.statusId;

    // If blockedById provided, add to dependencies
    let dependencies = feature.dependencies ? JSON.parse(feature.dependencies) as string[] : [];
    if (input.blockedById && !dependencies.includes(input.blockedById)) {
      dependencies = [...dependencies, input.blockedById];
    }

    const updated = await prisma.feature.update({
      where: { id: feature.id },
      data: {
        blockerReason: input.reason,
        dependencies: dependencies.length > 0 ? JSON.stringify(dependencies) : null,
        ...(blockedStatusId ? { statusId: blockedStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (blockedStatusId && blockedStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "feature",
        entityId: feature.id,
        oldStatusId,
        newStatusId: blockedStatusId,
        timestamp: new Date(),
      });
    }

    // Log blocker note
    const noteContent = input.blockedById
      ? `Blocked: ${input.reason} (blocked by: ${input.blockedById})`
      : `Blocked: ${input.reason}`;

    await appendFeatureAiNote(feature.id, {
      type: "blocker",
      content: noteContent,
      sessionId: input.sessionId,
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      blockerReason: input.reason,
      blockedById: input.blockedById ?? null,
      message: `Reported blocker on feature ${updated.identifier}.${blockedStatusId ? ' Status set to "Blocked".' : ""}`,
    };
  } else {
    const task = await getTask(idOrIdentifier);
    const blockedStatusId = await findBlockedStatus(
      task.feature.epic.teamId,
      task.feature.epic.personalScopeId
    );
    const oldStatusId = task.statusId;

    // If blockedById provided, add to dependencies
    let dependencies = task.dependencies ? JSON.parse(task.dependencies) as string[] : [];
    if (input.blockedById && !dependencies.includes(input.blockedById)) {
      dependencies = [...dependencies, input.blockedById];
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        blockerReason: input.reason,
        dependencies: dependencies.length > 0 ? JSON.stringify(dependencies) : null,
        ...(blockedStatusId ? { statusId: blockedStatusId } : {}),
      },
    });

    // Emit status changed event if status was updated
    if (blockedStatusId && blockedStatusId !== oldStatusId) {
      emitStatusChanged({
        entityType: "task",
        entityId: task.id,
        oldStatusId,
        newStatusId: blockedStatusId,
        timestamp: new Date(),
      });
    }

    // Log blocker note
    const noteContent = input.blockedById
      ? `Blocked: ${input.reason} (blocked by: ${input.blockedById})`
      : `Blocked: ${input.reason}`;

    await appendTaskAiNote(task.id, {
      type: "blocker",
      content: noteContent,
      sessionId: input.sessionId,
    });

    return {
      id: updated.id,
      identifier: updated.identifier,
      title: updated.title,
      statusId: updated.statusId,
      blockerReason: input.reason,
      blockedById: input.blockedById ?? null,
      message: `Reported blocker on task ${updated.identifier}.${blockedStatusId ? ' Status set to "Blocked".' : ""}`,
    };
  }
}
