import { z } from "zod";

/**
 * Validation schemas for Structured Description entities.
 * 
 * Structured descriptions provide AI-friendly sections for easier data extraction
 * instead of unstructured freeform text.
 */

/**
 * Valid risk levels
 */
export const riskLevelValues = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof riskLevelValues)[number];

/**
 * Valid estimated effort levels
 */
export const estimatedEffortValues = ["trivial", "small", "medium", "large", "xl"] as const;
export type EstimatedEffort = (typeof estimatedEffortValues)[number];

/**
 * External link schema
 */
export const externalLinkSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().min(1).max(255),
});

export type ExternalLink = z.infer<typeof externalLinkSchema>;

/**
 * Full Structured Description schema
 * All fields are optional except summary to maximize flexibility
 */
export const structuredDescriptionSchema = z.object({
  // Human-readable summary (required)
  summary: z.string().min(1).max(5000).describe(
    "Human-readable summary of the feature or task"
  ),
  
  // AI-specific instructions
  aiInstructions: z.string().max(10000).optional().describe(
    "Instructions specifically for AI agents working on this item"
  ),
  
  // Clear success criteria
  acceptanceCriteria: z.array(z.string().max(1000)).max(50).optional().describe(
    "List of acceptance criteria that define when this item is complete"
  ),
  
  // Code context
  filesInvolved: z.array(z.string().max(500)).max(100).optional().describe(
    "List of file paths involved in this work (e.g., 'src/services/user.ts')"
  ),
  functionsToModify: z.array(z.string().max(500)).max(100).optional().describe(
    "List of functions to modify in format 'filepath:functionName'"
  ),
  
  // Testing
  testingStrategy: z.string().max(5000).optional().describe(
    "Description of the testing approach for this item"
  ),
  testFiles: z.array(z.string().max(500)).max(100).optional().describe(
    "List of test files relevant to this work"
  ),
  
  // References
  relatedItemIds: z.array(z.string().max(50)).max(50).optional().describe(
    "IDs of related features/tasks (e.g., 'COM-123', 'COM-45-1')"
  ),
  externalLinks: z.array(externalLinkSchema).max(50).optional().describe(
    "External documentation, PRs, or reference links"
  ),
  
  // Technical notes
  technicalNotes: z.string().max(10000).optional().describe(
    "Technical implementation notes, architectural decisions, caveats"
  ),
  
  // Risk/complexity assessment
  riskLevel: z.enum(riskLevelValues).optional().describe(
    "Risk assessment: 'low', 'medium', or 'high'"
  ),
  estimatedEffort: z.enum(estimatedEffortValues).optional().describe(
    "Effort estimate: 'trivial' (<1hr), 'small' (1-4hr), 'medium' (1-2 days), 'large' (3-5 days), 'xl' (>5 days)"
  ),
});

export type StructuredDescription = z.infer<typeof structuredDescriptionSchema>;

/**
 * Partial schema for updates - all fields optional
 */
export const structuredDescriptionPartialSchema = structuredDescriptionSchema.partial();

export type StructuredDescriptionPartial = z.infer<typeof structuredDescriptionPartialSchema>;

/**
 * Schema for updating a specific section of the structured description
 */
export const updateSectionSchema = z.object({
  section: z.enum([
    "summary",
    "aiInstructions",
    "acceptanceCriteria",
    "filesInvolved",
    "functionsToModify",
    "testingStrategy",
    "testFiles",
    "relatedItemIds",
    "externalLinks",
    "technicalNotes",
    "riskLevel",
    "estimatedEffort",
  ]).describe("The section to update"),
  value: z.unknown().describe("The new value for the section (type depends on section)"),
});

export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

/**
 * Schema for adding an acceptance criterion
 */
export const addAcceptanceCriterionSchema = z.object({
  criterion: z.string().min(1).max(1000).describe(
    "The acceptance criterion to add"
  ),
});

export type AddAcceptanceCriterionInput = z.infer<typeof addAcceptanceCriterionSchema>;

/**
 * Schema for linking a file
 */
export const linkFileSchema = z.object({
  filePath: z.string().min(1).max(500).describe(
    "The file path to link (e.g., 'src/services/user.ts')"
  ),
});

export type LinkFileInput = z.infer<typeof linkFileSchema>;

/**
 * Schema for adding an external link
 */
export const addExternalLinkSchema = z.object({
  url: z.string().url().max(2048).describe("The URL to link"),
  title: z.string().min(1).max(255).describe("The title/description of the link"),
});

export type AddExternalLinkInput = z.infer<typeof addExternalLinkSchema>;

/**
 * Valid section names for type-safe operations
 */
export const structuredDescriptionSectionNames = [
  "summary",
  "aiInstructions",
  "acceptanceCriteria",
  "filesInvolved",
  "functionsToModify",
  "testingStrategy",
  "testFiles",
  "relatedItemIds",
  "externalLinks",
  "technicalNotes",
  "riskLevel",
  "estimatedEffort",
] as const;

export type StructuredDescriptionSection = (typeof structuredDescriptionSectionNames)[number];
