/**
 * Validation Pipeline (ENG-48-4)
 *
 * Barrel export and coordinating ValidationPipeline class that orchestrates
 * all validators: build verification, test runner, smoke tests, retry
 * controller, checkpoint management, and report generation.
 */

import { GitCheckpointManager } from "../git/checkpoint-manager.js";
import { ClaudeCodeClient } from "../claude/client.js";
import type { ValidationConfig, SmokeTestEndpoint } from "../config/schemas.js";
import { BuildVerifier, type BuildResult } from "./build-verifier.js";
import { TestRunner, type TestResult } from "./test-runner.js";
import { SmokeTester, type SmokeTestResult } from "./smoke-tester.js";
import { RetryController } from "./retry-controller.js";
import { ReportWriter, type ValidationReport, type ReportInput } from "./report-writer.js";

// =============================================================================
// Re-exports
// =============================================================================

export { BuildVerifier } from "./build-verifier.js";
export type { BuildResult, BuildVerifierOptions } from "./build-verifier.js";

export { TestRunner } from "./test-runner.js";
export type { TestResult, TestRunnerOptions } from "./test-runner.js";

export { SmokeTester } from "./smoke-tester.js";
export type {
  SmokeTesterOptions,
  SmokeTestResult,
  EndpointCheckResult,
} from "./smoke-tester.js";

export { RetryController } from "./retry-controller.js";
export type { RetryControllerOptions, RetryState } from "./retry-controller.js";

export { ReportWriter } from "./report-writer.js";
export type { ValidationReport, ReportInput } from "./report-writer.js";

// =============================================================================
// Types
// =============================================================================

export interface ValidationPipelineOptions {
  /** Working directory */
  cwd?: string;
  /** Validation configuration */
  config: ValidationConfig;
  /** Optional Claude client for retries */
  claudeClient?: ClaudeCodeClient;
}

export interface ValidationPipelineResult {
  /** Whether all validations passed */
  success: boolean;
  /** Generated report */
  report: ValidationReport;
  /** Build results */
  buildResults: BuildResult[];
  /** Test results */
  testResults: TestResult[];
  /** Smoke test results (if enabled) */
  smokeTestResult?: SmokeTestResult | undefined;
  /** Whether a retry was attempted */
  retryAttempted: boolean;
  /** Whether the retry succeeded */
  retrySucceeded?: boolean | undefined;
}

// =============================================================================
// ValidationPipeline
// =============================================================================

export class ValidationPipeline {
  private cwd: string;
  private config: ValidationConfig;
  private buildVerifier: BuildVerifier;
  private testRunner: TestRunner;
  private smokeTester: SmokeTester;
  private retryController: RetryController;
  private checkpointManager: GitCheckpointManager;
  private reportWriter: ReportWriter;

  constructor(options: ValidationPipelineOptions) {
    this.cwd = options.cwd ?? process.cwd();
    this.config = options.config;

    this.checkpointManager = new GitCheckpointManager({
      cwd: this.cwd,
      tagPrefix: this.config.checkpoint.tagPrefix,
    });

    this.buildVerifier = new BuildVerifier({
      cwd: this.cwd,
      dockerComposeFile: this.config.dockerComposeFile,
    });

    this.testRunner = new TestRunner({ cwd: this.cwd });

    this.smokeTester = new SmokeTester({
      cwd: this.cwd,
      dockerComposeFile: this.config.dockerComposeFile,
      healthTimeout: this.config.smokeTest.healthTimeout,
    });

    const retryOpts: import("./retry-controller.js").RetryControllerOptions = {
      maxRetries: this.config.maxRetries,
      cwd: this.cwd,
      checkpointManager: this.checkpointManager,
    };
    if (options.claudeClient) {
      retryOpts.claudeClient = options.claudeClient;
    }
    this.retryController = new RetryController(retryOpts);

    this.reportWriter = new ReportWriter();
  }

