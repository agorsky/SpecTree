/**
 * Error Types Module for SpecTree Orchestrator
 *
 * Provides typed error classes for consistent error handling throughout the orchestrator.
 * All errors extend the base OrchestratorError and are JSON-serializable for logging.
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // Authentication errors
  AUTH_MISSING_TOKEN = "AUTH_MISSING_TOKEN",
  AUTH_INVALID_TOKEN = "AUTH_INVALID_TOKEN",
  AUTH_EXPIRED_TOKEN = "AUTH_EXPIRED_TOKEN",

  // Network errors
  NETWORK_CONNECTION_FAILED = "NETWORK_CONNECTION_FAILED",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_SERVER_ERROR = "NETWORK_SERVER_ERROR",

  // Agent errors
  AGENT_SPAWN_FAILED = "AGENT_SPAWN_FAILED",
  AGENT_EXECUTION_FAILED = "AGENT_EXECUTION_FAILED",
  AGENT_TIMEOUT = "AGENT_TIMEOUT",

  // Git errors
  MERGE_CONFLICT = "MERGE_CONFLICT",
  GIT_OPERATION_FAILED = "GIT_OPERATION_FAILED",

  // SpecTree API errors
  SPECTREE_API_ERROR = "SPECTREE_API_ERROR",
  SPECTREE_NOT_FOUND = "SPECTREE_NOT_FOUND",
  SPECTREE_VALIDATION_ERROR = "SPECTREE_VALIDATION_ERROR",

  // Configuration errors
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_MISSING = "CONFIG_MISSING",

  // General errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * JSON-serializable error representation
 */
export interface SerializedError {
  name: string;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  recoveryHint?: string;
  stack?: string;
}

/**
 * Base error class for all orchestrator errors.
 * Provides structured error information with code, context, and recovery hints.
 */
export class OrchestratorError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown> | undefined;
  readonly recoveryHint: string | undefined;

  constructor(
    message: string,
    code: string = ErrorCode.UNKNOWN_ERROR,
    options?: {
      context?: Record<string, unknown>;
      recoveryHint?: string;
      cause?: Error;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "OrchestratorError";
    this.code = code;
    this.context = options?.context;
    this.recoveryHint = options?.recoveryHint;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to JSON-serializable format for logging
   */
  toJSON(): SerializedError {
    const result: SerializedError = {
      name: this.name,
      code: this.code,
      message: this.message,
    };
    if (this.context !== undefined) {
      result.context = this.context;
    }
    if (this.recoveryHint !== undefined) {
      result.recoveryHint = this.recoveryHint;
    }
    if (this.stack !== undefined) {
      result.stack = this.stack;
    }
    return result;
  }

  /**
   * Create a formatted string representation for CLI output
   */
  toFormattedString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.recoveryHint) {
      result += `\n  Hint: ${this.recoveryHint}`;
    }
    return result;
  }
}

/**
 * Authentication errors - do not retry automatically
 */
export class AuthError extends OrchestratorError {
  constructor(
    message: string,
    code:
      | ErrorCode.AUTH_MISSING_TOKEN
      | ErrorCode.AUTH_INVALID_TOKEN
      | ErrorCode.AUTH_EXPIRED_TOKEN = ErrorCode.AUTH_MISSING_TOKEN,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, code, {
      ...options,
      recoveryHint: "Run 'spectree-agent auth' to authenticate",
    });
    this.name = "AuthError";
  }

  static missingToken(): AuthError {
    return new AuthError(
      "No authentication token found",
      ErrorCode.AUTH_MISSING_TOKEN
    );
  }

  static invalidToken(): AuthError {
    return new AuthError(
      "Authentication token is invalid",
      ErrorCode.AUTH_INVALID_TOKEN
    );
  }

  static expiredToken(): AuthError {
    return new AuthError(
      "Authentication token has expired",
      ErrorCode.AUTH_EXPIRED_TOKEN
    );
  }
}

/**
 * Network/API errors - may be retryable with backoff
 */
export class NetworkError extends OrchestratorError {
  readonly statusCode: number | undefined;
  readonly retryable: boolean;

  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      retryable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const code = options?.code ?? ErrorCode.NETWORK_CONNECTION_FAILED;
    const retryable = options?.retryable ?? true;
    const superOptions: {
      context: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      context: { ...options?.context, statusCode: options?.statusCode },
      recoveryHint: "Check your internet connection and SpecTree API status",
    };
    if (options?.cause) {
      superOptions.cause = options.cause;
    }

    super(message, code, superOptions);

