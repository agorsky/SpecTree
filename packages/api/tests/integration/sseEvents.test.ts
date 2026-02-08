/**
 * Integration Tests: SSE Events Endpoint (ENG-56, ENG-60)
 *
 * Tests the GET /api/v1/events endpoint:
 * - Returns 200 with text/event-stream Content-Type
 * - Requires valid JWT authentication
 * - Broadcasts events to connected clients
 * - Filters events by epicId query parameter
 * - Sends keepalive comments
 * - Cleans up listeners on disconnect
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import Fastify from "fastify";
import * as http from "http";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import eventsRoutes from "../../src/routes/events.js";
import { createTestUser, createTestTeam, createTestEpic, createTestFeature } from "../fixtures/factories.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import { emitEntityCreated, emitEntityUpdated, emitEntityDeleted, eventEmitter } from "../../src/events/index.js";

/**
 * Helper: Create SSE connection using Node.js http module
 * Returns a promise that resolves with events array when connection closes
 */
function createSSEConnection(
  url: string,
  token: string,
  options: {
    timeout?: number;
    onData?: (chunk: string) => void;
  } = {}
): Promise<{ events: string[]; chunks: string[] }> {
  return new Promise((resolve, reject) => {
    const events: string[] = [];
    const chunks: string[] = [];
    const timeoutMs = options.timeout || 5000;

    const req = http.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        // Reject on non-200 status
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode || "error"}`));
          return;
        }

        res.on("data", (chunk) => {
          const data = chunk.toString();
          chunks.push(data);
          
          // Parse SSE events
          if (data.startsWith("data: ")) {
            events.push(data);
          }

          options.onData?.(data);
        });

        res.on("end", () => {
          resolve({ events, chunks });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    // Auto-close after timeout
    const timer = setTimeout(() => {
      req.destroy();
      resolve({ events, chunks });
    }, timeoutMs);

    req.on("close", () => {
      clearTimeout(timer);
    });
  });
}

describe("GET /api/v1/events", () => {
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: ReturnType<typeof Fastify>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let team: Awaited<ReturnType<typeof createTestTeam>>;
  let token: string;
  let serverAddress: string;

  beforeAll(async () => {
    prisma = getTestPrisma();
    
    // Create Fastify app for testing
    app = Fastify();
    await app.register(eventsRoutes, { prefix: "/api/v1/events" });
    await app.ready();
    
    // Start listening on random port for HTTP tests
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to get server address");
    }
    serverAddress = `http://127.0.0.1:${address.port}/api/v1/events`;
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    
    // Create test user and team
    user = await createTestUser({
      email: "testuser@toro.com",
      name: "Test User",
    });
    
    team = await createTestTeam({
      name: "Test Team",
      key: "TEST",
    });
    
    // Create membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        teamId: team.id,
        role: "member",
      },
    });
    
    token = generateAccessToken(user.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("authentication", () => {
    it("returns 401 without authorization header", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("returns 200 with valid JWT token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");
    });
  });

  describe("event streaming (real HTTP)", () => {
    it("receives entity.created event after feature creation", async () => {
      const epic = await createTestEpic(team.id, {
        name: "Test Epic for SSE",
      });

      // Create SSE connection
      const connectionPromise = createSSEConnection(serverAddress, token, {
        timeout: 3000,
      });

      // Wait for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit entity.created event
      const feature = await createTestFeature(epic.id, {
        title: "Test Feature",
      });
      
      emitEntityCreated({
        entityType: "feature",
        entityId: feature.id,
        
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Wait for events
      const { events, chunks } = await connectionPromise;

      // Verify connection message
      expect(chunks.some((c) => c.includes(":connected"))).toBe(true);

      // Verify event was received
      expect(events.length).toBeGreaterThan(0);
      const eventData = events.find((e) => e.includes("entity.created"));
      expect(eventData).toBeDefined();
      expect(eventData).toContain(feature.id);
    }, 10000);

    it("receives entity.updated event", async () => {
      const epic = await createTestEpic(team.id, {
        name: "Test Epic for Update",
      });

      const feature = await createTestFeature(epic.id, {
        title: "Feature to Update",
      });

      // Create SSE connection
      const connectionPromise = createSSEConnection(serverAddress, token, {
        timeout: 3000,
      });

      // Wait for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit entity.updated event
      emitEntityUpdated({
        entityType: "feature",
        entityId: feature.id,
        changes: { title: "Updated Title" },
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Wait for events
      const { events } = await connectionPromise;

      // Verify event was received
      const eventData = events.find((e) => e.includes("entity.updated"));
      expect(eventData).toBeDefined();
      expect(eventData).toContain(feature.id);
    }, 10000);

    it("broadcasts events to multiple connected clients", async () => {
      const epic = await createTestEpic(team.id, {
        name: "Test Epic for Broadcast",
      });

      // Create 3 simultaneous SSE connections
      const connection1 = createSSEConnection(serverAddress, token, {
        timeout: 3000,
      });
      const connection2 = createSSEConnection(serverAddress, token, {
        timeout: 3000,
      });
      const connection3 = createSSEConnection(serverAddress, token, {
        timeout: 3000,
      });

      // Wait for connections to establish
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit a single event
      const feature = await createTestFeature(epic.id, {
        title: "Broadcast Test Feature",
      });
      
      emitEntityCreated({
        entityType: "feature",
        entityId: feature.id,
        
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Wait for all connections
      const [result1, result2, result3] = await Promise.all([
        connection1,
        connection2,
        connection3,
      ]);

      // Verify all clients received the event
      expect(result1.events.length).toBeGreaterThan(0);
      expect(result2.events.length).toBeGreaterThan(0);
      expect(result3.events.length).toBeGreaterThan(0);

      const hasEvent1 = result1.events.some((e) => e.includes(feature.id));
      const hasEvent2 = result2.events.some((e) => e.includes(feature.id));
      const hasEvent3 = result3.events.some((e) => e.includes(feature.id));

      expect(hasEvent1).toBe(true);
      expect(hasEvent2).toBe(true);
      expect(hasEvent3).toBe(true);
    }, 10000);
  });

  describe("SSE headers", () => {
    it("sets correct SSE headers", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");
      expect(response.headers["cache-control"]).toBe("no-cache");
      expect(response.headers["connection"]).toBe("keep-alive");
    });

    it("sends initial connection message", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain(":connected");
    });
  });

  describe("event streaming", () => {
    it("receives entity.created event after feature creation", async () => {
      // This test verifies that SSE events are sent when entity mutations occur
      // Note: Testing real-time SSE is complex; in a real scenario, you'd use
      // EventSource client or similar. For this test, we verify the endpoint works.
      
      const epic = await createTestEpic(team.id, {
        name: "Test Epic",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/events",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");
      
      // Verify the connection was established
      expect(response.body).toContain(":connected");
    });
  });

  describe("epicId filtering", () => {
    it("accepts epicId query parameter", async () => {
      const epic = await createTestEpic(team.id, {
        name: "Test Epic",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/events?epicId=${epic.id}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toBe("text/event-stream");
    });
  });

  describe("epicId filtering (streaming)", () => {
    it("includes events from the specified epic", async () => {
      const epic1 = await createTestEpic(team.id, {
        name: "Epic 1",
      });
      const epic2 = await createTestEpic(team.id, {
        name: "Epic 2",
      });

      // Connect with epicId filter for epic1
      const connectionPromise = createSSEConnection(
        `${serverAddress}?epicId=${epic1.id}`,
        token,
        { timeout: 3000 }
      );

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create feature in epic1 - should be received
      const feature1 = await createTestFeature(epic1.id, {
        title: "Feature in Epic 1",
      });
      emitEntityCreated({
        entityType: "feature",
        entityId: feature1.id,
        
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Wait a bit for event to be processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Create feature in epic2 - should NOT be received
      const feature2 = await createTestFeature(epic2.id, {
        title: "Feature in Epic 2",
      });
      emitEntityCreated({
        entityType: "feature",
        entityId: feature2.id,
        
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      // Wait for events
      const { events } = await connectionPromise;

      // Verify only feature1 event was received
      const hasFeature1 = events.some((e) => e.includes(feature1.id));
      const hasFeature2 = events.some((e) => e.includes(feature2.id));

      expect(hasFeature1).toBe(true);
      expect(hasFeature2).toBe(false);
    }, 10000);

    it("excludes events from other epics", async () => {
      const epic = await createTestEpic(team.id, {
        name: "Filtered Epic",
      });
      const otherEpic = await createTestEpic(team.id, {
        name: "Other Epic",
      });

      // Connect with epicId filter
      const connectionPromise = createSSEConnection(
        `${serverAddress}?epicId=${epic.id}`,
        token,
        { timeout: 2000 }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit events for both epics
      const feature = await createTestFeature(otherEpic.id, {
        title: "Feature in Other Epic",
      });
      emitEntityCreated({
        entityType: "feature",
        entityId: feature.id,
        
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      const { events } = await connectionPromise;

      // Should not receive events from other epic
      const hasOtherEvent = events.some((e) => e.includes(feature.id));
      expect(hasOtherEvent).toBe(false);
    }, 10000);
  });

  describe("keepalive heartbeat", () => {
    it(
      "sends keepalive comment within 35 seconds",
      async () => {
        // This test verifies the heartbeat mechanism
        let receivedKeepalive = false;

        const connectionPromise = createSSEConnection(serverAddress, token, {
          timeout: 35000, // Wait 35 seconds
          onData: (chunk) => {
            if (chunk.includes(":keepalive")) {
              receivedKeepalive = true;
            }
          },
        });

        await connectionPromise;

        // Verify keepalive was received
        expect(receivedKeepalive).toBe(true);
      },
      40000 // Test timeout: 40 seconds
    );
  });

  describe("cleanup on disconnect", () => {
    it("removes event listeners when client disconnects", async () => {
      // Get initial listener count
      const initialCount = eventEmitter.listenerCount("entity.created");

      // Create and immediately close connection
      const req = http.get(
        serverAddress,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        (res) => {
          // Close connection after receiving initial data
          res.on("data", () => {
            req.destroy();
          });
        }
      );

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify listener was removed
      const finalCount = eventEmitter.listenerCount("entity.created");
      expect(finalCount).toBe(initialCount);
    }, 10000);
  });
});
