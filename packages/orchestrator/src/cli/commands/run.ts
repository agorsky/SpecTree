/**
 * Run command - Create and execute a new epic from a natural language prompt
 *
 * This is the main entry point for the orchestrator. It:
 * 1. Verifies authentication
 * 2. Creates an API client and MCP tools
 * 3. Determines the target team (interactive selection if needed)
 * 4. Generates an execution plan using AI
 * 5. Executes the plan (or displays it for dry-run)
 * 6. Reports results
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import inquirer from "inquirer";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { getApiToken, getApiUrl } from "./auth.js";
import { getDefaultTeam, initConfig } from "../../config/index.js";
import {
  SpecTreeClient,
  createAgentTools,
  type Team,
} from "../../spectree/index.js";
import {
  PlanGenerator,
  Orchestrator,
  type GeneratedPlan,
  type RunResult,
  type ProgressEvent,
} from "../../orchestrator/index.js";
import {
  TaskProgressDisplay,
  ActivityTracker,
} from "../../ui/index.js";
import {
  AuthError,
  isAuthError,
  isNetworkError,
  isOrchestratorError,
  type OrchestratorError,
} from "../../errors.js";

// =============================================================================
// Types
// =============================================================================

interface RunOptions {
  team?: string;
  dryRun?: boolean;
  sequential?: boolean;
  maxAgents?: string;
  branch?: string;
  template?: string;
  file?: string;
  taskLevelAgents?: boolean;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display the generated plan in a formatted way
 */
function displayPlan(plan: GeneratedPlan): void {
  console.log(chalk.cyan("\n📋 Generated Execution Plan\n"));
  console.log(chalk.white(`Epic: ${plan.epicName}`));
  if (plan.epicDescription) {
    console.log(chalk.gray(`  ${plan.epicDescription.substring(0, 100)}${plan.epicDescription.length > 100 ? "..." : ""}`));
  }
  console.log();

  console.log(chalk.white(`Features (${plan.totalFeatures}):`));
  for (const feature of plan.features) {
    const parallelTag = feature.canParallelize
      ? chalk.blue(` [parallel: ${feature.parallelGroup || "default"}]`)
      : "";
    const complexityTag = feature.estimatedComplexity
      ? chalk.gray(` (${feature.estimatedComplexity})`)
      : "";

    console.log(
      chalk.yellow(`  ${feature.executionOrder}. `) +
      chalk.white(feature.title) +
      parallelTag +
      complexityTag
    );

    for (const task of feature.tasks) {
      console.log(chalk.gray(`      • ${task.title}`));
    }
  }

  console.log();
  console.log(chalk.white(`Total Tasks: ${plan.totalTasks}`));

  if (plan.parallelGroups.length > 0) {
    console.log(chalk.white(`Parallel Groups: ${plan.parallelGroups.join(", ")}`));
  }

  console.log();
  console.log(chalk.gray("─".repeat(60)));
  console.log(chalk.yellow("⚠️  Dry run - no changes made. Run without --dry-run to execute."));
  console.log();
}

/**
 * Display the generated plan for user review before execution
 */
function displayPlanForReview(plan: GeneratedPlan): void {
  console.log(chalk.cyan("\n" + "═".repeat(60)));
  console.log(chalk.cyan("📋 GENERATED EXECUTION PLAN"));
  console.log(chalk.cyan("═".repeat(60) + "\n"));

  console.log(chalk.white.bold(`Epic: ${plan.epicName}`));
  if (plan.epicDescription) {
    console.log(chalk.gray(plan.epicDescription));
  }
  console.log();

  console.log(chalk.white.bold(`Features (${plan.totalFeatures}):`));
  console.log(chalk.gray("─".repeat(40)));

  for (const feature of plan.features) {
    const parallelTag = feature.canParallelize
      ? chalk.blue(` [parallel: ${feature.parallelGroup || "default"}]`)
      : "";
    const complexityTag = feature.estimatedComplexity
      ? chalk.magenta(` [${feature.estimatedComplexity}]`)
      : "";

    console.log(
      chalk.yellow(`\n  ${feature.executionOrder}. `) +
      chalk.white.bold(feature.title) +
      parallelTag +
      complexityTag
    );
    console.log(chalk.gray(`     ${feature.identifier}`));

    for (const task of feature.tasks) {
      console.log(chalk.cyan(`      ├─ `) + chalk.white(task.title));
    }
  }

  console.log();
  console.log(chalk.gray("─".repeat(60)));
  console.log(
    chalk.white(`📊 Summary: `) +
    chalk.yellow(`${plan.totalFeatures} features`) +
    chalk.white(` with `) +
    chalk.yellow(`${plan.totalTasks} tasks`)
  );

  if (plan.parallelGroups.length > 0) {
    console.log(chalk.white(`🔀 Parallel Groups: `) + chalk.blue(plan.parallelGroups.join(", ")));
  }

  console.log(chalk.gray("─".repeat(60)));
  console.log();
}

