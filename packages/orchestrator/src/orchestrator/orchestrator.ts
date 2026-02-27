/**
 * Orchestrator with Parallel Agent Support
 *
 * Main orchestration controller that executes work items using phase-based
 * execution with support for both parallel and sequential modes.
 *
 * Features:
 * - Phase-based execution from execution plan
 * - Parallel agent spawning for independent items
 * - Sequential execution for dependent items
 * - Git branch management per parallel item
 * - Branch merging after parallel phases complete
 * - Merge conflict detection with pause/resume support
 * - Progress event emission for UI consumption
 * - Session handoff context for continuity
 * - Resume from specific feature support
 * - Graceful error handling with typed errors
 *
 * @example
 * ```typescript
 * // Parallel execution (default)
 * const orchestrator = new Orchestrator({
 *   client: specTreeClient,
 *   sessionManager,
 *   maxAgents: 4,
 * });
 *
 * const result = await orchestrator.run(epicId);
 *
 * // Force sequential execution
 * const result = await orchestrator.run(epicId, { sequential: true });
 * ```
 */

import { EventEmitter } from "events";
import { AcpSessionManager, type AcpSession } from "../acp/index.js";
import {
  DispatcherClient,
  type ExecutionPlan,
  type ExecutionPhase,
  type ExecutionItem,
  type Session as SpecTreeSession,
  type StartSessionResponse,
  type SessionHandoff,
} from "../spectree/api-client.js";
import {
  AgentError,
  OrchestratorError,
  MergeConflictError,
  ErrorCode,
  wrapError,
  isMergeConflictError,
} from "../errors.js";
import { getConfig } from "../config/index.js";
import { PhaseExecutor, type PhaseResult, type TaskProgressEvent } from "./phase-executor.js";
import { AgentPool } from "./agent-pool.js";
import { BranchManager } from "../git/branch-manager.js";
import { MergeCoordinator } from "../git/merge-coordinator.js";
import { SessionEventType } from "@dispatcher/shared";

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Options for the run() method
 */
export interface RunOptions {
  /** Force sequential execution (no parallel agents) */
  sequential?: boolean;
  /** Start from specific feature identifier (e.g., "COM-5") */
  fromFeature?: string;
  /** Session ID to associate work with */
  sessionId?: string;
  /** Base branch to use for parallel branches (default: auto-detect) */
  baseBranch?: string;
  /** Execute each task with its own dedicated agent (fresh context per task). Default: true */
  taskLevelAgents?: boolean;
}

/**
 * Result of an orchestration run
 */
export interface RunResult {
  /** Whether all items completed successfully */
  success: boolean;
  /** Array of completed item identifiers */
  completedItems: string[];
  /** Array of failed item identifiers */
  failedItems: string[];
  /** Total duration in milliseconds */
  duration: number;
  /** Summary of the run */
  summary?: string;
  /** Merge conflict if execution was paused */
  mergeConflict?: MergeConflictError;
  /** Phase results for detailed analysis */
  phaseResults?: PhaseResult[];
}

/**
 * Result of executing a single item
 */
