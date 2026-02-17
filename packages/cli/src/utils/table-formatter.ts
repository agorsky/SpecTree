import Table from 'cli-table3';
import chalk from 'chalk';

export interface PackRow {
  name: string;
  version: string;
  description?: string;
  installedVersion?: string;
  updateAvailable?: string | undefined;
}

export class TableFormatter {
  /**
   * Format installed packs table
   */
  static formatInstalledPacks(packs: PackRow[]): string {
    if (!packs.length) {
      return chalk.yellow('No packs installed');
    }

    const table = new Table({
      head: [
        chalk.cyan('Pack Name'),
        chalk.cyan('Version'),
        chalk.cyan('Installed At'),
        chalk.cyan('Status'),
      ],
      colWidths: [30, 15, 25, 20],
    });

    for (const pack of packs) {
      const status = pack.updateAvailable
        ? chalk.yellow(`Update: ${pack.updateAvailable}`)
        : chalk.green('Up to date');

      table.push([
        pack.name,
        pack.version,
        pack.installedVersion || '-',
        status,
      ]);
    }

    return table.toString();
  }

  /**
   * Format available packs table
   */
  static formatAvailablePacks(packs: PackRow[]): string {
    if (!packs.length) {
      return chalk.yellow('No packs available');
    }

    const table = new Table({
      head: [
        chalk.cyan('Pack Name'),
        chalk.cyan('Latest Version'),
        chalk.cyan('Description'),
      ],
      colWidths: [30, 15, 50],
    });

    for (const pack of packs) {
      table.push([
        pack.name,
        pack.version,
        pack.description || '-',
      ]);
    }

    return table.toString();
  }

  /**
   * Format combined packs table (installed + available)
   */
  static formatCombinedPacks(packs: PackRow[]): string {
    if (!packs.length) {
      return chalk.yellow('No packs found');
    }

    const table = new Table({
      head: [
        chalk.cyan('Pack Name'),
        chalk.cyan('Installed'),
        chalk.cyan('Latest'),
        chalk.cyan('Status'),
      ],
      colWidths: [30, 15, 15, 20],
    });

    for (const pack of packs) {
      let status: string;
      if (!pack.installedVersion) {
        status = chalk.gray('Not installed');
      } else if (pack.updateAvailable) {
        status = chalk.yellow('Update available');
      } else {
        status = chalk.green('Up to date');
      }

      table.push([
        pack.name,
        pack.installedVersion || chalk.gray('-'),
        pack.version,
        status,
      ]);
    }

    return table.toString();
  }

  /**
   * Format a simple list
   */
  static formatList(items: string[]): string {
    return items.map((item) => `  ${chalk.cyan('•')} ${item}`).join('\n');
  }

  /**
   * Format success message
   */
  static success(message: string): string {
    return chalk.green(`✓ ${message}`);
  }

  /**
   * Format error message
   */
  static error(message: string): string {
    return chalk.red(`✗ ${message}`);
  }

  /**
   * Format warning message
   */
  static warning(message: string): string {
    return chalk.yellow(`⚠ ${message}`);
  }

  /**
   * Format info message
   */
  static info(message: string): string {
    return chalk.blue(`ℹ ${message}`);
  }
}
