/**
 * Agent Pool
 *
 * Manages multiple concurrent ACP sessions for parallel agent execution.
 * This is the core component that enables the orchestrator to run multiple AI agents
 * simultaneously on independent tasks.
 *
 * Features:
 * - Configurable pool size (maxAgents)
 * - Agent lifecycle management (spawn, track, terminate)
 * - Event emissions for UI consumption
 * - Error isolation (failed agents don't crash the pool)
 * - Promise-based waiting for agent completion
 *
 * @example
 * ```typescript
 * const pool = new AgentPool({
 *   maxAgents: 4,
 *   sessionManager,
 *   specTreeClient,
 * });
 *
 * pool.on('agent:spawn', (agent) => console.log(`Agent ${agent.id} spawned`));
 * pool.on('agent:complete', (agent, result) => console.log(`Agent ${agent.id} done`));
 *
 * const agent = await pool.spawnAgent(task, 'feature/COM-5');
 * const results = await pool.waitForAll();
 * ```
 */

import { EventEmitter } from "events";
import { AcpSessionManager, type AcpSession } from "../acp/index.js";
import type { SpecTreeClient, ExecutionItem } from "../spectree/api-client.js";
import { AgentError, OrchestratorError, ErrorCode } from "../errors.js";

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Agent status values
 */
export type AgentStatus = "idle" | "working" | "completed" | "failed" | "paused";

/**
 * Represents a single agent instance managing a Copilot SDK session
 */
export interface Agent {
  /** Unique agent identifier (e.g., "worker-1") */
  id: string;
  /** The task/feature identifier being worked on (e.g., "COM-5") */
  taskId: string;
  /** Git branch the agent is working on (e.g., "feature/COM-5") */
  branch: string;
  /** Current agent status */
  status: AgentStatus;
  /** The underlying ACP session */
  session: AcpSession;
  /** Progress percentage (0-100) */
  progress: number;
  /** When the agent was spawned */
  startedAt: Date;
  /** When the agent completed (if applicable) */
  completedAt?: Date;
  /** The execution item this agent is working on */
  item: ExecutionItem;
}

/**
 * Result of an agent's work
 */
