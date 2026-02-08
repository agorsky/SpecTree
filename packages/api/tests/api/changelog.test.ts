/**
 * Integration Tests for Changelog API Endpoints
 *
 * Tests querying changelog entries with authentication, validation, and pagination.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestEpic,
  createTestFeature,
  createTestTask,
  createAuthenticatedTeamMember,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";
import { recordChange, recordChanges } from "../../src/services/changelogService.js";

describe("Changelog API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDatabase();
  });

  describe("GET /api/v1/changelog/:entityType/:entityId", () => {
    it("should return changelog for a specific feature", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record some changes
      await recordChange({
        entityType: "feature",
        entityId: feature.id,
        field: "title",
        oldValue: "Old Title",
        newValue: "Test Feature",
        changedBy: user.id,
        epicId: epic.id,
      });

      await recordChange({
        entityType: "feature",
        entityId: feature.id,
        field: "description",
        oldValue: null,
        newValue: "New description",
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.meta).toBeDefined();
      expect(body.meta.hasMore).toBeDefined();
    });

    it("should return changelog for a specific task", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Test Task" });

      // Record a change
      await recordChange({
        entityType: "task",
        entityId: task.id,
        field: "title",
        oldValue: "Old Task",
        newValue: "Test Task",
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/task/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter changelog by field parameter", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record changes to different fields
      await recordChanges({
        entityType: "feature",
        entityId: feature.id,
        changes: [
          { field: "title", oldValue: "Old", newValue: "New" },
          { field: "description", oldValue: null, newValue: "Desc" },
          { field: "status", oldValue: "backlog", newValue: "started" },
        ],
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}?field=title`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((log: { field: string }) => log.field === "title")).toBe(true);
    });

    it("should filter changelog by changedBy parameter", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record changes
      await recordChange({
        entityType: "feature",
        entityId: feature.id,
        field: "title",
        oldValue: "Old",
        newValue: "New",
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}?changedBy=${user.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((log: { changedBy: string }) => log.changedBy === user.id)).toBe(true);
    });

    it("should support pagination with cursor and limit", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record many changes
      await recordChanges({
        entityType: "feature",
        entityId: feature.id,
        changes: Array.from({ length: 25 }, (_, i) => ({
          field: `field${i}`,
          oldValue: null,
          newValue: `value${i}`,
        })),
        changedBy: user.id,
        epicId: epic.id,
      });

      // First page with limit
      const response1 = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}?limit=10`,
        headers,
      });

      expect(response1.statusCode).toBe(200);
      const body1 = JSON.parse(response1.body);
      expect(body1.data.length).toBe(10);
      expect(body1.meta.hasMore).toBe(true);
      expect(body1.meta.cursor).toBeDefined();

      // Second page with cursor
      const response2 = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}?limit=10&cursor=${body1.meta.cursor}`,
        headers,
      });

      expect(response2.statusCode).toBe(200);
      const body2 = JSON.parse(response2.body);
      expect(body2.data.length).toBe(10);
      expect(body2.meta.hasMore).toBe(true);
    });

    it("should require authentication", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/feature/${feature.id}`,
        // No headers = no auth
      });

      expect(response.statusCode).toBe(401);
    });

    it("should validate entityType parameter", async () => {
      const { headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/changelog/invalid-type/550e8400-e29b-41d4-a716-446655440000",
        headers,
      });

      expect(response.statusCode).toBe(400);
    });

    it("should validate entityId parameter as UUID", async () => {
      const { headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/changelog/feature/not-a-uuid",
        headers,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/changelog/epic/:epicId", () => {
    it("should return changelog for entire epic hierarchy", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Test Task" });

      // Record changes at different levels
      await recordChange({
        entityType: "epic",
        entityId: epic.id,
        field: "name",
        oldValue: "Old Epic",
        newValue: "Test Epic",
        changedBy: user.id,
      });

      await recordChange({
        entityType: "feature",
        entityId: feature.id,
        field: "title",
        oldValue: "Old Feature",
        newValue: "Test Feature",
        changedBy: user.id,
        epicId: epic.id,
      });

      await recordChange({
        entityType: "task",
        entityId: task.id,
        field: "title",
        oldValue: "Old Task",
        newValue: "Test Task",
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/epic/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);

      // Verify we have changes from different entity types
      const entityTypes = new Set(body.data.map((log: { entityType: string }) => log.entityType));
      expect(entityTypes.size).toBeGreaterThan(1);
    });

    it("should filter epic changelog by entityType", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Test Task" });

      // Record changes
      await recordChange({
        entityType: "feature",
        entityId: feature.id,
        field: "title",
        oldValue: "Old",
        newValue: "New",
        changedBy: user.id,
        epicId: epic.id,
      });

      await recordChange({
        entityType: "task",
        entityId: task.id,
        field: "title",
        oldValue: "Old",
        newValue: "New",
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/epic/${epic.id}?entityType=feature`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((log: { entityType: string }) => log.entityType === "feature")).toBe(true);
    });

    it("should filter epic changelog by field", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record changes to different fields
      await recordChanges({
        entityType: "feature",
        entityId: feature.id,
        changes: [
          { field: "title", oldValue: "Old", newValue: "New" },
          { field: "description", oldValue: null, newValue: "Desc" },
        ],
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/epic/${epic.id}?field=title`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((log: { field: string }) => log.field === "title")).toBe(true);
    });

    it("should support pagination", async () => {
      const { team, user, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

      // Record many changes
      await recordChanges({
        entityType: "feature",
        entityId: feature.id,
        changes: Array.from({ length: 30 }, (_, i) => ({
          field: `field${i}`,
          oldValue: null,
          newValue: `value${i}`,
        })),
        changedBy: user.id,
        epicId: epic.id,
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/epic/${epic.id}?limit=15`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(15);
      expect(body.meta.hasMore).toBe(true);
      expect(body.meta.cursor).toBeDefined();
    });

    it("should require authentication", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/changelog/epic/${epic.id}`,
        // No headers = no auth
      });

      expect(response.statusCode).toBe(401);
    });

    it("should validate epicId parameter as UUID", async () => {
      const { headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/changelog/epic/not-a-uuid",
        headers,
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