/**
 * Display the final results of the orchestration run
 */
function displayResults(result: RunResult): void {
  console.log(chalk.cyan("\n📊 Orchestration Results\n"));

  if (result.success) {
    console.log(chalk.green("✓ All items completed successfully"));
  } else {
    console.log(chalk.red("✗ Some items failed"));
  }

  console.log();

  if (result.completedItems.length > 0) {
    console.log(chalk.green(`Completed (${result.completedItems.length}):`));
    for (const item of result.completedItems) {
      console.log(chalk.gray(`  ✓ ${item}`));
    }
  }

  if (result.failedItems.length > 0) {
    console.log(chalk.red(`\nFailed (${result.failedItems.length}):`));
    for (const item of result.failedItems) {
      console.log(chalk.gray(`  ✗ ${item}`));
    }
  }

  const durationSec = (result.duration / 1000).toFixed(1);
  console.log(chalk.gray(`\nTotal duration: ${durationSec}s`));

  if (result.summary) {
    console.log(chalk.gray(`\n${result.summary}`));
  }

  console.log();
}

/**
 * Display error with recovery hints
 */
function displayError(error: unknown, spinner?: Ora): void {
  if (spinner) {
    spinner.fail("Orchestration failed");
  }

  console.log();

  if (isAuthError(error)) {
    console.log(chalk.red("🔐 Authentication Error"));
    console.log(chalk.gray(`   ${error.message}`));
    console.log(chalk.yellow("\n   Hint: Run 'spectree-agent auth --token <your-token>' to authenticate"));
  } else if (isNetworkError(error)) {
    console.log(chalk.red("🌐 Network Error"));
    console.log(chalk.gray(`   ${error.message}`));
    if (error.retryable) {
      console.log(chalk.yellow("\n   Hint: Check your internet connection and try again"));
    }
    console.log(chalk.yellow("   Hint: Verify the SpecTree API is running and accessible"));
  } else if (isOrchestratorError(error)) {
    const orchError = error as OrchestratorError;
    console.log(chalk.red(`❌ ${orchError.name}`));
    console.log(chalk.gray(`   ${orchError.message}`));
    if (orchError.recoveryHint) {
      console.log(chalk.yellow(`\n   Hint: ${orchError.recoveryHint}`));
    }
  } else if (error instanceof Error) {
    console.log(chalk.red("❌ Error"));
    console.log(chalk.gray(`   ${error.message}`));
  } else {
    console.log(chalk.red("❌ Unknown error"));
    console.log(chalk.gray(`   ${String(error)}`));
  }

  console.log();
}

/**
 * Setup progress event handlers on the orchestrator.
 * Uses TaskProgressDisplay for real-time streaming feedback and
 * ActivityTracker for human-readable tool call labels.
 */
function setupProgressHandlers(orchestrator: Orchestrator): void {
  let currentDisplay: TaskProgressDisplay | null = null;

  orchestrator.on("item:start", (event: ProgressEvent) => {
    // Stop previous display if still running
    if (currentDisplay) {
      currentDisplay.stop(true);
    }
    if (event.item) {
      currentDisplay = new TaskProgressDisplay({
        taskId: event.item.identifier,
        taskTitle: event.item.title,
        showMilestones: true,
      });
      currentDisplay.start();
    }
  });

  orchestrator.on("item:progress", (event: ProgressEvent) => {
    if (!currentDisplay || !event.item) return;

    // Handle streaming progress events
    if (event.streamingType === "tool-call" && event.toolName) {
      const activity = ActivityTracker.mapToolToActivity(
        event.toolName,
        (event.toolArgs as Record<string, unknown>) ?? {}
      );
      currentDisplay.setActivity(activity);

      // Log milestones for significant tools
      if (ActivityTracker.isMilestone(event.toolName)) {
        currentDisplay.logMilestone(activity);
      }
    }

    if (event.streamingType === "message") {
      currentDisplay.incrementMessageCount();
    }

    // Handle legacy percentage-based progress
    if (event.percentComplete !== undefined && event.message) {
      currentDisplay.setActivity(`${event.message} (${event.percentComplete}%)`);
    }
  });

  orchestrator.on("item:complete", () => {
    if (currentDisplay) {
      currentDisplay.stop(true);
      currentDisplay = null;
    }
  });

  orchestrator.on("item:error", (event: ProgressEvent) => {
    if (currentDisplay) {
      currentDisplay.stop(false);
      currentDisplay = null;
    }
    if (event.error) {
      console.log(chalk.red(`   Error: ${event.error.message}`));
    }
  });
}

