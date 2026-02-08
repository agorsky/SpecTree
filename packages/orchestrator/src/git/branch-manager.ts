/**
 * Branch Manager for SpecTree Orchestrator
 *
 * Provides git branch management utilities for creating and managing agent branches.
 * Each agent in parallel execution gets its own branch to avoid conflicts.
 */

import { simpleGit, type SimpleGit, GitError } from "simple-git";
import { OrchestratorError, ErrorCode } from "../errors.js";

// =============================================================================
// Types
// =============================================================================

export interface BranchManagerOptions {
  /** Working directory for git operations */
  cwd?: string;
  /** Prefix for branch names (default: "feature/") */
  branchPrefix?: string;
}

// =============================================================================
// Branch Manager
// =============================================================================

export class BranchManager {
  private git: SimpleGit;
  private branchPrefix: string;

  constructor(options?: BranchManagerOptions) {
    const cwd = options?.cwd ?? process.cwd();
    this.branchPrefix = options?.branchPrefix ?? "feature/";
    this.git = simpleGit({ baseDir: cwd });
  }

  /**
   * Create a new branch from base and checkout.
   * If the branch already exists, checks it out instead.
   *
   * @param name - Branch name (without prefix)
   * @param baseBranch - Base branch to create from (defaults to default branch)
   */
  async createBranch(name: string, baseBranch?: string): Promise<void> {
    await this.ensureGitRepo();

    const fullBranchName = this.getFullBranchName(name);
    const base = baseBranch ?? (await this.getDefaultBranch());

    // Check if branch already exists
    if (await this.branchExists(name)) {
      await this.checkout(name);
      return;
    }

    try {
      // Create and checkout the new branch
      await this.git.checkoutBranch(fullBranchName, base);
    } catch (error) {
      throw this.wrapGitError(error, `Failed to create branch '${fullBranchName}' from '${base}'`);
    }
  }

  /**
   * Checkout an existing branch.
   *
   * @param branch - Branch name (without prefix)
   */
  async checkout(branch: string): Promise<void> {
    await this.ensureGitRepo();

    const fullBranchName = this.getFullBranchName(branch);

    try {
      await this.git.checkout(fullBranchName);
    } catch (error) {
      throw this.wrapGitError(error, `Failed to checkout branch '${fullBranchName}'`);
    }
  }

  /**
   * Checkout a branch by its full name (no prefix applied).
   *
   * @param fullBranchName - Full branch name
   */
  async checkoutFull(fullBranchName: string): Promise<void> {
    await this.ensureGitRepo();

    try {
      await this.git.checkout(fullBranchName);
    } catch (error) {
      throw this.wrapGitError(error, `Failed to checkout branch '${fullBranchName}'`);
    }
  }

  /**
   * Get the current branch name.
   *
   * @returns Current branch name, or "(detached)" if in detached HEAD state
   */
  async getCurrentBranch(): Promise<string> {
    await this.ensureGitRepo();

    try {
      const branchSummary = await this.git.branchLocal();

      if (branchSummary.detached) {
        return "(detached)";
      }

      return branchSummary.current;
    } catch (error) {
      throw this.wrapGitError(error, "Failed to get current branch");
    }
  }

