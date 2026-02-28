/**
 * MCP Tools for Effort Estimation (ENG-31)
 *
 * Provides an effort estimation engine that scores task complexity based on
 * file analysis, giving the planner agent data-driven complexity assessments.
 *
 * Tools:
 * - spectree__estimate_effort: Analyze files and produce complexity scores
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createResponse, createErrorResponse } from "./utils.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// Effort categories with score ranges
interface EffortResult {
  score: number; // 1-10
  category: "trivial" | "simple" | "moderate" | "complex" | "critical";
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  factors: Record<string, number | string>;
}

/**
 * Count lines of code in a file, excluding blank lines and comments.
 */
function countLOC(filePath: string): { total: number; code: number } {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let code = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (inBlockComment) {
        if (trimmed.includes("*/")) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed.startsWith("/*")) {
        if (!trimmed.includes("*/")) {
          inBlockComment = true;
        }
        continue;
      }

      if (trimmed.length === 0 || trimmed.startsWith("//")) {
        continue;
      }

      code++;
    }

    return { total: lines.length, code };
  } catch {
    return { total: 0, code: 0 };
  }
}

/**
 * Count files that import from a given target.
 */
function countDependents(rootPath: string, targetFile: string): number {
  const basename = path.basename(targetFile).replace(/\.(ts|tsx|js|jsx|mjs)$/, "");

  try {
    const output = execSync(
      `grep -rl --include='*.ts' --include='*.tsx' --include='*.js' -e "from.*${basename}" "${rootPath}" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l`,
      {
        encoding: "utf-8",
        timeout: 10000,
      }
    );
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Compute effort score based on analysis factors.
 */
function computeScore(factors: {
  totalLOC: number;
  totalCodeLOC: number;
  fileCount: number;
  newFileCount: number;
  modifyFileCount: number;
  totalDependents: number;
  newRatio: number;
}): EffortResult {
  let score = 1;

  // Factor 1: Total lines of code to modify/create (0-3 points)
  if (factors.totalCodeLOC > 1000) score += 3;
  else if (factors.totalCodeLOC > 500) score += 2;
  else if (factors.totalCodeLOC > 100) score += 1;

  // Factor 2: Number of files (0-2 points)
  if (factors.fileCount > 10) score += 2;
  else if (factors.fileCount > 5) score += 1;

  // Factor 3: Dependent count — ripple effect (0-2 points)
  if (factors.totalDependents > 20) score += 2;
  else if (factors.totalDependents > 5) score += 1;

  // Factor 4: Modify vs new ratio (0-2 points)
  // Modifying existing files is harder due to needing context
  if (factors.modifyFileCount > factors.newFileCount && factors.modifyFileCount > 3) score += 2;
  else if (factors.modifyFileCount > 0 && factors.modifyFileCount >= factors.newFileCount) score += 1;

  // Factor 5: Total file count bonus for large changes (0-1 point)
  if (factors.fileCount > 15) score += 1;

  // Clamp score to 1-10
  score = Math.min(10, Math.max(1, score));

  // Determine category
  let category: EffortResult["category"];
  let estimatedMinutesMin: number;
  let estimatedMinutesMax: number;

  if (score <= 2) {
    category = "trivial";
    estimatedMinutesMin = 15;
    estimatedMinutesMax = 60;
  } else if (score <= 4) {
    category = "simple";
    estimatedMinutesMin = 60;
    estimatedMinutesMax = 240;
  } else if (score <= 6) {
    category = "moderate";
    estimatedMinutesMin = 240;
    estimatedMinutesMax = 480;
  } else if (score <= 8) {
    category = "complex";
    estimatedMinutesMin = 480;
    estimatedMinutesMax = 1440;
  } else {
    category = "critical";
    estimatedMinutesMin = 1440;
    estimatedMinutesMax = 2880;
  }

  return {
    score,
    category,
    estimatedMinutesMin,
    estimatedMinutesMax,
    factors: {
      totalLOC: factors.totalLOC,
      totalCodeLOC: factors.totalCodeLOC,
      fileCount: factors.fileCount,
      newFiles: factors.newFileCount,
      modifyFiles: factors.modifyFileCount,
      totalDependents: factors.totalDependents,
      newVsModifyRatio: factors.newRatio.toFixed(2),
    },
  };
}

// Register effort estimation tools
export function registerEffortTools(server: McpServer): void {
  // ==========================================================================
  // spectree__estimate_effort
  // ==========================================================================
  server.registerTool(
    "spectree__estimate_effort",
    {
      description:
        "Estimate the effort and complexity of a task based on file analysis.\n\n" +
        "Analyzes the specified files to compute:\n" +
        "- Lines of code (total and code-only)\n" +
        "- Number of files that import from each target (dependents/ripple effect)\n" +
        "- New vs modify ratio\n\n" +
        "Returns a score (1-10), category (trivial/simple/moderate/complex/critical), " +
        "and estimated minutes range.\n\n" +
        "Scoring factors:\n" +
        "- Total LOC: More code = more effort\n" +
        "- File count: More files = more coordination\n" +
        "- Dependent count: More dependents = bigger ripple effect\n" +
        "- New vs modify: Modifying existing code is harder than greenfield\n\n" +
        "Use this during DETAIL stage to set estimatedComplexity and estimatedEffort fields.",
      inputSchema: {
        rootPath: z
          .string()
          .describe(
            "Absolute path to the project root (for resolving paths and finding dependents)."
          ),
        files: z
          .array(
            z.object({
              path: z
                .string()
                .describe(
                  "File path (absolute or relative to rootPath)."
                ),
              isNew: z
                .boolean()
                .describe(
                  "Whether this is a new file to create (true) or an existing file to modify (false)."
                ),
            })
          )
          .min(1)
          .max(50)
          .describe("Array of files involved in this task. Max 50 files."),
        taskDescription: z
          .string()
          .optional()
          .describe(
            "Optional description of the task for context. " +
            "Included in the output for reference but does not affect scoring."
          ),
      },
    },
    async (input) => {
      try {
        const rootPath = path.resolve(input.rootPath);

        let totalLOC = 0;
        let totalCodeLOC = 0;
        let totalDependents = 0;
        let newFileCount = 0;
        let modifyFileCount = 0;

        const fileDetails = input.files.map((file) => {
          const resolvedPath = path.isAbsolute(file.path)
            ? file.path
            : path.join(rootPath, file.path);
          const relativePath = path.relative(rootPath, resolvedPath);
          const exists = fs.existsSync(resolvedPath);

          if (file.isNew) {
            newFileCount++;
            return {
              path: relativePath,
              isNew: true,
              exists,
              loc: { total: 0, code: 0 },
              dependents: 0,
            };
          }

          modifyFileCount++;

          if (!exists) {
            return {
              path: relativePath,
              isNew: false,
              exists: false,
              loc: { total: 0, code: 0 },
              dependents: 0,
              warning: "File does not exist but marked as modify",
            };
          }

          const loc = countLOC(resolvedPath);
          const dependents = countDependents(rootPath, resolvedPath);

          totalLOC += loc.total;
          totalCodeLOC += loc.code;
          totalDependents += dependents;

          return {
            path: relativePath,
            isNew: false,
            exists: true,
            loc,
            dependents,
          };
        });

        const fileCount = input.files.length;
        const newRatio = fileCount > 0 ? newFileCount / fileCount : 0;

        const result = computeScore({
          totalLOC,
          totalCodeLOC,
          fileCount,
          newFileCount,
          modifyFileCount,
          totalDependents,
          newRatio,
        });

        return createResponse({
          taskDescription: input.taskDescription ?? null,
          score: result.score,
          category: result.category,
          estimatedMinutes: {
            min: result.estimatedMinutesMin,
            max: result.estimatedMinutesMax,
          },
          factors: result.factors,
          files: fileDetails,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
