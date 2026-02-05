/**
 * Progress Display
 *
 * Terminal-based progress display showing overall orchestration status.
 * Uses ora for spinners and chalk for colored output.
 *
 * Features:
 * - Real-time progress updates with spinner
 * - Completed/failed item tracking with visual indicators
 * - Smooth progress bar updates
 * - CI mode support (non-TTY output)
 *
 * @example
 * ```typescript
 * const display = new ProgressDisplay("User Dashboard", 6);
 * display.start();
 * display.setCurrentItem("COM-1", "Database schema");
 * display.markComplete("COM-1");
 * display.stop(result);
 * ```
 */

import ora, { type Ora } from "ora";
import chalk from "chalk";
import type { RunResult } from "../orchestrator/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Item tracking state
 */
interface TrackedItem {
  identifier: string;
  title: string;
  status: "completed" | "failed";
  error?: string;
}

/**
 * Options for ProgressDisplay
 */
export interface ProgressDisplayOptions {
  /** Whether to clear the screen on start (default: true for TTY) */
  clearScreen?: boolean;
  /** Whether to show the completed items list (default: true) */
  showCompleted?: boolean;
  /** Progress bar width in characters (default: 35) */
  barWidth?: number;
}

// =============================================================================
// Progress Display Class
// =============================================================================

/**
 * Terminal-based progress display for orchestration status
 */
export class ProgressDisplay {
  private spinner: Ora | null = null;
  private epicName: string;
  private totalItems: number;
  private completedItems: TrackedItem[] = [];
  private failedItems: TrackedItem[] = [];
  private currentItem: { identifier: string; title: string } | null = null;
  private isStarted = false;
  private isTTY: boolean;
  private options: Required<ProgressDisplayOptions>;

