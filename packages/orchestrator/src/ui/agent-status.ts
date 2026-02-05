/**
 * Agent Status Display
 *
 * Displays status of multiple parallel agents in the terminal.
 * Shows each agent's task, branch, progress, current file, and elapsed time.
 *
 * Features:
 * - Multi-line display for parallel agents
 * - Progress bar per agent with color-coded status
 * - Current activity and elapsed time display
 * - TTY/CI mode support
 * - Non-flickering updates
 *
 * @example
 * ```typescript
 * const display = new AgentStatusDisplay({ maxAgents: 4 });
 * display.addAgent(agent);
 * display.startUpdating();
 * display.updateAgent(agentId, { progress: 50, currentFile: "src/api.ts" });
 * display.stopUpdating();
 * ```
 */

import chalk from "chalk";
import type { Agent, AgentStatus } from "../orchestrator/agent-pool.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Display information for a tracked agent
 */
export interface AgentDisplayInfo {
  /** Agent identifier (e.g., "worker-1") */
  id: string;
  /** Task identifier (e.g., "COM-5") */
  taskId: string;
  /** Task title */
  taskTitle: string;
  /** Git branch */
  branch: string;
  /** Current status */
  status: AgentStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current file being edited (optional) */
  currentFile?: string;
  /** Current activity description (optional) */
  currentActivity?: string;
  /** Start timestamp for elapsed time calculation */
  startedAt: Date;
}

/**
 * Options for AgentStatusDisplay
 */
export interface AgentStatusDisplayOptions {
  /** Maximum number of agents (for header display) */
  maxAgents?: number;
  /** Progress bar width in characters (default: 6) */
  barWidth?: number;
  /** Update interval in milliseconds (default: 100 for ~10fps) */
  updateIntervalMs?: number;
  /** Whether to show table borders (default: true for TTY) */
  showBorders?: boolean;
  /** Custom output function (default: process.stdout.write) */
  output?: (text: string) => void;
}

// =============================================================================
// Agent Status Display Class
// =============================================================================

/**
 * Terminal-based display for multiple parallel agent status
 */
export class AgentStatusDisplay {
  private agents: Map<string, AgentDisplayInfo> = new Map();
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private maxAgents: number;
  private barWidth: number;
  private updateIntervalMs: number;
  private showBorders: boolean;
  private isTTY: boolean;
  private lastRenderLineCount: number = 0;
  private output: (text: string) => void;

  constructor(options: AgentStatusDisplayOptions = {}) {
    this.maxAgents = options.maxAgents ?? 4;
    this.barWidth = options.barWidth ?? 6;
    this.updateIntervalMs = options.updateIntervalMs ?? 100;
    this.isTTY = process.stdout.isTTY ?? false;
    this.showBorders = options.showBorders ?? this.isTTY;
    this.output = options.output ?? ((text) => process.stdout.write(text));
  }

  // ===========================================================================
  // Agent Management
  // ===========================================================================

  /**
   * Register an agent for display
   *
   * @param agent - Agent instance from the agent pool
   */
  addAgent(agent: Agent): void {
    const displayInfo: AgentDisplayInfo = {
      id: agent.id,
      taskId: agent.taskId,
      taskTitle: agent.item.title,
      branch: agent.branch,
      status: agent.status,
      progress: agent.progress,
      startedAt: agent.startedAt,
    };

    this.agents.set(agent.id, displayInfo);

    // In CI mode, log the addition
    if (!this.isTTY) {
      console.log(`[Agent] ${agent.id} started: ${agent.taskId} "${agent.item.title}"`);
    }
  }

  /**
   * Update an agent's display information
   *
   * @param agentId - Agent identifier
   * @param updates - Partial updates to apply
   */
  updateAgent(agentId: string, updates: Partial<AgentDisplayInfo>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, updates);

