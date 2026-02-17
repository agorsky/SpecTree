import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../utils/api-client.js';
import { FileManager } from '../utils/file-manager.js';
import { VersionResolver } from '../utils/version-resolver.js';
import { TableFormatter } from '../utils/table-formatter.js';

interface UpdateOptions {
  registry?: string;
  yes?: boolean;
}

export const updateCommand = new Command('update')
  .description('Update installed Skill Packs to the latest versions')
  .argument('[pack-name]', 'Name of a specific pack to update (optional)')
  .option('--registry <url>', 'Custom registry URL')
  .option('-y, --yes', 'Auto-confirm updates without prompting')
  .action(async (packName?: string, options?: UpdateOptions) => {
    const spinner = ora('Checking for updates...').start();

    try {
      // Initialize clients
      const apiClient = new ApiClient(options?.registry);
      const fileManager = new FileManager();

      // Read local manifest
      const manifest = await fileManager.readManifest();
      const installedPacks = manifest.installedPacks;

      if (Object.keys(installedPacks).length === 0) {
        spinner.info(chalk.yellow('No packs installed'));
        console.log(chalk.gray('\nInstall a pack first: spectree install <pack-name>'));
        return;
      }

      // Build list of packs to check (single pack or all)
      const packsToCheck = packName
        ? { [packName]: installedPacks[packName] }
        : installedPacks;

      if (packName && !packsToCheck[packName]) {
        spinner.fail(TableFormatter.error(`Pack '${packName}' is not installed`));
        process.exit(1);
      }

      // Check for updates
      spinner.text = 'Fetching latest versions...';
      const updates: Record<string, { current: string; latest: string }> = {};

      for (const [name, installed] of Object.entries(packsToCheck)) {
        if (!installed) continue;
        
        try {
          const packInfo = await apiClient.getPackManifest(name);
          const versionInfo = VersionResolver.compareVersions(
            installed.version,
            packInfo.version
          );

          if (versionInfo.needsUpdate) {
            updates[name] = {
              current: installed.version,
              latest: packInfo.version,
            };
          }
        } catch {
          console.warn(chalk.yellow(`\nWarning: Could not check updates for ${name}`));
        }
      }

      if (Object.keys(updates).length === 0) {
        spinner.succeed(TableFormatter.success('All packs are up to date'));
        return;
      }

      spinner.stop();

      // Display available updates
      console.log(chalk.bold('\nUpdates available:'));
      for (const [name, { current, latest }] of Object.entries(updates)) {
        console.log(
          `  ${chalk.cyan(name)}: ${chalk.gray(current)} → ${chalk.green(latest)}`
        );
      }

      // Confirm update (unless --yes flag)
      if (!options?.yes) {
        console.log(
          chalk.yellow(
            '\nRun with --yes to proceed with updates, or install manually with specific versions'
          )
        );
        return;
      }

      // Perform updates
      console.log('');
      for (const [name, { latest }] of Object.entries(updates)) {
        const updateSpinner = ora(`Updating ${name} to ${latest}...`).start();

        try {
          // Download new version
          const packFiles = await apiClient.downloadPackFiles(name, latest);
          
          // Remove old files
          const oldFiles = installedPacks[name]?.files ?? [];
          await fileManager.deletePackFiles(oldFiles);

          // Install new files
          const newFiles = await fileManager.copyFilesToGithub(packFiles, name);

          // Fetch and merge MCP config if present
          const packManifest = await apiClient.getPackManifest(name, latest);
          if (packManifest.mcpConfig) {
            await fileManager.mergeMcpConfig(packManifest.mcpConfig);
          }

          // Update manifest
          await fileManager.addPackToManifest(name, latest, newFiles);

          updateSpinner.succeed(
            TableFormatter.success(`Updated ${name} to ${latest}`)
          );
        } catch (error) {
          updateSpinner.fail(TableFormatter.error(`Failed to update ${name}`));
          if (error instanceof Error) {
            console.error(chalk.red(`  ${error.message}`));
          }
        }
      }

      console.log(chalk.green('\n✓ Update complete'));
    } catch (error) {
      spinner.fail(TableFormatter.error('Update failed'));

      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));

        if (error.message.includes('ENOENT') && error.message.includes('manifest')) {
          console.error(chalk.yellow('\nTip: No packs installed. Install a pack first.'));
        }
      }

      process.exit(1);
    }
  });
