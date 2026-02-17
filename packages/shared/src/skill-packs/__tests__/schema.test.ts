/**
 * Unit tests for Skill Pack Schema validation
 */

import { describe, it, expect } from "vitest";
import {
  validateSkillPackManifest,
  validatePackName,
  safeValidateSkillPackManifest,
  mcpConfigSchema,
  skillSchema,
  agentSchema,
  instructionSchema,
  type SkillPackManifest,
} from "../schema.js";

describe("validatePackName", () => {
  it("should accept valid pack names", () => {
    expect(validatePackName("spectree-core")).toBe(true);
    expect(validatePackName("web-dev-essentials")).toBe(true);
    expect(validatePackName("my-pack-123")).toBe(true);
    expect(validatePackName("abc")).toBe(true);
    expect(validatePackName("a1")).toBe(true);
  });

  it("should reject invalid pack names", () => {
    expect(validatePackName("")).toBe(false);
    expect(validatePackName("-leading-dash")).toBe(false);
    expect(validatePackName("trailing-dash-")).toBe(false);
    expect(validatePackName("UPPERCASE")).toBe(false);
    expect(validatePackName("has spaces")).toBe(false);
    expect(validatePackName("has_underscore")).toBe(false);
    expect(validatePackName("has.dot")).toBe(false);
    expect(validatePackName("-")).toBe(false);
  });
});

describe("skillPackManifestSchema", () => {
  const validManifest: SkillPackManifest = {
    name: "test-pack",
    version: "1.0.0",
    displayName: "Test Pack",
    description: "A test skill pack",
    agents: [],
    skills: [],
    instructions: [],
    mcpServers: [],
  };

  it("should validate a minimal valid manifest", () => {
    const result = validateSkillPackManifest(validManifest);
    expect(result).toEqual(validManifest);
  });

  it("should validate a complete manifest with all fields", () => {
    const completeManifest: SkillPackManifest = {
      ...validManifest,
      author: "Test Author",
      license: "MIT",
      homepage: "https://example.com",
      repository: "https://github.com/test/pack",
      keywords: ["test", "example"],
      dependencies: {
        "other-pack": "1.0.0",
      },
      agents: [
        {
          id: "test-agent",
          name: "Test Agent",
          description: "A test agent",
          role: "worker",
          systemPrompt: "You are a test agent",
          skills: ["test-skill"],
          instructions: ["test-instruction"],
          mcpServers: ["test-server"],
          model: "claude-3-5-sonnet-20241022",
          temperature: 0.7,
          maxTokens: 4096,
        },
      ],
      skills: [
        {
          id: "test-skill",
          name: "Test Skill",
          description: "A test skill",
          category: "testing",
          tags: ["test"],
          instructions: "Do something",
          requiredTools: ["tool1"],
          examples: ["example1"],
        },
      ],
      instructions: [
        {
          id: "test-instruction",
          name: "Test Instruction",
          description: "A test instruction",
          content: "Follow these steps",
          applicableContexts: ["feature"],
          priority: 75,
        },
      ],
      mcpServers: [
        {
          name: "test-server",
          description: "A test MCP server",
          server: {
            command: "node server.js",
            args: ["--port", "3000"],
            env: { NODE_ENV: "production" },
          },
          requiredTools: ["tool1", "tool2"],
          tags: ["test"],
        },
      ],
    };

    const result = validateSkillPackManifest(completeManifest);
    expect(result).toEqual(completeManifest);
  });

  it("should reject manifest with invalid pack name", () => {
    const invalid = { ...validManifest, name: "Invalid Name" };
    expect(() => validateSkillPackManifest(invalid)).toThrow();
  });

  it("should reject manifest with invalid version", () => {
    const invalid = { ...validManifest, version: "1.0" };
    expect(() => validateSkillPackManifest(invalid)).toThrow();

    const invalid2 = { ...validManifest, version: "v1.0.0" };
    expect(() => validateSkillPackManifest(invalid2)).toThrow();

    const invalid3 = { ...validManifest, version: "1.0.0-beta" };
    expect(() => validateSkillPackManifest(invalid3)).toThrow();
  });

  it("should reject manifest missing required fields", () => {
    const noName = { ...validManifest, name: undefined };
    expect(() => validateSkillPackManifest(noName)).toThrow();

    const noVersion = { ...validManifest, version: undefined };
    expect(() => validateSkillPackManifest(noVersion)).toThrow();

    const noDisplayName = { ...validManifest, displayName: undefined };
    expect(() => validateSkillPackManifest(noDisplayName)).toThrow();

    const noDescription = { ...validManifest, description: undefined };
    expect(() => validateSkillPackManifest(noDescription)).toThrow();
  });

  it("should reject invalid URL fields", () => {
    const invalidHomepage = { ...validManifest, homepage: "not-a-url" };
    expect(() => validateSkillPackManifest(invalidHomepage)).toThrow();

    const invalidRepo = { ...validManifest, repository: "invalid" };
    expect(() => validateSkillPackManifest(invalidRepo)).toThrow();
  });
});

