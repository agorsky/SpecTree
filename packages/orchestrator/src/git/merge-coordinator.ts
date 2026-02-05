/**
 * Merge Coordinator for SpecTree Orchestrator
 *
 * Coordinates merging of feature branches back to base branch with conflict detection.
 * Works with BranchManager for parallel agent execution workflows.
 */

import { simpleGit, type SimpleGit, type MergeResult, GitError } from "simple-git";
import { BranchManager } from "./branch-manager.js";
import { OrchestratorError, MergeConflictError, ErrorCode } from "../errors.js";

// =============================================================================
// Types
// =============================================================================

export interface MergeOptions {
  /** Merge but don't auto-commit */
  noCommit?: boolean;
  /** Squash commits into a single commit */
  squash?: boolean;
  /** Custom commit message */
  message?: string;
}

export interface MergeCoordinatorOptions {
  /** Working directory for git operations */
  cwd?: string;
}

// =============================================================================
// Merge Coordinator
// =============================================================================

export class MergeCoordinator {
  private git: SimpleGit;
  private branchManager: BranchManager;

  constructor(branchManager: BranchManager, options?: MergeCoordinatorOptions) {
    const cwd = options?.cwd ?? process.cwd();
    this.git = simpleGit({ baseDir: cwd });
    this.branchManager = branchManager;
  }

  /**
   * Merge a feature branch into a target branch.
   *
   * @param featureBranch - The source branch to merge from
   * @param targetBranch - The target branch to merge into
   * @param options - Merge options
   * @returns MergeResult on success
   * @throws MergeConflictError if conflicts are detected
   * @throws OrchestratorError for other git errors
   */
  async mergeBranch(
    featureBranch: string,
    targetBranch: string,
    options?: MergeOptions
  ): Promise<MergeResult> {
    await this.ensureGitRepo();

    // 1. Ensure clean working directory
    const status = await this.git.status();
    if (!status.isClean()) {
      throw new OrchestratorError(
        "Working directory not clean. Commit or stash changes before merging.",
        ErrorCode.GIT_OPERATION_FAILED,
        {
          recoveryHint: "Run 'git stash' or 'git commit' to save your changes first",
        }
      );
    }

    // 2. Checkout target branch
    await this.branchManager.checkoutFull(targetBranch);

    // 3. Pull latest (if remote exists) - ignore errors for local-only repos
    try {
      await this.git.pull();
    } catch {
      // Ignore - may not have a remote
    }

    // 4. Build merge arguments
    const mergeArgs: string[] = [featureBranch];

    if (options?.noCommit) {
      mergeArgs.push("--no-commit");
    }

    if (options?.squash) {
      mergeArgs.push("--squash");
    }

    if (options?.message) {
      mergeArgs.push("-m", options.message);
    }

    // 5. Attempt merge
    try {
      const result = await this.git.merge(mergeArgs);
      return result;
    } catch (error) {
      // Check if this is a merge conflict
      const conflicts = await this.getConflicts();
      if (conflicts.length > 0) {
        const options: { cause?: Error } = {};
        if (error instanceof Error) {
          options.cause = error;
        }
        throw new MergeConflictError(conflicts, featureBranch, targetBranch, options);
      }

      // Some other git error
      throw this.wrapGitError(
        error,
        `Failed to merge '${featureBranch}' into '${targetBranch}'`
      );
    }
  }

  /**
   * Check if a merge can be performed without conflicts.
   * This performs a dry-run merge without modifying the working directory.
   *
   * @param featureBranch - The source branch to merge from
   * @param targetBranch - The target branch to merge into
   * @returns True if merge can proceed without conflicts
   */
  async canMerge(featureBranch: string, targetBranch: string): Promise<boolean> {
    await this.ensureGitRepo();

    // Save current branch to restore later
    const originalBranch = await this.branchManager.getCurrentBranch();

    try {
      // Checkout target branch
      await this.branchManager.checkoutFull(targetBranch);

      // Try merge with --no-commit to test
      await this.git.merge(["--no-commit", "--no-ff", featureBranch]);

      // If we get here, merge succeeded - abort to clean up
      await this.git.merge(["--abort"]);

      return true;
    } catch {
      // Merge failed - try to abort any partial merge
      try {
        await this.git.merge(["--abort"]);
      } catch {
        // Ignore abort errors
      }

      return false;
    } finally {
      // Restore original branch
      try {
        if (originalBranch !== "(detached)") {
          await this.branchManager.checkoutFull(originalBranch);
        }
      } catch {
        // Best effort restore
      }
    }
  }

