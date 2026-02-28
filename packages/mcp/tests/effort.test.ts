/**
 * Unit tests for MCP Effort Estimation tools (ENG-31)
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

import { registerEffortTools } from "../src/tools/effort.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: Record<string, unknown>) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

let tempDir: string;

beforeAll(() => {
  registerEffortTools(mockServer as never);

  // Create temp project with files of various sizes
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "spectree-effort-test-"));

  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });

  // Small file (trivial)
  fs.writeFileSync(
    path.join(tempDir, "src", "small.ts"),
    `export function add(a: number, b: number): number {
  return a + b;
}
`
  );

  // Medium file
  const mediumLines: string[] = [];
  mediumLines.push('import { z } from "zod";');
  mediumLines.push("");
  for (let i = 0; i < 50; i++) {
    mediumLines.push(`export function func${String(i)}(): void {`);
    mediumLines.push(`  console.log("function ${String(i)}");`);
    mediumLines.push("}");
    mediumLines.push("");
  }
  fs.writeFileSync(
    path.join(tempDir, "src", "medium.ts"),
    mediumLines.join("\n")
  );

  // Large file
  const largeLines: string[] = [];
  largeLines.push('import { z } from "zod";');
  largeLines.push('import path from "node:path";');
  largeLines.push("");
  for (let i = 0; i < 300; i++) {
    largeLines.push(`// Function ${String(i)}`);
    largeLines.push(`export function largeFunc${String(i)}(input: string): string {`);
    largeLines.push(`  const result = input.trim();`);
    largeLines.push(`  return result;`);
    largeLines.push("}");
    largeLines.push("");
  }
  fs.writeFileSync(
    path.join(tempDir, "src", "large.ts"),
    largeLines.join("\n")
  );

  // File that imports from medium (to test dependents)
  fs.writeFileSync(
    path.join(tempDir, "src", "consumer.ts"),
    `import { func0, func1 } from "./medium.js";

export function run(): void {
  func0();
  func1();
}
`
  );
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("spectree__estimate_effort", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should be registered", () => {
    expect(registeredTools.has("spectree__estimate_effort")).toBe(true);
  });

  it("should estimate trivial effort for small files", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [{ path: "src/small.ts", isNew: false }],
      taskDescription: "Fix a small function",
    });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]!.text);

    expect(data.score).toBeGreaterThanOrEqual(1);
    expect(data.score).toBeLessThanOrEqual(3);
    expect(["trivial", "simple"]).toContain(data.category);
    expect(data.estimatedMinutes).toBeDefined();
    expect(data.estimatedMinutes.min).toBeLessThan(data.estimatedMinutes.max);
    expect(data.taskDescription).toBe("Fix a small function");
  });

  it("should estimate higher effort for large files", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [
        { path: "src/large.ts", isNew: false },
        { path: "src/medium.ts", isNew: false },
      ],
      taskDescription: "Refactor large and medium files",
    });

    const data = JSON.parse(result.content[0]!.text);

    // Should be scored higher due to more LOC and more files
    expect(data.score).toBeGreaterThan(1);
    expect(data.factors.totalLOC).toBeGreaterThan(100);
    expect(data.factors.fileCount).toBe(2);
    expect(data.factors.modifyFiles).toBe(2);
    expect(data.factors.newFiles).toBe(0);
  });

  it("should handle new files", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [
        { path: "src/new-file.ts", isNew: true },
        { path: "src/another-new.ts", isNew: true },
      ],
    });

    const data = JSON.parse(result.content[0]!.text);

    expect(data.factors.newFiles).toBe(2);
    expect(data.factors.modifyFiles).toBe(0);
    expect(data.files[0].isNew).toBe(true);
    // New files don't have LOC to count
    expect(data.factors.totalLOC).toBe(0);
  });

  it("should handle mix of new and existing files", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [
        { path: "src/small.ts", isNew: false },
        { path: "src/brand-new.ts", isNew: true },
      ],
    });

    const data = JSON.parse(result.content[0]!.text);

    expect(data.factors.newFiles).toBe(1);
    expect(data.factors.modifyFiles).toBe(1);
    expect(data.factors.fileCount).toBe(2);
  });

  it("should warn about files marked as modify but non-existent", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [{ path: "src/nonexistent.ts", isNew: false }],
    });

    const data = JSON.parse(result.content[0]!.text);

    expect(data.files[0].exists).toBe(false);
    expect(data.files[0].warning).toBeDefined();
  });

  it("should return valid score range (1-10)", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");

    // Test with many files to get a high score
    const files = [];
    for (let i = 0; i < 15; i++) {
      files.push({ path: `src/file${String(i)}.ts`, isNew: false });
    }

    const result = await tool!.handler({
      rootPath: tempDir,
      files,
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.score).toBeGreaterThanOrEqual(1);
    expect(data.score).toBeLessThanOrEqual(10);
  });

  it("should include file details in response", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [{ path: "src/medium.ts", isNew: false }],
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.files).toHaveLength(1);
    expect(data.files[0].path).toBe("src/medium.ts");
    expect(data.files[0].loc).toBeDefined();
    expect(data.files[0].loc.total).toBeGreaterThan(0);
    expect(data.files[0].loc.code).toBeGreaterThan(0);
  });

  it("should return null taskDescription when not provided", async () => {
    const tool = registeredTools.get("spectree__estimate_effort");
    const result = await tool!.handler({
      rootPath: tempDir,
      files: [{ path: "src/small.ts", isNew: false }],
    });

    const data = JSON.parse(result.content[0]!.text);
    expect(data.taskDescription).toBeNull();
  });
});