export interface AgentResult {
  /** Agent identifier */
  agentId: string;
  /** Task identifier */
  taskId: string;
  /** Whether the agent completed successfully */
  success: boolean;
  /** Summary of what was accomplished */
  summary?: string;
  /** Error if the agent failed */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Pool status summary
 */
export interface PoolStatus {
  /** Maximum number of agents allowed */
  maxAgents: number;
  /** Number of currently active agents (idle + working) */
  activeCount: number;
  /** Number of idle agents */
  idleCount: number;
  /** Number of agents currently working */
  workingCount: number;
  /** Number of completed agents (since pool creation) */
  completedCount: number;
  /** Number of failed agents (since pool creation) */
  failedCount: number;
  /** Whether the pool is at capacity */
  atCapacity: boolean;
}

/**
 * Options for creating an AgentPool
 */
export interface AgentPoolOptions {
  /** Maximum number of concurrent agents */
  maxAgents: number;
  /** ACP session manager for creating sessions */
  sessionManager: AcpSessionManager;
  /** SpecTree client for API operations */
  specTreeClient: SpecTreeClient;
}

// =============================================================================
// Event Types
// =============================================================================

export interface AgentPoolEvents {
  "agent:spawn": (agent: Agent) => void;
  "agent:start": (agent: Agent) => void;
  "agent:progress": (agent: Agent, progress: number, message?: string) => void;
  "agent:complete": (agent: Agent, result: AgentResult) => void;
  "agent:error": (agent: Agent, error: Error) => void;
  "agent:pause": (agent: Agent) => void;
  "agent:resume": (agent: Agent) => void;
  "pool:full": () => void;
  "pool:empty": () => void;
  // Streaming/progress events
  'agent:message': (agent: Agent, chunk: string) => void;
  'agent:tool-call': (agent: Agent, toolName: string, toolArgs: unknown) => void;
  'agent:tool-result': (agent: Agent, toolName: string, result: unknown) => void;
}

// =============================================================================
// Agent System Prompt
// =============================================================================

const PARALLEL_AGENT_SYSTEM_PROMPT = `You are an AI agent working as part of a parallel execution team for the SpecTree orchestrator.

Your job is to implement the assigned task according to its description and acceptance criteria. You are working on your own git branch and should focus only on your assigned task.

## Available Tools

### Progress & Context (MANDATORY — use throughout)
- **log_progress** — Report incremental progress (message + percentComplete)
- **log_decision** — Record implementation decisions with rationale
- **link_code_file** — Link files you create or modify to this task
- **append_ai_note** — Leave observations and context for future sessions

### Requirements & Context (read at start)
- **get_task_context** — Get detailed task requirements and metadata
- **get_code_context** — Get files and branches already linked
- **get_ai_context** — Read context from previous AI sessions
- **get_structured_description** — Read acceptance criteria and AI instructions

### Validation & Blocking
- **run_validation** — Run a single validation check
- **run_all_validations** — Run all validation checks for verification
- **report_blocker** — Report something blocking progress

## Important: Parallel Execution Context

- You are one of multiple agents working in parallel
- Each agent works on an isolated git branch
- Do NOT modify files outside your task's scope
- Coordinate via the SpecTree progress tracking tools
- Your branch will be merged by the orchestrator when all agents complete

## Workflow

1. **READ** requirements: call get_structured_description and get_ai_context
2. **LOG** progress at start: "Starting work on [identifier]"
3. **PLAN** your approach before making changes
4. **IMPLEMENT** the task step by step
5. **LOG** progress after each significant milestone
6. **LOG** decisions when making important choices (library, approach, etc.)
7. **LINK** every file you create or modify with link_code_file
8. **NOTE** observations for future sessions with append_ai_note
9. **VALIDATE** before completing: call run_all_validations
10. **LOG** final progress with summary and percentComplete: 100`;

// =============================================================================
// AgentPool Class
// =============================================================================

/**
 * Manages multiple concurrent ACP sessions for parallel agent execution.
 */
export class AgentPool extends EventEmitter {
  private maxAgents: number;
  private activeAgents: Map<string, Agent>;
  private agentPromises: Map<string, Promise<AgentResult>>;
  private agentResolvers: Map<string, (result: AgentResult) => void>;
  private sessionManager: AcpSessionManager;
  private specTreeClient: SpecTreeClient;
  private nextId: number = 1;
  private completedCount: number = 0;
  private failedCount: number = 0;

  constructor(options: AgentPoolOptions) {
    super();
    this.maxAgents = options.maxAgents;
    this.sessionManager = options.sessionManager;
    this.specTreeClient = options.specTreeClient;
    this.activeAgents = new Map();
    this.agentPromises = new Map();
    this.agentResolvers = new Map();

    // specTreeClient is stored for future use in progress logging
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void this.specTreeClient;
  }

  // ---------------------------------------------------------------------------
  // Agent Lifecycle Methods
  // ---------------------------------------------------------------------------

  /**
   * Spawn a new agent for a task.
   *
   * @param task - The execution item (feature/task) to work on
   * @param branch - The git branch for this agent to work on
   * @returns The spawned Agent instance
   * @throws OrchestratorError if pool is at capacity
   * @throws AgentError if session creation fails
   */
  async spawnAgent(task: ExecutionItem, branch: string): Promise<Agent> {
    // 1. Check pool capacity
    if (this.activeAgents.size >= this.maxAgents) {
      this.emit("pool:full");
      throw new OrchestratorError(
        `Agent pool at capacity (${this.maxAgents} agents)`,
        ErrorCode.AGENT_SPAWN_FAILED,
        {
          context: { maxAgents: this.maxAgents, currentAgents: this.activeAgents.size },
          recoveryHint: "Wait for an agent to complete or increase maxConcurrentAgents",
        }
      );
    }

    // 2. Create ACP session
    let session: AcpSession;
    try {
      session = await this.sessionManager.createSession({
        systemMessage: this.buildAgentPrompt(task),
      });
    } catch (error) {
      throw AgentError.spawnFailed(
        `worker-${this.nextId}`,
        task.identifier,
        error instanceof Error ? error : undefined
      );
    }

    // 3. Create agent wrapper
    const agent: Agent = {
      id: `worker-${this.nextId++}`,
      taskId: task.identifier,
      branch,
      status: "idle",
      session,
      progress: 0,
      startedAt: new Date(),
      item: task,
    };

    // 4. Set up promise for waiting
    let resolver: (result: AgentResult) => void;
    const promise = new Promise<AgentResult>((resolve) => {
      resolver = resolve;
    });
    this.agentPromises.set(agent.id, promise);
    this.agentResolvers.set(agent.id, resolver!);

    // 5. Register agent
    this.activeAgents.set(agent.id, agent);
    this.emit("agent:spawn", agent);

    return agent;
  }

