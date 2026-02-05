/**
 * Default configuration values for the SpecTree orchestrator CLI.
 */

import type { UserConfig } from "./schemas.js";

/**
 * Default values for user configuration (without optional fields with undefined).
 * These are used when no config file exists or values are missing.
 * Note: We don't include `defaultTeam` because it's optional and `conf` doesn't accept undefined.
 */
export const DEFAULT_USER_CONFIG_FOR_STORE: Omit<UserConfig, "defaultTeam"> = {
  apiUrl: "http://localhost:3001",
  maxConcurrentAgents: 4,
  autoMerge: true,
  branchPrefix: "feature/",
  copilot: {
    model: "gpt-4.1",
  },
};

/**
 * Full default user config including optional fields.
 */
export const DEFAULT_USER_CONFIG: UserConfig = {
  ...DEFAULT_USER_CONFIG_FOR_STORE,
  defaultTeam: undefined,
};

/**
 * Environment variable names for config overrides.
 */
export const ENV_VARS = {
  API_URL: "SPECTREE_API_URL",
  DEFAULT_TEAM: "SPECTREE_DEFAULT_TEAM",
  MAX_AGENTS: "SPECTREE_MAX_AGENTS",
  AUTO_MERGE: "SPECTREE_AUTO_MERGE",
  BRANCH_PREFIX: "SPECTREE_BRANCH_PREFIX",
  COPILOT_MODEL: "SPECTREE_COPILOT_MODEL",
} as const;

/**
 * File names for config files.
 */
export const CONFIG_FILES = {
  PROJECT: ".spectree.json",
  USER_DIR: ".spectree",
  USER_FILE: "config.json",
} as const;
