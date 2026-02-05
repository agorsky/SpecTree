/**
 * MCP Tool Registry
 *
 * Central registry for all SpecTree MCP tools.
 * Tools are organized by domain and registered with the MCP server.
 *
 * NOTE: Session and workflow tools were removed as part of the orchestrator
 * migration (2025-01). The orchestrator manages sessions and workflow
 * externally rather than through AI-driven MCP tools.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import tool modules - these export their registrar functions
import { registerEpicTools } from "./epics.js";
import { registerFeatureTools } from "./features.js";
import { registerTaskTools } from "./tasks.js";
import { registerStatusTools } from "./statuses.js";
import { registerOrderingTools } from "./ordering.js";
import { registerSearchTools } from "./search.js";
import { registerPersonalTools } from "./personal.js";
import { registerExecutionTools } from "./execution.js";
import { registerHelpTools } from "./help.js";
import { registerAiContextTools } from "./ai-context.js";
import { registerProgressTools } from "./progress.js";
import { registerTemplateTools } from "./templates.js";
import { registerStructuredDescTools } from "./structured-desc.js";
import { registerCodeContextTools } from "./code-context.js";
import { registerValidationTools } from "./validations.js";
import { registerSummaryTools } from "./summary.js";
import { registerDecisionTools } from "./decisions.js";
import { registerTeamTools } from "./teams.js";
import { registerCompositeTools } from "./composite.js";

// Tool registration function type
export type ToolRegistrar = (server: McpServer) => void;

// Registry of all tool registration functions
const toolRegistrars: ToolRegistrar[] = [
  registerHelpTools,  // Register first so it's discovered early
  registerEpicTools,
  registerFeatureTools,
  registerTaskTools,
  registerStatusTools,
  registerOrderingTools,
  registerSearchTools,
  registerPersonalTools,
  registerExecutionTools,
  registerAiContextTools,
  registerProgressTools,
  registerTemplateTools,
  registerStructuredDescTools,
  registerCodeContextTools,
  registerValidationTools,
  registerSummaryTools,
  registerDecisionTools,
  registerTeamTools,
  registerCompositeTools,
];

/**
 * Register all tools with the MCP server.
 * Called once during server startup.
 */
export function registerAllTools(server: McpServer): void {
  for (const registrar of toolRegistrars) {
    registrar(server);
  }
}
