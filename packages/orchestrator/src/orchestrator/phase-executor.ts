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
  DispatcherClient,
  ExecutionItem,
  ExecutionPhase,
  Task,
} from "../spectree/api-client.js";
import { AgentError, OrchestratorError, wrapError } from "../errors.js";
import { SessionEventType } from "@dispatcher/shared";

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
  specTreeClient: DispatcherClient;
  /** Session ID for SpecTree progress tracking */
  sessionId?: string;
  /** Base branch to create feature branches from (default: auto-detect) */
  baseBranch?: string;
  /** Execute each task with its own agent (fresh context per task) */
  taskLevelAgents?: boolean;
}

/**
 * Streaming progress event from an agent
 */
export interface TaskProgressEvent {
  item: ExecutionItem;
  type: "message" | "tool-call" | "tool-result";
  message?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
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
  // Task-level events
  "task:start": (task: Task, feature: ExecutionItem, branch?: string) => void;
  "task:complete": (task: Task, feature: ExecutionItem, success: boolean) => void;
  "task:error": (task: Task, feature: ExecutionItem, error: Error) => void;
  // Streaming progress events
  "task:progress": (data: TaskProgressEvent) => void;
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
  private specTreeClient: DispatcherClient;
  private sessionId: string | undefined;
  private baseBranch: string | undefined;
  private taskLevelAgents: boolean;

  constructor(options: PhaseExecutorOptions) {
    super();
    this.agentPool = options.agentPool;
    this.branchManager = options.branchManager;
    this.specTreeClient = options.specTreeClient;
    this.sessionId = options.sessionId;
    this.baseBranch = options.baseBranch;
    this.taskLevelAgents = options.taskLevelAgents ?? true; // Default to task-level agents

    // Forward streaming events from AgentPool as task:progress
    this.agentPool.on("agent:message", (agent, chunk) => {
      this.emit("task:progress", {
        item: agent.item,
        type: "message",
        message: chunk,
      } satisfies TaskProgressEvent);
    });

    this.agentPool.on("agent:tool-call", (agent, toolName, toolArgs) => {
      this.emit("task:progress", {
        item: agent.item,
        type: "tool-call",
        toolName,
        toolArgs,
      } satisfies TaskProgressEvent);
    });

    this.agentPool.on("agent:tool-result", (agent, toolName, result) => {
      this.emit("task:progress", {
        item: agent.item,
        type: "tool-result",
        toolName,
        toolResult: result,
      } satisfies TaskProgressEvent);
    });
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

        // 2.5 Link branch to SpecTree item
        try {
          await this.specTreeClient.linkBranch(item.type, item.id, branchName);
        } catch (e) {
          console.warn(`Failed to link branch for ${item.identifier}:`, e instanceof Error ? e.message : e);
        }

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
   * If taskLevelAgents is enabled (default), fetches tasks for the feature
   * and spawns a separate agent for each task (fresh context per task).
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

    // If task-level agents enabled and this is a feature, execute each task separately
    if (this.taskLevelAgents && item.type === "feature") {
      return this.executeFeatureWithTaskLevelAgents(item, branch, startTime);
    }

    // Otherwise, execute the item with a single agent (original behavior)
    return this.executeSingleItemDirectly(item, branch, startTime);
  }

