/**
 * Configuration loading and merging logic.
 */

import Conf from "conf";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

import { CONFIG_FILES, DEFAULT_USER_CONFIG, DEFAULT_USER_CONFIG_FOR_STORE, ENV_VARS } from "./defaults.js";
import {
  MergedConfigSchema,
  ProjectConfigSchema,
  UserConfigSchema,
  type CliOverrides,
  type Config,
  type PartialUserConfig,
  type ProjectConfig,
  type UserConfig,
} from "./schemas.js";

/**
 * Configuration error with helpful message.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly cause?: Error,
  ) {
    super(`Configuration error in ${source}: ${message}`);
    this.name = "ConfigError";
  }
}

/**
 * Find the git repository root by walking up from the given directory.
 * Returns undefined if no .git directory is found.
 */
export function findRepoRoot(startDir: string = process.cwd()): string | undefined {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const gitDir = path.join(currentDir, ".git");
    if (fs.existsSync(gitDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return undefined;
}

/**
 * User config store using the `conf` package.
 * This handles the ~/.spectree/config.json file.
 */
let userConfigStore: Conf<UserConfig> | undefined;

function getUserConfigStore(): Conf<UserConfig> {
  if (!userConfigStore) {
    userConfigStore = new Conf<UserConfig>({
      projectName: "spectree",
      configName: "config",
      defaults: DEFAULT_USER_CONFIG,
      schema: {
        apiUrl: { type: "string" },
        defaultTeam: { type: "string" },
        maxConcurrentAgents: { type: "number", minimum: 1, maximum: 10 },
        autoMerge: { type: "boolean" },
        branchPrefix: { type: "string" },
        claude: {
          type: "object",
          properties: {
            model: { type: "string" },
            claudePath: { type: "string" },
            skipPermissions: { type: "boolean" },
          },
        },
      },
    });
  }
  return userConfigStore;
}

/**
 * Load user configuration from ~/.spectree/config.json.
 * Creates default config if it doesn't exist.
 */
export function loadUserConfig(): UserConfig {
  const store = getUserConfigStore();

  // Get all config values from store
  const config: UserConfig = {
    apiUrl: store.get("apiUrl"),
    defaultTeam: store.get("defaultTeam"),
    maxConcurrentAgents: store.get("maxConcurrentAgents"),
    autoMerge: store.get("autoMerge"),
    branchPrefix: store.get("branchPrefix"),
    claude: store.get("claude"),
  };

  // Validate with Zod
  try {
    return UserConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ConfigError(issues, "user config (~/.spectree/config.json)", error);
    }
    throw error;
  }
}

/**
 * Load project configuration from .spectree.json in the repo root.
 * Returns undefined if file doesn't exist or repo root not found.
 */
export function loadProjectConfig(repoRoot?: string): ProjectConfig | undefined {
  const root = repoRoot ?? findRepoRoot();
  if (!root) {
    return undefined;
  }

  const configPath = path.join(root, CONFIG_FILES.PROJECT);
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return ProjectConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON: ${error.message}`, ".spectree.json", error);
    }
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ConfigError(issues, ".spectree.json", error);
    }
    throw error;
  }
}

/**
 * Load configuration from environment variables.
 * Returns an object with only the env vars that are set.
 */
export function loadEnvConfig(): Partial<Config> {
  const env: Partial<Config> = {};

  if (process.env[ENV_VARS.API_URL]) {
    env.apiUrl = process.env[ENV_VARS.API_URL]!;
  }

  if (process.env[ENV_VARS.DEFAULT_TEAM]) {
    env.defaultTeam = process.env[ENV_VARS.DEFAULT_TEAM];
  }

  if (process.env[ENV_VARS.MAX_AGENTS]) {
    const value = parseInt(process.env[ENV_VARS.MAX_AGENTS]!, 10);
    if (!isNaN(value) && value >= 1 && value <= 10) {
      env.maxConcurrentAgents = value;
    }
  }

  if (process.env[ENV_VARS.AUTO_MERGE]) {
    env.autoMerge = process.env[ENV_VARS.AUTO_MERGE] === "true";
  }

  if (process.env[ENV_VARS.BRANCH_PREFIX]) {
    env.branchPrefix = process.env[ENV_VARS.BRANCH_PREFIX]!;
  }

  if (process.env[ENV_VARS.CLAUDE_MODEL]) {
    env.claude = { ...env.claude, model: process.env[ENV_VARS.CLAUDE_MODEL]! } as Config["claude"];
  }

  if (process.env[ENV_VARS.CLAUDE_PATH]) {
    env.claude = { ...env.claude, claudePath: process.env[ENV_VARS.CLAUDE_PATH]! } as Config["claude"];
  }

  return env;
}

/**
 * Merge all configuration sources into a final Config object.
 *
 * Priority (highest to lowest):
 * 1. CLI arguments
 * 2. Environment variables
 * 3. Project config (.spectree.json)
 * 4. User config (~/.spectree/config.json)
 * 5. Default values
 */
export function mergeConfig(cliOverrides?: CliOverrides): Config {
  const repoRoot = findRepoRoot();
  const userConfig = loadUserConfig();
  const projectConfig = loadProjectConfig(repoRoot);
  const envConfig = loadEnvConfig();

  // Start with defaults and user config
  const merged: Config = {
    ...DEFAULT_USER_CONFIG,
    ...userConfig,
    repoRoot,
    validation: {
      enabled: false,
      checkpoint: { enabled: true, tagPrefix: "checkpoint/" },
      smokeTest: { enabled: false, endpoints: [], healthTimeout: 60000 },
      maxRetries: 1,
      dockerComposeFile: "docker-compose.local.yml",
    },
  };

  // Apply project config
  if (projectConfig) {
    if (projectConfig.team) {
      merged.team = projectConfig.team;
    }
    if (projectConfig.testCommand) {
      merged.testCommand = projectConfig.testCommand;
    }
    if (projectConfig.lintCommand) {
      merged.lintCommand = projectConfig.lintCommand;
    }
    if (projectConfig.buildCommand) {
      merged.buildCommand = projectConfig.buildCommand;
    }
  }

  // Apply environment variables
  if (envConfig.apiUrl) {
    merged.apiUrl = envConfig.apiUrl;
  }
  if (envConfig.defaultTeam) {
    merged.defaultTeam = envConfig.defaultTeam;
  }
  if (envConfig.maxConcurrentAgents !== undefined) {
    merged.maxConcurrentAgents = envConfig.maxConcurrentAgents;
  }
  if (envConfig.autoMerge !== undefined) {
    merged.autoMerge = envConfig.autoMerge;
  }
  if (envConfig.branchPrefix) {
    merged.branchPrefix = envConfig.branchPrefix;
  }
  if (envConfig.claude) {
    merged.claude = { ...merged.claude, ...envConfig.claude };
  }

  // Apply CLI overrides (highest priority)
  if (cliOverrides) {
    if (cliOverrides.apiUrl) {
      merged.apiUrl = cliOverrides.apiUrl;
    }
    if (cliOverrides.team) {
      merged.team = cliOverrides.team;
      merged.defaultTeam = cliOverrides.team;
    }
    if (cliOverrides.maxAgents !== undefined) {
      merged.maxConcurrentAgents = cliOverrides.maxAgents;
    }
  }

  // Final validation
  try {
    return MergedConfigSchema.parse(merged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ConfigError(issues, "merged configuration", error);
    }
    throw error;
  }
}

/**
 * Create or reset user config to defaults.
 */
export function createDefaultConfig(): void {
  const store = getUserConfigStore();
  store.clear();
  // Use the version without undefined values for conf package compatibility
  store.set(DEFAULT_USER_CONFIG_FOR_STORE as UserConfig);
}

/**
 * Update user configuration with partial values.
 */
export function updateUserConfig(updates: PartialUserConfig): void {
  const store = getUserConfigStore();
  const current = loadUserConfig();

  const updated: UserConfig = {
    ...current,
    ...updates,
    claude: {
      ...current.claude,
      ...updates.claude,
    },
  };

  // Validate before saving
  try {
    UserConfigSchema.parse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new ConfigError(issues, "config update", error);
    }
    throw error;
  }

  // Filter out undefined values before setting (conf doesn't accept undefined)
  const toStore = Object.fromEntries(
    Object.entries(updated).filter(([, v]) => v !== undefined),
  ) as UserConfig;
  store.set(toStore);
}

/**
 * Get the path to the user config file.
 */
export function getUserConfigPath(): string {
  return getUserConfigStore().path;
}

/**
 * Reset the user config store (useful for testing).
 */
export function resetConfigStore(): void {
  userConfigStore = undefined;
}
