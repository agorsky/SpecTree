/**
 * Continue command - Resume work on an existing epic
 *
 * This command allows resuming work on an existing epic. It:
 * 1. Verifies authentication
 * 2. Finds the epic by name or ID
 * 3. Loads the previous session handoff context (if any)
 * 4. Displays progress summary
 * 5. Resumes execution from the appropriate point
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import { getApiToken, getApiUrl } from "./auth.js";
import {
  SpecTreeClient,
  createAgentTools,
  type Epic,
  type Feature,
  type Session,
  type ExecutionPlan,
} from "../../spectree/index.js";
import {
  Orchestrator,
  type RunResult,
  type ProgressEvent,
} from "../../orchestrator/index.js";
import {
  AuthError,
  OrchestratorError,
  isAuthError,
  isNetworkError,
  isOrchestratorError,
} from "../../errors.js";

// =============================================================================
// Types
// =============================================================================

interface ContinueOptions {
  from?: string;
  includeCompleted?: boolean;
}

interface ProgressSummary {
  epic: { id: string; name: string; description: string | null };
  totalFeatures: number;
  completedFeatures: number;
  inProgressFeatures: number;
  blockedFeatures: number;
  totalTasks: number;
  completedTasks: number;
  overallProgress: number;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display the previous session handoff context
 */
function displayHandoffContext(session: Session): void {
  // Calculate time since session ended
  const endedAt = session.endedAt ? new Date(session.endedAt) : new Date(session.updatedAt);
  const hoursAgo = Math.round((Date.now() - endedAt.getTime()) / (1000 * 60 * 60));
  const timeAgo = hoursAgo < 1 ? "less than an hour ago" : `${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago`;

  console.log(chalk.cyan(`\n📋 Last Session Summary (${timeAgo}):`));

  // Show items worked on
  if (session.itemsWorkedOn && session.itemsWorkedOn.length > 0) {
    const completed = session.itemsWorkedOn.filter((item) => item.action === "completed");
    if (completed.length > 0) {
      console.log(chalk.gray(`  Completed: ${completed.map((i) => i.identifier).join(", ")}`));
    }
  }

  // Show summary
  if (session.summary) {
    console.log(chalk.white(`\n  Summary:`));
    console.log(chalk.gray(`    ${session.summary}`));
  }

  // Show next steps
  if (session.nextSteps && session.nextSteps.length > 0) {
    console.log(chalk.white(`\n  Next Steps:`));
    for (const step of session.nextSteps) {
      console.log(chalk.gray(`    • ${step}`));
    }
  }

  // Show blockers
  if (session.blockers && session.blockers.length > 0) {
    console.log(chalk.yellow(`\n  Blockers:`));
    for (const blocker of session.blockers) {
      console.log(chalk.yellow(`    ⚠ ${blocker}`));
    }
  }

  // Show decisions
  if (session.decisions && session.decisions.length > 0) {
    console.log(chalk.white(`\n  Decisions Made:`));
    for (const decision of session.decisions) {
      console.log(chalk.gray(`    • ${decision.decision}`));
      if (decision.rationale) {
        console.log(chalk.gray(`      Rationale: ${decision.rationale}`));
      }
    }
  }

  console.log();
}

/**
 * Display progress summary for the epic
 */
function displayProgress(
  progress: ProgressSummary,
  features: Feature[]
): void {
  const percent = Math.round(progress.overallProgress);
  console.log(chalk.cyan(`\nEpic: ${progress.epic.name} (${percent}% complete)\n`));

  // Separate features by status
  const completedFeatures = features.filter((f) => f.status?.category === "completed");
  const inProgressFeatures = features.filter((f) => f.status?.category === "started");
  const remainingFeatures = features.filter(
    (f) => !f.status || (f.status.category !== "completed" && f.status.category !== "started")
  );

  // Show completed
  if (completedFeatures.length > 0) {
    console.log(chalk.green(`Completed (${completedFeatures.length}/${features.length}):`));
    for (const feature of completedFeatures) {
      console.log(chalk.gray(`  ✓ ${feature.identifier} "${feature.title}"`));
    }
    console.log();
  }

  // Show in progress
  if (inProgressFeatures.length > 0) {
    console.log(chalk.yellow(`In Progress (${inProgressFeatures.length}):`));
    for (const feature of inProgressFeatures) {
      console.log(chalk.yellow(`  ◐ ${feature.identifier} "${feature.title}"`));
    }
    console.log();
  }

  // Show remaining
  if (remainingFeatures.length > 0) {
    console.log(chalk.white(`Remaining (${remainingFeatures.length}/${features.length}):`));
    for (const feature of remainingFeatures) {
      console.log(chalk.gray(`  ○ ${feature.identifier} "${feature.title}"`));
    }
    console.log();
  }
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
    spinner.fail("Operation failed");
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
 * Setup progress event handlers on the orchestrator
 */
function setupProgressHandlers(orchestrator: Orchestrator): void {
  let currentSpinner: Ora | null = null;

  orchestrator.on("item:start", (event: ProgressEvent) => {
    if (currentSpinner) {
      currentSpinner.stop();
    }
    if (event.item) {
      currentSpinner = ora({
        text: `Working on: ${event.item.identifier} - ${event.item.title}`,
        color: "cyan",
      }).start();
    }
  });

  orchestrator.on("item:progress", (event: ProgressEvent) => {
    if (currentSpinner && event.message && event.item) {
      const percent = event.percentComplete !== undefined
        ? ` (${event.percentComplete}%)`
        : "";
      currentSpinner.text = `${event.item.identifier}: ${event.message}${percent}`;
    }
  });

  orchestrator.on("item:complete", (event: ProgressEvent) => {
    if (currentSpinner && event.item) {
      currentSpinner.succeed(`Completed: ${event.item.identifier} - ${event.item.title}`);
      currentSpinner = null;
    }
  });

  orchestrator.on("item:error", (event: ProgressEvent) => {
    if (currentSpinner && event.item) {
      currentSpinner.fail(`Failed: ${event.item.identifier} - ${event.item.title}`);
      currentSpinner = null;
    }
    if (event.error) {
      console.log(chalk.red(`   Error: ${event.error.message}`));
    }
  });
}

// =============================================================================
// Epic Lookup
// =============================================================================

/**
 * Find an epic by name or ID
 */
async function findEpic(
  client: SpecTreeClient,
  epicQuery: string
): Promise<Epic | null> {
  // First, try to get by ID directly (if it looks like a UUID)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(epicQuery)) {
    try {
      return await client.getEpic(epicQuery);
    } catch {
      // Not found by ID, fall through to name search
    }
  }

  // Search by name (case-insensitive partial match)
  const result = await client.listEpics({ includeArchived: false, limit: 100 });
  const query = epicQuery.toLowerCase();

  // Exact match first
  let match = result.data.find((epic) => epic.name.toLowerCase() === query);
  if (match) return match;

  // Partial match (name contains query)
  const matches = result.data.filter((epic) =>
    epic.name.toLowerCase().includes(query)
  );

  if (matches.length === 1) {
    return matches[0] ?? null;
  }

  if (matches.length > 1) {
    // Multiple matches - show them to the user
    console.log(chalk.yellow(`\nMultiple epics match "${epicQuery}":`));
    for (const epic of matches) {
      console.log(chalk.gray(`  - ${epic.name} (${epic.id})`));
    }
    console.log(chalk.yellow("\nPlease be more specific or use the full ID.\n"));
    return null;
  }

  return null;
}

