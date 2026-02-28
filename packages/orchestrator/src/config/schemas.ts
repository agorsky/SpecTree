/**
 * Zod schemas and TypeScript types for configuration validation.
 */

import { z } from "zod";

/**
 * Schema for Claude Code configuration.
 */
export const ClaudeConfigSchema = z.object({
  model: z.string().default("sonnet"),
  claudePath: z.string().default("claude"),
  skipPermissions: z.boolean().default(true),
});

/** @deprecated Use ClaudeConfigSchema */
export const CopilotConfigSchema = ClaudeConfigSchema;

/**
 * Schema for user configuration (~/.spectree/config.json).
 */
export const UserConfigSchema = z.object({
  apiUrl: z.string().url().default("http://localhost:3001"),
  defaultTeam: z.string().optional(),
  maxConcurrentAgents: z.number().int().min(1).max(10).default(4),
  autoMerge: z.boolean().default(true),
  branchPrefix: z.string().default("feature/"),
  claude: ClaudeConfigSchema.default({}),
});

/**
 * Schema for project configuration (.spectree.json in repo root).
 */
export const ProjectConfigSchema = z.object({
  team: z.string().optional(),
  testCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  buildCommand: z.string().optional(),
});

/**
 * Schema for CLI argument overrides.
 */
export const CliOverridesSchema = z.object({
  apiUrl: z.string().url().optional(),
  team: z.string().optional(),
  maxAgents: z.number().int().min(1).max(10).optional(),
});

/**
 * Schema for checkpoint configuration (ENG-43).
 */
export const CheckpointConfigSchema = z.object({
  enabled: z.boolean().default(true),
  tagPrefix: z.string().default("checkpoint/"),
});

/**
 * Schema for smoke test endpoint checks (ENG-46).
 */
export const SmokeTestEndpointSchema = z.object({
  url: z.string(),
  expectedStatus: z.number().int().default(200),
  label: z.string().optional(),
});

/**
 * Schema for smoke test configuration (ENG-46).
 */
export const SmokeTestConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoints: z.array(SmokeTestEndpointSchema).default([]),
  healthTimeout: z.number().int().default(60000),
});

/**
 * Schema for post-execution validation configuration (ENG-43–48).
 */
export const ValidationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  checkpoint: CheckpointConfigSchema.default({}),
  smokeTest: SmokeTestConfigSchema.default({}),
  maxRetries: z.number().int().min(0).max(3).default(1),
  dockerComposeFile: z.string().default("docker-compose.local.yml"),
});

/**
 * Schema for Barney audit hook configuration (ENG-73).
 */
export const BarneyAuditConfigSchema = z.object({
  enabled: z.boolean().default(false),
  scriptPath: z.string().default("~/clawd/bin/barney-dispatcher.js"),
});

/**
 * Schema for post-feature hook configuration (ENG-73).
 */
export const PostFeatureHooksSchema = z.object({
  barneyAudit: BarneyAuditConfigSchema.default({}),
});

/**
 * Schema for the fully merged configuration.
 */
export const MergedConfigSchema = z.object({
  // From user config
  apiUrl: z.string().url(),
  defaultTeam: z.string().optional(),
  maxConcurrentAgents: z.number().int().min(1).max(10),
  autoMerge: z.boolean(),
  branchPrefix: z.string(),
  claude: ClaudeConfigSchema,

  // From project config
  team: z.string().optional(),
  testCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  buildCommand: z.string().optional(),

  // Validation pipeline (ENG-43–48)
  validation: ValidationConfigSchema.default({}),

  // Post-feature hooks (ENG-73)
  postFeatureHooks: PostFeatureHooksSchema.default({}),

  // Computed
  repoRoot: z.string().optional(),
});

// TypeScript types derived from schemas
export type ClaudeConfig = z.infer<typeof ClaudeConfigSchema>;
/** @deprecated Use ClaudeConfig */
export type CopilotConfig = ClaudeConfig;
export type UserConfig = z.infer<typeof UserConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type CliOverrides = z.infer<typeof CliOverridesSchema>;
export type Config = z.infer<typeof MergedConfigSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;
export type SmokeTestConfig = z.infer<typeof SmokeTestConfigSchema>;
export type SmokeTestEndpoint = z.infer<typeof SmokeTestEndpointSchema>;
export type BarneyAuditConfig = z.infer<typeof BarneyAuditConfigSchema>;
export type PostFeatureHooksConfig = z.infer<typeof PostFeatureHooksSchema>;

/**
 * Partial user config for updates.
 */
export type PartialUserConfig = Partial<
  Omit<UserConfig, "claude"> & { claude?: Partial<ClaudeConfig> }
>;
