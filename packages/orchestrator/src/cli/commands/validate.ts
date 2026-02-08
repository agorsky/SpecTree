/**
 * Validate command - Run all validations for an epic's tasks
 *
 * Fetches all features and tasks for an epic, runs their validation
 * checks, and reports a summary of results.
 *
 * @example
 * ```bash
 * # Run all validations for an epic by ID
 * spectree-agent validate 88cec40c-0ab4-4a6e-afba-ac01f9113b30
 *
 * # Run validations for an epic by name
 * spectree-agent validate "SpecTree Automation Tool"
 * ```
 */

import chalk from "chalk";
import ora from "ora";
import { getApiToken, getApiUrl } from "./auth.js";
import { initConfig } from "../../config/index.js";
import {
  SpecTreeClient,
  type Feature,
  type RunAllValidationsResult,
} from "../../spectree/api-client.js";
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

export interface ValidateOptions {
  // Reserved for future options (e.g., --stop-on-failure, --verbose)
}

interface TaskValidationSummary {
  taskIdentifier: string;
  taskTitle: string;
  totalChecks: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  errors: string[];
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display validation results summary table
 */
function displayValidationResults(
  epicName: string,
  results: TaskValidationSummary[],
  overallPassed: boolean
): void {
  console.log(chalk.cyan("\n" + "=".repeat(60)));
  console.log(chalk.cyan("  VALIDATION RESULTS"));
  console.log(chalk.cyan("=".repeat(60) + "\n"));

  console.log(chalk.white.bold(`Epic: ${epicName}`));
  console.log();

  if (results.length === 0) {
    console.log(chalk.yellow("  No tasks with validation checks found."));
    console.log();
    return;
  }

  // Table header
  console.log(
    chalk.gray(
      "  " +
        "Task".padEnd(20) +
        "Checks".padEnd(10) +
        "Passed".padEnd(10) +
        "Failed".padEnd(10) +
        "Status"
    )
  );
  console.log(chalk.gray("  " + "-".repeat(58)));

  for (const result of results) {
    const statusIcon = result.allPassed
      ? chalk.green(" PASS")
      : chalk.red(" FAIL");

    const passedStr = result.passed > 0
      ? chalk.green(String(result.passed).padEnd(10))
      : String(result.passed).padEnd(10);

    const failedStr = result.failed > 0
      ? chalk.red(String(result.failed).padEnd(10))
      : String(result.failed).padEnd(10);

    console.log(
      "  " +
        chalk.white(result.taskIdentifier.padEnd(20)) +
        String(result.totalChecks).padEnd(10) +
        passedStr +
        failedStr +
        statusIcon
    );

    // Show errors for failed checks
    for (const error of result.errors) {
      console.log(chalk.red(`    -> ${error}`));
    }
  }

  console.log();
  console.log(chalk.gray("  " + "-".repeat(58)));

  const totalChecks = results.reduce((s, r) => s + r.totalChecks, 0);
  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);

  if (overallPassed) {
    console.log(
      chalk.green(
        `\n  All ${totalChecks} validation checks passed across ${results.length} tasks.`
      )
    );
  } else {
    console.log(
      chalk.red(
        `\n  ${totalFailed} of ${totalChecks} validation checks failed across ${results.length} tasks.`
      )
    );
    console.log(chalk.green(`  ${totalPassed} checks passed.`));
  }

  console.log();
}

/**
 * Display error with recovery hints
 */
