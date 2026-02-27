/**
 * Retry Logic Module for SpecTree Orchestrator
 *
 * Provides automatic retry with exponential backoff for transient failures.
 * Integrates with the orchestrator error system for intelligent retry decisions.
 */

import {
  ErrorCode,
  OrchestratorError,
  isNetworkError,
  isAuthError,
  isDispatcherAPIError,
} from "../errors.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (not including initial attempt) */
  maxRetries: number;
  /** Initial delay before first retry in milliseconds */
  initialDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Error codes that should be retried */
  retryableErrorCodes: string[];
  /** Optional callback for retry progress */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
  /** Add jitter to delays to prevent thundering herd */
  jitter?: boolean;
}

/**
 * Result of a retry operation with metadata
 */
export interface RetryResult<T> {
  /** The successful result */
  result: T;
  /** Number of attempts made (1 = succeeded on first try) */
  attempts: number;
  /** Total time spent including delays in milliseconds */
  totalTimeMs: number;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Error codes that indicate transient failures worth retrying
 */
export const RETRYABLE_ERROR_CODES: string[] = [
  // Network errors
  ErrorCode.NETWORK_CONNECTION_FAILED,
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.NETWORK_SERVER_ERROR,
  // Agent errors that might be transient
  ErrorCode.AGENT_TIMEOUT,
];

/**
 * Error codes that should never be retried (require user action)
 */
export const NON_RETRYABLE_ERROR_CODES: string[] = [
  // Auth errors - need user to re-authenticate
  ErrorCode.AUTH_MISSING_TOKEN,
  ErrorCode.AUTH_INVALID_TOKEN,
  ErrorCode.AUTH_EXPIRED_TOKEN,
  // API errors - request is malformed or resource doesn't exist
  ErrorCode.SPECTREE_NOT_FOUND,
  ErrorCode.SPECTREE_VALIDATION_ERROR,
  // Config errors - need user to fix config
  ErrorCode.CONFIG_INVALID,
  ErrorCode.CONFIG_MISSING,
];

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrorCodes: RETRYABLE_ERROR_CODES,
  jitter: true,
};

/**
 * Retry configuration optimized for rate limit errors (longer waits)
 */
export const RATE_LIMIT_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 5000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

/**
 * Retry configuration for read operations (more retries, shorter waits)
 */
export const READ_OPERATION_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 5,
  initialDelayMs: 500,
  maxDelayMs: 15000,
  backoffMultiplier: 2,
};

// =============================================================================
// Core Retry Function
// =============================================================================

/**
 * Execute a function with automatic retry on transient failures.
 *
 * @param fn - The async function to execute
 * @param config - Optional retry configuration overrides
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => client.createEpic(data),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error = new Error("No attempts made");
  let delay = cfg.initialDelayMs;

  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryable(error, cfg.retryableErrorCodes)) {
        throw error;
      }

      // Check if we have retries left
      if (attempt > cfg.maxRetries) {
        break;
      }

      // Calculate delay with optional jitter
      const actualDelay = cfg.jitter ? addJitter(delay) : delay;

      // Call retry callback if provided
      if (cfg.onRetry) {
        cfg.onRetry(attempt, actualDelay, lastError);
      }

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Execute a function with retry and return detailed result metadata.
 *
 * @param fn - The async function to execute
 * @param config - Optional retry configuration overrides
 * @returns Result with metadata about retry attempts
 *
 * @example
 * ```typescript
 * const { result, attempts, totalTimeMs } = await withRetryDetailed(
 *   () => client.getEpic(id),
 *   { maxRetries: 5 }
 * );
 * console.log(`Succeeded after ${attempts} attempts in ${totalTimeMs}ms`);
 * ```
 */
