/**
 * Unit tests for Manifest Parsing and Validation Utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseManifest,
  safeParseManifest,
  loadManifestFromFile,
  safeLoadManifestFromFile,
  validateManifest,
  safeValidateManifest,
  normalizePackName,
  summarizeManifest,
  ManifestParseError,
  ManifestValidationError,
} from "../manifest-utils.js";
import type { SkillPackManifest } from "../schema.js";

describe("parseManifest", () => {
  const validManifestJson = JSON.stringify({
    name: "test-pack",
    version: "1.0.0",
    displayName: "Test Pack",
    description: "A test skill pack",
  });

  it("should parse valid manifest JSON", () => {
    const manifest = parseManifest(validManifestJson);
    expect(manifest.name).toBe("test-pack");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.displayName).toBe("Test Pack");
  });

  it("should throw ManifestParseError for invalid JSON", () => {
    const invalidJson = "{ invalid json }";
    expect(() => parseManifest(invalidJson)).toThrow(ManifestParseError);
  });

  it("should throw ManifestValidationError for invalid manifest", () => {
    const invalidManifest = JSON.stringify({
      name: "Invalid Name", // Invalid: has space
      version: "1.0.0",
      displayName: "Test",
      description: "Test",
    });
    expect(() => parseManifest(invalidManifest)).toThrow(ManifestValidationError);
  });

  it("should include validation errors in exception", () => {
    const invalidManifest = JSON.stringify({
      name: "test-pack",
      version: "invalid", // Invalid version
      displayName: "Test",
      description: "Test",
    });

    try {
      parseManifest(invalidManifest);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestValidationError);
      if (err instanceof ManifestValidationError) {
        expect(err.validationErrors.length).toBeGreaterThan(0);
        expect(err.validationErrors[0]).toContain("version");
      }
    }
  });
});

describe("safeParseManifest", () => {
  const validManifestJson = JSON.stringify({
    name: "test-pack",
    version: "1.0.0",
    displayName: "Test Pack",
    description: "A test skill pack",
  });

  it("should return success for valid manifest", () => {
    const result = safeParseManifest(validManifestJson);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test-pack");
    }
  });

  it("should return error for invalid JSON", () => {
    const result = safeParseManifest("{ invalid }");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("should return error with details for validation failure", () => {
    const invalidManifest = JSON.stringify({
      name: "test-pack",
      version: "invalid",
      displayName: "Test",
      description: "Test",
    });
    const result = safeParseManifest(invalidManifest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.details).toBeDefined();
      expect(result.details?.length).toBeGreaterThan(0);
    }
  });
});

describe("loadManifestFromFile and safeLoadManifestFromFile", () => {
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `spectree-test-${String(Date.now())}`);
    await mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, "manifest.json");
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it("should load and parse valid manifest file", async () => {
    const manifest: SkillPackManifest = {
      name: "test-pack",
      version: "1.0.0",
      displayName: "Test Pack",
      description: "Test",
      agents: [],
      skills: [],
      instructions: [],
      mcpServers: [],
    };
    await writeFile(testFilePath, JSON.stringify(manifest, null, 2));

    const loaded = await loadManifestFromFile(testFilePath);
    expect(loaded.name).toBe("test-pack");
    expect(loaded.version).toBe("1.0.0");
  });

  it("should throw ManifestParseError for non-existent file", async () => {
    await expect(loadManifestFromFile("/nonexistent/path")).rejects.toThrow(
      ManifestParseError
    );
  });

  it("should throw for invalid manifest in file", async () => {
    await writeFile(testFilePath, JSON.stringify({ invalid: "manifest" }));
    await expect(loadManifestFromFile(testFilePath)).rejects.toThrow();
  });

  it("safeLoadManifestFromFile should return success for valid file", async () => {
    const manifest: SkillPackManifest = {
      name: "test-pack",
      version: "1.0.0",
      displayName: "Test Pack",
      description: "Test",
      agents: [],
      skills: [],
      instructions: [],
      mcpServers: [],
    };
    await writeFile(testFilePath, JSON.stringify(manifest, null, 2));

    const result = await safeLoadManifestFromFile(testFilePath);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test-pack");
    }
  });

  it("safeLoadManifestFromFile should return error for non-existent file", async () => {
    const result = await safeLoadManifestFromFile("/nonexistent/path");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("safeLoadManifestFromFile should return error with details for invalid manifest", async () => {
    await writeFile(testFilePath, JSON.stringify({ name: "Invalid Name" }));
    const result = await safeLoadManifestFromFile(testFilePath);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.details).toBeDefined();
    }
  });
});

describe("validateManifest", () => {
  const validManifest: SkillPackManifest = {
    name: "test-pack",
    version: "1.0.0",
    displayName: "Test Pack",
    description: "Test",
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
  };

  it("should validate a valid manifest object", () => {
    const result = validateManifest(validManifest);
    expect(result.name).toBe("test-pack");
  });

  it("should throw ManifestValidationError for invalid manifest", () => {
    const invalid = { ...validManifest, name: "Invalid Name" };
    expect(() => validateManifest(invalid)).toThrow(ManifestValidationError);
  });

  it("should include validation errors", () => {
    const invalid = { ...validManifest, version: "invalid" };
    try {
      validateManifest(invalid);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ManifestValidationError);
      if (err instanceof ManifestValidationError) {
        expect(err.validationErrors.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("safeValidateManifest", () => {
  const validManifest: SkillPackManifest = {
    name: "test-pack",
    version: "1.0.0",
    displayName: "Test Pack",
    description: "Test",
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
  };

  it("should return success for valid manifest", () => {
    const result = safeValidateManifest(validManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("test-pack");
    }
  });

  it("should return error for invalid manifest", () => {
    const invalid = { ...validManifest, name: "Invalid Name" };
    const result = safeValidateManifest(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
    }
  });
});

describe("normalizePackName", () => {
  it("should normalize valid names correctly", () => {
    expect(normalizePackName("Test Pack")).toBe("test-pack");
    expect(normalizePackName("my_pack_name")).toBe("my-pack-name");
    expect(normalizePackName("UPPERCASE")).toBe("uppercase");
    expect(normalizePackName("  spaced  ")).toBe("spaced");
    expect(normalizePackName("multiple---hyphens")).toBe("multiple-hyphens");
  });

  it("should handle alphanumeric with hyphens", () => {
    expect(normalizePackName("pack-123")).toBe("pack-123");
    expect(normalizePackName("my-pack-v2")).toBe("my-pack-v2");
  });

  it("should remove invalid characters", () => {
    expect(normalizePackName("pack@name")).toBe("packname");
    expect(normalizePackName("pack.name")).toBe("packname");
    expect(normalizePackName("pack!name#")).toBe("packname");
  });

  it("should remove leading/trailing hyphens", () => {
    expect(normalizePackName("-pack-")).toBe("pack");
    expect(normalizePackName("---pack---")).toBe("pack");
  });

  it("should throw for empty names", () => {
    expect(() => normalizePackName("")).toThrow("cannot be empty");
    expect(() => normalizePackName("   ")).toThrow("cannot be empty");
  });

  it("should throw for names with no valid characters", () => {
    expect(() => normalizePackName("@#$%")).toThrow("no valid characters");
    expect(() => normalizePackName("!!!")).toThrow("no valid characters");
  });

  it("should throw for names that become invalid after normalization", () => {
    expect(() => normalizePackName("-")).toThrow();
    expect(() => normalizePackName("_")).toThrow();
  });

  it("should handle edge cases", () => {
    expect(normalizePackName("a")).toBe("a");
    expect(normalizePackName("a1")).toBe("a1");
    expect(normalizePackName("1a")).toBe("1a");
  });
});

describe("summarizeManifest", () => {
  it("should summarize a minimal manifest", () => {
    const manifest: SkillPackManifest = {
      name: "test-pack",
      version: "1.0.0",
      displayName: "Test Pack",
      description: "A test pack",
      agents: [],
      skills: [],
      instructions: [],
      mcpServers: [],
    };

    const summary = summarizeManifest(manifest);
    expect(summary.name).toBe("test-pack");
    expect(summary.version).toBe("1.0.0");
    expect(summary.displayName).toBe("Test Pack");
    expect(summary.agentCount).toBe(0);
    expect(summary.skillCount).toBe(0);
    expect(summary.instructionCount).toBe(0);
    expect(summary.mcpServerCount).toBe(0);
  });

  it("should summarize a complete manifest", () => {
    const manifest: SkillPackManifest = {
      name: "full-pack",
      version: "2.1.0",
      displayName: "Full Pack",
      description: "A complete pack",
      author: "Test Author",
      agents: [
        {
          id: "agent1",
          name: "Agent 1",
          description: "Test agent",
          role: "worker",
          systemPrompt: "Prompt",
        },
      ],
      skills: [
        {
          id: "skill1",
          name: "Skill 1",
          description: "Test skill",
          instructions: "Instructions",
        },
        {
          id: "skill2",
          name: "Skill 2",
          description: "Test skill 2",
          instructions: "Instructions 2",
        },
      ],
      instructions: [
        {
          id: "inst1",
          name: "Instruction 1",
          content: "Content",
          priority: 50,
        },
      ],
      mcpServers: [
        {
          name: "server1",
          server: { command: "node server.js" },
        },
        {
          name: "server2",
          server: { url: "https://example.com" },
        },
      ],
    };

    const summary = summarizeManifest(manifest);
    expect(summary.name).toBe("full-pack");
    expect(summary.version).toBe("2.1.0");
    expect(summary.author).toBe("Test Author");
    expect(summary.agentCount).toBe(1);
    expect(summary.skillCount).toBe(2);
    expect(summary.instructionCount).toBe(1);
    expect(summary.mcpServerCount).toBe(2);
  });

  it("should handle undefined optional arrays", () => {
    const manifest = {
      name: "minimal-pack",
      version: "1.0.0",
      displayName: "Minimal Pack",
      description: "Minimal",
    } as SkillPackManifest;

    const summary = summarizeManifest(manifest);
    expect(summary.agentCount).toBe(0);
    expect(summary.skillCount).toBe(0);
    expect(summary.instructionCount).toBe(0);
    expect(summary.mcpServerCount).toBe(0);
  });
});
