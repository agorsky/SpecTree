/**
 * Plan command - Create a SpecTree epic from a natural language description
 *
 * Invokes the planner agent via ACP to analyze the codebase,
 * decompose the request into features/tasks, and create a
 * fully-specified SpecTree epic.
 *
 * @example
 * ```bash
 * # Create a new epic from a description
 * spectree-agent plan "Build a user preferences API"
 *
 * # Dry-run: show what would be created without creating
 * spectree-agent plan --dry-run "Add dark mode support"
 *
 * # Specify team explicitly
 * spectree-agent plan --team Engineering "Refactor auth module"
 * ```
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import { getApiToken, getApiUrl } from "./auth.js";
import { initConfig } from "../../config/index.js";
import { SpecTreeClient, type Team } from "../../spectree/index.js";
import { AcpClient, AcpSessionManager } from "../../acp/index.js";
import {
  PlanGenerator,
  type GeneratedPlan,
} from "../../orchestrator/index.js";
import {
  AuthError,
  isAuthError,
  isNetworkError,
  isOrchestratorError,
  type OrchestratorError,
} from "../../errors.js";
import { getDefaultTeam } from "../../config/index.js";
import inquirer from "inquirer";

// =============================================================================
// Types
// =============================================================================

export interface PlanOptions {
  team?: string;
  dryRun?: boolean;
  gates?: string;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display the generated plan summary
 */
function displayPlanSummary(plan: GeneratedPlan): void {
  console.log(chalk.cyan("\n" + "=".repeat(60)));
  console.log(chalk.cyan("  PLANNING COMPLETE"));
  console.log(chalk.cyan("=".repeat(60) + "\n"));

  console.log(chalk.white.bold(`Epic: ${plan.epicName}`));
  if (plan.epicDescription) {
    console.log(
      chalk.gray(
        plan.epicDescription.substring(0, 200) +
          (plan.epicDescription.length > 200 ? "..." : "")
      )
    );
  }
  console.log();

  console.log(chalk.white.bold(`Features (${plan.totalFeatures}):`));
  console.log(chalk.gray("-".repeat(40)));

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
      console.log(chalk.cyan("      |- ") + chalk.white(task.title));
    }
  }

  console.log();
  console.log(chalk.gray("-".repeat(60)));
  console.log(
    chalk.white("  Summary: ") +
      chalk.yellow(`${plan.totalFeatures} features`) +
      chalk.white(" with ") +
      chalk.yellow(`${plan.totalTasks} tasks`)
  );

  if (plan.parallelGroups.length > 0) {
    console.log(
      chalk.white("  Parallel Groups: ") +
        chalk.blue(plan.parallelGroups.join(", "))
    );
  }

  console.log(chalk.gray("-".repeat(60)));
  console.log();
  console.log(chalk.green(`  Epic ID: ${plan.epicId}`));
  console.log(
    chalk.gray(
      `  Continue with: spectree-agent run ${plan.epicId}`
    )
  );
  console.log();
}

/**
 * Display plan for dry-run mode (no epic created)
 */
function displayDryRunPlan(plan: GeneratedPlan): void {
  console.log(chalk.cyan("\n  Generated Execution Plan (Dry Run)\n"));
  console.log(chalk.white(`Epic: ${plan.epicName}`));
  if (plan.epicDescription) {
    console.log(
      chalk.gray(
        `  ${plan.epicDescription.substring(0, 100)}${plan.epicDescription.length > 100 ? "..." : ""}`
      )
    );
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
      console.log(chalk.gray(`      * ${task.title}`));
    }
  }

  console.log();
  console.log(chalk.white(`Total Tasks: ${plan.totalTasks}`));

  if (plan.parallelGroups.length > 0) {
    console.log(
      chalk.white(`Parallel Groups: ${plan.parallelGroups.join(", ")}`)
    );
  }

  console.log();
  console.log(chalk.gray("-".repeat(60)));
  console.log(
    chalk.yellow(
      "  Dry run - no epic created. Run without --dry-run to create."
    )
  );
  console.log();
}

/**
 * Display error with recovery hints
 */
