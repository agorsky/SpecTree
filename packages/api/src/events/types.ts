/**
 * Event type definitions for entity mutations
 */

// Entity types that can be tracked
export type EntityType = "feature" | "task" | "epic";

// Mutation action types
export type MutationAction = "created" | "updated" | "deleted";

/**
 * Base event payload for entity mutations
 */
export interface EntityMutationEvent {
  entityType: EntityType;
  entityId: string;
  action: MutationAction;
  changedFields?: string[]; // Only populated for 'updated' actions
  userId: string | null; // Null for system actions
  timestamp: string; // ISO 8601 timestamp
}

/**
 * Event payload for entity creation
 */
export interface EntityCreatedEvent {
  entityType: EntityType;
  entityId: string;
  userId: string | null;
  timestamp: string;
}

/**
 * Event payload for entity updates
 */
export interface EntityUpdatedEvent {
  entityType: EntityType;
  entityId: string;
  changedFields: string[]; // Array of field names that were modified
  userId: string | null;
  timestamp: string;
}

/**
 * Event payload for entity deletion
 */
export interface EntityDeletedEvent {
  entityType: EntityType;
  entityId: string;
  userId: string | null;
  timestamp: string;
}

/**
 * Event payload for progress logging
 */
export interface ProgressLoggedEvent {
  entityType: EntityType;
  entityId: string;
  message: string;
  percentComplete?: number;
  userId: string | null;
  timestamp: string;
}

// Event name constants
export const EVENT_ENTITY_CREATED = "entity:created";
export const EVENT_ENTITY_UPDATED = "entity:updated";
export const EVENT_ENTITY_DELETED = "entity:deleted";
export const EVENT_PROGRESS_LOGGED = "progress:logged";
