/**
 * Custom error classes for consistent API error handling.
 * All errors extend AppError and provide structured error information.
 */

export interface ErrorDetails {
  [key: string]: unknown;
}

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetails | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input or validation failure
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

/**
 * 401 Unauthorized - Authentication required or invalid credentials
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: ErrorDetails) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized for this action
 */
export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: ErrorDetails) {
    super(message, 403, "FORBIDDEN", details);
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 404, "NOT_FOUND", details);
  }
}

/**
 * 409 Conflict - Resource conflict (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 409, "CONFLICT", details);
  }
}
