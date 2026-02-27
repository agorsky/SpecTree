import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { DispatcherApiClient } from '../utils/spectree-api-client.js';

interface FeaturesListOptions {
  epic: string;
  status?: string;
  url?: string;
  token?: string;
}

interface FeaturesGetOptions {
  url?: string;
  token?: string;
}

export const featuresCommand = new Command('features')
  .description('Manage features');

// spectree features list --epic <id>
featuresCommand
  .command('list')
  .description('List features for an epic')
  .requiredOption('--epic <id>', 'Epic ID')
  .option('--status <status>', 'Filter by status name')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: FeaturesListOptions) => {
    const spinner = ora('Fetching features...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const params: { status?: string } = {};
      if (options.status) params.status = options.status;
      const result = await client.listFeatures(options.epic, params);
      spinner.stop();

      if (result.data.length === 0) {
        console.log(chalk.yellow('No features found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Identifier'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Tasks'),
        ],
      });

      for (const feat of result.data) {
        const statusName = feat.status?.name ?? '—';
        const statusCategory = feat.status?.category;
        let coloredStatus = statusName;
        if (statusCategory === 'completed') coloredStatus = chalk.green(statusName);
        else if (statusCategory === 'started') coloredStatus = chalk.blue(statusName);
        else if (statusCategory === 'canceled') coloredStatus = chalk.red(statusName);
        else coloredStatus = chalk.gray(statusName);

        table.push([
          chalk.gray(feat.id.slice(0, 8)),
          feat.identifier ?? chalk.gray('—'),
          feat.title,
          coloredStatus,
          String(feat._count?.tasks ?? '—'),
        ]);
      }

      console.log(table.toString());
      if (result.meta.hasMore) {
        console.log(chalk.gray(`\nMore results available.`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list features'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree features get <id>
featuresCommand
  .command('get')
  .description('Get feature details')
  .argument('<id>', 'Feature ID')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (id: string, options: FeaturesGetOptions) => {
    const spinner = ora('Fetching feature...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const result = await client.getFeature(id);
      spinner.stop();

      const feat = result.data;
      console.log(chalk.bold('\nFeature Details'));
      console.log(`  ${chalk.gray('ID:')}          ${feat.id}`);
      if (feat.identifier) {
        console.log(`  ${chalk.gray('Identifier:')} ${feat.identifier}`);
      }
      console.log(`  ${chalk.gray('Title:')}       ${feat.title}`);
      console.log(`  ${chalk.gray('Description:')} ${feat.description ?? chalk.gray('(none)')}`);
      console.log(`  ${chalk.gray('Status:')}      ${feat.status?.name ?? chalk.gray('(none)')}`);
      console.log(`  ${chalk.gray('Assignee:')}    ${feat.assignee?.name ?? feat.assignee?.email ?? chalk.gray('(unassigned)')}`);
      console.log(`  ${chalk.gray('Epic ID:')}     ${feat.epicId}`);
      console.log(`  ${chalk.gray('Tasks:')}       ${String(feat._count?.tasks ?? '—')}`);
      console.log(`  ${chalk.gray('Created:')}     ${new Date(feat.createdAt).toLocaleString()}`);
      console.log(`  ${chalk.gray('Updated:')}     ${new Date(feat.updatedAt).toLocaleString()}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to get feature'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });
