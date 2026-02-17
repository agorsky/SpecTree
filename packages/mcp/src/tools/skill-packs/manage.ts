/**
 * MCP Tools for Skill Pack Management
 *
 * Provides tools for managing skill packs from within Copilot sessions.
 * Supports listing, getting details, installing, updating, and listing installed packs.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../../api-client.js";
import { createResponse, createErrorResponse } from "../utils.js";
import { registerGetPackManifestTool } from "./get-manifest.js";
import { registerSyncLocalPacksTool } from "./sync-local.js";

// Register skill pack management tools
export function registerSkillPackTools(server: McpServer): void {
  // Register the get-manifest tool
  registerGetPackManifestTool(server);

  // Register the sync-local tool
  registerSyncLocalPacksTool(server);

  // ==========================================================================
  // spectree__manage_skill_packs (COMPOSITE TOOL)
  // ==========================================================================
  server.registerTool(
    "spectree__manage_skill_packs",
    {
      description:
        "Manage Skill Packs with action-based routing. This composite tool provides 5 actions:\n\n" +
        "**list** - List available skill packs from the registry (supports filtering by official/search)\n" +
        "**get** - Get details about a specific skill pack by ID or name\n" +
        "**install** - Install a skill pack by ID/name and version\n" +
        "**update** - Update an installed skill pack to a new version (or 'latest')\n" +
        "**list_installed** - List all installed skill packs with their status\n\n" +
        "Use this to discover, install, and manage skill packs during AI sessions.",
      inputSchema: z.discriminatedUnion("action", [
        // list action
        z.object({
          action: z.literal("list").describe("List available skill packs"),
          cursor: z
            .string()
            .optional()
            .describe("Pagination cursor from previous response"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe("Maximum number of packs to return (default: 20, max: 100)"),
          isOfficial: z
            .boolean()
            .optional()
            .describe("Filter by official packs (true) or community packs (false)"),
          query: z
            .string()
            .optional()
            .describe("Search query to filter by name or display name"),
        }),
        // get action
        z.object({
          action: z.literal("get").describe("Get details about a specific skill pack"),
          id: z
            .string()
            .describe("Skill pack ID or name (e.g., '@spectree/planning' or UUID)"),
          includeVersions: z
            .boolean()
            .optional()
            .describe("Include all versions in response (default: false)"),
        }),
        // install action
        z.object({
          action: z.literal("install").describe("Install a skill pack"),
          id: z
            .string()
            .describe("Skill pack ID or name (e.g., '@spectree/planning')"),
          version: z
            .string()
            .describe("Version to install (semver string, e.g., '1.2.3' or 'latest')"),
        }),
        // update action
        z.object({
          action: z.literal("update").describe("Update an installed skill pack"),
          id: z
            .string()
            .describe("Skill pack ID or name (e.g., '@spectree/planning')"),
          version: z
            .string()
            .describe("Version to update to (semver string or 'latest')"),
        }),
        // list_installed action
        z.object({
          action: z
            .literal("list_installed")
            .describe("List all installed skill packs"),
        }),
      ]),
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Route based on action type
        switch (input.action) {
          case "list": {
            const params: {
              cursor?: string;
              limit?: number;
              isOfficial?: boolean;
              query?: string;
            } = {};
            if (input.cursor !== undefined) params.cursor = input.cursor;
            if (input.limit !== undefined) params.limit = input.limit;
            if (input.isOfficial !== undefined) params.isOfficial = input.isOfficial;
            if (input.query !== undefined) params.query = input.query;

            const result = await apiClient.listSkillPacks(params);

            return createResponse({
              message: `Found ${result.data.length} skill pack(s)`,
              packs: result.data.map((pack) => ({
                id: pack.id,
                name: pack.name,
                displayName: pack.displayName,
                description: pack.description,
                latestVersion: pack.latestVersion,
                isOfficial: pack.isOfficial,
                isDeprecated: pack.isDeprecated,
                authorName: pack.authorName,
                homepageUrl: pack.homepageUrl,
              })),
              pagination: {
                cursor: result.meta.cursor,
                hasMore: result.meta.hasMore,
              },
            });
          }

          case "get": {
            if (input.includeVersions) {
              const { data: pack } = await apiClient.getSkillPackWithVersions(input.id);

              return createResponse({
                message: `Retrieved skill pack '${pack.displayName}' with ${pack.versions.length} version(s)`,
                pack: {
                  id: pack.id,
                  name: pack.name,
                  displayName: pack.displayName,
                  description: pack.description,
                  latestVersion: pack.latestVersion,
                  isOfficial: pack.isOfficial,
                  isDeprecated: pack.isDeprecated,
                  authorName: pack.authorName,
                  authorUrl: pack.authorUrl,
                  homepageUrl: pack.homepageUrl,
                },
                versions: pack.versions.map((v) => ({
                  version: v.version,
                  isPrerelease: v.isPrerelease,
                  publishedAt: v.publishedAt,
                  releaseNotes: v.releaseNotes,
                  downloads: v.downloads,
                })),
              });
            } else {
              const { data: pack } = await apiClient.getSkillPack(input.id);

              return createResponse({
                message: `Retrieved skill pack '${pack.displayName}'`,
                pack: {
                  id: pack.id,
                  name: pack.name,
                  displayName: pack.displayName,
                  description: pack.description,
                  latestVersion: pack.latestVersion,
                  isOfficial: pack.isOfficial,
                  isDeprecated: pack.isDeprecated,
                  authorName: pack.authorName,
                  authorUrl: pack.authorUrl,
                  homepageUrl: pack.homepageUrl,
                },
              });
            }
          }

          case "install": {
            // If version is "latest", resolve it first
            let versionToInstall = input.version;
            if (input.version === "latest") {
              const { data: latestVersion } =
                await apiClient.getLatestSkillPackVersion(input.id);
              versionToInstall = latestVersion.version;
            }

            const { data: installation } = await apiClient.installSkillPack(input.id, {
              version: versionToInstall,
            });

            return createResponse({
              message: `Successfully installed skill pack version ${versionToInstall}`,
              installation: {
                skillPackId: installation.skillPackId,
                installedVersion: installation.installedVersion,
                isEnabled: installation.isEnabled,
                installedAt: installation.installedAt,
              },
            });
          }

          case "update": {
            // If version is "latest", resolve it first
            let versionToUpdate = input.version;
            if (input.version === "latest") {
              const { data: latestVersion } =
                await apiClient.getLatestSkillPackVersion(input.id);
              versionToUpdate = latestVersion.version;
            }

            // Update is the same as install (it updates if already installed)
            const { data: installation } = await apiClient.installSkillPack(input.id, {
              version: versionToUpdate,
            });

            return createResponse({
              message: `Successfully updated skill pack to version ${versionToUpdate}`,
              installation: {
                skillPackId: installation.skillPackId,
                installedVersion: installation.installedVersion,
                isEnabled: installation.isEnabled,
                lastUpdatedAt: installation.lastUpdatedAt,
              },
            });
          }

          case "list_installed": {
            const { data: installations } = await apiClient.listInstalledSkillPacks();

            return createResponse({
              message: `Found ${installations.length} installed skill pack(s)`,
              installations: installations.map((inst) => ({
                skillPackId: inst.skillPackId,
                name: inst.skillPack?.name,
                displayName: inst.skillPack?.displayName,
                installedVersion: inst.installedVersion,
                latestVersion: inst.skillPack?.latestVersion,
                isEnabled: inst.isEnabled,
                installedAt: inst.installedAt,
                lastUpdatedAt: inst.lastUpdatedAt,
                updateAvailable:
                  inst.skillPack?.latestVersion &&
                  inst.installedVersion !== inst.skillPack.latestVersion,
              })),
            });
          }

          default: {
            // TypeScript ensures this is unreachable
            throw new Error(`Unknown action: ${(input as { action: string }).action}`);
          }
        }
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(
              new Error(
                `Skill pack not found. Use action='list' to see available packs.`
              )
            );
          }
          if (error.status === 400) {
            const body = error.body as { error?: string };
            return createErrorResponse(
              new Error(`Validation error: ${body.error || "Invalid input"}`)
            );
          }
          if (error.status === 403) {
            return createErrorResponse(
              new Error(
                "Permission denied. Installing/updating skill packs requires admin privileges."
              )
            );
          }
        }
        return createErrorResponse(error);
      }
    }
  );
}
