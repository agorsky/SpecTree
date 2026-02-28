/**
 * MCP Tools for Pattern Detection & Convention Extraction (ENG-30)
 *
 * Detects codebase patterns and conventions by analyzing example files,
 * giving the planner agent the ability to recommend consistent implementations.
 *
 * Tools:
 * - spectree__detect_patterns: Find example files for a pattern type and extract conventions
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse, createErrorResponse } from "./utils.js";
import * as fs from "node:fs";
import * as path from "node:path";

// Pattern type definitions with associated file glob patterns
const PATTERN_GLOBS: Record<string, { globs: string[]; label: string }> = {
  route: {
    globs: ["**/routes/**/*.ts", "**/router/**/*.ts", "**/api/**/*.ts"],
    label: "API Route",
  },
  schema: {
    globs: [
      "**/schema*.ts",
      "**/schemas/**/*.ts",
      "**/*.schema.ts",
      "**/prisma/schema.prisma",
    ],
    label: "Schema/Model",
  },
  "mcp-tool": {
    globs: ["**/tools/*.ts", "**/tools/**/*.ts"],
    label: "MCP Tool",
  },
  component: {
    globs: [
      "**/components/**/*.tsx",
      "**/components/**/*.ts",
      "**/pages/**/*.tsx",
    ],
    label: "UI Component",
  },
  test: {
    globs: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.test.tsx",
      "**/tests/**/*.ts",
    ],
    label: "Test File",
  },
  middleware: {
    globs: [
      "**/middleware/**/*.ts",
      "**/middlewares/**/*.ts",
      "**/*.middleware.ts",
    ],
    label: "Middleware",
  },
};

// Directories to skip when scanning for pattern files
const PATTERN_SKIP_DIRS = new Set([
  "node_modules", "dist", ".git", ".next", ".turbo",
  ".cache", "coverage", "build", ".output",
]);

/**
 * Recursively find files matching glob-like patterns.
 * Supports ** (any depth), * (wildcard in name), and literal directory names.
 */
function findFiles(
  directory: string,
  globs: string[]
): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // Walk directory recursively, collecting all files
  function walk(dir: string, depth: number): string[] {
    if (depth > 8) return [];
    const files: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return files;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!PATTERN_SKIP_DIRS.has(entry.name)) {
          files.push(...walk(path.join(dir, entry.name), depth + 1));
        }
      } else if (entry.isFile()) {
        files.push(path.join(dir, entry.name));
      }
    }
    return files;
  }

  const allFiles = walk(directory, 0);

  for (const glob of globs) {
    // Convert glob to regex:
    // **/ → match any path segments (including zero)
    // * → match any characters except /
    const regexStr = glob
      .replace(/\./g, "\\.")
      .replace(/\*\*\//g, "(?:.*/)?")
      .replace(/\*/g, "[^/]*");
    const regex = new RegExp(`(^|/)${regexStr}$`);

    for (const file of allFiles) {
      const relative = path.relative(directory, file);
      if (regex.test(relative) && !seen.has(file)) {
        seen.add(file);
        results.push(file);
      }
    }
  }

  return results.slice(0, 20);
}

/**
 * Extract conventions from file content.
 */