    this.name = "NetworkError";
    this.statusCode = options?.statusCode;
    this.retryable = retryable;
  }

  override toJSON(): SerializedError & {
    statusCode?: number;
    retryable: boolean;
  } {
    const result = {
      ...super.toJSON(),
      retryable: this.retryable,
    } as SerializedError & { statusCode?: number; retryable: boolean };
    if (this.statusCode !== undefined) {
      result.statusCode = this.statusCode;
    }
    return result;
  }

  static connectionFailed(cause?: Error): NetworkError {
    const opts: {
      code: ErrorCode;
      retryable: boolean;
      cause?: Error;
    } = {
      code: ErrorCode.NETWORK_CONNECTION_FAILED,
      retryable: true,
    };
    if (cause) {
      opts.cause = cause;
    }
    return new NetworkError("Failed to connect to server", opts);
  }

  static timeout(timeoutMs: number): NetworkError {
    return new NetworkError(`Request timed out after ${timeoutMs}ms`, {
      code: ErrorCode.NETWORK_TIMEOUT,
      retryable: true,
      context: { timeoutMs },
    });
  }

  static serverError(statusCode: number, message?: string): NetworkError {
    return new NetworkError(message ?? `Server error: ${statusCode}`, {
      code: ErrorCode.NETWORK_SERVER_ERROR,
      statusCode,
      retryable: statusCode >= 500,
    });
  }
}

/**
 * Agent execution errors
 */
export class AgentError extends OrchestratorError {
  readonly agentId: string;
  readonly taskId: string;

  constructor(
    message: string,
    agentId: string,
    taskId: string,
    options?: {
      code?: ErrorCode;
      context?: Record<string, unknown>;
      recoveryHint?: string;
      cause?: Error;
    }
  ) {
    const superOptions: {
      context: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      context: { ...options?.context, agentId, taskId },
      recoveryHint:
        options?.recoveryHint ??
        `Check agent logs for task ${taskId}. You may need to retry or handle manually.`,
    };
    if (options?.cause) {
      superOptions.cause = options.cause;
    }

    super(message, options?.code ?? ErrorCode.AGENT_EXECUTION_FAILED, superOptions);

    this.name = "AgentError";
    this.agentId = agentId;
    this.taskId = taskId;
  }

  override toJSON(): SerializedError & { agentId: string; taskId: string } {
    return {
      ...super.toJSON(),
      agentId: this.agentId,
      taskId: this.taskId,
    };
  }

  static spawnFailed(agentId: string, taskId: string, cause?: Error): AgentError {
    const opts: {
      code: ErrorCode;
      cause?: Error;
    } = {
      code: ErrorCode.AGENT_SPAWN_FAILED,
    };
    if (cause) {
      opts.cause = cause;
    }
    return new AgentError(`Failed to spawn agent ${agentId}`, agentId, taskId, opts);
  }

  static executionFailed(
    agentId: string,
    taskId: string,
    reason: string,
    cause?: Error
  ): AgentError {
    const opts: {
      code: ErrorCode;
      context: Record<string, unknown>;
      cause?: Error;
    } = {
      code: ErrorCode.AGENT_EXECUTION_FAILED,
      context: { reason },
    };
    if (cause) {
      opts.cause = cause;
    }
    return new AgentError(`Agent ${agentId} failed: ${reason}`, agentId, taskId, opts);
  }

  static timeout(agentId: string, taskId: string, timeoutMs: number): AgentError {
    return new AgentError(
      `Agent ${agentId} timed out after ${timeoutMs}ms`,
      agentId,
      taskId,
      {
        code: ErrorCode.AGENT_TIMEOUT,
        context: { timeoutMs },
        recoveryHint: "The task may be too complex. Consider breaking it into smaller subtasks.",
      }
    );
  }
}

/**
 * Git merge conflict errors
 */
export class MergeConflictError extends OrchestratorError {
  readonly conflictingFiles: string[];
  readonly sourceBranch: string;
  readonly targetBranch: string;

  constructor(
    conflictingFiles: string[],
    sourceBranch: string,
    targetBranch: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const fileList = conflictingFiles.join(", ");
    const superOptions: {
      context: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      context: {
        ...options?.context,
        conflictingFiles,
        sourceBranch,
        targetBranch,
      },
      recoveryHint: `Resolve conflicts in: ${fileList}`,
    };
    if (options?.cause) {
      superOptions.cause = options.cause;
    }

    super(
      `Merge conflict when merging ${sourceBranch} into ${targetBranch}`,
      ErrorCode.MERGE_CONFLICT,
      superOptions
    );

    this.name = "MergeConflictError";
    this.conflictingFiles = conflictingFiles;
    this.sourceBranch = sourceBranch;
    this.targetBranch = targetBranch;
  }

  override toJSON(): SerializedError & {
    conflictingFiles: string[];
    sourceBranch: string;
    targetBranch: string;
  } {
    return {
      ...super.toJSON(),
      conflictingFiles: this.conflictingFiles,
      sourceBranch: this.sourceBranch,
      targetBranch: this.targetBranch,
    };
  }
}

/**
 * SpecTree API errors
 */
export class DispatcherAPIError extends OrchestratorError {
  readonly endpoint: string;
  readonly method: string;
  readonly statusCode: number | undefined;

