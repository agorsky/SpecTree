/**
 * Unit tests for MergeCoordinator
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrchestratorError, MergeConflictError, ErrorCode } from "../../src/errors.js";

// Create the mock git object - must be defined before vi.mock
const mockGitInstance = {
  checkIsRepo: vi.fn(),
  status: vi.fn(),
  merge: vi.fn(),
  pull: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
};

// Mock simple-git
vi.mock("simple-git", () => ({
  simpleGit: () => mockGitInstance,
  GitError: class GitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "GitError";
    }
  },
}));

// Mock BranchManager
const mockBranchManager = {
  checkoutFull: vi.fn(),
  getCurrentBranch: vi.fn(),
};

// Import after mock
import { MergeCoordinator, createMergeCoordinator } from "../../src/git/merge-coordinator.js";
import type { BranchManager } from "../../src/git/branch-manager.js";

describe("MergeCoordinator", () => {
  let mergeCoordinator: MergeCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: we're in a git repo with clean status
    mockGitInstance.checkIsRepo.mockResolvedValue(true);
    mockGitInstance.status.mockResolvedValue({
      isClean: () => true,
      conflicted: [],
    });
    mockBranchManager.getCurrentBranch.mockResolvedValue("main");
    mockBranchManager.checkoutFull.mockResolvedValue(undefined);

    mergeCoordinator = new MergeCoordinator(mockBranchManager as unknown as BranchManager);
  });

  describe("createMergeCoordinator factory", () => {
    it("creates a MergeCoordinator instance", () => {
      const coordinator = createMergeCoordinator(mockBranchManager as unknown as BranchManager);
      expect(coordinator).toBeInstanceOf(MergeCoordinator);
    });
  });

  describe("mergeBranch", () => {
    it("merges feature branch into target successfully", async () => {
      const mergeResult = {
        conflicts: [],
        merges: ["feature/test"],
        result: "success",
      };
      mockGitInstance.merge.mockResolvedValue(mergeResult);
      mockGitInstance.pull.mockResolvedValue(undefined);

      const result = await mergeCoordinator.mergeBranch("feature/test", "main");

      expect(mockBranchManager.checkoutFull).toHaveBeenCalledWith("main");
      expect(mockGitInstance.merge).toHaveBeenCalledWith(["feature/test"]);
      expect(result).toEqual(mergeResult);
    });

    it("throws if working directory is not clean", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: [],
      });

      await expect(mergeCoordinator.mergeBranch("feature/test", "main")).rejects.toThrow(
        "Working directory not clean"
      );
    });

    it("throws MergeConflictError when conflicts detected", async () => {
      mockGitInstance.merge.mockRejectedValue(new Error("Merge conflict"));
      mockGitInstance.status
        .mockResolvedValueOnce({ isClean: () => true, conflicted: [] }) // Initial check
        .mockResolvedValueOnce({ isClean: () => false, conflicted: ["src/file.ts", "src/other.ts"] }); // After merge

      try {
        await mergeCoordinator.mergeBranch("feature/test", "main");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MergeConflictError);
        const conflictError = error as MergeConflictError;
        expect(conflictError.conflictingFiles).toEqual(["src/file.ts", "src/other.ts"]);
        expect(conflictError.sourceBranch).toBe("feature/test");
        expect(conflictError.targetBranch).toBe("main");
      }
    });

    it("ignores pull errors for local-only repos", async () => {
      mockGitInstance.pull.mockRejectedValue(new Error("No remote"));
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      // Should not throw
      await mergeCoordinator.mergeBranch("feature/test", "main");

      expect(mockGitInstance.merge).toHaveBeenCalled();
    });

    it("passes noCommit option", async () => {
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      await mergeCoordinator.mergeBranch("feature/test", "main", { noCommit: true });

      expect(mockGitInstance.merge).toHaveBeenCalledWith(["feature/test", "--no-commit"]);
    });

    it("passes squash option", async () => {
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      await mergeCoordinator.mergeBranch("feature/test", "main", { squash: true });

      expect(mockGitInstance.merge).toHaveBeenCalledWith(["feature/test", "--squash"]);
    });

    it("passes custom message option", async () => {
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      await mergeCoordinator.mergeBranch("feature/test", "main", {
        message: "Merge feature into main",
      });

      expect(mockGitInstance.merge).toHaveBeenCalledWith([
        "feature/test",
        "-m",
        "Merge feature into main",
      ]);
    });

    it("combines multiple options", async () => {
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      await mergeCoordinator.mergeBranch("feature/test", "main", {
        squash: true,
        message: "Squash merge",
      });

      expect(mockGitInstance.merge).toHaveBeenCalledWith([
        "feature/test",
        "--squash",
        "-m",
        "Squash merge",
      ]);
    });

    it("throws OrchestratorError for non-conflict git errors", async () => {
      mockGitInstance.merge.mockRejectedValue(new Error("Some git error"));
      mockGitInstance.status
        .mockResolvedValueOnce({ isClean: () => true, conflicted: [] })
        .mockResolvedValueOnce({ isClean: () => false, conflicted: [] }); // No conflicts

      await expect(mergeCoordinator.mergeBranch("feature/test", "main")).rejects.toThrow(
        OrchestratorError
      );
    });

    it("throws if not a git repository", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(false);

      await expect(mergeCoordinator.mergeBranch("feature/test", "main")).rejects.toThrow(
        "Not a git repository"
      );
    });
  });

  describe("canMerge", () => {
    it("returns true when merge can succeed", async () => {
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      const result = await mergeCoordinator.canMerge("feature/test", "main");

      expect(result).toBe(true);
      // Should have tried merge with --no-commit
      expect(mockGitInstance.merge).toHaveBeenCalledWith(["--no-commit", "--no-ff", "feature/test"]);
      // Should have aborted to clean up
      expect(mockGitInstance.merge).toHaveBeenCalledWith(["--abort"]);
    });

    it("returns false when merge would conflict", async () => {
      mockGitInstance.merge.mockRejectedValue(new Error("Merge conflict"));

      const result = await mergeCoordinator.canMerge("feature/test", "main");

      expect(result).toBe(false);
    });

    it("restores original branch after check", async () => {
      mockBranchManager.getCurrentBranch.mockResolvedValue("develop");
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      await mergeCoordinator.canMerge("feature/test", "main");

      // Should restore to develop
      expect(mockBranchManager.checkoutFull).toHaveBeenLastCalledWith("develop");
    });

    it("handles detached HEAD state gracefully", async () => {
      mockBranchManager.getCurrentBranch.mockResolvedValue("(detached)");
      mockGitInstance.merge.mockResolvedValue({ result: "success" });

      // Should not throw
      const result = await mergeCoordinator.canMerge("feature/test", "main");

      expect(result).toBe(true);
    });
  });

  describe("getConflicts", () => {
    it("returns list of conflicted files", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: ["src/a.ts", "src/b.ts"],
      });

      const conflicts = await mergeCoordinator.getConflicts();

      expect(conflicts).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("returns empty array when no conflicts", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => true,
        conflicted: [],
      });

      const conflicts = await mergeCoordinator.getConflicts();

      expect(conflicts).toEqual([]);
    });

    it("throws OrchestratorError on failure", async () => {
      mockGitInstance.status.mockRejectedValue(new Error("Status failed"));

      await expect(mergeCoordinator.getConflicts()).rejects.toThrow(OrchestratorError);
    });
  });

  describe("abortMerge", () => {
    it("aborts an in-progress merge", async () => {
      mockGitInstance.merge.mockResolvedValue(undefined);

      await mergeCoordinator.abortMerge();

      expect(mockGitInstance.merge).toHaveBeenCalledWith(["--abort"]);
    });

    it("throws OrchestratorError on failure", async () => {
      mockGitInstance.merge.mockRejectedValue(new Error("No merge to abort"));

      await expect(mergeCoordinator.abortMerge()).rejects.toThrow(OrchestratorError);
    });
  });

  describe("completeMerge", () => {
    it("commits the merge with provided message", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: [],
      });
      mockGitInstance.add.mockResolvedValue(undefined);
      mockGitInstance.commit.mockResolvedValue(undefined);

      await mergeCoordinator.completeMerge("Merge complete");

      expect(mockGitInstance.add).toHaveBeenCalledWith(".");
      expect(mockGitInstance.commit).toHaveBeenCalledWith("Merge complete");
    });

    it("throws if unresolved conflicts remain", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: ["src/file.ts"],
      });

      await expect(mergeCoordinator.completeMerge("Merge complete")).rejects.toThrow(
        "unresolved conflict"
      );
    });

    it("throws OrchestratorError on commit failure", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: [],
      });
      mockGitInstance.add.mockResolvedValue(undefined);
      mockGitInstance.commit.mockRejectedValue(new Error("Commit failed"));

      await expect(mergeCoordinator.completeMerge("Merge complete")).rejects.toThrow(
        OrchestratorError
      );
    });
  });

  describe("isMergeInProgress", () => {
    it("returns true when conflicts exist", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => false,
        conflicted: ["src/file.ts"],
      });

      const inProgress = await mergeCoordinator.isMergeInProgress();

      expect(inProgress).toBe(true);
    });

    it("returns false when no conflicts", async () => {
      mockGitInstance.status.mockResolvedValue({
        isClean: () => true,
        conflicted: [],
      });

      const inProgress = await mergeCoordinator.isMergeInProgress();

      expect(inProgress).toBe(false);
    });
  });

  describe("formatConflictGuidance", () => {
    it("formats conflict information for display", () => {
      const guidance = mergeCoordinator.formatConflictGuidance(
        "feature/test",
        "main",
        ["src/api.ts", "src/utils.ts"]
      );

      expect(guidance).toContain("Merge conflict detected!");
      expect(guidance).toContain("feature/test");
      expect(guidance).toContain("main");
      expect(guidance).toContain("src/api.ts");
      expect(guidance).toContain("src/utils.ts");
      expect(guidance).toContain("git merge --abort");
      expect(guidance).toContain("spectree-agent continue");
    });
  });

  describe("error handling", () => {
    it("wraps git errors with context", async () => {
      mockGitInstance.status.mockRejectedValue(new Error("Git operation failed"));

      try {
        await mergeCoordinator.getConflicts();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestratorError);
        expect((error as OrchestratorError).code).toBe(ErrorCode.GIT_OPERATION_FAILED);
        expect((error as OrchestratorError).message).toContain("Failed to get conflict list");
        expect((error as OrchestratorError).message).toContain("Git operation failed");
      }
    });
  });
});
