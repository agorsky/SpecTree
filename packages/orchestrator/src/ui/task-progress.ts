/**
 * Task Progress Display
 *
 * Shows real-time progress for individual task execution with:
 * - Spinner with current activity text
 * - Live elapsed time
 * - Message counter
 * - Milestone logging for significant events
 * - TTY and CI mode support
 */

import ora, { type Ora } from "ora";
import chalk from "chalk";

// =============================================================================
// Types
// =============================================================================

export interface TaskProgressDisplayOptions {
  /** Task identifier (e.g., "ENG-67-1") */
  taskId: string;
  /** Task title for display */
  taskTitle: string;
  /** Whether to show milestone logs (default: true) */
  showMilestones?: boolean;
}

interface Milestone {
  /** Elapsed seconds from task start */
  elapsed: number;
  /** Milestone description */
  message: string;
}

// =============================================================================
// TaskProgressDisplay Class
// =============================================================================

export class TaskProgressDisplay {
  private options: Required<TaskProgressDisplayOptions>;
  private spinner: Ora | null = null;
  private startTime: number = 0;
  private messageCount: number = 0;
  private milestones: Milestone[] = [];
  private currentActivity: string = "Starting...";
  private updateIntervalId: ReturnType<typeof setInterval> | null = null;
  private isTTY: boolean;

  constructor(options: TaskProgressDisplayOptions) {
    this.options = {
      taskId: options.taskId,
      taskTitle: options.taskTitle,
      showMilestones: options.showMilestones ?? true,
    };
    this.isTTY = process.stdout.isTTY ?? false;
  }

  /**
   * Start the progress display.
   */
  start(): void {
    this.startTime = Date.now();
    this.messageCount = 0;
    this.milestones = [];

    if (this.isTTY) {
      this.spinner = ora({
        text: this.formatSpinnerText(),
        color: "cyan",
        spinner: "dots",
      }).start();

      // Update elapsed time every second
      this.updateIntervalId = setInterval(() => {
        if (this.spinner) {
          this.spinner.text = this.formatSpinnerText();
        }
      }, 1000);
    } else {
      // CI mode: simple log
      console.log(
        `[${this.options.taskId}] Starting: ${this.options.taskTitle}`
      );
    }
  }

  /**
   * Update the current activity text.
   */
  setActivity(activity: string): void {
    this.currentActivity = activity;

    if (this.spinner) {
      this.spinner.text = this.formatSpinnerText();
    }
  }

  /**
   * Increment the message counter.
   */
  incrementMessageCount(): void {
    this.messageCount++;
    if (this.spinner) {
      this.spinner.text = this.formatSpinnerText();
    }
  }

  /**
   * Log a significant milestone event.
   */
  logMilestone(message: string): void {
    if (!this.options.showMilestones) return;

    const elapsed = this.getElapsedSeconds();
    this.milestones.push({ elapsed, message });

    const formatted = chalk.gray(`  [${this.formatTime(elapsed)}] ${message}`);

    if (this.isTTY && this.spinner) {
      // Temporarily pause spinner to print milestone
      this.spinner.clear();
      console.log(formatted);
      this.spinner.render();
    } else {
      console.log(formatted);
    }
  }

  /**
   * Stop the progress display.
   *
   * @param success - Whether the task completed successfully
   */
  stop(success: boolean = true): void {
    // Clear the update interval
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    const elapsed = this.getElapsedSeconds();
    const summary = `${this.options.taskId}: ${this.options.taskTitle} (${this.formatTime(elapsed)}, ${this.messageCount} msgs)`;

    if (this.spinner) {
      if (success) {
        this.spinner.succeed(chalk.green(summary));
      } else {
        this.spinner.fail(chalk.red(summary));
      }
      this.spinner = null;
    } else {
      // CI mode
      const icon = success ? "DONE" : "FAIL";
      console.log(`[${this.options.taskId}] ${icon}: ${this.formatTime(elapsed)}, ${this.messageCount} msgs`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private formatSpinnerText(): string {
    const elapsed = this.formatTime(this.getElapsedSeconds());
    return `${chalk.bold(this.options.taskId)}: ${this.currentActivity} ${chalk.gray(`| ${elapsed} | ${this.messageCount} msgs`)}`;
  }

  private getElapsedSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
}
