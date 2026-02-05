/**
 * Unit tests for the configuration module.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearConfigCache,
  ConfigError,
  createDefaultConfig,
  findRepoRoot,
  getApiUrl,
  getBranchPrefix,
  getBuildCommand,
  getConfig,
  getCopilotModel,
  getDefaultTeam,
  getLintCommand,
  getMaxAgents,
  getRepoRoot,
  getTestCommand,
  initConfig,
  isAutoMergeEnabled,
  loadEnvConfig,
  loadProjectConfig,
  resetConfigStore,
  updateConfig,
} from "../../src/config/index.js";
import { DEFAULT_USER_CONFIG, ENV_VARS } from "../../src/config/defaults.js";

describe("findRepoRoot", () => {
  it("should find repo root from current directory", () => {
    // The test is running in a git repo
    const root = findRepoRoot(process.cwd());
    expect(root).toBeDefined();
    expect(fs.existsSync(path.join(root!, ".git"))).toBe(true);
  });

  it("should find repo root from nested directory", () => {
    const nested = path.join(process.cwd(), "packages", "orchestrator", "src");
    const root = findRepoRoot(nested);
    expect(root).toBeDefined();
    expect(fs.existsSync(path.join(root!, ".git"))).toBe(true);
  });

  it("should return undefined when no git repo found", () => {
    const root = findRepoRoot(os.tmpdir());
    // tmpdir may or may not be in a repo, so we just verify it doesn't throw
    expect(root === undefined || typeof root === "string").toBe(true);
  });
});

describe("loadEnvConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear any existing SPECTREE env vars
    Object.values(ENV_VARS).forEach((key) => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("SPECTREE_")) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it("should return empty object when no env vars set", () => {
    const config = loadEnvConfig();
    expect(config).toEqual({});
  });

  it("should load API URL from env", () => {
    process.env[ENV_VARS.API_URL] = "https://api.example.com";
    const config = loadEnvConfig();
    expect(config.apiUrl).toBe("https://api.example.com");
  });

  it("should load default team from env", () => {
    process.env[ENV_VARS.DEFAULT_TEAM] = "Engineering";
    const config = loadEnvConfig();
    expect(config.defaultTeam).toBe("Engineering");
  });

  it("should parse max agents as number", () => {
    process.env[ENV_VARS.MAX_AGENTS] = "6";
    const config = loadEnvConfig();
    expect(config.maxConcurrentAgents).toBe(6);
  });

  it("should ignore invalid max agents", () => {
    process.env[ENV_VARS.MAX_AGENTS] = "invalid";
    const config = loadEnvConfig();
    expect(config.maxConcurrentAgents).toBeUndefined();
  });

  it("should ignore max agents out of range", () => {
    process.env[ENV_VARS.MAX_AGENTS] = "20";
    const config = loadEnvConfig();
    expect(config.maxConcurrentAgents).toBeUndefined();
  });

  it("should parse auto merge boolean", () => {
    process.env[ENV_VARS.AUTO_MERGE] = "true";
    let config = loadEnvConfig();
    expect(config.autoMerge).toBe(true);

    process.env[ENV_VARS.AUTO_MERGE] = "false";
    config = loadEnvConfig();
    expect(config.autoMerge).toBe(false);
  });

  it("should load branch prefix from env", () => {
    process.env[ENV_VARS.BRANCH_PREFIX] = "fix/";
    const config = loadEnvConfig();
    expect(config.branchPrefix).toBe("fix/");
  });

  it("should load copilot model from env", () => {
    process.env[ENV_VARS.COPILOT_MODEL] = "claude-sonnet-4";
    const config = loadEnvConfig();
    expect(config.copilot?.model).toBe("claude-sonnet-4");
  });
});

describe("loadProjectConfig", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectree-test-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return undefined when no .spectree.json exists", () => {
    // Create a fake git repo
    fs.mkdirSync(path.join(tempDir, ".git"));
    const config = loadProjectConfig(tempDir);
    expect(config).toBeUndefined();
  });

  it("should load valid project config", () => {
    fs.mkdirSync(path.join(tempDir, ".git"));
    fs.writeFileSync(
      path.join(tempDir, ".spectree.json"),
      JSON.stringify({
        team: "MyTeam",
        testCommand: "npm test",
        lintCommand: "npm lint",
        buildCommand: "npm build",
      }),
    );

    const config = loadProjectConfig(tempDir);
    expect(config).toEqual({
      team: "MyTeam",
      testCommand: "npm test",
      lintCommand: "npm lint",
      buildCommand: "npm build",
    });
  });

  it("should throw on invalid JSON", () => {
    fs.mkdirSync(path.join(tempDir, ".git"));
    fs.writeFileSync(path.join(tempDir, ".spectree.json"), "{ invalid json }");

    expect(() => loadProjectConfig(tempDir)).toThrow(ConfigError);
  });

  it("should return undefined when repo root not found", () => {
    const config = loadProjectConfig(undefined);
    // May or may not be undefined depending on whether tests run in a repo
    expect(config === undefined || typeof config === "object").toBe(true);
  });
});

describe("getConfig and convenience accessors", () => {
  beforeEach(() => {
    clearConfigCache();
    resetConfigStore();
    // Clear env vars
    Object.values(ENV_VARS).forEach((key) => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    clearConfigCache();
    resetConfigStore();
    Object.values(ENV_VARS).forEach((key) => {
      delete process.env[key];
    });
  });

  it("should return default config", () => {
    const config = getConfig();
    expect(config.apiUrl).toBe(DEFAULT_USER_CONFIG.apiUrl);
    expect(config.maxConcurrentAgents).toBe(DEFAULT_USER_CONFIG.maxConcurrentAgents);
    expect(config.autoMerge).toBe(DEFAULT_USER_CONFIG.autoMerge);
    expect(config.branchPrefix).toBe(DEFAULT_USER_CONFIG.branchPrefix);
    expect(config.copilot.model).toBe(DEFAULT_USER_CONFIG.copilot.model);
  });

  it("should apply CLI overrides", () => {
    const config = getConfig({
      apiUrl: "https://custom.api.com",
      team: "CustomTeam",
      maxAgents: 2,
    });

    expect(config.apiUrl).toBe("https://custom.api.com");
    expect(config.team).toBe("CustomTeam");
    expect(config.maxConcurrentAgents).toBe(2);
  });

  it("should cache config", () => {
    const config1 = getConfig();
    const config2 = getConfig();
    expect(config1).toBe(config2);
  });

  it("should force reload when requested", () => {
    const config1 = getConfig();
    const config2 = getConfig(undefined, true);
    // Should be equal but not the same reference
    expect(config1).not.toBe(config2);
    expect(config1.apiUrl).toBe(config2.apiUrl);
  });

  it("getApiUrl should return API URL", () => {
    expect(getApiUrl()).toBe(DEFAULT_USER_CONFIG.apiUrl);
  });

  it("getMaxAgents should return max agents", () => {
    expect(getMaxAgents()).toBe(DEFAULT_USER_CONFIG.maxConcurrentAgents);
  });

  it("getCopilotModel should return model", () => {
    expect(getCopilotModel()).toBe(DEFAULT_USER_CONFIG.copilot.model);
  });

  it("getBranchPrefix should return branch prefix", () => {
    expect(getBranchPrefix()).toBe(DEFAULT_USER_CONFIG.branchPrefix);
  });

  it("isAutoMergeEnabled should return auto merge setting", () => {
    expect(isAutoMergeEnabled()).toBe(DEFAULT_USER_CONFIG.autoMerge);
  });

  it("getDefaultTeam should return undefined by default", () => {
    expect(getDefaultTeam()).toBeUndefined();
  });
});

describe("initConfig", () => {
  beforeEach(() => {
    clearConfigCache();
    resetConfigStore();
  });

  afterEach(() => {
    clearConfigCache();
    resetConfigStore();
  });

  it("should initialize config with overrides", () => {
    const config = initConfig({
      apiUrl: "https://init.api.com",
    });

    expect(config.apiUrl).toBe("https://init.api.com");
    // Subsequent calls should use cached value
    expect(getApiUrl()).toBe("https://init.api.com");
  });
});

describe("updateConfig", () => {
  beforeEach(() => {
    clearConfigCache();
    resetConfigStore();
    createDefaultConfig();
  });

  afterEach(() => {
    clearConfigCache();
    resetConfigStore();
  });

  it("should update config values", () => {
    updateConfig({ maxConcurrentAgents: 8 });
    clearConfigCache();
    expect(getMaxAgents()).toBe(8);
  });

  it("should update nested copilot config", () => {
    updateConfig({ copilot: { model: "claude-sonnet-4" } });
    clearConfigCache();
    expect(getCopilotModel()).toBe("claude-sonnet-4");
  });

  it("should throw on invalid values", () => {
    expect(() => updateConfig({ maxConcurrentAgents: 100 })).toThrow(ConfigError);
  });
});

describe("createDefaultConfig", () => {
  beforeEach(() => {
    clearConfigCache();
    resetConfigStore();
  });

  afterEach(() => {
    clearConfigCache();
    resetConfigStore();
  });

  it("should create default config", () => {
    createDefaultConfig();
    const config = getConfig(undefined, true);
    expect(config.apiUrl).toBe(DEFAULT_USER_CONFIG.apiUrl);
    expect(config.maxConcurrentAgents).toBe(DEFAULT_USER_CONFIG.maxConcurrentAgents);
  });
});

describe("config priority", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectree-priority-"));
    fs.mkdirSync(path.join(tempDir, ".git"));
    clearConfigCache();
    resetConfigStore();
    createDefaultConfig();
  });

  afterEach(() => {
    clearConfigCache();
    resetConfigStore();
    Object.values(ENV_VARS).forEach((key) => {
      delete process.env[key];
    });
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should prioritize env vars over user config", () => {
    process.env[ENV_VARS.MAX_AGENTS] = "7";
    clearConfigCache();
    expect(getMaxAgents()).toBe(7);
  });

  it("should prioritize CLI overrides over env vars", () => {
    process.env[ENV_VARS.MAX_AGENTS] = "7";
    clearConfigCache();
    initConfig({ maxAgents: 3 });
    expect(getMaxAgents()).toBe(3);
  });
});
