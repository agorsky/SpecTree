import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient, type PackInfo } from '../utils/api-client.js';
import { FileManager } from '../utils/file-manager.js';
import { VersionResolver } from '../utils/version-resolver.js';
import { TableFormatter, type PackRow } from '../utils/table-formatter.js';

interface ListOptions {
  installed?: boolean;
  available?: boolean;
  registry?: string;
}

export const listCommand = new Command('list')
  .description('List installed and available Skill Packs')
  .option('--installed', 'Show only installed packs')
  .option('--available', 'Show only available packs from registry')
  .option('--registry <url>', 'Custom registry URL')
  .action(async (options: ListOptions) => {
    const spinner = ora('Loading packs...').start();

    try {
      const apiClient = new ApiClient(options.registry);
      const fileManager = new FileManager();

      // Determine what to show
      const showInstalled = options.installed ?? !options.available;
      const showAvailable = options.available ?? !options.installed;

      let installedPacks: Record<string, { version: string; installedAt: string }> = {};
      let availablePacks: PackInfo[] = [];

      // Fetch installed packs
      if (showInstalled) {
        try {
          const manifest = await fileManager.readManifest();
          installedPacks = manifest.installedPacks;
        } catch {
          // No manifest yet - no packs installed
        }
      }

      // Fetch available packs from registry
      if (showAvailable) {
        try {
          availablePacks = await apiClient.listPacks();
        } catch (error) {
          spinner.warn(chalk.yellow('Could not fetch available packs from registry'));
          if (error instanceof Error) {
            console.error(chalk.gray(`  ${error.message}`));
          }
        }
      }

      spinner.stop();

      // Display results based on mode
      if (options.installed) {
        // Show only installed packs
        if (Object.keys(installedPacks).length === 0) {
          console.log(TableFormatter.warning('No packs installed'));
          console.log(chalk.gray('\nInstall a pack: spectree install <pack-name>'));
          return;
        }

        console.log(chalk.bold('\nInstalled Packs:'));
        const rows: PackRow[] = Object.entries(installedPacks).map(
          ([name, info]) => ({
            name,
            version: info.version,
            installedVersion: info.installedAt,
          })
        );
        console.log(TableFormatter.formatInstalledPacks(rows));
      } else if (options.available) {
        // Show only available packs
        if (availablePacks.length === 0) {
          console.log(TableFormatter.warning('No packs available in registry'));
          return;
        }

        console.log(chalk.bold('\nAvailable Packs:'));
        const rows: PackRow[] = availablePacks.map((pack) => ({
          name: pack.name,
          version: pack.latestVersion,
          description: pack.description,
        }));
        console.log(TableFormatter.formatAvailablePacks(rows));
      } else {
        // Show combined view
        const combinedPacks = new Map<string, PackRow>();

        // Add available packs
        for (const pack of availablePacks) {
          combinedPacks.set(pack.name, {
            name: pack.name,
            version: pack.latestVersion,
            description: pack.description,
          });
        }

        // Merge with installed packs and check for updates
        for (const [name, installed] of Object.entries(installedPacks)) {
          const existing = combinedPacks.get(name);
          if (existing) {
            // Check if update is available
            const versionInfo = VersionResolver.compareVersions(
              installed.version,
              existing.version
            );
            combinedPacks.set(name, {
              ...existing,
              installedVersion: installed.version,
              updateAvailable: versionInfo.needsUpdate
                ? existing.version
                : undefined,
            });
          } else {
            // Pack is installed but not in registry (custom or removed)
            combinedPacks.set(name, {
              name,
              version: installed.version,
              installedVersion: installed.version,
              description: 'Not in registry',
            });
          }
        }

        const rows = Array.from(combinedPacks.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        if (rows.length === 0) {
          console.log(TableFormatter.warning('No packs found'));
          console.log(
            chalk.gray('\nInstall a pack: spectree install <pack-name>')
          );
          return;
        }

        console.log(chalk.bold('\nSkill Packs:'));
        console.log(TableFormatter.formatCombinedPacks(rows));

        // Show summary
        const installedCount = Object.keys(installedPacks).length;
        const availableCount = availablePacks.length;
        const updatesAvailable = rows.filter((r) => r.updateAvailable).length;

        console.log('');
        console.log(chalk.gray(`Installed: ${String(installedCount)}`));
        console.log(chalk.gray(`Available: ${String(availableCount)}`));
        if (updatesAvailable > 0) {
          console.log(chalk.yellow(`Updates available: ${String(updatesAvailable)}`));
          console.log(chalk.gray('\nRun: spectree update --yes'));
        }
      }
    } catch (error) {
      spinner.fail(TableFormatter.error('Failed to list packs'));

      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));
      }

      process.exit(1);
    }
  });
