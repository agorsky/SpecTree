/**
 * Claude Code CLI type definitions.
 *
 * Claude Code uses `claude -p --output-format stream-json` which emits
 * newline-delimited JSON events on stdout. Unlike ACP's JSON-RPC 2.0
 * bidirectional protocol, each prompt spawns a fresh CLI process.
 */

// ---------------------------------------------------------------------------
// Claude Code Stream-JSON Event Types
// ---------------------------------------------------------------------------

/**
 * Content block within an assistant message.
 */
export interface TextContent {
  type: "text";
  text: string;
}

/**
 * Tool use content block within an assistant message.
 */
export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextContent | ToolUseContent;

/**
 * Tool result content block.
 */
export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

/**
 * Assistant message event emitted during Claude Code execution.
 * Contains the model's response with text and/or tool use content blocks.
 */
export interface AssistantEvent {
  type: "assistant";
  message: {
    id: string;
    type: "message";
    role: "assistant";
    content: ContentBlock[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
  };
  session_id: string;
}

/**
 * Result event emitted when Claude Code completes or errors.
 * This is the final event in a stream-json output.
 */
export interface ResultEvent {
  type: "result";
  subtype: "success" | "error";
  /** Final text result (for success) or error message (for error). */
  result: string;
  /** Total API cost in USD for this invocation. */
  cost_usd?: number;
  /** Total duration in milliseconds. */
  duration_ms?: number;
  /** Session ID for conversation continuity. */
  session_id?: string;
  /** Whether the run was a success. */
  is_error?: boolean;
  /** Number of agentic turns used. */
  num_turns?: number;
}

/**
 * System event emitted for session-level information.
 */
export interface SystemEvent {
  type: "system";
  subtype: string;
  message: string;
  session_id?: string;
}

/**
 * Union of all Claude Code stream-json event types.
 * Discriminated on the `type` field.
 */
export type ClaudeStreamEvent = AssistantEvent | ResultEvent | SystemEvent;

// ---------------------------------------------------------------------------
// Client Options
// ---------------------------------------------------------------------------

/**
 * Configuration options for ClaudeCodeClient.
 */
export interface ClaudeCodeClientOptions {
  /** Path to the claude CLI binary. Defaults to "claude". */
  claudePath?: string;
  /** Model to use (e.g., "sonnet", "opus", "claude-sonnet-4-6"). */
  model?: string;
  /** Additional CLI arguments to pass. */
  args?: string[];
  /** Additional environment variables for the spawned process. */
  env?: Record<string, string>;
  /** Timeout in milliseconds for a single prompt execution. Defaults to 300,000 (5 min). */
  requestTimeout?: number;
  /** Skip all permission prompts. Maps to --dangerously-skip-permissions. */
  skipPermissions?: boolean;
  /** Path to MCP config JSON file. Maps to --mcp-config. */
  mcpConfigPath?: string;
  /** System prompt override. Maps to --system-prompt. */
  systemPrompt?: string;
  /** Append to default system prompt. Maps to --append-system-prompt. */
  appendSystemPrompt?: string;
  /** Maximum number of agentic turns. Maps to --max-turns. */
  maxTurns?: number;
  /** Allowed tools list. Maps to --allowedTools. */
  allowedTools?: string[];
  /** Inactivity timeout in milliseconds. Kills the process if no stream events are received. Defaults to 60,000 (60s). */
  inactivityTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------

/**
 * Session status lifecycle — matches AcpSessionStatus for drop-in compatibility.
 */
export type ClaudeSessionStatus = "idle" | "working" | "completed" | "failed";

/**
 * Options for creating a Claude Code session.
 */
export interface ClaudeSessionOptions {
  /** Agent name (ignored for Claude Code, kept for ACP compat). */
  agent?: string;
  /** Model override for this session. */
  model?: string;
  /** System prompt for this session. */
  systemPrompt?: string;
  /** System message (alias for systemPrompt, for ACP compatibility). */
  systemMessage?: string;
  /** MCP server configurations. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Allowed tools for this session. */
  allowedTools?: string[];
  /** Working directory for the spawned process. */
  workingDirectory?: string;
  /** Additional environment variables. */
  env?: Record<string, string>;
  /** Skip permission prompts. */
  skipPermissions?: boolean;
  /** Permissions (ACP compat, mapped to skipPermissions). */
  permissions?: SessionPermissions;
}

/**
 * Session permissions (ACP compatibility).
 */
export interface SessionPermissions {
  allowAllTools?: boolean;
  allowAllPaths?: boolean;
  allowAll?: boolean;
}

/**
 * MCP server configuration (reused from ACP types for compatibility).
 */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Session Events
// ---------------------------------------------------------------------------

/**
 * Session update type — matches ACP's SessionUpdateType.
 */
export type SessionUpdateType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "complete"
  | "error";

/**
 * Session event payload — compatible with AcpSessionEvent shape.
 */
export interface ClaudeSessionEvent {
  sessionId: string;
  type: SessionUpdateType;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  error?: string;
}

/**
 * Session event map — compatible with AcpSessionEventMap.
 */
export interface ClaudeSessionEventMap {
  text: (content: string) => void;
  tool_call: (toolName: string, args: unknown) => void;
  tool_result: (toolName: string, result: unknown) => void;
  complete: (content: string) => void;
  error: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Internal: Pending Request Tracking
// ---------------------------------------------------------------------------

/**
 * Tracks a pending prompt execution for timeout management.
 */
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Check if a stream event is an AssistantEvent.
 */
export function isAssistantEvent(event: ClaudeStreamEvent): event is AssistantEvent {
  return event.type === "assistant";
}

/**
 * Check if a stream event is a ResultEvent.
 */
export function isResultEvent(event: ClaudeStreamEvent): event is ResultEvent {
  return event.type === "result";
}

/**
 * Check if a stream event is a SystemEvent.
 */
export function isSystemEvent(event: ClaudeStreamEvent): event is SystemEvent {
  return event.type === "system";
}

/**
 * Check if an unknown value is a ClaudeSessionEvent.
 * Mirrors the existing isSessionUpdate guard for ACP compatibility.
 */
export function isSessionUpdate(params: unknown): params is ClaudeSessionEvent {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.sessionId === "string" && typeof p.type === "string";
}