  /**
   * Run the full validation pipeline for a feature.
   */
  async run(featureId: string): Promise<ValidationPipelineResult> {
    const totalStart = Date.now();

    // Step 1: Create a checkpoint before validation
    let checkpointTag: string | undefined;
    if (this.config.checkpoint.enabled) {
      checkpointTag = await this.checkpointManager.createCheckpoint(featureId);
    }

    // Step 2: Detect modified packages
    const modifiedPackages = await this.buildVerifier.detectModifiedPackages();

    // Step 3: Run build verification
    let buildResults = await this.buildVerifier.runBuilds(modifiedPackages);

    // Also run Docker builds if any packages have Docker services
    const dockerResults = await this.buildVerifier.runDockerBuilds(modifiedPackages);
    buildResults = [...buildResults, ...dockerResults];

    // Step 4: Run tests
    let testResults = await this.testRunner.run(modifiedPackages);

    // Step 5: Run smoke tests if enabled
    let smokeTestResult: SmokeTestResult | undefined;
    if (this.config.smokeTest.enabled && this.config.smokeTest.endpoints.length > 0) {
      smokeTestResult = await this.smokeTester.runFullSmokeTest(
        this.config.smokeTest.endpoints as SmokeTestEndpoint[],
      );
    }

    // Step 6: Check results
    const buildsPassed = buildResults.every((r) => r.success);
    const testsPassed = testResults.every((r) => r.success);
    const smokePassed = smokeTestResult?.success ?? true;
    let overallSuccess = buildsPassed && testsPassed && smokePassed;

    // Step 7: Retry if failed
    let retryAttempted = false;
    let retrySucceeded: boolean | undefined;

    if (!overallSuccess && this.retryController.shouldRetry(featureId)) {
      retryAttempted = true;
      const errorContext = this.buildErrorContext(buildResults, testResults, smokeTestResult);
      const retryOk = await this.retryController.retry(featureId, errorContext);

      if (retryOk) {
        // Re-run validation after retry
        const retryBuildResults = await this.buildVerifier.runBuilds(modifiedPackages);
        const retryDockerResults = await this.buildVerifier.runDockerBuilds(modifiedPackages);
        buildResults = [...retryBuildResults, ...retryDockerResults];

        testResults = await this.testRunner.run(modifiedPackages);

        if (this.config.smokeTest.enabled && this.config.smokeTest.endpoints.length > 0) {
          smokeTestResult = await this.smokeTester.runFullSmokeTest(
            this.config.smokeTest.endpoints as SmokeTestEndpoint[],
          );
        }

        const retryBuildsPassed = buildResults.every((r) => r.success);
        const retryTestsPassed = testResults.every((r) => r.success);
        const retrySmokePassed = smokeTestResult?.success ?? true;
        overallSuccess = retryBuildsPassed && retryTestsPassed && retrySmokePassed;
        retrySucceeded = overallSuccess;
      } else {
        retrySucceeded = false;
      }

      // If retry also failed, rollback and alert
      if (!overallSuccess) {
        const errorSummary = this.buildErrorContext(buildResults, testResults, smokeTestResult);
        await this.retryController.handleRetryFailure(featureId, errorSummary);
      }
    }

    // Step 8: Generate report
    const totalDuration = Date.now() - totalStart;
    const reportInput: ReportInput = {
      featureId,
      buildResults,
      testResults,
      smokeTestResult,
      retryAttempted,
      retrySucceeded,
      checkpointTag,
      totalDuration,
    };

    const report = this.reportWriter.generate(reportInput);

    // Step 9: Cleanup checkpoints on success
    if (overallSuccess && this.config.checkpoint.enabled) {
      await this.checkpointManager.cleanupCheckpoints(featureId);
    }

    return {
      success: overallSuccess,
      report,
      buildResults,
      testResults,
      smokeTestResult,
      retryAttempted,
      retrySucceeded,
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildErrorContext(
    buildResults: BuildResult[],
    testResults: TestResult[],
    smokeTestResult?: SmokeTestResult,
  ): string {
    const parts: string[] = [];

    const failedBuilds = buildResults.filter((r) => !r.success);
    if (failedBuilds.length > 0) {
      parts.push("### Build Failures");
      for (const r of failedBuilds) {
        parts.push(`**${r.pkg}:** ${r.output.slice(0, 300)}`);
      }
    }

    const failedTests = testResults.filter((r) => !r.success);
    if (failedTests.length > 0) {
      parts.push("### Test Failures");
      for (const r of failedTests) {
        parts.push(`**${r.pkg}:** ${r.errors.join("; ").slice(0, 300)}`);
      }
    }

    if (smokeTestResult && !smokeTestResult.success) {
      parts.push("### Smoke Test Failures");
      const failedEndpoints = smokeTestResult.endpoints.filter((e) => !e.success);
      for (const e of failedEndpoints) {
        parts.push(`**${e.url}:** expected ${e.expectedStatus}, got ${e.actualStatus ?? "N/A"}`);
      }
    }

    return parts.join("\n\n");
  }
}
