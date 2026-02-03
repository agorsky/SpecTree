/**
 * Central export for all validation schemas.
 * Import from this file for convenient access to all schemas.
 */

// Common schemas
export {
  uuidParamSchema,
  flexibleIdParamSchema,
  paginationQuerySchema,
  searchQuerySchema,
  dateFilterQuerySchema,
  statusFilterQuerySchema,
  assigneeFilterQuerySchema,
  STATUS_CATEGORIES,
  type UuidParam,
  type PaginationQuery,
  type SearchQuery,
  type DateFilterQuery,
  type StatusFilterQuery,
  type AssigneeFilterQuery,
  type StatusCategory as CommonStatusCategory,
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

// Epic schemas
export {
  createEpicSchema,
  updateEpicSchema,
  type CreateEpicInput,
  type UpdateEpicInput,
} from "./epic.js";

// Feature schemas
export {
  listFeaturesQuerySchema,
  createFeatureSchema,
  updateFeatureSchema,
  type ListFeaturesQuery,
  type CreateFeatureInput,
  type UpdateFeatureInput,
} from "./feature.js";

// Task schemas
export {
  listTasksQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  reorderTaskSchema,
  type ListTasksQuery,
  type CreateTaskInput,
  type UpdateTaskInput,
  type ReorderTaskInput,
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

// AI Context schemas
export {
  aiNoteTypeValues,
  aiNoteSchema,
  entityTypeValues,
  appendAiNoteSchema,
  setAiContextSchema,
  aiContextResponseSchema,
  type AiNoteType,
  type AiNote,
  type EntityType,
  type AppendAiNoteInput,
  type SetAiContextInput,
  type AiContextResponse,
} from "./aiContext.js";

// Structured Description schemas
export {
  riskLevelValues,
  estimatedEffortValues,
  externalLinkSchema,
  structuredDescriptionSchema,
  structuredDescriptionPartialSchema,
  updateSectionSchema,
  addAcceptanceCriterionSchema,
  linkFileSchema,
  addExternalLinkSchema,
  structuredDescriptionSectionNames,
  type RiskLevel,
  type EstimatedEffort,
  type ExternalLink,
  type StructuredDescription,
  type StructuredDescriptionPartial,
  type UpdateSectionInput,
  type AddAcceptanceCriterionInput,
  type LinkFileInput,
  type AddExternalLinkInput,
  type StructuredDescriptionSection,
} from "./structuredDescription.js";

// Code Context schemas
export {
  linkCodeFileSchema,
  unlinkCodeFileSchema,
  linkFunctionSchema,
  linkBranchSchema,
  linkCommitSchema,
  linkPrSchema,
  codeContextSchema,
  codeContextResponseSchema,
  type LinkCodeFileInput,
  type UnlinkCodeFileInput,
  type LinkFunctionInput,
  type LinkBranchInput,
  type LinkCommitInput,
  type LinkPrInput,
  type CodeContext,
  type CodeContextResponse,
} from "./codeContext.js";

// Validation Checklist schemas
export {
  validationCheckTypeValues,
  validationCheckStatusValues,
  addValidationCheckSchema,
  runValidationSchema,
  runAllValidationsSchema,
  markManualValidatedSchema,
  removeValidationCheckSchema,
  type ValidationCheckType,
  type ValidationCheckStatus,
  type ValidationCheck,
  type AddValidationCheckInput,
  type RunValidationInput,
  type RunAllValidationsInput,
  type MarkManualValidatedInput,
  type RemoveValidationCheckInput,
  type ValidationCheckResult,
  type RunAllValidationsResult,
  type ListValidationsResult,
} from "./validation.js";

// Summary schemas
export {
  blockedItemSchema,
  actionableItemSchema,
  recentlyCompletedItemSchema,
  lastSessionSummarySchema,
  progressSummarySchema,
  myWorkItemSchema,
  myWorkResponseSchema,
  blockedSummaryItemSchema,
  blockedSummaryResponseSchema,
  type BlockedItem,
  type ActionableItem,
  type RecentlyCompletedItem,
  type LastSessionSummary,
  type ProgressSummary,
  type MyWorkItem,
  type MyWorkResponse,
  type BlockedSummaryItem,
  type BlockedSummaryResponse,
} from "./summary.js";

// Composite Epic schemas
export {
  estimatedComplexityValues,
  compositeTaskInputSchema,
  compositeFeatureInputSchema,
  createEpicCompleteInputSchema,
  type EstimatedComplexity,
  type CompositeTaskInput,
  type CompositeFeatureInput,
  type CreateEpicCompleteInput,
  type CompositeTaskResponse,
  type CompositeFeatureResponse,
  type CreateEpicCompleteResponse,
} from "./compositeEpic.js";
