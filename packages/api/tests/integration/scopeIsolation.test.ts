/**
 * Integration Tests: Scope Isolation (COM-317)
 *
 * Tests that scope isolation is properly enforced:
 * - User A cannot see User B's personal data
 * - User cannot see teams they're not a member of
 * - Cross-scope queries return properly filtered results
 *
 * @see COM-317, COM-274
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
  createTestTask,
} from "../fixtures/factories.js";
import { listEpics } from "../../src/services/epicService.js";
import { listStatuses } from "../../src/services/statusService.js";
import { listFeatures } from "../../src/services/featureService.js";
import { listTasks } from "../../src/services/taskService.js";
import type {
  User,
  Team,
  Epic,
  Status,
  Feature,
  Task,
} from "../../src/generated/prisma/index.js";

describe("Scope Isolation Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  // Test entities
  let userAlice: User;
  let userBob: User;
  let userCharlie: User; // Isolated user with no team memberships

  let teamAlpha: Team;
  let teamBeta: Team;

  let alicePersonalScope: { id: string };
  let bobPersonalScope: { id: string };
  let charliePersonalScope: { id: string };

  // Personal projects
  let alicePersonalProject: Epic;
  let bobPersonalProject: Epic;
  let charliePersonalProject: Epic;

  // Team projects
  let alphaProject: Epic;
  let betaProject: Epic;

  // Personal statuses
  let alicePersonalStatus: Status;
  let bobPersonalStatus: Status;

  // Team statuses
  let alphaStatus: Status;
  let betaStatus: Status;

  // Features
  let alicePersonalFeature: Feature;
  let bobPersonalFeature: Feature;
  let alphaFeature: Feature;
  let betaFeature: Feature;

  // Tasks
  let alicePersonalTask: Task;
  let bobPersonalTask: Task;
  let alphaTask: Task;
  let betaTask: Task;

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

    // Create personal scopes
    alicePersonalScope = await prisma.personalScope.create({
      data: { userId: userAlice.id },
    });
    bobPersonalScope = await prisma.personalScope.create({
      data: { userId: userBob.id },
    });
    charliePersonalScope = await prisma.personalScope.create({
      data: { userId: userCharlie.id },
    });

    // Setup memberships:
    // Alice -> Team Alpha (admin)
    // Bob -> Team Beta (member)
    // Charlie -> No team memberships (isolated)
    await createTestMembership(teamAlpha.id, userAlice.id, { role: "admin" });
    await createTestMembership(teamBeta.id, userBob.id, { role: "member" });

    // Create personal statuses
    alicePersonalStatus = await prisma.status.create({
      data: {
        name: "Alice Personal Status",
        personalScopeId: alicePersonalScope.id,
        category: "started",
        position: 0,
      },
    });
    bobPersonalStatus = await prisma.status.create({
      data: {
        name: "Bob Personal Status",
        personalScopeId: bobPersonalScope.id,
        category: "started",
        position: 0,
      },
    });

    // Create team statuses
    alphaStatus = await createTestStatus(teamAlpha.id, {
      name: "Alpha Status",
      category: "started",
    });
    betaStatus = await createTestStatus(teamBeta.id, {
      name: "Beta Status",
      category: "started",
    });

    // Create personal projects
    alicePersonalProject = await prisma.epic.create({
      data: {
        name: "Alice's Personal Epic",
        personalScopeId: alicePersonalScope.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });
    bobPersonalProject = await prisma.epic.create({
      data: {
        name: "Bob's Personal Epic",
        personalScopeId: bobPersonalScope.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });
    charliePersonalProject = await prisma.epic.create({
      data: {
        name: "Charlie's Personal Epic",
        personalScopeId: charliePersonalScope.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });

    // Create team projects
    alphaProject = await createTestEpic(teamAlpha.id, { name: "Alpha Team Epic" });
    betaProject = await createTestEpic(teamBeta.id, { name: "Beta Team Epic" });

    // Create features
    alicePersonalFeature = await createTestFeature(alicePersonalProject.id, {
      title: "Alice Personal Feature",
      identifier: "AP-1",
      statusId: alicePersonalStatus.id,
    });
    bobPersonalFeature = await createTestFeature(bobPersonalProject.id, {
      title: "Bob Personal Feature",
      identifier: "BP-1",
      statusId: bobPersonalStatus.id,
    });
    alphaFeature = await createTestFeature(alphaProject.id, {
      title: "Alpha Feature",
      identifier: "ALPHA-1",
      statusId: alphaStatus.id,
    });
    betaFeature = await createTestFeature(betaProject.id, {
      title: "Beta Feature",
      identifier: "BETA-1",
      statusId: betaStatus.id,
    });

    // Create tasks
    alicePersonalTask = await createTestTask(alicePersonalFeature.id, {
      title: "Alice Personal Task",
      identifier: "AP-1-1",
      statusId: alicePersonalStatus.id,
    });
    bobPersonalTask = await createTestTask(bobPersonalFeature.id, {
      title: "Bob Personal Task",
      identifier: "BP-1-1",
      statusId: bobPersonalStatus.id,
    });
    alphaTask = await createTestTask(alphaFeature.id, {
      title: "Alpha Task",
      identifier: "ALPHA-1-1",
      statusId: alphaStatus.id,
    });
    betaTask = await createTestTask(betaFeature.id, {
      title: "Beta Task",
      identifier: "BETA-1-1",
      statusId: betaStatus.id,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Personal Scope Isolation", () => {
    describe("Projects", () => {
      it("Alice cannot see Bob's personal project", async () => {
        const result = await listEpics({ currentUserId: userAlice.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Bob's Personal Epic");
        expect(projectNames).not.toContain("Charlie's Personal Epic");
      });

      it("Bob cannot see Alice's personal project", async () => {
        const result = await listEpics({ currentUserId: userBob.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Alice's Personal Epic");
        expect(projectNames).not.toContain("Charlie's Personal Epic");
      });

      it("user can see their own personal project", async () => {
        const aliceResult = await listEpics({ currentUserId: userAlice.id });
        expect(aliceResult.data.map((p) => p.name)).toContain("Alice's Personal Epic");

        const bobResult = await listEpics({ currentUserId: userBob.id });
        expect(bobResult.data.map((p) => p.name)).toContain("Bob's Personal Epic");
      });

      it("isolated user (Charlie) can only see their own personal project", async () => {
        const result = await listEpics({ currentUserId: userCharlie.id });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe("Charlie's Personal Epic");
      });
    });

    describe("Statuses", () => {
      it("Alice cannot see Bob's personal statuses", async () => {
        const result = await listStatuses({ currentUserId: userAlice.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).not.toContain("Bob Personal Status");
      });

      it("Bob cannot see Alice's personal statuses", async () => {
        const result = await listStatuses({ currentUserId: userBob.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).not.toContain("Alice Personal Status");
      });

      it("user can see their own personal statuses", async () => {
        const aliceResult = await listStatuses({ currentUserId: userAlice.id });
        expect(aliceResult.map((s) => s.name)).toContain("Alice Personal Status");

        const bobResult = await listStatuses({ currentUserId: userBob.id });
        expect(bobResult.map((s) => s.name)).toContain("Bob Personal Status");
      });
    });

    describe("Features", () => {
      it("Alice cannot see Bob's personal features", async () => {
        const result = await listFeatures({ currentUserId: userAlice.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).not.toContain("Bob Personal Feature");
      });

      it("Bob cannot see Alice's personal features", async () => {
        const result = await listFeatures({ currentUserId: userBob.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).not.toContain("Alice Personal Feature");
      });

      it("user can see their own personal features", async () => {
        const aliceResult = await listFeatures({ currentUserId: userAlice.id });
        expect(aliceResult.data.map((f) => f.title)).toContain("Alice Personal Feature");

        const bobResult = await listFeatures({ currentUserId: userBob.id });
        expect(bobResult.data.map((f) => f.title)).toContain("Bob Personal Feature");
      });
    });

    describe("Tasks", () => {
      it("Alice cannot see Bob's personal tasks", async () => {
        const result = await listTasks({ currentUserId: userAlice.id });
        const taskTitles = result.data.map((t) => t.title);

        expect(taskTitles).not.toContain("Bob Personal Task");
      });

      it("Bob cannot see Alice's personal tasks", async () => {
        const result = await listTasks({ currentUserId: userBob.id });
        const taskTitles = result.data.map((t) => t.title);

        expect(taskTitles).not.toContain("Alice Personal Task");
      });

      it("user can see their own personal tasks", async () => {
        const aliceResult = await listTasks({ currentUserId: userAlice.id });
        expect(aliceResult.data.map((t) => t.title)).toContain("Alice Personal Task");

        const bobResult = await listTasks({ currentUserId: userBob.id });
        expect(bobResult.data.map((t) => t.title)).toContain("Bob Personal Task");
      });
    });
  });

  describe("Team Scope Isolation", () => {
    describe("Projects", () => {
      it("Alice can see Team Alpha projects (is member)", async () => {
        const result = await listEpics({ currentUserId: userAlice.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).toContain("Alpha Team Epic");
      });

      it("Alice cannot see Team Beta projects (not a member)", async () => {
        const result = await listEpics({ currentUserId: userAlice.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Beta Team Epic");
      });

      it("Bob can see Team Beta projects (is member)", async () => {
        const result = await listEpics({ currentUserId: userBob.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).toContain("Beta Team Epic");
      });

      it("Bob cannot see Team Alpha projects (not a member)", async () => {
        const result = await listEpics({ currentUserId: userBob.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Alpha Team Epic");
      });

      it("Charlie cannot see any team projects (no memberships)", async () => {
        const result = await listEpics({ currentUserId: userCharlie.id });
        const projectNames = result.data.map((p) => p.name);

        expect(projectNames).not.toContain("Alpha Team Epic");
        expect(projectNames).not.toContain("Beta Team Epic");
      });
    });

    describe("Statuses", () => {
      it("Alice can see Team Alpha statuses (is member)", async () => {
        const result = await listStatuses({ currentUserId: userAlice.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).toContain("Alpha Status");
      });

      it("Alice cannot see Team Beta statuses (not a member)", async () => {
        const result = await listStatuses({ currentUserId: userAlice.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).not.toContain("Beta Status");
      });

      it("Bob can see Team Beta statuses (is member)", async () => {
        const result = await listStatuses({ currentUserId: userBob.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).toContain("Beta Status");
      });

      it("Bob cannot see Team Alpha statuses (not a member)", async () => {
        const result = await listStatuses({ currentUserId: userBob.id });
        const statusNames = result.map((s) => s.name);

        expect(statusNames).not.toContain("Alpha Status");
      });
    });

    describe("Features", () => {
      it("Alice can see Team Alpha features", async () => {
        const result = await listFeatures({ currentUserId: userAlice.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).toContain("Alpha Feature");
      });

      it("Alice cannot see Team Beta features", async () => {
        const result = await listFeatures({ currentUserId: userAlice.id });
        const featureTitles = result.data.map((f) => f.title);

        expect(featureTitles).not.toContain("Beta Feature");
      });
    });

    describe("Tasks", () => {
      it("Alice can see Team Alpha tasks", async () => {
        const result = await listTasks({ currentUserId: userAlice.id });
        const taskTitles = result.data.map((t) => t.title);

        expect(taskTitles).toContain("Alpha Task");
      });

      it("Alice cannot see Team Beta tasks", async () => {
        const result = await listTasks({ currentUserId: userAlice.id });
        const taskTitles = result.data.map((t) => t.title);

        expect(taskTitles).not.toContain("Beta Task");
      });
    });
  });

  describe("Combined Scope Visibility", () => {
    it("Alice sees both her personal data and Team Alpha data", async () => {
      const projectResult = await listEpics({ currentUserId: userAlice.id });
      const projectNames = projectResult.data.map((p) => p.name);

      // Personal
      expect(projectNames).toContain("Alice's Personal Epic");
      // Team
      expect(projectNames).toContain("Alpha Team Epic");
      // Should not see others
      expect(projectNames).not.toContain("Bob's Personal Epic");
      expect(projectNames).not.toContain("Beta Team Epic");
    });

    it("Bob sees both his personal data and Team Beta data", async () => {
      const projectResult = await listEpics({ currentUserId: userBob.id });
      const projectNames = projectResult.data.map((p) => p.name);

      // Personal
      expect(projectNames).toContain("Bob's Personal Epic");
      // Team
      expect(projectNames).toContain("Beta Team Epic");
      // Should not see others
      expect(projectNames).not.toContain("Alice's Personal Epic");
      expect(projectNames).not.toContain("Alpha Team Epic");
    });
  });

  describe("Dynamic Membership Changes", () => {
    it("user gains visibility after joining a team", async () => {
      // Initially Charlie cannot see Team Alpha
      let result = await listEpics({ currentUserId: userCharlie.id });
      expect(result.data.map((p) => p.name)).not.toContain("Alpha Team Epic");

      // Add Charlie to Team Alpha
      await createTestMembership(teamAlpha.id, userCharlie.id, { role: "member" });

      // Now Charlie can see Team Alpha
      result = await listEpics({ currentUserId: userCharlie.id });
      expect(result.data.map((p) => p.name)).toContain("Alpha Team Epic");
    });

    it("user gains visibility to multiple teams when joining multiple teams", async () => {
      // Add Charlie to both teams
      await createTestMembership(teamAlpha.id, userCharlie.id, { role: "member" });
      await createTestMembership(teamBeta.id, userCharlie.id, { role: "guest" });

      const result = await listEpics({ currentUserId: userCharlie.id });
      const projectNames = result.data.map((p) => p.name);

      // Should see personal and both team projects
      expect(projectNames).toContain("Charlie's Personal Epic");
      expect(projectNames).toContain("Alpha Team Epic");
      expect(projectNames).toContain("Beta Team Epic");
    });
  });

  describe("Archived Team Handling", () => {
    it("should not show projects from archived teams", async () => {
      // Archive Team Alpha
      await prisma.team.update({
        where: { id: teamAlpha.id },
        data: { isArchived: true },
      });

      const result = await listEpics({ currentUserId: userAlice.id });
      const projectNames = result.data.map((p) => p.name);

      // Should not see archived team projects
      expect(projectNames).not.toContain("Alpha Team Epic");
      // Should still see personal projects
      expect(projectNames).toContain("Alice's Personal Epic");
    });

    it("should not show statuses from archived teams", async () => {
      // Archive Team Alpha
      await prisma.team.update({
        where: { id: teamAlpha.id },
        data: { isArchived: true },
      });

      const result = await listStatuses({ currentUserId: userAlice.id });
      const statusNames = result.map((s) => s.name);

      expect(statusNames).not.toContain("Alpha Status");
      // Personal statuses should still be visible
      expect(statusNames).toContain("Alice Personal Status");
    });
  });

  describe("No User Context (Backward Compatibility)", () => {
    it("should return all projects when currentUserId is not provided", async () => {
      const result = await listEpics();

      // Should see all projects
      expect(result.data.length).toBeGreaterThanOrEqual(5);
    });

    it("should return all statuses when currentUserId is not provided", async () => {
      const result = await listStatuses();

      // Should see all statuses
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it("should return all features when currentUserId is not provided", async () => {
      const result = await listFeatures();

      // Should see all features
      expect(result.data.length).toBeGreaterThanOrEqual(4);
    });

    it("should return all tasks when currentUserId is not provided", async () => {
      const result = await listTasks();

      // Should see all tasks
      expect(result.data.length).toBeGreaterThanOrEqual(4);
    });
  });
});