function extractConventions(content: string, filePath: string): Record<string, unknown> {
  const lines = content.split("\n");
  const ext = path.extname(filePath);

  // Import ordering analysis
  const imports: string[] = [];
  let importSection = true;
  for (const line of lines) {
    const trimmed = line.trim();
    if (importSection) {
      if (trimmed.startsWith("import ") || trimmed.startsWith("import{") || trimmed.startsWith("import type")) {
        imports.push(trimmed);
      } else if (trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*")) {
        importSection = false;
      }
    }
  }

  // Categorize imports
  const importCategories = {
    external: [] as string[],
    internal: [] as string[],
    relative: [] as string[],
    typeOnly: [] as string[],
  };

  for (const imp of imports) {
    if (imp.includes("import type")) {
      importCategories.typeOnly.push(imp);
    } else if (imp.includes('from ".') || imp.includes("from '.")) {
      importCategories.relative.push(imp);
    } else if (imp.includes('from "@') || imp.includes("from '@") || imp.includes('from "~') || imp.includes("from '~")) {
      importCategories.internal.push(imp);
    } else {
      importCategories.external.push(imp);
    }
  }

  // Error handling patterns
  const errorPatterns: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("try {") || trimmed.includes("try{")) {
      errorPatterns.push("try-catch");
    }
    if (trimmed.includes("catch (") || trimmed.includes("catch(")) {
      // Capture what follows catch
      const catchMatch = /catch\s*\((\w+)/.exec(trimmed);
      if (catchMatch?.[1]) {
        errorPatterns.push(`catch-variable: ${catchMatch[1]}`);
      }
    }
    if (trimmed.includes("createErrorResponse")) {
      errorPatterns.push("createErrorResponse");
    }
    if (trimmed.includes("throw new")) {
      errorPatterns.push("throw");
    }
    if (trimmed.includes("instanceof Error") || trimmed.includes("instanceof ApiError")) {
      errorPatterns.push("instanceof-check");
    }
  }

  // TypeScript types used
  const typePatterns: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("interface ")) {
      const nameMatch = /interface\s+(\w+)/.exec(trimmed);
      if (nameMatch?.[1]) typePatterns.push(`interface: ${nameMatch[1]}`);
    }
    if (trimmed.startsWith("type ") && trimmed.includes("=")) {
      const nameMatch = /type\s+(\w+)/.exec(trimmed);
      if (nameMatch?.[1]) typePatterns.push(`type: ${nameMatch[1]}`);
    }
    if (trimmed.includes("z.object") || trimmed.includes("z.string") || trimmed.includes("z.number")) {
      if (!typePatterns.includes("zod-schemas")) {
        typePatterns.push("zod-schemas");
      }
    }
  }

  // Test structure (for test files)
  const testStructure: string[] = [];
  if (ext === ".test.ts" || ext === ".spec.ts" || filePath.includes("test")) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("describe(") || trimmed.startsWith("describe.")) {
        const descMatch = /describe\(?["'`](.+?)["'`]/.exec(trimmed);
        if (descMatch?.[1]) testStructure.push(`describe: "${descMatch[1]}"`);
      }
      if (trimmed.startsWith("it(") || trimmed.startsWith("test(")) {
        const testMatch = /(?:it|test)\(["'`](.+?)["'`]/.exec(trimmed);
        if (testMatch?.[1]) testStructure.push(`test: "${testMatch[1]}"`);
      }
      if (trimmed.includes("vi.mock") || trimmed.includes("jest.mock")) {
        testStructure.push("uses-mocking");
      }
      if (trimmed.includes("vi.hoisted")) {
        testStructure.push("uses-hoisted-mocks");
      }
    }
  }

  // Naming conventions
  const namingConventions: string[] = [];
  // Check for camelCase function names
  const funcMatch = content.match(/(?:function|const|let)\s+([a-z][a-zA-Z0-9]*)/g);
  if (funcMatch && funcMatch.length > 0) {
    namingConventions.push("camelCase functions");
  }
  // Check for PascalCase classes/interfaces
  const pascalMatch = content.match(/(?:class|interface|type)\s+([A-Z][a-zA-Z0-9]*)/g);
  if (pascalMatch && pascalMatch.length > 0) {
    namingConventions.push("PascalCase types");
  }
  // Check for export pattern
  if (content.includes("export function register")) {
    namingConventions.push("register* pattern for tool registration");
  }
  if (content.includes("export default")) {
    namingConventions.push("default exports");
  }

  return {
    importOrdering: importCategories,
    errorHandling: [...new Set(errorPatterns)],
    typescriptTypes: [...new Set(typePatterns)],
    testStructure: testStructure.length > 0 ? testStructure : undefined,
    namingConventions: [...new Set(namingConventions)],
    lineCount: lines.length,
  };
}

// Register pattern detection tools
export function registerPatternTools(server: McpServer): void {
  // ==========================================================================
  // spectree__detect_patterns
  // ==========================================================================
  server.registerTool(
    "spectree__detect_patterns",
    {
      description:
        "Detect codebase patterns and conventions by analyzing example files.\n\n" +
        "Given a pattern type (route, schema, mcp-tool, component, test, middleware), " +
        "finds 2-3 example files matching that pattern, reads their content, and extracts:\n" +
        "- Import ordering conventions\n" +
        "- Error handling patterns\n" +
        "- TypeScript types and schemas used\n" +
        "- Test structure (for test files)\n" +
        "- Naming conventions\n\n" +
        "Use this during DETAIL stage to ensure new code follows existing project conventions.",
      inputSchema: {
        patternType: z
          .enum(["route", "schema", "mcp-tool", "component", "test", "middleware"])
          .describe(
            "Type of pattern to detect. Options:\n" +
            "- route: API route handlers\n" +
            "- schema: Database/validation schemas\n" +
            "- mcp-tool: MCP tool implementations\n" +
            "- component: UI components\n" +
            "- test: Test files\n" +
            "- middleware: Middleware functions"
          ),
        directoryScope: z
          .string()
          .describe(
            "Absolute path to the directory to search for example files. " +
            "Use the project root or a specific package directory."
          ),
      },
    },
    async (input) => {
      try {
        const directory = path.resolve(input.directoryScope);

        if (!fs.existsSync(directory)) {
          return createErrorResponse(
            new Error(`Directory not found: ${directory}`)
          );
        }

        const patternConfig = PATTERN_GLOBS[input.patternType];
        if (!patternConfig) {
          return createErrorResponse(
            new Error(`Unknown pattern type: ${input.patternType}`)
          );
        }

        // Find matching files
        const matchingFiles = findFiles(directory, patternConfig.globs);

        if (matchingFiles.length === 0) {
          return createResponse({
            patternType: input.patternType,
            label: patternConfig.label,
            directoryScope: directory,
            examplesFound: 0,
            message: `No ${patternConfig.label} files found in ${directory}`,
            conventions: null,
          });
        }

        // Take 2-3 example files
        const examples = matchingFiles.slice(0, 3);

        const analyzedExamples = examples.map((filePath) => {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const conventions = extractConventions(content, filePath);
            // Include a preview of the file (first 50 lines)
            const preview = content.split("\n").slice(0, 50).join("\n");

            return {
              path: path.relative(directory, filePath),
              conventions,
              preview,
            };
          } catch {
            return {
              path: path.relative(directory, filePath),
              conventions: null,
              preview: null,
              error: "Could not read file",
            };
          }
        });

        // Summarize common patterns across all examples
        const allImportPatterns = new Set<string>();
        const allErrorPatterns = new Set<string>();
        const allNaming = new Set<string>();

        for (const example of analyzedExamples) {
          if (example.conventions) {
            const conv = example.conventions as Record<string, unknown>;
            const errorHandling = conv.errorHandling;
            if (Array.isArray(errorHandling)) {
              for (const p of errorHandling) allErrorPatterns.add(String(p));
            }
            const namingConventions = conv.namingConventions;
            if (Array.isArray(namingConventions)) {
              for (const n of namingConventions) allNaming.add(String(n));
            }
            const importOrdering = conv.importOrdering;
            if (importOrdering && typeof importOrdering === "object") {
              for (const key of Object.keys(importOrdering as Record<string, unknown>)) {
                const arr = (importOrdering as Record<string, unknown[]>)[key];
                if (Array.isArray(arr) && arr.length > 0) {
                  allImportPatterns.add(key);
                }
              }
            }
          }
        }

        return createResponse({
          patternType: input.patternType,
          label: patternConfig.label,
          directoryScope: directory,
          examplesFound: analyzedExamples.length,
          totalMatches: matchingFiles.length,
          examples: analyzedExamples,
          commonConventions: {
            importCategories: [...allImportPatterns],
            errorHandlingPatterns: [...allErrorPatterns],
            namingConventions: [...allNaming],
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
