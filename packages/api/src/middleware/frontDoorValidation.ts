import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../errors/index.js";

/**
 * Validates the X-Azure-FDID header against the expected Azure Front Door ID.
 *
 * When AZURE_FRONT_DOOR_ID is set, requests must include a matching
 * X-Azure-FDID header or they will be rejected with 403.
 *
 * When AZURE_FRONT_DOOR_ID is not set (local dev), the check is skipped.
 */
export async function frontDoorValidation(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const expectedFrontDoorId = process.env.AZURE_FRONT_DOOR_ID;

  // Skip validation if Front Door ID is not configured (local dev)
  if (!expectedFrontDoorId) {
    return;
  }

  const requestFrontDoorId = request.headers["x-azure-fdid"] as
    | string
    | undefined;

  if (!requestFrontDoorId || requestFrontDoorId !== expectedFrontDoorId) {
    throw new ForbiddenError("Access denied: invalid origin");
  }
}
