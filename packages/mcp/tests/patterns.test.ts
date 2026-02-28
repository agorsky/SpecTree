/**
 * Unit tests for MCP Pattern Detection tools (ENG-30)
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const registeredTools = new Map<string, { config: unknown; handler: (input: Record<string, unknown>) => Promise<ToolResponse> }>();

import { registerPatternTools } from "../src/tools/patterns.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: Record<string, unknown>) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

let tempDir: string;

beforeAll(() => {
  registerPatternTools(mockServer as never);

  // Create temp project structure with various pattern types
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectree-patterns-test-"));

  // Create tool files
  fs.mkdirSync(path.join(tempDir, "src", "tools"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "src", "tools", "search.ts"),
    `import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

export function registerSearchTools(server: McpServer): void {
  server.registerTool("spectree__search", {
    description: "Search for items",
    inputSchema: {
      query: z.string().optional(),
    },
  }, async (input) => {
    try {
      const apiClient = getApiClient();
      const result = await apiClient.search(input);
      return createResponse(result);
    } catch (error) {
      if (error instanceof ApiError) {
        return createErrorResponse(error);
      }
      return createErrorResponse(error);
    }
  });
}
`
  );

  // Create test files
  fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "tests", "search.test.ts"),
    `import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApiClient } = vi.hoisted(() => {
  return { mockApiClient: { search: vi.fn() } };
});

vi.mock("../src/api-client.js", () => ({
  getApiClient: () => mockApiClient,
}));

describe("Search Tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should search", async () => {
    mockApiClient.search.mockResolvedValue({ results: [] });
    expect(true).toBe(true);
  });
});
`
  );

  // Create route files
  fs.mkdirSync(path.join(tempDir, "src", "routes"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "src", "routes", "users.ts"),
    `import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
`
  );

  // Create component files
  fs.mkdirSync(path.join(tempDir, "src", "components"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "src", "components", "Button.tsx"),
    `import React from "react";

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps): React.ReactElement {
  return <button onClick={onClick}>{label}</button>;
}
`
  );
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("spectree__detect_patterns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should be registered", () => {
    expect(registeredTools.has("spectree__detect_patterns")).toBe(true);
  });

  it("should detect mcp-tool patterns", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "mcp-tool",
      directoryScope: tempDir,
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);

    expect(data.patternType).toBe("mcp-tool");
    expect(data.examplesFound).toBeGreaterThan(0);
    expect(data.examples).toBeDefined();
    expect(data.examples.length).toBeGreaterThan(0);

    // Should detect conventions
    const example = data.examples[0];
    expect(example.conventions).toBeDefined();
    expect(example.conventions.namingConventions).toBeDefined();
  });

  it("should detect test patterns", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "test",
      directoryScope: tempDir,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.examplesFound).toBeGreaterThan(0);

    // Should detect test-specific conventions
    const example = data.examples[0];
    expect(example.conventions.testStructure).toBeDefined();
    expect(example.conventions.testStructure.length).toBeGreaterThan(0);
  });

  it("should detect route patterns", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "route",
      directoryScope: tempDir,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.examplesFound).toBeGreaterThan(0);
  });

  it("should detect component patterns", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "component",
      directoryScope: tempDir,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.examplesFound).toBeGreaterThan(0);
  });

  it("should return error for non-existent directory", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "route",
      directoryScope: "/tmp/nonexistent-dir-xyz",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not found");
  });

  it("should handle no matches gracefully", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "middleware",
      directoryScope: tempDir,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.examplesFound).toBe(0);
    expect(data.conventions).toBeNull();
  });

  it("should include common conventions across examples", async () => {
    const tool = registeredTools.get("spectree__detect_patterns");
    const result = await tool!.handler({
      patternType: "mcp-tool",
      directoryScope: tempDir,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.commonConventions).toBeDefined();
    expect(data.commonConventions.errorHandlingPatterns).toBeDefined();
    expect(data.commonConventions.namingConventions).toBeDefined();
  });
});
