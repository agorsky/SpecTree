/**
 * Shared utilities for MCP tools
 */

import { ApiError } from "../api-client.js";

/**
 * Create MCP-compliant success response
 */
export function createResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Extract the best error message from various error types
 */
function extractErrorMessage(error: unknown): string {
  // Handle ApiError with rich body information
  if (error instanceof ApiError) {
    // Try to extract detailed message from response body
    if (error.body && typeof error.body === "object") {
      const body = error.body as Record<string, unknown>;
      
      // API returns { error: { message: "..." } } or { message: "..." }
      if (body.error && typeof body.error === "object") {
        const errorObj = body.error as Record<string, unknown>;
        if (typeof errorObj.message === "string") {
          return errorObj.message;
        }
      }
      
      if (typeof body.message === "string") {
        return body.message;
      }
    }
    
    // Fall back to ApiError message (which is usually just "HTTP 403")
    return error.message;
  }
  
  // Standard Error
  if (error instanceof Error) {
    return error.message;
  }
  
  // Unknown error type
  return String(error);
}

/**
 * Create MCP error response with improved error extraction
 * 
 * This handles ApiError specially to extract the actual error message
 * from the API response body (e.g., "Access denied: not a member of this team")
 * instead of just showing "HTTP 403".
 */
export function createErrorResponse(error: unknown) {
  const message = extractErrorMessage(error);
  
  // Add helpful context for common error codes
  let enhancedMessage = message;
  
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        if (message === `HTTP ${String(error.status)}`) {
          enhancedMessage = "Authentication failed. Check that API_TOKEN is valid.";
        }
        break;
      case 403:
        if (message === `HTTP ${String(error.status)}`) {
          enhancedMessage = "Access denied. You may not have permission for this team/resource.";
        }
        break;
      case 404:
        if (message === `HTTP ${String(error.status)}`) {
          enhancedMessage = "Resource not found.";
        }
        break;
    }
  }
  
  return {
    content: [{ type: "text" as const, text: `Error: ${enhancedMessage}` }],
    isError: true,
  };
}