  /**
   * Execute a feature by spawning a separate agent for each task.
   * This ensures fresh context for each task, avoiding context compaction.
   */
  private async executeFeatureWithTaskLevelAgents(
    feature: ExecutionItem,
    branch: string,
    startTime: number
  ): Promise<ItemResult> {
    try {
      // Emit SESSION_FEATURE_STARTED event
      await this.emitFeatureStartedEvent(feature);

      // 1. Fetch tasks for this feature
      const tasksResponse = await this.specTreeClient.listTasks({ featureId: feature.id, limit: 100 });
      const tasks = tasksResponse.data;

      if (tasks.length === 0) {
        // No tasks - execute feature directly
        console.log(`  📋 Feature ${feature.identifier} has no tasks, executing directly`);
        return this.executeSingleItemDirectly(feature, branch, startTime);
      }

      console.log(`  📋 Feature ${feature.identifier}: Executing ${tasks.length} tasks with individual agents`);

      // 2. Sort tasks by execution order
      const sortedTasks = [...tasks].sort((a, b) => {
        const orderA = a.executionOrder ?? a.sortOrder ?? 0;
        const orderB = b.executionOrder ?? b.sortOrder ?? 0;
        return orderA - orderB;
      });

      // 3. Group tasks by parallel capability
      const taskResults: { task: Task; success: boolean; error?: Error }[] = [];
      let currentParallelGroup: Task[] = [];
      let lastParallelGroup: string | null = null;

      for (let i = 0; i < sortedTasks.length; i++) {
        const task = sortedTasks[i]!;
        const isLastTask = i === sortedTasks.length - 1;

        // Check if this task can be grouped with previous tasks
        if (task.canParallelize && task.parallelGroup === lastParallelGroup && lastParallelGroup !== null) {
          currentParallelGroup.push(task);
        } else {
          // Execute any pending parallel group
          if (currentParallelGroup.length > 0) {
            const groupResults = await this.executeTaskGroup(currentParallelGroup, feature, branch);
            taskResults.push(...groupResults);
            
            // Check for failures
            const failed = groupResults.find(r => !r.success);
            if (failed) {
              return await this.buildFeatureResult(feature, taskResults, startTime, branch);
            }
          }

          // Start new group or execute single task
          if (task.canParallelize && task.parallelGroup) {
            currentParallelGroup = [task];
            lastParallelGroup = task.parallelGroup;
          } else {
            // Execute task immediately (sequential)
            currentParallelGroup = [];
            lastParallelGroup = null;
            const result = await this.executeSingleTask(task, feature, branch);
            taskResults.push(result);
            
            if (!result.success) {
              return await this.buildFeatureResult(feature, taskResults, startTime, branch);
            }
          }
        }

        // Handle last task
        if (isLastTask && currentParallelGroup.length > 0) {
          const groupResults = await this.executeTaskGroup(currentParallelGroup, feature, branch);
          taskResults.push(...groupResults);
        }
      }

      return await this.buildFeatureResult(feature, taskResults, startTime, branch);

    } catch (error) {
      const itemError = wrapError(error, `Failed to execute feature ${feature.identifier} with task-level agents`);
      return {
        itemId: feature.id,
        identifier: feature.identifier,
        type: feature.type,
        success: false,
        error: itemError,
        duration: Date.now() - startTime,
        branch,
      };
    }
  }

  /**
   * Build feature result from task results.
   */
  private async buildFeatureResult(
    feature: ExecutionItem,
    taskResults: { task: Task; success: boolean; error?: Error }[],
    startTime: number,
    branch: string
  ): Promise<ItemResult> {
    const allSucceeded = taskResults.every(r => r.success);
    const completedTasks = taskResults.filter(r => r.success).map(r => r.task.identifier);
    const failedTasks = taskResults.filter(r => !r.success).map(r => r.task.identifier);

    const result: ItemResult = {
      itemId: feature.id,
      identifier: feature.identifier,
      type: feature.type,
      success: allSucceeded,
      duration: Date.now() - startTime,
      branch,
      summary: allSucceeded 
        ? `Completed ${completedTasks.length} tasks: ${completedTasks.join(", ")}`
        : `Failed at tasks: ${failedTasks.join(", ")}. Completed: ${completedTasks.join(", ") || "none"}`,
    };

    if (!allSucceeded) {
      const firstError = taskResults.find(r => !r.success)?.error;
      if (firstError) {
        result.error = firstError;
      }
    }

    // Emit SESSION_FEATURE_COMPLETED event
    const completedTaskCount = taskResults.filter(r => r.success).length;
    await this.emitFeatureCompletedEvent(feature, startTime, completedTaskCount);

    return result;
  }

  /**
   * Execute a group of parallelizable tasks simultaneously.
   */
  private async executeTaskGroup(
    tasks: Task[],
    feature: ExecutionItem,
    branch: string
  ): Promise<{ task: Task; success: boolean; error?: Error }[]> {
    console.log(`    🔀 Executing ${tasks.length} tasks in parallel: ${tasks.map(t => t.identifier).join(", ")}`);

    const promises = tasks.map(task => this.executeSingleTask(task, feature, branch));
    return Promise.all(promises);
  }

