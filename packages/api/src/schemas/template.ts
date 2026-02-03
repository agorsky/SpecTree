import { z } from "zod";

/**
 * Validation schemas for PlanTemplate entities.
 * Templates define reusable structures for creating epics with features and tasks.
 */

// =============================================================================
// Template Structure Types (JSON stored in database)
// =============================================================================

/**
 * Structured description template for features and tasks.
 * Supports {{variable}} placeholders in string fields.
 */
export const structuredDescTemplateSchema = z.object({
  summary: z.string().optional().describe("Brief human-readable summary"),
  acceptanceCriteria: z.array(z.string()).optional().describe("List of acceptance criteria"),
  aiInstructions: z.string().optional().describe("Instructions for AI agents"),
  filesInvolved: z.array(z.string()).optional().describe("File paths involved"),
  functionsToModify: z.array(z.string()).optional().describe("Functions to modify (file:function format)"),
  testFiles: z.array(z.string()).optional().describe("Test file paths"),
  technicalNotes: z.string().optional().describe("Technical implementation notes"),
  riskLevel: z.enum(["low", "medium", "high"]).optional().describe("Risk assessment"),
  estimatedEffort: z.enum(["trivial", "small", "medium", "large", "xl"]).optional().describe("Effort estimate"),
});

/**
 * Task within a feature template
 */
export const templateTaskSchema = z.object({
  titleTemplate: z
    .string()
    .min(1)
    .describe("Title template with {{variable}} placeholders"),
  descriptionPrompt: z
    .string()
    .optional()
    .describe("Hint for what to put in description"),
  executionOrder: z.number().int().min(1).describe("Order within the feature"),
  estimatedComplexity: z
    .enum(["trivial", "simple", "moderate", "complex"])
    .optional()
    .describe("Complexity estimate for the task"),
  structuredDescTemplate: structuredDescTemplateSchema
    .optional()
    .describe("Structured description with {{variable}} placeholders"),
});

/**
 * Feature within an epic template
 */
export const templateFeatureSchema = z.object({
  titleTemplate: z
    .string()
    .min(1)
    .describe("Title template with {{variable}} placeholders"),
  descriptionPrompt: z
    .string()
    .optional()
    .describe("Hint for what to put in description"),
  executionOrder: z.number().int().min(1).describe("Order within the epic"),
  canParallelize: z.boolean().optional().default(false),
  tasks: z.array(templateTaskSchema).optional(),
  estimatedComplexity: z
    .enum(["trivial", "simple", "moderate", "complex"])
    .optional()
    .describe("Complexity estimate for the feature"),
  structuredDescTemplate: structuredDescTemplateSchema
    .optional()
    .describe("Structured description with {{variable}} placeholders"),
});

/**
 * Epic defaults for template
 */
export const epicDefaultsSchema = z.object({
  icon: z.string().optional(),
  color: z.string().optional(),
  descriptionPrompt: z.string().optional(),
});

/**
 * Complete template structure
 */
export const templateStructureSchema = z.object({
  epicDefaults: epicDefaultsSchema.optional(),
  features: z.array(templateFeatureSchema).min(1),
});

// =============================================================================
// API Request/Response Schemas
// =============================================================================

/**
 * Schema for creating a new template
 */
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  structure: templateStructureSchema,
});

/**
 * Schema for updating an existing template (name and structure can be updated)
 */
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  structure: templateStructureSchema.optional(),
});

/**
 * Schema for previewing a template with variables
 */
export const previewTemplateSchema = z.object({
  templateName: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
});

/**
 * Schema for creating from a template
 */
export const createFromTemplateSchema = z.object({
  templateName: z.string().min(1),
  epicName: z.string().min(1).max(255),
  teamId: z.string().uuid("Invalid team ID"),
  variables: z.record(z.string(), z.string()).optional(),
  epicDescription: z.string().optional(),
  epicIcon: z.string().optional(),
  epicColor: z.string().optional(),
});

/**
 * Schema for saving an epic as a template
 */
export const saveAsTemplateSchema = z.object({
  epicId: z.string().uuid("Invalid epic ID"),
  templateName: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type StructuredDescTemplate = z.infer<typeof structuredDescTemplateSchema>;
export type TemplateTask = z.infer<typeof templateTaskSchema>;
export type TemplateFeature = z.infer<typeof templateFeatureSchema>;
export type EpicDefaults = z.infer<typeof epicDefaultsSchema>;
export type TemplateStructure = z.infer<typeof templateStructureSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>;