/**
 * Find the starting feature index based on options
 */
function findStartIndex(
  plan: ExecutionPlan,
  features: Feature[],
  fromFeature?: string,
  includeCompleted?: boolean
): string | undefined {
  // If --from is specified, find that feature
  if (fromFeature) {
    const allItems = plan.phases.flatMap((phase) => phase.items);
    const item = allItems.find(
      (i) =>
        i.identifier.toLowerCase() === fromFeature.toLowerCase() ||
        i.id === fromFeature
    );
    if (item) {
      return item.identifier;
    }
    console.log(chalk.yellow(`⚠ Feature "${fromFeature}" not found in execution plan`));
  }

  // By default, skip completed items (unless --include-completed is specified)
  if (!includeCompleted) {
    const completedIds = new Set(
      features
        .filter((f) => f.status?.category === "completed")
        .map((f) => f.id)
    );

    for (const phase of plan.phases) {
      for (const item of phase.items) {
        if (!completedIds.has(item.id)) {
          console.log(chalk.gray(`\nResuming from first incomplete item: ${item.identifier}`));
          return item.identifier;
        }
      }
    }
  }

  // Default: start from beginning (orchestrator handles skip logic)
  return undefined;
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Main continue command implementation
 */
export async function continueCommand(
  epicQuery: string,
  options: ContinueOptions
): Promise<void> {
  console.log(chalk.cyan("\n🔄 Continue Epic\n"));

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

    spinner.text = `Finding epic "${epicQuery}"...`;

    // Step 3: Find the epic
    const epic = await findEpic(client, epicQuery);
    if (!epic) {
      throw new OrchestratorError(
        `Epic not found: "${epicQuery}"`,
        "SPECTREE_NOT_FOUND",
        {
          recoveryHint: "Run 'spectree-agent status' to see available epics, or check the epic name/ID",
        }
      );
    }

    spinner.succeed(`Found epic: ${epic.name}`);

    // Step 4: Start session and get handoff context
    spinner.start("Loading session...");
    const sessionResponse = await client.startSession({ epicId: epic.id });

    // Display previous session handoff if available
    if (sessionResponse.previousSession) {
      spinner.stop();
      displayHandoffContext(sessionResponse.previousSession);
    } else {
      spinner.info("No previous session found - starting fresh");
    }

    // Step 5: Get progress summary and features
    spinner.start("Loading progress...");
    const progress = await client.getProgressSummary(epic.id);
    const featuresResult = await client.listFeatures({ epicId: epic.id, limit: 100 });
    spinner.stop();

    displayProgress(progress, featuresResult.data);

    // Check if already complete
    if (progress.overallProgress >= 100) {
      console.log(chalk.green("✓ This epic is already complete!\n"));
      return;
    }

    // Step 6: Get execution plan and determine start point
    spinner.start("Loading execution plan...");
    const plan = await client.getExecutionPlan(epic.id);
    spinner.stop();

    const fromFeature = findStartIndex(
      plan,
      featuresResult.data,
      options.from,
      options.includeCompleted
    );

    if (fromFeature) {
      console.log(chalk.cyan(`\nContinuing from ${fromFeature}...`));
    } else {
      console.log(chalk.cyan("\nContinuing execution..."));
    }

    // Step 7: Create orchestrator and execute
    const tools = createAgentTools(client);
    const orchestrator = new Orchestrator({
      client,
      tools,
    });

    setupProgressHandlers(orchestrator);

    const result = await orchestrator.run(epic.id, {
      sessionId: sessionResponse.session.id,
      ...(fromFeature ? { fromFeature } : {}),
    });

    // Step 8: Display results
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
