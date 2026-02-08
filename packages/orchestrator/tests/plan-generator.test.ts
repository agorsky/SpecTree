/**
 * Unit tests for Plan Generator
 *
 * Tests verify:
 * - Plan generation from natural language prompts
 * - AI response parsing and validation
 * - SpecTree API integration for creating epics/features/tasks
 * - Dry-run mode returns planned structure without creation
 * - Error handling for malformed AI responses
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  PlanGenerator,
  PlanParsingError,
  generatePlan,
  type PlannerResponse,
  type GeneratedPlan,
} from "../src/orchestrator/plan-generator.js";
import { SpecTreeClient } from "../src/spectree/api-client.js";
import { AcpSessionManager } from "../src/acp/index.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const VALID_AI_RESPONSE: PlannerResponse = {
  epicName: "User Authentication System",
  epicDescription: "Implement secure user authentication with OAuth and MFA",
  features: [
    {
      title: "Database Schema",
      description: "Create user and session tables",
      executionOrder: 1,
      canParallelize: false,
      parallelGroup: null,
      estimatedComplexity: "moderate",
      dependencies: [],
      tasks: [
        {
          title: "Create user table migration",
          description: "Add users table with email, password hash, and timestamps",
          estimatedComplexity: "simple",
        },
        {
          title: "Create sessions table migration",
          description: "Add sessions table for tracking active sessions",
          estimatedComplexity: "simple",
        },
      ],
    },
    {
      title: "Authentication API",
      description: "Implement login, logout, and session management endpoints",
      executionOrder: 2,
      canParallelize: true,
      parallelGroup: "api",
      estimatedComplexity: "complex",
      dependencies: [1],
      tasks: [
        {
          title: "Implement login endpoint",
          description: "POST /auth/login with email and password",
          estimatedComplexity: "moderate",
        },
        {
          title: "Implement logout endpoint",
          description: "POST /auth/logout to invalidate session",
          estimatedComplexity: "simple",
        },
      ],
    },
    {
      title: "OAuth Integration",
      description: "Add Google and GitHub OAuth providers",
      executionOrder: 2,
      canParallelize: true,
      parallelGroup: "api",
      estimatedComplexity: "complex",
      dependencies: [1],
      tasks: [
        {
          title: "Set up OAuth configuration",
          description: "Configure OAuth providers and callbacks",
          estimatedComplexity: "simple",
        },
      ],
    },
  ],
};

// =============================================================================
// Mock Factories
// =============================================================================

function createMockSpecTreeClient(): SpecTreeClient {
  return {
    createEpic: vi.fn().mockResolvedValue({
      id: "epic-123",
      name: "User Authentication System",
      description: "Implement secure user authentication with OAuth and MFA",
      teamId: "team-1",
      isArchived: false,
      sortOrder: 1,
      icon: null,
      color: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    }),
    createFeature: vi
      .fn()
      .mockImplementation((input: { title: string; epicId: string }) => {
        const index = (createMockSpecTreeClient().createFeature as Mock).mock.calls?.length ?? 1;
        return Promise.resolve({
          id: `feature-${index}`,
          identifier: `TEAM-${index}`,
          title: input.title,
          epicId: input.epicId,
          description: null,
          statusId: null,
          assigneeId: null,
          sortOrder: index,
          executionOrder: index,
          canParallelize: false,
          parallelGroup: null,
          dependencies: null,
          estimatedComplexity: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        });
      }),
    createTask: vi
      .fn()
      .mockImplementation((input: { title: string; featureId: string }) => {
        const index = (createMockSpecTreeClient().createTask as Mock).mock.calls?.length ?? 1;
        return Promise.resolve({
          id: `task-${index}`,
          identifier: `TEAM-1-${index}`,
          title: input.title,
          featureId: input.featureId,
          description: null,
          statusId: null,
          assigneeId: null,
          sortOrder: index,
          executionOrder: index,
          canParallelize: false,
          parallelGroup: null,
          dependencies: null,
          estimatedComplexity: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        });
      }),
  } as unknown as SpecTreeClient;
}

function createMockSessionManager(responseContent: string): AcpSessionManager {
  const mockSession = {
    sendAndWait: vi.fn().mockResolvedValue(responseContent),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    removeListener: vi.fn(),
  };

  return {
    createSession: vi.fn().mockResolvedValue(mockSession),
  } as unknown as AcpSessionManager;
}

// =============================================================================
// Tests
// =============================================================================

describe("PlanGenerator", () => {
  let mockSpecTreeClient: SpecTreeClient;
  let mockSessionManager: AcpSessionManager;
  let generator: PlanGenerator;

  beforeEach(() => {
    mockSpecTreeClient = createMockSpecTreeClient();
    mockSessionManager = createMockSessionManager(JSON.stringify(VALID_AI_RESPONSE));
    generator = new PlanGenerator(mockSpecTreeClient, mockSessionManager);
  });

  describe("generatePlan - Dry Run Mode", () => {
    it("should return planned structure without creating in SpecTree", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      // Should not call any SpecTree create methods
      expect(mockSpecTreeClient.createEpic).not.toHaveBeenCalled();
      expect(mockSpecTreeClient.createFeature).not.toHaveBeenCalled();
      expect(mockSpecTreeClient.createTask).not.toHaveBeenCalled();

      // Should have dry-run IDs
      expect(result.epicId).toBe("dry-run-epic");
      expect(result.features[0].id).toMatch(/^dry-run-feature-/);
    });

    it("should return correct epic metadata in dry-run", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.epicName).toBe("User Authentication System");
      expect(result.epicDescription).toBe(
        "Implement secure user authentication with OAuth and MFA"
      );
    });

    it("should return correct feature count in dry-run", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.totalFeatures).toBe(3);
      expect(result.features).toHaveLength(3);
    });

    it("should return correct task count in dry-run", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      // 2 + 2 + 1 = 5 tasks
      expect(result.totalTasks).toBe(5);
    });

    it("should return parallel groups in dry-run", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.parallelGroups).toEqual(["api"]);
    });

    it("should return execution order in dry-run", async () => {
      const result = await generator.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      // Execution order should have all feature IDs
      expect(result.executionOrder).toHaveLength(3);
    });
  });

  describe("generatePlan - Creation Mode", () => {
    it("should create epic in SpecTree", async () => {
      // Need fresh mocks that track calls properly
      const specTreeClient = {
        createEpic: vi.fn().mockResolvedValue({
          id: "epic-123",
          name: "User Authentication System",
          description: "Implement secure user authentication with OAuth and MFA",
        }),
        createFeature: vi.fn().mockImplementation((_input, index = 1) =>
          Promise.resolve({
            id: `feature-${index}`,
            identifier: `TEAM-${index}`,
            title: _input.title,
          })
        ),
        createTask: vi.fn().mockImplementation((_input, index = 1) =>
          Promise.resolve({
            id: `task-${index}`,
            identifier: `TEAM-1-${index}`,
            title: _input.title,
          })
        ),
      } as unknown as SpecTreeClient;

      const gen = new PlanGenerator(specTreeClient, mockSessionManager);
      await gen.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: false,
      });

      expect(specTreeClient.createEpic).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "User Authentication System",
          teamId: "team-1",
        })
      );
    });

    it("should create all features in SpecTree", async () => {
      const specTreeClient = {
        createEpic: vi.fn().mockResolvedValue({
          id: "epic-123",
          name: "Test Epic",
        }),
        createFeature: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            id: `feature-${Math.random()}`,
            identifier: `TEAM-1`,
            title: input.title,
          })
        ),
        createTask: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            id: `task-${Math.random()}`,
            identifier: `TEAM-1-1`,
            title: input.title,
          })
        ),
      } as unknown as SpecTreeClient;

      const gen = new PlanGenerator(specTreeClient, mockSessionManager);
      await gen.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: false,
      });

      // Should create 3 features
      expect(specTreeClient.createFeature).toHaveBeenCalledTimes(3);
    });

    it("should create all tasks in SpecTree", async () => {
      const specTreeClient = {
        createEpic: vi.fn().mockResolvedValue({
          id: "epic-123",
          name: "Test Epic",
        }),
        createFeature: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            id: `feature-${Math.random()}`,
            identifier: `TEAM-1`,
            title: input.title,
          })
        ),
        createTask: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            id: `task-${Math.random()}`,
            identifier: `TEAM-1-1`,
            title: input.title,
          })
        ),
      } as unknown as SpecTreeClient;

      const gen = new PlanGenerator(specTreeClient, mockSessionManager);
      await gen.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: false,
      });

      // Should create 5 tasks (2 + 2 + 1)
      expect(specTreeClient.createTask).toHaveBeenCalledTimes(5);
    });

    it("should return real IDs from SpecTree", async () => {
      const specTreeClient = {
        createEpic: vi.fn().mockResolvedValue({
          id: "real-epic-id",
          name: "Test Epic",
          description: "Test description",
        }),
        createFeature: vi.fn().mockResolvedValue({
          id: "real-feature-id",
          identifier: "TEAM-1",
          title: "Test Feature",
        }),
        createTask: vi.fn().mockResolvedValue({
          id: "real-task-id",
          identifier: "TEAM-1-1",
          title: "Test Task",
        }),
      } as unknown as SpecTreeClient;

      const gen = new PlanGenerator(specTreeClient, mockSessionManager);
      const result = await gen.generatePlan("Build user auth system", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: false,
      });

      expect(result.epicId).toBe("real-epic-id");
      expect(result.features[0].id).toBe("real-feature-id");
      expect(result.features[0].tasks[0].id).toBe("real-task-id");
    });
  });

  describe("AI Response Parsing", () => {
    it("should parse valid JSON response", async () => {
      const result = await generator.generatePlan("Build something", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.epicName).toBe("User Authentication System");
    });

    it("should extract JSON from response with extra text", async () => {
      const responseWithText = `Here is the plan:\n\n${JSON.stringify(VALID_AI_RESPONSE)}\n\nLet me know if you need changes.`;
      const client = createMockSessionManager(responseWithText);
      const gen = new PlanGenerator(mockSpecTreeClient, client);

      const result = await gen.generatePlan("Build something", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.epicName).toBe("User Authentication System");
    });

    it("should throw PlanParsingError for non-JSON response", async () => {
      const client = createMockSessionManager("This is not JSON at all");
      const gen = new PlanGenerator(mockSpecTreeClient, client);

      await expect(
        gen.generatePlan("Build something", {
          team: "Engineering",
          teamId: "team-1",
          dryRun: true,
        })
      ).rejects.toThrow(PlanParsingError);
    });

    it("should throw PlanParsingError for missing epicName", async () => {
      const invalidResponse = { features: [] };
      const client = createMockSessionManager(JSON.stringify(invalidResponse));
      const gen = new PlanGenerator(mockSpecTreeClient, client);

      await expect(
        gen.generatePlan("Build something", {
          team: "Engineering",
          teamId: "team-1",
          dryRun: true,
        })
      ).rejects.toThrow(PlanParsingError);
    });

    it("should throw PlanParsingError for empty features array", async () => {
      const invalidResponse = { epicName: "Test", features: [] };
      const client = createMockSessionManager(JSON.stringify(invalidResponse));
      const gen = new PlanGenerator(mockSpecTreeClient, client);

      await expect(
        gen.generatePlan("Build something", {
          team: "Engineering",
          teamId: "team-1",
          dryRun: true,
        })
      ).rejects.toThrow(PlanParsingError);
    });

    it("should default complexity to moderate when invalid", async () => {
      const responseWithInvalidComplexity = {
        epicName: "Test",
        features: [
          {
            title: "Feature 1",
            estimatedComplexity: "invalid",
            tasks: [],
          },
        ],
      };
      const client = createMockSessionManager(
        JSON.stringify(responseWithInvalidComplexity)
      );
      const gen = new PlanGenerator(mockSpecTreeClient, client);

      const result = await gen.generatePlan("Build something", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(result.features[0].estimatedComplexity).toBe("moderate");
    });
  });

  describe("ACP Session Integration", () => {
    it("should create session with system message", async () => {
      await generator.generatePlan("Build something", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: expect.any(String),
        })
      );
    });

    it("should close session after use", async () => {
      await generator.generatePlan("Build something", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      // Get the mock session
      const mockSession = await (mockSessionManager.createSession as Mock).mock
        .results[0].value;
      expect(mockSession.destroy).toHaveBeenCalled();
    });

    it("should include user prompt in message", async () => {
      await generator.generatePlan("Build a todo app", {
        team: "Engineering",
        teamId: "team-1",
        dryRun: true,
      });

      const mockSession = await (mockSessionManager.createSession as Mock).mock
        .results[0].value;
      expect(mockSession.sendAndWait).toHaveBeenCalledWith(
        expect.stringContaining("Build a todo app"),
        expect.any(Number)
      );
    });
  });
});

describe("generatePlan function", () => {
  it("should be a convenience wrapper for PlanGenerator", async () => {
    const specTreeClient = createMockSpecTreeClient();
    const sessionManager = createMockSessionManager(
      JSON.stringify(VALID_AI_RESPONSE)
    );

    const result = await generatePlan(
      "Build auth",
      { team: "Engineering", teamId: "team-1", dryRun: true },
      specTreeClient,
      sessionManager
    );

    expect(result).toBeDefined();
    expect(result.epicName).toBe("User Authentication System");
  });
});
