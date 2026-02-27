import { describe, it, expect } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import { requireGlobalAdmin } from "../../src/middleware/globalAdmin.js";

const mockReply = {} as FastifyReply;

function createMockRequest(user: { id: string } | null): FastifyRequest {
  return {
    user: user ?? undefined,
  } as unknown as FastifyRequest;
}

describe("requireGlobalAdmin middleware (single-user pass-through)", () => {
  it("should resolve without error for any request", async () => {
    const request = createMockRequest({ id: "user-1" });
    await expect(requireGlobalAdmin(request, mockReply)).resolves.toBeUndefined();
  });

  it("should resolve without error even when user is not a global admin", async () => {
    const request = createMockRequest({ id: "user-2" });
    (request as Record<string, unknown>).user = { id: "user-2", isGlobalAdmin: false };
    await expect(requireGlobalAdmin(request, mockReply)).resolves.toBeUndefined();
  });

  it("should resolve without error when user is null", async () => {
    const request = createMockRequest(null);
    await expect(requireGlobalAdmin(request, mockReply)).resolves.toBeUndefined();
  });
});