  /**
   * Get the hash of the latest commit on the current branch.
   */
  async getLatestCommitHash(): Promise<string | null> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      return log.latest?.hash ?? null;
    } catch {
      return null;
    }
  }

  /**
   * List branches matching an optional pattern.
   *
   * @param pattern - Optional glob pattern to filter branches
   * @returns List of branch names
   */
  async listBranches(pattern?: string): Promise<string[]> {
    await this.ensureGitRepo();

    try {
      const branchSummary = await this.git.branchLocal();
      let branches = branchSummary.all;

      if (pattern) {
        const regex = this.globToRegex(pattern);
        branches = branches.filter((branch) => regex.test(branch));
      }

      return branches;
    } catch (error) {
      throw this.wrapGitError(error, "Failed to list branches");
    }
  }

  /**
   * Check if a branch exists (local only).
   *
   * @param name - Branch name (without prefix, unless checking a full name)
   * @returns True if branch exists
   */
  async branchExists(name: string): Promise<boolean> {
    await this.ensureGitRepo();

    try {
      const fullBranchName = this.getFullBranchName(name);
      const branchSummary = await this.git.branchLocal();
      return branchSummary.all.includes(fullBranchName);
    } catch (error) {
      throw this.wrapGitError(error, `Failed to check if branch '${name}' exists`);
    }
  }

  /**
   * Check if a branch exists by its full name.
   *
   * @param fullBranchName - Full branch name
   * @returns True if branch exists
   */
  async branchExistsFull(fullBranchName: string): Promise<boolean> {
    await this.ensureGitRepo();

    try {
      const branchSummary = await this.git.branchLocal();
      return branchSummary.all.includes(fullBranchName);
    } catch (error) {
      throw this.wrapGitError(error, `Failed to check if branch '${fullBranchName}' exists`);
    }
  }

  /**
   * Delete a branch (local only).
   *
   * @param name - Branch name (without prefix)
   * @param force - Force delete even if not merged
   */
  async deleteBranch(name: string, force = false): Promise<void> {
    await this.ensureGitRepo();

    const fullBranchName = this.getFullBranchName(name);

    try {
      if (force) {
        await this.git.branch(["-D", fullBranchName]);
      } else {
        await this.git.branch(["-d", fullBranchName]);
      }
    } catch (error) {
      throw this.wrapGitError(error, `Failed to delete branch '${fullBranchName}'`);
    }
  }

  /**
   * Delete a branch by its full name (local only).
   *
   * @param fullBranchName - Full branch name
   * @param force - Force delete even if not merged
   */
  async deleteBranchFull(fullBranchName: string, force = false): Promise<void> {
    await this.ensureGitRepo();

    try {
      if (force) {
        await this.git.branch(["-D", fullBranchName]);
      } else {
        await this.git.branch(["-d", fullBranchName]);
      }
    } catch (error) {
      throw this.wrapGitError(error, `Failed to delete branch '${fullBranchName}'`);
    }
  }

  /**
   * Get the default branch (main or master).
   *
   * @returns Default branch name
   */
  async getDefaultBranch(): Promise<string> {
    await this.ensureGitRepo();

    try {
      const branchSummary = await this.git.branchLocal();
      const branches = branchSummary.all;

      // Prefer 'main' over 'master'
      if (branches.includes("main")) {
        return "main";
      }
      if (branches.includes("master")) {
        return "master";
      }

      // Fall back to current branch if neither exists
      if (branchSummary.current && !branchSummary.detached) {
        return branchSummary.current;
      }

      // Last resort: first available branch
      if (branches.length > 0) {
        return branches[0] as string;
      }

      throw new OrchestratorError(
        "No branches found in repository",
        ErrorCode.GIT_OPERATION_FAILED
      );
    } catch (error) {
      if (error instanceof OrchestratorError) {
        throw error;
      }
      throw this.wrapGitError(error, "Failed to determine default branch");
    }
  }

  /**
   * Check if working directory has uncommitted changes.
   *
   * @returns True if there are uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    await this.ensureGitRepo();

    try {
      const status = await this.git.status();
      return !status.isClean();
    } catch (error) {
      throw this.wrapGitError(error, "Failed to check for uncommitted changes");
    }
  }

  /**
   * Generate a branch name from an identifier and title.
   *
   * @param identifier - Issue/task identifier (e.g., "COM-5")
   * @param title - Issue/task title
   * @returns Generated branch name with prefix
   */
  generateBranchName(identifier: string, title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
      .slice(0, 30);

    return `${this.branchPrefix}${identifier}-${slug}`;
  }

  /**
   * Get the branch prefix.
   */
  getBranchPrefix(): string {
    return this.branchPrefix;
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Get full branch name with prefix.
   * If the name already starts with the prefix, return as-is.
   */
  private getFullBranchName(name: string): string {
    if (name.startsWith(this.branchPrefix)) {
      return name;
    }
    return `${this.branchPrefix}${name}`;
  }

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
            recoveryHint: "Initialize a git repository with 'git init' or navigate to an existing repository",
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
   * Convert a glob pattern to a regex.
   */
  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${escaped}$`);
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
 * Create a new BranchManager instance.
 */
export function createBranchManager(options?: BranchManagerOptions): BranchManager {
  return new BranchManager(options);
}
