/**
 * Test Runner Integration (ENG-45)
 *
 * Executes pnpm test for modified packages and parses the output
 * into structured TestResult objects.
 */

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

export interface TestResult {
  /** Package directory */
  pkg: string;
  /** Total test count */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Error messages from failed tests */
  errors: string[];
  /** Whether all tests passed */
  success: boolean;
  /** Duration in milliseconds */
  duration: number;
  /** Raw output */
  rawOutput: string;
}

export interface TestRunnerOptions {
  /** Working directory */
  cwd?: string;
}

// =============================================================================
// TestRunner
// =============================================================================

export class TestRunner {
  private cwd: string;

  constructor(options?: TestRunnerOptions) {
    this.cwd = options?.cwd ?? process.cwd();
  }

  /**
   * Run tests for the specified packages.
   */
  async run(packages: string[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const pkg of packages) {
      const pkgName = this.packageDirToName(pkg);
      const command = `pnpm test --filter ${pkgName}`;
      const start = Date.now();

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: this.cwd,
          timeout: 300_000, // 5-minute timeout per package
        });
        const output = stdout + stderr;
        const parsed = this.parseTestOutput(output);

        results.push({
          pkg,
          ...parsed,
          success: parsed.failed === 0,
          duration: Date.now() - start,
          rawOutput: output,
        });
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        const output = (err.stdout ?? "") + (err.stderr ?? "");
        const parsed = this.parseTestOutput(output);

        results.push({
          pkg,
          total: parsed.total || 0,
          passed: parsed.passed,
          failed: parsed.failed || 1,
          skipped: parsed.skipped,
          errors: parsed.errors.length > 0 ? parsed.errors : [err.message ?? "Test execution failed"],
          success: false,
          duration: Date.now() - start,
          rawOutput: output || err.message || "Test execution failed",
        });
      }
    }

    return results;
  }

  /**
   * Parse vitest/jest output into structured counts.
   */
  private parseTestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: string[];
  } {
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Vitest summary pattern: "Tests  3 passed | 1 failed | 4 total"
    const vitestMatch = output.match(
      /Tests\s+(?:(\d+)\s+passed)?(?:\s*\|\s*)?(?:(\d+)\s+failed)?(?:\s*\|\s*)?(?:(\d+)\s+skipped)?(?:\s*\|\s*)?(\d+)\s+total/i,
    );
    if (vitestMatch) {
      passed = parseInt(vitestMatch[1] ?? "0", 10);
      failed = parseInt(vitestMatch[2] ?? "0", 10);
      skipped = parseInt(vitestMatch[3] ?? "0", 10);
      total = parseInt(vitestMatch[4] ?? "0", 10);
    }

    // Jest pattern: "Tests: 2 failed, 3 passed, 5 total"
    if (total === 0) {
      const jestMatch = output.match(
        /Tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(?:(\d+)\s+passed,\s*)?(\d+)\s+total/i,
      );
      if (jestMatch) {
        failed = parseInt(jestMatch[1] ?? "0", 10);
        skipped = parseInt(jestMatch[2] ?? "0", 10);
        passed = parseInt(jestMatch[3] ?? "0", 10);
        total = parseInt(jestMatch[4] ?? "0", 10);
      }
    }

    // Extract FAIL lines as errors
    const failLines = output.match(/FAIL\s+.+/g);
    if (failLines) {
      errors.push(...failLines.map((l) => l.trim()));
    }

    // Extract AssertionError or Error lines
    const errorLines = output.match(/(?:AssertionError|Error|FAILED):.+/g);
    if (errorLines) {
      errors.push(...errorLines.map((l) => l.trim()));
    }

    return { total, passed, failed, skipped, errors };
  }

  /**
   * Convert a package directory path to a pnpm filter name.
   * e.g., "packages/api" -> "@dispatcher/api" (or just the dir basename)
   */
  private packageDirToName(pkgDir: string): string {
    // Extract the last segment for pnpm --filter
    const parts = pkgDir.split("/");
    const basename = parts[parts.length - 1] ?? pkgDir;
    return `@dispatcher/${basename}`;
  }
}
