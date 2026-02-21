import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../errors/index.js";

/**
 * Validates the X-Azure-FDID header against the expected Azure Front Door ID.
 *
 * When AZURE_FRONT_DOOR_ID is set, requests must include a matching
 * X-Azure-FDID header or they will be rejected with 403.
 *
 * When AZURE_FRONT_DOOR_ID is not set (local dev), the check is skipped.
 *
 * Internal traffic from the web container (via nginx proxy) is allowed
 * by checking for the X-Real-IP header that nginx sets.
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

  // Skip validation for internal health checks (Container Apps probes)
  if (request.url === "/health") {
    return;
  }

  // Skip validation for public skill-packs routes (CLI access without Front Door)
  if (request.url.startsWith("/api/v1/skill-packs")) {
    return;
  }

  // Skip validation for public version route
  if (request.url.startsWith("/api/v1/version")) {
    return;
  }

  // Skip validation for API token authenticated requests (MCP servers, CLI tools)
  // These are programmatic clients that connect directly, not through Front Door
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer st_")) {
    return;
  }

  // Skip validation for internal container-to-container traffic
  // The web container's nginx proxy sets X-Real-IP header
  const realIp = request.headers["x-real-ip"] as string | undefined;
  if (realIp) {
    return;
  }

  const requestFrontDoorId = request.headers["x-azure-fdid"] as
    | string
    | undefined;

  if (!requestFrontDoorId || requestFrontDoorId !== expectedFrontDoorId) {
    throw new ForbiddenError("Access denied: invalid origin");
  }
}
