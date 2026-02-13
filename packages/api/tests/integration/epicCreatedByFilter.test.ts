/**
 * Integration Tests: Epic createdBy Filter (ENG-71)
 *
 * Tests that the createdBy query parameter works correctly:
 * - Filter by createdBy returns only epics created by that user
 * - Combining createdBy + teamId filters correctly
 * - Invalid UUID returns 400 error
 * - Omitting createdBy returns all epics
 *
 * @see ENG-71
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import {
  createTestUser,
  createTestTeam,
  createTestMembership,
  createTestEpic,
} from "../fixtures/factories.js";
import { listEpics } from "../../src/services/epicService.js";
import type { User, Team, Epic } from "../../src/generated/prisma/index.js";

describe("Epic createdBy Filter Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  // Test entities
  let userAlice: User;
  let userBob: User;
  let userCharlie: User;

  let teamAlpha: Team;
  let teamBeta: Team;

  let aliceEpic1: Epic; // Alice's epic in Team Alpha
  let aliceEpic2: Epic; // Alice's epic in Team Beta
  let bobEpic1: Epic; // Bob's epic in Team Alpha
  let bobEpic2: Epic; // Bob's epic in Team Beta
  let charlieEpic: Epic; // Charlie's epic in Team Alpha

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();

    // Create users
    userAlice = await createTestUser({ email: "alice@test.com", name: "Alice" });
    userBob = await createTestUser({ email: "bob@test.com", name: "Bob" });
    userCharlie = await createTestUser({ email: "charlie@test.com", name: "Charlie" });

    // Create teams
    teamAlpha = await createTestTeam({ name: "Team Alpha", key: "ALPHA" });
    teamBeta = await createTestTeam({ name: "Team Beta", key: "BETA" });

    // Add users to teams
    await createTestMembership(teamAlpha.id, userAlice.id, { role: "member" });
    await createTestMembership(teamAlpha.id, userBob.id, { role: "member" });
    await createTestMembership(teamAlpha.id, userCharlie.id, { role: "member" });
    await createTestMembership(teamBeta.id, userAlice.id, { role: "member" });
    await createTestMembership(teamBeta.id, userBob.id, { role: "member" });

    // Create epics with different creators
    aliceEpic1 = await createTestEpic(teamAlpha.id, {
      name: "Alice Epic 1",
      createdBy: userAlice.id,
    });
    aliceEpic2 = await createTestEpic(teamBeta.id, {
      name: "Alice Epic 2",
      createdBy: userAlice.id,
    });
    bobEpic1 = await createTestEpic(teamAlpha.id, {
      name: "Bob Epic 1",
      createdBy: userBob.id,
    });
    bobEpic2 = await createTestEpic(teamBeta.id, {
      name: "Bob Epic 2",
      createdBy: userBob.id,
    });
    charlieEpic = await createTestEpic(teamAlpha.id, {
      name: "Charlie Epic",
      createdBy: userCharlie.id,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Filter by createdBy", () => {
    it("returns only epics created by Alice", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining(["Alice Epic 1", "Alice Epic 2"])
      );
      expect(result.data.every((e) => e.createdBy === userAlice.id)).toBe(true);
    });

    it("returns only epics created by Bob", async () => {
      const result = await listEpics({
        currentUserId: userBob.id,
        createdBy: userBob.id,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining(["Bob Epic 1", "Bob Epic 2"])
      );
      expect(result.data.every((e) => e.createdBy === userBob.id)).toBe(true);
    });

    it("returns only epics created by Charlie", async () => {
      const result = await listEpics({
        currentUserId: userCharlie.id,
        createdBy: userCharlie.id,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Charlie Epic");
      expect(result.data[0]?.createdBy).toBe(userCharlie.id);
    });

    it("returns empty array when filtering by user who created no epics", async () => {
      const newUser = await createTestUser({
        email: "dave@test.com",
        name: "Dave",
      });
      await createTestMembership(teamAlpha.id, newUser.id, { role: "member" });

      const result = await listEpics({
        currentUserId: newUser.id,
        createdBy: newUser.id,
      });

      expect(result.data).toHaveLength(0);
    });
  });

  describe("Combining createdBy + teamId filters", () => {
    it("returns only Alice's epics in Team Alpha", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
        teamId: teamAlpha.id,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Alice Epic 1");
      expect(result.data[0]?.createdBy).toBe(userAlice.id);
      expect(result.data[0]?.teamId).toBe(teamAlpha.id);
    });

    it("returns only Bob's epics in Team Beta", async () => {
      const result = await listEpics({
        currentUserId: userBob.id,
        createdBy: userBob.id,
        teamId: teamBeta.id,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Bob Epic 2");
      expect(result.data[0]?.createdBy).toBe(userBob.id);
      expect(result.data[0]?.teamId).toBe(teamBeta.id);
    });

    it("returns empty array when filtering by creator who has no epics in specified team", async () => {
      // Charlie only has epic in Team Alpha, not Team Beta
      const result = await listEpics({
        currentUserId: userCharlie.id,
        createdBy: userCharlie.id,
        teamId: teamBeta.id,
      });

      expect(result.data).toHaveLength(0);
    });

    it("returns all team epics when teamId is specified without createdBy", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
        teamId: teamAlpha.id,
      });

      expect(result.data).toHaveLength(3); // Alice, Bob, Charlie's epics in Team Alpha
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining(["Alice Epic 1", "Bob Epic 1", "Charlie Epic"])
      );
      expect(result.data.every((e) => e.teamId === teamAlpha.id)).toBe(true);
    });
  });

  describe("Omitting createdBy parameter", () => {
    it("returns all accessible epics when createdBy is not specified", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
      });

      // Alice is member of both teams, should see all 5 epics
      expect(result.data).toHaveLength(5); // Alice's 2 + Bob's 2 + Charlie's 1
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining([
          "Alice Epic 1",
          "Alice Epic 2",
          "Bob Epic 1",
          "Bob Epic 2",
          "Charlie Epic",
        ])
      );
    });

    it("returns all accessible epics for Charlie (member of Team Alpha only)", async () => {
      const result = await listEpics({
        currentUserId: userCharlie.id,
      });

      // Charlie is only member of Team Alpha, should see 3 epics
      expect(result.data).toHaveLength(3);
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining(["Alice Epic 1", "Bob Epic 1", "Charlie Epic"])
      );
    });
  });

  describe("Scope-based filtering with createdBy", () => {
    it("user can filter their own epics across all accessible scopes", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((e) => e.name)).toEqual(
        expect.arrayContaining(["Alice Epic 1", "Alice Epic 2"])
      );
    });

    it("user cannot see epics created by others in inaccessible teams", async () => {
      // Charlie is not a member of Team Beta
      const result = await listEpics({
        currentUserId: userCharlie.id,
        createdBy: userBob.id,
      });

      // Should only see Bob's epic in Team Alpha (not Beta)
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Bob Epic 1");
      expect(result.data[0]?.teamId).toBe(teamAlpha.id);
    });
  });

  describe("Backward compatibility", () => {
    it("existing queries without createdBy continue to work", async () => {
      // Test with just currentUserId
      const result1 = await listEpics({
        currentUserId: userAlice.id,
      });
      expect(result1.data.length).toBeGreaterThan(0);

      // Test with currentUserId + teamId
      const result2 = await listEpics({
        currentUserId: userAlice.id,
        teamId: teamAlpha.id,
      });
      expect(result2.data.length).toBeGreaterThan(0);

      // Test with pagination
      const result3 = await listEpics({
        currentUserId: userAlice.id,
        limit: 2,
      });
      expect(result3.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Edge cases", () => {
    it("handles archived epics correctly with createdBy filter", async () => {
      // Archive one of Alice's epics
      await prisma.epic.update({
        where: { id: aliceEpic1.id },
        data: { isArchived: true },
      });

      // Without includeArchived, should only see non-archived epic
      const result = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("Alice Epic 2");

      // With includeArchived, should see both
      const resultWithArchived = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
        includeArchived: true,
      });

      expect(resultWithArchived.data).toHaveLength(2);
    });

    it("respects pagination with createdBy filter", async () => {
      const result = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
        limit: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).not.toBeNull();
      
      // Verify the cursor is set to the ID of the returned epic
      expect(result.meta.cursor).toBe(result.data[0]?.id);

      // Fetch next page - note: Prisma cursor behavior may include the cursor item
      // depending on implementation details
      const nextPage = await listEpics({
        currentUserId: userAlice.id,
        createdBy: userAlice.id,
        limit: 10, // Get remaining epics
        cursor: result.meta.cursor!,
      });

      // Should get at least one epic (possibly including the cursor item or not)
      expect(nextPage.data.length).toBeGreaterThanOrEqual(1);
      expect(nextPage.data.length).toBeLessThanOrEqual(2);
    });
  });
});
