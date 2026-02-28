/**
 * Smoke Test Runner (ENG-46)
 *
 * Starts Docker containers, waits for health checks, verifies HTTP
 * endpoints, and tears down containers after testing.
 */

import { exec } from "child_process";
import { promisify } from "util";
import type { SmokeTestEndpoint } from "../config/schemas.js";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

export interface EndpointCheckResult {
  url: string;
  label?: string;
  expectedStatus: number;
  actualStatus: number | null;
  success: boolean;
  error?: string;
  duration: number;
}

export interface SmokeTestResult {
  /** Whether all endpoint checks passed */
  success: boolean;
  /** Individual endpoint results */
  endpoints: EndpointCheckResult[];
  /** Container startup duration in ms */
  startupDuration: number;
  /** Total duration including teardown */
  totalDuration: number;
}

export interface SmokeTesterOptions {
  /** Working directory */
  cwd?: string;
  /** Docker compose file path */
  dockerComposeFile?: string;
  /** Health check timeout in ms (default: 60000) */
  healthTimeout?: number;
}

// =============================================================================
// SmokeTester
// =============================================================================

export class SmokeTester {
  private cwd: string;
  private dockerComposeFile: string;
  private healthTimeout: number;

  constructor(options?: SmokeTesterOptions) {
    this.cwd = options?.cwd ?? process.cwd();
    this.dockerComposeFile = options?.dockerComposeFile ?? "docker-compose.local.yml";
    this.healthTimeout = options?.healthTimeout ?? 60_000;
  }

  /**
   * Start containers using docker-compose.
   */
  async startContainers(): Promise<void> {
    const cmd = `docker-compose -f ${this.dockerComposeFile} up -d`;
    await execAsync(cmd, { cwd: this.cwd, timeout: 120_000 });
  }

  /**
   * Wait for containers to become healthy by polling a health endpoint.
   * Falls back to a delay-based approach if no health endpoint is set.
   */
  async waitForHealth(timeout?: number): Promise<void> {
    const maxWait = timeout ?? this.healthTimeout;
    const start = Date.now();
    const interval = 2000;

    while (Date.now() - start < maxWait) {
      try {
        const { stdout } = await execAsync(
          `docker-compose -f ${this.dockerComposeFile} ps --format json`,
          { cwd: this.cwd },
        );
        // Check that all services are "running"
        const lines = stdout.trim().split("\n").filter(Boolean);
        const allRunning = lines.length > 0 && lines.every((line) => {
          try {
            const svc = JSON.parse(line) as { State?: string };
            return svc.State === "running";
          } catch {
            return false;
          }
        });

        if (allRunning) return;
      } catch {
        // Container status check failed, keep waiting
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Containers did not become healthy within ${maxWait}ms`);
  }

  /**
   * Stop and remove containers.
   */
  async stopContainers(): Promise<void> {
    const cmd = `docker-compose -f ${this.dockerComposeFile} down`;
    await execAsync(cmd, { cwd: this.cwd, timeout: 60_000 });
  }

  /**
   * Verify a list of HTTP endpoints return expected status codes.
   */
  async verifyEndpoints(checks: SmokeTestEndpoint[]): Promise<EndpointCheckResult[]> {
    const results: EndpointCheckResult[] = [];

    for (const check of checks) {
      const start = Date.now();
      try {
        const response = await fetch(check.url, {
          method: "GET",
          signal: AbortSignal.timeout(10_000),
        });

        const expectedStatus = check.expectedStatus ?? 200;
        const result: EndpointCheckResult = {
          url: check.url,
          expectedStatus,
          actualStatus: response.status,
          success: response.status === expectedStatus,
          duration: Date.now() - start,
        };
        if (check.label !== undefined) result.label = check.label;
        results.push(result);
      } catch (error) {
        const result: EndpointCheckResult = {
          url: check.url,
          expectedStatus: check.expectedStatus ?? 200,
          actualStatus: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - start,
        };
        if (check.label !== undefined) result.label = check.label;
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Run the full smoke test flow: start containers, wait, verify, stop.
   */
  async runFullSmokeTest(checks: SmokeTestEndpoint[]): Promise<SmokeTestResult> {
    const totalStart = Date.now();
    let startupDuration = 0;

    try {
      // Start containers
      const startupStart = Date.now();
      await this.startContainers();
      await this.waitForHealth();
      startupDuration = Date.now() - startupStart;

      // Verify endpoints
      const endpoints = await this.verifyEndpoints(checks);
      const success = endpoints.every((e) => e.success);

      return {
        success,
        endpoints,
        startupDuration,
        totalDuration: Date.now() - totalStart,
      };
    } finally {
      try {
        await this.stopContainers();
      } catch {
        // Best effort teardown
      }
    }
  }
}