function displayError(error: unknown, spinner?: Ora): void {
  if (spinner) {
    spinner.fail("Planning failed");
  }

  console.log();

  if (isAuthError(error)) {
    console.log(chalk.red("  Authentication Error"));
    console.log(chalk.gray(`   ${error.message}`));
    console.log(
      chalk.yellow(
        "\n   Hint: Run 'spectree-agent auth --token <your-token>' to authenticate"
      )
    );
  } else if (isNetworkError(error)) {
    console.log(chalk.red("  Network Error"));
    console.log(chalk.gray(`   ${error.message}`));
    if (error.retryable) {
      console.log(
        chalk.yellow(
          "\n   Hint: Check your internet connection and try again"
        )
      );
    }
    console.log(
      chalk.yellow(
        "   Hint: Verify the SpecTree API is running and accessible"
      )
    );
  } else if (isOrchestratorError(error)) {
    const orchError = error as OrchestratorError;
    console.log(chalk.red(`  ${orchError.name}`));
    console.log(chalk.gray(`   ${orchError.message}`));
    if (orchError.recoveryHint) {
      console.log(chalk.yellow(`\n   Hint: ${orchError.recoveryHint}`));
    }
  } else if (error instanceof Error) {
    console.log(chalk.red("  Error"));
    console.log(chalk.gray(`   ${error.message}`));
  } else {
    console.log(chalk.red("  Unknown error"));
    console.log(chalk.gray(`   ${String(error)}`));
  }

  console.log();
}

// =============================================================================
// Team Resolution
// =============================================================================

/**
 * Resolve team from options, config, or interactive selection
 */
async function resolveTeam(
  client: SpecTreeClient,
  teamOption?: string
): Promise<{ id: string; name: string }> {
  if (teamOption) {
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
    console.log(
      chalk.yellow(
        `Default team '${defaultTeam}' not found, please select a team:`
      )
    );
  }

  // Interactive selection
  const teamsResult = await client.listTeams();
  if (teamsResult.data.length === 0) {
    throw new Error(
      "No teams found. Please create a team in SpecTree first."
    );
  }

  if (teamsResult.data.length === 1) {
    const team = teamsResult.data[0]!;
    console.log(chalk.gray(`Using team: ${team.name}`));
    return { id: team.id, name: team.name };
  }

  const { selectedTeam } = await inquirer.prompt<{
    selectedTeam: string;
  }>([
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
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Plan command implementation.
 * Creates a SpecTree epic from a natural language description
 * using the planner agent via ACP.
 */
export async function planCommand(
  description: string | undefined,
  options: PlanOptions
): Promise<void> {
  console.log(chalk.cyan("\n  SpecTree Planning Pipeline\n"));

  if (!description) {
    console.log(chalk.red("  A description is required"));
    console.log(chalk.gray("\nUsage:"));
    console.log(
      chalk.gray(
        '  spectree-agent plan "Build a user preferences API"'
      )
    );
    console.log(
      chalk.gray(
        '  spectree-agent plan --dry-run "Add dark mode support"'
      )
    );
    console.log(
      chalk.gray(
        '  spectree-agent plan --team Engineering "Refactor auth"'
      )
    );
    process.exit(1);
  }

  // Initialize config
  initConfig();

  const spinner = ora("Checking authentication...").start();

  try {
    // Step 1: Verify authentication
    const token = getApiToken();
    if (!token) {
      throw AuthError.missingToken();
    }

    spinner.text = "Initializing...";

    // Step 2: Initialize clients
    const apiUrl = getApiUrl();
    const client = new SpecTreeClient({ apiUrl, token });
    const acpClient = new AcpClient();
    const sessionManager = new AcpSessionManager(acpClient);

    spinner.succeed("Initialized");

    // Display the description
    const descPreview =
      description.length > 200
        ? description.substring(0, 200) + "..."
        : description;
    console.log(chalk.white(`\nDescription: "${descPreview}"\n`));

    // Step 3: Resolve team
    const team = await resolveTeam(client, options.team);

    // Step 4: Generate plan via ACP planner agent
    const planSpinner = ora(
      "Generating execution plan with AI..."
    ).start();

    const planGenerator = new PlanGenerator(client, sessionManager);
    const planOptions: {
      team: string;
      teamId: string;
      dryRun: boolean;
    } = {
      team: team.name,
      teamId: team.id,
      dryRun: options.dryRun ?? false,
    };

    const plan = await planGenerator.generatePlan(description, planOptions);
    planSpinner.succeed(
      `Plan generated: ${plan.totalFeatures} features, ${plan.totalTasks} tasks`
    );

    // Step 5: Display results
    if (options.dryRun) {
      displayDryRunPlan(plan);
    } else {
      displayPlanSummary(plan);
    }
  } catch (error) {
    displayError(error, spinner.isSpinning ? spinner : undefined);
    process.exit(1);
  }
}
