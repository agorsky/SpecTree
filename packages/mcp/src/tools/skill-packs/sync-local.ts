/**
 * MCP Tool for syncing local skill pack installations with the registry
 *
 * Detects drift between .spectree/manifest.json and actual filesystem state:
 * - Untracked files: Files exist in .github but not in manifest
 * - Missing files: Files in manifest but not on filesystem
 * - Version mismatches: Installed version differs from registry
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";
import { getApiClient, ApiError } from "../../api-client.js";
import { createResponse, createErrorResponse } from "../utils.js";

// Local manifest structure (matches CLI FileManager)
interface LocalManifest {
  installedPacks: Record<string, {
      version: string;
      installedAt: string;
      files: string[];
    }>;
}

// Register the sync local packs tool
export function registerSyncLocalPacksTool(server: McpServer): void {
  // ==========================================================================
  // spectree__sync_local_packs
  // ==========================================================================
  server.registerTool(
    "spectree__sync_local_packs",
    {
      description:
        "Detect drift between local skill pack installations and the registry.\n\n" +
        "This tool compares:\n" +
        "1. .spectree/manifest.json (local installation record)\n" +
        "2. Actual files in .github/copilot-instructions/\n" +
        "3. Database registry (what's officially installed)\n\n" +
        "Reports:\n" +
        "- **Untracked files**: Files exist locally but not in manifest\n" +
        "- **Missing files**: Files in manifest but not on filesystem\n" +
        "- **Registry mismatches**: Local manifest differs from database registry\n" +
        "- **Version differences**: Installed version vs. available version\n\n" +
        "Use this to audit local installations and identify cleanup/sync needs.",
      inputSchema: {
        projectRoot: z
          .string()
          .optional()
          .describe(
            "Project root directory (default: current working directory). Must contain .spectree/ and .github/ directories."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve paths
        const root = input.projectRoot ?? process.cwd();
        const spectreeDir = path.join(root, ".spectree");
        const githubDir = path.join(root, ".github");
        const manifestPath = path.join(spectreeDir, "manifest.json");
        const instructionsDir = path.join(githubDir, "copilot-instructions");

        // Check if directories exist
        const spectreeDirExists = existsSync(spectreeDir);
        const githubDirExists = existsSync(githubDir);
        const instructionsDirExists = existsSync(instructionsDir);

        if (!spectreeDirExists && !githubDirExists) {
          return createResponse({
            message: "No skill pack installations found",
            status: "clean",
            details: {
              spectreeDir: spectreeDirExists,
              githubDir: githubDirExists,
              instructionsDir: instructionsDirExists,
            },
            summary: {
              untrackedFiles: 0,
              missingFiles: 0,
              registryMismatches: 0,
              versionDifferences: 0,
            },
          });
        }

        // Read local manifest
        let localManifest: LocalManifest = { installedPacks: {} };
        if (existsSync(manifestPath)) {
          try {
            const content = await fs.readFile(manifestPath, "utf-8");
            localManifest = JSON.parse(content) as LocalManifest;
          } catch (error) {
            return createErrorResponse(
              new Error(
                `Failed to parse .spectree/manifest.json: ${error instanceof Error ? error.message : "Unknown error"}`
              )
            );
          }
        }

        // Get installed packs from database registry
        const { data: registryInstallations } =
          await apiClient.listInstalledSkillPacks();
        const registryMap = new Map(
          registryInstallations.map((inst) => [
            inst.skillPack?.name ?? inst.skillPackId,
            inst,
          ])
        );

        // Get all files in .github/copilot-instructions/ if it exists
        let localFiles: string[] = [];
        if (instructionsDirExists) {
          try {
            const files = await fs.readdir(instructionsDir, {
              recursive: true,
              withFileTypes: true,
            });
            localFiles = files
              .filter((f) => f.isFile())
              .map((f) => path.relative(instructionsDir, path.join(f.parentPath, f.name)));
          } catch {
            // Directory might not be readable, continue with empty list
            localFiles = [];
          }
        }

        // Detect issues
        const issues = {
          untrackedFiles: [] as string[],
          missingFiles: [] as { pack: string; file: string }[],
          registryMismatches: [] as {
            pack: string;
            inLocal: boolean;
            inRegistry: boolean;
            localVersion?: string;
            registryVersion?: string;
          }[],
          versionDifferences: [] as {
            pack: string;
            installedVersion: string;
            latestVersion: string;
            source: "local" | "registry";
          }[],
        };

        // Track which files are accounted for
        const accountedFiles = new Set<string>();

        // Check local manifest packs
        for (const [packName, packInfo] of Object.entries(
          localManifest.installedPacks
        )) {
          const inRegistry = registryMap.has(packName);
          const registryInfo = registryMap.get(packName);

          // Check for registry mismatch
          if (!inRegistry) {
            issues.registryMismatches.push({
              pack: packName,
              inLocal: true,
              inRegistry: false,
              localVersion: packInfo.version,
            });
          } else if (registryInfo && registryInfo.installedVersion !== packInfo.version) {
            issues.registryMismatches.push({
              pack: packName,
              inLocal: true,
              inRegistry: true,
              localVersion: packInfo.version,
              registryVersion: registryInfo.installedVersion,
            });
          }

          // Check for missing files
          for (const file of packInfo.files) {
            accountedFiles.add(file);
            const fullPath = path.join(instructionsDir, file);
            if (!existsSync(fullPath)) {
              issues.missingFiles.push({ pack: packName, file });
            }
          }

          // Check for version differences (if in registry)
          if (registryInfo?.skillPack?.latestVersion) {
            const installedVersion = registryInfo.installedVersion;
            const latestVersion = registryInfo.skillPack.latestVersion;
            if (installedVersion !== latestVersion) {
              issues.versionDifferences.push({
                pack: packName,
                installedVersion,
                latestVersion,
                source: "registry",
              });
            }
          }
        }

        // Check registry-only packs
        for (const [packName, registryInfo] of registryMap.entries()) {
          if (!localManifest.installedPacks[packName]) {
            issues.registryMismatches.push({
              pack: packName,
              inLocal: false,
              inRegistry: true,
              registryVersion: registryInfo.installedVersion,
            });

            // Check for version differences
            if (registryInfo.skillPack?.latestVersion) {
              const installedVersion = registryInfo.installedVersion;
              const latestVersion = registryInfo.skillPack.latestVersion;
              if (installedVersion !== latestVersion) {
                issues.versionDifferences.push({
                  pack: packName,
                  installedVersion,
                  latestVersion,
                  source: "registry",
                });
              }
            }
          }
        }

        // Check for untracked files
        for (const file of localFiles) {
          if (!accountedFiles.has(file)) {
            issues.untrackedFiles.push(file);
          }
        }

        // Determine status
        const hasIssues =
          issues.untrackedFiles.length > 0 ||
          issues.missingFiles.length > 0 ||
          issues.registryMismatches.length > 0 ||
          issues.versionDifferences.length > 0;

        return createResponse({
          message: hasIssues
            ? `Found ${String(issues.untrackedFiles.length + issues.missingFiles.length + issues.registryMismatches.length + issues.versionDifferences.length)} issue(s)`
            : "Local installations are in sync",
          status: hasIssues ? "drift-detected" : "in-sync",
          paths: {
            projectRoot: root,
            spectreeDir,
            githubDir,
            instructionsDir,
            manifestPath,
          },
          directories: {
            spectreeDirExists,
            githubDirExists,
            instructionsDirExists,
          },
          summary: {
            untrackedFiles: issues.untrackedFiles.length,
            missingFiles: issues.missingFiles.length,
            registryMismatches: issues.registryMismatches.length,
            versionDifferences: issues.versionDifferences.length,
            totalLocalPacks: Object.keys(localManifest.installedPacks).length,
            totalRegistryPacks: registryInstallations.length,
          },
          issues: hasIssues ? issues : undefined,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 403) {
            return createErrorResponse(
              new Error(
                "Permission denied. Viewing installed packs requires authentication."
              )
            );
          }
        }
        return createErrorResponse(error);
      }
    }
  );
}
