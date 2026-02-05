/**
 * Unit tests for retry logic module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withRetry,
  withRetryDetailed,
  isRetryable,
  isRateLimitError,
  calculateDelay,
  addJitter,
  sleep,
  createRetryLogger,
  DEFAULT_RETRY_CONFIG,
  RETRYABLE_ERROR_CODES,
  NON_RETRYABLE_ERROR_CODES,
  RATE_LIMIT_RETRY_CONFIG,
  READ_OPERATION_RETRY_CONFIG,
  type RetryConfig,
} from "../../src/utils/retry.js";
import {
  OrchestratorError,
  NetworkError,
  AuthError,
  SpecTreeAPIError,
  AgentError,
  ErrorCode,
} from "../../src/errors.js";

// =============================================================================
// Test Helpers
// =============================================================================

function createNetworkError(retryable: boolean, statusCode?: number): NetworkError {
  return new NetworkError("Network error", {
    retryable,
    statusCode,
    code: ErrorCode.NETWORK_CONNECTION_FAILED,
  });
}

function createServerError(statusCode: number): NetworkError {
  return NetworkError.serverError(statusCode, `Server error ${statusCode}`);
}

function createRateLimitError(): NetworkError {
  return new NetworkError("Rate limited", {
    code: ErrorCode.NETWORK_SERVER_ERROR,
    statusCode: 429,
    retryable: true,
  });
}

// =============================================================================
// isRetryable Tests
// =============================================================================

describe("isRetryable", () => {
  describe("AuthError", () => {
    it("should not retry AUTH_MISSING_TOKEN", () => {
      const error = AuthError.missingToken();
      expect(isRetryable(error)).toBe(false);
    });

    it("should not retry AUTH_INVALID_TOKEN", () => {
      const error = AuthError.invalidToken();
      expect(isRetryable(error)).toBe(false);
    });

    it("should not retry AUTH_EXPIRED_TOKEN", () => {
      const error = AuthError.expiredToken();
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("NetworkError", () => {
    it("should retry network errors marked as retryable", () => {
      const error = createNetworkError(true);
      expect(isRetryable(error)).toBe(true);
    });

    it("should not retry network errors marked as non-retryable", () => {
      const error = createNetworkError(false);
      expect(isRetryable(error)).toBe(false);
    });

    it("should retry connection failed errors", () => {
      const error = NetworkError.connectionFailed();
      expect(isRetryable(error)).toBe(true);
    });

    it("should retry timeout errors", () => {
      const error = NetworkError.timeout(5000);
      expect(isRetryable(error)).toBe(true);
    });

    it("should retry 5xx server errors", () => {
      const error = createServerError(500);
      expect(isRetryable(error)).toBe(true);
    });

    it("should retry 503 Service Unavailable", () => {
      const error = createServerError(503);
      expect(isRetryable(error)).toBe(true);
    });
  });

  describe("SpecTreeAPIError", () => {
    it("should not retry 404 Not Found", () => {
      const error = SpecTreeAPIError.notFound("/epics/123", "GET", "123");
      expect(isRetryable(error)).toBe(false);
    });

    it("should not retry 400 Validation Error", () => {
      const error = SpecTreeAPIError.validationError("/epics", "POST", ["Name required"]);
      expect(isRetryable(error)).toBe(false);
    });

    it("should retry 500 server errors via SpecTreeAPIError", () => {
      const error = new SpecTreeAPIError("Server error", "/epics", "GET", {
        statusCode: 500,
      });
      expect(isRetryable(error)).toBe(true);
    });

    it("should retry 429 rate limit errors", () => {
      const error = new SpecTreeAPIError("Rate limited", "/epics", "GET", {
        statusCode: 429,
      });
      expect(isRetryable(error)).toBe(true);
    });
  });

  describe("OrchestratorError", () => {
    it("should retry errors with codes in retryable list", () => {
      const error = new OrchestratorError(
        "Timeout",
        ErrorCode.NETWORK_TIMEOUT
      );
      expect(isRetryable(error)).toBe(true);
    });

    it("should not retry errors with codes in non-retryable list", () => {
      const error = new OrchestratorError(
        "Invalid config",
        ErrorCode.CONFIG_INVALID
      );
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("AgentError", () => {
    it("should retry AGENT_TIMEOUT errors", () => {
      const error = AgentError.timeout("agent-1", "task-1", 60000);
      expect(isRetryable(error)).toBe(true);
    });

    it("should not retry AGENT_SPAWN_FAILED errors", () => {
      const error = AgentError.spawnFailed("agent-1", "task-1");
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("unknown errors", () => {
    it("should not retry unknown Error instances", () => {
      const error = new Error("Unknown error");
      expect(isRetryable(error)).toBe(false);
    });

    it("should not retry non-Error values", () => {
      expect(isRetryable("string error")).toBe(false);
      expect(isRetryable(123)).toBe(false);
      expect(isRetryable(null)).toBe(false);
      expect(isRetryable(undefined)).toBe(false);
    });
  });
});

// =============================================================================
// isRateLimitError Tests
// =============================================================================

describe("isRateLimitError", () => {
  it("should identify NetworkError with 429 status", () => {
    const error = createRateLimitError();
    expect(isRateLimitError(error)).toBe(true);
  });

  it("should identify SpecTreeAPIError with 429 status", () => {
    const error = new SpecTreeAPIError("Rate limited", "/epics", "GET", {
      statusCode: 429,
    });
    expect(isRateLimitError(error)).toBe(true);
  });

  it("should not identify other errors as rate limit", () => {
    expect(isRateLimitError(createServerError(500))).toBe(false);
    expect(isRateLimitError(AuthError.invalidToken())).toBe(false);
    expect(isRateLimitError(new Error("test"))).toBe(false);
  });
});

// =============================================================================
// withRetry Tests
// =============================================================================

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const resultPromise = withRetry(fn, { jitter: false });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry retryable errors and succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(NetworkError.connectionFailed())
      .mockRejectedValueOnce(NetworkError.timeout(5000))
      .mockResolvedValue("success");

    const resultPromise = withRetry(fn, { jitter: false });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw non-retryable errors immediately", async () => {
    const authError = AuthError.invalidToken();
    const fn = vi.fn().mockRejectedValue(authError);

    await expect(withRetry(fn, { jitter: false })).rejects.toThrow(AuthError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should throw after max retries exceeded", async () => {
    const error = NetworkError.connectionFailed();
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, { maxRetries: 2, jitter: false });

    // Catch the expected rejection to prevent unhandled rejection warning
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(NetworkError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("should use exponential backoff", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(NetworkError.connectionFailed())
      .mockRejectedValueOnce(NetworkError.connectionFailed())
      .mockResolvedValue("success");

    const config = {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      jitter: false,
    };

    const resultPromise = withRetry(fn, config);

    // First call fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for first delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait for second delay (2000ms)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await resultPromise;
    expect(result).toBe("success");
  });

  it("should call onRetry callback", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(NetworkError.connectionFailed())
      .mockResolvedValue("success");

    const resultPromise = withRetry(fn, { onRetry, jitter: false });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      1,
      1000,
      expect.any(NetworkError)
    );
  });

  it("should respect maxDelayMs cap", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(NetworkError.connectionFailed());

    const config = {
      maxRetries: 5,
      initialDelayMs: 10000,
      maxDelayMs: 15000,
      backoffMultiplier: 2,
      jitter: false,
      onRetry,
    };

    const promise = withRetry(fn, config);

    // Catch the expected rejection to prevent unhandled rejection warning
    promise.catch(() => {});

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(NetworkError);

    // Verify delays are capped at maxDelayMs
    const delays = onRetry.mock.calls.map((call) => call[1]);
    expect(delays[0]).toBe(10000); // Initial delay
    expect(delays[1]).toBe(15000); // 20000 capped to 15000
    expect(delays[2]).toBe(15000); // Still capped
  });
});

// =============================================================================
// withRetryDetailed Tests
// =============================================================================

describe("withRetryDetailed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return result with metadata on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const resultPromise = withRetryDetailed(fn, { jitter: false });
    await vi.runAllTimersAsync();
    const { result, attempts, totalTimeMs } = await resultPromise;

    expect(result).toBe("success");
    expect(attempts).toBe(1);
    expect(totalTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("should return correct attempt count after retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(NetworkError.connectionFailed())
      .mockRejectedValueOnce(NetworkError.timeout(5000))
      .mockResolvedValue("success");

    const resultPromise = withRetryDetailed(fn, { jitter: false });
    await vi.runAllTimersAsync();
    const { result, attempts } = await resultPromise;

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve after specified time", async () => {
    const promise = sleep(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe("addJitter", () => {
  it("should return a value within ±25% of input", () => {
    const baseDelay = 1000;
    const minExpected = 750; // 1000 * 0.75
    const maxExpected = 1250; // 1000 * 1.25

    // Test multiple times since jitter is random
    for (let i = 0; i < 100; i++) {
      const result = addJitter(baseDelay);
      expect(result).toBeGreaterThanOrEqual(minExpected);
      expect(result).toBeLessThanOrEqual(maxExpected);
    }
  });

  it("should return integer values", () => {
    const result = addJitter(1000);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("calculateDelay", () => {
  it("should calculate exponential backoff correctly", () => {
    const config = {
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      jitter: false,
    };

    expect(calculateDelay(1, config)).toBe(1000);
    expect(calculateDelay(2, config)).toBe(2000);
    expect(calculateDelay(3, config)).toBe(4000);
    expect(calculateDelay(4, config)).toBe(8000);
  });

  it("should respect maxDelayMs cap", () => {
    const config = {
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 5000,
      jitter: false,
    };

    expect(calculateDelay(5, config)).toBe(5000); // 16000 capped to 5000
    expect(calculateDelay(10, config)).toBe(5000);
  });
});

describe("createRetryLogger", () => {
  it("should create a logger that logs retry attempts", () => {
    const messages: string[] = [];
    const logger = createRetryLogger((msg) => messages.push(msg));
    const error = new Error("Connection failed");

    logger(1, 1000, error);
    logger(2, 2000, error);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("Attempt 1");
    expect(messages[0]).toContain("1.0s");
    expect(messages[0]).toContain("Connection failed");
    expect(messages[1]).toContain("Attempt 2");
    expect(messages[1]).toContain("2.0s");
  });

  it("should truncate long error messages", () => {
    const messages: string[] = [];
    const logger = createRetryLogger((msg) => messages.push(msg));
    const longMessage = "A".repeat(100);
    const error = new Error(longMessage);

    logger(1, 1000, error);

    expect(messages[0].length).toBeLessThan(200); // Message should be truncated
  });
});

// =============================================================================
// Configuration Tests
// =============================================================================

describe("configurations", () => {
  it("should have valid DEFAULT_RETRY_CONFIG", () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    expect(DEFAULT_RETRY_CONFIG.jitter).toBe(true);
    expect(DEFAULT_RETRY_CONFIG.retryableErrorCodes).toBe(RETRYABLE_ERROR_CODES);
  });

  it("should have valid RATE_LIMIT_RETRY_CONFIG", () => {
    expect(RATE_LIMIT_RETRY_CONFIG.maxRetries).toBe(5);
    expect(RATE_LIMIT_RETRY_CONFIG.initialDelayMs).toBe(5000);
    expect(RATE_LIMIT_RETRY_CONFIG.maxDelayMs).toBe(60000);
  });

  it("should have valid READ_OPERATION_RETRY_CONFIG", () => {
    expect(READ_OPERATION_RETRY_CONFIG.maxRetries).toBe(5);
    expect(READ_OPERATION_RETRY_CONFIG.initialDelayMs).toBe(500);
    expect(READ_OPERATION_RETRY_CONFIG.maxDelayMs).toBe(15000);
  });

  it("should have non-overlapping retryable and non-retryable codes", () => {
    for (const code of RETRYABLE_ERROR_CODES) {
      expect(NON_RETRYABLE_ERROR_CODES).not.toContain(code);
    }
    for (const code of NON_RETRYABLE_ERROR_CODES) {
      expect(RETRYABLE_ERROR_CODES).not.toContain(code);
    }
  });
});