// =============================================================================
// Team Selection
// =============================================================================

/**
 * Prompt the user to select a team interactively
 */
async function promptForTeam(client: SpecTreeClient): Promise<{ id: string; name: string }> {
  const spinner = ora("Loading teams...").start();

  try {
    const teamsResult = await client.listTeams();
    spinner.stop();

    if (teamsResult.data.length === 0) {
      throw new Error("No teams found. Please create a team in SpecTree first.");
    }

    if (teamsResult.data.length === 1) {
      const team = teamsResult.data[0];
      if (!team) {
        throw new Error("No teams found.");
      }
      console.log(chalk.gray(`Using team: ${team.name}`));
      return { id: team.id, name: team.name };
    }

    const { selectedTeam } = await inquirer.prompt<{ selectedTeam: string }>([
      {
        type: "list",
        name: "selectedTeam",
        message: "Select a team:",
        choices: teamsResult.data.map((team: Team) => ({
          name: `${team.name} (${team.key})`,
          value: team.id,
        })),
      },
    ]);

    const team = teamsResult.data.find((t: Team) => t.id === selectedTeam);
    if (!team) {
      throw new Error("Selected team not found");
    }

    return { id: team.id, name: team.name };
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

/**
 * Resolve team from options, config, or interactive selection
 */
async function resolveTeam(
  client: SpecTreeClient,
  teamOption?: string
): Promise<{ id: string; name: string }> {
  // 1. Use explicit team option
  if (teamOption) {
    // Look up by name or key
    const teamsResult = await client.listTeams();
    const team = teamsResult.data.find(
      (t: Team) =>
        t.name.toLowerCase() === teamOption.toLowerCase() ||
        t.key.toLowerCase() === teamOption.toLowerCase()
    );

    if (!team) {
      throw new Error(
        `Team '${teamOption}' not found. Available teams: ${teamsResult.data.map((t: Team) => t.name).join(", ")}`
      );
    }

    return { id: team.id, name: team.name };
  }

  // 2. Use default team from config
  const defaultTeam = getDefaultTeam();
  if (defaultTeam) {
    const teamsResult = await client.listTeams();
    const team = teamsResult.data.find(
      (t: Team) =>
        t.name.toLowerCase() === defaultTeam.toLowerCase() ||
        t.key.toLowerCase() === defaultTeam.toLowerCase()
    );

    if (team) {
      console.log(chalk.gray(`Using default team: ${team.name}`));
      return { id: team.id, name: team.name };
    }
    // Default team not found, fall through to interactive selection
    console.log(chalk.yellow(`Default team '${defaultTeam}' not found, please select a team:`));
  }

  // 3. Interactive selection
  return promptForTeam(client);
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Main run command implementation
 */
export async function runCommand(
  prompt: string | undefined,
  options: RunOptions
): Promise<void> {
  console.log(chalk.cyan("\n🚀 SpecTree Parallel Agent Orchestrator\n"));

  // Resolve prompt from file and/or argument
  let resolvedPrompt: string;
  
  if (options.file) {
    const filePath = resolve(options.file);
    if (!existsSync(filePath)) {
      console.log(chalk.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }
    try {
      const fileContent = readFileSync(filePath, "utf-8");
      console.log(chalk.gray(`📄 Reading from: ${options.file}`));
      console.log(chalk.gray(`   File size: ${(fileContent.length / 1024).toFixed(1)} KB\n`));
      
      // If prompt is also provided, use it as instructions with file as context
      if (prompt) {
        resolvedPrompt = `${prompt}\n\n---\n\n## Reference Document\n\n${fileContent}`;
        console.log(chalk.gray(`📝 Using prompt as instructions with file as reference\n`));
      } else {
        resolvedPrompt = fileContent;
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to read file: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  } else if (prompt) {
    resolvedPrompt = prompt;
  } else {
    console.log(chalk.red("❌ Either a prompt or --file option is required"));
    console.log(chalk.gray("\nUsage:"));
    console.log(chalk.gray("  spectree-agent run \"Build a user dashboard\" --team Engineering"));
    console.log(chalk.gray("  spectree-agent run --file docs/feature-spec.md --team Engineering"));
    console.log(chalk.gray("  spectree-agent run \"Implement the roadmap\" --file docs/plan.md --team Engineering"));
    process.exit(1);
  }

  // Initialize config with any CLI overrides
  initConfig({
    maxAgents: options.maxAgents ? parseInt(options.maxAgents, 10) : undefined,
  });

  const spinner = ora("Checking authentication...").start();

  try {
    // Step 1: Verify authentication
    const token = getApiToken();
    if (!token) {
      throw AuthError.missingToken();
    }

    spinner.text = "Initializing API client...";

    // Step 2: Initialize clients
    const apiUrl = getApiUrl();
    const client = new SpecTreeClient({ apiUrl, token });
    const tools = createAgentTools(client);

    spinner.succeed("Initialized");

    // Display prompt summary (truncated for long file content)
    const promptPreview = resolvedPrompt.length > 200 
      ? resolvedPrompt.substring(0, 200) + "..." 
      : resolvedPrompt;
    console.log(chalk.white(`\nPrompt: "${promptPreview}"\n`));

    // Step 3: Resolve team
    const team = await resolveTeam(client, options.team);

    // Use resolvedPrompt instead of prompt for plan generation
    const prompt = resolvedPrompt;

    // Step 4: Generate plan
    const planSpinner = ora("Generating execution plan with AI...").start();
    const planGenerator = new PlanGenerator(client);
    const planOptions: {
      team: string;
      teamId: string;
      dryRun: boolean;
      template?: string;
    } = {
      team: team.name,
      teamId: team.id,
      dryRun: options.dryRun ?? false,
    };
    if (options.template) {
      planOptions.template = options.template;
    }
    const plan = await planGenerator.generatePlan(prompt, planOptions);
    planSpinner.succeed(`Generated plan: ${plan.totalFeatures} features, ${plan.totalTasks} tasks`);

    // Step 5: Handle dry-run
    if (options.dryRun) {
      displayPlan(plan);
      return;
    }

    // Step 5.5: Display plan and prompt for confirmation
    displayPlanForReview(plan);
    
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: "list",
        name: "action",
        message: "How would you like to proceed?",
        choices: [
          { name: "✅ Execute this plan", value: "execute" },
          { name: "📝 View plan in SpecTree UI first (opens browser)", value: "view" },
          { name: "❌ Cancel and discard", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") {
      console.log(chalk.yellow("\n⚠️  Plan cancelled. The epic has been created but no tasks will be executed."));
      console.log(chalk.gray(`   Epic ID: ${plan.epicId}`));
      console.log(chalk.gray(`   You can continue later with: spectree-agent continue "${plan.epicName}"`));
      console.log();
      return;
    }

    if (action === "view") {
      const webUrl = process.env.SPECTREE_WEB_URL || "http://localhost:5173";
      console.log(chalk.cyan(`\n🌐 Opening SpecTree UI...`));
      console.log(chalk.gray(`   ${webUrl}/epics/${plan.epicId}`));
      
      // Try to open browser
      const open = await import("open");
      await open.default(`${webUrl}/epics/${plan.epicId}`);
      
      // Ask again after viewing
      const { confirmAfterView } = await inquirer.prompt<{ confirmAfterView: boolean }>([
        {
          type: "confirm",
          name: "confirmAfterView",
          message: "Ready to execute the plan?",
          default: true,
        },
      ]);

      if (!confirmAfterView) {
        console.log(chalk.yellow("\n⚠️  Execution cancelled."));
        console.log(chalk.gray(`   You can continue later with: spectree-agent continue "${plan.epicName}"`));
        console.log();
        return;
      }
    }

    // Step 6: Execute orchestration
    console.log(chalk.cyan("\n🔧 Executing plan...\n"));

    const orchestrator = new Orchestrator({
      client,
      tools,
    });

    // Setup progress event handlers
    setupProgressHandlers(orchestrator);

    const result = await orchestrator.run(plan.epicId, {
      sequential: options.sequential ?? true, // Default to sequential for MVP
      taskLevelAgents: options.taskLevelAgents ?? true, // Default to task-level agents for fresh context
    });

    // Step 7: Display results
    displayResults(result);

    // Exit with appropriate code
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    displayError(error, spinner.isSpinning ? spinner : undefined);
    process.exit(1);
  }
}