  /**
   * Execute a single task with its own dedicated agent.
   * This creates a fresh Copilot session with clean context.
   */
  private async executeSingleTask(
    task: Task,
    feature: ExecutionItem,
    branch: string
  ): Promise<{ task: Task; success: boolean; error?: Error }> {
    const taskStartTime = Date.now();

    // Emit task start event
    this.emit("task:start", task, feature, branch);
    console.log(`    🤖 Starting agent for task ${task.identifier}: ${task.title}`);

    try {
      // Mark task as started in SpecTree
      await this.markTaskStarted(task);

      // Emit SESSION_TASK_STARTED event
      await this.emitTaskStartedEvent(task, feature);

      // Convert Task to ExecutionItem format for agent pool
      const taskItem: ExecutionItem = {
        type: "task",
        id: task.id,
        identifier: task.identifier,
        title: task.title,
        description: task.description,
        statusId: task.statusId,
        executionOrder: task.executionOrder,
        canParallelize: task.canParallelize,
        parallelGroup: task.parallelGroup,
        dependencies: task.dependencies ? JSON.parse(task.dependencies) : [],
        estimatedComplexity: task.estimatedComplexity,
      };

      // Spawn a fresh agent for this task
      const agent = await this.agentPool.spawnAgent(taskItem, branch);

      // Build prompt with feature context
      const taskPrompt = this.buildTaskPromptWithFeatureContext(task, feature);

      // Execute and wait
      const agentResult = await this.agentPool.startAgent(agent.id, taskPrompt);

      // Clean up agent
      this.agentPool.removeAgent(agent.id);

      // Mark task as completed in SpecTree
      if (agentResult.success) {
        await this.markTaskCompleted(task, agentResult.summary);
        
        // Emit SESSION_TASK_COMPLETED event
        await this.emitTaskCompletedEvent(task, feature, taskStartTime, true);
        
        this.emit("task:complete", task, feature, true);
        console.log(`    ✅ Task ${task.identifier} completed (${((Date.now() - taskStartTime) / 1000).toFixed(1)}s)`);
      } else {
        this.emit("task:error", task, feature, agentResult.error ?? new Error("Unknown error"));
        console.log(`    ❌ Task ${task.identifier} failed`);
      }

      const taskResult: { task: Task; success: boolean; error?: Error } = {
        task,
        success: agentResult.success,
      };
      if (agentResult.error) {
        taskResult.error = agentResult.error;
      }
      return taskResult;

    } catch (error) {
      const taskError = wrapError(error, `Failed to execute task ${task.identifier}`);
      this.emit("task:error", task, feature, taskError);
      console.log(`    ❌ Task ${task.identifier} error: ${taskError.message}`);

      return {
        task,
        success: false,
        error: taskError,
      };
    }
  }

  /**
   * Build a task prompt that includes feature context.
   */
  private buildTaskPromptWithFeatureContext(task: Task, feature: ExecutionItem): string {
    const parts: string[] = [];

    parts.push(`# Task: ${task.title}`);
    parts.push(`**Task ID:** ${task.id}`);
    parts.push(`**Task Identifier:** ${task.identifier}`);
    parts.push(`**Task Type:** task`);
    parts.push(`**Parent Feature:** ${feature.identifier} - ${feature.title}`);
    parts.push(`**Epic ID:** ${feature.epicId || "unknown"}`);

    if (task.description) {
      parts.push(`\n## Task Description\n\n${task.description}`);
    }

    if (feature.description) {
      parts.push(`\n## Feature Context\n\n${feature.description}`);
    }

    if (task.estimatedComplexity) {
      parts.push(`\n**Estimated Complexity:** ${task.estimatedComplexity}`);
    }

    parts.push(`\n## Progress Tracking Tools

You MUST use these tools to document your work. This creates a permanent record of what was done.

### log_progress - Report what you're doing
Call this tool periodically to record progress:
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}",
  "message": "Describe what you just completed or are working on",
  "percentComplete": 50
}
\`\`\`

### log_decision - Record important choices
Call this tool when making implementation decisions:
\`\`\`json
{
  "type": "task", 
  "taskId": "${task.id}",
  "epicId": "${feature.epicId || ""}",
  "question": "What decision was needed?",
  "decision": "What you decided",
  "rationale": "Why you made this choice",
  "category": "approach"
}
\`\`\`
Categories: architecture, library, approach, scope, design, tradeoff, deferral

### link_code_file - Track files you modify
Call this for EVERY file you create or modify:
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}",
  "filePath": "src/path/to/file.ts"
}
\`\`\`

### append_ai_note - Leave notes for future sessions
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}",
  "noteType": "observation",
  "content": "Description of what you observed or learned"
}
\`\`\`
noteTypes: observation, decision, blocker, next-steps, context

### get_structured_description - Read acceptance criteria
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}"
}
\`\`\`

### get_ai_context - Read previous session context
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}"
}
\`\`\`

### run_all_validations - Verify before completing
\`\`\`json
{
  "taskId": "${task.id}"
}
\`\`\`

### report_blocker - Report blocking issues
\`\`\`json
{
  "type": "task",
  "id": "${task.identifier}",
  "description": "What is blocking progress"
}
\`\`\`

## Instructions

1. **READ** requirements: call get_structured_description and get_ai_context for ${task.identifier}
2. **START** by calling log_progress with "Starting work on ${task.identifier}"
3. Focus ONLY on this specific task - do not implement other tasks
4. Call log_progress after completing each significant step
5. Call log_decision when making important choices (library selection, approach, etc.)
6. Call link_code_file for EVERY file you create or modify
7. Call append_ai_note to leave observations for future sessions
8. **VALIDATE** by calling run_all_validations before completing
9. **END** by calling log_progress with a summary and percentComplete: 100

**Important:** This task is part of feature ${feature.identifier}. Other agents handle other tasks.`);

    return parts.join("\n");
  }

