/**
 * MCP Tools for Codebase Analysis (ENG-29)
 *
 * Provides tools for analyzing project structure and file impact,
 * giving the planner agent codebase awareness during planning.
 *
 * Tools:
 * - spectree__scan_project_structure: Scan directories, deps, prisma models, recent git history
 * - spectree__analyze_file_impact: Check file existence, LOC, imports/exports, dependents
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse, createErrorResponse } from "./utils.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// Directories to skip when scanning
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".output",
  "build",
  ".svelte-kit",
]);

/**
 * Recursively read directory tree up to a given depth.
 * Returns a nested structure of directory names and files.
 */
function scanDirectory(
  dirPath: string,
  maxDepth: number,
  currentDepth = 0
): Record<string, unknown> {
  if (currentDepth >= maxDepth) {
    return { _truncated: true };
  }

  const result: Record<string, unknown> = {};

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return { _error: "cannot read directory" };
  }

  const dirs: string[] = [];
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        dirs.push(entry.name);
      }
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }

  if (files.length > 0) {
    result._files = files;
  }

  for (const dir of dirs.sort()) {
    result[dir] = scanDirectory(
      path.join(dirPath, dir),
      maxDepth,
      currentDepth + 1
    );
  }

  return result;
}

/**
 * Read and parse package.json dependencies.
 */