      // In CI mode, log significant updates
      if (!this.isTTY) {
        if (updates.status === "completed") {
          console.log(`[Agent] ${agentId} completed: ${agent.taskId}`);
        } else if (updates.status === "failed") {
          console.log(`[Agent] ${agentId} failed: ${agent.taskId}`);
        } else if (updates.progress !== undefined && updates.progress % 25 === 0) {
          console.log(`[Agent] ${agentId} progress: ${updates.progress}%`);
        }
      }
    }
  }

  /**
   * Remove an agent from display
   *
   * @param agentId - Agent identifier
   */
  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  /**
   * Get current agent count
   */
  get agentCount(): number {
    return this.agents.size;
  }

  /**
   * Get all tracked agents
   */
  getAgents(): AgentDisplayInfo[] {
    return Array.from(this.agents.values());
  }

  // ===========================================================================
  // Display Control
  // ===========================================================================

  /**
   * Start continuous display updates
   *
   * @param intervalMs - Optional override for update interval
   */
  startUpdating(intervalMs?: number): void {
    if (this.updateInterval) {
      return; // Already updating
    }

    if (!this.isTTY) {
      return; // Don't auto-update in CI mode
    }

    const interval = intervalMs ?? this.updateIntervalMs;
    this.updateInterval = setInterval(() => {
      this.refresh();
    }, interval);
  }

  /**
   * Stop continuous updates
   */
  stopUpdating(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Refresh the display once
   */
  refresh(): void {
    if (!this.isTTY) {
      return; // Use render() for CI output
    }

    const output = this.render();
    this.clearPreviousRender();
    this.output(output);
    this.lastRenderLineCount = output.split("\n").length;
  }

  /**
   * Clear the display (useful before switching to different output)
   */
  clear(): void {
    if (this.isTTY) {
      this.clearPreviousRender();
      this.lastRenderLineCount = 0;
    }
  }

  // ===========================================================================
  // Rendering
  // ===========================================================================

  /**
   * Render the current state as a string
   *
   * @returns Formatted display string
   */
  render(): string {
    const agents = Array.from(this.agents.values());

    if (agents.length === 0) {
      return this.renderEmpty();
    }

    const lines: string[] = [];

    // Header
    const activeCount = agents.filter(
      (a) => a.status === "working" || a.status === "idle"
    ).length;
    lines.push(this.renderHeader(activeCount));
    lines.push("");

    // Agent rows
    if (this.showBorders) {
      lines.push(...this.renderTableWithBorders(agents));
    } else {
      lines.push(...this.renderTableSimple(agents));
    }

    // Activity details
    const workingAgents = agents.filter((a) => a.status === "working");
    if (workingAgents.length > 0) {
      lines.push("");
      for (const agent of workingAgents) {
        lines.push(this.renderAgentActivity(agent));
      }
    }

    lines.push("");

    return lines.join("\n");
  }

  // ===========================================================================
  // Private Rendering Methods
  // ===========================================================================

  /**
   * Render the header line
   */
  private renderHeader(activeCount: number): string {
    return chalk.cyan.bold(`Active Agents (${activeCount}/${this.maxAgents}):`);
  }

  /**
   * Render empty state
   */
  private renderEmpty(): string {
    return chalk.gray("No active agents\n");
  }

  /**
   * Render table with box-drawing borders
   */
  private renderTableWithBorders(agents: AgentDisplayInfo[]): string[] {
    const lines: string[] = [];

    // Column widths
    const colAgent = 12;
    const colTask = 25;
    const colBranch = 20;
    const colProgress = 12;

    // Top border
    lines.push(
      `┌${"─".repeat(colAgent)}┬${"─".repeat(colTask)}┬${"─".repeat(colBranch)}┬${"─".repeat(colProgress)}┐`
    );

    // Header row
    lines.push(
      `│${this.padRight("Agent", colAgent)}│${this.padRight("Task", colTask)}│${this.padRight("Branch", colBranch)}│${this.padRight("Progress", colProgress)}│`
    );

    // Separator
    lines.push(
      `├${"─".repeat(colAgent)}┼${"─".repeat(colTask)}┼${"─".repeat(colBranch)}┼${"─".repeat(colProgress)}┤`
    );

    // Data rows
    for (const agent of agents) {
      const agentCell = this.padRight(agent.id, colAgent);
      const taskCell = this.padRight(
        this.truncate(`${agent.taskId} "${agent.taskTitle}"`, colTask - 1),
        colTask
      );
      const branchCell = this.padRight(
        this.truncate(agent.branch, colBranch - 1),
        colBranch
      );
      const progressCell = this.padRight(
        this.renderProgressBar(agent.progress, agent.status),
        colProgress
      );

      lines.push(`│${agentCell}│${taskCell}│${branchCell}│${progressCell}│`);
    }

    // Bottom border
    lines.push(
      `└${"─".repeat(colAgent)}┴${"─".repeat(colTask)}┴${"─".repeat(colBranch)}┴${"─".repeat(colProgress)}┘`
    );

    return lines;
  }

  /**
   * Render simple table without borders (CI-friendly)
   */
  private renderTableSimple(agents: AgentDisplayInfo[]): string[] {
    const lines: string[] = [];

    for (const agent of agents) {
      const status = this.getStatusIcon(agent.status);
      const progress = `${agent.progress.toFixed(0)}%`;
      lines.push(
        `  ${status} ${agent.id}: ${agent.taskId} "${agent.taskTitle}" - ${progress}`
      );
    }

    return lines;
  }

  /**
   * Render a single agent's current activity
   */
  private renderAgentActivity(agent: AgentDisplayInfo): string {
    const elapsed = this.formatDuration(agent.startedAt);
    let activity = agent.currentActivity ?? "Working";
    if (agent.currentFile) {
      activity = `Editing ${agent.currentFile}`;
    }
    return chalk.gray(`  ${agent.id}: ${activity} (${elapsed})`);
  }

  /**
   * Render a progress bar
   */
  private renderProgressBar(percent: number, status: AgentStatus): string {
    const width = this.barWidth;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clampedPercent / 100) * width);
    const empty = width - filled;

    const filledChar = "█";
    const emptyChar = "░";

    let filledBar: string;
    let emptyBar: string;

    // Color based on status
    switch (status) {
      case "completed":
        filledBar = chalk.green(filledChar.repeat(filled));
        emptyBar = chalk.gray(emptyChar.repeat(empty));
        break;
      case "failed":
        filledBar = chalk.red(filledChar.repeat(filled));
        emptyBar = chalk.gray(emptyChar.repeat(empty));
        break;
      case "working":
        filledBar = chalk.cyan(filledChar.repeat(filled));
        emptyBar = chalk.gray(emptyChar.repeat(empty));
        break;
      case "idle":
      case "paused":
      default:
        filledBar = chalk.yellow(filledChar.repeat(filled));
        emptyBar = chalk.gray(emptyChar.repeat(empty));
        break;
    }

    return `${filledBar}${emptyBar} ${clampedPercent.toFixed(0)}%`;
  }

  /**
   * Get status icon for an agent
   */
  private getStatusIcon(status: AgentStatus): string {
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

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Clear previous render output (move cursor up and clear lines)
   */
  private clearPreviousRender(): void {
    if (this.lastRenderLineCount > 0) {
      // Move cursor up and clear each line
      for (let i = 0; i < this.lastRenderLineCount; i++) {
        this.output("\x1b[1A\x1b[2K");
      }
    }
  }

  /**
   * Format a duration from a start time
   */
  private formatDuration(startedAt: Date): string {
    const seconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Pad a string to a given length (right-padded)
   */
  private padRight(str: string, length: number): string {
    // Strip ANSI codes for length calculation
    const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
    const padding = Math.max(0, length - stripped.length);
    return str + " ".repeat(padding);
  }

  /**
   * Truncate a string to a maximum length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 1) + "…";
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new AgentStatusDisplay instance
 *
 * @param options - Display options
 * @returns A new AgentStatusDisplay instance
 */
export function createAgentStatusDisplay(
  options?: AgentStatusDisplayOptions
): AgentStatusDisplay {
  return new AgentStatusDisplay(options);
}

// =============================================================================
// Standalone Utility Functions
// =============================================================================

/**
 * Render a progress bar string
 *
 * @param percent - Progress percentage (0-100)
 * @param width - Bar width in characters (default: 10)
 * @returns Formatted progress bar string
 */
export function renderProgressBar(percent: number, width: number = 10): string {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;
  const bar =
    chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  return `${bar} ${clampedPercent.toFixed(0)}%`;
}
