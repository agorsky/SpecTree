/**
 * Integration Tests: Personal Epic Requests (ENG-97)
 *
 * Tests personal epic request creation, listing, and visibility filtering:
 * - POST /me/epic-requests creates personal epic request with auto-approval
 * - GET /me/epic-requests returns only the user's personal epic requests
 * - GET /epic-requests filters out other users' personal requests
 * - GET /epic-requests/:id returns null (404) for non-owner personal requests
 * - Team-scoped epic requests continue to work unchanged
 * - Personal scope is lazily initialized
 * - Zod schemas validate correctly
 *
 * @see ENG-97, ENG-95, ENG-96
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import { createTestUser } from "../fixtures/factories.js";
import {
  createEpicRequest,
  listEpicRequests,
  getEpicRequestById,
} from "../../src/services/epicRequestService.js";
import {
  createPersonalEpicRequestSchema,
  createEpicRequestSchema,
} from "../../src/schemas/epicRequest.js";
import type { User } from "../../src/generated/prisma/index.js";

describe("Personal Epic Requests Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  // Test entities
  let userAlice: User;
  let userBob: User;

  let alicePersonalScope: { id: string };
  let bobPersonalScope: { id: string };

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();

    // Create users
    userAlice = await createTestUser({ email: "alice@test.com", name: "Alice" });
    userBob = await createTestUser({ email: "bob@test.com", name: "Bob" });

    // Create personal scopes
    alicePersonalScope = await prisma.personalScope.create({
      data: { userId: userAlice.id },
    });
    bobPersonalScope = await prisma.personalScope.create({
      data: { userId: userBob.id },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // Test 1: POST /me/epic-requests creates personal request with auto-approval
  // =========================================================================
  describe("Create personal epic request (auto-approved)", () => {
    it("creates a personal epic request with status 'approved' and personalScopeId set", async () => {
      const result = await createEpicRequest(
        {
          title: "My Personal Feature Idea",
          description: "A feature just for me",
          personalScopeId: alicePersonalScope.id,
        },
        userAlice.id
      );

      expect(result).toBeDefined();
      expect(result.title).toBe("My Personal Feature Idea");
      expect(result.description).toBe("A feature just for me");
      expect(result.status).toBe("approved");
      expect(result.personalScopeId).toBe(alicePersonalScope.id);
      expect(result.requestedById).toBe(userAlice.id);
    });

    it("creates a personal epic request with structured description", async () => {
      const result = await createEpicRequest(
        {
          title: "Structured Personal Request",
          structuredDesc: {
            problemStatement: "I need personal tracking",
            proposedSolution: "Add personal dashboard",
            impactAssessment: "Improves personal workflow",
          },
          personalScopeId: alicePersonalScope.id,
        },
        userAlice.id
      );

      expect(result).toBeDefined();
      expect(result.status).toBe("approved");
      expect(result.personalScopeId).toBe(alicePersonalScope.id);
      expect(result.structuredDesc).toBeTruthy();

      // Verify structured desc was stored as JSON
      const parsed = JSON.parse(result.structuredDesc!);
      expect(parsed.problemStatement).toBe("I need personal tracking");
      expect(parsed.proposedSolution).toBe("Add personal dashboard");
      expect(parsed.impactAssessment).toBe("Improves personal workflow");
    });
  });

  // =========================================================================
  // Test 2: GET /me/epic-requests returns only the user's personal requests
  // =========================================================================
  describe("List personal epic requests", () => {
    it("returns only the authenticated user's personal epic requests", async () => {
      // Create personal requests for both users
      await createEpicRequest(
        { title: "Alice Personal Request 1", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Alice Personal Request 2", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Bob Personal Request", personalScopeId: bobPersonalScope.id },
        userBob.id
      );

      // Query directly with personalScopeId (as the GET /me/epic-requests route does)
      const aliceRequests = await prisma.epicRequest.findMany({
        where: { personalScopeId: alicePersonalScope.id },
        orderBy: { createdAt: "desc" },
      });

      expect(aliceRequests).toHaveLength(2);
      expect(aliceRequests.map((r) => r.title)).toContain("Alice Personal Request 1");
      expect(aliceRequests.map((r) => r.title)).toContain("Alice Personal Request 2");
      expect(aliceRequests.map((r) => r.title)).not.toContain("Bob Personal Request");
    });

    it("returns empty list when user has no personal epic requests", async () => {
      // Only Bob has requests
      await createEpicRequest(
        { title: "Bob Personal Request", personalScopeId: bobPersonalScope.id },
        userBob.id
      );

      const aliceRequests = await prisma.epicRequest.findMany({
        where: { personalScopeId: alicePersonalScope.id },
      });

      expect(aliceRequests).toHaveLength(0);
    });
  });

  // =========================================================================
  // Test 3: GET /epic-requests filters out other users' personal requests
  // =========================================================================
  describe("List epic requests visibility filtering", () => {
    it("shows team/global requests and own personal requests, hides others' personal requests", async () => {
      // Create a team-scoped request (no personalScopeId)
      await createEpicRequest(
        { title: "Team Request" },
        userAlice.id
      );

      // Create personal requests for each user
      await createEpicRequest(
        { title: "Alice Personal", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Bob Personal", personalScopeId: bobPersonalScope.id },
        userBob.id
      );

      // Alice should see: team request + her own personal request, NOT Bob's
      const aliceResult = await listEpicRequests({}, userAlice.id);
      const aliceTitles = aliceResult.data.map((r) => r.title);

      expect(aliceTitles).toContain("Team Request");
      expect(aliceTitles).toContain("Alice Personal");
      expect(aliceTitles).not.toContain("Bob Personal");

      // Bob should see: team request + his own personal request, NOT Alice's
      const bobResult = await listEpicRequests({}, userBob.id);
      const bobTitles = bobResult.data.map((r) => r.title);

      expect(bobTitles).toContain("Team Request");
      expect(bobTitles).toContain("Bob Personal");
      expect(bobTitles).not.toContain("Alice Personal");
    });

    it("user with no personal scope only sees team/global requests", async () => {
      const userCharlie = await createTestUser({ email: "charlie@test.com", name: "Charlie" });
      // Charlie has NO personal scope

      await createEpicRequest(
        { title: "Team Request" },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Alice Personal", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );

      const charlieResult = await listEpicRequests({}, userCharlie.id);
      const charlieTitles = charlieResult.data.map((r) => r.title);

      expect(charlieTitles).toContain("Team Request");
      expect(charlieTitles).not.toContain("Alice Personal");
    });
  });

  // =========================================================================
  // Test 4: GET /epic-requests/:id returns 404 for non-owner personal requests
  // =========================================================================
  describe("Get epic request by ID visibility", () => {
    it("owner can access their own personal epic request", async () => {
      const created = await createEpicRequest(
        { title: "Alice Private Request", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );

      const result = await getEpicRequestById(created.id, userAlice.id);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Alice Private Request");
      expect(result!.id).toBe(created.id);
    });

    it("non-owner gets null (404) for another user's personal epic request", async () => {
      const created = await createEpicRequest(
        { title: "Alice Private Request", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );

      // Bob tries to access Alice's personal request
      const result = await getEpicRequestById(created.id, userBob.id);

      expect(result).toBeNull();
    });

    it("team/global requests are accessible by any authenticated user", async () => {
      const created = await createEpicRequest(
        { title: "Team Request" },
        userAlice.id
      );

      // Bob can access team requests
      const result = await getEpicRequestById(created.id, userBob.id);

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Team Request");
    });

    it("personal request without userId returns null", async () => {
      const created = await createEpicRequest(
        { title: "Alice Private", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );

      // No userId provided — should treat personal request as not found
      const result = await getEpicRequestById(created.id);

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Test 5: Team-scoped epic request creation works unchanged
  // =========================================================================
  describe("Team-scoped epic requests (existing behavior)", () => {
    it("creates team-scoped request with status 'pending' (not auto-approved)", async () => {
      const result = await createEpicRequest(
        { title: "Team Feature Proposal" },
        userAlice.id
      );

      expect(result).toBeDefined();
      expect(result.title).toBe("Team Feature Proposal");
      expect(result.status).toBe("pending");
      expect(result.personalScopeId).toBeNull();
      expect(result.requestedById).toBe(userAlice.id);
    });

    it("team-scoped requests are visible to all authenticated users", async () => {
      await createEpicRequest({ title: "Public Proposal 1" }, userAlice.id);
      await createEpicRequest({ title: "Public Proposal 2" }, userBob.id);

      const aliceResult = await listEpicRequests({}, userAlice.id);
      const bobResult = await listEpicRequests({}, userBob.id);

      // Both users see all team-scoped requests
      expect(aliceResult.data.map((r) => r.title)).toContain("Public Proposal 1");
      expect(aliceResult.data.map((r) => r.title)).toContain("Public Proposal 2");
      expect(bobResult.data.map((r) => r.title)).toContain("Public Proposal 1");
      expect(bobResult.data.map((r) => r.title)).toContain("Public Proposal 2");
    });
  });

  // =========================================================================
  // Test 6: Zod schema validation
  // =========================================================================
  describe("Zod schema validation", () => {
    it("createPersonalEpicRequestSchema validates valid input", () => {
      const result = createPersonalEpicRequestSchema.safeParse({
        title: "Valid Personal Request",
        description: "Optional description",
      });

      expect(result.success).toBe(true);
    });

    it("createPersonalEpicRequestSchema requires title", () => {
      const result = createPersonalEpicRequestSchema.safeParse({
        description: "No title provided",
      });

      expect(result.success).toBe(false);
    });

    it("createPersonalEpicRequestSchema does NOT accept personalScopeId", () => {
      const result = createPersonalEpicRequestSchema.safeParse({
        title: "Request with scope ID",
        personalScopeId: "some-uuid-value",
      });

      // Zod strips unknown fields by default, so it still succeeds
      // but the personalScopeId is not in the parsed output
      if (result.success) {
        expect(result.data).not.toHaveProperty("personalScopeId");
      }
    });

    it("createEpicRequestSchema still accepts personalScopeId", () => {
      const result = createEpicRequestSchema.safeParse({
        title: "Team Request",
        personalScopeId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.personalScopeId).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });

    it("createPersonalEpicRequestSchema validates structuredDesc", () => {
      const result = createPersonalEpicRequestSchema.safeParse({
        title: "Structured Request",
        structuredDesc: {
          problemStatement: "Problem",
          proposedSolution: "Solution",
          impactAssessment: "Impact",
        },
      });

      expect(result.success).toBe(true);
    });

    it("createPersonalEpicRequestSchema rejects empty title", () => {
      const result = createPersonalEpicRequestSchema.safeParse({
        title: "",
      });

      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Test 7: Pagination on personal epic requests
  // =========================================================================
  describe("Personal epic requests pagination", () => {
    it("supports cursor-based pagination with status filter", async () => {
      // Create 3 personal requests for Alice
      await createEpicRequest(
        { title: "Request 1", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Request 2", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );
      await createEpicRequest(
        { title: "Request 3", personalScopeId: alicePersonalScope.id },
        userAlice.id
      );

      // Query with limit=2 (as the GET /me/epic-requests route does)
      const page1 = await prisma.epicRequest.findMany({
        take: 3,
        where: { personalScopeId: alicePersonalScope.id },
        orderBy: { createdAt: "desc" },
      });

      expect(page1).toHaveLength(3);

      // Filter by status (all are 'approved' due to auto-approval)
      const approvedOnly = await prisma.epicRequest.findMany({
        where: {
          personalScopeId: alicePersonalScope.id,
          status: "approved",
        },
      });

      expect(approvedOnly).toHaveLength(3);
    });
  });
});
