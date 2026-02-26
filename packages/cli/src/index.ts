#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { publishCommand } from './commands/publish.js';
import { epicsCommand } from './commands/epics.js';
import { requestsCommand } from './commands/requests.js';
import { featuresCommand } from './commands/features.js';
import { tasksCommand } from './commands/tasks.js';

const program = new Command();

program
  .name('spectree')
  .description('SpecTree CLI - Manage epics, requests, and Skill Packs')
  .version('0.1.0');

// Skill Pack commands
program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(publishCommand);

// Project management commands
program.addCommand(epicsCommand);
program.addCommand(requestsCommand);
program.addCommand(featuresCommand);
program.addCommand(tasksCommand);

// Parse arguments
program.parse(process.argv);
