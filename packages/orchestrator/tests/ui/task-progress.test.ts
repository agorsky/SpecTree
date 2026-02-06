import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ora before importing TaskProgressDisplay
vi.mock("ora", () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    render: vi.fn().mockReturnThis(),
    text: "",
  };
  return { default: vi.fn(() => mockSpinner) };
});

import ora from "ora";
import { TaskProgressDisplay } from "../../src/ui/task-progress.js";

// Get mock spinner reference
function getMockSpinner() {
  return (ora as unknown as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
}

describe("TaskProgressDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Simulate TTY
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates with correct options", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Refactor startAgent",
    });
    expect(display).toBeDefined();
  });

  it("creates ora spinner on start()", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();

    expect(ora).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "cyan",
        spinner: "dots",
      })
    );
    const spinner = getMockSpinner();
    expect(spinner.start).toHaveBeenCalled();
  });

  it("updates spinner text on setActivity()", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();

    display.setActivity("Reading file...");
    const spinner = getMockSpinner();
    expect(spinner.text).toContain("Reading file...");
  });

  it("tracks message count", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();

    display.setActivity("Reading file...");
    display.incrementMessageCount();
    display.incrementMessageCount();
    display.incrementMessageCount();

    const spinner = getMockSpinner();
    // The spinner text should reflect the updated count
    expect(spinner.text).toContain("3 msgs");
  });

  it("stores milestones with elapsed time", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
      showMilestones: true,
    });
    display.start();

    // Advance time by 12 seconds
    vi.advanceTimersByTime(12000);

    display.logMilestone("Created new file");

    // Milestone should have been logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("12s")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Created new file")
    );

    consoleSpy.mockRestore();
  });

  it("stops spinner with succeed on success", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();
    display.stop(true);

    const spinner = getMockSpinner();
    expect(spinner.succeed).toHaveBeenCalled();
  });

  it("stops spinner with fail on failure", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();
    display.stop(false);

    const spinner = getMockSpinner();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it("clears interval on stop()", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();

    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    display.stop(true);

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("formats elapsed time correctly", () => {
    const display = new TaskProgressDisplay({
      taskId: "ENG-67-1",
      taskTitle: "Test task",
    });
    display.start();

    // Advance 90 seconds (1m 30s)
    vi.advanceTimersByTime(90000);

    const spinner = getMockSpinner();
    expect(spinner.text).toContain("1m 30s");
  });

  describe("CI mode (non-TTY)", () => {
    beforeEach(() => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
      });
    });

    it("uses console.log instead of spinner", () => {
      const consoleSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});
      const display = new TaskProgressDisplay({
        taskId: "ENG-67-1",
        taskTitle: "Test task",
      });
      display.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("ENG-67-1")
      );
      consoleSpy.mockRestore();
    });
  });
});
