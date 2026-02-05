/**
 * Phase Executor
 *
 * Executes a single phase from the execution plan, handling both parallel and
 * sequential items. This is the core component that bridges the AgentPool with
 * the execution plan phases.
 *
 * Features:
 * - Parallel execution with separate branches per item
 * - Sequential execution with shared branch
 * - SpecTree progress tracking integration
 * - Event emissions for UI consumption
 * - Graceful error handling with per-item failure isolation
 *
 * @example
 * ```typescript
 * const executor = new PhaseExecutor({
 *   agentPool,
 *   branchManager,
 *   specTreeClient,
 * });
 *
 * executor.on('item:start', (item) => console.log(`Starting ${item.identifier}`));
 * executor.on('item:complete', (item, result) => console.log(`Done ${item.identifier}`));
 *
 * const result = await executor.executePhase(phase);
 * console.log(`Phase completed: ${result.completedItems.length} items`);
 * ```
 */

import { EventEmitter } from "events";
import {
  AgentPool,
  type Agent,
  type AgentResult,
} from "./agent-pool.js";
import { BranchManager } from "../git/branch-manager.js";
import type {
  SpecTreeClient,
  ExecutionItem,
  ExecutionPhase,
} from "../spectree/api-client.js";
import { AgentError, OrchestratorError, wrapError } from "../errors.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Result of executing a single item
 */
export interface ItemResult {
  /** Item ID */
  itemId: string;
  /** Item identifier (e.g., "COM-5") */
  identifier: string;
  /** Item type */
  type: "feature" | "task";
  /** Whether the item completed successfully */
  success: boolean;
  /** Summary of what was done */
  summary?: string;
  /** Error if failed */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
  /** Branch used for this item */
  branch?: string;
}

/**
 * Result of executing a phase
 */
export interface PhaseResult {
  /** Phase order number */
  phase: number;
  /** Whether all items completed successfully */
  success: boolean;
  /** Array of completed item identifiers */
  completedItems: string[];
  /** Array of failed item identifiers */
  failedItems: string[];
  /** Individual item results */
  itemResults: ItemResult[];
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Options for PhaseExecutor
 */
export interface PhaseExecutorOptions {
  /** Agent pool for spawning agents */
  agentPool: AgentPool;
  /** Branch manager for git operations */
  branchManager: BranchManager;
  /** SpecTree client for API operations */
  specTreeClient: SpecTreeClient;
  /** Session ID for SpecTree progress tracking */
  sessionId?: string;
  /** Base branch to create feature branches from (default: auto-detect) */
  baseBranch?: string;
}

/**
 * Event types emitted by PhaseExecutor
 */
export interface PhaseExecutorEvents {
  "phase:start": (phase: ExecutionPhase) => void;
  "phase:complete": (phase: ExecutionPhase, result: PhaseResult) => void;
  "item:start": (item: ExecutionItem, branch?: string) => void;
  "item:progress": (item: ExecutionItem, progress: number, message?: string) => void;
  "item:complete": (item: ExecutionItem, result: ItemResult) => void;
  "item:error": (item: ExecutionItem, error: Error) => void;
}

// =============================================================================
// PhaseExecutor Class
// =============================================================================

/**
 * Executes a single phase from the execution plan.
 *
 * Handles both parallel and sequential execution modes based on the phase's
 * `canRunInParallel` flag.
 */
export class PhaseExecutor extends EventEmitter {
  private agentPool: AgentPool;
  private branchManager: BranchManager;
  private specTreeClient: SpecTreeClient;
  private sessionId: string | undefined;
  private baseBranch: string | undefined;

  constructor(options: PhaseExecutorOptions) {
    super();
    this.agentPool = options.agentPool;
    this.branchManager = options.branchManager;
    this.specTreeClient = options.specTreeClient;
    this.sessionId = options.sessionId;
    this.baseBranch = options.baseBranch;
  }

  // ---------------------------------------------------------------------------
  // Main Execution Method
  // ---------------------------------------------------------------------------

  /**
   * Execute all items in a phase.
   *
   * @param phase - The execution phase to run
   * @returns Phase result with completed/failed items
   */
  async executePhase(phase: ExecutionPhase): Promise<PhaseResult> {
    const startTime = Date.now();

    // Emit phase start event
    this.emit("phase:start", phase);

    // Determine base branch for creating feature branches
    const baseBranch = this.baseBranch ?? (await this.branchManager.getDefaultBranch());

    let itemResults: ItemResult[];

    try {
      if (phase.canRunInParallel && phase.items.length > 1) {
        // Execute items in parallel
        itemResults = await this.executeParallel(phase.items, baseBranch);
      } else {
        // Execute items sequentially
        itemResults = await this.executeSequential(phase.items, baseBranch);
      }
    } catch (error) {
      // Wrap unexpected errors
      const wrappedError = wrapError(error, "Phase execution failed");
      
      // Create partial result with all items failed
      const failedItems = phase.items.map((item) => item.identifier);
      const result: PhaseResult = {
        phase: phase.order,
        success: false,
        completedItems: [],
        failedItems,
        itemResults: phase.items.map((item) => ({
          itemId: item.id,
          identifier: item.identifier,
          type: item.type,
          success: false,
          error: wrappedError,
          duration: Date.now() - startTime,
        })),
        duration: Date.now() - startTime,
      };

      this.emit("phase:complete", phase, result);
      return result;
    }

    // Build phase result
    const completedItems = itemResults
      .filter((r) => r.success)
      .map((r) => r.identifier);
    const failedItems = itemResults
      .filter((r) => !r.success)
      .map((r) => r.identifier);

    const result: PhaseResult = {
      phase: phase.order,
      success: failedItems.length === 0,
      completedItems,
      failedItems,
      itemResults,
      duration: Date.now() - startTime,
    };

    // Emit phase complete event
    this.emit("phase:complete", phase, result);

    return result;
  }