  /**
   * Get list of files with merge conflicts in the current working directory.
   *
   * @returns Array of conflicting file paths
   */
  async getConflicts(): Promise<string[]> {
    await this.ensureGitRepo();

    try {
      const status = await this.git.status();
      return status.conflicted;
    } catch (error) {
      throw this.wrapGitError(error, "Failed to get conflict list");
    }
  }

  /**
   * Abort an in-progress merge operation.
   */
  async abortMerge(): Promise<void> {
    await this.ensureGitRepo();

    try {
      await this.git.merge(["--abort"]);
    } catch (error) {
      throw this.wrapGitError(error, "Failed to abort merge");
    }
  }

  /**
   * Complete a merge after manual conflict resolution.
   *
   * @param message - Commit message for the merge
   */
  async completeMerge(message: string): Promise<void> {
    await this.ensureGitRepo();

    try {
      // Check for remaining conflicts
      const conflicts = await this.getConflicts();
      if (conflicts.length > 0) {
        throw new OrchestratorError(
          `Cannot complete merge: ${conflicts.length} unresolved conflict(s)`,
          ErrorCode.MERGE_CONFLICT,
          {
            context: { conflictingFiles: conflicts },
            recoveryHint: `Resolve conflicts in: ${conflicts.join(", ")}`,
          }
        );
      }

      // Stage all changes and commit
      await this.git.add(".");
      await this.git.commit(message);
    } catch (error) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw this.wrapGitError(error, "Failed to complete merge");
    }
  }

  /**
   * Check if there is a merge in progress.
   *
   * @returns True if a merge is in progress
   */
  async isMergeInProgress(): Promise<boolean> {
    await this.ensureGitRepo();

    try {
      const status = await this.git.status();
      // Git status shows conflicted files during a merge
      // Also check for MERGE_HEAD file existence
      return status.conflicted.length > 0;
    } catch (error) {
      throw this.wrapGitError(error, "Failed to check merge status");
    }
  }

  /**
   * Format conflict information for user display.
   *
   * @param featureBranch - Source branch name
   * @param targetBranch - Target branch name
   * @param conflictingFiles - List of conflicting files
   * @returns Formatted guidance string
   */
  formatConflictGuidance(
    featureBranch: string,
    targetBranch: string,
    conflictingFiles: string[]
  ): string {
    const fileList = conflictingFiles.map((f) => `  - ${f}`).join("\n");

    return `Merge conflict detected!

Merging '${featureBranch}' into '${targetBranch}'

Conflicting files:
${fileList}

To resolve:
  1. Open the files and resolve conflicts manually
  2. Run: git add <resolved-files>
  3. Run: spectree-agent continue

Or to abort:
  Run: git merge --abort`;
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Ensure we're in a git repository.
   */
  private async ensureGitRepo(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new OrchestratorError(
          "Not a git repository",
          ErrorCode.GIT_OPERATION_FAILED,
          {
            recoveryHint:
              "Initialize a git repository with 'git init' or navigate to an existing repository",
          }
        );
      }
    } catch (error) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw this.wrapGitError(error, "Failed to verify git repository");
    }
  }

  /**
   * Wrap a git error in an OrchestratorError.
   */
  private wrapGitError(error: unknown, message: string): OrchestratorError {
    const gitMessage = error instanceof GitError ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    const options: {
      cause?: Error;
      context: { gitError: string };
    } = {
      context: { gitError: gitMessage },
    };

    if (cause) {
      options.cause = cause;
    }

    return new OrchestratorError(
      `${message}: ${gitMessage}`,
      ErrorCode.GIT_OPERATION_FAILED,
      options
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new MergeCoordinator instance.
 *
 * @param branchManager - BranchManager instance to use
 * @param options - Coordinator options
 */
export function createMergeCoordinator(
  branchManager: BranchManager,
  options?: MergeCoordinatorOptions
): MergeCoordinator {
  return new MergeCoordinator(branchManager, options);
}
