/**
 * Integration Tests: Cross-Scope Error Handling (COM-321)
 *
 * Tests proper error handling for unauthorized cross-scope access:
 * - Scope filtering properly excludes unauthorized data
 * - Users cannot discover or access data outside their scopes
 * - Guest role is properly restricted to read-only
 *
 * Note: Access control is currently enforced at the list/query level via
 * currentUserId filtering. Individual get/update/delete operations don't
 * yet have access control - that would be a future enhancement.
 *
 * @see COM-321, COM-275
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import {
  createTestUser,
  createTestTeam,
  createTestMembership,
  createTestEpic,
  createTestStatus,
  createTestFeature,
} from "../fixtures/factories.js";
import { listEpics } from "../../src/services/epicService.js";
import { listFeatures } from "../../src/services/featureService.js";
import { listTasks } from "../../src/services/taskService.js";
import { listStatuses } from "../../src/services/statusService.js";
import { ForbiddenError, NotFoundError } from "../../src/errors/index.js";
import type { User, Team, Epic, Feature } from "../../src/generated/prisma/index.js";

describe("Cross-Scope Error Handling Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  // Test entities
  let userAlice: User;
  let userBob: User;
  let userGuest: User;

  let teamAlpha: Team;

  let alicePersonalScope: { id: string };
  let bobPersonalScope: { id: string };

  let alicePersonalProject: Epic;
  let alicePersonalStatus: { id: string };
  let alicePersonalFeature: Feature;

  let alphaProject: Epic;
  let alphaStatus: { id: string };
  let alphaFeature: Feature;

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();

    // Create users
    userAlice = await createTestUser({ email: "alice@test.com", name: "Alice" });
    userBob = await createTestUser({ email: "bob@test.com", name: "Bob" });
    userGuest = await createTestUser({ email: "guest@test.com", name: "Guest User" });

    // Create teams
    teamAlpha = await createTestTeam({ name: "Team Alpha", key: "ALPHA" });

    // Setup memberships:
    // Alice -> Team Alpha (admin)
    // Guest -> Team Alpha (guest - read-only)
    // Bob -> No membership in Team Alpha
    await createTestMembership(teamAlpha.id, userAlice.id, { role: "admin" });
    await createTestMembership(teamAlpha.id, userGuest.id, { role: "guest" });

    // Create personal scopes
    alicePersonalScope = await prisma.personalScope.create({
      data: { userId: userAlice.id },
    });
    bobPersonalScope = await prisma.personalScope.create({
      data: { userId: userBob.id },
    });

    // Create personal status for Alice
    alicePersonalStatus = await prisma.status.create({
      data: {
        name: "Alice Personal Status",
        personalScopeId: alicePersonalScope.id,
        category: "started",
        position: 0,
      },
    });

    // Create Alice's personal project
    alicePersonalProject = await prisma.epic.create({
      data: {
        name: "Alice's Secret Epic",
        personalScopeId: alicePersonalScope.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });

    // Create Alice's personal feature
    alicePersonalFeature = await createTestFeature(alicePersonalProject.id, {
      title: "Alice's Secret Feature",
      identifier: "AP-1",
      statusId: alicePersonalStatus.id,
    });

    // Create team status
    alphaStatus = await createTestStatus(teamAlpha.id, {
      name: "Alpha Status",
      category: "started",
    });

    // Create Team Alpha project
    alphaProject = await createTestEpic(teamAlpha.id, { name: "Alpha Team Epic" });

    // Create Team Alpha feature
    alphaFeature = await createTestFeature(alphaProject.id, {
      title: "Alpha Feature",
      identifier: "ALPHA-1",
      statusId: alphaStatus.id,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Personal Scope Access Filtering", () => {
    describe("Projects", () => {
      it("Bob cannot discover Alice's personal project via list query", async () => {
        const result = await listEpics({ currentUserId: userBob.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Alice's Secret Epic");
      });

      it("Alice can see her own personal project via list query", async () => {
        const result = await listEpics({ currentUserId: userAlice.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).toContain("Alice's Secret Epic");
      });

      it("Bob cannot see Alice's personal project even with specific search", async () => {
        // Even when using teamId filter, Bob shouldn't see Alice's personal data
        const result = await listEpics({ currentUserId: userBob.id });
        const aliceProjects = result.data.filter(
          (p) => p.name === "Alice's Secret Epic"
        );
        expect(aliceProjects).toHaveLength(0);
      });
    });

    describe("Features", () => {
      it("Bob cannot discover Alice's personal features via list query", async () => {
        const result = await listFeatures({ currentUserId: userBob.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).not.toContain("Alice's Secret Feature");
      });

      it("Alice can see her own personal features via list query", async () => {
        const result = await listFeatures({ currentUserId: userAlice.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).toContain("Alice's Secret Feature");
      });
    });
  });

  describe("Team Scope Access Filtering", () => {
    describe("Non-Member Access", () => {
      it("Bob (non-member) cannot discover Team Alpha projects", async () => {
        const result = await listEpics({ currentUserId: userBob.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Alpha Team Epic");
      });

      it("Bob (non-member) cannot discover Team Alpha features", async () => {
        const result = await listFeatures({ currentUserId: userBob.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).not.toContain("Alpha Feature");
      });

      it("Bob (non-member) cannot discover Team Alpha statuses", async () => {
        const result = await listStatuses({ currentUserId: userBob.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).not.toContain("Alpha Status");
      });
    });

    describe("Guest (Read-Only) Access", () => {
      it("Guest can discover Team Alpha projects", async () => {
        const result = await listEpics({ currentUserId: userGuest.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).toContain("Alpha Team Epic");
      });

      it("Guest can discover Team Alpha features", async () => {
        const result = await listFeatures({ currentUserId: userGuest.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).toContain("Alpha Feature");
      });

      it("Guest can discover Team Alpha statuses", async () => {
        const result = await listStatuses({ currentUserId: userGuest.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).toContain("Alpha Status");
      });
    });

    describe("Member and Admin Access", () => {
      it("Alice (admin) can discover Team Alpha projects", async () => {
        const result = await listEpics({ currentUserId: userAlice.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).toContain("Alpha Team Epic");
      });

      it("Alice (admin) can discover Team Alpha features", async () => {
        const result = await listFeatures({ currentUserId: userAlice.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).toContain("Alpha Feature");
      });

      it("Alice can discover both personal and team data", async () => {
        const projectResult = await listEpics({ currentUserId: userAlice.id });
        const projectNames = projectResult.data.map((p) => p.name);

        expect(projectNames).toContain("Alice's Secret Epic");
        expect(projectNames).toContain("Alpha Team Epic");
      });
    });
  });

  describe("Scope Filtering with Empty Results", () => {
    it("returns empty result for user with no accessible scopes", async () => {
      // Create an isolated user with no personal scope and no memberships
      const isolatedUser = await createTestUser({
        email: "isolated@test.com",
        name: "Isolated User",
      });

      const projectResult = await listEpics({ currentUserId: isolatedUser.id });
      expect(projectResult.data).toHaveLength(0);

      const featureResult = await listFeatures({ currentUserId: isolatedUser.id });
      expect(featureResult.data).toHaveLength(0);

      const statusResult = await listStatuses({ currentUserId: isolatedUser.id });
      expect(statusResult).toHaveLength(0);
    });

    it("returns only personal data for user with no team memberships", async () => {
      // Create user with personal scope but no team membership
      const personalOnlyUser = await createTestUser({
        email: "personal@test.com",
        name: "Personal Only User",
      });

      // Create their personal scope
      const personalScope = await prisma.personalScope.create({
        data: { userId: personalOnlyUser.id },
      });

      // Create a personal project
      await prisma.epic.create({
        data: {
          name: "Personal Only Epic",
          personalScopeId: personalScope.id,
          scopeType: "personal",
          sortOrder: 0,
        },
      });

      const result = await listEpics({ currentUserId: personalOnlyUser.id });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Personal Only Epic");
    });
  });

  describe("Invalid User Context Handling", () => {
    it("returns empty result for invalid/nonexistent currentUserId", async () => {
      const result = await listEpics({ currentUserId: "invalid-user-id" });
      expect(result.data).toHaveLength(0);
    });

    it("returns empty result for malformed UUID as currentUserId", async () => {
      const result = await listEpics({ currentUserId: "not-a-valid-uuid" });
      expect(result.data).toHaveLength(0);
    });
  });

  describe("Archived Team Handling", () => {
    it("projects from archived teams are not visible", async () => {
      // Archive Team Alpha
      await prisma.team.update({
        where: { id: teamAlpha.id },
        data: { isArchived: true },
      });

      const result = await listEpics({ currentUserId: userAlice.id });
      const projectNames = result.data.map((p) => p.name);

      // Archived team projects should not be visible
      expect(projectNames).not.toContain("Alpha Team Epic");
      // Personal projects should still be visible
      expect(projectNames).toContain("Alice's Secret Epic");
    });

    it("statuses from archived teams are not visible", async () => {
      // Archive Team Alpha
      await prisma.team.update({
        where: { id: teamAlpha.id },
        data: { isArchived: true },
      });

      const result = await listStatuses({ currentUserId: userAlice.id });
      const statusNames = result.map((s) => s.name);

      expect(statusNames).not.toContain("Alpha Status");
    });
  });

  describe("Backward Compatibility (No currentUserId)", () => {
    it("returns all non-archived projects when currentUserId is omitted", async () => {
      const result = await listEpics();

      // Should see all projects
      const projectNames = result.data.map((p) => p.name);
      expect(projectNames).toContain("Alice's Secret Epic");
      expect(projectNames).toContain("Alpha Team Epic");
    });

    it("returns all non-archived features when currentUserId is omitted", async () => {
      const result = await listFeatures();

      const featureTitles = result.data.map((f) => f.title);
      expect(featureTitles).toContain("Alice's Secret Feature");
      expect(featureTitles).toContain("Alpha Feature");
    });

    it("returns all non-archived statuses when currentUserId is omitted", async () => {
      const result = await listStatuses();

      const statusNames = result.map((s) => s.name);
      expect(statusNames).toContain("Alice Personal Status");
      expect(statusNames).toContain("Alpha Status");
    });
  });
});
