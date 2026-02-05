/**
 * Unit tests for Progress Display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProgressDisplay, createProgressDisplay } from "../../src/ui/progress.js";
import type { RunResult } from "../../src/orchestrator/index.js";

// Mock console methods
const mockConsoleLog = vi.fn();
const mockConsoleClear = vi.fn();

describe("ProgressDisplay", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(mockConsoleLog);
    vi.spyOn(console, "clear").mockImplementation(mockConsoleClear);
    mockConsoleLog.mockClear();
    mockConsoleClear.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("creates with epic name and total items", () => {
      const display = new ProgressDisplay("Test Epic", 5);
      expect(display.completedCount).toBe(0);
      expect(display.failedCount).toBe(0);
      expect(display.progressPercent).toBe(0);
    });

    it("accepts options", () => {
      const display = new ProgressDisplay("Test Epic", 5, {
        clearScreen: false,
        showCompleted: false,
        barWidth: 50,
      });
      expect(display).toBeDefined();
    });
  });

  describe("start", () => {
    it("outputs header", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Epic: Test Epic")
      );
    });

    it("is idempotent", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      const callCount = mockConsoleLog.mock.calls.length;
      display.start();
      // Should not add more calls
      expect(mockConsoleLog.mock.calls.length).toBe(callCount);
    });
  });

  describe("setCurrentItem", () => {
    it("updates current item", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.setCurrentItem("COM-1", "Database schema");

      // In non-TTY mode, outputs a log
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("COM-1")
      );
    });
  });

  describe("markComplete", () => {
    it("increments completed count", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();

      display.markComplete("COM-1", "Task 1");
      expect(display.completedCount).toBe(1);
      expect(display.progressPercent).toBe(20);

      display.markComplete("COM-2", "Task 2");
      expect(display.completedCount).toBe(2);
      expect(display.progressPercent).toBe(40);
    });

    it("outputs completion message", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.markComplete("COM-1", "Task 1");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("COM-1 completed")
      );
    });

    it("uses current item title if not provided", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      display.setCurrentItem("COM-1", "Current Task");
      mockConsoleLog.mockClear();

      display.markComplete("COM-1");
      expect(display.completedCount).toBe(1);
    });
  });

  describe("markFailed", () => {
    it("increments failed count", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();

      display.markFailed("COM-1", "Network error", "Task 1");
      expect(display.failedCount).toBe(1);
      expect(display.progressPercent).toBe(20); // Failed items still count toward progress
    });

    it("outputs failure message with error", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.markFailed("COM-1", "Something went wrong", "Task 1");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("COM-1 failed")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Something went wrong")
      );
    });
  });

  describe("updateProgress", () => {
    it("outputs progress in CI mode", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.updateProgress(50);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("50%")
      );
    });
  });

  describe("info/warn/error", () => {
    it("outputs info message", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.info("Information message");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Information message")
      );
    });

    it("outputs warning message", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.warn("Warning message");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Warning message")
      );
    });

    it("outputs error message", () => {
      const display = new ProgressDisplay("Test Epic", 5, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      display.error("Error message");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Error message")
      );
    });
  });

  describe("stop", () => {
    it("outputs summary for successful run", () => {
      const display = new ProgressDisplay("Test Epic", 3, { clearScreen: false });
      display.start();
      display.markComplete("COM-1", "Task 1");
      display.markComplete("COM-2", "Task 2");
      display.markComplete("COM-3", "Task 3");
      mockConsoleLog.mockClear();

      const result: RunResult = {
        success: true,
        completedItems: ["COM-1", "COM-2", "COM-3"],
        failedItems: [],
        duration: 5000,
        summary: "All tasks completed",
      };

      display.stop(result);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("completed successfully")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("5.0s")
      );
    });

    it("outputs summary for failed run", () => {
      const display = new ProgressDisplay("Test Epic", 3, { clearScreen: false });
      display.start();
      display.markComplete("COM-1", "Task 1");
      display.markFailed("COM-2", "Network error", "Task 2");
      mockConsoleLog.mockClear();

      const result: RunResult = {
        success: false,
        completedItems: ["COM-1"],
        failedItems: ["COM-2"],
        duration: 3000,
      };

      display.stop(result);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("with failures")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Failed: 1")
      );
    });

    it("is idempotent", () => {
      const display = new ProgressDisplay("Test Epic", 3, { clearScreen: false });
      display.start();
      mockConsoleLog.mockClear();

      const result: RunResult = {
        success: true,
        completedItems: [],
        failedItems: [],
        duration: 1000,
      };

      display.stop(result);
      const callCount = mockConsoleLog.mock.calls.length;
      display.stop(result);
      // Should not add more calls
      expect(mockConsoleLog.mock.calls.length).toBe(callCount);
    });

    it("does nothing if never started", () => {
      const display = new ProgressDisplay("Test Epic", 3, { clearScreen: false });

      const result: RunResult = {
        success: true,
        completedItems: [],
        failedItems: [],
        duration: 1000,
      };

      display.stop(result);
      // Should not have any summary output
      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining("completed")
      );
    });
  });

  describe("progressPercent", () => {
    it("calculates correctly", () => {
      const display = new ProgressDisplay("Test Epic", 4, { clearScreen: false });
      display.start();

      expect(display.progressPercent).toBe(0);

      display.markComplete("1");
      expect(display.progressPercent).toBe(25);

      display.markFailed("2", "error");
      expect(display.progressPercent).toBe(50);

      display.markComplete("3");
      expect(display.progressPercent).toBe(75);

      display.markComplete("4");
      expect(display.progressPercent).toBe(100);
    });

    it("handles zero total items", () => {
      const display = new ProgressDisplay("Test Epic", 0, { clearScreen: false });
      expect(display.progressPercent).toBe(0);
    });
  });
});

describe("createProgressDisplay", () => {
  it("creates a ProgressDisplay instance", () => {
    const display = createProgressDisplay("Test Epic", 5);
    expect(display).toBeInstanceOf(ProgressDisplay);
  });

  it("passes options to constructor", () => {
    const display = createProgressDisplay("Test Epic", 5, { barWidth: 50 });
    expect(display).toBeInstanceOf(ProgressDisplay);
  });
});
