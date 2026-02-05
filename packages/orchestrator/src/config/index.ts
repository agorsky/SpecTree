/**
 * Configuration module for the SpecTree orchestrator CLI.
 *
 * This module provides:
 * - Configuration loading from multiple sources (CLI, env, project, user, defaults)
 * - Configuration merging with proper priority
 * - Type-safe config access via convenience accessors
 * - Config file creation and updates
 *
 * Config Priority (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables (SPECTREE_*)
 * 3. Project config (.spectree.json in repo root)
 * 4. User config (~/.spectree/config.json)
 * 5. Default values
 *
 * @example
 * ```typescript
 * import { getConfig, getApiUrl, getCopilotModel } from './config';
 *
 * // Get full merged config
 * const config = getConfig();
 *
 * // Or use convenience accessors
 * const apiUrl = getApiUrl();
 * const model = getCopilotModel();
 * ```
 */

import {
  ConfigError,
  createDefaultConfig,
  findRepoRoot,
  getUserConfigPath,
  loadEnvConfig,
  loadProjectConfig,
  loadUserConfig,
  mergeConfig,
  resetConfigStore,
  updateUserConfig,
} from "./loader.js";
import type { CliOverrides, Config, PartialUserConfig, ProjectConfig, UserConfig } from "./schemas.js";

// Cached config instance
let cachedConfig: Config | undefined;
let cachedCliOverrides: CliOverrides | undefined;

/**
 * Get the fully merged configuration.
 *
 * @param cliOverrides - Optional CLI argument overrides. If not provided and a config
 *                       has been cached with CLI overrides (via initConfig), those overrides
 *                       will continue to be used.
 * @param forceReload - Force reloading config (useful after updates)
 * @returns The merged configuration object
 */
export function getConfig(cliOverrides?: CliOverrides, forceReload = false): Config {
  // If new overrides provided, always recalculate
  if (cliOverrides !== undefined) {
    cachedConfig = mergeConfig(cliOverrides);
    cachedCliOverrides = cliOverrides;
    return cachedConfig;
  }

  // If no overrides and we have a cached config (possibly with overrides), use it
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  // First call or force reload - use any cached overrides
  cachedConfig = mergeConfig(cachedCliOverrides);
  return cachedConfig;
}

/**
 * Get the API URL.
 */
export function getApiUrl(): string {
  return getConfig().apiUrl;
}

/**
 * Get the default team name (from user or project config).
 * Returns the project team if set, otherwise the user's default team.
 */
export function getDefaultTeam(): string | undefined {
  const config = getConfig();
  return config.team ?? config.defaultTeam;
}

/**
 * Get the maximum number of concurrent agents.
 */
export function getMaxAgents(): number {
  return getConfig().maxConcurrentAgents;
}

/**
 * Get the Copilot model to use.
 */
export function getCopilotModel(): string {
  return getConfig().copilot.model;
}

/**
 * Get the branch prefix for feature branches.
 */
export function getBranchPrefix(): string {
  return getConfig().branchPrefix;
}

/**
 * Check if auto-merge is enabled.
 */
export function isAutoMergeEnabled(): boolean {
  return getConfig().autoMerge;
}

/**
 * Get the repository root directory.
 */
export function getRepoRoot(): string | undefined {
  return getConfig().repoRoot;
}

/**
 * Get the test command for the project.
 */
export function getTestCommand(): string | undefined {
  return getConfig().testCommand;
}

/**
 * Get the lint command for the project.
 */
export function getLintCommand(): string | undefined {
  return getConfig().lintCommand;
}

/**
 * Get the build command for the project.
 */
export function getBuildCommand(): string | undefined {
  return getConfig().buildCommand;
}

/**
 * Initialize configuration with CLI overrides.
 * Call this at CLI startup to apply command-line arguments.
 */
export function initConfig(cliOverrides?: CliOverrides): Config {
  return getConfig(cliOverrides, true);
}

/**
 * Update user configuration.
 * @param updates - Partial config updates to apply
 */
export function updateConfig(updates: PartialUserConfig): void {
  updateUserConfig(updates);
  // Invalidate cache
  cachedConfig = undefined;
}

/**
 * Clear the config cache.
 * Useful for testing or when config files have been modified externally.
 */
export function clearConfigCache(): void {
  cachedConfig = undefined;
  cachedCliOverrides = undefined;
}

// Re-export types and utilities
export type { CliOverrides, Config, PartialUserConfig, ProjectConfig, UserConfig };
export {
  ConfigError,
  createDefaultConfig,
  findRepoRoot,
  getUserConfigPath,
  loadEnvConfig,
  loadProjectConfig,
  loadUserConfig,
  resetConfigStore,
};
