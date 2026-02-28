/**
 * Unit tests for MCP Codebase Analysis tools (ENG-29)
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

import { registerCodebaseTools } from "../src/tools/codebase.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: Record<string, unknown>) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

// Create a temp directory with a fake project structure for testing
let tempDir: string;

beforeAll(() => {
  registerCodebaseTools(mockServer as never);

  // Create temp project structure
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectree-codebase-test-"));

  // Create directories
  fs.mkdirSync(path.join(tempDir, "src", "tools"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "src", "utils"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "node_modules", "some-pkg"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "prisma"), { recursive: true });

  // Create package.json
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({
      name: "test-project",
      dependencies: { zod: "^3.0.0" },
      devDependencies: { vitest: "^2.0.0" },
      scripts: { test: "vitest run" },
    })
  );

  // Create prisma schema
  fs.writeFileSync(
    path.join(tempDir, "prisma", "schema.prisma"),
    `model User {
  id String @id
  name String
}

model Task {
  id String @id
  title String
}
`
  );

  // Create source files
  fs.writeFileSync(
    path.join(tempDir, "src", "utils", "helpers.ts"),
    `export function formatDate(d: Date): string {
  return d.toISOString();
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
`
  );

  fs.writeFileSync(
    path.join(tempDir, "src", "tools", "main.ts"),
    `import { formatDate } from "../utils/helpers.js";

export function doSomething(): void {
  console.log(formatDate(new Date()));
}
`
  );

  fs.writeFileSync(
    path.join(tempDir, "tests", "helpers.test.ts"),
    `import { formatDate, capitalize } from "../src/utils/helpers.js";

describe("helpers", () => {
  it("formats date", () => {
    expect(formatDate(new Date())).toBeDefined();
  });
});
`
  );
});

afterAll(() => {
  // Clean up temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("spectree__scan_project_structure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should be registered", () => {
    expect(registeredTools.has("spectree__scan_project_structure")).toBe(true);
  });

  it("should scan directory tree", async () => {
    const tool = registeredTools.get("spectree__scan_project_structure");
    const result = await tool!.handler({ rootPath: tempDir });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);
    expect(data.rootPath).toBe(tempDir);
    expect(data.directoryTree).toBeDefined();
    // node_modules should be filtered out
    expect(data.directoryTree.node_modules).toBeUndefined();
    // src should be present
    expect(data.directoryTree.src).toBeDefined();
  });

  it("should read package.json", async () => {
    const tool = registeredTools.get("spectree__scan_project_structure");
    const result = await tool!.handler({ rootPath: tempDir });
    const data = JSON.parse(result.content[0]!.text);

    expect(data.packageInfo).toBeDefined();
    expect(data.packageInfo.name).toBe("test-project");
    expect(data.packageInfo.dependencies).toHaveProperty("zod");
    expect(data.packageInfo.devDependencies).toHaveProperty("vitest");
  });

  it("should parse prisma models", async () => {
    const tool = registeredTools.get("spectree__scan_project_structure");
    const result = await tool!.handler({ rootPath: tempDir });
    const data = JSON.parse(result.content[0]!.text);

    expect(data.prismaModels).toBeDefined();
    expect(data.prismaModels).toContain("User");
    expect(data.prismaModels).toContain("Task");
  });

  it("should return error for non-existent directory", async () => {
    const tool = registeredTools.get("spectree__scan_project_structure");
    const result = await tool!.handler({ rootPath: "/tmp/nonexistent-dir-xyz" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not found");
  });
});

describe("spectree__analyze_file_impact", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should be registered", () => {
    expect(registeredTools.has("spectree__analyze_file_impact")).toBe(true);
  });

  it("should analyze existing files", async () => {
    const tool = registeredTools.get("spectree__analyze_file_impact");
    const result = await tool!.handler({
      rootPath: tempDir,
      filePaths: ["src/utils/helpers.ts"],
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);

    expect(data.summary.totalFiles).toBe(1);
    expect(data.summary.existing).toBe(1);
    expect(data.summary.missing).toBe(0);

    const file = data.files[0];
    expect(file.exists).toBe(true);
    expect(file.lineCount).toBeGreaterThan(0);
    expect(file.exports.length).toBeGreaterThan(0);
  });

  it("should report missing files", async () => {
    const tool = registeredTools.get("spectree__analyze_file_impact");
    const result = await tool!.handler({
      rootPath: tempDir,
      filePaths: ["src/nonexistent.ts"],
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.summary.missing).toBe(1);
    expect(data.files[0].exists).toBe(false);
  });

  it("should handle mix of existing and missing files", async () => {
    const tool = registeredTools.get("spectree__analyze_file_impact");
    const result = await tool!.handler({
      rootPath: tempDir,
      filePaths: ["src/utils/helpers.ts", "src/missing.ts"],
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.summary.existing).toBe(1);
    expect(data.summary.missing).toBe(1);
  });

  it("should extract import and export statements", async () => {
    const tool = registeredTools.get("spectree__analyze_file_impact");
    const result = await tool!.handler({
      rootPath: tempDir,
      filePaths: ["src/tools/main.ts"],
    });

    const data = JSON.parse(result.content[0]!.text);
    const file = data.files[0];
    expect(file.imports.length).toBeGreaterThan(0);
    expect(file.imports[0]).toContain("helpers");
    expect(file.exports.length).toBeGreaterThan(0);
  });
});
