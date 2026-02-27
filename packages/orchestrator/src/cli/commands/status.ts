/**
 * Status Command
 *
 * Shows status of current orchestration progress, including:
 * - Epic progress with feature breakdown
 * - Active agent status (for parallel execution)
 * - Recently completed items
 * - Next items in queue
 * - Estimated time remaining
 *
 * @example
 * ```bash
 * # Show current status
 * spectree-agent status
 *
 * # Show status for specific epic
 * spectree-agent status --epic "User Dashboard"
 *
 * # Show detailed agent information
 * spectree-agent status --agents
 * ```
 */

import chalk from "chalk";
import ora from "ora";

import {
  getActiveState,
  getRecentEpics,
  estimateRemainingTime,
  formatDuration,
  formatRelativeTime,
  type SessionState,
  type SerializedAgent,
  type CompletedItem,
} from "../state.js";
import { getApiToken, getApiUrl } from "./auth.js";
import { DispatcherClient, type Epic } from "../../spectree/api-client.js";

// =============================================================================
// Types
// =============================================================================

export interface StatusOptions {
  /** Show status for a specific epic by name or ID */
  epic?: string;
  /** Show detailed agent information */
  agents?: boolean;
}

// =============================================================================
// Main Command
// =============================================================================

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  // 1. Check for active orchestration state
  const activeState = getActiveState();

  // 2. If --epic option provided, fetch that specific epic
  if (options.epic) {
    await displayEpicStatus(options.epic, options.agents ?? false);
    return;
  }

  // 3. If active state exists, display it
  if (activeState) {
    displayActiveSessionStatus(activeState, options.agents ?? false);
    return;
  }

  // 4. No active state - show "no active orchestration" with recent epics
  displayNoActiveSession();
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display status for an active orchestration session
 */
function displayActiveSessionStatus(
  state: SessionState,
  showAgents: boolean
): void {
  console.log();

  // Header with epic name and progress
  const progressBar = buildProgressBar(state.progress, 35);
  console.log(
    chalk.cyan.bold(`Epic: ${state.epicName}`) +
      chalk.gray(` (${state.progress}% complete)`)
  );
  console.log(progressBar);
  console.log();

  // Phase info if available
  if (state.currentPhase !== undefined && state.totalPhases !== undefined) {
    console.log(
      chalk.gray(`Phase: ${state.currentPhase}/${state.totalPhases}`)
    );
  }

  // Active agents section
  if (state.activeAgents.length > 0 || showAgents) {
    displayAgentStatus(state.activeAgents);
  }

  // Completed items section
  if (state.completedItems.length > 0) {
    displayCompletedItems(state.completedItems);
  }

  // Failed items section
  if (state.failedItems.length > 0) {
    console.log(chalk.red(`\nFailed (${state.failedItems.length}):`));
    for (const id of state.failedItems) {
      console.log(chalk.red(`  ✗ ${id}`));
    }
  }

  // Up next section
  if (state.upNext && state.upNext.length > 0) {
    console.log(chalk.gray("\nUp next:"));
    for (const item of state.upNext.slice(0, 3)) {
      const blockedInfo =
        state.blockedBy && state.blockedBy.length > 0
          ? chalk.yellow(` (waiting on ${state.blockedBy.join(", ")})`)
          : "";
      console.log(chalk.gray(`  ${item}${blockedInfo}`));
    }
    if (state.upNext.length > 3) {
      console.log(chalk.gray(`  ... and ${state.upNext.length - 3} more`));
    }
  }

  // Session timing info
  const startTime = formatRelativeTime(state.startedAt);
  console.log(chalk.gray(`\nSession started: ${startTime}`));

  // Estimated time remaining
  const estimatedMs = estimateRemainingTime(state);
  if (estimatedMs !== null && estimatedMs > 0) {
    console.log(
      chalk.gray(`Estimated remaining: ~${formatDuration(estimatedMs)}`)
    );
  } else if (state.progress === 100) {
    console.log(chalk.green("Orchestration complete!"));
  }

  console.log();
}

/**
 * Display active agent status
 */
function displayAgentStatus(agents: SerializedAgent[]): void {
  if (agents.length === 0) {
    console.log(chalk.gray("\nNo active agents"));
    return;
  }

  console.log(chalk.cyan(`\nActive Agents (${agents.length}):`));

  for (const agent of agents) {
    const statusIcon = getStatusIcon(agent.status);
    const progressStr = `${agent.progress}%`;
    const branchStr = chalk.gray(`(branch: ${agent.branch})`);

    console.log(
      `  ${statusIcon} ${agent.id}: ${agent.taskId} "${agent.taskTitle}" ${branchStr} - ${progressStr}`
    );

    // Show current activity if available
    if (agent.currentFile) {
      console.log(chalk.gray(`      Editing: ${agent.currentFile}`));
    } else if (agent.currentActivity) {
      console.log(chalk.gray(`      ${agent.currentActivity}`));
    }
  }
}

/**
 * Display completed items
 */
