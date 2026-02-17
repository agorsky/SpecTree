/**
 * MCP Tool for retrieving and formatting Skill Pack manifests
 *
 * Provides detailed manifest information in a format optimized for AI consumption.
 * Manifests describe the contents of a skill pack (agents, skills, instructions, dependencies).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getApiClient,
  ApiError,
  type SkillPackManifest,
} from "../../api-client.js";
import { createResponse, createErrorResponse } from "../utils.js";

// Register the get pack manifest tool
export function registerGetPackManifestTool(server: McpServer): void {
  // ==========================================================================
  // spectree__get_pack_manifest
  // ==========================================================================
  server.registerTool(
    "spectree__get_pack_manifest",
    {
      description:
        "Get the detailed manifest for a specific version of a skill pack.\n\n" +
        "The manifest describes the pack's contents including:\n" +
        "- Agents: AI agents included in the pack\n" +
        "- Skills: Individual skills/capabilities\n" +
        "- Instructions: Documentation and usage guides\n" +
        "- Dependencies: Other packs this pack depends on\n\n" +
        "Use this to understand what a skill pack contains before installing it, " +
        "or to see the details of an installed pack's current version.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "Skill pack ID or name (e.g., '@spectree/planning' or UUID)"
          ),
        version: z
          .string()
          .optional()
          .describe(
            "Specific version to get manifest for (e.g., '1.2.3'). If not provided, uses latest stable version."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve version if not provided
        let targetVersion = input.version;
        if (!targetVersion) {
          const { data: latestVersion } =
            await apiClient.getLatestSkillPackVersion(input.id);
          targetVersion = latestVersion.version;
        }

        // Get the specific version
        const { data: packVersion } = await apiClient.getSkillPackVersion(
          input.id,
          targetVersion
        );

        // Parse the manifest JSON
        let manifest: SkillPackManifest;
        try {
          manifest = JSON.parse(packVersion.manifest) as SkillPackManifest;
        } catch (parseError) {
          return createErrorResponse(
            new Error(
              `Failed to parse manifest for version ${targetVersion}: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
            )
          );
        }

        // Format the response for AI consumption
        const response = {
          message: `Retrieved manifest for ${manifest.name} v${manifest.version}`,
          pack: {
            name: manifest.name,
            version: manifest.version,
            description: manifest.description,
          },
          version: {
            version: packVersion.version,
            isPrerelease: packVersion.isPrerelease,
            publishedAt: packVersion.publishedAt,
            releaseNotes: packVersion.releaseNotes,
            downloads: packVersion.downloads,
          },
          contents: {
            agents: manifest.agents?.map((agent) => ({
              name: agent.name,
              path: agent.path,
              description: agent.description,
            })),
            skills: manifest.skills?.map((skill) => ({
              name: skill.name,
              path: skill.path,
              description: skill.description,
            })),
            instructions: manifest.instructions?.map((instr) => ({
              name: instr.name,
              path: instr.path,
              description: instr.description,
            })),
            dependencies: manifest.dependencies,
          },
          summary: {
            totalAgents: manifest.agents?.length ?? 0,
            totalSkills: manifest.skills?.length ?? 0,
            totalInstructions: manifest.instructions?.length ?? 0,
            totalDependencies: manifest.dependencies
              ? Object.keys(manifest.dependencies).length
              : 0,
          },
        };

        return createResponse(response);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(
              new Error(
                `Skill pack or version not found. Use spectree__manage_skill_packs with action='list' to see available packs.`
              )
            );
          }
          if (error.status === 400) {
            const body = error.body as { error?: string };
            return createErrorResponse(
              new Error(`Validation error: ${body.error ?? "Invalid input"}`)
            );
          }
        }
        return createErrorResponse(error);
      }
    }
  );
}