  /**
   * Start an agent working on its task.
   *
   * @param agentId - The agent ID to start
   * @param prompt - The task prompt to send to the agent
   * @returns Promise that resolves when the agent completes
   */
  async startAgent(agentId: string, prompt: string): Promise<AgentResult> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      throw new OrchestratorError(
        `Agent ${agentId} not found`,
        ErrorCode.AGENT_EXECUTION_FAILED
      );
    }

    // Update status
    agent.status = "working";
    this.emit("agent:start", agent);

    const startTime = Date.now();

    try {
      // Streaming: send prompt and listen for events (10-min timeout)
      let summary: string | undefined = undefined;
      let completed = false;
      let error: Error | undefined = undefined;
      const timeoutMs = 600000; // 10 minutes
      const session = agent.session;

      // Collect listener cleanup functions
      const cleanups: (() => void)[] = [];

      // ACP streaming event handlers
      const onText = (chunk: string) => {
        this.emit('agent:message', agent, chunk);
      };
      session.on('text', onText);
      cleanups.push(() => session.removeListener('text', onText));

      const onComplete = (content: string) => {
        summary = content;
        completed = true;
      };
      session.on('complete', onComplete);
      cleanups.push(() => session.removeListener('complete', onComplete));

      const onToolCall = (toolName: string, toolArgs: unknown) => {
        this.emit('agent:tool-call', agent, toolName, toolArgs);
      };
      session.on('tool_call', onToolCall);
      cleanups.push(() => session.removeListener('tool_call', onToolCall));

      const onToolResult = (toolName: string, result: unknown) => {
        this.emit('agent:tool-result', agent, toolName, result);
      };
      session.on('tool_result', onToolResult);
      cleanups.push(() => session.removeListener('tool_result', onToolResult));

      const onError = (err: Error) => {
        error = err;
        completed = true;
      };
      session.on('error', onError);
      cleanups.push(() => session.removeListener('error', onError));

      session.send(prompt);

      // Wait for completion or timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          completed = true;
          error = new Error('Agent execution timed out');
          resolve();
        }, timeoutMs);
        const check = () => {
          if (completed) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      // Remove all listeners
      for (const cleanup of cleanups) {
        cleanup();
      }

      // Update agent state
      agent.status = error ? "failed" : "completed";
      agent.progress = 100;
      agent.completedAt = new Date();
      if (!error) this.completedCount++;
      else this.failedCount++;

      const result: AgentResult = {
        agentId: agent.id,
        taskId: agent.taskId,
        success: !error,
        duration: Date.now() - startTime,
      };
      if (summary !== undefined) result.summary = summary;
      if (error !== undefined) result.error = error;

      // Resolve the waiting promise
      const resolver = this.agentResolvers.get(agentId);
      if (resolver) {
        resolver(result);
      }

      // Emit completion or error event
      if (!error) {
        this.emit("agent:complete", agent, result);
      } else {
        this.emit("agent:error", agent, error);
      }

      // Check if pool is now empty
      this.checkPoolEmpty();

      return result;
    } catch (error) {
      // Handle agent failure
      agent.status = "failed";
      agent.completedAt = new Date();
      this.failedCount++;

      const agentError =
        error instanceof AgentError
          ? error
          : AgentError.executionFailed(
              agent.id,
              agent.taskId,
              error instanceof Error ? error.message : String(error),
              error instanceof Error ? error : undefined
            );

      const result: AgentResult = {
        agentId: agent.id,
        taskId: agent.taskId,
        success: false,
        error: agentError,
        duration: Date.now() - startTime,
      };

      // Resolve the waiting promise (even on failure)
      const resolver = this.agentResolvers.get(agentId);
      if (resolver) {
        resolver(result);
      }

      // Emit error event
      this.emit("agent:error", agent, agentError);

      // Check if pool is now empty
      this.checkPoolEmpty();

      return result;
    }
  }

  /**
   * Update agent progress.
   *
   * @param agentId - The agent ID
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  updateProgress(agentId: string, progress: number, message?: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.progress = Math.min(100, Math.max(0, progress));
      this.emit("agent:progress", agent, agent.progress, message);
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Access Methods
  // ---------------------------------------------------------------------------

  /**
   * Get an agent by ID.
   */
  getAgent(id: string): Agent | undefined {
    return this.activeAgents.get(id);
  }

  /**
   * Get all active agents.
   */
  getActiveAgents(): Agent[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Get agents with a specific status.
   */
  getAgentsByStatus(status: AgentStatus): Agent[] {
    return Array.from(this.activeAgents.values()).filter((a) => a.status === status);
  }

  // ---------------------------------------------------------------------------
  // Waiting Methods
  // ---------------------------------------------------------------------------

  /**
   * Wait for a specific agent to complete.
   *
   * @param id - The agent ID to wait for
   * @returns The agent's result
   * @throws OrchestratorError if agent not found
   */
  async waitForAgent(id: string): Promise<AgentResult> {
    const promise = this.agentPromises.get(id);
    if (!promise) {
      throw new OrchestratorError(
        `Agent ${id} not found or already cleaned up`,
        ErrorCode.AGENT_EXECUTION_FAILED
      );
    }
    return promise;
  }

  /**
   * Wait for all active agents to complete.
   *
   * @returns Array of results from all agents
   */
  async waitForAll(): Promise<AgentResult[]> {
    const promises = Array.from(this.agentPromises.values());
    if (promises.length === 0) {
      return [];
    }
    return Promise.all(promises);
  }

  /**
   * Wait for any agent to complete.
   *
   * @returns The first agent result
   */
  async waitForAny(): Promise<AgentResult> {
    const promises = Array.from(this.agentPromises.values());
    if (promises.length === 0) {
      throw new OrchestratorError("No agents to wait for", ErrorCode.AGENT_EXECUTION_FAILED);
    }
    return Promise.race(promises);
  }

  // ---------------------------------------------------------------------------
  // Pause/Resume Methods
  // ---------------------------------------------------------------------------

  /**
   * Pause a specific agent.
   * The agent will stop at the next safe point (after current SDK call completes).
   *
   * @param id - The agent ID to pause
   */
  async pauseAgent(id: string): Promise<void> {
    const agent = this.activeAgents.get(id);
    if (!agent) {
      throw new OrchestratorError(`Agent not found: ${id}`, ErrorCode.AGENT_EXECUTION_FAILED);
    }

    if (agent.status === "paused") {
      return; // Already paused
    }

    if (agent.status === "completed" || agent.status === "failed") {
      throw new OrchestratorError(
        `Cannot pause agent ${id}: already ${agent.status}`,
        ErrorCode.AGENT_EXECUTION_FAILED
      );
    }

    // Signal agent to pause at next safe point
    // Note: If agent is in the middle of an ACP call, we wait for completion before pausing
    agent.status = "paused";
    this.emit("agent:pause", agent);
  }

  /**
   * Resume a paused agent.
   *
   * @param id - The agent ID to resume
   */
  async resumeAgent(id: string): Promise<void> {
    const agent = this.activeAgents.get(id);
    if (!agent) {
      throw new OrchestratorError(`Agent not found: ${id}`, ErrorCode.AGENT_EXECUTION_FAILED);
    }

    if (agent.status !== "paused") {
      throw new OrchestratorError(
        `Cannot resume agent ${id}: not paused (current status: ${agent.status})`,
        ErrorCode.AGENT_EXECUTION_FAILED
      );
    }

    // Resume agent work
    agent.status = "working";
    this.emit("agent:resume", agent);
  }

  /**
   * Pause all active agents.
   *
   * @returns Number of agents paused
   */
  async pauseAll(): Promise<number> {
    const agentsToPause = Array.from(this.activeAgents.values()).filter(
      (a) => a.status === "working" || a.status === "idle"
    );

    for (const agent of agentsToPause) {
      await this.pauseAgent(agent.id);
    }

    return agentsToPause.length;
  }

  /**
   * Resume all paused agents.
   *
   * @returns Number of agents resumed
   */
  async resumeAll(): Promise<number> {
    const agentsToResume = Array.from(this.activeAgents.values()).filter(
      (a) => a.status === "paused"
    );

    for (const agent of agentsToResume) {
      await this.resumeAgent(agent.id);
    }

    return agentsToResume.length;
  }

  /**
   * Get all paused agents.
   */
  getPausedAgents(): Agent[] {
    return Array.from(this.activeAgents.values()).filter((a) => a.status === "paused");
  }

  // ---------------------------------------------------------------------------
  // Termination Methods
  // ---------------------------------------------------------------------------

  /**
   * Terminate a specific agent.
   *
   * @param id - The agent ID to terminate
   */
  async terminateAgent(id: string): Promise<void> {
    const agent = this.activeAgents.get(id);
    if (!agent) {
      return; // Already removed or never existed
    }

    try {
      // Destroy the ACP session
      await agent.session.destroy();
    } catch {
      // Ignore cleanup errors
    }

    // Update agent state
    const wasFailed = agent.status === "failed";
    if (agent.status === "working" || agent.status === "idle") {
      agent.status = "failed";
      agent.completedAt = new Date();
      if (!wasFailed) {
        this.failedCount++;
      }
    }

    // Resolve the promise if still pending
    const resolver = this.agentResolvers.get(id);
    if (resolver) {
      resolver({
        agentId: agent.id,
        taskId: agent.taskId,
        success: false,
        error: new OrchestratorError("Agent terminated", ErrorCode.AGENT_EXECUTION_FAILED),
        duration: Date.now() - agent.startedAt.getTime(),
      });
    }

    // Clean up
    this.activeAgents.delete(id);
    this.agentPromises.delete(id);
    this.agentResolvers.delete(id);

    this.checkPoolEmpty();
  }

  /**
   * Terminate all agents.
   */
  async terminateAll(): Promise<void> {
    const agentIds = Array.from(this.activeAgents.keys());
    await Promise.all(agentIds.map((id) => this.terminateAgent(id)));
  }

  /**
   * Remove a completed/failed agent from the pool (cleanup).
   * This allows the slot to be reused by a new agent.
   *
   * @param id - The agent ID to remove
   */
  removeAgent(id: string): void {
    const agent = this.activeAgents.get(id);
    if (agent && (agent.status === "completed" || agent.status === "failed")) {
      this.activeAgents.delete(id);
      this.agentPromises.delete(id);
      this.agentResolvers.delete(id);
      this.checkPoolEmpty();
    }
  }

  // ---------------------------------------------------------------------------
  // Status Methods
  // ---------------------------------------------------------------------------

  /**
   * Get the current pool status.
   */
  getStatus(): PoolStatus {
    const agents = Array.from(this.activeAgents.values());
    const idleCount = agents.filter((a) => a.status === "idle").length;
    const workingCount = agents.filter((a) => a.status === "working").length;

    return {
      maxAgents: this.maxAgents,
      activeCount: agents.length,
      idleCount,
      workingCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      atCapacity: agents.length >= this.maxAgents,
    };
  }

  /**
   * Check if the pool has available capacity.
   */
  hasCapacity(): boolean {
    return this.activeAgents.size < this.maxAgents;
  }

  /**
   * Get the number of available slots.
   */
  getAvailableSlots(): number {
    return Math.max(0, this.maxAgents - this.activeAgents.size);
  }

  // ---------------------------------------------------------------------------
  // Private Helper Methods
  // ---------------------------------------------------------------------------

  /**
   * Build the system prompt for an agent.
   */
  private buildAgentPrompt(task: ExecutionItem): string {
    const parts: string[] = [PARALLEL_AGENT_SYSTEM_PROMPT];

    parts.push(`\n## Your Assigned Task\n`);
    parts.push(`**Identifier:** ${task.identifier}`);
    parts.push(`**Title:** ${task.title}`);
    parts.push(`**Type:** ${task.type}`);

    if (task.description) {
      parts.push(`\n**Description:**\n${task.description}`);
    }

    if (task.estimatedComplexity) {
      parts.push(`\n**Estimated Complexity:** ${task.estimatedComplexity}`);
    }

    return parts.join("\n");
  }

  /**
   * Check if the pool is empty and emit event.
   */
  private checkPoolEmpty(): void {
    const working = Array.from(this.activeAgents.values()).filter(
      (a) => a.status === "working" || a.status === "idle"
    );
    if (working.length === 0) {
      this.emit("pool:empty");
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new AgentPool instance.
 *
 * @param options - Pool configuration options
 * @returns A new AgentPool instance
 */
export function createAgentPool(options: AgentPoolOptions): AgentPool {
  return new AgentPool(options);
}
