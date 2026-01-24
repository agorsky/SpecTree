import type { z } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";
import { ValidationError } from "../errors/index.js";

/**
 * Validation error detail structure
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Creates a preValidation hook that validates the request body against a Zod schema.
 * On success, replaces request.body with the parsed (and potentially transformed) data.
 * On failure, throws a ValidationError with detailed error information.
 *
 * @param schema - The Zod schema to validate against
 * @returns A Fastify preValidation hook handler
 *
 * @example
 * fastify.post<{ Body: CreateTeamInput }>(
 *   "/",
 *   { preValidation: [validateBody(createTeamSchema)] },
 *   async (request, reply) => { ... }
 * );
 */
export function validateBody(
  schema: z.ZodType
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const errors: ValidationErrorDetail[] = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationError("Validation failed", { errors });
    }
    // Replace body with parsed data (includes transformations and defaults)
    request.body = result.data as typeof request.body;
  };
}

/**
 * Creates a preValidation hook that validates route parameters against a Zod schema.
 * On success, replaces request.params with the parsed data.
 * On failure, throws a ValidationError with detailed error information.
 *
 * @param schema - The Zod schema to validate against
 * @returns A Fastify preValidation hook handler
 *
 * @example
 * fastify.get<{ Params: UuidParam }>(
 *   "/:id",
 *   { preValidation: [validateParams(uuidParamSchema)] },
 *   async (request, reply) => { ... }
 * );
 */
export function validateParams(
  schema: z.ZodType
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      const errors: ValidationErrorDetail[] = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationError("Invalid parameters", { errors });
    }
    // Replace params with parsed data
    request.params = result.data as typeof request.params;
  };
}

/**
 * Creates a preValidation hook that validates query string parameters against a Zod schema.
 * On success, replaces request.query with the parsed (and coerced) data.
 * On failure, throws a ValidationError with detailed error information.
 *
 * Note: Use z.coerce for numeric query parameters since they arrive as strings.
 *
 * @param schema - The Zod schema to validate against
 * @returns A Fastify preValidation hook handler
 *
 * @example
 * fastify.get<{ Querystring: PaginationQuery }>(
 *   "/",
 *   { preValidation: [validateQuery(paginationQuerySchema)] },
 *   async (request, reply) => { ... }
 * );
 */
export function validateQuery(
  schema: z.ZodType
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      const errors: ValidationErrorDetail[] = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      throw new ValidationError("Invalid query parameters", { errors });
    }
    // Replace query with parsed data (includes coercions)
    request.query = result.data as typeof request.query;
  };
}
