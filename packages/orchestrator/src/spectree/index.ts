/**
 * SpecTree API Client Module
 *
 * Provides the HTTP client for interacting with the SpecTree REST API,
 * and MCP bridge tools for Copilot SDK integration.
 */

export {
  // Client
  SpecTreeClient,
  createSpecTreeClient,
  // Types
  type SpecTreeClientOptions,
  type PaginationMeta,
  type Team,
  type Status,
  // Epic types
  type Epic,
  type CreateEpicInput,
  type UpdateEpicInput,
  // Feature types
  type Feature,
  type CreateFeatureInput,
  type UpdateFeatureInput,
  type EstimatedComplexity,
  // Task types
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  // Execution plan types
  type ExecutionItem,
  type ExecutionPhase,
  type ExecutionPlan,
  // Session types
  type Session,
  type SessionStatus,
  type SessionWorkItem,
  type SessionDecision,
  type StartSessionInput,
  type StartSessionResponse,
  type SessionHandoff,
  type EpicProgress,
  // Progress types
  type StartWorkInput,
  type CompleteWorkInput,
  type LogProgressInput,
  type ProgressResponse,
} from "./api-client.js";

// MCP Bridge - Copilot SDK tools
export {
  // Tool creation
  createAgentTools,
  createAgentTool,
  // Tool names
  agentToolNames,
  type AgentToolName,
  // Types
  type ToolResult,
  type DecisionCategory,
  type ImpactLevel,
  type LogDecisionInput,
  type CodeContext,
} from "./mcp-bridge.js";
