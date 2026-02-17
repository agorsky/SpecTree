#!/usr/bin/env node

import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

program
  .name('spectree')
  .description('SpecTree CLI - Install, update, and manage Skill Packs')
  .version('0.1.0');

// Register commands
program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(publishCommand);

// Parse arguments
program.parse(process.argv);
