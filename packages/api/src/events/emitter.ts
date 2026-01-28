import { EventEmitter } from "events";

// Singleton event emitter for the application
export const eventEmitter = new EventEmitter();

// Event names as constants
export const Events = {
  STATUS_CHANGED: "status:changed",
} as const;
