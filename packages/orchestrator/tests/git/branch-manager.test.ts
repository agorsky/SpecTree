/**
 * Unit tests for BranchManager
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrchestratorError, ErrorCode } from "../../src/errors.js";

// Create the mock git object - must be defined before vi.mock
const mockGitInstance = {
  checkIsRepo: vi.fn(),
  branchLocal: vi.fn(),
  checkoutBranch: vi.fn(),
  checkout: vi.fn(),
  branch: vi.fn(),
  status: vi.fn(),
};

// Track calls to the factory
let simpleGitCalls: { baseDir: string }[] = [];

// Mock simple-git - must export `simpleGit` as a named export
vi.mock("simple-git", () => ({
  simpleGit: (options: { baseDir: string }) => {
    simpleGitCalls.push(options);
    return mockGitInstance;
  },
  GitError: class GitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GitError";
    }
  },
}));

// Import after mock
import { BranchManager, createBranchManager } from "../../src/git/branch-manager.js";

describe("BranchManager", () => {
  let branchManager: BranchManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: we're in a git repo
    mockGitInstance.checkIsRepo.mockResolvedValue(true);
    branchManager = new BranchManager();
  });

  describe("constructor", () => {
    it("uses default options", () => {
      const manager = new BranchManager();
      expect(manager.getBranchPrefix()).toBe("feature/");
    });

    it("accepts custom branchPrefix", () => {
      const manager = new BranchManager({ branchPrefix: "agent/" });
      expect(manager.getBranchPrefix()).toBe("agent/");
    });

    it("passes cwd to simple-git", () => {
      simpleGitCalls = []; // Reset tracked calls
      new BranchManager({ cwd: "/custom/path" });
      expect(simpleGitCalls).toContainEqual({ baseDir: "/custom/path" });
    });
  });

  describe("createBranchManager factory", () => {
    it("creates a BranchManager instance", () => {
      const manager = createBranchManager({ branchPrefix: "test/" });
      expect(manager).toBeInstanceOf(BranchManager);
      expect(manager.getBranchPrefix()).toBe("test/");
    });
  });

  describe("createBranch", () => {
    it("creates and checks out a new branch", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "develop"],
        current: "main",
        detached: false,
      });
      mockGitInstance.checkoutBranch.mockResolvedValue(undefined);

      await branchManager.createBranch("my-feature", "main");

      expect(mockGitInstance.checkoutBranch).toHaveBeenCalledWith("feature/my-feature", "main");
    });

    it("uses default branch when base not specified", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main"],
        current: "main",
        detached: false,
      });
      mockGitInstance.checkoutBranch.mockResolvedValue(undefined);

      await branchManager.createBranch("my-feature");

      expect(mockGitInstance.checkoutBranch).toHaveBeenCalledWith("feature/my-feature", "main");
    });

    it("checks out existing branch instead of creating", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "feature/my-feature"],
        current: "main",
        detached: false,
      });
      mockGitInstance.checkout.mockResolvedValue(undefined);

      await branchManager.createBranch("my-feature");

      expect(mockGitInstance.checkoutBranch).not.toHaveBeenCalled();
      expect(mockGitInstance.checkout).toHaveBeenCalledWith("feature/my-feature");
    });

    it("throws OrchestratorError on git failure", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main"],
        current: "main",
        detached: false,
      });
      mockGitInstance.checkoutBranch.mockRejectedValue(new Error("Branch creation failed"));

      await expect(branchManager.createBranch("bad-branch")).rejects.toThrow(OrchestratorError);
    });

    it("throws if not a git repository", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(false);

      await expect(branchManager.createBranch("test")).rejects.toThrow("Not a git repository");
    });
  });

  describe("checkout", () => {
    it("checks out the specified branch with prefix", async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);

      await branchManager.checkout("my-feature");

      expect(mockGitInstance.checkout).toHaveBeenCalledWith("feature/my-feature");
    });

    it("throws OrchestratorError on checkout failure", async () => {
      mockGitInstance.checkout.mockRejectedValue(new Error("Checkout failed"));

      await expect(branchManager.checkout("nonexistent")).rejects.toThrow(OrchestratorError);
    });
  });

  describe("checkoutFull", () => {
    it("checks out branch by full name without prefix", async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);

      await branchManager.checkoutFull("main");

      expect(mockGitInstance.checkout).toHaveBeenCalledWith("main");
    });
  });

  describe("getCurrentBranch", () => {
    it("returns current branch name", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "feature/test"],
        current: "feature/test",
        detached: false,
      });

      const branch = await branchManager.getCurrentBranch();

      expect(branch).toBe("feature/test");
    });

    it("returns (detached) for detached HEAD", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main"],
        current: "",
        detached: true,
      });

      const branch = await branchManager.getCurrentBranch();

      expect(branch).toBe("(detached)");
    });

    it("throws OrchestratorError on failure", async () => {
      mockGitInstance.branchLocal.mockRejectedValue(new Error("Branch list failed"));

      await expect(branchManager.getCurrentBranch()).rejects.toThrow(OrchestratorError);
    });
  });

  describe("listBranches", () => {
    it("returns all local branches", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "develop", "feature/test"],
        current: "main",
        detached: false,
      });

      const branches = await branchManager.listBranches();

      expect(branches).toEqual(["main", "develop", "feature/test"]);
    });

    it("filters branches by glob pattern", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "develop", "feature/one", "feature/two", "hotfix/bug"],
        current: "main",
        detached: false,
      });

      const branches = await branchManager.listBranches("feature/*");

      expect(branches).toEqual(["feature/one", "feature/two"]);
    });

    it("supports * wildcard in pattern", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "master", "develop"],
        current: "main",
        detached: false,
      });

      const branches = await branchManager.listBranches("ma*");

      expect(branches).toEqual(["main", "master"]);
    });
  });

  describe("branchExists", () => {
    it("returns true for existing branch", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "feature/test"],
        current: "main",
        detached: false,
      });

      const exists = await branchManager.branchExists("test");

      expect(exists).toBe(true);
    });

    it("returns false for non-existing branch", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main"],
        current: "main",
        detached: false,
      });

      const exists = await branchManager.branchExists("nonexistent");

      expect(exists).toBe(false);
    });
  });

  describe("branchExistsFull", () => {
    it("checks existence by full name", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["main", "develop"],
        current: "main",
        detached: false,
      });

      expect(await branchManager.branchExistsFull("main")).toBe(true);
      expect(await branchManager.branchExistsFull("feature/test")).toBe(false);
    });
  });

  describe("deleteBranch", () => {
    it("deletes branch with -d flag by default", async () => {
      mockGitInstance.branch.mockResolvedValue(undefined);

      await branchManager.deleteBranch("test");

      expect(mockGitInstance.branch).toHaveBeenCalledWith(["-d", "feature/test"]);
    });

    it("force deletes branch with -D flag", async () => {
      mockGitInstance.branch.mockResolvedValue(undefined);

      await branchManager.deleteBranch("test", true);

      expect(mockGitInstance.branch).toHaveBeenCalledWith(["-D", "feature/test"]);
    });

    it("throws OrchestratorError on delete failure", async () => {
      mockGitInstance.branch.mockRejectedValue(new Error("Cannot delete"));

      await expect(branchManager.deleteBranch("test")).rejects.toThrow(OrchestratorError);
    });
  });

  describe("deleteBranchFull", () => {
    it("deletes branch by full name", async () => {
      mockGitInstance.branch.mockResolvedValue(undefined);

      await branchManager.deleteBranchFull("main", true);

      expect(mockGitInstance.branch).toHaveBeenCalledWith(["-D", "main"]);
    });
  });

  describe("getDefaultBranch", () => {
    it("prefers main over master", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["master", "main", "develop"],
        current: "develop",
        detached: false,
      });

      const defaultBranch = await branchManager.getDefaultBranch();

      expect(defaultBranch).toBe("main");
    });

    it("falls back to master if main not present", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["master", "develop"],
        current: "develop",
        detached: false,
      });

      const defaultBranch = await branchManager.getDefaultBranch();

      expect(defaultBranch).toBe("master");
    });

    it("uses current branch if neither main nor master exist", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["develop", "feature/test"],
        current: "develop",
        detached: false,
      });

      const defaultBranch = await branchManager.getDefaultBranch();

      expect(defaultBranch).toBe("develop");
    });

    it("uses first branch if no current and no main/master", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: ["feature/a", "feature/b"],
        current: "",
        detached: true,
      });

      const defaultBranch = await branchManager.getDefaultBranch();

      expect(defaultBranch).toBe("feature/a");
    });

    it("throws if no branches exist", async () => {
      mockGitInstance.branchLocal.mockResolvedValue({
        all: [],
        current: "",
        detached: true,
      });

      await expect(branchManager.getDefaultBranch()).rejects.toThrow("No branches found");
    });
  });

  describe("hasUncommittedChanges", () => {
    it("returns false for clean working directory", async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => true });

      const hasChanges = await branchManager.hasUncommittedChanges();

      expect(hasChanges).toBe(false);
    });

    it("returns true for dirty working directory", async () => {
      mockGitInstance.status.mockResolvedValue({ isClean: () => false });

      const hasChanges = await branchManager.hasUncommittedChanges();

      expect(hasChanges).toBe(true);
    });
  });

  describe("generateBranchName", () => {
    it("generates branch name with prefix, identifier, and slug", () => {
      const name = branchManager.generateBranchName("COM-5", "API Endpoints");

      expect(name).toBe("feature/COM-5-api-endpoints");
    });

    it("removes special characters from title", () => {
      const name = branchManager.generateBranchName("COM-6", "Fix: Bug #123 (urgent)");

      expect(name).toBe("feature/COM-6-fix-bug-123-urgent");
    });

    it("truncates slug to 30 characters", () => {
      const name = branchManager.generateBranchName(
        "COM-7",
        "This is a very long title that exceeds the maximum allowed length"
      );

      // "this-is-a-very-long-title-that" = 30 chars
      expect(name).toBe("feature/COM-7-this-is-a-very-long-title-that");
      expect(name.length).toBeLessThanOrEqual("feature/COM-7-".length + 30);
    });

    it("removes leading and trailing dashes from slug", () => {
      const name = branchManager.generateBranchName("COM-8", "---Test---");

      expect(name).toBe("feature/COM-8-test");
    });

    it("uses custom branch prefix", () => {
      const manager = new BranchManager({ branchPrefix: "agent/" });
      const name = manager.generateBranchName("TASK-1", "My Task");

      expect(name).toBe("agent/TASK-1-my-task");
    });
  });

  describe("error handling", () => {
    it("wraps git errors with context", async () => {
      mockGitInstance.branchLocal.mockRejectedValue(new Error("Git operation failed"));

      try {
        await branchManager.getCurrentBranch();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorError);
        expect((error as OrchestratorError).code).toBe(ErrorCode.GIT_OPERATION_FAILED);
        expect((error as OrchestratorError).message).toContain("Failed to get current branch");
        expect((error as OrchestratorError).message).toContain("Git operation failed");
      }
    });
  });
});
