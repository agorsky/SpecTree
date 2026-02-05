/**
 * Unit tests for Error Types Module
 */

import { describe, it, expect } from "vitest";
import {
  // Error classes
  OrchestratorError,
  AuthError,
  NetworkError,
  AgentError,
  MergeConflictError,
  SpecTreeAPIError,
  ConfigError,
  // Error codes
  ErrorCode,
  // Type guards
  isOrchestratorError,
  isAuthError,
  isNetworkError,
  isAgentError,
  isMergeConflictError,
  isSpecTreeAPIError,
  isConfigError,
  isRetryableError,
  // Utilities
  wrapError,
  serializeError,
} from "../src/errors.js";

describe("OrchestratorError", () => {
  it("creates error with all properties", () => {
    const error = new OrchestratorError("Test error", ErrorCode.UNKNOWN_ERROR, {
      context: { foo: "bar" },
      recoveryHint: "Try again",
    });

    expect(error.message).toBe("Test error");
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.context).toEqual({ foo: "bar" });
    expect(error.recoveryHint).toBe("Try again");
    expect(error.name).toBe("OrchestratorError");
  });

  it("is instanceof Error", () => {
    const error = new OrchestratorError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OrchestratorError);
  });

  it("toJSON() returns serializable object", () => {
    const error = new OrchestratorError("Test error", ErrorCode.UNKNOWN_ERROR, {
      context: { key: "value" },
      recoveryHint: "Hint",
    });

    const json = error.toJSON();
    expect(json.name).toBe("OrchestratorError");
    expect(json.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(json.message).toBe("Test error");
    expect(json.context).toEqual({ key: "value" });
    expect(json.recoveryHint).toBe("Hint");
    expect(typeof json.stack).toBe("string");

    // Ensure it's actually JSON-serializable
    expect(() => JSON.stringify(json)).not.toThrow();
  });

  it("toFormattedString() formats correctly", () => {
    const error = new OrchestratorError("Test error", ErrorCode.UNKNOWN_ERROR, {
      recoveryHint: "Try again",
    });

    const formatted = error.toFormattedString();
    expect(formatted).toContain("[UNKNOWN_ERROR]");
    expect(formatted).toContain("Test error");
    expect(formatted).toContain("Hint: Try again");
  });

  it("supports error cause", () => {
    const cause = new Error("Original error");
    const error = new OrchestratorError("Wrapper", ErrorCode.UNKNOWN_ERROR, { cause });

    expect(error.cause).toBe(cause);
  });
});

describe("AuthError", () => {
  it("has correct default recovery hint", () => {
    const error = new AuthError("No token", ErrorCode.AUTH_MISSING_TOKEN);
    expect(error.recoveryHint).toBe("Run 'spectree-agent auth' to authenticate");
  });

  it("static factory methods work", () => {
    const missing = AuthError.missingToken();
    expect(missing.code).toBe(ErrorCode.AUTH_MISSING_TOKEN);
    expect(missing.message).toBe("No authentication token found");

    const invalid = AuthError.invalidToken();
    expect(invalid.code).toBe(ErrorCode.AUTH_INVALID_TOKEN);

    const expired = AuthError.expiredToken();
    expect(expired.code).toBe(ErrorCode.AUTH_EXPIRED_TOKEN);
  });

  it("instanceof checks work correctly", () => {
    const error = AuthError.missingToken();
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OrchestratorError);
    expect(error).toBeInstanceOf(AuthError);
  });
});

