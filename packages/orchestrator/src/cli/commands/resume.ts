/**
 * Resume Command
 *
 * Resumes paused agents in an orchestration session.
 * Agents can be resumed individually or all at once.
 *
 * @example
 * ```bash
 * # Resume all paused agents
 * spectree-agent resume
 *
 * # Resume a specific worker
 * spectree-agent resume worker-1
 * ```
 */

import chalk from "chalk";

import {
  getActiveState,
  setActiveState,
  formatRelativeTime,
  type SessionState,
  type SerializedAgent,
} from "../state.js";
import { OrchestratorError, ErrorCode } from "../../errors.js";

// =============================================================================
// Constants
// =============================================================================

/** Maximum age of paused state before warning (24 hours in milliseconds) */
const STALE_STATE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

export interface ResumeOptions {
  /** Force resume even if state is stale */
  force?: boolean;
}

export interface ResumeResult {
  /** Number of agents resumed */
  resumedCount: number;
  /** IDs of resumed agents */
  resumedAgents: string[];
  /** Whether any agents were already running */
  alreadyRunning: number;
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Resume paused agents in the active orchestration.
 *
 * @param worker - Optional worker ID to resume (e.g., "worker-1"). If not provided, resumes all paused agents.
 * @param options - Resume options
 * @returns Result of the resume operation
 */
export function resumeCommand(
  worker?: string,
  options: ResumeOptions = {}
): ResumeResult {
  // 1. Load active orchestration state
  const activeState = getActiveState();

  if (!activeState) {
    console.log();
    console.log(chalk.red("No saved state to resume from."));
    console.log(chalk.gray("Start a new orchestration with:"));
    console.log(chalk.white('  spectree-agent run "Your feature description"'));
    console.log();
    throw new OrchestratorError(
      "No saved state to resume from",
      ErrorCode.CONFIG_MISSING,
      {
        recoveryHint: "Start an orchestration first with 'spectree-agent run'",
      }
    );
  }

  // 2. Check if state is stale
  checkStateAge(activeState, options.force);

  // 3. Get paused agents from state
  const pausedAgents = activeState.activeAgents.filter(
    (a) => a.status === "paused"
  );

  if (pausedAgents.length === 0) {
    const runningCount = activeState.activeAgents.filter(
      (a) => a.status === "working" || a.status === "idle"
    ).length;

    console.log();
    if (runningCount > 0) {
      console.log(chalk.yellow("No paused agents to resume."));
      console.log(
        chalk.gray(`${String(runningCount)} agent(s) are currently running.`)
      );
    } else {
      console.log(chalk.yellow("No agents to resume."));
      console.log(
        chalk.gray(`Epic "${activeState.epicName}" has no active agents.`)
      );
    }
    console.log();

    return {
      resumedCount: 0,
      resumedAgents: [],
      alreadyRunning: runningCount,
    };
  }

  // 4. Resume specific worker or all agents
  if (worker) {
    return resumeSpecificWorker(activeState, worker);
  } else {
    return resumeAllWorkers(activeState, pausedAgents);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if the saved state is stale and warn the user.
 *
 * @param state - The active session state
 * @param force - Whether to skip the stale check
 * @returns Whether a stale warning was shown
 */
function checkStateAge(
  state: SessionState,
  force?: boolean
): boolean {
  const updatedAt = new Date(state.updatedAt).getTime();
  const stateAge = Date.now() - updatedAt;

  if (stateAge > STALE_STATE_THRESHOLD_MS && !force) {
    const relativeTime = formatRelativeTime(state.updatedAt);

    console.log();
    console.log(chalk.yellow("⚠ State is more than 24 hours old."));
    console.log(chalk.gray(`  Last updated: ${relativeTime}`));
    console.log(chalk.gray(`  Epic: ${state.epicName}`));
    console.log();
    console.log(
      chalk.gray("  Use --force to resume anyway, or start a fresh session.")
    );
    console.log();

    // For now, we'll continue with a warning
    // In the future, this could prompt for confirmation
    return true;
  }

  return false;
}

/**
 * Resume a specific worker by ID.
 */
function resumeSpecificWorker(
  activeState: SessionState,
  worker: string
): ResumeResult {
  // Find the specific worker
  const agent = activeState.activeAgents.find((a) => a.id === worker);

  if (!agent) {
    console.log();
    console.log(chalk.red(`Worker not found: ${worker}`));
    console.log(chalk.gray("Available workers:"));
    for (const a of activeState.activeAgents) {
      const statusIcon = getStatusIcon(a.status);
      console.log(chalk.gray(`  ${statusIcon} ${a.id} - ${a.taskId} (${a.status})`));
    }
    console.log();
    throw new OrchestratorError(
      `Worker not found: ${worker}`,
      ErrorCode.CONFIG_INVALID,
      {
        context: {
          worker,
          availableWorkers: activeState.activeAgents.map((a) => a.id),
        },
        recoveryHint: `Use one of the available worker IDs: ${activeState.activeAgents.map((a) => a.id).join(", ")}`,
      }
    );
  }

  if (agent.status !== "paused") {
    console.log();
    console.log(chalk.yellow(`Worker ${worker} is not paused.`));
    console.log(chalk.gray(`  Current status: ${agent.status}`));
    console.log();

    return {
      resumedCount: 0,
      resumedAgents: [],
      alreadyRunning: agent.status === "working" || agent.status === "idle" ? 1 : 0,
    };
  }

  // Update agent status to idle (ready to continue work)
  const updatedAgents = activeState.activeAgents.map((a) =>
    a.id === worker ? { ...a, status: "idle" as const } : a
  );

  const updatedState: SessionState = {
    ...activeState,
    activeAgents: updatedAgents,
  };

  setActiveState(updatedState);

  // Display resume confirmation
  console.log();
  console.log(chalk.green(`▶ Resumed ${worker}`));
  console.log(chalk.gray(`  Task: ${agent.taskId} - "${agent.taskTitle}"`));
  console.log(chalk.gray(`  Progress: ${String(agent.progress)}%`));
  displayResumeContext(activeState, [agent]);
  console.log();

  return {
    resumedCount: 1,
    resumedAgents: [worker],
    alreadyRunning: 0,
  };
}

/**
 * Resume all paused workers.
 */
function resumeAllWorkers(
  activeState: SessionState,
  pausedAgents: SerializedAgent[]
): ResumeResult {
  // Update all paused agents to idle
  const updatedAgents = activeState.activeAgents.map((a) =>
    a.status === "paused" ? { ...a, status: "idle" as const } : a
  );

  const updatedState: SessionState = {
    ...activeState,
    activeAgents: updatedAgents,
  };

  setActiveState(updatedState);

  // Display resume summary
  console.log();
  console.log(chalk.cyan("Resuming orchestration..."));
  console.log();

  displayResumeContext(activeState, pausedAgents);

  console.log(chalk.green(`\n▶ Resumed ${String(pausedAgents.length)} agent(s)`));
  for (const agent of pausedAgents) {
    console.log(
      chalk.gray(`  • ${agent.id}: ${agent.taskId} - "${agent.taskTitle}" (${String(agent.progress)}%)`)
    );
  }
  console.log();

  return {
    resumedCount: pausedAgents.length,
    resumedAgents: pausedAgents.map((a) => a.id),
    alreadyRunning: 0,
  };
}

/**
 * Display context about what is being resumed.
 */
function displayResumeContext(
  state: SessionState,
  resumingAgents: SerializedAgent[]
): void {
  const relativeTime = formatRelativeTime(state.updatedAt);

  console.log(chalk.gray(`Saved state from: ${relativeTime}`));
  console.log(
    chalk.gray(`Epic: ${state.epicName} (${String(state.progress)}% complete)`)
  );

  // Show previously completed items
  if (state.completedItems.length > 0) {
    console.log();
    console.log(chalk.gray("Previously completed:"));
    const itemsToShow = state.completedItems.slice(-5); // Show last 5
    const hiddenCount = state.completedItems.length - itemsToShow.length;

    if (hiddenCount > 0) {
      console.log(chalk.gray(`  ... and ${String(hiddenCount)} earlier items`));
    }

    for (const item of itemsToShow) {
      console.log(chalk.gray(`  ✓ ${item.identifier}`));
    }
  }

  // Show what's being resumed
  if (resumingAgents.length > 0) {
    console.log();
    console.log(chalk.gray("Resuming from:"));
    for (const agent of resumingAgents) {
      const progressInfo =
        agent.progress > 0 ? ` (was ${String(agent.progress)}% complete)` : "";
      console.log(
        chalk.gray(`  ○ ${agent.taskId} "${agent.taskTitle}"${progressInfo}`)
      );
    }
  }

  // Show upcoming items if available
  if (state.upNext && state.upNext.length > 0) {
    console.log();
    console.log(chalk.gray("Up next:"));
    for (const item of state.upNext.slice(0, 3)) {
      console.log(chalk.gray(`  ○ ${item}`));
    }
    if (state.upNext.length > 3) {
      console.log(chalk.gray(`  ... and ${String(state.upNext.length - 3)} more`));
    }
  }
}

/**
 * Get a status icon for an agent status.
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case "working":
      return "◐";
    case "idle":
      return "○";
    case "paused":
      return "⏸";
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    default:
      return "?";
  }
}

// =============================================================================
// Exports for External Use
// =============================================================================

/**
 * Get the number of paused agents.
 */
export function getPausedAgentCount(): number {
  const state = getActiveState();
  if (!state) return 0;

  return state.activeAgents.filter((a) => a.status === "paused").length;
}

/**
 * Get the number of running (non-paused) agents.
 */
export function getRunningAgentCount(): number {
  const state = getActiveState();
  if (!state) return 0;

  return state.activeAgents.filter(
    (a) => a.status === "working" || a.status === "idle"
  ).length;
}

/**
 * Check if there is a saved state that can be resumed.
 */
export function canResume(): boolean {
  const state = getActiveState();
  if (!state) return false;

  return state.activeAgents.some((a) => a.status === "paused");
}

/**
 * Get resume preview information without actually resuming.
 */
export function getResumePreview(): {
  epicName: string;
  progress: number;
  pausedAgents: { id: string; taskId: string; progress: number }[];
  completedCount: number;
  stateAge: number;
} | null {
  const state = getActiveState();
  if (!state) return null;

  const pausedAgents = state.activeAgents
    .filter((a) => a.status === "paused")
    .map((a) => ({
      id: a.id,
      taskId: a.taskId,
      progress: a.progress,
    }));

  return {
    epicName: state.epicName,
    progress: state.progress,
    pausedAgents,
    completedCount: state.completedItems.length,
    stateAge: Date.now() - new Date(state.updatedAt).getTime(),
  };
}
