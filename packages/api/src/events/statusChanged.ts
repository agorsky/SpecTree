import { eventEmitter, Events } from "./emitter.js";
import { prisma } from "../lib/db.js";

export interface StatusChangedPayload {
  entityType: "feature" | "task";
  entityId: string;
  oldStatusId: string | null;
  newStatusId: string;
  changedBy?: string; // User ID who made the change
  timestamp: Date;
}

/**
 * Emit a status changed event
 */
export function emitStatusChanged(payload: StatusChangedPayload): void {
  // For MVP: just log the event
  console.log(`[Event] ${Events.STATUS_CHANGED}:`, JSON.stringify(payload));

  // Emit for any listeners
  eventEmitter.emit(Events.STATUS_CHANGED, payload);
}

/**
 * Subscribe to status changed events
 */
export function onStatusChanged(
  handler: (payload: StatusChangedPayload) => void
): void {
  eventEmitter.on(Events.STATUS_CHANGED, handler);
}

/**
 * Unsubscribe from status changed events
 */
export function offStatusChanged(
  handler: (payload: StatusChangedPayload) => void
): void {
  eventEmitter.off(Events.STATUS_CHANGED, handler);
}

/**
 * Handle status change events to track implementedBy and implementedDate.
 * When a feature or task transitions to 'started' or 'completed' status categories,
 * we record who implemented it and when.
 */
async function handleStatusChanged(payload: StatusChangedPayload): Promise<void> {
  try {
    // Only process if we have a changedBy user and a new status
    if (!payload.changedBy || !payload.newStatusId) {
      return;
    }

    // Fetch the new status to get its category
    const newStatus = await prisma.status.findUnique({
      where: { id: payload.newStatusId },
      select: { category: true },
    });

    // Only set implementedBy/implementedDate for 'started' or 'completed' categories
    if (!newStatus || (newStatus.category !== "started" && newStatus.category !== "completed")) {
      return;
    }

    // Update the entity with implementedBy and implementedDate
    const updateData = {
      implementedBy: payload.changedBy,
      implementedDate: payload.timestamp,
    };

    if (payload.entityType === "feature") {
      await prisma.feature.update({
        where: { id: payload.entityId },
        data: updateData,
      });
      console.log(`[StatusChanged] Updated feature ${payload.entityId} with implementedBy=${payload.changedBy}`);
    } else if (payload.entityType === "task") {
      await prisma.task.update({
        where: { id: payload.entityId },
        data: updateData,
      });
      console.log(`[StatusChanged] Updated task ${payload.entityId} with implementedBy=${payload.changedBy}`);
    }
  } catch (error) {
    console.error(`[StatusChanged] Error handling status change for ${payload.entityType} ${payload.entityId}:`, error);
  }
}

// Register the handler when this module loads
onStatusChanged(handleStatusChanged);