export interface ItemResult {
  /** Whether the item completed successfully */
  success: boolean;
  /** Item ID */
  itemId: string;
  /** Item identifier (e.g., "COM-5") */
  identifier: string;
  /** Summary of what was done */
  summary?: string;
  /** Error if failed */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Progress event data
 */
export interface ProgressEvent {
  /** Type of progress */
  type: "item:start" | "item:progress" | "item:complete" | "item:error" | "phase:start" | "phase:complete" | "merge:start" | "merge:complete" | "merge:conflict";
  /** Item being worked on */
  item?: ExecutionItem;
  /** Phase being executed */
  phase?: ExecutionPhase;
  /** Message describing progress */
  message?: string;
  /** Percentage complete (0-100) */
  percentComplete?: number;
  /** Error if type is *:error or merge:conflict */
  error?: Error;
  /** Result if type is item:complete */
  result?: ItemResult;
  /** Phase result if type is phase:complete */
  phaseResult?: PhaseResult;
  /** Branch being merged */
  branch?: string;
  // Streaming progress fields
  /** Sub-type for streaming progress (message, tool-call, tool-result) */
  streamingType?: "message" | "tool-call" | "tool-result";
  /** Tool name for tool-call/tool-result events */
  toolName?: string;
  /** Tool arguments for tool-call events */
  toolArgs?: unknown;
  /** Tool result data for tool-result events */
  toolResult?: unknown;
}

/**
 * Orchestrator options
 */
export interface OrchestratorOptions {
  /** SpecTree API client */
  client: DispatcherClient;
  /** ACP session manager for creating sessions */
  sessionManager: AcpSessionManager;
  /** Maximum concurrent agents (default: 4) */
  maxAgents?: number;
  /** Optional branch manager (created if not provided) */
  branchManager?: BranchManager;
  /** Optional merge coordinator (created if not provided) */
  mergeCoordinator?: MergeCoordinator;
  /** Working directory for git operations (default: cwd) */
  cwd?: string;
}

// =============================================================================
// Type declarations for events
// =============================================================================

export interface OrchestratorEvents {
  "item:start": (event: ProgressEvent) => void;
  "item:progress": (event: ProgressEvent) => void;
  "item:complete": (event: ProgressEvent) => void;
  "item:error": (event: ProgressEvent) => void;
  "phase:start": (event: ProgressEvent) => void;
  "phase:complete": (event: ProgressEvent) => void;
  "merge:start": (event: ProgressEvent) => void;
  "merge:complete": (event: ProgressEvent) => void;
  "merge:conflict": (event: ProgressEvent) => void;
}

// =============================================================================
// Agent System Prompt
// =============================================================================

const AGENT_SYSTEM_PROMPT = `You are an AI assistant implementing a task for the SpecTree orchestrator.

Your job is to implement the assigned task according to its description and acceptance criteria. 

## CRITICAL: Progress Tracking

You MUST use the progress tracking tools to document your work. The task prompt will provide the exact IDs to use.

### Required Tool Usage

1. **log_progress** - Call this tool:
   - At the START of your work
   - After each significant milestone
   - At the END with percentComplete: 100 and a summary

2. **log_decision** - Call this tool when you:
   - Choose between alternatives (libraries, approaches, etc.)
   - Make assumptions about requirements
   - Decide to skip or defer something
   - Change direction from the original plan

3. **link_code_file** - Call this tool for EVERY file you:
   - Create
   - Modify
   - Delete

## Workflow

1. Review the task requirements carefully
2. Call log_progress with "Starting work on [identifier]"
3. Plan your approach - if making significant choices, call log_decision
4. Implement step by step, calling log_progress at milestones
5. Call link_code_file for every file touched
6. Test your changes if a test command is available
7. Call log_progress with final summary and percentComplete: 100

## Important Notes

- Make minimal, targeted changes
- Follow existing code patterns and conventions
- Handle errors gracefully
- Document ALL decisions - future agents will reference this history`;

// =============================================================================
// Orchestrator Class
// =============================================================================

/**
 * Orchestrator with Parallel Agent Support
 *
 * Executes work items using phase-based execution with support for both
 * parallel and sequential modes.
 */
export class Orchestrator extends EventEmitter {
  private client: DispatcherClient;
  private sessionManager: AcpSessionManager;
  private maxAgents: number;
  private activeSession: AcpSession | null = null;
  private spectreeSession: SpecTreeSession | null = null;
  private branchManager: BranchManager;
  private mergeCoordinator: MergeCoordinator;
  private agentPool: AgentPool | null = null;
  private phaseExecutor: PhaseExecutor | null = null;

  // Track execution state for resume support
  private executionPlan: ExecutionPlan | null = null;
  private phaseResults: PhaseResult[] = [];
  private completedItems: string[] = [];
  private failedItems: string[] = [];

  constructor(options: OrchestratorOptions) {
    super();
    this.client = options.client;
    this.sessionManager = options.sessionManager;
    this.maxAgents = options.maxAgents ?? getConfig().maxConcurrentAgents ?? 4;

    // Initialize git integration
    const branchManagerOpts = options.cwd ? { cwd: options.cwd } : undefined;
    this.branchManager = options.branchManager ?? new BranchManager(branchManagerOpts);
    const mergeCoordOpts = options.cwd ? { cwd: options.cwd } : undefined;
    this.mergeCoordinator =
      options.mergeCoordinator ?? new MergeCoordinator(this.branchManager, mergeCoordOpts);
  }

