/**
 * Service exports for use by other packages (e.g., MCP server)
 */

// Re-export all services
export * as epicService from "./epicService.js";
export * as featureService from "./featureService.js";
export * as taskService from "./taskService.js";
export * as statusService from "./statusService.js";
export * as teamService from "./teamService.js";
export * as userService from "./userService.js";
export * as personalScopeService from "./personalScopeService.js";
export * as invitationService from "./invitationService.js";
export * as aiContextService from "./aiContextService.js";

// Re-export the database client
export { prisma } from "../lib/db.js";

// Re-export error types
export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from "../errors/index.js";
