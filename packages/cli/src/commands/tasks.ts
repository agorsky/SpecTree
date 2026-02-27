import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { DispatcherApiClient } from '../utils/spectree-api-client.js';

interface TasksListOptions {
  feature: string;
  status?: string;
  url?: string;
  token?: string;
}

interface TasksGetOptions {
  url?: string;
  token?: string;
}

export const tasksCommand = new Command('tasks')
  .description('Manage tasks');

// spectree tasks list --feature <id>
tasksCommand
  .command('list')
  .description('List tasks for a feature')
  .requiredOption('--feature <id>', 'Feature ID')
  .option('--status <status>', 'Filter by status name')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: TasksListOptions) => {
    const spinner = ora('Fetching tasks...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const params: { status?: string } = {};
      if (options.status) params.status = options.status;
      const result = await client.listTasks(options.feature, params);
      spinner.stop();

      if (result.data.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Identifier'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Assignee'),
        ],
      });

      for (const task of result.data) {
        const statusName = task.status?.name ?? '—';
        const statusCategory = task.status?.category;
        let coloredStatus = statusName;
        if (statusCategory === 'completed') coloredStatus = chalk.green(statusName);
        else if (statusCategory === 'started') coloredStatus = chalk.blue(statusName);
        else if (statusCategory === 'canceled') coloredStatus = chalk.red(statusName);
        else coloredStatus = chalk.gray(statusName);

        table.push([
          chalk.gray(task.id.slice(0, 8)),
          task.identifier ?? chalk.gray('—'),
          task.title,
          coloredStatus,
          task.assignee?.name ?? task.assignee?.email ?? chalk.gray('—'),
        ]);
      }

      console.log(table.toString());
      if (result.meta.hasMore) {
        console.log(chalk.gray(`\nMore results available.`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list tasks'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree tasks get <id>
tasksCommand
  .command('get')
  .description('Get task details')
  .argument('<id>', 'Task ID')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (id: string, options: TasksGetOptions) => {
    const spinner = ora('Fetching task...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const result = await client.getTask(id);
      spinner.stop();

      const task = result.data;
      console.log(chalk.bold('\nTask Details'));
      console.log(`  ${chalk.gray('ID:')}          ${task.id}`);
      if (task.identifier) {
        console.log(`  ${chalk.gray('Identifier:')} ${task.identifier}`);
      }
      console.log(`  ${chalk.gray('Title:')}       ${task.title}`);
      console.log(`  ${chalk.gray('Description:')} ${task.description ?? chalk.gray('(none)')}`);
      console.log(`  ${chalk.gray('Status:')}      ${task.status?.name ?? chalk.gray('(none)')}`);
      console.log(`  ${chalk.gray('Assignee:')}    ${task.assignee?.name ?? task.assignee?.email ?? chalk.gray('(unassigned)')}`);
      console.log(`  ${chalk.gray('Feature ID:')} ${task.featureId}`);
      console.log(`  ${chalk.gray('Created:')}     ${new Date(task.createdAt).toLocaleString()}`);
      console.log(`  ${chalk.gray('Updated:')}     ${new Date(task.updatedAt).toLocaleString()}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to get task'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });
