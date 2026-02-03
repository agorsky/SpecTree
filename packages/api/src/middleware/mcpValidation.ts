import type { FastifyRequest, FastifyReply } from "fastify";
import { ValidationError } from "../errors/index.js";

/**
 * MCP Validation Middleware
 *
 * Applies stricter validation rules to requests originating from the MCP server.
 * MCP requests are identified by the presence of the X-MCP-Request header.
 *
 * This ensures AI agents provide required execution metadata (executionOrder,
 * estimatedComplexity) when creating features and tasks, while maintaining
 * backward compatibility for REST API usage.
 */

/** Valid complexity values for validation */
const VALID_COMPLEXITY_VALUES = ["trivial", "simple", "moderate", "complex"] as const;

/**
 * MCP validation error response format
 */
interface McpValidationErrorDetail {
  error: "mcp_validation_failed";
  field: string;
  message: string;
  suggestion: string;
}

/**
 * Checks if the request originated from the MCP server
 */
export function isMcpRequest(request: FastifyRequest): boolean {
  const headerValue = request.headers["x-mcp-request"];
  return headerValue === "true" || headerValue === "1";
}

/**
 * Creates a validation error in the MCP-specific format
 */
function createMcpValidationError(detail: McpValidationErrorDetail): ValidationError {
  return new ValidationError(detail.message, {
    mcpValidation: detail,
  });
}

/**
 * Validates feature creation requests from MCP
 *
 * Required fields for MCP feature creation:
 * - executionOrder: positive integer indicating execution sequence
 * - estimatedComplexity: one of "trivial", "simple", "moderate", "complex"
 */
export function validateMcpFeatureCreation(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  if (!isMcpRequest(request)) {
    return; // Non-MCP requests skip strict validation
  }

  const body = request.body as Record<string, unknown> | undefined;

  if (!body) {
    return;
  }

  // Check executionOrder
  const executionOrder = body.executionOrder;
  if (executionOrder === undefined || executionOrder === null) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "executionOrder",
      message: "executionOrder is required for AI-created features",
      suggestion: "Add executionOrder: 1 (or appropriate sequence number based on feature order in the epic)",
    });
  }

  if (typeof executionOrder !== "number" || !Number.isInteger(executionOrder) || executionOrder < 1) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "executionOrder",
      message: "executionOrder must be a positive integer",
      suggestion: "Use executionOrder: 1, 2, 3, etc. to indicate feature execution sequence",
    });
  }

  // Check estimatedComplexity
  const estimatedComplexity = body.estimatedComplexity;
  if (estimatedComplexity === undefined || estimatedComplexity === null) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "estimatedComplexity",
      message: "estimatedComplexity is required for AI-created features",
      suggestion: `Add estimatedComplexity: one of "${VALID_COMPLEXITY_VALUES.join('", "')}"`,
    });
  }

  if (typeof estimatedComplexity !== "string" || !VALID_COMPLEXITY_VALUES.includes(estimatedComplexity as typeof VALID_COMPLEXITY_VALUES[number])) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "estimatedComplexity",
      message: `estimatedComplexity must be one of: ${VALID_COMPLEXITY_VALUES.join(", ")}`,
      suggestion: `Use estimatedComplexity: "simple" for small changes, "moderate" for typical features, "complex" for large features`,
    });
  }
}

/**
 * Validates task creation requests from MCP
 *
 * Required fields for MCP task creation:
 * - executionOrder: positive integer indicating execution sequence
 */
export function validateMcpTaskCreation(
  request: FastifyRequest,
  _reply: FastifyReply
): void {
  if (!isMcpRequest(request)) {
    return; // Non-MCP requests skip strict validation
  }

  const body = request.body as Record<string, unknown> | undefined;

  if (!body) {
    return;
  }

  // Check executionOrder
  const executionOrder = body.executionOrder;
  if (executionOrder === undefined || executionOrder === null) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "executionOrder",
      message: "executionOrder is required for AI-created tasks",
      suggestion: "Add executionOrder: 1 (or appropriate sequence number based on task order in the feature)",
    });
  }

  if (typeof executionOrder !== "number" || !Number.isInteger(executionOrder) || executionOrder < 1) {
    throw createMcpValidationError({
      error: "mcp_validation_failed",
      field: "executionOrder",
      message: "executionOrder must be a positive integer",
      suggestion: "Use executionOrder: 1, 2, 3, etc. to indicate task execution sequence",
    });
  }
}
