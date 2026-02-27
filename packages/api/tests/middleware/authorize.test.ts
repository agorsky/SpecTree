import { describe, it, expect } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  requireTeamAccess,
  requireRole,
  PERSONAL_SCOPE_MARKER,
} from "../../src/middleware/authorize.js";
import { ForbiddenError } from "../../src/errors/index.js";

function createMockRequest(
  user: { id: string } | null,
  params: Record<string, string> = {},
  body?: Record<string, unknown>
): FastifyRequest {
  return {
    user: user ?? undefined,
    params,
    body,
  } as unknown as FastifyRequest;
}

const mockReply = {} as FastifyReply;

describe("authorize middleware (single-user pass-through)", () => {
  describe("PERSONAL_SCOPE_MARKER", () => {
    it("should be exported with expected value", () => {
      expect(PERSONAL_SCOPE_MARKER).toBe("__personal_scope__");
    });
  });

  describe("requireTeamAccess", () => {
    it("should throw ForbiddenError when user is not authenticated", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest(null, { teamId: "team-1" });

      await expect(middleware(request, mockReply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, mockReply)).rejects.toThrow(
        "User not authenticated"
      );
    });

    it("should pass through for authenticated user", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, { teamId: "team-1" });

      await expect(middleware(request, mockReply)).resolves.toBeUndefined();
    });

    it("should set teamId on request from params", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, { teamId: "team-1" });

      await middleware(request, mockReply);

      expect(request.teamId).toBe("team-1");
    });

    it("should set teamId on request from body", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, {}, { teamId: "team-1" });

      await middleware(request, mockReply);

      expect(request.teamId).toBe("team-1");
    });

    it("should support mapping syntax (paramName:resourceType)", async () => {
      const middleware = requireTeamAccess("id:epicId");
      const request = createMockRequest({ id: "user-1" }, { id: "epic-1" });

      await middleware(request, mockReply);

      expect(request.teamId).toBe("epic-1");
    });

    it("should support body. prefix syntax", async () => {
      const middleware = requireTeamAccess("body.team");
      const request = createMockRequest({ id: "user-1" }, {}, { team: "team-1" });

      await middleware(request, mockReply);

      expect(request.teamId).toBe("team-1");
    });

    it("should populate userTeams as empty array if not set", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, { teamId: "team-1" });

      await middleware(request, mockReply);

      expect(request.userTeams).toEqual([]);
    });

    it("should preserve existing userTeams if already set", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, { teamId: "team-1" });
      const existingTeams = [{ teamId: "team-1", role: "admin" as const }];
      request.userTeams = existingTeams;

      await middleware(request, mockReply);

      expect(request.userTeams).toBe(existingTeams);
    });

    it("should not throw when resource ID is missing", async () => {
      const middleware = requireTeamAccess("teamId");
      const request = createMockRequest({ id: "user-1" }, {});

      await expect(middleware(request, mockReply)).resolves.toBeUndefined();
    });
  });

  describe("requireRole", () => {
    it("should throw ForbiddenError when user is not authenticated", async () => {
      const middleware = requireRole("admin");
      const request = createMockRequest(null);

      await expect(middleware(request, mockReply)).rejects.toThrow(ForbiddenError);
      await expect(middleware(request, mockReply)).rejects.toThrow(
        "User not authenticated"
      );
    });

    it("should pass through for authenticated user regardless of role", async () => {
      const middleware = requireRole("admin");
      const request = createMockRequest({ id: "user-1" });

      await expect(middleware(request, mockReply)).resolves.toBeUndefined();
    });

    it("should accept multiple roles without error", async () => {
      const middleware = requireRole("admin", "member");
      const request = createMockRequest({ id: "user-1" });

      await expect(middleware(request, mockReply)).resolves.toBeUndefined();
    });

    it("should accept guest role without error", async () => {
      const middleware = requireRole("guest");
      const request = createMockRequest({ id: "user-1" });

      await expect(middleware(request, mockReply)).resolves.toBeUndefined();
    });
  });
});
