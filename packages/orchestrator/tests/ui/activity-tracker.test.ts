import { describe, it, expect } from "vitest";
import { ActivityTracker } from "../../src/ui/activity-tracker.js";

describe("ActivityTracker", () => {
  describe("mapToolToActivity", () => {
    it("maps Read tool to file reading activity", () => {
      expect(
        ActivityTracker.mapToolToActivity("Read", { file_path: "/src/index.ts" })
      ).toBe("Reading file: /src/index.ts");
    });

    it("maps Edit tool to file editing activity", () => {
      expect(
        ActivityTracker.mapToolToActivity("Edit", { file_path: "/src/app.ts" })
      ).toBe("Editing file: /src/app.ts");
    });

    it("maps Write tool to file creating activity", () => {
      expect(
        ActivityTracker.mapToolToActivity("Write", {
          file_path: "/src/new-file.ts",
        })
      ).toBe("Creating file: /src/new-file.ts");
    });

    it("maps Bash tool with short command", () => {
      expect(
        ActivityTracker.mapToolToActivity("Bash", { command: "npm test" })
      ).toBe("Running: npm test");
    });

    it("maps Bash tool and truncates long command", () => {
      const longCommand =
        "npx vitest run --reporter=verbose --config=vitest.config.ts packages/orchestrator/tests/";
      const result = ActivityTracker.mapToolToActivity("Bash", {
        command: longCommand,
      });
      expect(result.length).toBeLessThanOrEqual(60); // "Running: " + ~50 chars
      expect(result).toContain("Running: ");
      expect(result).toContain("...");
    });

    it("maps Glob tool to file searching", () => {
      expect(
        ActivityTracker.mapToolToActivity("Glob", { pattern: "**/*.ts" })
      ).toBe("Searching files: **/*.ts");
    });

    it("maps Grep tool to code searching", () => {
      expect(
        ActivityTracker.mapToolToActivity("Grep", { pattern: "function\\s+\\w+" })
      ).toBe("Searching code: function\\s+\\w+");
    });

    it("maps log_progress to logging activity", () => {
      expect(ActivityTracker.mapToolToActivity("log_progress", {})).toBe(
        "Logging progress..."
      );
    });

    it("maps log_decision to recording decision", () => {
      expect(ActivityTracker.mapToolToActivity("log_decision", {})).toBe(
        "Recording decision..."
      );
    });

    it("maps link_code_file to linking activity", () => {
      expect(ActivityTracker.mapToolToActivity("link_code_file", {})).toBe(
        "Linking code file..."
      );
    });

    it("maps unknown tools to Processing...", () => {
      expect(ActivityTracker.mapToolToActivity("some_unknown_tool", {})).toBe(
        "Processing..."
      );
    });

    it("handles missing path gracefully", () => {
      expect(ActivityTracker.mapToolToActivity("Read", {})).toBe(
        "Reading file: ..."
      );
    });
  });

  describe("extractReasoning", () => {
    it("returns short messages as-is", () => {
      expect(ActivityTracker.extractReasoning("Hello world")).toBe(
        "Hello world"
      );
    });

    it("extracts first sentence from longer text", () => {
      const text =
        "I need to create a new file. Then I will modify the existing imports and add tests. After that we should verify everything works by running the full test suite.";
      expect(ActivityTracker.extractReasoning(text)).toBe(
        "I need to create a new file."
      );
    });

    it("truncates long messages without sentence boundaries", () => {
      const text = "a ".repeat(100);
      const result = ActivityTracker.extractReasoning(text, 50);
      expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(result).toContain("...");
    });

    it("strips markdown formatting", () => {
      const text = "## Heading\n**Bold text** with `code`";
      expect(ActivityTracker.extractReasoning(text)).toBe(
        "Heading\nBold text with"
      );
    });

    it("returns empty string for empty input", () => {
      expect(ActivityTracker.extractReasoning("")).toBe("");
    });
  });

  describe("isMilestone", () => {
    it("returns true for Edit", () => {
      expect(ActivityTracker.isMilestone("Edit")).toBe(true);
    });

    it("returns true for Write", () => {
      expect(ActivityTracker.isMilestone("Write")).toBe(true);
    });

    it("returns true for Bash", () => {
      expect(ActivityTracker.isMilestone("Bash")).toBe(true);
    });

    it("returns true for log_progress", () => {
      expect(ActivityTracker.isMilestone("log_progress")).toBe(true);
    });

    it("returns false for Read", () => {
      expect(ActivityTracker.isMilestone("Read")).toBe(false);
    });

    it("returns false for Grep", () => {
      expect(ActivityTracker.isMilestone("Grep")).toBe(false);
    });
  });
});