  constructor(
    message: string,
    endpoint: string,
    method: string,
    options?: {
      code?: ErrorCode;
      statusCode?: number;
      context?: Record<string, unknown>;
      recoveryHint?: string;
      cause?: Error;
    }
  ) {
    const superOptions: {
      context: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      context: {
        ...options?.context,
        endpoint,
        method,
        statusCode: options?.statusCode,
      },
      recoveryHint:
        options?.recoveryHint ?? "Check your SpecTree API configuration",
    };
    if (options?.cause) {
      superOptions.cause = options.cause;
    }

    super(message, options?.code ?? ErrorCode.SPECTREE_API_ERROR, superOptions);

    this.name = "DispatcherAPIError";
    this.endpoint = endpoint;
    this.method = method;
    this.statusCode = options?.statusCode;
  }

  override toJSON(): SerializedError & {
    endpoint: string;
    method: string;
    statusCode?: number;
  } {
    const result = {
      ...super.toJSON(),
      endpoint: this.endpoint,
      method: this.method,
    } as SerializedError & { endpoint: string; method: string; statusCode?: number };
    if (this.statusCode !== undefined) {
      result.statusCode = this.statusCode;
    }
    return result;
  }

  static notFound(endpoint: string, method: string, resourceId: string): DispatcherAPIError {
    return new DispatcherAPIError(
      `Resource not found: ${resourceId}`,
      endpoint,
      method,
      {
        code: ErrorCode.SPECTREE_NOT_FOUND,
        statusCode: 404,
        context: { resourceId },
      }
    );
  }

  static validationError(
    endpoint: string,
    method: string,
    errors: string[]
  ): DispatcherAPIError {
    return new DispatcherAPIError(
      `Validation failed: ${errors.join(", ")}`,
      endpoint,
      method,
      {
        code: ErrorCode.SPECTREE_VALIDATION_ERROR,
        statusCode: 400,
        context: { validationErrors: errors },
      }
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigError extends OrchestratorError {
  constructor(
    message: string,
    code: ErrorCode.CONFIG_INVALID | ErrorCode.CONFIG_MISSING = ErrorCode.CONFIG_INVALID,
    options?: {
      context?: Record<string, unknown>;
      recoveryHint?: string;
      cause?: Error;
    }
  ) {
    const superOptions: {
      context?: Record<string, unknown>;
      recoveryHint: string;
      cause?: Error;
    } = {
      recoveryHint:
        options?.recoveryHint ??
        "Check your configuration with 'spectree-agent config'",
    };
    if (options?.context) {
      superOptions.context = options.context;
    }
    if (options?.cause) {
      superOptions.cause = options.cause;
    }
    super(message, code, superOptions);
    this.name = "ConfigError";
  }

  static missing(key: string): ConfigError {
    return new ConfigError(`Missing required configuration: ${key}`, ErrorCode.CONFIG_MISSING, {
      context: { key },
    });
  }

  static invalid(key: string, value: unknown, expectedType: string): ConfigError {
    return new ConfigError(
      `Invalid configuration value for '${key}': expected ${expectedType}`,
      ErrorCode.CONFIG_INVALID,
      {
        context: { key, value, expectedType },
      }
    );
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is an OrchestratorError
 */
export function isOrchestratorError(error: unknown): error is OrchestratorError {
  return error instanceof OrchestratorError;
}

/**
 * Check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if an error is an AgentError
 */
export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}

/**
 * Check if an error is a MergeConflictError
 */
export function isMergeConflictError(error: unknown): error is MergeConflictError {
  return error instanceof MergeConflictError;
}

/**
 * Check if an error is a DispatcherAPIError
 */
export function isDispatcherAPIError(error: unknown): error is DispatcherAPIError {
  return error instanceof DispatcherAPIError;
}

/**
 * Check if an error is a ConfigError
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) {
    return error.retryable;
  }
  if (isAgentError(error)) {
    return error.code === ErrorCode.AGENT_TIMEOUT;
  }
  return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an unknown error into an OrchestratorError
 */
export function wrapError(error: unknown, defaultMessage = "An error occurred"): OrchestratorError {
  if (isOrchestratorError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new OrchestratorError(error.message || defaultMessage, ErrorCode.UNKNOWN_ERROR, {
      cause: error,
    });
  }

  return new OrchestratorError(
    typeof error === "string" ? error : defaultMessage,
    ErrorCode.UNKNOWN_ERROR,
    {
      context: { originalError: error },
    }
  );
}

/**
 * Serialize any error to a JSON-safe format
 */
export function serializeError(error: unknown): SerializedError {
  if (isOrchestratorError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    const result: SerializedError = {
      name: error.name,
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
    };
    if (error.stack !== undefined) {
      result.stack = error.stack;
    }
    return result;
  }

  return {
    name: "UnknownError",
    code: ErrorCode.UNKNOWN_ERROR,
    message: String(error),
  };
}
