/**
 * Unit tests for recovery state module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  CheckpointManager,
  createCheckpointManager,
  createExecutionState,
  findResumePoint,
  formatDuration,
  CHECKPOINT_VERSION,
  CHECKPOINT_FILENAME,
  type ExecutionState,
  type InProgressItem,
} from "../../src/orchestrator/recovery.js";
import { NetworkError, ErrorCode } from "../../src/errors.js";

// =============================================================================
// Test Helpers
// =============================================================================

let testDir: string;

async function createTestDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spectree-test-"));
  return tempDir;
}

async function cleanupTestDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function createValidState(overrides?: Partial<ExecutionState>): ExecutionState {
  const now = new Date().toISOString();
  return {
    version: CHECKPOINT_VERSION,
    epicId: "epic-123",
    epicIdentifier: "EPC-1",
    sessionId: "session-456",
    currentPhase: 1,
    totalPhases: 3,
    completedItems: ["item-1", "item-2"],
    completedIdentifiers: ["COM-1", "COM-2"],
    inProgressItems: [],
    startedAt: now,
    lastUpdated: now,
    gitBranch: "main",
    ...overrides,
  };
}

// =============================================================================
// CheckpointManager Tests
// =============================================================================

describe("CheckpointManager", () => {
  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await cleanupTestDir(testDir);
  });

  describe("constructor", () => {
    it("should use default state directory", () => {
      const manager = new CheckpointManager();
      expect(manager.checkpointPath).toContain(".spectree");
      expect(manager.checkpointPath).toContain(CHECKPOINT_FILENAME);
    });

    it("should use custom state directory", () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      expect(manager.checkpointPath).toBe(
        path.join(testDir, CHECKPOINT_FILENAME)
      );
    });

    it("should use custom filename", () => {
      const manager = new CheckpointManager({
        stateDir: testDir,
        filename: "custom.json",
      });
      expect(manager.checkpointPath).toBe(path.join(testDir, "custom.json"));
    });
  });

  describe("saveCheckpoint", () => {
    it("should create state directory if it does not exist", async () => {
      const subDir = path.join(testDir, "nested", "dir");
      const manager = new CheckpointManager({ stateDir: subDir });

      await manager.saveCheckpoint(createValidState());

      const stat = await fs.stat(subDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("should save checkpoint to file", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const state = createValidState();

      await manager.saveCheckpoint(state);

      const content = await fs.readFile(manager.checkpointPath, "utf-8");
      const saved = JSON.parse(content) as ExecutionState;
      expect(saved.epicId).toBe(state.epicId);
      expect(saved.sessionId).toBe(state.sessionId);
    });

    it("should update lastUpdated timestamp", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const oldTime = new Date(Date.now() - 60000).toISOString();
      const state = createValidState({ lastUpdated: oldTime });

      await manager.saveCheckpoint(state);

      const content = await fs.readFile(manager.checkpointPath, "utf-8");
      const saved = JSON.parse(content) as ExecutionState;
      expect(new Date(saved.lastUpdated).getTime()).toBeGreaterThan(
        new Date(oldTime).getTime()
      );
    });

    it("should always use current version", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const state = createValidState({ version: "0.0.0" });

      await manager.saveCheckpoint(state);

      const content = await fs.readFile(manager.checkpointPath, "utf-8");
      const saved = JSON.parse(content) as ExecutionState;
      expect(saved.version).toBe(CHECKPOINT_VERSION);
    });

    it("should overwrite existing checkpoint", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      await manager.saveCheckpoint(createValidState({ currentPhase: 1 }));
      await manager.saveCheckpoint(createValidState({ currentPhase: 2 }));

      const content = await fs.readFile(manager.checkpointPath, "utf-8");
      const saved = JSON.parse(content) as ExecutionState;
      expect(saved.currentPhase).toBe(2);
    });
  });

  describe("loadCheckpoint", () => {
    it("should return not_found when no checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      const result = await manager.loadCheckpoint();

      expect(result.state).toBeNull();
      expect(result.reason).toBe("not_found");
    });

    it("should load valid checkpoint", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const state = createValidState();
      await manager.saveCheckpoint(state);

      const result = await manager.loadCheckpoint();

      expect(result.state).not.toBeNull();
      expect(result.state?.epicId).toBe(state.epicId);
      expect(result.reason).toBeUndefined();
    });

    it("should return corrupted for invalid JSON", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(manager.checkpointPath, "not valid json");

      const result = await manager.loadCheckpoint();

      expect(result.state).toBeNull();
      expect(result.reason).toBe("corrupted");
      expect(result.message).toContain("not valid JSON");
    });

    it("should return invalid_format for missing required fields", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(
        manager.checkpointPath,
        JSON.stringify({ epicId: "123" })
      );

      const result = await manager.loadCheckpoint();

      expect(result.state).toBeNull();
      expect(result.reason).toBe("invalid_format");
    });

    it("should return version_mismatch for incompatible version", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const state = createValidState({ version: "99.0.0" });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(manager.checkpointPath, JSON.stringify(state));

      const result = await manager.loadCheckpoint();

      expect(result.state).toBeNull();
      expect(result.reason).toBe("version_mismatch");
    });

    it("should return expired for old checkpoint", async () => {
      const manager = new CheckpointManager({ stateDir: testDir, maxAgeMs: 1000 });
      const oldTime = new Date(Date.now() - 2000).toISOString();
      const state = createValidState({ lastUpdated: oldTime });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(manager.checkpointPath, JSON.stringify(state));

      const result = await manager.loadCheckpoint();

      expect(result.state).toBeNull();
      expect(result.reason).toBe("expired");
    });

    it("should accept checkpoint with same major version", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const [major] = CHECKPOINT_VERSION.split(".");
      const state = createValidState({ version: `${major}.99.99` });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(manager.checkpointPath, JSON.stringify(state));

      const result = await manager.loadCheckpoint();

      expect(result.state).not.toBeNull();
    });
  });

  describe("clearCheckpoint", () => {
    it("should delete checkpoint file", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      await manager.clearCheckpoint();

      const result = await manager.loadCheckpoint();
      expect(result.state).toBeNull();
      expect(result.reason).toBe("not_found");
    });

    it("should not throw if no checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      await expect(manager.clearCheckpoint()).resolves.not.toThrow();
    });
  });

  describe("hasValidCheckpoint", () => {
    it("should return false when no checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      const result = await manager.hasValidCheckpoint();

      expect(result).toBe(false);
    });

    it("should return true when valid checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      const result = await manager.hasValidCheckpoint();

      expect(result).toBe(true);
    });

    it("should return false when checkpoint is expired", async () => {
      const manager = new CheckpointManager({ stateDir: testDir, maxAgeMs: 1000 });
      const oldTime = new Date(Date.now() - 2000).toISOString();
      const state = createValidState({ lastUpdated: oldTime });
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(manager.checkpointPath, JSON.stringify(state));

      const result = await manager.hasValidCheckpoint();

      expect(result).toBe(false);
    });
  });

  describe("updateCheckpoint", () => {
    it("should return null if no checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      const result = await manager.updateCheckpoint({ currentPhase: 2 });

      expect(result).toBeNull();
    });

    it("should update specific fields", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState({ currentPhase: 1 }));

      const result = await manager.updateCheckpoint({ currentPhase: 2 });

      expect(result).not.toBeNull();
      expect(result?.currentPhase).toBe(2);
      expect(result?.epicId).toBe("epic-123"); // Unchanged
    });

    it("should preserve unchanged fields", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const inProgress: InProgressItem[] = [
        { id: "item-3", identifier: "COM-3", agentId: "agent-1", progress: 50 },
      ];
      await manager.saveCheckpoint(
        createValidState({ inProgressItems: inProgress })
      );

      const result = await manager.updateCheckpoint({ currentPhase: 2 });

      expect(result?.inProgressItems).toEqual(inProgress);
    });
  });

  describe("markItemCompleted", () => {
    it("should add item to completed lists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      const result = await manager.markItemCompleted("item-3", "COM-3");

      expect(result?.completedItems).toContain("item-3");
      expect(result?.completedIdentifiers).toContain("COM-3");
    });

    it("should not duplicate already completed items", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(
        createValidState({
          completedItems: ["item-1"],
          completedIdentifiers: ["COM-1"],
        })
      );

      const result = await manager.markItemCompleted("item-1", "COM-1");

      expect(result?.completedItems.filter((i) => i === "item-1")).toHaveLength(
        1
      );
    });

    it("should remove item from in-progress", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const inProgress: InProgressItem[] = [
        { id: "item-3", identifier: "COM-3", agentId: "agent-1", progress: 90 },
      ];
      await manager.saveCheckpoint(
        createValidState({ inProgressItems: inProgress })
      );

      const result = await manager.markItemCompleted("item-3", "COM-3");

      expect(result?.inProgressItems).toHaveLength(0);
    });
  });

  describe("markItemInProgress", () => {
    it("should add item to in-progress list", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      const item: InProgressItem = {
        id: "item-3",
        identifier: "COM-3",
        agentId: "agent-1",
        progress: 25,
      };
      const result = await manager.markItemInProgress(item);

      expect(result?.inProgressItems).toContainEqual(item);
    });

    it("should update existing in-progress item", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      const initial: InProgressItem[] = [
        { id: "item-3", identifier: "COM-3", agentId: "agent-1", progress: 25 },
      ];
      await manager.saveCheckpoint(
        createValidState({ inProgressItems: initial })
      );

      const updated: InProgressItem = {
        id: "item-3",
        identifier: "COM-3",
        agentId: "agent-1",
        progress: 75,
      };
      const result = await manager.markItemInProgress(updated);

      expect(result?.inProgressItems).toHaveLength(1);
      expect(result?.inProgressItems[0].progress).toBe(75);
    });
  });

  describe("saveErrorState", () => {
    it("should save error to checkpoint", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      const error = new NetworkError("Connection failed", {
        code: ErrorCode.NETWORK_CONNECTION_FAILED,
      });
      await manager.saveErrorState(error);

      const { state } = await manager.loadCheckpoint();
      expect(state?.error).toBeDefined();
      expect(state?.error?.message).toBe("Connection failed");
      expect(state?.paused).toBeFalsy();
    });

    it("should mark as paused when specified", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());

      await manager.saveErrorState(new Error("User requested pause"), true);

      const { state } = await manager.loadCheckpoint();
      expect(state?.paused).toBe(true);
    });

    it("should do nothing if no checkpoint exists", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      await expect(
        manager.saveErrorState(new Error("test"))
      ).resolves.not.toThrow();
    });
  });

  describe("getCheckpointInfo", () => {
    it("should return exists: false when no checkpoint", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });

      const info = await manager.getCheckpointInfo();

      expect(info.exists).toBe(false);
      expect(info.epicId).toBeUndefined();
    });

    it("should return checkpoint info", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(
        createValidState({
          epicId: "epic-123",
          epicIdentifier: "EPC-1",
          completedItems: ["a", "b"],
          inProgressItems: [
            { id: "c", identifier: "COM-3", agentId: "agent-1", progress: 50 },
          ],
          currentPhase: 2,
          totalPhases: 5,
        })
      );

      const info = await manager.getCheckpointInfo();

      expect(info.exists).toBe(true);
      expect(info.epicId).toBe("epic-123");
      expect(info.epicIdentifier).toBe("EPC-1");
      expect(info.completedCount).toBe(2);
      expect(info.inProgressCount).toBe(1);
      expect(info.currentPhase).toBe(2);
      expect(info.totalPhases).toBe(5);
      expect(info.age).toBeDefined();
    });

    it("should indicate error state", async () => {
      const manager = new CheckpointManager({ stateDir: testDir });
      await manager.saveCheckpoint(createValidState());
      await manager.saveErrorState(new Error("test error"), true);

      const info = await manager.getCheckpointInfo();

      expect(info.hasError).toBe(true);
      expect(info.isPaused).toBe(true);
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe("formatDuration", () => {
  it("should format seconds", () => {
    expect(formatDuration(5000)).toBe("5s ago");
    expect(formatDuration(45000)).toBe("45s ago");
  });

  it("should format minutes", () => {
    expect(formatDuration(60 * 1000)).toBe("1m ago");
    expect(formatDuration(90 * 1000)).toBe("1m ago");
    expect(formatDuration(5 * 60 * 1000)).toBe("5m ago");
  });

  it("should format hours and minutes", () => {
    expect(formatDuration(60 * 60 * 1000)).toBe("1h 0m ago");
    expect(formatDuration(90 * 60 * 1000)).toBe("1h 30m ago");
    expect(formatDuration(5 * 60 * 60 * 1000)).toBe("5h 0m ago");
  });

  it("should format days and hours", () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe("1d 0h ago");
    expect(formatDuration(36 * 60 * 60 * 1000)).toBe("1d 12h ago");
    expect(formatDuration(72 * 60 * 60 * 1000)).toBe("3d 0h ago");
  });
});

describe("createExecutionState", () => {
  it("should create valid state with required fields", () => {
    const state = createExecutionState("epic-1", "session-1", "main", 3);

    expect(state.version).toBe(CHECKPOINT_VERSION);
    expect(state.epicId).toBe("epic-1");
    expect(state.sessionId).toBe("session-1");
    expect(state.gitBranch).toBe("main");
    expect(state.totalPhases).toBe(3);
    expect(state.currentPhase).toBe(0);
    expect(state.completedItems).toEqual([]);
    expect(state.completedIdentifiers).toEqual([]);
    expect(state.inProgressItems).toEqual([]);
  });

  it("should include optional fields", () => {
    const state = createExecutionState("epic-1", "session-1", "main", 3, {
      epicIdentifier: "EPC-1",
      baseBranch: "develop",
      cwd: "/workspace",
      metadata: { customField: "value" },
    });

    expect(state.epicIdentifier).toBe("EPC-1");
    expect(state.baseBranch).toBe("develop");
    expect(state.cwd).toBe("/workspace");
    expect(state.metadata).toEqual({ customField: "value" });
  });

  it("should set matching startedAt and lastUpdated", () => {
    const before = new Date().toISOString();
    const state = createExecutionState("epic-1", "session-1", "main", 3);
    const after = new Date().toISOString();

    expect(state.startedAt).toBe(state.lastUpdated);
    expect(new Date(state.startedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    );
    expect(new Date(state.startedAt).getTime()).toBeLessThanOrEqual(
      new Date(after).getTime()
    );
  });
});

describe("findResumePoint", () => {
  it("should extract resume information from state", () => {
    const state = createValidState({
      currentPhase: 2,
      completedItems: ["item-1", "item-2"],
      inProgressItems: [
        { id: "item-3", identifier: "COM-3", agentId: "agent-1", progress: 50 },
        { id: "item-4", identifier: "COM-4", agentId: "agent-2", progress: 25 },
      ],
    });

    const resumePoint = findResumePoint(state);

    expect(resumePoint.phase).toBe(2);
    expect(resumePoint.skipItems).toEqual(["item-1", "item-2"]);
    expect(resumePoint.retryItems).toEqual(["item-3", "item-4"]);
  });

  it("should handle empty in-progress items", () => {
    const state = createValidState({
      currentPhase: 1,
      completedItems: ["item-1"],
      inProgressItems: [],
    });

    const resumePoint = findResumePoint(state);

    expect(resumePoint.retryItems).toEqual([]);
  });
});

describe("createCheckpointManager", () => {
  it("should create manager with default options", () => {
    const manager = createCheckpointManager();
    expect(manager).toBeInstanceOf(CheckpointManager);
  });

  it("should create manager with custom options", async () => {
    testDir = await createTestDir();
    const manager = createCheckpointManager({ stateDir: testDir });
    expect(manager.checkpointPath).toBe(path.join(testDir, CHECKPOINT_FILENAME));
    await cleanupTestDir(testDir);
  });
});