function readPackageDeps(rootPath: string): Record<string, unknown> | null {
  const pkgPath = path.join(rootPath, "package.json");
  try {
    const content = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;
    return {
      name: pkg.name,
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      scripts: pkg.scripts ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Parse prisma schema for model names.
 */
function parsePrismaModels(rootPath: string): string[] {
  const schemaPath = path.join(rootPath, "prisma", "schema.prisma");
  try {
    const content = fs.readFileSync(schemaPath, "utf-8");
    const modelRegex = /^model\s+(\w+)\s*\{/gm;
    const models: string[] = [];
    let match = modelRegex.exec(content);
    while (match !== null) {
      const modelName = match[1];
      if (modelName !== undefined) {
        models.push(modelName);
      }
      match = modelRegex.exec(content);
    }
    return models;
  } catch {
    return [];
  }
}

/**
 * Get recent git log.
 */
function getGitLog(rootPath: string, count: number): string[] {
  try {
    const output = execSync(`git log --oneline -${String(count)}`, {
      cwd: rootPath,
      encoding: "utf-8",
      timeout: 5000,
    });
    return output
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

/**
 * Count lines in a file.
 */
function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

/**
 * Extract import and export statements from a TypeScript/JavaScript file.
 */
function extractImportsExports(filePath: string): {
  imports: string[];
  exports: string[];
} {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const imports: string[] = [];
    const exports: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("import{") ||
        trimmed.startsWith("import type")
      ) {
        imports.push(trimmed);
      } else if (
        trimmed.startsWith("export ") ||
        trimmed.startsWith("export{") ||
        trimmed.startsWith("export default") ||
        trimmed.startsWith("export type") ||
        trimmed.startsWith("export interface") ||
        trimmed.startsWith("export function") ||
        trimmed.startsWith("export const") ||
        trimmed.startsWith("export class") ||
        trimmed.startsWith("export enum") ||
        trimmed.startsWith("export async")
      ) {
        exports.push(trimmed);
      }
    }

    return { imports, exports };
  } catch {
    return { imports: [], exports: [] };
  }
}

/**
 * Find files that import from a given target file path.
 * Uses grep for speed over full AST parsing.
 */
function findDependents(
  rootPath: string,
  targetFile: string
): string[] {
  // Get the file's base name without extension for matching imports
  const basename = path.basename(targetFile).replace(/\.(ts|tsx|js|jsx|mjs)$/, "");
  const relativePath = path.relative(rootPath, targetFile);
  // Also try matching by relative path segments
  const pathSegment = relativePath.replace(/\.(ts|tsx|js|jsx|mjs)$/, "");

  try {
    const output = execSync(
      `grep -rl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' -e "${basename}" "${rootPath}" 2>/dev/null || true`,
      {
        encoding: "utf-8",
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      }
    );

    const allFiles = output
      .trim()
      .split("\n")
      .filter((f) => f.length > 0 && f !== targetFile);

    // Filter to files that actually import the target
    const dependents: string[] = [];
    for (const file of allFiles) {
      // Skip node_modules and dist
      if (file.includes("node_modules") || file.includes("/dist/")) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        // Check if any import line references the target path or basename
        if (
          content.includes(`from "./${basename}"`) ||
          content.includes(`from '../${basename}'`) ||
          content.includes(`from "./${basename}.js"`) ||
          content.includes(`from '${basename}'`) ||
          content.includes(pathSegment)
        ) {
          dependents.push(path.relative(rootPath, file));
        }
      } catch {
        // Skip unreadable files
      }
    }

    return dependents.slice(0, 50); // Cap at 50 dependents
  } catch {
    return [];
  }
}

// Register codebase analysis tools
export function registerCodebaseTools(server: McpServer): void {
  // ==========================================================================
  // spectree__scan_project_structure
  // ==========================================================================
  server.registerTool(
    "spectree__scan_project_structure",
    {
      description:
        "Scan a project's directory structure, dependencies, database models, and recent git history.\n\n" +
        "Returns:\n" +
        "- Directory tree (up to depth 4, filtering node_modules/dist/.git)\n" +
        "- package.json dependencies and scripts\n" +
        "- Prisma schema model names (if prisma/schema.prisma exists)\n" +
        "- Last 20 git commits (oneline format)\n\n" +
        "Use this at the START of planning to understand the project layout before proposing file paths or features.",
      inputSchema: {
        rootPath: z
          .string()
          .describe(
            "Absolute path to the project root directory to scan."
          ),
      },
    },
    async (input) => {
      try {
        const rootPath = path.resolve(input.rootPath);

        if (!fs.existsSync(rootPath)) {
          return createErrorResponse(
            new Error(`Directory not found: ${rootPath}`)
          );
        }

        const directoryTree = scanDirectory(rootPath, 4);
        const packageInfo = readPackageDeps(rootPath);
        const prismaModels = parsePrismaModels(rootPath);
        const recentCommits = getGitLog(rootPath, 20);

        return createResponse({
          rootPath,
          directoryTree,
          packageInfo,
          prismaModels: prismaModels.length > 0 ? prismaModels : null,
          recentCommits: recentCommits.length > 0 ? recentCommits : null,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__analyze_file_impact
  // ==========================================================================
  server.registerTool(
    "spectree__analyze_file_impact",
    {
      description:
        "Analyze the impact of modifying specific files.\n\n" +
        "For each file path provided, returns:\n" +
        "- Whether the file exists\n" +
        "- Line count\n" +
        "- Import statements (what it depends on)\n" +
        "- Export statements (what it exposes)\n" +
        "- Files that import from this file (dependents)\n\n" +
        "Use this AFTER decomposing features to verify that proposed file paths exist " +
        "and to understand the ripple effect of modifications.",
      inputSchema: {
        rootPath: z
          .string()
          .describe(
            "Absolute path to the project root (used for resolving relative paths and finding dependents)."
          ),
        filePaths: z
          .array(z.string())
          .min(1)
          .max(20)
          .describe(
            "Array of file paths to analyze. Can be absolute or relative to rootPath. Max 20 files."
          ),
      },
    },
    async (input) => {
      try {
        const rootPath = path.resolve(input.rootPath);

        const results = input.filePaths.map((filePath) => {
          const resolvedPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(rootPath, filePath);
          const relativePath = path.relative(rootPath, resolvedPath);

          const exists = fs.existsSync(resolvedPath);

          if (!exists) {
            return {
              path: relativePath,
              exists: false,
              lineCount: 0,
              imports: [],
              exports: [],
              dependents: [],
            };
          }

          const lineCount = countLines(resolvedPath);
          const { imports, exports } = extractImportsExports(resolvedPath);
          const dependents = findDependents(rootPath, resolvedPath);

          return {
            path: relativePath,
            exists: true,
            lineCount,
            imports,
            exports,
            dependents,
          };
        });

        const existingCount = results.filter((r) => r.exists).length;
        const missingCount = results.filter((r) => !r.exists).length;

        return createResponse({
          summary: {
            totalFiles: results.length,
            existing: existingCount,
            missing: missingCount,
          },
          files: results,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
