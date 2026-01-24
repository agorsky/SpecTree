/**
 * Central export for all validation schemas.
 * Import from this file for convenient access to all schemas.
 */

// Common schemas
export {
  uuidParamSchema,
  paginationQuerySchema,
  type UuidParam,
  type PaginationQuery,
} from "./common.js";

// Team schemas
export {
  createTeamSchema,
  updateTeamSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
} from "./team.js";

// User schemas
export {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "./user.js";

// Project schemas
export {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "./project.js";

// Feature schemas
export {
  createFeatureSchema,
  updateFeatureSchema,
  type CreateFeatureInput,
  type UpdateFeatureInput,
} from "./feature.js";

// Task schemas
export {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "./task.js";

// Status schemas
export {
  statusCategoryEnum,
  createStatusSchema,
  updateStatusSchema,
  type StatusCategory,
  type CreateStatusInput,
  type UpdateStatusInput,
} from "./status.js";

// Membership schemas
export {
  membershipRoleEnum,
  addMemberSchema,
  updateMemberRoleSchema,
  type MembershipRole,
  type AddMemberInput,
  type UpdateMemberRoleInput,
} from "./membership.js";
