/**
 * Unit tests for Agent Status Display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AgentStatusDisplay,
  createAgentStatusDisplay,
  renderProgressBar,
} from "../../src/ui/agent-status.js";
import type { Agent, AgentStatus } from "../../src/orchestrator/agent-pool.js";
import type { ExecutionItem } from "../../src/spectree/api-client.js";

// Helper to create a mock Agent
function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  const mockItem: ExecutionItem = {
    id: "item-1",
    identifier: overrides.taskId ?? "COM-5",
    title: "Test Task",
    type: "task",
    status: "todo",
  };

  return {
    id: overrides.id ?? "worker-1",
    taskId: overrides.taskId ?? "COM-5",
    branch: overrides.branch ?? "feature/COM-5",
    status: overrides.status ?? "idle",
    session: {} as Agent["session"],
    progress: overrides.progress ?? 0,
    startedAt: overrides.startedAt ?? new Date(),
    item: mockItem,
    ...overrides,
  } as Agent;
}

// Mock console methods
const mockConsoleLog = vi.fn();

describe("AgentStatusDisplay", () => {
  let outputBuffer: string[];
  let mockOutput: (text: string) => void;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(mockConsoleLog);
    mockConsoleLog.mockClear();
    outputBuffer = [];
    mockOutput = (text: string) => outputBuffer.push(text);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("creates with default options", () => {
      const display = new AgentStatusDisplay();
      expect(display.agentCount).toBe(0);
    });

    it("accepts options", () => {
      const display = new AgentStatusDisplay({
        maxAgents: 8,
        barWidth: 10,
        updateIntervalMs: 200,
        showBorders: false,
      });
      expect(display.agentCount).toBe(0);
    });
  });

  describe("addAgent", () => {
    it("adds an agent to tracking", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);

      expect(display.agentCount).toBe(1);
      const agents = display.getAgents();
      expect(agents[0].id).toBe("worker-1");
      expect(agents[0].taskId).toBe("COM-5");
    });

    it("logs in CI mode", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent({ id: "worker-2", taskId: "COM-6" });

      // Force non-TTY mode by accessing private property
      (display as unknown as { isTTY: boolean }).isTTY = false;

      display.addAgent(agent);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("worker-2")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("COM-6")
      );
    });
  });

  describe("updateAgent", () => {
    it("updates agent progress", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);
      display.updateAgent("worker-1", { progress: 50 });

      const agents = display.getAgents();
      expect(agents[0].progress).toBe(50);
    });

    it("updates agent status", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);
      display.updateAgent("worker-1", { status: "working" });

      const agents = display.getAgents();
      expect(agents[0].status).toBe("working");
    });

    it("updates current file", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);
      display.updateAgent("worker-1", { currentFile: "src/api/routes.ts" });

      const agents = display.getAgents();
      expect(agents[0].currentFile).toBe("src/api/routes.ts");
    });

    it("does nothing for unknown agent", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });

      // Should not throw
      display.updateAgent("unknown-agent", { progress: 50 });
      expect(display.agentCount).toBe(0);
    });

    it("logs completion in CI mode", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      (display as unknown as { isTTY: boolean }).isTTY = false;

      const agent = createMockAgent();
      display.addAgent(agent);
      mockConsoleLog.mockClear();

      display.updateAgent("worker-1", { status: "completed" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("completed")
      );
    });

    it("logs failure in CI mode", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      (display as unknown as { isTTY: boolean }).isTTY = false;

      const agent = createMockAgent();
      display.addAgent(agent);
      mockConsoleLog.mockClear();

      display.updateAgent("worker-1", { status: "failed" });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("failed")
      );
    });
  });

  describe("removeAgent", () => {
    it("removes an agent from tracking", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);
      expect(display.agentCount).toBe(1);

      display.removeAgent("worker-1");
      expect(display.agentCount).toBe(0);
    });

    it("does nothing for unknown agent", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const agent = createMockAgent();

      display.addAgent(agent);
      display.removeAgent("unknown-agent");

      expect(display.agentCount).toBe(1);
    });
  });

  describe("render", () => {
    it("renders empty state", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      const output = display.render();

      expect(output).toContain("No active agents");
    });

    it("renders single agent", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: true,
      });
      const agent = createMockAgent();

      display.addAgent(agent);
      const output = display.render();

      expect(output).toContain("Active Agents");
      expect(output).toContain("worker-1");
      expect(output).toContain("COM-5");
    });

    it("renders multiple agents", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: true,
      });

      display.addAgent(createMockAgent({ id: "worker-1", taskId: "COM-5" }));
      display.addAgent(createMockAgent({ id: "worker-2", taskId: "COM-6" }));

      const output = display.render();

      expect(output).toContain("worker-1");
      expect(output).toContain("worker-2");
      expect(output).toContain("COM-5");
      expect(output).toContain("COM-6");
    });

    it("renders table with borders", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: true,
      });
      const agent = createMockAgent();

      display.addAgent(agent);
      const output = display.render();

      expect(output).toContain("┌");
      expect(output).toContain("┴");
      expect(output).toContain("│");
      expect(output).toContain("Agent");
      expect(output).toContain("Task");
      expect(output).toContain("Branch");
      expect(output).toContain("Progress");
    });

    it("renders table without borders", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: false,
      });
      const agent = createMockAgent({ status: "working" });

      display.addAgent(agent);
      const output = display.render();

      expect(output).not.toContain("┌");
      expect(output).toContain("worker-1");
      expect(output).toContain("COM-5");
    });

    it("renders agent activity for working agents", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: true,
      });
      const agent = createMockAgent({ status: "working" });

      display.addAgent(agent);
      display.updateAgent("worker-1", { currentFile: "src/api.ts" });

      const output = display.render();

      expect(output).toContain("src/api.ts");
    });

    it("renders progress percentage", () => {
      const display = new AgentStatusDisplay({
        output: mockOutput,
        showBorders: true,
      });
      const agent = createMockAgent({ progress: 40 });

      display.addAgent(agent);
      const output = display.render();

      expect(output).toContain("40%");
    });
  });

  describe("startUpdating / stopUpdating", () => {
    it("starts and stops interval", () => {
      vi.useFakeTimers();
      const display = new AgentStatusDisplay({
        output: mockOutput,
        updateIntervalMs: 100,
      });

      // Force TTY mode
      (display as unknown as { isTTY: boolean }).isTTY = true;

      display.addAgent(createMockAgent());
      display.startUpdating();

      // Advance timer
      vi.advanceTimersByTime(300);

      // Should have called output multiple times
      expect(outputBuffer.length).toBeGreaterThan(0);

      display.stopUpdating();

      const countBeforeStop = outputBuffer.length;
      vi.advanceTimersByTime(300);

      // Should not have more calls after stop
      expect(outputBuffer.length).toBe(countBeforeStop);

      vi.useRealTimers();
    });

    it("is idempotent", () => {
      vi.useFakeTimers();
      const display = new AgentStatusDisplay({
        output: mockOutput,
        updateIntervalMs: 100,
      });
      (display as unknown as { isTTY: boolean }).isTTY = true;

      display.startUpdating();
      display.startUpdating(); // Should not create second interval
      display.stopUpdating();
      display.stopUpdating(); // Should not throw

      vi.useRealTimers();
    });

    it("does nothing in CI mode", () => {
      vi.useFakeTimers();
      const display = new AgentStatusDisplay({ output: mockOutput });
      (display as unknown as { isTTY: boolean }).isTTY = false;

      display.startUpdating();
      vi.advanceTimersByTime(300);

      // Should not have output since CI mode
      expect(outputBuffer.length).toBe(0);

      vi.useRealTimers();
    });
  });

  describe("getAgents", () => {
    it("returns all tracked agents", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });

      display.addAgent(createMockAgent({ id: "worker-1" }));
      display.addAgent(createMockAgent({ id: "worker-2" }));
      display.addAgent(createMockAgent({ id: "worker-3" }));

      const agents = display.getAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.id)).toEqual([
        "worker-1",
        "worker-2",
        "worker-3",
      ]);
    });
  });

  describe("clear", () => {
    it("clears the display in TTY mode", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      (display as unknown as { isTTY: boolean }).isTTY = true;
      (display as unknown as { lastRenderLineCount: number }).lastRenderLineCount = 5;

      display.clear();

      // Should have ANSI clear sequences
      expect(outputBuffer.join("")).toContain("\x1b[1A");
    });

    it("does nothing in CI mode", () => {
      const display = new AgentStatusDisplay({ output: mockOutput });
      (display as unknown as { isTTY: boolean }).isTTY = false;

      display.clear();

      expect(outputBuffer.length).toBe(0);
    });
  });
});

describe("createAgentStatusDisplay", () => {
  it("creates an AgentStatusDisplay instance", () => {
    const display = createAgentStatusDisplay();
    expect(display).toBeInstanceOf(AgentStatusDisplay);
  });

  it("passes options to constructor", () => {
    const display = createAgentStatusDisplay({ maxAgents: 8 });
    expect(display).toBeInstanceOf(AgentStatusDisplay);
  });
});

describe("renderProgressBar", () => {
  it("renders 0% progress", () => {
    const bar = renderProgressBar(0, 10);
    expect(bar).toContain("0%");
    expect(bar).toContain("░");
    expect(bar).not.toMatch(/█/); // No filled blocks at 0%
  });

  it("renders 50% progress", () => {
    const bar = renderProgressBar(50, 10);
    expect(bar).toContain("50%");
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });

  it("renders 100% progress", () => {
    const bar = renderProgressBar(100, 10);
    expect(bar).toContain("100%");
    expect(bar).toContain("█");
  });

  it("clamps values above 100", () => {
    const bar = renderProgressBar(150, 10);
    expect(bar).toContain("100%");
  });

  it("clamps values below 0", () => {
    const bar = renderProgressBar(-10, 10);
    expect(bar).toContain("0%");
  });

  it("respects custom width", () => {
    const bar5 = renderProgressBar(100, 5);
    const bar20 = renderProgressBar(100, 20);

    // Strip ANSI codes for comparison
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    expect(strip(bar5).replace(/\s/g, "").length).toBeLessThan(
      strip(bar20).replace(/\s/g, "").length
    );
  });
});

describe("AgentStatusDisplay status rendering", () => {
  let outputBuffer: string[];
  let mockOutput: (text: string) => void;

  beforeEach(() => {
    outputBuffer = [];
    mockOutput = (text: string) => outputBuffer.push(text);
  });

  const statuses: AgentStatus[] = ["idle", "working", "completed", "failed", "paused"];

  it.each(statuses)("renders %s status correctly", (status) => {
    const display = new AgentStatusDisplay({
      output: mockOutput,
      showBorders: true,
    });
    const agent = createMockAgent({ status });

    display.addAgent(agent);
    const output = display.render();

    // Should render without error
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("AgentStatusDisplay duration formatting", () => {
  let mockOutput: (text: string) => void;

  beforeEach(() => {
    mockOutput = () => {};
  });

  it("formats seconds correctly", () => {
    const display = new AgentStatusDisplay({
      output: mockOutput,
      showBorders: true,
    });
    const startedAt = new Date(Date.now() - 45000); // 45 seconds ago
    const agent = createMockAgent({ status: "working", startedAt });

    display.addAgent(agent);
    const output = display.render();

    expect(output).toContain("45s");
  });

  it("formats minutes and seconds correctly", () => {
    const display = new AgentStatusDisplay({
      output: mockOutput,
      showBorders: true,
    });
    const startedAt = new Date(Date.now() - 154000); // 2m 34s ago
    const agent = createMockAgent({ status: "working", startedAt });

    display.addAgent(agent);
    const output = display.render();

    expect(output).toMatch(/2m\s+34s/);
  });

  it("formats hours correctly", () => {
    const display = new AgentStatusDisplay({
      output: mockOutput,
      showBorders: true,
    });
    const startedAt = new Date(Date.now() - 3720000); // 1h 2m ago
    const agent = createMockAgent({ status: "working", startedAt });

    display.addAgent(agent);
    const output = display.render();

    expect(output).toMatch(/1h\s+2m/);
  });
});
