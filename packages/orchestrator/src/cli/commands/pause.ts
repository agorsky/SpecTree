/**
 * Pause Command
 *
 * Pauses running agents in an active orchestration session.
 * Agents can be paused individually or all at once.
 *
 * @example
 * ```bash
 * # Pause all running agents
 * spectree-agent pause
 *
 * # Pause a specific worker
 * spectree-agent pause worker-1
 *
 * # Pause with state saved
 * spectree-agent pause --save-state
 * ```
 */

import chalk from "chalk";

import { getActiveState, setActiveState, type SessionState } from "../state.js";
import { OrchestratorError, ErrorCode } from "../../errors.js";

// =============================================================================
// Types
// =============================================================================

export interface PauseOptions {
  /** Save state to checkpoint file before pausing */
  saveState?: boolean;
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Pause running agents in the active orchestration.
 *
 * @param worker - Optional worker ID to pause (e.g., "worker-1"). If not provided, pauses all agents.
 * @param options - Pause options
 */
export async function pauseCommand(
  worker?: string,
  options: PauseOptions = {}
): Promise<void> {
  // 1. Load active orchestration state
  const activeState = getActiveState();

  if (!activeState) {
    console.log();
    console.log(chalk.red("No active orchestration to pause."));
    console.log(chalk.gray("Start one with:"));
    console.log(chalk.white('  spectree-agent run "Your feature description"'));
    console.log();
    throw new OrchestratorError(
      "No active orchestration to pause",
      ErrorCode.CONFIG_MISSING,
      {
        recoveryHint: "Start an orchestration first with 'spectree-agent run'",
      }
    );
  }

  // 2. Handle specific worker first (before checking activeAgents count)
  if (worker) {
    // Find the specific worker
    const agent = activeState.activeAgents.find((a) => a.id === worker);

    if (!agent) {
      const availableAgents = activeState.activeAgents;
      console.log();
      console.log(chalk.red(`Worker not found: ${worker}`));
      if (availableAgents.length > 0) {
        console.log(chalk.gray("Available workers:"));
        for (const a of availableAgents) {
          console.log(chalk.gray(`  • ${a.id} - ${a.taskId} (${a.status})`));
        }
      }
      console.log();
      throw new OrchestratorError(`Worker not found: ${worker}`, ErrorCode.CONFIG_INVALID, {
        context: { worker, availableWorkers: availableAgents.map((a) => a.id) },
        recoveryHint:
          availableAgents.length > 0
            ? `Use one of the available worker IDs: ${availableAgents.map((a) => a.id).join(", ")}`
            : "No workers are available to pause",
      });
    }

    if (agent.status === "paused") {
      console.log();
      console.log(chalk.yellow(`Worker ${worker} is already paused.`));
      console.log();
      return;
    }

    if (agent.status === "completed" || agent.status === "failed") {
      console.log();
      console.log(chalk.yellow(`Worker ${worker} is not running (status: ${agent.status}).`));
      console.log();
      return;
    }

    // Update agent status to paused
    const updatedAgents = activeState.activeAgents.map((a) =>
      a.id === worker ? { ...a, status: "paused" as const } : a
    );

    const updatedState: SessionState = {
      ...activeState,
      activeAgents: updatedAgents,
    };

    setActiveState(updatedState);

    console.log();
    console.log(chalk.yellow(`⏸ Paused ${worker}`));
    console.log(chalk.gray(`  Task: ${agent.taskId} - "${agent.taskTitle}"`));
    console.log(chalk.gray(`  Progress: ${agent.progress}%`));

    // Show resume instructions
    console.log();
    console.log(chalk.gray("To resume:"));
    console.log(chalk.white(`  spectree-agent resume ${worker}`));
    console.log();

    return;
  }

  // 3. Get active agents from state (for pause all)
  const activeAgents = activeState.activeAgents.filter(
    (a) => a.status === "working" || a.status === "idle"
  );

  if (activeAgents.length === 0) {
    console.log();
    console.log(chalk.yellow("No active agents to pause."));
    console.log(
      chalk.gray(`Epic "${activeState.epicName}" has no running agents.`)
    );
    console.log();
    return;
  }

  // Pause all active agents
  const updatedAgents = activeState.activeAgents.map((a) =>
    a.status === "working" || a.status === "idle"
      ? { ...a, status: "paused" as const }
      : a
  );

  const updatedState: SessionState = {
    ...activeState,
    activeAgents: updatedAgents,
  };

  setActiveState(updatedState);

  console.log();
  console.log(chalk.yellow(`⏸ Paused ${activeAgents.length} agent(s)`));
  for (const agent of activeAgents) {
    console.log(
      chalk.gray(`  • ${agent.id}: ${agent.taskId} - "${agent.taskTitle}"`)
    );
  }

  // 4. Save state if requested
  if (options.saveState) {
    await saveCheckpoint(activeState);
    console.log(chalk.green("\n✓ State saved"));
  }

  // 5. Show resume instructions
  console.log();
  console.log(chalk.gray("To resume:"));
  console.log(chalk.white("  spectree-agent resume"));
  console.log();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Save a checkpoint of the current orchestration state.
 * The state is already persisted via setActiveState, but this logs the action.
 */
async function saveCheckpoint(state: SessionState): Promise<void> {
  // State is already persisted through setActiveState()
  // This function exists for explicit user request via --save-state
  // and could be extended to save additional checkpoint data (e.g., to a backup file)

  const checkpointData = {
    epicId: state.epicId,
    epicName: state.epicName,
    activeAgents: state.activeAgents.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      progress: a.progress,
      status: a.status,
    })),
    completedItems: state.completedItems.map((c) => c.identifier),
    pausedAt: new Date().toISOString(),
  };

  // Log checkpoint info (could also write to a separate file if needed)
  // For now, state is managed through the Conf store in state.ts
  void checkpointData; // State is saved via setActiveState
}