function displayCompletedItems(items: CompletedItem[]): void {
  console.log(chalk.green(`\nCompleted this session (${items.length}):`));

  // Show last 5 completed items
  const recentItems = items.slice(-5);
  for (const item of recentItems) {
    const durationStr = formatDuration(item.duration);
    console.log(
      chalk.green(`  ✓ ${item.identifier}`) +
        chalk.gray(` "${item.title}"`) +
        chalk.gray(` (${durationStr})`)
    );
  }

  if (items.length > 5) {
    console.log(chalk.gray(`  ... and ${items.length - 5} more`));
  }
}

/**
 * Display "no active session" message with recent epics
 */
function displayNoActiveSession(): void {
  console.log();
  console.log(chalk.yellow("No active orchestration."));
  console.log();

  const recentEpics = getRecentEpics();

  if (recentEpics.length > 0) {
    console.log(chalk.gray("Recent epics:"));
    for (const epic of recentEpics.slice(0, 5)) {
      const timeAgo = formatRelativeTime(epic.lastWorkedAt);
      console.log(
        chalk.white(`  • ${epic.name}`) +
          chalk.gray(` (${epic.progress}% complete) - ${timeAgo}`)
      );
    }
    console.log();
    console.log(
      chalk.gray('Use: ') +
        chalk.white('spectree-agent continue "Epic Name"') +
        chalk.gray(' to resume')
    );
  } else {
    console.log(chalk.gray("Start one with:"));
    console.log(
      chalk.white('  spectree-agent run "Your feature description"')
    );
  }

  console.log();
}

/**
 * Display status for a specific epic (from API)
 */
async function displayEpicStatus(
  epicNameOrId: string,
  showAgents: boolean
): Promise<void> {
  const token = getApiToken();

  if (!token) {
    console.log();
    console.log(chalk.red("Not authenticated."));
    console.log(chalk.gray("Run: spectree-agent auth --token <your-token>"));
    console.log();
    return;
  }

  const spinner = ora("Loading epic status...").start();

  try {
    const client = new DispatcherClient({
      apiUrl: getApiUrl(),
      token,
    });

    // Try to get epic by ID first, then search by name
    let epic: Epic | undefined;
    let epicId: string;

    // Check if it looks like a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      epicNameOrId
    );

    if (isUuid) {
      epic = await client.getEpic(epicNameOrId);
      epicId = epicNameOrId;
    } else {
      // Search for epic by name
      const epicsResult = await client.listEpics({ limit: 100 });
      epic = epicsResult.data.find(
        (e) => e.name.toLowerCase() === epicNameOrId.toLowerCase()
      );

      if (!epic) {
        spinner.fail(`Epic "${epicNameOrId}" not found`);
        return;
      }
      epicId = epic.id;
    }

    // Get progress summary
    const progress = await client.getProgressSummary(epicId);

    spinner.stop();

    // Display epic status
    console.log();
    const overallProgress = progress.overallProgress;
    const progressBar = buildProgressBar(overallProgress, 35);

    console.log(
      chalk.cyan.bold(`Epic: ${progress.epic.name}`) +
        chalk.gray(` (${overallProgress}% complete)`)
    );
    console.log(progressBar);
    console.log();

    // Feature breakdown
    console.log(chalk.gray("Features:"));
    console.log(
      chalk.green(`  Completed: ${progress.completedFeatures}/${progress.totalFeatures}`)
    );
    if (progress.inProgressFeatures > 0) {
      console.log(chalk.cyan(`  In Progress: ${progress.inProgressFeatures}`));
    }
    if (progress.blockedFeatures > 0) {
      console.log(chalk.red(`  Blocked: ${progress.blockedFeatures}`));
    }

    // Task breakdown
    if (progress.totalTasks > 0) {
      console.log(chalk.gray("\nTasks:"));
      console.log(
        chalk.green(`  Completed: ${progress.completedTasks}/${progress.totalTasks}`)
      );
    }

    // Check if this epic has an active session
    const activeState = getActiveState();
    if (activeState && activeState.epicId === epicId) {
      console.log(chalk.cyan("\n✓ This epic has an active orchestration session"));

      if (showAgents && activeState.activeAgents.length > 0) {
        displayAgentStatus(activeState.activeAgents);
      }
    }

    console.log();
  } catch (error) {
    spinner.fail("Failed to load epic status");
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build a progress bar string
 */
function buildProgressBar(percent: number, width: number): string {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;

  const filledBar = chalk.cyan("━".repeat(filled));
  const emptyBar = chalk.gray("━".repeat(empty));
  const percentStr = `${Math.round(clampedPercent)}%`;

  return `${filledBar}${emptyBar} ${percentStr}`;
}

/**
 * Get status icon for agent status
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case "completed":
      return chalk.green("✓");
    case "failed":
      return chalk.red("✗");
    case "working":
      return chalk.cyan("●");
    case "idle":
      return chalk.yellow("○");
    case "paused":
      return chalk.gray("◐");
    default:
      return chalk.gray("?");
  }
}
