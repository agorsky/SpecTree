#!/usr/bin/env node
/**
 * SpecTree Parallel Agent Orchestrator CLI
 *
 * A CLI tool for orchestrating parallel AI agents to execute SpecTree epics.
 * Uses Claude Code CLI to spawn and manage AI agent sessions.
 */

// Re-export UI components for programmatic use
export * from "./ui/index.js";

import { Command } from "commander";
import chalk from "chalk";
import { runCommand } from "./cli/commands/run.js";
import { planCommand } from "./cli/commands/plan.js";
import { validateCommand } from "./cli/commands/validate.js";
import { continueCommand } from "./cli/commands/continue.js";
import { statusCommand } from "./cli/commands/status.js";
import { authCommand } from "./cli/commands/auth.js";

const program = new Command();

program
  .name("spectree-agent")
  .description("Parallel AI Agent Orchestrator for SpecTree")
  .version("0.1.0");

// Plan command: create a SpecTree epic from a description
program
  .command("plan [description]")
  .description(
    "Create a SpecTree epic from a natural language description using the planner agent"
  )
  .option("-t, --team <name>", "Team to create epic in")
  .option("--dry-run", "Show plan without creating epic in SpecTree")
  .option(
    "--gates <config>",
    "Review gate configuration (e.g., 'auto', 'review', 'auto,auto,review,review,review')"
  )
  .action(planCommand);

// Run command: execute an epic (from prompt or existing epic ID)
program
  .command("run [prompt]")
  .description(
    "Execute an epic. Pass a prompt to create+run, or an epic ID to run an existing epic"
  )
  .option("-f, --file <path>", "Read prompt from a file (markdown, text, etc.)")
  .option("-t, --team <name>", "Team to create epic in")
  .option("--dry-run", "Show execution plan without executing")
  .option("--sequential", "Disable parallel execution")
  .option("--max-agents <n>", "Maximum concurrent agents", "4")
  .option(
    "--parallel <n>",
    "Maximum concurrent Claude Code sessions (alias for --max-agents)"
  )
  .option("--phase <n>", "Execute only the specified phase number")
  .option(
    "-b, --branch <name>",
    "Base branch (default: current or main)"
  )
  .option(
    "--template <name>",
    "Use a template as starting point (e.g., 'Code Feature', 'Bug Fix')"
  )
  .option(
    "--no-task-level-agents",
    "Disable per-task agent spawning (use single agent per feature)"
  )
  .action(runCommand);

// Validate command: run validations for an epic's tasks
program
  .command("validate [epic]")
  .description(
    "Run all validation checks for an epic's tasks and report results"
  )
  .action(validateCommand);

// Continue working on an existing epic
program
  .command("continue <epic>")
  .description("Continue working on an existing epic")
  .option("--from <feature>", "Start from specific feature")
  .option(
    "--include-completed",
    "Re-run already completed items (default: skip them)"
  )
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
  console.log(
    chalk.gray("  Orchestrate AI agents to build features in parallel.\n")
  );
  program.outputHelp();
}
