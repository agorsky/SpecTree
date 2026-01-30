/**
 * Tests for scope-based visibility in list queries.
 *
 * These tests verify that:
 * - Users only see data in their accessible scopes
 * - Personal scope data is only visible to the owner
 * - Team scope data is only visible to team members
 * - Cross-scope queries return filtered results
 *
 * @see COM-274, COM-297
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma } from "../setup.js";
import {
  createTestUser,
  createTestTeam,
  createTestMembership,
  createTestEpic,
  createTestStatus,
  createTestFeature,
  createTestTask,
} from "../fixtures/factories.js";
import {
  listEpics,
} from "../../src/services/epicService.js";
import {
  listStatuses,
} from "../../src/services/statusService.js";
import {
  listFeatures,
} from "../../src/services/featureService.js";
import {
  listTasks,
} from "../../src/services/taskService.js";
import type { User, Team, Project, Status, Feature, Task, Membership } from "../../src/generated/prisma/index.js";

describe("Scope-Based List Query Filtering", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  // Test fixtures
  let user1: User; // Has personal scope and membership in team1
  let user2: User; // Has personal scope and membership in team2
  let team1: Team;
  let team2: Team;
  let personalScope1: { id: string };
  let personalScope2: { id: string };
  let membership1: Membership; // user1 in team1
  let membership2: Membership; // user2 in team2

  // Projects
  let team1Epic: Project;
  let team2Epic: Project;
  let personal1Epic: Project;
  let personal2Epic: Project;

  // Statuses
  let team1Status: Status;
  let team2Status: Status;
  let personal1Status: Status;
  let personal2Status: Status;

  // Features
  let team1Feature: Feature;
  let team2Feature: Feature;
  let personal1Feature: Feature;
  let personal2Feature: Feature;

  // Tasks
  let team1Task: Task;
  let team2Task: Task;
  let personal1Task: Task;
  let personal2Task: Task;

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.task.deleteMany();
    await prisma.feature.deleteMany();
    await prisma.epic.deleteMany();
    await prisma.status.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.team.deleteMany();
    await prisma.personalScope.deleteMany();
    await prisma.user.deleteMany();

    // Create users
    user1 = await createTestUser({ email: "user1@test.com", name: "User One" });
    user2 = await createTestUser({ email: "user2@test.com", name: "User Two" });

    // Create teams
    team1 = await createTestTeam({ name: "Team One", key: "T1" });
    team2 = await createTestTeam({ name: "Team Two", key: "T2" });

    // Create personal scopes
    personalScope1 = await prisma.personalScope.create({
      data: { userId: user1.id },
    });
    personalScope2 = await prisma.personalScope.create({
      data: { userId: user2.id },
    });

    // Create memberships - user1 in team1, user2 in team2
    membership1 = await createTestMembership(team1.id, user1.id, { role: "member" });
    membership2 = await createTestMembership(team2.id, user2.id, { role: "member" });

    // Create statuses for each scope
    team1Status = await createTestStatus(team1.id, {
      name: "Team1 Status",
      category: "started",
    });
    team2Status = await createTestStatus(team2.id, {
      name: "Team2 Status",
      category: "started",
    });
    personal1Status = await prisma.status.create({
      data: {
        name: "Personal1 Status",
        personalScopeId: personalScope1.id,
        category: "started",
        position: 0,
      },
    });
    personal2Status = await prisma.status.create({
      data: {
        name: "Personal2 Status",
        personalScopeId: personalScope2.id,
        category: "started",
        position: 0,
      },
    });

    // Create projects for each scope
    team1Epic = await createTestEpic(team1.id, { name: "Team1 Project" });
    team2Epic = await createTestEpic(team2.id, { name: "Team2 Project" });
    personal1Epic = await prisma.epic.create({
      data: {
        name: "Personal1 Project",
        personalScopeId: personalScope1.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });
    personal2Epic = await prisma.epic.create({
      data: {
        name: "Personal2 Project",
        personalScopeId: personalScope2.id,
        scopeType: "personal",
        sortOrder: 0,
      },
    });

    // Create features for each project
    team1Feature = await createTestFeature(team1Epic.id, {
      title: "Team1 Feature",
      identifier: "T1-1",
      statusId: team1Status.id,
    });
    team2Feature = await createTestFeature(team2Epic.id, {
      title: "Team2 Feature",
      identifier: "T2-1",
      statusId: team2Status.id,
    });
    personal1Feature = await createTestFeature(personal1Epic.id, {
      title: "Personal1 Feature",
      identifier: "P1-1",
      statusId: personal1Status.id,
    });
    personal2Feature = await createTestFeature(personal2Epic.id, {
      title: "Personal2 Feature",
      identifier: "P2-1",
      statusId: personal2Status.id,
    });

    // Create tasks for each feature
    team1Task = await createTestTask(team1Feature.id, {
      title: "Team1 Task",
      identifier: "T1-1-1",
      statusId: team1Status.id,
    });
    team2Task = await createTestTask(team2Feature.id, {
      title: "Team2 Task",
      identifier: "T2-1-1",
      statusId: team2Status.id,
    });
    personal1Task = await createTestTask(personal1Feature.id, {
      title: "Personal1 Task",
      identifier: "P1-1-1",
      statusId: personal1Status.id,
    });
    personal2Task = await createTestTask(personal2Feature.id, {
      title: "Personal2 Task",
      identifier: "P2-1-1",
      statusId: personal2Status.id,
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("listEpics with scope filtering", () => {
    it("should return only projects in user's accessible scopes", async () => {
      // User1 should see team1Epic and personal1Epic
      const result1 = await listEpics({ currentUserId: user1.id });
      expect(result1.data.length).toBe(2);
      expect(result1.data.map(p => p.name).sort()).toEqual([
        "Personal1 Project",
        "Team1 Project",
      ]);

      // User2 should see team2Epic and personal2Epic
      const result2 = await listEpics({ currentUserId: user2.id });
      expect(result2.data.length).toBe(2);
      expect(result2.data.map(p => p.name).sort()).toEqual([
        "Personal2 Project",
        "Team2 Project",
      ]);
    });

    it("should not show other users' personal projects", async () => {
      const result = await listEpics({ currentUserId: user1.id });
      const projectNames = result.data.map(p => p.name);
      expect(projectNames).not.toContain("Personal2 Project");
    });

    it("should not show projects from teams user is not a member of", async () => {
      const result = await listEpics({ currentUserId: user1.id });
      const projectNames = result.data.map(p => p.name);
      expect(projectNames).not.toContain("Team2 Project");
    });

    it("should return empty when user has no accessible scopes", async () => {
      // Create a user with no personal scope and no team memberships
      const isolatedUser = await createTestUser({ email: "isolated@test.com" });

      const result = await listEpics({ currentUserId: isolatedUser.id });
      expect(result.data.length).toBe(0);
    });

    it("should return all projects when currentUserId is not provided (backward compatibility)", async () => {
      const result = await listEpics();
      expect(result.data.length).toBe(4);
    });

    it("should respect teamId filter when combined with currentUserId", async () => {
      // User1 requests team1 projects specifically
      const result = await listEpics({
        currentUserId: user1.id,
        teamId: team1.id,
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe("Team1 Project");
    });
  });

  describe("listStatuses with scope filtering", () => {
    it("should return only statuses in user's accessible scopes", async () => {
      // User1 should see team1Status and personal1Status
      const result1 = await listStatuses({ currentUserId: user1.id });
      expect(result1.length).toBe(2);
      expect(result1.map(s => s.name).sort()).toEqual([
        "Personal1 Status",
        "Team1 Status",
      ]);

      // User2 should see team2Status and personal2Status
      const result2 = await listStatuses({ currentUserId: user2.id });
      expect(result2.length).toBe(2);
      expect(result2.map(s => s.name).sort()).toEqual([
        "Personal2 Status",
        "Team2 Status",
      ]);
    });

    it("should not show other users' personal statuses", async () => {
      const result = await listStatuses({ currentUserId: user1.id });
      const statusNames = result.map(s => s.name);
      expect(statusNames).not.toContain("Personal2 Status");
    });

    it("should not show statuses from teams user is not a member of", async () => {
      const result = await listStatuses({ currentUserId: user1.id });
      const statusNames = result.map(s => s.name);
      expect(statusNames).not.toContain("Team2 Status");
    });

    it("should return empty when user has no accessible scopes", async () => {
      const isolatedUser = await createTestUser({ email: "isolated2@test.com" });

      const result = await listStatuses({ currentUserId: isolatedUser.id });
      expect(result.length).toBe(0);
    });

    it("should return all statuses when currentUserId is not provided (backward compatibility)", async () => {
      const result = await listStatuses();
      expect(result.length).toBe(4);
    });
  });

  describe("listFeatures with scope filtering", () => {
    it("should return only features in user's accessible scopes", async () => {
      // User1 should see team1Feature and personal1Feature
      const result1 = await listFeatures({ currentUserId: user1.id });
      expect(result1.data.length).toBe(2);
      expect(result1.data.map(f => f.title).sort()).toEqual([
        "Personal1 Feature",
        "Team1 Feature",
      ]);

      // User2 should see team2Feature and personal2Feature
      const result2 = await listFeatures({ currentUserId: user2.id });
      expect(result2.data.length).toBe(2);
      expect(result2.data.map(f => f.title).sort()).toEqual([
        "Personal2 Feature",
        "Team2 Feature",
      ]);
    });

    it("should not show other users' personal features", async () => {
      const result = await listFeatures({ currentUserId: user1.id });
      const featureTitles = result.data.map(f => f.title);
      expect(featureTitles).not.toContain("Personal2 Feature");
    });

    it("should not show features from teams user is not a member of", async () => {
      const result = await listFeatures({ currentUserId: user1.id });
      const featureTitles = result.data.map(f => f.title);
      expect(featureTitles).not.toContain("Team2 Feature");
    });

    it("should return empty when user has no accessible scopes", async () => {
      const isolatedUser = await createTestUser({ email: "isolated3@test.com" });

      const result = await listFeatures({ currentUserId: isolatedUser.id });
      expect(result.data.length).toBe(0);
    });

    it("should return all features when currentUserId is not provided (backward compatibility)", async () => {
      const result = await listFeatures();
      expect(result.data.length).toBe(4);
    });

    it("should respect projectId filter when combined with currentUserId", async () => {
      const result = await listFeatures({
        currentUserId: user1.id,
        epicId: team1Epic.id,
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe("Team1 Feature");
    });
  });

  describe("listTasks with scope filtering", () => {
    it("should return only tasks in user's accessible scopes", async () => {
      // User1 should see team1Task and personal1Task
      const result1 = await listTasks({ currentUserId: user1.id });
      expect(result1.data.length).toBe(2);
      expect(result1.data.map(t => t.title).sort()).toEqual([
        "Personal1 Task",
        "Team1 Task",
      ]);

      // User2 should see team2Task and personal2Task
      const result2 = await listTasks({ currentUserId: user2.id });
      expect(result2.data.length).toBe(2);
      expect(result2.data.map(t => t.title).sort()).toEqual([
        "Personal2 Task",
        "Team2 Task",
      ]);
    });

    it("should not show other users' personal tasks", async () => {
      const result = await listTasks({ currentUserId: user1.id });
      const taskTitles = result.data.map(t => t.title);
      expect(taskTitles).not.toContain("Personal2 Task");
    });

    it("should not show tasks from teams user is not a member of", async () => {
      const result = await listTasks({ currentUserId: user1.id });
      const taskTitles = result.data.map(t => t.title);
      expect(taskTitles).not.toContain("Team2 Task");
    });

    it("should return empty when user has no accessible scopes", async () => {
      const isolatedUser = await createTestUser({ email: "isolated4@test.com" });

      const result = await listTasks({ currentUserId: isolatedUser.id });
      expect(result.data.length).toBe(0);
    });

    it("should return all tasks when currentUserId is not provided (backward compatibility)", async () => {
      const result = await listTasks();
      expect(result.data.length).toBe(4);
    });

    it("should respect featureId filter when combined with currentUserId", async () => {
      const result = await listTasks({
        currentUserId: user1.id,
        featureId: team1Feature.id,
      });
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe("Team1 Task");
    });
  });

  describe("Cross-scope access scenarios", () => {
    it("should allow user to see data after joining a new team", async () => {
      // Initially user1 should not see team2 data
      let result = await listEpics({ currentUserId: user1.id });
      expect(result.data.map(p => p.name)).not.toContain("Team2 Project");

      // Add user1 to team2
      await createTestMembership(team2.id, user1.id, { role: "member" });

      // Now user1 should see team2 data
      result = await listEpics({ currentUserId: user1.id });
      expect(result.data.map(p => p.name)).toContain("Team2 Project");
    });

    it("should not show data from archived teams", async () => {
      // Archive team1
      await prisma.team.update({
        where: { id: team1.id },
        data: { isArchived: true },
      });

      // User1 should no longer see team1 projects
      const result = await listEpics({ currentUserId: user1.id });
      expect(result.data.map(p => p.name)).not.toContain("Team1 Project");
      // But should still see personal projects
      expect(result.data.map(p => p.name)).toContain("Personal1 Project");
    });
  });
});
