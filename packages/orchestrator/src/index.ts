#!/usr/bin/env node
/**
 * SpecTree Parallel Agent Orchestrator CLI
 *
 * A CLI tool for orchestrating parallel AI agents to execute SpecTree epics.
 * Uses the GitHub Copilot SDK to spawn and manage multiple agent sessions.
 */

// Re-export UI components for programmatic use
export * from "./ui/index.js";

import { Command } from "commander";
import chalk from "chalk";
import { runCommand } from "./cli/commands/run.js";
import { continueCommand } from "./cli/commands/continue.js";
import { statusCommand } from "./cli/commands/status.js";
import { authCommand } from "./cli/commands/auth.js";

const program = new Command();

program
  .name("spectree-agent")
  .description("Parallel AI Agent Orchestrator for SpecTree")
  .version("0.1.0");

// Main command: run a new epic from a prompt
program
  .command("run <prompt>")
  .description("Create and execute a new epic from a natural language prompt")
  .option("-t, --team <name>", "Team to create epic in")
  .option("--dry-run", "Show plan without executing")
  .option("--sequential", "Disable parallel execution")
  .option("--max-agents <n>", "Maximum concurrent agents", "4")
  .option("-b, --branch <name>", "Base branch (default: current or main)")
  .option("--template <name>", "Use a template as starting point (e.g., 'Code Feature', 'Bug Fix')")
  .action(runCommand);

// Continue working on an existing epic
program
  .command("continue <epic>")
  .description("Continue working on an existing epic")
  .option("--from <feature>", "Start from specific feature")
  .option("--include-completed", "Re-run already completed items (default: skip them)")
  .action(continueCommand);

// Check status of running orchestration
program
  .command("status")
  .description("Show status of running orchestration")
  .action(statusCommand);

// Authentication
program
  .command("auth")
  .description("Authenticate with SpecTree API")
  .option("--token <token>", "Use API token directly")
  .action(authCommand);

// Parse and execute
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan("\n  SpecTree Parallel Agent Orchestrator\n"));
  console.log(chalk.gray("  Orchestrate AI agents to build features in parallel.\n"));
  program.outputHelp();
}