  /**
   * Create a new ProgressDisplay
   *
   * @param epicName - Name of the epic being executed
   * @param totalItems - Total number of items to track
   * @param options - Display options
   */
  constructor(
    epicName: string,
    totalItems: number,
    options: ProgressDisplayOptions = {}
  ) {
    this.epicName = epicName;
    this.totalItems = totalItems;
    this.isTTY = process.stdout.isTTY ?? false;

    this.options = {
      clearScreen: options.clearScreen ?? this.isTTY,
      showCompleted: options.showCompleted ?? true,
      barWidth: options.barWidth ?? 35,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Start displaying progress
   */
  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    if (this.options.clearScreen && this.isTTY) {
      console.clear();
    }

    this.renderHeader();

    if (this.isTTY) {
      this.spinner = ora({
        text: "Starting orchestration...",
        color: "cyan",
      }).start();
    } else {
      // CI mode: simple log output
      console.log("Starting orchestration...");
    }
  }

  /**
   * Update current item being worked on
   *
   * @param identifier - Item identifier (e.g., "COM-5")
   * @param title - Item title
   */
  setCurrentItem(identifier: string, title: string): void {
    this.currentItem = { identifier, title };
    const text = `Working on: ${identifier} "${title}"`;

    if (this.spinner) {
      this.spinner.text = text;
    } else {
      // CI mode
      console.log(`\n⏳ ${text}`);
    }
  }

  /**
   * Mark an item as completed
   *
   * @param identifier - Item identifier
   * @param title - Optional title (uses current item if not provided)
   */
  markComplete(identifier: string, title?: string): void {
    const itemTitle = title ?? this.currentItem?.title ?? "";
    this.completedItems.push({
      identifier,
      title: itemTitle,
      status: "completed",
    });

    const message = chalk.green(`✓ ${identifier} completed`);

    if (this.spinner) {
      this.spinner.succeed(message);
      // Restart spinner for next item
      this.spinner = ora({
        text: "Continuing...",
        color: "cyan",
      }).start();
    } else {
      // CI mode
      console.log(message);
    }

    if (this.currentItem?.identifier === identifier) {
      this.currentItem = null;
    }

    this.renderProgress();
  }

  /**
   * Mark an item as failed
   *
   * @param identifier - Item identifier
   * @param error - Error message
   * @param title - Optional title (uses current item if not provided)
   */
  markFailed(identifier: string, error: string, title?: string): void {
    const itemTitle = title ?? this.currentItem?.title ?? "";
    this.failedItems.push({
      identifier,
      title: itemTitle,
      status: "failed",
      error,
    });

    const message = chalk.red(`✗ ${identifier} failed: ${error}`);

    if (this.spinner) {
      this.spinner.fail(message);
      // Restart spinner for next item
      this.spinner = ora({
        text: "Continuing...",
        color: "cyan",
      }).start();
    } else {
      // CI mode
      console.log(message);
    }

    if (this.currentItem?.identifier === identifier) {
      this.currentItem = null;
    }

    this.renderProgress();
  }

  /**
   * Update overall progress percentage
   *
   * @param percent - Percentage complete (0-100)
   */
  updateProgress(percent: number): void {
    // In TTY mode, the progress is shown via renderProgress()
    // In CI mode, output a simple progress update
    if (!this.isTTY) {
      console.log(`Progress: ${Math.round(percent)}%`);
    }
  }

  /**
   * Show info message
   *
   * @param message - Message to display
   */
  info(message: string): void {
    if (this.spinner) {
      this.spinner.info(chalk.cyan(message));
      this.spinner = ora({
        text: this.currentItem
          ? `Working on: ${this.currentItem.identifier} "${this.currentItem.title}"`
          : "Continuing...",
        color: "cyan",
      }).start();
    } else {
      console.log(chalk.cyan(`ℹ ${message}`));
    }
  }

  /**
   * Show warning message
   *
   * @param message - Message to display
   */
  warn(message: string): void {
    if (this.spinner) {
      this.spinner.warn(chalk.yellow(message));
      this.spinner = ora({
        text: this.currentItem
          ? `Working on: ${this.currentItem.identifier} "${this.currentItem.title}"`
          : "Continuing...",
        color: "cyan",
      }).start();
    } else {
      console.log(chalk.yellow(`⚠ ${message}`));
    }
  }

  /**
   * Show error message
   *
   * @param message - Message to display
   */
  error(message: string): void {
    if (this.spinner) {
      this.spinner.fail(chalk.red(message));
      this.spinner = ora({
        text: this.currentItem
          ? `Working on: ${this.currentItem.identifier} "${this.currentItem.title}"`
          : "Continuing...",
        color: "cyan",
      }).start();
    } else {
      console.log(chalk.red(`✗ ${message}`));
    }
  }

  /**
   * Stop progress display and show final summary
   *
   * @param result - The orchestration run result
   */
  stop(result: RunResult): void {
    if (!this.isStarted) return;

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    this.renderSummary(result);
    this.isStarted = false;
  }

  // ===========================================================================
  // Getters
  // ===========================================================================

  /**
   * Get the current progress percentage
   */
  get progressPercent(): number {
    const completed = this.completedItems.length + this.failedItems.length;
    return this.totalItems > 0 ? (completed / this.totalItems) * 100 : 0;
  }

  /**
   * Get count of completed items
   */
  get completedCount(): number {
    return this.completedItems.length;
  }

  /**
   * Get count of failed items
   */
  get failedCount(): number {
    return this.failedItems.length;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Render the header with epic name
   */
  private renderHeader(): void {
    console.log();
    console.log(chalk.cyan(`✓ Epic: ${this.epicName}`));
    console.log();
  }

  /**
   * Render the progress bar and status
   */
  private renderProgress(): void {
    if (!this.isTTY) {
      // CI mode: simple text output
      const percent = Math.round(this.progressPercent);
      const completed = this.completedItems.length;
      const failed = this.failedItems.length;
      console.log(
        `[${percent}%] Completed: ${completed}/${this.totalItems}${failed > 0 ? `, Failed: ${failed}` : ""}`
      );
      return;
    }

    // TTY mode: progress bar
    const progressBar = this.buildProgressBar(this.progressPercent);
    console.log(progressBar);

    // Show completed items if enabled
    if (this.options.showCompleted && this.completedItems.length > 0) {
      console.log();
      console.log(
        chalk.gray(
          `Completed (${this.completedItems.length}/${this.totalItems}):`
        )
      );
      for (const item of this.completedItems.slice(-5)) {
        // Show last 5
        console.log(chalk.gray(`  ✓ ${item.identifier} "${item.title}"`));
      }
      if (this.completedItems.length > 5) {
        console.log(
          chalk.gray(`  ... and ${this.completedItems.length - 5} more`)
        );
      }
    }

    // Show failed items
    if (this.failedItems.length > 0) {
      console.log();
      console.log(chalk.red(`Failed (${this.failedItems.length}):`));
      for (const item of this.failedItems) {
        console.log(chalk.red(`  ✗ ${item.identifier} "${item.title}"`));
        if (item.error) {
          console.log(chalk.gray(`      ${item.error}`));
        }
      }
    }

    console.log();
  }

  /**
   * Build a progress bar string
   *
   * @param percent - Percentage complete (0-100)
   * @returns Formatted progress bar string
   */
  private buildProgressBar(percent: number): string {
    const { barWidth } = this.options;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const filled = Math.round((clampedPercent / 100) * barWidth);
    const empty = barWidth - filled;

    const filledBar = chalk.cyan("━".repeat(filled));
    const emptyBar = chalk.gray("━".repeat(empty));
    const percentStr = `${Math.round(clampedPercent)}%`;

    return `${filledBar}${emptyBar} ${percentStr}`;
  }

  /**
   * Render the final summary
   *
   * @param result - The orchestration run result
   */
  private renderSummary(result: RunResult): void {
    console.log();
    console.log(chalk.cyan("━".repeat(50)));
    console.log();

    if (result.success) {
      console.log(chalk.green.bold("✓ Orchestration completed successfully"));
    } else {
      console.log(chalk.red.bold("✗ Orchestration completed with failures"));
    }

    console.log();

    // Stats
    const durationSec = (result.duration / 1000).toFixed(1);
    console.log(chalk.white(`Duration: ${durationSec}s`));
    console.log(
      chalk.white(`Completed: ${result.completedItems.length}/${this.totalItems}`)
    );

    if (result.failedItems.length > 0) {
      console.log(chalk.red(`Failed: ${result.failedItems.length}`));
    }

    // Summary
    if (result.summary) {
      console.log();
      console.log(chalk.gray(result.summary));
    }

    console.log();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ProgressDisplay instance
 *
 * @param epicName - Name of the epic being executed
 * @param totalItems - Total number of items to track
 * @param options - Display options
 * @returns A new ProgressDisplay instance
 */
export function createProgressDisplay(
  epicName: string,
  totalItems: number,
  options?: ProgressDisplayOptions
): ProgressDisplay {
  return new ProgressDisplay(epicName, totalItems, options);
}
