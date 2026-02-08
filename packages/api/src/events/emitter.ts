import { EventEmitter } from "events";
import type {
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  ProgressLoggedEvent,
} from "./types.js";
import {
  EVENT_ENTITY_CREATED,
  EVENT_ENTITY_UPDATED,
  EVENT_ENTITY_DELETED,
  EVENT_PROGRESS_LOGGED,
} from "./types.js";

// Singleton event emitter for the application
export const eventEmitter = new EventEmitter();

// Event names as constants
export const Events = {
  STATUS_CHANGED: "status:changed",
  ENTITY_CREATED: EVENT_ENTITY_CREATED,
  ENTITY_UPDATED: EVENT_ENTITY_UPDATED,
  ENTITY_DELETED: EVENT_ENTITY_DELETED,
  PROGRESS_LOGGED: EVENT_PROGRESS_LOGGED,
} as const;

/**
 * Emit an entity created event
 */
export function emitEntityCreated(payload: EntityCreatedEvent): void {
  console.log(`[Event] ${Events.ENTITY_CREATED}:`, JSON.stringify(payload));
  eventEmitter.emit(Events.ENTITY_CREATED, payload);
}

/**
 * Emit an entity updated event
 */
export function emitEntityUpdated(payload: EntityUpdatedEvent): void {
  console.log(`[Event] ${Events.ENTITY_UPDATED}:`, JSON.stringify(payload));
  eventEmitter.emit(Events.ENTITY_UPDATED, payload);
}

/**
 * Emit an entity deleted event
 */
export function emitEntityDeleted(payload: EntityDeletedEvent): void {
  console.log(`[Event] ${Events.ENTITY_DELETED}:`, JSON.stringify(payload));
  eventEmitter.emit(Events.ENTITY_DELETED, payload);
}

/**
 * Emit a progress logged event
 */
export function emitProgressLogged(payload: ProgressLoggedEvent): void {
  console.log(`[Event] ${Events.PROGRESS_LOGGED}:`, JSON.stringify(payload));
  eventEmitter.emit(Events.PROGRESS_LOGGED, payload);
}

/**
 * Subscribe to entity created events
 */
export function onEntityCreated(
  handler: (payload: EntityCreatedEvent) => void
): void {
  eventEmitter.on(Events.ENTITY_CREATED, handler);
}

/**
 * Subscribe to entity updated events
 */
export function onEntityUpdated(
  handler: (payload: EntityUpdatedEvent) => void
): void {
  eventEmitter.on(Events.ENTITY_UPDATED, handler);
}

/**
 * Subscribe to entity deleted events
 */
export function onEntityDeleted(
  handler: (payload: EntityDeletedEvent) => void
): void {
  eventEmitter.on(Events.ENTITY_DELETED, handler);
}

/**
 * Subscribe to progress logged events
 */
export function onProgressLogged(
  handler: (payload: ProgressLoggedEvent) => void
): void {
  eventEmitter.on(Events.PROGRESS_LOGGED, handler);
}