function displayError(error: unknown): void {
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
// Main Command
// =============================================================================

/**
 * Validate command implementation.
 * Runs all validation checks for tasks in an epic and reports results.
 */
export async function validateCommand(
  epicIdOrName: string | undefined,
  _options: ValidateOptions
): Promise<void> {
  console.log(chalk.cyan("\n  SpecTree Validation Runner\n"));

  if (!epicIdOrName) {
    console.log(chalk.red("  An epic ID or name is required"));
    console.log(chalk.gray("\nUsage:"));
    console.log(
      chalk.gray(
        "  spectree-agent validate <epic-id>"
      )
    );
    console.log(
      chalk.gray(
        '  spectree-agent validate "Epic Name"'
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

    spinner.text = "Initializing API client...";

    // Step 2: Initialize client
    const apiUrl = getApiUrl();
    const client = new SpecTreeClient({ apiUrl, token });

    spinner.text = "Resolving epic...";

    // Step 3: Resolve epic ID
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        epicIdOrName
      );

    let epicId: string;
    let epicName: string;

    if (isUuid) {
      const epic = await client.getEpic(epicIdOrName);
      epicId = epic.id;
      epicName = epic.name;
    } else {
      const epicsResult = await client.listEpics({ limit: 100 });
      const epic = epicsResult.data.find(
        (e) => e.name.toLowerCase() === epicIdOrName.toLowerCase()
      );

      if (!epic) {
        spinner.fail(`Epic "${epicIdOrName}" not found`);
        process.exit(1);
      }

      epicId = epic.id;
      epicName = epic.name;
    }

    spinner.text = `Loading features for "${epicName}"...`;

    // Step 4: Get all features and their tasks
    const featuresResult = await client.listFeatures({
      epicId,
      limit: 100,
    });
    const features: Feature[] = featuresResult.data;

    if (features.length === 0) {
      spinner.fail("No features found for this epic");
      process.exit(1);
    }

    spinner.text = "Loading tasks...";

    // Collect all tasks across all features
    interface TaskInfo {
      id: string;
      identifier: string;
      title: string;
    }
    const allTasks: TaskInfo[] = [];
    for (const feature of features) {
      const tasksResult = await client.listTasks({
        featureId: feature.id,
        limit: 100,
      });
      for (const task of tasksResult.data) {
        allTasks.push({
          id: task.id,
          identifier: task.identifier,
          title: task.title,
        });
      }
    }

    if (allTasks.length === 0) {
      spinner.succeed("Epic loaded");
      console.log(
        chalk.yellow("\n  No tasks found in this epic.")
      );
      console.log();
      return;
    }

    spinner.text = `Running validations for ${allTasks.length} tasks...`;

    // Step 5: Run validations for each task
    const results: TaskValidationSummary[] = [];
    let overallPassed = true;

    for (const task of allTasks) {
      spinner.text = `Validating ${task.identifier}...`;

      try {
        const validationResult: RunAllValidationsResult =
          await client.runAllValidations(task.id);

        // Skip tasks with no validation checks
        if (validationResult.totalChecks === 0) {
          continue;
        }

        const errors: string[] = validationResult.results
          .filter((r) => !r.passed)
          .map(
            (r) =>
              `${r.check.description}: ${r.error || "check failed"}`
          );

        const summary: TaskValidationSummary = {
          taskIdentifier: validationResult.identifier,
          taskTitle: task.title,
          totalChecks: validationResult.totalChecks,
          passed: validationResult.passedChecks,
          failed: validationResult.failedChecks,
          allPassed: validationResult.allPassed,
          errors,
        };

        results.push(summary);

        if (!validationResult.allPassed) {
          overallPassed = false;
        }
      } catch (err) {
        // If validation run fails entirely, record it as a failed task
        results.push({
          taskIdentifier: task.identifier,
          taskTitle: task.title,
          totalChecks: 0,
          passed: 0,
          failed: 1,
          allPassed: false,
          errors: [
            `Validation run failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
        });
        overallPassed = false;
      }
    }

    if (results.length === 0) {
      spinner.succeed("Validations complete");
      console.log(
        chalk.yellow(
          "\n  No tasks with validation checks found in this epic."
        )
      );
      console.log();
      return;
    }

    spinner.succeed("Validations complete");

    // Step 6: Display results
    displayValidationResults(epicName, results, overallPassed);

    // Exit with appropriate code
    if (!overallPassed) {
      process.exit(1);
    }
  } catch (error) {
    if (spinner.isSpinning) {
      spinner.fail("Validation failed");
    }
    displayError(error);
    process.exit(1);
  }
}