  /**
   * Run the orchestrator on an epic.
   *
   * Loads the execution plan from SpecTree, starts a session, and executes
   * phases. Parallel phases spawn multiple agents; sequential phases use
   * a single agent. Branches are merged after parallel phases complete.
   *
   * @param epicId - The epic ID to execute
   * @param options - Run options
   * @returns Run result with completed/failed items and duration
   */
  async run(epicId: string, options?: RunOptions): Promise<RunResult> {
    const startTime = Date.now();
    this.completedItems = [];
    this.failedItems = [];
    this.phaseResults = [];
    let mergeConflict: MergeConflictError | undefined;

    try {
      // Step 1: Load execution plan
      this.executionPlan = await this.loadExecutionPlan(epicId);

      // Step 2: Start SpecTree session
      const sessionResponse = await this.startSpectreeSession(epicId, options?.sessionId);
      this.spectreeSession = sessionResponse.session;

      // Emit SESSION_STARTED event
      const executionPlan = this.executionPlan
        ? this.executionPlan.phases.map((p) => ({
            phase: p.order,
            featureIds: p.items.map((i) => i.id),
          }))
        : undefined;
      await this.client.emitSessionEvent({
        epicId,
        sessionId: this.spectreeSession.id,
        timestamp: new Date().toISOString(),
        eventType: SessionEventType.SESSION_STARTED,
        payload: {
          ...(options?.sessionId ? { externalId: options.sessionId } : {}),
          status: "active" as const,
          totalFeatures: sessionResponse.epicProgress.totalFeatures,
          totalTasks: sessionResponse.epicProgress.totalTasks,
          ...(executionPlan ? { executionPlan } : {}),
        },
      });

      // TODO: Use handoff context from previous session for resumption
      // const handoffContext = sessionResponse.previousSession
      //   ? this.buildHandoffContext(sessionResponse.previousSession)
      //   : undefined;

      // Step 3: Determine execution mode
      const forceSequential = options?.sequential ?? false;

      // Step 4: Filter phases if resuming from specific feature
      const phasesToExecute = this.filterPhases(this.executionPlan, options?.fromFeature);

      // Step 5: Process phases
      // Always use processPhases for task-level agent support
      // The forceSequential flag makes phases run sequentially at the feature level
      const baseBranch = options?.baseBranch ?? (await this.branchManager.getDefaultBranch());
      const taskLevelAgents = options?.taskLevelAgents ?? true; // Default to task-level agents
      
      // If forceSequential, override phase parallelism
      if (forceSequential) {
        for (const phase of phasesToExecute) {
          phase.canRunInParallel = false;
        }
      }
      
      mergeConflict = await this.processPhases(phasesToExecute, baseBranch, taskLevelAgents);

      // Step 6: End SpecTree session
      await this.endSpectreeSession(epicId, this.completedItems, this.failedItems, mergeConflict);

      const duration = Date.now() - startTime;
      const success = this.failedItems.length === 0 && !mergeConflict;

      // Emit SESSION_ENDED event
      if (this.spectreeSession) {
        await this.client.emitSessionEvent({
          epicId,
          sessionId: this.spectreeSession.id,
          timestamp: new Date().toISOString(),
          eventType: SessionEventType.SESSION_ENDED,
          payload: {
            status: success ? "completed" : "abandoned",
            summary: this.buildSessionSummary(this.completedItems, this.failedItems, mergeConflict),
          },
        });
      }

      const result: RunResult = {
        success,
        completedItems: this.completedItems,
        failedItems: this.failedItems,
        duration,
        summary: this.buildRunSummary(this.completedItems, this.failedItems, duration, mergeConflict),
        phaseResults: this.phaseResults,
      };

      if (mergeConflict) {
        result.mergeConflict = mergeConflict;
      }

      return result;
    } catch (error) {
      // Check if this is a merge conflict (we handle these specially)
      if (isMergeConflictError(error)) {
        // End session with conflict info
        try {
          await this.endSpectreeSession(epicId, this.completedItems, this.failedItems, error);
          
          // Emit SESSION_ENDED event for merge conflict
          if (this.spectreeSession) {
            await this.client.emitSessionEvent({
              epicId,
              sessionId: this.spectreeSession.id,
              timestamp: new Date().toISOString(),
              eventType: SessionEventType.SESSION_ENDED,
              payload: {
                status: "abandoned",
                summary: this.buildSessionSummary(this.completedItems, this.failedItems, error),
                blockers: [this.formatError(error)],
              },
            });
          }
        } catch {
          // Ignore cleanup errors
        }

        const duration = Date.now() - startTime;
        return {
          success: false,
          completedItems: this.completedItems,
          failedItems: this.failedItems,
          duration,
          summary: this.buildRunSummary(this.completedItems, this.failedItems, duration, error),
          mergeConflict: error,
          phaseResults: this.phaseResults,
        };
      }

      // Ensure session is ended on error
      try {
        await this.endSpectreeSession(epicId, this.completedItems, this.failedItems, error);
        
        // Emit SESSION_ENDED event for general error
        if (this.spectreeSession) {
          await this.client.emitSessionEvent({
            epicId,
            sessionId: this.spectreeSession.id,
            timestamp: new Date().toISOString(),
            eventType: SessionEventType.SESSION_ENDED,
            payload: {
              status: "abandoned",
              summary: this.buildSessionSummary(this.completedItems, this.failedItems, error),
              blockers: [this.formatError(error)],
            },
          });
        }
      } catch {
        // Ignore cleanup errors
      }

      throw wrapError(error, "Orchestration failed");
    } finally {
      // Cleanup any active ACP session
      if (this.activeSession) {
        try {
          await this.closeSession(this.activeSession);
        } catch {
          // Ignore cleanup errors
        }
        this.activeSession = null;
      }

      // Cleanup agent pool
      if (this.agentPool) {
        try {
          await this.agentPool.terminateAll();
        } catch {
          // Ignore cleanup errors
        }
        this.agentPool = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase-Based Execution (Parallel Support)
  // ---------------------------------------------------------------------------

  /**
   * Process all phases with parallel/sequential execution and branch merging.
   *
   * @param phases - Phases to execute
   * @param baseBranch - Base branch for creating feature branches
   * @param taskLevelAgents - Whether to spawn separate agents for each task
   * @returns MergeConflictError if a merge conflict occurs, undefined otherwise
   */
  private async processPhases(
    phases: ExecutionPhase[],
    baseBranch: string,
    taskLevelAgents: boolean
  ): Promise<MergeConflictError | undefined> {
    // Initialize agent pool and phase executor
    this.agentPool = new AgentPool({
      maxAgents: this.maxAgents,
      sessionManager: this.sessionManager,
      specTreeClient: this.client,
    });

    this.phaseExecutor = new PhaseExecutor({
      agentPool: this.agentPool,
      branchManager: this.branchManager,
      specTreeClient: this.client,
      baseBranch,
      taskLevelAgents,
    });

    // Set session ID if available
    if (this.spectreeSession?.id) {
      this.phaseExecutor.setSessionId(this.spectreeSession.id);
    }

    // Forward events from phase executor
    this.forwardPhaseExecutorEvents();

    // Process each phase
    for (const phase of phases) {
      // Emit SESSION_PHASE_STARTED event
      if (this.spectreeSession) {
        await this.client.emitSessionEvent({
          epicId: this.spectreeSession.epicId,
          sessionId: this.spectreeSession.id,
          timestamp: new Date().toISOString(),
          eventType: SessionEventType.SESSION_PHASE_STARTED,
          payload: {
            phaseNumber: phase.order,
            totalPhases: phases.length,
            featureIds: phase.items.map(item => item.id),
            featureCount: phase.items.length,
            canParallelize: phase.canRunInParallel,
          },
        });
      }

      // Emit phase start (for local UI)
      this.emit("phase:start", {
        type: "phase:start" as const,
        phase,
        message: `Starting phase ${phase.order} with ${phase.items.length} items (${phase.canRunInParallel ? "parallel" : "sequential"})`,
      });

      // Execute phase
      const phaseResult = await this.phaseExecutor.executePhase(phase);
      this.phaseResults.push(phaseResult);

      // Update tracking
      this.completedItems.push(...phaseResult.completedItems);
      this.failedItems.push(...phaseResult.failedItems);

      // Emit SESSION_PHASE_COMPLETED event
      if (this.spectreeSession) {
        await this.client.emitSessionEvent({
          epicId: this.spectreeSession.epicId,
          sessionId: this.spectreeSession.id,
          timestamp: new Date().toISOString(),
          eventType: SessionEventType.SESSION_PHASE_COMPLETED,
          payload: {
            phaseNumber: phase.order,
            totalPhases: phases.length,
            featureIds: phase.items.map(item => item.id),
            featureCount: phase.items.length,
            canParallelize: phase.canRunInParallel,
          },
        });
      }

      // Emit phase complete (for local UI)
      this.emit("phase:complete", {
        type: "phase:complete" as const,
        phase,
        phaseResult,
        message: `Phase ${phase.order} complete: ${phaseResult.completedItems.length} succeeded, ${phaseResult.failedItems.length} failed`,
      });

      // Handle phase failure
      if (!phaseResult.success) {
        // Stop execution on phase failure
        break;
      }

      // Merge branches from parallel phase
      if (phase.canRunInParallel && phaseResult.completedItems.length > 0) {
        const mergeError = await this.mergePhase(phase, phaseResult, baseBranch);
        if (mergeError) {
          return mergeError;
        }
      }
    }

    return undefined;
  }

  /**
   * Merge all branches from a completed parallel phase.
   *
   * @param phase - The completed phase
   * @param results - Results from the phase execution
   * @param baseBranch - Target branch to merge into
   * @returns MergeConflictError if a conflict occurs, undefined otherwise
   */
  private async mergePhase(
    phase: ExecutionPhase,
    results: PhaseResult,
    baseBranch: string
  ): Promise<MergeConflictError | undefined> {
    // Get the items that completed successfully with branches
    const itemsToMerge = results.itemResults.filter(
      (r) => r.success && r.branch
    );

    for (const itemResult of itemsToMerge) {
      const branchName = itemResult.branch!;

      // Find the original item for metadata
      const item = phase.items.find((i) => i.identifier === itemResult.identifier);

      // Emit merge start
      this.emit("merge:start", {
        type: "merge:start" as const,
        message: `Merging branch ${branchName} into ${baseBranch}`,
        branch: branchName,
        item,
      });

      try {
        await this.mergeCoordinator.mergeBranch(branchName, baseBranch, {
          message: `Merge ${itemResult.identifier}: ${item?.title ?? "feature branch"}`,
        });

        // Emit merge complete
        this.emit("merge:complete", {
          type: "merge:complete" as const,
          message: `Successfully merged ${branchName}`,
          branch: branchName,
          item,
        });

        if (item) {
          try {
            await this.client.linkBranch(item.type, item.id, branchName);
          } catch (e) {
            console.warn(`Failed to link branch for ${item.identifier}:`, e instanceof Error ? e.message : e);
          }

          try {
            const hash = await this.branchManager.getLatestCommitHash();
            if (hash) {
              await this.client.linkCommit(item.type, item.id, hash);
            }
          } catch (e) {
            console.warn(`Failed to link commit for ${item.identifier}:`, e instanceof Error ? e.message : e);
          }
        }
      } catch (error) {
        if (isMergeConflictError(error)) {
          // Emit merge conflict event
          this.emit("merge:conflict", {
            type: "merge:conflict" as const,
            error,
            message: this.mergeCoordinator.formatConflictGuidance(
              branchName,
              baseBranch,
              error.conflictingFiles
            ),
            branch: branchName,
            item,
          });

          return error;
        }

        // Re-throw other errors
        throw error;
      }
    }

    return undefined;
  }

  /**
   * Forward events from PhaseExecutor to this orchestrator.
   */
  private forwardPhaseExecutorEvents(): void {
    if (!this.phaseExecutor) return;

    this.phaseExecutor.on("item:start", (item, branch) => {
      this.emit("item:start", {
        type: "item:start" as const,
        item,
        message: `Starting ${item.type}: ${item.title}`,
        branch,
      });
    });

    this.phaseExecutor.on("item:complete", (item, result) => {
      this.emit("item:complete", {
        type: "item:complete" as const,
        item,
        result,
        message: `Completed ${item.type}: ${item.title}`,
        branch: result.branch,
      });
    });

    this.phaseExecutor.on("item:error", (item, error) => {
      this.emit("item:error", {
        type: "item:error" as const,
        item,
        error,
        message: `Error in ${item.type}: ${item.title}`,
      });
    });

    this.phaseExecutor.on("item:progress", (item, progress, message) => {
      this.emit("item:progress", {
        type: "item:progress" as const,
        item,
        percentComplete: progress,
        message,
      });
    });

    // Forward streaming progress events
    this.phaseExecutor.on("task:progress", (data: TaskProgressEvent) => {
      this.emit("item:progress", {
        type: "item:progress" as const,
        item: data.item,
        streamingType: data.type,
        message: data.message,
        toolName: data.toolName,
        toolArgs: data.toolArgs,
        toolResult: data.toolResult,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Sequential Execution (Legacy/Fallback Mode)
  // ---------------------------------------------------------------------------
  // Execution Plan and Session Management
  // ---------------------------------------------------------------------------

  /**
   * Load the execution plan for an epic.
   */
  private async loadExecutionPlan(epicId: string): Promise<ExecutionPlan> {
    try {
      return await this.client.getExecutionPlan(epicId);
    } catch (error) {
      throw wrapError(error, `Failed to load execution plan for epic ${epicId}`);
    }
  }

  /**
   * Start a SpecTree session for the epic.
   */
  private async startSpectreeSession(
    epicId: string,
    externalId?: string
  ): Promise<StartSessionResponse> {
    try {
      const input = externalId ? { epicId, externalId } : { epicId };
      return await this.client.startSession(input);
    } catch (error) {
      throw wrapError(error, "Failed to start SpecTree session");
    }
  }

  /**
   * End the SpecTree session with a summary.
   */
  private async endSpectreeSession(
    epicId: string,
    completedItems: string[],
    failedItems: string[],
    error?: unknown
  ): Promise<void> {
    if (!this.spectreeSession) return;

    const handoff: SessionHandoff = {
      summary: this.buildSessionSummary(completedItems, failedItems, error),
    };
    const nextSteps = this.buildNextSteps(failedItems, error);
    if (nextSteps) {
      handoff.nextSteps = nextSteps;
    }
    if (error) {
      handoff.blockers = [this.formatError(error)];
    }

    try {
      await this.client.endSession(epicId, handoff);
    } catch {
      // Log but don't throw on session end failure
    } finally {
      this.spectreeSession = null;
    }
  }

  /**
   * Build handoff context from a previous session.
   * @internal Used for session resumption - may be called by subclasses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected buildHandoffContext(session: SpecTreeSession): string {
    const parts: string[] = [];

    if (session.summary) {
      parts.push(`Previous Session Summary:\n${session.summary}`);
    }

    if (session.nextSteps && session.nextSteps.length > 0) {
      parts.push(`Previous Next Steps:\n${session.nextSteps.map((s) => `- ${s}`).join("\n")}`);
    }

    if (session.blockers && session.blockers.length > 0) {
      parts.push(`Previous Blockers:\n${session.blockers.map((b) => `- ${b}`).join("\n")}`);
    }

    if (session.decisions && session.decisions.length > 0) {
      parts.push(
        `Previous Decisions:\n${session.decisions
          .map((d) => `- ${d.decision}${d.rationale ? `: ${d.rationale}` : ""}`)
          .join("\n")}`
      );
    }

    if (session.itemsWorkedOn && session.itemsWorkedOn.length > 0) {
      parts.push(
        `Items Worked On:\n${session.itemsWorkedOn
          .map((item) => `- ${item.identifier}: ${item.action}`)
          .join("\n")}`
      );
    }

    return parts.join("\n\n");
  }

  /**
   * Filter phases based on fromFeature option.
   */
  private filterPhases(plan: ExecutionPlan, fromFeature?: string): ExecutionPhase[] {
    if (!fromFeature) {
      return plan.phases;
    }

    // Find the phase and item index for the fromFeature
    for (let phaseIndex = 0; phaseIndex < plan.phases.length; phaseIndex++) {
      const phase = plan.phases[phaseIndex]!;
      const itemIndex = phase.items.findIndex(
        (item) =>
          item.identifier === fromFeature ||
          item.identifier.toLowerCase() === fromFeature.toLowerCase()
      );

      if (itemIndex !== -1) {
        // Return this phase (with items from fromFeature onwards) and all subsequent phases
        const filteredPhases: ExecutionPhase[] = [];

        // First phase: filter items
        const firstPhase: ExecutionPhase = {
          ...phase,
          items: phase.items.slice(itemIndex),
        };
        if (firstPhase.items.length > 0) {
          filteredPhases.push(firstPhase);
        }

        // Subsequent phases: include all
        for (let i = phaseIndex + 1; i < plan.phases.length; i++) {
          filteredPhases.push(plan.phases[i]!);
        }

        return filteredPhases;
      }
    }

    // Feature not found
    const allItems = plan.phases.flatMap((p) => p.items);
    throw new OrchestratorError(
      `Feature "${fromFeature}" not found in execution plan`,
      ErrorCode.SPECTREE_NOT_FOUND,
      {
        context: { fromFeature, availableIdentifiers: allItems.map((i) => i.identifier) },
        recoveryHint: `Available features: ${allItems.map((i) => i.identifier).join(", ")}`,
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Single Item Execution (for direct item execution without task-level agents)
  // ---------------------------------------------------------------------------

  /**
   * Execute a single item (feature or task) directly with one agent.
   * @internal Used for testing and direct execution - may be called by subclasses
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async executeItem(item: ExecutionItem, handoffContext?: string): Promise<ItemResult> {
    const startTime = Date.now();

    // Emit start event
    this.emit("item:start", {
      type: "item:start" as const,
      item,
      message: `Starting ${item.type}: ${item.title}`,
    });

    try {
      // Step 1: Mark item as started in SpecTree
      const startWorkInput = this.spectreeSession?.id
        ? { sessionId: this.spectreeSession.id }
        : undefined;
      await this.client.startWork(item.type, item.id, startWorkInput);

      // Step 2: Create ACP session
      const session = await this.createSession(item, handoffContext);
      this.activeSession = session;

      // Step 3: Send task prompt and wait for completion (25-minute timeout for complex tasks)
      const taskPrompt = this.buildTaskPrompt(item, handoffContext);
      const response = await session.sendAndWait(taskPrompt, 1500000);

      // Extract summary from response (ACP sendAndWait returns string directly)
      const summary = this.extractSummary(response);

      // Step 4: Mark item as completed in SpecTree
      const completeWorkInput = this.spectreeSession?.id
        ? { summary, sessionId: this.spectreeSession.id }
        : { summary };
      await this.client.completeWork(item.type, item.id, completeWorkInput);

      // Step 5: Close the session
      await this.closeSession(session);
      this.activeSession = null;

      const duration = Date.now() - startTime;
      const result: ItemResult = {
        success: true,
        itemId: item.id,
        identifier: item.identifier,
        summary,
        duration,
      };

      // Emit complete event
      this.emit("item:complete", {
        type: "item:complete" as const,
        item,
        message: `Completed ${item.type}: ${item.title}`,
        result,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const agentError =
        error instanceof AgentError
          ? error
          : AgentError.executionFailed(
              "orchestrator",
              item.id,
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error : undefined
            );

      return {
        success: false,
        itemId: item.id,
        identifier: item.identifier,
        error: agentError,
        duration,
      };
    }
  }

  /**
   * Create an ACP session for a task.
   */
  private async createSession(item: ExecutionItem, _handoffContext?: string): Promise<AcpSession> {
    try {
      const session = await this.sessionManager.createSession({
        systemMessage: AGENT_SYSTEM_PROMPT,
      });

      return session;
    } catch (error) {
      throw AgentError.spawnFailed(
        "orchestrator",
        item.id,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Close an ACP session.
   */
  private async closeSession(session: AcpSession): Promise<void> {
    try {
      await session.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }

  // ---------------------------------------------------------------------------
  // Prompt Building
  // ---------------------------------------------------------------------------

  /**
   * Build the task prompt for the agent.
   */
  private buildTaskPrompt(item: ExecutionItem, handoffContext?: string): string {
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

    if (handoffContext) {
      parts.push(`\n## Context from Previous Session\n\n${handoffContext}`);
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
  // Summary and Error Formatting
  // ---------------------------------------------------------------------------

  /**
   * Extract summary from agent response.
   */
  private extractSummary(response: unknown): string {
    if (!response) {
      return "Task completed (no response)";
    }

    // ACP sendAndWait returns content as a string directly
    if (typeof response === "string") {
      if (response.length > 500) {
        return response.substring(0, 497) + "...";
      }
      return response;
    }

    return "Task completed";
  }

  /**
   * Build a summary for the run result.
   */
  private buildRunSummary(
    completed: string[],
    failed: string[],
    duration: number,
    mergeConflict?: MergeConflictError
  ): string {
    const durationSec = (duration / 1000).toFixed(1);
    const parts: string[] = [];

    if (completed.length > 0) {
      parts.push(`Completed ${completed.length} item(s): ${completed.join(", ")}`);
    }

    if (failed.length > 0) {
      parts.push(`Failed ${failed.length} item(s): ${failed.join(", ")}`);
    }

    if (mergeConflict) {
      parts.push(`Merge conflict in ${mergeConflict.sourceBranch}: ${mergeConflict.conflictingFiles.join(", ")}`);
    }

    parts.push(`Total duration: ${durationSec}s`);

    return parts.join(". ");
  }

  /**
   * Build session summary for handoff.
   */
  private buildSessionSummary(completed: string[], failed: string[], error?: unknown): string {
    const parts: string[] = [];

    if (completed.length > 0) {
      parts.push(`Completed: ${completed.join(", ")}`);
    }

    if (failed.length > 0) {
      parts.push(`Failed: ${failed.join(", ")}`);
    }

    if (error) {
      parts.push(`Error: ${this.formatError(error)}`);
    }

    return parts.join(". ") || "No items processed";
  }

  /**
   * Build next steps based on failures and errors.
   */
  private buildNextSteps(failed: string[], error?: unknown): string[] | undefined {
    const steps: string[] = [];

    if (isMergeConflictError(error)) {
      steps.push("Resolve merge conflicts manually");
      steps.push(`Files: ${error.conflictingFiles.join(", ")}`);
      steps.push("Run 'spectree-agent continue' after resolution");
    }

    if (failed.length > 0) {
      steps.push(`Retry failed items: ${failed.join(", ")}`);
      steps.push("Review error logs for failure details");
      steps.push("Consider breaking down complex items");
    }

    return steps.length > 0 ? steps : undefined;
  }

  /**
   * Format an error for display.
   */
  private formatError(error: unknown): string {
    if (error instanceof OrchestratorError) {
      return error.toFormattedString();
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // ---------------------------------------------------------------------------
  // Getters for Testing and Status
  // ---------------------------------------------------------------------------

  /**
   * Get the current agent pool status.
   */
  getAgentPoolStatus(): { maxAgents: number; active: number } | null {
    if (!this.agentPool) {
      return null;
    }
    const status = this.agentPool.getStatus();
    return {
      maxAgents: status.maxAgents,
      active: status.activeCount,
    };
  }

  /**
   * Get completed phase results.
   */
  getPhaseResults(): PhaseResult[] {
    return [...this.phaseResults];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Orchestrator instance.
 *
 * @param options - Orchestrator options
 * @returns A new Orchestrator instance
 */
export function createOrchestrator(options: OrchestratorOptions): Orchestrator {
  return new Orchestrator(options);
}
