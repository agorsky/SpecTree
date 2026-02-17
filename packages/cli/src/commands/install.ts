import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../utils/api-client.js';
import { FileManager } from '../utils/file-manager.js';
import { TableFormatter } from '../utils/table-formatter.js';

interface InstallOptions {
  version?: string;
  registry?: string;
  token?: string;
}

export const installCommand = new Command('install')
  .description('Install a Skill Pack from the registry')
  .argument('<pack-name>', 'Name of the pack to install (e.g., @spectree/pack-example)')
  .option('-v, --version <version>', 'Specific version to install (default: latest)')
  .option('--registry <url>', 'Custom registry URL')
  .option('--token <token>', 'API token for authentication (or set SPECTREE_TOKEN env var)')
  .action(async (packName: string, options: InstallOptions) => {
    const spinner = ora('Installing Skill Pack...').start();

    try {
      // Initialize clients
      const apiClient = new ApiClient(options.registry, options.token);
      const fileManager = new FileManager();

      // Fetch pack manifest
      spinner.text = `Fetching ${packName}...`;
      const manifest = await apiClient.getPackManifest(packName, options.version);

      spinner.text = `Downloading ${manifest.name}@${manifest.version}...`;
      const packFiles = await apiClient.downloadPackFiles(packName, options.version);

      // Copy files to .github directory
      spinner.text = 'Installing files...';
      const installedFiles = await fileManager.copyFilesToGithub(packFiles, manifest.name);

      // Merge MCP configuration if present
      if (manifest.mcpConfig) {
        spinner.text = 'Merging MCP configuration...';
        await fileManager.mergeMcpConfig(manifest.mcpConfig);
      }

      // Update local manifest
      spinner.text = 'Updating manifest...';
      await fileManager.addPackToManifest(
        manifest.name,
        manifest.version,
        installedFiles
      );

      spinner.succeed(TableFormatter.success(`Installed ${manifest.name}@${manifest.version}`));

      // Show next steps
      console.log('\n' + chalk.bold('Next steps:'));
      console.log(chalk.gray('  1. Review the installed files in .github/'));
      console.log(chalk.gray('  2. Commit the changes to version control'));
      console.log(chalk.gray('  3. Use the new skills and agents in your project'));

      if (manifest.mcpConfig) {
        console.log(chalk.gray('  4. MCP configuration has been updated'));
      }

    } catch (error) {
      spinner.fail(TableFormatter.error('Installation failed'));

      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));

        // Provide helpful hints based on error type
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          console.error(chalk.yellow('\nTip: Check your network connection and registry URL'));
        } else if (error.message.includes('404')) {
          console.error(chalk.yellow('\nTip: Verify the pack name and version exist in the registry'));
          console.error(chalk.gray('Run: spectree list --available'));
        } else if (error.message.includes('EACCES')) {
          console.error(chalk.yellow('\nTip: Check file permissions in the .github directory'));
        }
      }

      process.exit(1);
    }
  });
