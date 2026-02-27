/**
 * Tests verifying admin routes are not registered.
 *
 * Admin routes (/api/v1/admin/invitations, /api/v1/admin/users)
 * have been removed from the application. These tests ensure
 * those endpoints return 404.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import { disconnectTestDatabase } from "../fixtures/index.js";

describe("Admin routes removed", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDatabase();
  });

  describe("GET /api/v1/admin/invitations", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/admin/invitations", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        payload: { email: "test@example.com" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/invitations/:id", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/invitations/some-id",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/invitations/:id", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/invitations/some-id",
        payload: { status: "expired" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/admin/users", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/users",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/users/:id", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/users/some-id",
        payload: { isActive: false },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/users/:id", () => {
    it("should return 404", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/users/some-id",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
