import { eventEmitter, Events } from "./emitter.js";

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
