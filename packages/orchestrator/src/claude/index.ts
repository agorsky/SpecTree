/**
 * Claude Code module.
 *
 * Provides a typed client for driving Claude Code CLI sessions programmatically
 * via process spawn with stream-json output parsing.
 */

export { ClaudeCodeClient } from "./client.js";
export { ClaudeCodeSession, ClaudeCodeSessionManager } from "./session.js";
export type { ClaudeSessionStatus } from "./types.js";

// Types
export type {
  // Stream event types
  AssistantEvent,
  ResultEvent,
  SystemEvent,
  ClaudeStreamEvent,
  ContentBlock,
  TextContent,
  ToolUseContent,
  ToolResultContent,

  // Client options
  ClaudeCodeClientOptions,

  // Session types
  ClaudeSessionOptions,
  ClaudeSessionEvent,
  ClaudeSessionEventMap,
  SessionUpdateType,
  McpServerConfig,

  // Internal
  PendingRequest,
} from "./types.js";

// Type guards
export {
  isAssistantEvent,
  isResultEvent,
  isSystemEvent,
  isSessionUpdate,
} from "./types.js";
