import { z } from "zod";

/**
 * Skill Pack JSON Schema and Validation
 *
 * Defines the manifest format for Skill Packs, which bundle reusable AI agents,
 * skills, instructions, and MCP server configurations into distributable packages.
 */

/**
 * MCP Server Configuration
 * Defines how to connect to an MCP server (local command or remote SSE)
 */
export const mcpServerConfigSchema = z.object({
  command: z.string().min(1).max(1000).optional().describe(
    "Command to start a local MCP server (e.g., 'node dist/index.js')"
  ),
  args: z.array(z.string()).optional().describe(
    "Command-line arguments for the MCP server"
  ),
  env: z.record(z.string()).optional().describe(
    "Environment variables for the MCP server process"
  ),
  url: z.string().url().optional().describe(
    "URL for remote SSE-based MCP server"
  ),
}).refine(
  (data) => !!(data.command || data.url),
  {
    message: "Either 'command' or 'url' must be provided for MCP server configuration",
  }
);

export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;

/**
 * MCP Configuration
 * Associates an MCP server with metadata and requirements
 */
export const mcpConfigSchema = z.object({
  name: z.string().min(1).max(255).describe(
    "Human-readable name for the MCP server"
  ),
  description: z.string().max(5000).optional().describe(
    "Description of the MCP server's capabilities"
  ),
  server: mcpServerConfigSchema.describe(
    "Server connection configuration"
  ),
  requiredTools: z.array(z.string()).optional().describe(
    "List of MCP tool names that must be available from this server"
  ),
  tags: z.array(z.string()).optional().describe(
    "Tags for categorizing and searching MCP servers"
  ),
});

export type MCPConfig = z.infer<typeof mcpConfigSchema>;

/**
 * Skill Definition
 * Represents a reusable capability or technique
 */
export const skillSchema = z.object({
  id: z.string().min(1).max(255).describe(
    "Unique identifier for the skill within the pack (e.g., 'code-review')"
  ),
  name: z.string().min(1).max(255).describe(
    "Human-readable name for the skill"
  ),
  description: z.string().max(5000).describe(
    "Description of what the skill does and when to use it"
  ),
  category: z.string().max(100).optional().describe(
    "Category for organizing skills (e.g., 'testing', 'refactoring', 'documentation')"
  ),
  tags: z.array(z.string()).optional().describe(
    "Tags for searching and filtering skills"
  ),
  instructions: z.string().min(1).max(50000).describe(
    "Detailed instructions for executing the skill. Can include markdown, examples, etc."
  ),
  requiredTools: z.array(z.string()).optional().describe(
    "MCP tools required to execute this skill"
  ),
  examples: z.array(z.string()).optional().describe(
    "Example use cases or scenarios for the skill"
  ),
});

export type Skill = z.infer<typeof skillSchema>;

/**
 * Instruction Block
 * Defines a reusable instruction template or guideline
 */
export const instructionSchema = z.object({
  id: z.string().min(1).max(255).describe(
    "Unique identifier for the instruction (e.g., 'tdd-workflow')"
  ),
  name: z.string().min(1).max(255).describe(
    "Human-readable name for the instruction"
  ),
  description: z.string().max(5000).optional().describe(
    "Description of the instruction's purpose"
  ),
  content: z.string().min(1).max(50000).describe(
    "The instruction content (supports markdown)"
  ),
  applicableContexts: z.array(z.string()).optional().describe(
    "Contexts where this instruction applies (e.g., 'feature', 'task', 'epic')"
  ),
  priority: z.number().int().min(0).max(100).optional().default(50).describe(
    "Priority for instruction application (0-100, higher = more important)"
  ),
});

export type Instruction = z.infer<typeof instructionSchema>;

/**
 * Agent Definition
 * Represents a configured AI agent with specific role and capabilities
 */
