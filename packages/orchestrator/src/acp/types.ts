/**
 * ACP (Agent Client Protocol) TypeScript type definitions.
 *
 * ACP uses JSON-RPC 2.0 over newline-delimited JSON on stdin/stdout.
 * See: https://www.jsonrpc.org/specification
 */

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 Base Types
// ---------------------------------------------------------------------------

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ---------------------------------------------------------------------------
// ACP Method Names
// ---------------------------------------------------------------------------

export const AcpMethod = {
  Initialize: "initialize",
  SessionNew: "session/new",
  SessionPrompt: "session/prompt",
  SessionUpdate: "session/update",
  SessionCancel: "session/cancel",
  SessionRequestPermission: "session/request_permission",
  SessionLoad: "session/load",
} as const;

export type AcpMethodName = (typeof AcpMethod)[keyof typeof AcpMethod];

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

export interface InitializeParams {
  clientInfo: {
    name: string;
    version: string;
  };
  capabilities?: Record<string, unknown>;
}

export interface InitializeResult {
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

export interface SessionNewParams {
  agent?: string;
  systemMessage?: string;
  mcpServers?: Record<string, McpServerConfig>;
  allowedTools?: string[];
  workingDirectory?: string;
  env?: Record<string, string>;
  permissions?: SessionPermissions;
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface SessionPermissions {
  allowAllTools?: boolean;
  allowAllPaths?: boolean;
  allowAll?: boolean;
}

export interface SessionNewResult {
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Session Prompt
// ---------------------------------------------------------------------------

export interface SessionPromptParams {
  sessionId: string;
  message: string;
}

export interface SessionPromptResult {
  messageId: string;
}

// ---------------------------------------------------------------------------
// Session Update (Server → Client notification)
// ---------------------------------------------------------------------------

export type SessionUpdateType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "complete"
  | "error";

export interface SessionUpdateParams {
  sessionId: string;
  type: SessionUpdateType;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Session Cancel
// ---------------------------------------------------------------------------

export interface SessionCancelParams {
  sessionId: string;
}

export interface SessionCancelResult {
  cancelled: boolean;
}

// ---------------------------------------------------------------------------
// Session Permission Request (Server → Client callback)
// ---------------------------------------------------------------------------

export interface SessionRequestPermissionParams {
  sessionId: string;
  tool?: string;
  command?: string;
  path?: string;
  description?: string;
}

export interface SessionRequestPermissionResponse {
  approved: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Session Load (Resume)
// ---------------------------------------------------------------------------

export interface SessionLoadParams {
  sessionId: string;
}

export interface SessionLoadResult {
  sessionId: string;
  restored: boolean;
}

// ---------------------------------------------------------------------------
// ACP Session Event
// ---------------------------------------------------------------------------

export interface AcpSessionEvent {
  sessionId: string;
  type: SessionUpdateType;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// ACP Client Options
// ---------------------------------------------------------------------------

export interface AcpClientOptions {
  copilotPath?: string;
  args?: string[];
  env?: Record<string, string>;
  requestTimeout?: number;
  autoApprovePermissions?: boolean;
}

// ---------------------------------------------------------------------------
// ACP Session Options
// ---------------------------------------------------------------------------

export interface AcpSessionOptions {
  agent?: string;
  systemMessage?: string;
  mcpServers?: Record<string, McpServerConfig>;
  allowedTools?: string[];
  workingDirectory?: string;
  env?: Record<string, string>;
  permissions?: SessionPermissions;
}

// ---------------------------------------------------------------------------
// ACP Client Events
// ---------------------------------------------------------------------------

export interface AcpClientEvents {
  connected: () => void;
  disconnected: (code: number | null) => void;
  error: (error: Error) => void;
  notification: (method: string, params: unknown) => void;
  permissionRequest: (params: SessionRequestPermissionParams) => void;
}

// ---------------------------------------------------------------------------
// ACP Session Events
// ---------------------------------------------------------------------------

export interface AcpSessionEventMap {
  text: (content: string) => void;
  tool_call: (toolName: string, args: unknown) => void;
  tool_result: (toolName: string, result: unknown) => void;
  complete: (content: string) => void;
  error: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Internal: Pending Request Tracking
// ---------------------------------------------------------------------------

export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export function isJsonRpcRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return "method" in msg && "id" in msg;
}

export function isJsonRpcResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return "id" in msg && !("method" in msg);
}

export function isJsonRpcNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return "method" in msg && !("id" in msg);
}

export function isSessionUpdate(params: unknown): params is SessionUpdateParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.sessionId === "string" && typeof p.type === "string";
}

export function isPermissionRequest(
  params: unknown
): params is SessionRequestPermissionParams {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  return typeof p.sessionId === "string";
}
