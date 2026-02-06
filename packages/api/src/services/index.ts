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
export * as progressService from "./progressService.js";
export * as templateService from "./templateService.js";
export * as sessionService from "./sessionService.js";
export * as codeContextService from "./codeContextService.js";
export * as validationService from "./validationService.js";
export * as validationExecutor from "./validationExecutor.js";
export * as summaryService from "./summaryService.js";
export * as decisionService from "./decisionService.js";
export * as userActivityService from "./userActivityService.js";

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