export const agentSchema = z.object({
  id: z.string().min(1).max(255).describe(
    "Unique identifier for the agent within the pack (e.g., 'feature-worker')"
  ),
  name: z.string().min(1).max(255).describe(
    "Human-readable name for the agent"
  ),
  description: z.string().max(5000).describe(
    "Description of the agent's role and capabilities"
  ),
  role: z.enum([
    "orchestrator",
    "worker",
    "reviewer",
    "planner",
    "researcher",
    "custom",
  ]).describe(
    "Agent role type"
  ),
  systemPrompt: z.string().min(1).max(50000).describe(
    "System prompt that defines the agent's behavior and instructions"
  ),
  skills: z.array(z.string()).optional().describe(
    "Skill IDs from this pack that the agent can use"
  ),
  instructions: z.array(z.string()).optional().describe(
    "Instruction IDs from this pack applied to this agent"
  ),
  mcpServers: z.array(z.string()).optional().describe(
    "MCP server names from this pack that the agent has access to"
  ),
  model: z.string().max(255).optional().describe(
    "Preferred model for this agent (e.g., 'claude-3-5-sonnet-20241022')"
  ),
  temperature: z.number().min(0).max(2).optional().describe(
    "Temperature setting for model responses (0-2)"
  ),
  maxTokens: z.number().int().min(1).optional().describe(
    "Maximum tokens for responses"
  ),
});

export type Agent = z.infer<typeof agentSchema>;

/**
 * Skill Pack Manifest
 * The complete manifest file for a skill pack
 */
export const skillPackManifestSchema = z.object({
  name: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
      message: "Pack name must be lowercase alphanumeric with hyphens, start and end with alphanumeric",
    })
    .describe(
      "Unique pack name (e.g., 'spectree-core', 'web-dev-essentials')"
    ),
  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, {
      message: "Version must follow semantic versioning (e.g., '1.0.0')",
    })
    .describe(
      "Semantic version number (e.g., '1.0.0')"
    ),
  displayName: z.string().min(1).max(255).describe(
    "Human-readable display name for the pack"
  ),
  description: z.string().max(5000).describe(
    "Detailed description of the pack's purpose and contents"
  ),
  author: z.string().max(255).optional().describe(
    "Pack author name or organization"
  ),
  license: z.string().max(100).optional().describe(
    "License identifier (e.g., 'MIT', 'Apache-2.0')"
  ),
  homepage: z.string().url().optional().describe(
    "URL to pack homepage or documentation"
  ),
  repository: z.string().url().optional().describe(
    "URL to source code repository"
  ),
  keywords: z.array(z.string()).optional().describe(
    "Keywords for pack discovery and search"
  ),
  agents: z.array(agentSchema).optional().default([]).describe(
    "Agent definitions included in this pack"
  ),
  skills: z.array(skillSchema).optional().default([]).describe(
    "Skill definitions included in this pack"
  ),
  instructions: z.array(instructionSchema).optional().default([]).describe(
    "Instruction definitions included in this pack"
  ),
  mcpServers: z.array(mcpConfigSchema).optional().default([]).describe(
    "MCP server configurations included in this pack"
  ),
  dependencies: z.record(z.string()).optional().describe(
    "Other skill pack dependencies (pack-name: version)"
  ),
});

export type SkillPackManifest = z.infer<typeof skillPackManifestSchema>;

/**
 * Validate a skill pack manifest
 * @param data - The manifest data to validate
 * @returns Validated manifest object
 * @throws ZodError if validation fails
 */
export function validateSkillPackManifest(data: unknown): SkillPackManifest {
  return skillPackManifestSchema.parse(data);
}

/**
 * Validate a pack name format
 * @param name - The pack name to validate
 * @returns True if valid, false otherwise
 */
export function validatePackName(name: string): boolean {
  const packNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  return packNameRegex.test(name) && name.length >= 1 && name.length <= 255;
}

/**
 * Safe parse a skill pack manifest without throwing
 * @param data - The manifest data to validate
 * @returns Success result with manifest or error result
 */
export function safeValidateSkillPackManifest(data: unknown) {
  return skillPackManifestSchema.safeParse(data);
}