  /**
   * Mark task as started in SpecTree.
   */
  private async markTaskStarted(task: Task): Promise<void> {
    try {
      const input = this.sessionId ? { sessionId: this.sessionId } : undefined;
      await this.specTreeClient.startWork("task", task.id, input);
    } catch (error) {
      console.warn(
        `Failed to mark task started for ${task.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Mark task as completed in SpecTree.
   */
  private async markTaskCompleted(task: Task, summary?: string): Promise<void> {
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
      
      await this.specTreeClient.completeWork("task", task.id, input);
    } catch (error) {
      console.warn(
        `Failed to mark task completed for ${task.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Emit SESSION_FEATURE_STARTED event.
   */
  private async emitFeatureStartedEvent(feature: ExecutionItem): Promise<void> {
    if (!this.sessionId || !feature.epicId) {
      return;
    }

    try {
      // Fetch feature details for complete event data
      const featureDetails = await this.specTreeClient.getFeature(feature.id);
      const taskCount = featureDetails.tasks?.length ?? 0;

      await this.specTreeClient.emitSessionEvent({
        eventType: SessionEventType.SESSION_FEATURE_STARTED,
        sessionId: this.sessionId,
        epicId: feature.epicId,
        timestamp: new Date().toISOString(),
        payload: {
          featureId: feature.id,
          identifier: feature.identifier,
          title: feature.title,
          ...(feature.statusId ? { statusId: feature.statusId } : {}),
          ...(featureDetails.status?.name ? { statusName: featureDetails.status.name } : {}),
          ...(taskCount > 0 ? { taskCount } : {}),
        },
      });
    } catch (error) {
      console.warn(
        `Failed to emit SESSION_FEATURE_STARTED for ${feature.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Emit SESSION_FEATURE_COMPLETED event.
   */
  private async emitFeatureCompletedEvent(
    feature: ExecutionItem,
    startTime: number,
    completedTaskCount?: number
  ): Promise<void> {
    if (!this.sessionId || !feature.epicId) {
      return;
    }

    try {
      // Fetch updated feature details
      const featureDetails = await this.specTreeClient.getFeature(feature.id);
      const taskCount = featureDetails.tasks?.length ?? 0;

      await this.specTreeClient.emitSessionEvent({
        eventType: SessionEventType.SESSION_FEATURE_COMPLETED,
        sessionId: this.sessionId,
        epicId: feature.epicId,
        timestamp: new Date().toISOString(),
        payload: {
          featureId: feature.id,
          identifier: feature.identifier,
          title: feature.title,
          ...(feature.statusId ? { statusId: feature.statusId } : {}),
          ...(featureDetails.status?.name ? { statusName: featureDetails.status.name } : {}),
          ...(taskCount > 0 ? { taskCount } : {}),
          ...(completedTaskCount !== undefined ? { completedTaskCount } : {}),
          durationMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      console.warn(
        `Failed to emit SESSION_FEATURE_COMPLETED for ${feature.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Emit SESSION_TASK_STARTED event.
   */
  private async emitTaskStartedEvent(task: Task, feature: ExecutionItem): Promise<void> {
    if (!this.sessionId || !feature.epicId) {
      return;
    }

    try {
      // Fetch task details
      const taskDetails = await this.specTreeClient.getTask(task.id);

      await this.specTreeClient.emitSessionEvent({
        eventType: SessionEventType.SESSION_TASK_STARTED,
        sessionId: this.sessionId,
        epicId: feature.epicId,
        timestamp: new Date().toISOString(),
        payload: {
          taskId: task.id,
          identifier: task.identifier,
          title: task.title,
          featureId: feature.id,
          featureIdentifier: feature.identifier,
          ...(task.statusId ? { statusId: task.statusId } : {}),
          ...(taskDetails.status?.name ? { statusName: taskDetails.status.name } : {}),
        },
      });
    } catch (error) {
      console.warn(
        `Failed to emit SESSION_TASK_STARTED for ${task.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Emit SESSION_TASK_COMPLETED event.
   */
  private async emitTaskCompletedEvent(
    task: Task,
    feature: ExecutionItem,
    startTime: number,
    validationsPassed?: boolean
  ): Promise<void> {
    if (!this.sessionId || !feature.epicId) {
      return;
    }

    try {
      // Fetch updated task details
      const taskDetails = await this.specTreeClient.getTask(task.id);

      await this.specTreeClient.emitSessionEvent({
        eventType: SessionEventType.SESSION_TASK_COMPLETED,
        sessionId: this.sessionId,
        epicId: feature.epicId,
        timestamp: new Date().toISOString(),
        payload: {
          taskId: task.id,
          identifier: task.identifier,
          title: task.title,
          featureId: feature.id,
          featureIdentifier: feature.identifier,
          ...(task.statusId ? { statusId: task.statusId } : {}),
          ...(taskDetails.status?.name ? { statusName: taskDetails.status.name } : {}),
          ...(validationsPassed !== undefined ? { validationsPassed } : {}),
          durationMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      console.warn(
        `Failed to emit SESSION_TASK_COMPLETED for ${task.identifier}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Execute item directly with a single agent (original behavior).
   */
  private async executeSingleItemDirectly(
    item: ExecutionItem,
    branch: string,
    startTime: number
  ): Promise<ItemResult> {
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
      
      // Emit SESSION_FEATURE_STARTED event for features
      if (item.type === "feature") {
        await this.emitFeatureStartedEvent(item);
      }
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
   * Build the task prompt for an agent (used when task-level agents disabled).
   */
  private buildTaskPrompt(item: ExecutionItem): string {
    const parts: string[] = [];

    parts.push(`# ${item.type === "feature" ? "Feature" : "Task"}: ${item.title}`);
    parts.push(`**ID:** ${item.id}`);
    parts.push(`**Identifier:** ${item.identifier}`);
    parts.push(`**Type:** ${item.type}`);
    if (item.epicId) {
      parts.push(`**Epic ID:** ${item.epicId}`);
    }

    if (item.description) {
      parts.push(`\n## Description\n\n${item.description}`);
    }

    if (item.estimatedComplexity) {
      parts.push(`\n**Estimated Complexity:** ${item.estimatedComplexity}`);
    }

    if (item.dependencies.length > 0) {
      parts.push(`\n**Dependencies:** ${item.dependencies.join(", ")}`);
    }

    parts.push(`\n## Progress Tracking Tools

You MUST use these tools to document your work. This creates a permanent record.

### log_progress - Report what you're doing
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}",
  "message": "Describe what you completed or are working on",
  "percentComplete": 50
}
\`\`\`

### log_decision - Record important choices
\`\`\`json
{
  "type": "${item.type}",
  "${item.type === "feature" ? "featureId" : "taskId"}": "${item.id}",
  "epicId": "${item.epicId || ""}",
  "question": "What decision was needed?",
  "decision": "What you decided",
  "rationale": "Why you made this choice",
  "category": "approach"
}
\`\`\`

### link_code_file - Track files you modify
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}",
  "filePath": "src/path/to/file.ts"
}
\`\`\`

### append_ai_note - Leave notes for future sessions
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}",
  "noteType": "observation",
  "content": "Description of what you observed or learned"
}
\`\`\`
noteTypes: observation, decision, blocker, next-steps, context

### get_structured_description - Read acceptance criteria
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}"
}
\`\`\`

### get_ai_context - Read previous session context
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}"
}
\`\`\`

### run_all_validations - Verify before completing
\`\`\`json
{
  "${item.type === "feature" ? "featureId" : "taskId"}": "${item.id}"
}
\`\`\`

### report_blocker - Report blocking issues
\`\`\`json
{
  "type": "${item.type}",
  "id": "${item.identifier}",
  "description": "What is blocking progress"
}
\`\`\`

## Instructions

1. **READ** requirements: call get_structured_description and get_ai_context for ${item.identifier}
2. **START** by calling log_progress with "Starting work on ${item.identifier}"
3. Implement the ${item.type} according to the description
4. Call log_progress after completing each significant step
5. Call log_decision when making important choices
6. Call link_code_file for EVERY file you create or modify
7. Call append_ai_note to leave observations for future sessions
8. **VALIDATE** by calling run_all_validations before completing
9. **END** by calling log_progress with a summary and percentComplete: 100`);

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
