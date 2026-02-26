import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { SpecTreeApiClient } from '../utils/spectree-api-client.js';

interface EpicsListOptions {
  team?: string;
  url?: string;
  token?: string;
}

interface EpicsGetOptions {
  url?: string;
  token?: string;
}

interface EpicsCreateOptions {
  name: string;
  team: string;
  description?: string;
  url?: string;
  token?: string;
}

export const epicsCommand = new Command('epics')
  .description('Manage epics');

// spectree epics list
epicsCommand
  .command('list')
  .description('List epics')
  .option('--team <key>', 'Filter by team ID or key')
  .option('--url <url>', 'SpecTree API URL (or set SPECTREE_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: EpicsListOptions) => {
    const spinner = ora('Fetching epics...').start();
    try {
      const client = new SpecTreeApiClient(options.url, options.token);
      const params: { teamId?: string } = {};
      if (options.team) {
        params.teamId = options.team;
      }
      const result = await client.listEpics(params);
      spinner.stop();

      if (result.data.length === 0) {
        console.log(chalk.yellow('No epics found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Name'),
          chalk.bold('Features'),
          chalk.bold('Created'),
        ],
      });

      for (const epic of result.data) {
        table.push([
          chalk.gray(epic.id.slice(0, 8)),
          epic.name,
          String(epic._count?.features ?? '—'),
          new Date(epic.createdAt).toLocaleDateString(),
        ]);
      }

      console.log(table.toString());
      if (result.meta.hasMore) {
        console.log(chalk.gray(`\nMore results available.`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list epics'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree epics get <id-or-name>
epicsCommand
  .command('get')
  .description('Get epic details')
  .argument('<id-or-name>', 'Epic ID or name')
  .option('--url <url>', 'SpecTree API URL (or set SPECTREE_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (idOrName: string, options: EpicsGetOptions) => {
    const spinner = ora('Fetching epic...').start();
    try {
      const client = new SpecTreeApiClient(options.url, options.token);
      const result = await client.getEpic(idOrName);
      spinner.stop();

      const epic = result.data;
      console.log(chalk.bold('\nEpic Details'));
      console.log(`  ${chalk.gray('ID:')}          ${epic.id}`);
      console.log(`  ${chalk.gray('Name:')}        ${epic.name}`);
      console.log(`  ${chalk.gray('Description:')} ${epic.description ?? chalk.gray('(none)')}`);
      console.log(`  ${chalk.gray('Archived:')}    ${epic.isArchived ? chalk.yellow('Yes') : chalk.green('No')}`);
      console.log(`  ${chalk.gray('Features:')}    ${String(epic._count?.features ?? '—')}`);
      console.log(`  ${chalk.gray('Created:')}     ${new Date(epic.createdAt).toLocaleString()}`);
      console.log(`  ${chalk.gray('Updated:')}     ${new Date(epic.updatedAt).toLocaleString()}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to get epic'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree epics create
epicsCommand
  .command('create')
  .description('Create a new epic')
  .requiredOption('--name <name>', 'Epic name')
  .requiredOption('--team <key>', 'Team ID or key')
  .option('--description <text>', 'Epic description')
  .option('--url <url>', 'SpecTree API URL (or set SPECTREE_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: EpicsCreateOptions) => {
    const spinner = ora('Creating epic...').start();
    try {
      const client = new SpecTreeApiClient(options.url, options.token);
      const input: { name: string; teamId: string; description?: string } = {
        name: options.name,
        teamId: options.team,
      };
      if (options.description) input.description = options.description;
      const result = await client.createEpic(input);
      spinner.succeed(chalk.green(`Epic created: ${result.data.name} (${result.data.id})`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create epic'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });
