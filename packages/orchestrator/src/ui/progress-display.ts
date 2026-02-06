import ora, { type Ora } from 'ora';
import chalk from 'chalk';

export type ProgressMode = 'sequential' | 'parallel' | 'merge';

export class ProgressDisplay {
  private spinners: Record<string, Ora> = {};
  private currentMode: ProgressMode = 'sequential';

  constructor(mode: ProgressMode = 'sequential') {
    this.currentMode = mode;
  }

  setMode(mode: ProgressMode) {
    this.currentMode = mode;
  }

  getMode(): ProgressMode {
    return this.currentMode;
  }

  startStep(id: string, label: string) {
    if (this.spinners[id]) return;
    const spinner = ora({
      text: chalk.cyan(label),
      spinner: 'dots',
    }).start();
    this.spinners[id] = spinner;
  }

  succeedStep(id: string, message?: string) {
    const spinner = this.spinners[id];
    if (spinner) {
      spinner.succeed(message ? chalk.green(message) : undefined);
      delete this.spinners[id];
    }
  }

  failStep(id: string, message?: string) {
    const spinner = this.spinners[id];
    if (spinner) {
      spinner.fail(message ? chalk.red(message) : undefined);
      delete this.spinners[id];
    }
  }

  updateStep(id: string, message: string) {
    const spinner = this.spinners[id];
    if (spinner) {
      spinner.text = chalk.cyan(message);
    }
  }

  info(message: string) {
    // For non-step info messages
    // eslint-disable-next-line no-console
    console.log(chalk.blueBright(message));
  }

  warn(message: string) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow(message));
  }

  error(message: string) {
    // eslint-disable-next-line no-console
    console.error(chalk.red(message));
  }

  // For merge mode, show a distinct message
  mergeInfo(message: string) {
    // eslint-disable-next-line no-console
    console.log(chalk.magenta(`[merge] ${message}`));
  }

  // End all spinners (e.g., on exit)
  endAll() {
    Object.values(this.spinners).forEach(spinner => spinner.stop());
    this.spinners = {};
  }
}