export async function withRetryDetailed<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error = new Error("No attempts made");
  let delay = cfg.initialDelayMs;
  let attemptCount = 0;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    attemptCount = attempt;

    try {
      const result = await fn();
      return {
        result,
        attempts: attemptCount,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryable(error, cfg.retryableErrorCodes)) {
        throw error;
      }

      // Check if we have retries left
      if (attempt > cfg.maxRetries) {
        break;
      }

      // Calculate delay with optional jitter
      const actualDelay = cfg.jitter ? addJitter(delay) : delay;

      // Call retry callback if provided
      if (cfg.onRetry) {
        cfg.onRetry(attempt, actualDelay, lastError);
      }

      // Wait before retrying
      await sleep(actualDelay);

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
    }
  }

  throw lastError;
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Determine if an error is retryable based on its type and code.
 *
 * @param error - The error to check
 * @param retryableCodes - List of error codes that are retryable
 * @returns true if the error should be retried
 */
export function isRetryable(
  error: unknown,
  retryableCodes: string[] = RETRYABLE_ERROR_CODES
): boolean {
  // Auth errors are never retryable (require user action)
  if (isAuthError(error)) {
    return false;
  }

  // Network errors have explicit retryable flag
  if (isNetworkError(error)) {
    return error.retryable;
  }

  // SpecTree API errors - check status code
  if (isDispatcherAPIError(error)) {
    // 404, 400, 422 are not retryable
    if (error.statusCode !== undefined) {
      if (error.statusCode === 404 || error.statusCode === 400 || error.statusCode === 422) {
        return false;
      }
      // 5xx errors are retryable
      if (error.statusCode >= 500) {
        return true;
      }
      // 429 rate limit is retryable
      if (error.statusCode === 429) {
        return true;
      }
    }
    return false;
  }

  // OrchestratorError - check error code against retryable list
  if (error instanceof OrchestratorError) {
    // Check if explicitly in non-retryable list
    if (NON_RETRYABLE_ERROR_CODES.includes(error.code)) {
      return false;
    }
    // Check if in retryable list
    return retryableCodes.includes(error.code);
  }

  // Unknown errors - not retryable by default
  return false;
}

/**
 * Check if an error is a rate limit error that needs special handling.
 */
export function isRateLimitError(error: unknown): boolean {
  if (isNetworkError(error) && error.statusCode === 429) {
    return true;
  }
  if (isDispatcherAPIError(error) && error.statusCode === 429) {
    return true;
  }
  return false;
}

/**
 * Get recommended retry configuration based on error type.
 */
export function getRetryConfigForError(error: unknown): Partial<RetryConfig> {
  if (isRateLimitError(error)) {
    return RATE_LIMIT_RETRY_CONFIG;
  }
  return {};
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Sleep for the specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add random jitter to a delay to prevent thundering herd.
 * Adds ±25% variance to the delay.
 */
export function addJitter(delayMs: number): number {
  const jitterFactor = 0.25;
  const minDelay = delayMs * (1 - jitterFactor);
  const maxDelay = delayMs * (1 + jitterFactor);
  return Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
}

/**
 * Calculate the delay for a specific retry attempt.
 *
 * @param attempt - The current attempt number (1-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateDelay(
  attempt: number,
  config: Partial<RetryConfig> = {}
): number {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  const baseDelay = cfg.initialDelayMs * Math.pow(cfg.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(baseDelay, cfg.maxDelayMs);
  return cfg.jitter ? addJitter(cappedDelay) : cappedDelay;
}

/**
 * Create a retry callback that logs progress.
 *
 * @param logger - Function to log messages (e.g., console.log or chalk wrapper)
 * @returns Retry callback function
 */
export function createRetryLogger(
  logger: (message: string) => void
): (attempt: number, delay: number, error: Error) => void {
  return (attempt: number, delay: number, error: Error) => {
    const delaySeconds = (delay / 1000).toFixed(1);
    const errorMessage = error.message.substring(0, 50);
    logger(`Attempt ${String(attempt)} failed: ${errorMessage}. Retrying in ${delaySeconds}s...`);
  };
}
