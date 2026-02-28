/**
 * Build Verification Engine (ENG-44)
 *
 * Detects modified packages via git diff, runs the appropriate build
 * command for each, and optionally verifies Docker builds.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { simpleGit, type SimpleGit } from "simple-git";

const execAsync = promisify(exec);

// =============================================================================
// Types
// =============================================================================

/** Known package directories mapped to their build commands */
const PACKAGE_BUILD_COMMANDS: Record<string, string> = {
  "packages/api": "tsc -p tsconfig.docker.json",
  "packages/web": "npx vite build",
  "packages/orchestrator": "pnpm build",
  "packages/mcp": "pnpm build",
};

/** Map package dirs to docker-compose service names */
const PACKAGE_DOCKER_SERVICES: Record<string, string> = {
  "packages/api": "api",
  "packages/web": "web",
};

export interface BuildResult {
  /** Package directory */
  pkg: string;
  /** Whether the build succeeded */
  success: boolean;
  /** Build command output */
  output: string;
  /** Duration in milliseconds */
  duration: number;
}

export interface BuildVerifierOptions {
  /** Working directory */
  cwd?: string;
  /** Docker compose file path */
  dockerComposeFile?: string;
  /** Base ref for git diff (default: HEAD~1) */
  baseRef?: string;
}

// =============================================================================
// BuildVerifier
// =============================================================================

export class BuildVerifier {
  private git: SimpleGit;
  private cwd: string;
  private dockerComposeFile: string;
  private baseRef: string;

  constructor(options?: BuildVerifierOptions) {
    this.cwd = options?.cwd ?? process.cwd();
    this.dockerComposeFile = options?.dockerComposeFile ?? "docker-compose.local.yml";
    this.baseRef = options?.baseRef ?? "HEAD~1";
    this.git = simpleGit({ baseDir: this.cwd });
  }

  /**
   * Detect which packages have been modified since the base ref.
   */
  async detectModifiedPackages(): Promise<string[]> {
    const diff = await this.git.diff(["--name-only", this.baseRef]);
    const files = diff.split("\n").filter(Boolean);

    const packageDirs = new Set<string>();
    for (const file of files) {
      for (const pkgDir of Object.keys(PACKAGE_BUILD_COMMANDS)) {
        if (file.startsWith(pkgDir + "/")) {
          packageDirs.add(pkgDir);
        }
      }
    }

    return [...packageDirs];
  }

  /**
   * Run build commands for the specified packages.
   */
  async runBuilds(packages: string[]): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    for (const pkg of packages) {
      const command = PACKAGE_BUILD_COMMANDS[pkg];
      if (!command) continue;

      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(command, { cwd: `${this.cwd}/${pkg}` });
        results.push({
          pkg,
          success: true,
          output: (stdout + stderr).trim(),
          duration: Date.now() - start,
        });
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        results.push({
          pkg,
          success: false,
          output: (((err.stdout ?? "") + (err.stderr ?? "")) || (err.message ?? "Build failed")).trim(),
          duration: Date.now() - start,
        });
      }
    }

    return results;
  }

  /**
   * Run Docker build verification for modified packages that have services.
   */
  async runDockerBuilds(packages: string[]): Promise<BuildResult[]> {
    const results: BuildResult[] = [];

    for (const pkg of packages) {
      const service = PACKAGE_DOCKER_SERVICES[pkg];
      if (!service) continue;

      const command = `docker-compose -f ${this.dockerComposeFile} build ${service}`;
      const start = Date.now();

      try {
        const { stdout, stderr } = await execAsync(command, { cwd: this.cwd });
        results.push({
          pkg: `docker:${service}`,
          success: true,
          output: (stdout + stderr).trim().slice(-500),
          duration: Date.now() - start,
        });
      } catch (error) {
        const err = error as { stdout?: string; stderr?: string; message?: string };
        results.push({
          pkg: `docker:${service}`,
          success: false,
          output: (((err.stdout ?? "") + (err.stderr ?? "")) || (err.message ?? "Docker build failed")).trim().slice(-500),
          duration: Date.now() - start,
        });
      }
    }

    return results;
  }
}
