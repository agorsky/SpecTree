import { z } from "zod";

/**
 * Validation schemas for Code Context entities.
 *
 * Code context links tasks/features to code artifacts like files, functions,
 * git branches, commits, and pull requests for instant code context.
 */

/**
 * Schema for linking a file
 */
export const linkCodeFileSchema = z.object({
  filePath: z.string().min(1).max(500).describe(
    "The file path to link (e.g., 'src/services/user.ts')"
  ),
  reason: z.string().max(500).optional().describe(
    "Optional reason for linking this file"
  ),
});

export type LinkCodeFileInput = z.infer<typeof linkCodeFileSchema>;

/**
 * Schema for unlinking a file
 */
export const unlinkCodeFileSchema = z.object({
  filePath: z.string().min(1).max(500).describe(
    "The file path to unlink"
  ),
});

export type UnlinkCodeFileInput = z.infer<typeof unlinkCodeFileSchema>;

/**
 * Schema for linking a function
 */
export const linkFunctionSchema = z.object({
  filePath: z.string().min(1).max(500).describe(
    "The file path containing the function"
  ),
  functionName: z.string().min(1).max(200).describe(
    "The name of the function"
  ),
  reason: z.string().max(500).optional().describe(
    "Optional reason for linking this function"
  ),
});

export type LinkFunctionInput = z.infer<typeof linkFunctionSchema>;

/**
 * Schema for linking a git branch
 */
export const linkBranchSchema = z.object({
  branchName: z.string().min(1).max(255).describe(
    "The git branch name (e.g., 'feature/COM-7-codebase-integration')"
  ),
});

export type LinkBranchInput = z.infer<typeof linkBranchSchema>;

/**
 * Schema for linking a git commit
 */
export const linkCommitSchema = z.object({
  commitSha: z.string().min(7).max(40).describe(
    "The git commit SHA (short or full, e.g., 'abc1234' or full 40-char)"
  ),
  message: z.string().max(500).optional().describe(
    "Optional commit message for reference"
  ),
});

export type LinkCommitInput = z.infer<typeof linkCommitSchema>;

/**
 * Schema for linking a pull request
 */
export const linkPrSchema = z.object({
  prNumber: z.number().int().positive().describe(
    "The pull request number"
  ),
  prUrl: z.string().url().max(2048).describe(
    "The full URL to the pull request"
  ),
});

export type LinkPrInput = z.infer<typeof linkPrSchema>;

/**
 * Code context response schema
 */
export const codeContextSchema = z.object({
  files: z.array(z.string()).describe("List of related file paths"),
  functions: z.array(z.string()).describe("List of related functions (format: 'file:function')"),
  branch: z.string().nullable().describe("Git branch name"),
  commits: z.array(z.string()).describe("List of commit SHAs"),
  pr: z.object({
    number: z.number().int().positive(),
    url: z.string().url(),
  }).nullable().describe("Pull request info"),
});

export type CodeContext = z.infer<typeof codeContextSchema>;

/**
 * Full code context response schema
 */
export const codeContextResponseSchema = z.object({
  entityType: z.enum(["feature", "task"]),
  entityId: z.string().uuid(),
  identifier: z.string(),
  codeContext: codeContextSchema,
  updatedAt: z.string().datetime(),
});

export type CodeContextResponse = z.infer<typeof codeContextResponseSchema>;
