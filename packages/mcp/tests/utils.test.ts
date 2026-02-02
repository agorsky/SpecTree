/**
 * Tests for shared MCP tool utilities
 */

import { describe, it, expect } from "vitest";
import { createResponse, createErrorResponse } from "../src/tools/utils.js";
import { ApiError } from "../src/api-client.js";

describe("createResponse", () => {
  it("should format data as JSON string", () => {
    const data = { id: "123", name: "Test" };
    const result = createResponse(data);

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    });
  });

  it("should handle arrays", () => {
    const data = [{ id: "1" }, { id: "2" }];
    const result = createResponse(data);

    expect(result.content[0].text).toContain('"id": "1"');
    expect(result.content[0].text).toContain('"id": "2"');
  });
});

describe("createErrorResponse", () => {
  it("should extract message from standard Error", () => {
    const error = new Error("Something went wrong");
    const result = createErrorResponse(error);

    expect(result).toEqual({
      content: [{ type: "text", text: "Error: Something went wrong" }],
      isError: true,
    });
  });

  it("should extract message from ApiError with body.message", () => {
    const error = new ApiError(403, { message: "Access denied: not a member of this team" }, "HTTP 403");
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Access denied: not a member of this team");
    expect(result.isError).toBe(true);
  });

  it("should extract message from ApiError with nested body.error.message", () => {
    const error = new ApiError(
      403,
      { error: { message: "Access denied: not a member of this team", code: "FORBIDDEN" } },
      "HTTP 403"
    );
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Access denied: not a member of this team");
    expect(result.isError).toBe(true);
  });

  it("should fall back to ApiError.message when no body message", () => {
    const error = new ApiError(500, {}, "Internal Server Error");
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Internal Server Error");
    expect(result.isError).toBe(true);
  });

  it("should provide helpful message for 401 without body", () => {
    const error = new ApiError(401, {}, "HTTP 401");
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Authentication failed. Check that API_TOKEN is valid.");
    expect(result.isError).toBe(true);
  });

  it("should provide helpful message for 403 without body", () => {
    const error = new ApiError(403, {}, "HTTP 403");
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Access denied. You may not have permission for this team/resource.");
    expect(result.isError).toBe(true);
  });

  it("should provide helpful message for 404 without body", () => {
    const error = new ApiError(404, {}, "HTTP 404");
    const result = createErrorResponse(error);

    expect(result.content[0].text).toBe("Error: Resource not found.");
    expect(result.isError).toBe(true);
  });

  it("should handle string error", () => {
    const result = createErrorResponse("Something failed");

    expect(result.content[0].text).toBe("Error: Something failed");
    expect(result.isError).toBe(true);
  });

  it("should handle null/undefined gracefully", () => {
    const resultNull = createErrorResponse(null);
    const resultUndefined = createErrorResponse(undefined);

    expect(resultNull.content[0].text).toBe("Error: null");
    expect(resultUndefined.content[0].text).toBe("Error: undefined");
  });
});
