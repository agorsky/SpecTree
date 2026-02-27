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

/**
 * Partial user config for updates.
 */
export type PartialUserConfig = Partial<
  Omit<UserConfig, "claude"> & { claude?: Partial<ClaudeConfig> }
>;
