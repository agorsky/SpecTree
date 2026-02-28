/**
 * Verification Report Writer (ENG-48)
 *
 * Generates a markdown verification report from all validation pipeline
 * results (build, test, smoke test, retry).
 */

import type { BuildResult } from "./build-verifier.js";
import type { TestResult } from "./test-runner.js";
import type { SmokeTestResult } from "./smoke-tester.js";

// =============================================================================
// Types
// =============================================================================

export interface ValidationReport {
  /** Feature identifier */
  featureId: string;
  /** Timestamp of report generation */
  timestamp: string;
  /** Overall pass/fail */
  success: boolean;
  /** Markdown-formatted report */
  markdown: string;
  /** Summary line */
  summary: string;
}

export interface ReportInput {
  featureId: string;
  buildResults: BuildResult[];
  testResults: TestResult[];
  smokeTestResult?: SmokeTestResult | undefined;
  retryAttempted: boolean;
  retrySucceeded?: boolean | undefined;
  checkpointTag?: string | undefined;
  totalDuration: number;
}

// =============================================================================
// ReportWriter
// =============================================================================

export class ReportWriter {
  /**
   * Generate a markdown verification report from validation results.
   */
  generate(input: ReportInput): ValidationReport {
    const buildsPassed = input.buildResults.every((r) => r.success);
    const testsPassed = input.testResults.every((r) => r.success);
    const smokePassed = input.smokeTestResult?.success ?? true;
    const overallSuccess = buildsPassed && testsPassed && smokePassed;

    const sections: string[] = [];

    // Header
    sections.push(`# Validation Report: ${input.featureId}`);
    sections.push("");
    sections.push(`**Date:** ${new Date().toISOString()}`);
    sections.push(`**Status:** ${overallSuccess ? "PASSED" : "FAILED"}`);
    sections.push(`**Duration:** ${(input.totalDuration / 1000).toFixed(1)}s`);
    if (input.checkpointTag) {
      sections.push(`**Checkpoint:** ${input.checkpointTag}`);
    }
    sections.push("");

    // Build results
    sections.push("## Build Verification");
    sections.push("");
    if (input.buildResults.length === 0) {
      sections.push("No packages needed building.");
    } else {
      sections.push("| Package | Status | Duration |");
      sections.push("|---------|--------|----------|");
      for (const r of input.buildResults) {
        const status = r.success ? "PASS" : "FAIL";
        sections.push(`| ${r.pkg} | ${status} | ${(r.duration / 1000).toFixed(1)}s |`);
      }
    }
    sections.push("");

    // Test results
    sections.push("## Test Results");
    sections.push("");
    if (input.testResults.length === 0) {
      sections.push("No test suites executed.");
    } else {
      sections.push("| Package | Total | Passed | Failed | Skipped | Status |");
      sections.push("|---------|-------|--------|--------|---------|--------|");
      for (const r of input.testResults) {
        const status = r.success ? "PASS" : "FAIL";
        sections.push(
          `| ${r.pkg} | ${r.total} | ${r.passed} | ${r.failed} | ${r.skipped} | ${status} |`,
        );
      }

      // Show test errors
      const failedTests = input.testResults.filter((r) => r.errors.length > 0);
      if (failedTests.length > 0) {
        sections.push("");
        sections.push("### Test Errors");
        sections.push("");
        for (const r of failedTests) {
          sections.push(`**${r.pkg}:**`);
          for (const err of r.errors.slice(0, 5)) {
            sections.push(`- ${err}`);
          }
        }
      }
    }
    sections.push("");

    // Smoke test results
    if (input.smokeTestResult) {
      sections.push("## Smoke Tests");
      sections.push("");
      sections.push("| Endpoint | Expected | Actual | Status |");
      sections.push("|----------|----------|--------|--------|");
      for (const e of input.smokeTestResult.endpoints) {
        const label = e.label ?? e.url;
        const actual = e.actualStatus !== null ? String(e.actualStatus) : "N/A";
        const status = e.success ? "PASS" : "FAIL";
        sections.push(`| ${label} | ${e.expectedStatus} | ${actual} | ${status} |`);
      }
      sections.push("");
      sections.push(
        `Container startup: ${(input.smokeTestResult.startupDuration / 1000).toFixed(1)}s`,
      );
      sections.push("");
    }

    // Retry info
    if (input.retryAttempted) {
      sections.push("## Retry");
      sections.push("");
      sections.push(
        `Retry was attempted: ${input.retrySucceeded ? "**succeeded**" : "**failed**"}`,
      );
      sections.push("");
    }

    const markdown = sections.join("\n");
    const summary = this.buildSummary(input, overallSuccess);

    return {
      featureId: input.featureId,
      timestamp: new Date().toISOString(),
      success: overallSuccess,
      markdown,
      summary,
    };
  }

  private buildSummary(input: ReportInput, success: boolean): string {
    const buildCount = input.buildResults.length;
    const buildPassed = input.buildResults.filter((r) => r.success).length;
    const testCount = input.testResults.length;
    const testPassed = input.testResults.filter((r) => r.success).length;

    const parts = [
      `Validation ${success ? "PASSED" : "FAILED"}`,
      `Builds: ${buildPassed}/${buildCount}`,
      `Tests: ${testPassed}/${testCount}`,
    ];

    if (input.smokeTestResult) {
      const endpointsPassed = input.smokeTestResult.endpoints.filter((e) => e.success).length;
      parts.push(`Smoke: ${endpointsPassed}/${input.smokeTestResult.endpoints.length}`);
    }

    return parts.join(" | ");
  }
}
