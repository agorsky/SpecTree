/**
 * Fastify error handler for consistent API error responses.
 * Provides structured error output and appropriate logging.
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/index.js";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Determines if the current environment is production
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Maps Fastify validation errors to a structured format
 */
function formatValidationDetails(error: FastifyError): Record<string, unknown> | undefined {
  if (error.validation && error.validation.length > 0) {
    return {
      validation: error.validation.map((v) => ({
        field: v.instancePath || v.params?.missingProperty || "unknown",
        message: v.message,
      })),
    };
  }
  return undefined;
}

/**
 * Registers the error handler on a Fastify instance.
 * Should be called early in the server setup.
 */
export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      // Log error with stack trace in development
      if (!isProduction()) {
        request.log.error({
          err: error,
          stack: error.stack,
          url: request.url,
          method: request.method,
        });
      } else {
        // In production, log without exposing stack traces externally
        request.log.error({
          err: {
            message: error.message,
            code: error instanceof AppError ? error.code : error.code,
            statusCode: error instanceof AppError ? error.statusCode : error.statusCode,
          },
          url: request.url,
          method: request.method,
        });
      }

      let response: ErrorResponse;
      let statusCode: number;

      // Handle our custom AppError instances
      if (error instanceof AppError) {
        statusCode = error.statusCode;
        response = {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details && { details: error.details }),
          },
        };
      }
      // Handle Fastify validation errors (from JSON Schema validation)
      else if (error.validation) {
        statusCode = 400;
        const validationDetails = formatValidationDetails(error);
        response = {
          error: {
            code: "VALIDATION_ERROR",
            message: error.message,
            ...(validationDetails && { details: validationDetails }),
          },
        };
      }
      // Handle other Fastify errors with statusCode
      else if (error.statusCode) {
        statusCode = error.statusCode;
        response = {
          error: {
            code: getErrorCodeFromStatusCode(error.statusCode),
            message: error.message,
          },
        };
      }
      // Handle unexpected errors
      else {
        statusCode = 500;
        response = {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: isProduction()
              ? "An unexpected error occurred"
              : error.message || "An unexpected error occurred",
          },
        };
      }

      return reply.status(statusCode).send(response);
    }
  );
}

/**
 * Maps HTTP status codes to error codes
 */
function getErrorCodeFromStatusCode(statusCode: number): string {
  const codeMap: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
  };

  return codeMap[statusCode] ?? "UNKNOWN_ERROR";
}