  // ---------------------------------------------------------------------------
  // Parallel Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute items in parallel.
   *
   * Each item gets its own branch and agent. All agents run concurrently.
   *
   * @param items - Items to execute
   * @param baseBranch - Base branch to create feature branches from
   * @returns Array of item results
   */
  private async executeParallel(
    items: ExecutionItem[],
    baseBranch: string
  ): Promise<ItemResult[]> {
    const agentPromises: Array<{
      item: ExecutionItem;
      agent: Agent;
      branch: string;
      promise: Promise<AgentResult>;
    }> = [];

    // Spawn agents for all items
    for (const item of items) {
      try {
        // 1. Generate branch name for this item
        const branchName = this.branchManager.generateBranchName(
          item.identifier,
          item.title
        );

        // 2. Create branch (will checkout if already exists)
        await this.branchManager.createBranch(branchName, baseBranch);

        // 3. Spawn agent
        const agent = await this.agentPool.spawnAgent(item, branchName);

        // Emit item start event
        this.emit("item:start", item, branchName);

        // 4. Mark work started in SpecTree
        await this.markWorkStarted(item);

        // 5. Start agent working (non-blocking)
        const taskPrompt = this.buildTaskPrompt(item);
        const promise = this.agentPool.startAgent(agent.id, taskPrompt);

        agentPromises.push({ item, agent, branch: branchName, promise });
      } catch (error) {
        // If agent spawn fails, record as failed item
        const itemError =
          error instanceof AgentError
            ? error
            : AgentError.spawnFailed(
                `spawn-${item.identifier}`,
                item.id,
                error instanceof Error ? error : undefined
              );

        this.emit("item:error", item, itemError);

        // Add a "failed" entry to results
        agentPromises.push({
          item,
          agent: null as unknown as Agent,
          branch: "",
          promise: Promise.resolve({
            agentId: `spawn-failed-${item.identifier}`,
            taskId: item.id,
            success: false,
            error: itemError,
            duration: 0,
          }),
        });
      }
    }

    // Wait for all agents to complete
    const agentResults = await Promise.all(
      agentPromises.map((ap) => ap.promise)
    );

    // Convert agent results to item results
    const itemResults: ItemResult[] = [];

    for (let i = 0; i < agentPromises.length; i++) {
      const { item, branch } = agentPromises[i]!;
      const agentResult = agentResults[i]!;

      const itemResult: ItemResult = {
        itemId: item.id,
        identifier: item.identifier,
        type: item.type,
        success: agentResult.success,
        duration: agentResult.duration,
        branch,
      };

      // Only include optional properties if defined
      if (agentResult.summary !== undefined) {
        itemResult.summary = agentResult.summary;
      }
      if (agentResult.error !== undefined) {
        itemResult.error = agentResult.error;
      }

      itemResults.push(itemResult);

      // Mark work completed/failed in SpecTree
      if (agentResult.success) {
        await this.markWorkCompleted(item, agentResult.summary);
        this.emit("item:complete", item, itemResult);
      } else {
        this.emit("item:error", item, agentResult.error ?? new Error("Unknown error"));
      }
    }

    return itemResults;
  }

