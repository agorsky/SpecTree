import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { ApiClient } from '../utils/api-client.js';
import { PackBundler } from '../utils/pack-bundler.js';
import { TableFormatter } from '../utils/table-formatter.js';

interface PublishOptions {
  registry?: string;
  token?: string;
  dryRun?: boolean;
}

export const publishCommand = new Command('publish')
  .description('Publish a Skill Pack to the registry')
  .option('--registry <url>', 'Custom registry URL')
  .option('--token <token>', 'Authentication token (or set SPECTREE_API_TOKEN env var)')
  .option('--dry-run', 'Validate the pack without publishing')
  .action(async (options: PublishOptions) => {
    const spinner = ora('Preparing pack for publishing...').start();

    try {
      const bundler = new PackBundler();

      // Validate pack
      spinner.text = 'Validating pack...';
      const validation = await bundler.validatePack(options.dryRun);

      if (!validation.valid) {
        spinner.fail(TableFormatter.error('Pack validation failed'));
        console.error(chalk.red('\nErrors:'));
        for (const error of validation.errors) {
          console.error(chalk.red(`  ✗ ${error}`));
        }
        process.exit(1);
      }

      if (validation.warnings.length > 0) {
        spinner.warn(chalk.yellow('Pack has warnings'));
        for (const warning of validation.warnings) {
          console.warn(chalk.yellow(`  ⚠ ${warning}`));
        }
        console.log('');
      } else {
        spinner.succeed(TableFormatter.success('Pack validation passed'));
      }

      // Bundle the pack
      spinner.start('Bundling pack files...');
      const bundled = await bundler.bundlePack();

      if (options.dryRun) {
        spinner.succeed(TableFormatter.success('Dry run complete'));
        
        console.log(chalk.bold('\nPack contents:'));
        console.log(chalk.cyan(`  Name: ${bundled.manifest.name}`));
        console.log(chalk.cyan(`  Version: ${bundled.manifest.version}`));
        console.log(chalk.cyan(`  Description: ${bundled.manifest.description}`));
        if (bundled.manifest.author) {
          console.log(chalk.cyan(`  Author: ${bundled.manifest.author}`));
        }
        console.log(chalk.cyan(`  Files: ${String(Object.keys(bundled.files).length)}`));

        console.log(chalk.bold('\nFile list:'));
        for (const filePath of Object.keys(bundled.files)) {
          console.log(chalk.gray(`  - ${filePath}`));
        }

        console.log(
          chalk.green('\n✓ Pack is ready to publish. Remove --dry-run to upload.')
        );
        return;
      }

      // Get authentication token
      const token = options.token ?? process.env.SPECTREE_API_TOKEN;
      if (!token) {
        spinner.fail(TableFormatter.error('Authentication required'));
        console.error(
          chalk.red(
            '\nError: No authentication token provided. Use --token or set SPECTREE_API_TOKEN env var.'
          )
        );
        process.exit(1);
      }

      // Publish to registry
      spinner.start(`Publishing ${bundled.manifest.name}@${bundled.manifest.version}...`);
      const apiClient = new ApiClient(options.registry);

      // Create FormData for multipart upload
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('name', bundled.manifest.name);
      formData.append('version', bundled.manifest.version);
      formData.append('description', bundled.manifest.description);
      if (bundled.manifest.author) {
        formData.append('author', bundled.manifest.author);
      }
      formData.append('files', JSON.stringify(bundled.files));

      const packInfo = await apiClient.publishPack(formData, token);

      spinner.succeed(
        TableFormatter.success(
          `Published ${packInfo.name}@${packInfo.latestVersion}`
        )
      );

      console.log(chalk.bold('\nInstall with:'));
      console.log(chalk.cyan(`  spectree install ${packInfo.name}`));
    } catch (error) {
      spinner.fail(TableFormatter.error('Publish failed'));

      if (error instanceof Error) {
        console.error(chalk.red(`\nError: ${error.message}`));

        // Provide helpful hints
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error(
            chalk.yellow('\nTip: Check your authentication token is valid')
          );
        } else if (error.message.includes('409') || error.message.includes('already exists')) {
          console.error(
            chalk.yellow('\nTip: Version already published. Bump the version in .spectree/pack.json')
          );
        } else if (error.message.includes('ENOENT')) {
          console.error(
            chalk.yellow('\nTip: Make sure .spectree/pack.json exists with valid file references')
          );
        }
      }

      process.exit(1);
    }
  });
