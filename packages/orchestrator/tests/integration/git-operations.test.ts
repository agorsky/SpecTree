/**
 * Integration Tests: Git Operations
 *
 * Tests git operations in isolated test repositories.
 * Creates temporary git repos to test BranchManager and MergeCoordinator.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { simpleGit, type SimpleGit } from "simple-git";
import {
  BranchManager,
  createBranchManager,
} from "../../src/git/branch-manager.js";
import {
  MergeCoordinator,
  createMergeCoordinator,
} from "../../src/git/merge-coordinator.js";
import { OrchestratorError, MergeConflictError } from "../../src/errors.js";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create an isolated test git repository.
 */
async function createTestRepo(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "spectree-git-test-"));
  const git = simpleGit({ baseDir: tempDir });

  // Initialize repo
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "Test User");

  // Create initial commit on main branch
  await fs.writeFile(path.join(tempDir, "README.md"), "# Test Repository\n");
  await git.add("README.md");
  await git.commit("Initial commit");

  return tempDir;
}

/**
 * Clean up a test repository.
 */
async function cleanupTestRepo(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a file with content in the test repo.
 */
async function createFile(
  repoPath: string,
  filename: string,
  content: string
): Promise<void> {
  await fs.writeFile(path.join(repoPath, filename), content);
}

/**
 * Get file content from the test repo.
 */
async function readFile(repoPath: string, filename: string): Promise<string> {
  return fs.readFile(path.join(repoPath, filename), "utf-8");
}

/**
 * List files in the test repo.
 */
async function listFiles(repoPath: string): Promise<string[]> {
  const entries = await fs.readdir(repoPath);
  return entries.filter((e) => !e.startsWith("."));
}

// =============================================================================
// Integration Tests
// =============================================================================

describe("Git Operations Integration", () => {
  let testRepo: string;
  let git: SimpleGit;
  let branchManager: BranchManager;
  let mergeCoordinator: MergeCoordinator;

  // Track all repos for cleanup
  const createdRepos: string[] = [];

  beforeEach(async () => {
    testRepo = await createTestRepo();
    createdRepos.push(testRepo);
    git = simpleGit({ baseDir: testRepo });
    branchManager = createBranchManager({ cwd: testRepo });
    mergeCoordinator = createMergeCoordinator(branchManager, { cwd: testRepo });
  });

  afterEach(async () => {
    await cleanupTestRepo(testRepo);
    createdRepos.pop();
  });

  afterAll(async () => {
    // Clean up any remaining repos
    for (const repo of createdRepos) {
      await cleanupTestRepo(repo);
    }
  });

  // ===========================================================================
  // BranchManager Integration
  // ===========================================================================

  describe("BranchManager", () => {
    describe("Branch Creation", () => {
      it("creates and checks out a new branch from main", async () => {
        await branchManager.createBranch("test-feature", "main");

        const currentBranch = await branchManager.getCurrentBranch();
        expect(currentBranch).toBe("feature/test-feature");
      });

      it("creates branch from default branch when base not specified", async () => {
        await branchManager.createBranch("auto-base");

        const currentBranch = await branchManager.getCurrentBranch();
        expect(currentBranch).toBe("feature/auto-base");
      });

      it("switches to existing branch instead of creating duplicate", async () => {
        // Create branch first time
        await branchManager.createBranch("existing");

        // Switch back to main
        await branchManager.checkoutFull("main");

        // Try to create again - should checkout existing
        await branchManager.createBranch("existing");

        const currentBranch = await branchManager.getCurrentBranch();
        expect(currentBranch).toBe("feature/existing");
      });
    });

    describe("Branch Listing", () => {
      it("lists all local branches", async () => {
        await branchManager.createBranch("feature-a", "main");
        await branchManager.checkoutFull("main");
        await branchManager.createBranch("feature-b", "main");

        const branches = await branchManager.listBranches();

        expect(branches).toContain("main");
        expect(branches).toContain("feature/feature-a");
        expect(branches).toContain("feature/feature-b");
      });

      it("filters branches by pattern", async () => {
        await branchManager.createBranch("feature-a", "main");
        await branchManager.checkoutFull("main");
        await branchManager.createBranch("feature-b", "main");

        const featureBranches = await branchManager.listBranches("feature/*");

        expect(featureBranches).toContain("feature/feature-a");
        expect(featureBranches).toContain("feature/feature-b");
        expect(featureBranches).not.toContain("main");
      });
    });

    describe("Branch Existence Checks", () => {
      it("correctly identifies existing branches", async () => {
        await branchManager.createBranch("exists", "main");

        expect(await branchManager.branchExists("exists")).toBe(true);
        expect(await branchManager.branchExists("nonexistent")).toBe(false);
      });

      it("checks full branch names", async () => {
        expect(await branchManager.branchExistsFull("main")).toBe(true);
        expect(await branchManager.branchExistsFull("develop")).toBe(false);
      });
    });

    describe("Branch Deletion", () => {
      it("deletes a merged branch", async () => {
        // Create branch with changes
        await branchManager.createBranch("to-delete", "main");
        await createFile(testRepo, "new-file.txt", "content");
        await git.add("new-file.txt");
        await git.commit("Add file");

        // Merge to main
        await branchManager.checkoutFull("main");
        await git.merge(["feature/to-delete"]);

        // Delete the branch
        await branchManager.deleteBranch("to-delete");

        expect(await branchManager.branchExists("to-delete")).toBe(false);
      });

      it("force deletes an unmerged branch", async () => {
        // Create branch with changes (not merged)
        await branchManager.createBranch("unmerged", "main");
        await createFile(testRepo, "unmerged-file.txt", "content");
        await git.add("unmerged-file.txt");
        await git.commit("Add unmerged file");

        // Switch back to main
        await branchManager.checkoutFull("main");

        // Force delete
        await branchManager.deleteBranch("unmerged", true);

        expect(await branchManager.branchExists("unmerged")).toBe(false);
      });
    });

    describe("Working Directory Status", () => {
      it("detects uncommitted changes", async () => {
        // Clean state
        expect(await branchManager.hasUncommittedChanges()).toBe(false);

        // Add uncommitted file
        await createFile(testRepo, "uncommitted.txt", "content");
        await git.add("uncommitted.txt");

        expect(await branchManager.hasUncommittedChanges()).toBe(true);
      });
    });

    describe("Branch Name Generation", () => {
      it("generates valid branch names from identifiers and titles", async () => {
        const name = branchManager.generateBranchName("COM-123", "Add User Authentication");

        expect(name).toBe("feature/COM-123-add-user-authentication");
      });

      it("handles special characters in titles", async () => {
        const name = branchManager.generateBranchName(
          "FIX-45",
          "Fix: Bug #123 (critical!)"
        );

        expect(name).toBe("feature/FIX-45-fix-bug-123-critical");
      });
    });
  });

  // ===========================================================================
  // MergeCoordinator Integration
  // ===========================================================================

  describe("MergeCoordinator", () => {
    describe("Clean Merges", () => {
      it("merges a feature branch into main without conflicts", async () => {
        // Create feature branch with changes
        await branchManager.createBranch("feature-clean", "main");
        await createFile(testRepo, "feature-file.txt", "feature content");
        await git.add("feature-file.txt");
        await git.commit("Add feature file");

        // Merge back to main
        const result = await mergeCoordinator.mergeBranch(
          "feature/feature-clean",
          "main"
        );

        expect(result).toBeDefined();

        // Verify file exists on main
        const files = await listFiles(testRepo);
        expect(files).toContain("feature-file.txt");
      });

      it("merges with squash option", async () => {
        // Create feature branch with multiple commits
        await branchManager.createBranch("feature-squash", "main");

        await createFile(testRepo, "file1.txt", "content 1");
        await git.add("file1.txt");
        await git.commit("Commit 1");

        await createFile(testRepo, "file2.txt", "content 2");
        await git.add("file2.txt");
        await git.commit("Commit 2");

        // Merge with squash
        await mergeCoordinator.mergeBranch("feature/feature-squash", "main", {
          squash: true,
          noCommit: true, // Squash requires manual commit
        });

        // Complete the squash merge
        await git.commit("Squashed merge of feature-squash");

        // Verify both files exist
        const files = await listFiles(testRepo);
        expect(files).toContain("file1.txt");
        expect(files).toContain("file2.txt");
      });
    });

    describe("Conflict Detection", () => {
      it("detects merge conflicts", async () => {
        // Create conflicting changes on feature branch
        await branchManager.createBranch("feature-conflict", "main");
        await createFile(testRepo, "README.md", "Feature branch content\n");
        await git.add("README.md");
        await git.commit("Modify README on feature");

        // Create conflicting changes on main
        await branchManager.checkoutFull("main");
        await createFile(testRepo, "README.md", "Main branch content\n");
        await git.add("README.md");
        await git.commit("Modify README on main");

        // Attempt merge - should throw MergeConflictError
        await expect(
          mergeCoordinator.mergeBranch("feature/feature-conflict", "main")
        ).rejects.toThrow(MergeConflictError);
      });

      it("provides conflict details in error", async () => {
        // Create conflicting changes
        await branchManager.createBranch("feature-conflict-details", "main");
        await createFile(testRepo, "conflict.txt", "Feature version\n");
        await git.add("conflict.txt");
        await git.commit("Add conflict file on feature");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "conflict.txt", "Main version\n");
        await git.add("conflict.txt");
        await git.commit("Add conflict file on main");

        try {
          await mergeCoordinator.mergeBranch("feature/feature-conflict-details", "main");
          expect.fail("Should have thrown MergeConflictError");
        } catch (error) {
          expect(error).toBeInstanceOf(MergeConflictError);
          const mergeError = error as MergeConflictError;
          expect(mergeError.conflictingFiles).toContain("conflict.txt");
          expect(mergeError.sourceBranch).toBe("feature/feature-conflict-details");
          expect(mergeError.targetBranch).toBe("main");
        }
      });
    });

    describe("Merge Previews", () => {
      it("checks if merge can proceed without conflicts", async () => {
        // Create clean mergeable branch
        await branchManager.createBranch("feature-preview", "main");
        await createFile(testRepo, "preview-file.txt", "content");
        await git.add("preview-file.txt");
        await git.commit("Add preview file");

        const canMerge = await mergeCoordinator.canMerge(
          "feature/feature-preview",
          "main"
        );

        expect(canMerge).toBe(true);
      });

      it("returns false for conflicting branches", async () => {
        // Create conflicting branches
        await branchManager.createBranch("feature-conflict-preview", "main");
        await createFile(testRepo, "README.md", "Feature content\n");
        await git.add("README.md");
        await git.commit("Feature change");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "README.md", "Main content\n");
        await git.add("README.md");
        await git.commit("Main change");

        const canMerge = await mergeCoordinator.canMerge(
          "feature/feature-conflict-preview",
          "main"
        );

        expect(canMerge).toBe(false);
      });
    });

    describe("Conflict Resolution", () => {
      it("aborts an in-progress merge", async () => {
        // Create conflict
        await branchManager.createBranch("feature-abort", "main");
        await createFile(testRepo, "README.md", "Feature\n");
        await git.add("README.md");
        await git.commit("Feature commit");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "README.md", "Main\n");
        await git.add("README.md");
        await git.commit("Main commit");

        // Try merge (will fail)
        try {
          await mergeCoordinator.mergeBranch("feature/feature-abort", "main");
        } catch {
          // Expected
        }

        // Abort the merge
        await mergeCoordinator.abortMerge();

        // Verify merge was aborted (no conflicts)
        const conflicts = await mergeCoordinator.getConflicts();
        expect(conflicts).toHaveLength(0);
      });

      it("completes merge after manual conflict resolution", async () => {
        // Create conflict
        await branchManager.createBranch("feature-resolve", "main");
        await createFile(testRepo, "README.md", "Feature content\n");
        await git.add("README.md");
        await git.commit("Feature commit");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "README.md", "Main content\n");
        await git.add("README.md");
        await git.commit("Main commit");

        // Try merge
        try {
          await mergeCoordinator.mergeBranch("feature/feature-resolve", "main");
        } catch {
          // Expected conflict
        }

        // Manually resolve conflict
        await createFile(testRepo, "README.md", "Resolved content\n");
        await git.add("README.md");

        // Complete merge
        await mergeCoordinator.completeMerge("Merge with resolved conflicts");

        // Verify merge completed
        const content = await readFile(testRepo, "README.md");
        expect(content).toBe("Resolved content\n");
      });
    });

    describe("Merge Status", () => {
      it("checks if merge is in progress", async () => {
        // Initially no merge
        expect(await mergeCoordinator.isMergeInProgress()).toBe(false);

        // Create conflict to trigger in-progress state
        await branchManager.createBranch("feature-status", "main");
        await createFile(testRepo, "README.md", "Feature\n");
        await git.add("README.md");
        await git.commit("Feature");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "README.md", "Main\n");
        await git.add("README.md");
        await git.commit("Main");

        try {
          await mergeCoordinator.mergeBranch("feature/feature-status", "main");
        } catch {
          // Expected
        }

        expect(await mergeCoordinator.isMergeInProgress()).toBe(true);

        // Abort to clean up
        await mergeCoordinator.abortMerge();
      });

      it("gets list of conflicting files", async () => {
        // Create multiple conflicting files
        await branchManager.createBranch("feature-multi-conflict", "main");
        await createFile(testRepo, "file1.txt", "Feature 1\n");
        await createFile(testRepo, "file2.txt", "Feature 2\n");
        await git.add(".");
        await git.commit("Feature files");

        await branchManager.checkoutFull("main");
        await createFile(testRepo, "file1.txt", "Main 1\n");
        await createFile(testRepo, "file2.txt", "Main 2\n");
        await git.add(".");
        await git.commit("Main files");

        try {
          await mergeCoordinator.mergeBranch("feature/feature-multi-conflict", "main");
        } catch {
          // Expected
        }

        const conflicts = await mergeCoordinator.getConflicts();
        expect(conflicts).toContain("file1.txt");
        expect(conflicts).toContain("file2.txt");

        // Clean up
        await mergeCoordinator.abortMerge();
      });
    });

    describe("Error Handling", () => {
      it("throws error when working directory is not clean", async () => {
        // Create uncommitted changes
        await createFile(testRepo, "uncommitted.txt", "content");
        await git.add("uncommitted.txt");

        // Create a branch to merge
        await branchManager.createBranch("feature-dirty", "main");
        await git.commit("Temp commit");
        await branchManager.checkoutFull("main");

        // Make working directory dirty again
        await createFile(testRepo, "another.txt", "content");
        await git.add("another.txt");

        await expect(
          mergeCoordinator.mergeBranch("feature/feature-dirty", "main")
        ).rejects.toThrow(OrchestratorError);
      });
    });

    describe("Conflict Guidance", () => {
      it("formats helpful conflict guidance", () => {
        const guidance = mergeCoordinator.formatConflictGuidance(
          "feature/my-feature",
          "main",
          ["src/index.ts", "src/utils.ts"]
        );

        expect(guidance).toContain("feature/my-feature");
        expect(guidance).toContain("main");
        expect(guidance).toContain("src/index.ts");
        expect(guidance).toContain("src/utils.ts");
        expect(guidance).toContain("resolve conflicts");
      });
    });
  });

  // ===========================================================================
  // End-to-End Workflow
  // ===========================================================================

  describe("End-to-End Workflow", () => {
    it("simulates parallel agent branch workflow", async () => {
      // Simulate orchestrator creating branches for parallel agents
      const agentBranches = ["agent-1-feature-a", "agent-2-feature-b"];

      // Create agent branches
      for (const branch of agentBranches) {
        await branchManager.createBranch(branch, "main");

        // Each agent makes changes
        await createFile(testRepo, `${branch}.txt`, `Content from ${branch}`);
        await git.add(".");
        await git.commit(`Work from ${branch}`);

        await branchManager.checkoutFull("main");
      }

      // Verify all branches exist
      const branches = await branchManager.listBranches("feature/agent-*");
      expect(branches).toHaveLength(2);

      // Merge each branch back to main
      for (const branch of agentBranches) {
        await mergeCoordinator.mergeBranch(`feature/${branch}`, "main", {
          message: `Merge ${branch} into main`,
        });
      }

      // Verify all files exist on main
      const files = await listFiles(testRepo);
      expect(files).toContain("agent-1-feature-a.txt");
      expect(files).toContain("agent-2-feature-b.txt");

      // Clean up agent branches
      for (const branch of agentBranches) {
        await branchManager.deleteBranch(branch);
      }

      // Verify cleanup
      const remainingBranches = await branchManager.listBranches("feature/agent-*");
      expect(remainingBranches).toHaveLength(0);
    });
  });
});