  // ---------------------------------------------------------------------------
  // Sequential Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute items sequentially.
   *
   * Items are executed one at a time. Can optionally share a branch or use
   * individual branches.
   *
   * @param items - Items to execute
   * @param baseBranch - Base branch (used for creating a shared branch)
   * @returns Array of item results
   */
  private async executeSequential(
    items: ExecutionItem[],
    baseBranch: string
  ): Promise<ItemResult[]> {
    const results: ItemResult[] = [];

    // For sequential execution, we use a shared branch for all items
    // This avoids creating many branches for dependent work
    let sharedBranch: string | undefined;

    for (const item of items) {
      const startTime = Date.now();

      try {
        // Create shared branch on first item
        if (!sharedBranch) {
          sharedBranch = this.branchManager.generateBranchName(
            items[0]!.identifier,
            `sequential-${items.length}-items`
          );
          await this.branchManager.createBranch(sharedBranch, baseBranch);
        }

        // Emit item start event
        this.emit("item:start", item, sharedBranch);

        // Mark work started in SpecTree
        await this.markWorkStarted(item);

        // Execute single item
        const result = await this.executeSingleItem(item, sharedBranch);
        results.push(result);

        if (result.success) {
          // Mark work completed in SpecTree
          await this.markWorkCompleted(item, result.summary);
          this.emit("item:complete", item, result);
        } else {
          this.emit("item:error", item, result.error ?? new Error("Unknown error"));
          // Stop on first failure for sequential execution
          break;
        }
      } catch (error) {
        const itemError = wrapError(error, `Failed to execute ${item.identifier}`);
        const result: ItemResult = {
          itemId: item.id,
          identifier: item.identifier,
          type: item.type,
          success: false,
          error: itemError,
          duration: Date.now() - startTime,
        };
        if (sharedBranch !== undefined) {
          result.branch = sharedBranch;
        }
        results.push(result);

        this.emit("item:error", item, itemError);

        // Stop on first failure for sequential execution
        break;
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Single Item Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a single item using the agent pool.
   *
   * @param item - Item to execute
   * @param branch - Branch to work on
   * @returns Item result
   */
  private async executeSingleItem(
    item: ExecutionItem,
    branch: string
  ): Promise<ItemResult> {
    const startTime = Date.now();

    try {
      // 1. Spawn agent
      const agent = await this.agentPool.spawnAgent(item, branch);

      // 2. Build task prompt
      const taskPrompt = this.buildTaskPrompt(item);

      // 3. Start agent and wait for completion
      const agentResult = await this.agentPool.startAgent(agent.id, taskPrompt);

      // 4. Clean up agent from pool
      this.agentPool.removeAgent(agent.id);

      const result: ItemResult = {
        itemId: item.id,
        identifier: item.identifier,
        type: item.type,
        success: agentResult.success,
        duration: agentResult.duration,
        branch,
      };

      if (agentResult.summary !== undefined) {
        result.summary = agentResult.summary;
      }
      if (agentResult.error !== undefined) {
        result.error = agentResult.error;
      }

      return result;
    } catch (error) {
      const itemError =
        error instanceof OrchestratorError
          ? error
          : AgentError.executionFailed(
              `single-${item.identifier}`,
              item.id,
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error : undefined
            );

      return {
        itemId: item.id,
        identifier: item.identifier,
        type: item.type,
        success: false,
        error: itemError,
        duration: Date.now() - startTime,
        branch,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // SpecTree Integration
  // ---------------------------------------------------------------------------

  /**
   * Mark work started in SpecTree.
   */
  private async markWorkStarted(item: ExecutionItem): Promise<void> {
    try {
      const input = this.sessionId ? { sessionId: this.sessionId } : undefined;
      await this.specTreeClient.startWork(item.type, item.id, input);
    } catch (error) {
      // Log but don't fail on SpecTree tracking errors
      // The actual work is more important than tracking
      console.warn(
        `Failed to mark work started for ${item.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Mark work completed in SpecTree.
   */
  private async markWorkCompleted(
    item: ExecutionItem,
    summary?: string
  ): Promise<void> {
    try {
      let input: { summary?: string; sessionId?: string } | undefined;
      
      if (this.sessionId) {
        input = { sessionId: this.sessionId };
        if (summary !== undefined) {
          input.summary = summary;
        }
      } else if (summary !== undefined) {
        input = { summary };
      }
      
      await this.specTreeClient.completeWork(item.type, item.id, input);
    } catch (error) {
      // Log but don't fail on SpecTree tracking errors
      console.warn(
        `Failed to mark work completed for ${item.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt Building
  // ---------------------------------------------------------------------------

  /**
   * Build the task prompt for an agent.
   */
  private buildTaskPrompt(item: ExecutionItem): string {
    const parts: string[] = [];

    parts.push(`# Task: ${item.title}`);
    parts.push(`**Identifier:** ${item.identifier}`);
    parts.push(`**Type:** ${item.type}`);

    if (item.description) {
      parts.push(`\n## Description\n\n${item.description}`);
    }

    if (item.estimatedComplexity) {
      parts.push(`\n**Estimated Complexity:** ${item.estimatedComplexity}`);
    }

    if (item.dependencies.length > 0) {
      parts.push(`\n**Dependencies:** ${item.dependencies.join(", ")}`);
    }

    parts.push(`\n## Instructions

1. Implement the task according to the description above
2. Use log_progress to report significant milestones
3. Use log_decision to record any important choices
4. Link files you create or modify with link_code_file
5. When complete, provide a brief summary of what you did`);

    return parts.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Set the session ID for SpecTree tracking.
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Set the base branch for creating feature branches.
   */
  setBaseBranch(baseBranch: string): void {
    this.baseBranch = baseBranch;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new PhaseExecutor instance.
 *
 * @param options - Executor options
 * @returns A new PhaseExecutor instance
 */
export function createPhaseExecutor(options: PhaseExecutorOptions): PhaseExecutor {
  return new PhaseExecutor(options);
}