describe("NetworkError", () => {
  it("includes statusCode and retryable flag", () => {
    const error = new NetworkError("Server error", {
      statusCode: 503,
      retryable: true,
    });

    expect(error.statusCode).toBe(503);
    expect(error.retryable).toBe(true);
  });

  it("toJSON() includes extra properties", () => {
    const error = new NetworkError("Failed", { statusCode: 500, retryable: true });
    const json = error.toJSON();

    expect(json.statusCode).toBe(500);
    expect(json.retryable).toBe(true);
  });

  it("static factory methods work", () => {
    const connection = NetworkError.connectionFailed();
    expect(connection.code).toBe(ErrorCode.NETWORK_CONNECTION_FAILED);
    expect(connection.retryable).toBe(true);

    const timeout = NetworkError.timeout(5000);
    expect(timeout.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(timeout.message).toContain("5000ms");

    const serverError = NetworkError.serverError(503);
    expect(serverError.statusCode).toBe(503);
    expect(serverError.retryable).toBe(true);

    const clientError = NetworkError.serverError(400, "Bad request");
    expect(clientError.retryable).toBe(false);
  });
});

describe("AgentError", () => {
  it("includes agentId and taskId", () => {
    const error = new AgentError("Failed", "agent-123", "task-456");

    expect(error.agentId).toBe("agent-123");
    expect(error.taskId).toBe("task-456");
  });

  it("toJSON() includes extra properties", () => {
    const error = new AgentError("Failed", "agent-1", "task-2");
    const json = error.toJSON();

    expect(json.agentId).toBe("agent-1");
    expect(json.taskId).toBe("task-2");
  });

  it("static factory methods work", () => {
    const spawn = AgentError.spawnFailed("a1", "t1");
    expect(spawn.code).toBe(ErrorCode.AGENT_SPAWN_FAILED);

    const execution = AgentError.executionFailed("a1", "t1", "test failure");
    expect(execution.code).toBe(ErrorCode.AGENT_EXECUTION_FAILED);
    expect(execution.message).toContain("test failure");

    const timeout = AgentError.timeout("a1", "t1", 30000);
    expect(timeout.code).toBe(ErrorCode.AGENT_TIMEOUT);
    expect(timeout.recoveryHint).toContain("smaller subtasks");
  });
});

describe("MergeConflictError", () => {
  it("includes conflict details", () => {
    const error = new MergeConflictError(
      ["file1.ts", "file2.ts"],
      "feature-branch",
      "main"
    );

    expect(error.conflictingFiles).toEqual(["file1.ts", "file2.ts"]);
    expect(error.sourceBranch).toBe("feature-branch");
    expect(error.targetBranch).toBe("main");
    expect(error.code).toBe(ErrorCode.MERGE_CONFLICT);
  });

  it("recovery hint lists conflicting files", () => {
    const error = new MergeConflictError(["a.ts", "b.ts"], "src", "dest");
    expect(error.recoveryHint).toContain("a.ts");
    expect(error.recoveryHint).toContain("b.ts");
  });

  it("toJSON() includes extra properties", () => {
    const error = new MergeConflictError(["x.ts"], "s", "t");
    const json = error.toJSON();

    expect(json.conflictingFiles).toEqual(["x.ts"]);
    expect(json.sourceBranch).toBe("s");
    expect(json.targetBranch).toBe("t");
  });
});

describe("SpecTreeAPIError", () => {
  it("includes endpoint and method", () => {
    const error = new SpecTreeAPIError(
      "Not found",
      "/api/epics/123",
      "GET",
      { statusCode: 404 }
    );

    expect(error.endpoint).toBe("/api/epics/123");
    expect(error.method).toBe("GET");
    expect(error.statusCode).toBe(404);
  });

  it("static factory methods work", () => {
    const notFound = SpecTreeAPIError.notFound("/api/tasks", "GET", "task-123");
    expect(notFound.code).toBe(ErrorCode.SPECTREE_NOT_FOUND);
    expect(notFound.statusCode).toBe(404);

    const validation = SpecTreeAPIError.validationError(
      "/api/epics",
      "POST",
      ["name required", "team required"]
    );
    expect(validation.code).toBe(ErrorCode.SPECTREE_VALIDATION_ERROR);
    expect(validation.message).toContain("name required");
  });
});

describe("ConfigError", () => {
  it("static factory methods work", () => {
    const missing = ConfigError.missing("apiToken");
    expect(missing.code).toBe(ErrorCode.CONFIG_MISSING);
    expect(missing.message).toContain("apiToken");

    const invalid = ConfigError.invalid("maxAgents", "abc", "number");
    expect(invalid.code).toBe(ErrorCode.CONFIG_INVALID);
    expect(invalid.message).toContain("maxAgents");
    expect(invalid.message).toContain("number");
  });
});

describe("Type Guards", () => {
  it("isOrchestratorError()", () => {
    expect(isOrchestratorError(new OrchestratorError("test"))).toBe(true);
    expect(isOrchestratorError(new AuthError("test"))).toBe(true);
    expect(isOrchestratorError(new Error("test"))).toBe(false);
    expect(isOrchestratorError("string")).toBe(false);
    expect(isOrchestratorError(null)).toBe(false);
  });

  it("isAuthError()", () => {
    expect(isAuthError(AuthError.missingToken())).toBe(true);
    expect(isAuthError(new OrchestratorError("test"))).toBe(false);
    expect(isAuthError(new Error("test"))).toBe(false);
  });

  it("isNetworkError()", () => {
    expect(isNetworkError(NetworkError.connectionFailed())).toBe(true);
    expect(isNetworkError(new OrchestratorError("test"))).toBe(false);
  });

  it("isAgentError()", () => {
    expect(isAgentError(new AgentError("test", "a", "t"))).toBe(true);
    expect(isAgentError(new OrchestratorError("test"))).toBe(false);
  });

  it("isMergeConflictError()", () => {
    expect(isMergeConflictError(new MergeConflictError([], "a", "b"))).toBe(true);
    expect(isMergeConflictError(new OrchestratorError("test"))).toBe(false);
  });

  it("isSpecTreeAPIError()", () => {
    expect(isSpecTreeAPIError(new SpecTreeAPIError("test", "/api", "GET"))).toBe(true);
    expect(isSpecTreeAPIError(new OrchestratorError("test"))).toBe(false);
  });

  it("isConfigError()", () => {
    expect(isConfigError(ConfigError.missing("key"))).toBe(true);
    expect(isConfigError(new OrchestratorError("test"))).toBe(false);
  });

  it("isRetryableError()", () => {
    expect(isRetryableError(NetworkError.connectionFailed())).toBe(true);
    expect(isRetryableError(NetworkError.serverError(500))).toBe(true);
    expect(isRetryableError(NetworkError.serverError(400))).toBe(false);
    expect(isRetryableError(AgentError.timeout("a", "t", 1000))).toBe(true);
    expect(isRetryableError(AuthError.missingToken())).toBe(false);
    expect(isRetryableError(new Error("test"))).toBe(false);
  });
});

describe("Utility Functions", () => {
  describe("wrapError()", () => {
    it("returns OrchestratorError unchanged", () => {
      const original = new OrchestratorError("test");
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it("wraps standard Error", () => {
      const original = new Error("standard error");
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(OrchestratorError);
      expect(wrapped.message).toBe("standard error");
      expect(wrapped.cause).toBe(original);
    });

    it("wraps string", () => {
      const wrapped = wrapError("string error");
      expect(wrapped.message).toBe("string error");
    });

    it("uses default message for unknown types", () => {
      const wrapped = wrapError(null, "Default message");
      expect(wrapped.message).toBe("Default message");
    });
  });

  describe("serializeError()", () => {
    it("serializes OrchestratorError", () => {
      const error = new OrchestratorError("test", ErrorCode.UNKNOWN_ERROR, {
        context: { key: "value" },
      });
      const serialized = serializeError(error);

      expect(serialized.name).toBe("OrchestratorError");
      expect(serialized.message).toBe("test");
      expect(serialized.context).toEqual({ key: "value" });
    });

    it("serializes standard Error", () => {
      const error = new Error("standard");
      const serialized = serializeError(error);

      expect(serialized.name).toBe("Error");
      expect(serialized.message).toBe("standard");
      expect(serialized.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });

    it("serializes unknown types", () => {
      const serialized = serializeError("just a string");
      expect(serialized.message).toBe("just a string");
      expect(serialized.name).toBe("UnknownError");
    });

    it("result is JSON-serializable", () => {
      const error = new MergeConflictError(["a.ts"], "src", "dest");
      const serialized = serializeError(error);

      expect(() => JSON.stringify(serialized)).not.toThrow();
      const parsed = JSON.parse(JSON.stringify(serialized));
      expect(parsed.conflictingFiles).toEqual(["a.ts"]);
    });
  });
});
