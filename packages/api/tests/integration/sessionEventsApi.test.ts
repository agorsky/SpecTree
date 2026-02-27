/**
 * Integration Tests: Session Events Query API (ENG-40)
 *
 * Tests the GET /api/v1/sessions/:epicId/events endpoint:
 * - Returns 200 with valid authentication and epicId
 * - Filters events by since, sessionId: null as any, eventTypes
 * - Returns cursor-based pagination metadata
 * - Returns computed progress state
 * - Returns 401 without authentication
 * - Query validation errors return 400
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import sessionRoutes from "../../src/routes/sessions.js";
import {
  createTestUser,
  createTestTeam,
  createTestEpic,
} from "../fixtures/factories.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import { persistSessionEvent } from "../../src/services/sessionEventService.js";
import { SessionEventType } from "@dispatcher/shared";
import type { SessionEvent } from "@dispatcher/shared";

describe("GET /api/v1/sessions/:epicId/events", () => {
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: ReturnType<typeof Fastify>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let team: Awaited<ReturnType<typeof createTestTeam>>;
  let epic: Awaited<ReturnType<typeof createTestEpic>>;
  let sessionId: string;
  let token: string;

  beforeAll(async () => {
    prisma = getTestPrisma();

    // Create Fastify app for testing
    app = Fastify();
    await app.register(sessionRoutes, { prefix: "/api/v1/sessions" });

    await app.listen({ port: 0 }); // Random available port
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();

    // Create test entities
    user = await createTestUser({
      email: "test@example.com",
      name: "Test User",
    });
    team = await createTestTeam({ name: "Test Team", key: "TEST" });
    epic = await createTestEpic(team.id, { name: "Test Epic" });

    // Create an AiSession for the epic (needed for SessionEvent foreign key)
    const aiSession = await prisma.aiSession.create({
      data: {
        epicId: epic.id,
        startedAt: new Date(),
        status: "active",
      },
    });
    sessionId = aiSession.id;

    // Generate JWT token
    token = generateAccessToken(user.id);
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  it("should return 401 without authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
    });

    expect(response.statusCode).toBe(401);
  });

  // ==========================================================================
  // Basic Query Tests
  // ==========================================================================

  it("should return 200 with empty events list for new epic", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("events");
    expect(body.data.events).toEqual([]);
    expect(body.data).toHaveProperty("nextCursor", null);
    expect(body.data).toHaveProperty("totalCount", 0);
    expect(body.data).toHaveProperty("progress");
  });

  it("should return events for epic with session events", async () => {
    // Create some test events
    const event1: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any, // No session association needed for this test
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: {
        status: "active",
        totalFeatures: 3,
        totalTasks: 10,
      },
    };
    const event2: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any, // No session association needed for this test
      timestamp: new Date("2026-02-13T10:01:00Z").toISOString(),
      eventType: SessionEventType.SESSION_FEATURE_STARTED,
      payload: {
        featureId: "feature-456",
        identifier: "TEST-1",
        title: "Feature 1",
        taskCount: 3,
      },
    };

    await persistSessionEvent(event1);
    await persistSessionEvent(event2);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.events).toHaveLength(2);
    expect(body.data.totalCount).toBe(2);
    expect(body.data.events[0].eventType).toBe(SessionEventType.SESSION_STARTED);
    expect(body.data.events[1].eventType).toBe(
      SessionEventType.SESSION_FEATURE_STARTED
    );
  });

  // ==========================================================================
  // Filtering Tests
  // ==========================================================================

  it("should filter events by since parameter", async () => {
    // No sessionId needed for these tests (field is nullable)
    const event1: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: { status: "active" },
    };
    const event2: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:05:00Z").toISOString(),
      eventType: SessionEventType.SESSION_FEATURE_STARTED,
      payload: {
        featureId: "feature-456",
        identifier: "TEST-1",
        title: "Feature 1",
      },
    };

    await persistSessionEvent(event1);
    await persistSessionEvent(event2);

    // Query events since 10:02:00 (should only return event2)
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?since=2026-02-13T10:02:00Z`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0].eventType).toBe(
      SessionEventType.SESSION_FEATURE_STARTED
    );
  });

  it("should filter events by sessionId parameter", async () => {
    // Create two different sessions
    const session1 = await prisma.aiSession.create({
      data: {
        epicId: epic.id,
        startedAt: new Date("2026-02-13T09:00:00Z"),
        status: "active",
      },
    });
    const session2 = await prisma.aiSession.create({
      data: {
        epicId: epic.id,
        startedAt: new Date("2026-02-13T09:30:00Z"),
        status: "active",
      },
    });

    const event1: SessionEvent = {
      epicId: epic.id,
      sessionId: session1.id,
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: { status: "active" },
    };
    const event2: SessionEvent = {
      epicId: epic.id,
      sessionId: session2.id,
      timestamp: new Date("2026-02-13T10:05:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: { status: "active" },
    };

    await persistSessionEvent(event1);
    await persistSessionEvent(event2);

    // Query events for session1
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?sessionId=${session1.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0].sessionId).toBe(session1.id);
  });

  it("should filter events by eventTypes parameter", async () => {
    // No sessionId needed for these tests (field is nullable)
    const event1: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: { status: "active" },
    };
    const event2: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:01:00Z").toISOString(),
      eventType: SessionEventType.SESSION_FEATURE_STARTED,
      payload: {
        featureId: "feature-456",
        identifier: "TEST-1",
        title: "Feature 1",
      },
    };
    const event3: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:02:00Z").toISOString(),
      eventType: SessionEventType.SESSION_TASK_STARTED,
      payload: {
        taskId: "task-789",
        identifier: "TEST-1-1",
        title: "Task 1",
        featureId: "feature-456",
        featureIdentifier: "TEST-1",
      },
    };

    await persistSessionEvent(event1);
    await persistSessionEvent(event2);
    await persistSessionEvent(event3);

    // Query only SESSION_STARTED and SESSION_FEATURE_STARTED events
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?eventTypes=SESSION_STARTED,SESSION_FEATURE_STARTED`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.events).toHaveLength(2);
    expect(body.data.events[0].eventType).toBe(SessionEventType.SESSION_STARTED);
    expect(body.data.events[1].eventType).toBe(
      SessionEventType.SESSION_FEATURE_STARTED
    );
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  it("should respect limit parameter", async () => {
    // No sessionId needed for these tests (field is nullable)

    // Create 5 events
    for (let i = 0; i < 5; i++) {
      const event: SessionEvent = {
        epicId: epic.id,
        sessionId: null as any,
        timestamp: new Date(`2026-02-13T10:0${i}:00Z`).toISOString(),
        eventType: SessionEventType.SESSION_FEATURE_STARTED,
        payload: {
          featureId: `feature-${i}`,
          identifier: `TEST-${i}`,
          title: `Feature ${i}`,
        },
      };
      await persistSessionEvent(event);
    }

    // Query with limit=2
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?limit=2`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.events).toHaveLength(2);
    expect(body.data.nextCursor).not.toBeNull();
    expect(body.data.totalCount).toBe(5);
  });

  // ==========================================================================
  // Progress State Tests
  // ==========================================================================

  it("should return computed progress state with zero values for empty epic", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.progress).toMatchObject({
      currentPhase: null,
      lastCompletedPhase: null,
      totalPhases: null,
      progressPercentage: 0,
      totalFeatures: 0,
      completedFeatures: 0,
      totalTasks: 0,
      completedTasks: 0,
    });
  });

  it("should compute progress state from SESSION_STARTED event", async () => {
    // No sessionId needed for these tests (field is nullable)
    const event: SessionEvent = {
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: {
        status: "active",
        totalFeatures: 5,
        totalTasks: 20,
      },
    };

    await persistSessionEvent(event);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.progress).toMatchObject({
      totalFeatures: 5,
      totalTasks: 20,
      completedFeatures: 0,
      completedTasks: 0,
      progressPercentage: 0,
    });
  });

  it("should compute progress state with completed features and tasks", async () => {
    // No sessionId needed for these tests (field is nullable)
    const featureId = "feature-456";
    const taskId = "task-789";

    // SESSION_STARTED
    await persistSessionEvent({
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:00:00Z").toISOString(),
      eventType: SessionEventType.SESSION_STARTED,
      payload: { status: "active", totalFeatures: 3, totalTasks: 9 },
    });

    // FEATURE_STARTED
    await persistSessionEvent({
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:01:00Z").toISOString(),
      eventType: SessionEventType.SESSION_FEATURE_STARTED,
      payload: {
        featureId,
        identifier: "TEST-1",
        title: "Feature 1",
        taskCount: 3,
      },
    });

    // TASK_STARTED
    await persistSessionEvent({
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:02:00Z").toISOString(),
      eventType: SessionEventType.SESSION_TASK_STARTED,
      payload: {
        taskId,
        identifier: "TEST-1-1",
        title: "Task 1",
        featureId,
        featureIdentifier: "TEST-1",
      },
    });

    // TASK_COMPLETED
    await persistSessionEvent({
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:05:00Z").toISOString(),
      eventType: SessionEventType.SESSION_TASK_COMPLETED,
      payload: {
        taskId,
        identifier: "TEST-1-1",
        title: "Task 1",
        featureId,
        featureIdentifier: "TEST-1",
      },
    });

    // FEATURE_COMPLETED
    await persistSessionEvent({
      epicId: epic.id,
      sessionId: null as any,
      timestamp: new Date("2026-02-13T10:10:00Z").toISOString(),
      eventType: SessionEventType.SESSION_FEATURE_COMPLETED,
      payload: {
        featureId,
        identifier: "TEST-1",
        title: "Feature 1",
      },
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.progress).toMatchObject({
      totalFeatures: 3,
      totalTasks: 9,
      completedFeatures: 1,
      completedTasks: 1,
      progressPercentage: 11, // 1/9 tasks = 11%
    });
  });

  // ==========================================================================
  // Validation Error Tests
  // ==========================================================================

  it("should return 400 for invalid epicId format", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/invalid-uuid/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("should return 400 for invalid since format", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?since=invalid-date`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("should return 400 for invalid limit value", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/sessions/${epic.id}/events?limit=999`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