describe("mcpConfigSchema", () => {
  it("should validate MCP config with command", () => {
    const config = {
      name: "test-server",
      server: {
        command: "node server.js",
        args: ["--port", "3000"],
        env: { NODE_ENV: "test" },
      },
    };
    const result = mcpConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it("should validate MCP config with URL", () => {
    const config = {
      name: "remote-server",
      server: {
        url: "https://example.com/mcp",
      },
    };
    const result = mcpConfigSchema.parse(config);
    expect(result).toEqual(config);
  });

  it("should reject MCP config with neither command nor URL", () => {
    const config = {
      name: "invalid-server",
      server: {},
    };
    expect(() => mcpConfigSchema.parse(config)).toThrow();
  });
});

describe("skillSchema", () => {
  it("should validate a complete skill definition", () => {
    const skill = {
      id: "code-review",
      name: "Code Review",
      description: "Review code for quality and best practices",
      category: "review",
      tags: ["code", "quality"],
      instructions: "Follow these steps for code review...",
      requiredTools: ["git", "lint"],
      examples: ["Review a pull request"],
    };
    const result = skillSchema.parse(skill);
    expect(result).toEqual(skill);
  });

  it("should validate a minimal skill definition", () => {
    const skill = {
      id: "simple-skill",
      name: "Simple Skill",
      description: "A simple skill",
      instructions: "Do something simple",
    };
    const result = skillSchema.parse(skill);
    expect(result).toEqual(skill);
  });

  it("should reject skill without required fields", () => {
    const noId = {
      name: "Skill",
      description: "A skill",
      instructions: "Instructions",
    };
    expect(() => skillSchema.parse(noId)).toThrow();

    const noInstructions = {
      id: "skill",
      name: "Skill",
      description: "A skill",
    };
    expect(() => skillSchema.parse(noInstructions)).toThrow();
  });
});

describe("agentSchema", () => {
  it("should validate all agent roles", () => {
    const roles = ["orchestrator", "worker", "reviewer", "planner", "researcher", "custom"] as const;
    
    roles.forEach(role => {
      const agent = {
        id: `${role}-agent`,
        name: `${role} Agent`,
        description: `An ${role} agent`,
        role,
        systemPrompt: "System prompt",
      };
      const result = agentSchema.parse(agent);
      expect(result.role).toBe(role);
    });
  });

  it("should validate agent with optional fields", () => {
    const agent = {
      id: "full-agent",
      name: "Full Agent",
      description: "Agent with all fields",
      role: "worker" as const,
      systemPrompt: "You are a worker agent",
      skills: ["skill1", "skill2"],
      instructions: ["inst1"],
      mcpServers: ["server1"],
      model: "claude-3-5-sonnet-20241022",
      temperature: 1.5,
      maxTokens: 8192,
    };
    const result = agentSchema.parse(agent);
    expect(result).toEqual(agent);
  });

  it("should reject invalid role", () => {
    const agent = {
      id: "agent",
      name: "Agent",
      description: "An agent",
      role: "invalid-role",
      systemPrompt: "Prompt",
    };
    expect(() => agentSchema.parse(agent)).toThrow();
  });

  it("should reject invalid temperature", () => {
    const agent = {
      id: "agent",
      name: "Agent",
      description: "An agent",
      role: "worker",
      systemPrompt: "Prompt",
      temperature: 3.0,
    };
    expect(() => agentSchema.parse(agent)).toThrow();
  });
});

describe("instructionSchema", () => {
  it("should validate instruction with default priority", () => {
    const instruction = {
      id: "inst1",
      name: "Instruction 1",
      content: "Content here",
    };
    const result = instructionSchema.parse(instruction);
    expect(result.priority).toBe(50);
  });

  it("should validate instruction with custom priority", () => {
    const instruction = {
      id: "inst1",
      name: "Instruction 1",
      content: "Content here",
      priority: 100,
    };
    const result = instructionSchema.parse(instruction);
    expect(result.priority).toBe(100);
  });

  it("should reject priority out of range", () => {
    const tooHigh = {
      id: "inst1",
      name: "Instruction 1",
      content: "Content",
      priority: 101,
    };
    expect(() => instructionSchema.parse(tooHigh)).toThrow();

    const tooLow = {
      id: "inst1",
      name: "Instruction 1",
      content: "Content",
      priority: -1,
    };
    expect(() => instructionSchema.parse(tooLow)).toThrow();
  });
});

describe("safeValidateSkillPackManifest", () => {
  it("should return success for valid manifest", () => {
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
    const result = safeValidateSkillPackManifest(manifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(manifest);
    }
  });

  it("should return error for invalid manifest", () => {
    const invalid = {
      name: "Invalid Name",
      version: "1.0.0",
      displayName: "Test",
      description: "Test",
    };
    const result = safeValidateSkillPackManifest(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("should handle malformed JSON data", () => {
    const malformed = {
      name: 123, // Should be string
      version: "1.0.0",
    };
    const result = safeValidateSkillPackManifest(malformed);
    expect(result.success).toBe(false);
  });
});
