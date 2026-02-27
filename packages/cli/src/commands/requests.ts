import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { DispatcherApiClient } from '../utils/spectree-api-client.js';

interface RequestsListOptions {
  status?: string;
  url?: string;
  token?: string;
}

interface RequestsGetOptions {
  url?: string;
  token?: string;
}

interface RequestsCreateOptions {
  title: string;
  problem: string;
  solution: string;
  impact: string;
  scope?: string;
  effort?: string;
  url?: string;
  token?: string;
}

interface RequestsApproveOptions {
  url?: string;
  token?: string;
}

interface RequestsRejectOptions {
  reason?: string;
  url?: string;
  token?: string;
}

function statusColor(status: string): string {
  switch (status) {
    case 'approved': return chalk.green(status);
    case 'rejected': return chalk.red(status);
    case 'converted': return chalk.blue(status);
    case 'pending':
    default: return chalk.yellow(status);
  }
}

export const requestsCommand = new Command('requests')
  .description('Manage epic requests');

// spectree requests list
requestsCommand
  .command('list')
  .description('List epic requests')
  .option('--status <status>', 'Filter by status (pending|approved|rejected|converted)')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: RequestsListOptions) => {
    const spinner = ora('Fetching epic requests...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const params: { status?: string } = {};
      if (options.status) params.status = options.status;
      const result = await client.listEpicRequests(params);
      spinner.stop();

      if (result.data.length === 0) {
        console.log(chalk.yellow('No epic requests found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('ID'),
          chalk.bold('Title'),
          chalk.bold('Status'),
          chalk.bold('Requested By'),
          chalk.bold('Created'),
        ],
      });

      for (const req of result.data) {
        table.push([
          chalk.gray(req.id.slice(0, 8)),
          req.title,
          statusColor(req.status),
          req.requestedBy?.name ?? req.requestedBy?.email ?? chalk.gray('—'),
          new Date(req.createdAt).toLocaleDateString(),
        ]);
      }

      console.log(table.toString());
      if (result.meta.hasMore) {
        console.log(chalk.gray(`\nMore results available.`));
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to list epic requests'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree requests get <id>
requestsCommand
  .command('get')
  .description('Get epic request details')
  .argument('<id>', 'Epic request ID')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (id: string, options: RequestsGetOptions) => {
    const spinner = ora('Fetching epic request...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const result = await client.getEpicRequest(id);
      spinner.stop();

      const req = result.data;
      console.log(chalk.bold('\nEpic Request Details'));
      console.log(`  ${chalk.gray('ID:')}          ${req.id}`);
      console.log(`  ${chalk.gray('Title:')}       ${req.title}`);
      console.log(`  ${chalk.gray('Status:')}      ${statusColor(req.status)}`);
      console.log(`  ${chalk.gray('Requested By:')} ${req.requestedBy?.name ?? req.requestedBy?.email ?? '—'}`);
      console.log(`  ${chalk.gray('Description:')} ${req.description ?? chalk.gray('(none)')}`);

      if (req.structuredDesc) {
        const sd = req.structuredDesc;
        console.log(`\n  ${chalk.bold('Structured Description')}`);
        console.log(`  ${chalk.gray('Problem:')}    ${sd.problemStatement}`);
        console.log(`  ${chalk.gray('Solution:')}   ${sd.proposedSolution}`);
        console.log(`  ${chalk.gray('Impact:')}     ${sd.impactAssessment}`);
        if (sd.estimatedEffort) {
          console.log(`  ${chalk.gray('Effort:')}     ${sd.estimatedEffort}`);
        }
      }

      console.log(`  ${chalk.gray('Created:')}     ${new Date(req.createdAt).toLocaleString()}`);
      console.log(`  ${chalk.gray('Updated:')}     ${new Date(req.updatedAt).toLocaleString()}`);
    } catch (error) {
      spinner.fail(chalk.red('Failed to get epic request'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree requests create
requestsCommand
  .command('create')
  .description('Create a new epic request')
  .requiredOption('--title <title>', 'Request title')
  .requiredOption('--problem <problem>', 'Problem statement')
  .requiredOption('--solution <solution>', 'Proposed solution')
  .requiredOption('--impact <impact>', 'Impact assessment')
  .option('--scope <scope>', 'Scope: personal or team (default: team)')
  .option('--effort <effort>', 'Estimated effort')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (options: RequestsCreateOptions) => {
    const spinner = ora('Creating epic request...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const structuredDesc: {
        problemStatement: string;
        proposedSolution: string;
        impactAssessment: string;
        estimatedEffort?: string;
      } = {
        problemStatement: options.problem,
        proposedSolution: options.solution,
        impactAssessment: options.impact,
      };
      if (options.effort) structuredDesc.estimatedEffort = options.effort;

      const input = {
        title: options.title,
        structuredDesc,
      };

      const isPersonal = options.scope === 'personal';
      const result = isPersonal
        ? await client.createPersonalEpicRequest(input)
        : await client.createEpicRequest(input);

      const scopeLabel = isPersonal ? ' (personal, auto-approved)' : '';
      spinner.succeed(chalk.green(`Epic request created${scopeLabel}: ${result.data.title} (${result.data.id})`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create epic request'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree requests approve <id>
requestsCommand
  .command('approve')
  .description('Approve an epic request')
  .argument('<id>', 'Epic request ID')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (id: string, options: RequestsApproveOptions) => {
    const spinner = ora('Approving epic request...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const result = await client.approveEpicRequest(id);
      spinner.succeed(chalk.green(`Epic request approved: ${result.data.title}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to approve epic request'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// spectree requests reject <id>
requestsCommand
  .command('reject')
  .description('Reject an epic request')
  .argument('<id>', 'Epic request ID')
  .option('--reason <reason>', 'Rejection reason')
  .option('--url <url>', 'Dispatcher API URL (or set DISPATCHER_API_URL)')
  .option('--token <token>', 'API token (or set SPECTREE_API_TOKEN)')
  .action(async (id: string, options: RequestsRejectOptions) => {
    const spinner = ora('Rejecting epic request...').start();
    try {
      const client = new DispatcherApiClient(options.url, options.token);
      const result = await client.rejectEpicRequest(id, options.reason);
      spinner.succeed(chalk.red(`Epic request rejected: ${result.data.title}`));
    } catch (error) {
      spinner.fail(chalk.red('Failed to reject epic request'));
      if (error instanceof Error) console.error(chalk.red(error.message));
      process.exit(1);
    }
  });
