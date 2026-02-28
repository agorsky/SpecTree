/**
 * Git Checkpoint Manager (ENG-43)
 *
 * Provides tag-based checkpoint creation, rollback, and cleanup for
 * the post-execution validation pipeline. Each checkpoint is a lightweight
 * git tag with format: checkpoint/<featureId>/<timestamp>.
 */

import { simpleGit, type SimpleGit, GitError } from "simple-git";
import { OrchestratorError, ErrorCode } from "../errors.js";

// =============================================================================
// Types
// =============================================================================

export interface CheckpointManagerOptions {
  /** Working directory for git operations */
  cwd?: string;
  /** Tag prefix (default: "checkpoint/") */
  tagPrefix?: string;
}

// =============================================================================
// GitCheckpointManager
// =============================================================================

export class GitCheckpointManager {
  private git: SimpleGit;
  private tagPrefix: string;

  constructor(options?: CheckpointManagerOptions) {
    const cwd = options?.cwd ?? process.cwd();
    this.tagPrefix = options?.tagPrefix ?? "checkpoint/";
    this.git = simpleGit({ baseDir: cwd });
  }

  /**
   * Create a checkpoint tag for the given feature identifier.
   * Tag format: checkpoint/<featureId>/<timestamp>
   *
   * @returns The created tag name
   */
  async createCheckpoint(featureId: string): Promise<string> {
    const tag = `${this.tagPrefix}${featureId}/${Date.now()}`;
    try {
      await this.git.tag([tag]);
      return tag;
    } catch (error) {
      throw this.wrapGitError(error, `Failed to create checkpoint tag '${tag}'`);
    }
  }

  /**
   * Get the latest checkpoint tag for a given feature identifier.
   *
   * @returns The latest tag name, or null if none exist
   */
  async getLatestCheckpoint(featureId: string): Promise<string | null> {
    try {
      const prefix = `${this.tagPrefix}${featureId}/`;
      const result = await this.git.tags();
      const matching = result.all.filter((t) => t.startsWith(prefix));
      if (matching.length === 0) return null;

      // Tags include timestamp as suffix — sort descending to get latest
      matching.sort((a, b) => {
        const tsA = parseInt(a.slice(prefix.length), 10);
        const tsB = parseInt(b.slice(prefix.length), 10);
        return tsB - tsA;
      });

      return matching[0]!;
    } catch (error) {
      throw this.wrapGitError(error, `Failed to list checkpoint tags for '${featureId}'`);
    }
  }

  /**
   * Rollback to the latest checkpoint for a feature.
   * Performs a git reset --hard to the checkpoint tag.
   */
  async rollback(featureId: string): Promise<string> {
    const tag = await this.getLatestCheckpoint(featureId);
    if (!tag) {
      throw new OrchestratorError(
        `No checkpoint found for feature '${featureId}'`,
        ErrorCode.GIT_OPERATION_FAILED,
        { context: { featureId }, recoveryHint: "Create a checkpoint before attempting rollback." },
      );
    }

    try {
      await this.git.reset(["--hard", tag]);
      return tag;
    } catch (error) {
      throw this.wrapGitError(error, `Failed to rollback to checkpoint '${tag}'`);
    }
  }

  /**
   * Remove all checkpoint tags for a feature.
   */
  async cleanupCheckpoints(featureId: string): Promise<number> {
    try {
      const prefix = `${this.tagPrefix}${featureId}/`;
      const result = await this.git.tags();
      const matching = result.all.filter((t) => t.startsWith(prefix));

      for (const tag of matching) {
        await this.git.tag(["-d", tag]);
      }

      return matching.length;
    } catch (error) {
      throw this.wrapGitError(error, `Failed to cleanup checkpoint tags for '${featureId}'`);
    }
  }

  /**
   * List all checkpoint tags for a feature.
   */
  async listCheckpoints(featureId: string): Promise<string[]> {
    try {
      const prefix = `${this.tagPrefix}${featureId}/`;
      const result = await this.git.tags();
      return result.all.filter((t) => t.startsWith(prefix));
    } catch (error) {
      throw this.wrapGitError(error, `Failed to list checkpoints for '${featureId}'`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private wrapGitError(error: unknown, message: string): OrchestratorError {
    const gitMessage = error instanceof GitError ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    return new OrchestratorError(
      `${message}: ${gitMessage}`,
      ErrorCode.GIT_OPERATION_FAILED,
      { context: { gitError: gitMessage }, ...(cause ? { cause } : {}) },
    );
  }
}
