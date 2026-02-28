/**
 * Auto-Retry and Rollback Controller (ENG-47)
 *
 * Manages retry logic for failed validations. On failure, spawns a new
 * Claude Code session with error context. On retry failure, triggers
 * rollback via CheckpointManager and sends a Telegram alert via openclaw.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ClaudeCodeClient } from "../claude/client.js";
import { GitCheckpointManager } from "../git/checkpoint-manager.js";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

export interface RetryState {
  /** Number of retries attempted */
  attempts: number;
  /** Whether the last retry succeeded */
  lastSuccess: boolean;
  /** Error from the last failed attempt */
  lastError?: string | undefined;
}

export interface RetryControllerOptions {
  /** Maximum retries per feature (default: 1) */
  maxRetries?: number;
  /** Working directory */
  cwd?: string;
  /** Checkpoint manager for rollback */
  checkpointManager?: GitCheckpointManager;
  /** Claude client for retry sessions */
  claudeClient?: ClaudeCodeClient;
}

// =============================================================================
// RetryController
// =============================================================================

export class RetryController {
  private maxRetries: number;
  private cwd: string;
  private retryMap: Map<string, RetryState> = new Map();
  private checkpointManager: GitCheckpointManager;
  private claudeClient: ClaudeCodeClient | null;

  constructor(options?: RetryControllerOptions) {
    this.maxRetries = options?.maxRetries ?? 1;
    this.cwd = options?.cwd ?? process.cwd();
    this.checkpointManager = options?.checkpointManager ?? new GitCheckpointManager({ cwd: this.cwd });
    this.claudeClient = options?.claudeClient ?? null;
  }

  /**
   * Check whether a retry should be attempted for the given feature.
   */
  shouldRetry(featureId: string): boolean {
    const state = this.retryMap.get(featureId);
    if (!state) return true; // No attempts yet
    return state.attempts < this.maxRetries;
  }

  /**
   * Attempt a retry by spawning a new Claude Code session with error context.
   * Returns true if the retry session completed without error.
   */
  async retry(featureId: string, errorContext: string): Promise<boolean> {
    const state = this.retryMap.get(featureId) ?? { attempts: 0, lastSuccess: false };
    state.attempts += 1;
    this.retryMap.set(featureId, state);

    if (!this.claudeClient) {
      state.lastError = "No Claude client configured for retries";
      state.lastSuccess = false;
      return false;
    }

    const prompt = this.buildRetryPrompt(featureId, errorContext);

    try {
      const result = await this.claudeClient.executePrompt(prompt, {
        cwd: this.cwd,
        timeoutMs: 600_000, // 10-minute timeout for retry
      });
      state.lastSuccess = true;
      state.lastError = undefined;
      return result.result.length > 0;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      state.lastSuccess = false;
      return false;
    }
  }

  /**
   * Handle a definitive retry failure: rollback and send alert.
   */
  async handleRetryFailure(featureId: string, errorSummary: string): Promise<void> {
    // Rollback via checkpoint
    try {
      const tag = await this.checkpointManager.rollback(featureId);
      console.error(`[RetryController] Rolled back ${featureId} to checkpoint ${tag}`);
    } catch (rollbackError) {
      console.error(`[RetryController] Rollback failed for ${featureId}:`, rollbackError);
    }

    // Send Telegram alert via openclaw
    try {
      const message = `Validation failed for ${featureId} after ${this.maxRetries} retry(ies). Rolled back. Error: ${errorSummary.slice(0, 200)}`;
      await execAsync(`openclaw system event --text "${message.replace(/"/g, '\\"')}" --mode now`);
    } catch {
      console.error(`[RetryController] Failed to send Telegram alert for ${featureId}`);
    }
  }

  /**
   * Get the retry state for a feature.
   */
  getRetryState(featureId: string): RetryState | undefined {
    return this.retryMap.get(featureId);
  }

  /**
   * Reset retry state for a feature.
   */
  resetRetryState(featureId: string): void {
    this.retryMap.delete(featureId);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildRetryPrompt(featureId: string, errorContext: string): string {
    return [
      `# Retry: Fix validation failures for ${featureId}`,
      "",
      "The previous implementation failed validation. Please fix the issues described below.",
      "",
      "## Error Context",
      "",
      errorContext,
      "",
      "## Instructions",
      "",
      "1. Analyze the error output above",
      "2. Identify the root cause of the failure",
      "3. Apply the minimal fix needed",
      "4. Do NOT introduce new features or refactors — only fix the validation failure",
    ].join("\n");
  }
}
