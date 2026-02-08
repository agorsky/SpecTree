/**
 * ACP (Agent Client Protocol) module.
 *
 * Provides a typed client for driving Copilot CLI sessions programmatically
 * via JSON-RPC 2.0 over stdio.
 */

export { AcpClient } from "./client.js";
export { AcpSession, AcpSessionManager } from "./session.js";
export type { AcpSessionStatus } from "./session.js";

// Types
export type {
  // JSON-RPC base types
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,

  // ACP method names
  AcpMethodName,

  // Initialize
  InitializeParams,
  InitializeResult,

  // Session lifecycle
  SessionNewParams,
  SessionNewResult,
  SessionPromptParams,
  SessionPromptResult,
  SessionUpdateType,
  SessionUpdateParams,
  SessionCancelParams,
  SessionCancelResult,

  // Permission handling
  SessionRequestPermissionParams,
  SessionRequestPermissionResponse,

  // Session load
  SessionLoadParams,
  SessionLoadResult,

  // Events
  AcpSessionEvent,
  AcpSessionEventMap,
  AcpClientEvents,

  // Options
  AcpClientOptions,
  AcpSessionOptions,
  McpServerConfig,
  SessionPermissions,

  // Internal
  PendingRequest,
} from "./types.js";

// Constants and type guards
export {
  AcpMethod,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcNotification,
  isSessionUpdate,
  isPermissionRequest,
} from "./types.js";
