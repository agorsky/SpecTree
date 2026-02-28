/**
 * Unit tests for ClaudeCodeClient
 *
 * Tests verify:
 * - CLI argument building for all config combinations
 * - Stream-json parser handles all event types
 * - Stream-json parser handles malformed JSON and partial lines
 * - Process exit code handling (0=success, non-zero=error)
 * - Timeout triggers SIGTERM→SIGKILL sequence
 * - Stderr captured in error context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter, Readable, Writable } from "events";
import type { ChildProcess } from "child_process";
import { ClaudeCodeClient } from "../../src/claude/client.js";
import type { AssistantEvent, ResultEvent, SystemEvent } from "../../src/claude/types.js";

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
const mockSpawn = vi.mocked(spawn);

// =============================================================================
// Test Helpers
// =============================================================================

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as unknown as ChildProcess;
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = new EventEmitter() as unknown as Writable;
  (stdin as any).writable = true;

  Object.defineProperty(proc, "stdout", { value: stdout, writable: true });
  Object.defineProperty(proc, "stderr", { value: stderr, writable: true });
  Object.defineProperty(proc, "stdin", { value: stdin, writable: true });
  Object.defineProperty(proc, "exitCode", { value: null, writable: true });
  Object.defineProperty(proc, "killed", { value: false, writable: true });

  (proc as any).kill = vi.fn();

  return proc;
}

function emitStdout(proc: ChildProcess, data: string): void {
  proc.stdout!.emit("data", Buffer.from(data));
}

function emitStderr(proc: ChildProcess, data: string): void {
  proc.stderr!.emit("data", Buffer.from(data));
}

function emitExit(proc: ChildProcess, code: number | null, signal: string | null = null): void {
  (proc as any).exitCode = code;
  (proc as EventEmitter).emit("exit", code, signal);
}

// =============================================================================
// Tests
// =============================================================================

describe("ClaudeCodeClient", () => {
  let client: ClaudeCodeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeCodeClient();
  });

  // ---------------------------------------------------------------------------
  // buildArgs
  // ---------------------------------------------------------------------------

  describe("buildArgs", () => {
    it("should produce basic args with defaults", () => {
      const args = client.buildArgs("say hello");
      expect(args).toEqual([
        "--print", "say hello",
        "--output-format", "stream-json",
        "--dangerously-skip-permissions",
      ]);
    });

    it("should include model flag when set", () => {
      const c = new ClaudeCodeClient({ model: "opus" });
      const args = c.buildArgs("test");
      expect(args).toContain("--model");
      expect(args).toContain("opus");
    });

    it("should omit skip-permissions when disabled", () => {
      const c = new ClaudeCodeClient({ skipPermissions: false });
      const args = c.buildArgs("test");
      expect(args).not.toContain("--dangerously-skip-permissions");
    });

    it("should include mcp-config flag", () => {
      const c = new ClaudeCodeClient({ mcpConfigPath: "/tmp/mcp.json" });
      const args = c.buildArgs("test");
      expect(args).toContain("--mcp-config");
      expect(args).toContain("/tmp/mcp.json");
    });

    it("should include system-prompt flag", () => {
      const c = new ClaudeCodeClient({ systemPrompt: "You are a test bot" });
      const args = c.buildArgs("test");
      expect(args).toContain("--system-prompt");
      expect(args).toContain("You are a test bot");
    });

    it("should include max-turns flag", () => {
      const c = new ClaudeCodeClient({ maxTurns: 5 });
      const args = c.buildArgs("test");
      expect(args).toContain("--max-turns");
      expect(args).toContain("5");
    });

    it("should include allowedTools", () => {
      const c = new ClaudeCodeClient({ allowedTools: ["Read", "Edit", "Bash"] });
      const args = c.buildArgs("test");
      expect(args).toContain("--allowedTools");
      expect(args).toContain("Read");
      expect(args).toContain("Edit");
      expect(args).toContain("Bash");
    });

    it("should append extra args", () => {
      const c = new ClaudeCodeClient({ args: ["--verbose", "--debug"] });
      const args = c.buildArgs("test");
      expect(args).toContain("--verbose");
      expect(args).toContain("--debug");
    });

    it("should include all flags together", () => {
      const c = new ClaudeCodeClient({
        model: "sonnet",
        skipPermissions: true,
        mcpConfigPath: "/tmp/mcp.json",
        systemPrompt: "test prompt",
        maxTurns: 3,
        allowedTools: ["Read"],
      });
      const args = c.buildArgs("hello");
      expect(args).toContain("--model");
      expect(args).toContain("--dangerously-skip-permissions");
      expect(args).toContain("--mcp-config");
      expect(args).toContain("--system-prompt");
      expect(args).toContain("--max-turns");
      expect(args).toContain("--allowedTools");
    });
  });

  // ---------------------------------------------------------------------------
  // parseStreamOutput
  // ---------------------------------------------------------------------------

  describe("parseStreamOutput", () => {
    it("should parse assistant text events", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const assistantEvent: AssistantEvent = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          stop_sequence: null,
        },
        session_id: "sess-1",
      };

      emitStdout(proc, JSON.stringify(assistantEvent) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("assistant");
      expect(events[0].message.content[0].text).toBe("hello");
    });

    it("should parse assistant tool_use events", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const assistantEvent: AssistantEvent = {
        type: "assistant",
        message: {
          id: "msg-2",
          type: "message",
          role: "assistant",
          content: [{ type: "tool_use", id: "tool-1", name: "Read", input: { file_path: "/tmp/test" } }],
          model: "claude-sonnet-4-6",
          stop_reason: "tool_use",
          stop_sequence: null,
        },
        session_id: "sess-1",
      };

      emitStdout(proc, JSON.stringify(assistantEvent) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].message.content[0].type).toBe("tool_use");
      expect(events[0].message.content[0].name).toBe("Read");
    });

    it("should parse result success events", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "success",
        result: "Task completed",
        cost_usd: 0.01,
        duration_ms: 5000,
        session_id: "sess-1",
      };

      emitStdout(proc, JSON.stringify(resultEvent) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("result");
      expect(events[0].subtype).toBe("success");
      expect(events[0].cost_usd).toBe(0.01);
    });

    it("should parse result error events", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "error",
        result: "Something went wrong",
        is_error: true,
      };

      emitStdout(proc, JSON.stringify(resultEvent) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].subtype).toBe("error");
    });

    it("should parse system events", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const systemEvent: SystemEvent = {
        type: "system",
        subtype: "init",
        message: "Claude Code initialized",
        session_id: "sess-1",
      };

      emitStdout(proc, JSON.stringify(systemEvent) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("system");
    });

    it("should skip malformed JSON lines", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      emitStdout(proc, "not json\n");
      emitStdout(proc, "{invalid json}\n");

      expect(events).toHaveLength(0);
    });

    it("should skip empty lines", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      emitStdout(proc, "\n\n  \n");

      expect(events).toHaveLength(0);
    });

    it("should handle partial lines across chunks", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "success",
        result: "done",
      };
      const json = JSON.stringify(resultEvent);

      // Split across two chunks
      const mid = Math.floor(json.length / 2);
      emitStdout(proc, json.substring(0, mid));
      emitStdout(proc, json.substring(mid) + "\n");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("result");
    });

    it("should handle multiple events in one chunk", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const event1: SystemEvent = { type: "system", subtype: "init", message: "init" };
      const event2: ResultEvent = { type: "result", subtype: "success", result: "done" };

      emitStdout(proc, JSON.stringify(event1) + "\n" + JSON.stringify(event2) + "\n");

      expect(events).toHaveLength(2);
    });

    it("should skip events with unknown type fields", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      emitStdout(proc, '{"type":"unknown_type","data":"test"}\n');

      expect(events).toHaveLength(0);
    });

    it("should throw OrchestratorError when proc.stdout is null", () => {
      const proc = createMockProcess();
      Object.defineProperty(proc, "stdout", { value: null, writable: true });

      expect(() => {
        client.parseStreamOutput(proc, () => {});
      }).toThrow("Claude Code process has no stdout pipe");
    });

    it("should flush remaining buffer on stdout end", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "success",
        result: "final",
      };

      // Send data without trailing newline
      emitStdout(proc, JSON.stringify(resultEvent));
      expect(events).toHaveLength(0);

      // Emit end — should flush the buffer
      proc.stdout!.emit("end");
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("result");
      expect(events[0].result).toBe("final");
    });

    it("should not emit on end if buffer is empty", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      // End with nothing in buffer
      proc.stdout!.emit("end");
      expect(events).toHaveLength(0);
    });

    it("should not emit on end if buffer contains malformed JSON", () => {
      const proc = createMockProcess();
      const events: any[] = [];

      client.parseStreamOutput(proc, (event) => events.push(event));

      emitStdout(proc, "{broken json");
      proc.stdout!.emit("end");
      expect(events).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // executePrompt
  // ---------------------------------------------------------------------------

  describe("executePrompt", () => {
    it("should resolve with result on successful completion", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = client.executePrompt("say hello");

      // Emit a result event then exit
      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "success",
        result: "hello",
        cost_usd: 0.01,
        duration_ms: 1000,
        session_id: "sess-1",
      };
      emitStdout(proc, JSON.stringify(resultEvent) + "\n");
      emitExit(proc, 0);

      const result = await promise;
      expect(result.result).toBe("hello");
      expect(result.costUsd).toBe(0.01);
      expect(result.durationMs).toBe(1000);
      expect(result.sessionId).toBe("sess-1");
    });

    it("should reject on non-zero exit code", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = client.executePrompt("fail");

      emitStderr(proc, "Error: authentication failed");
      emitExit(proc, 1);

      await expect(promise).rejects.toThrow("authentication failed");
    });

    it("should reject on process error", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = client.executePrompt("test");

      (proc as EventEmitter).emit("error", new Error("ENOENT"));

      await expect(promise).rejects.toThrow("ENOENT");
    });

    it("should aggregate text from assistant events", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = client.executePrompt("test");

      const assistantEvent: AssistantEvent = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "hello world" }],
          model: "claude-sonnet-4-6",
          stop_reason: "end_turn",
          stop_sequence: null,
        },
        session_id: "sess-1",
      };
      emitStdout(proc, JSON.stringify(assistantEvent) + "\n");

      const resultEvent: ResultEvent = {
        type: "result",
        subtype: "success",
        result: "hello world",
      };
      emitStdout(proc, JSON.stringify(resultEvent) + "\n");
      emitExit(proc, 0);

      const result = await promise;
      expect(result.result).toBe("hello world");
    });

    it("should emit text and tool_call events", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const textEvents: string[] = [];
      const toolCalls: { name: string; args: unknown }[] = [];
      client.on("text", (text: string) => textEvents.push(text));
      client.on("tool_call", (name: string, args: unknown) => toolCalls.push({ name, args }));

      const promise = client.executePrompt("test");

      // Text event
      const textEvent: AssistantEvent = {
        type: "assistant",
        message: {
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "thinking..." }],
          model: "claude-sonnet-4-6",
          stop_reason: null,
          stop_sequence: null,
        },
        session_id: "sess-1",
      };
      emitStdout(proc, JSON.stringify(textEvent) + "\n");

      // Tool call event
      const toolEvent: AssistantEvent = {
        type: "assistant",
        message: {
          id: "msg-2",
          type: "message",
          role: "assistant",
          content: [{ type: "tool_use", id: "t-1", name: "Read", input: { file_path: "/test" } }],
          model: "claude-sonnet-4-6",
          stop_reason: "tool_use",
          stop_sequence: null,
        },
        session_id: "sess-1",
      };
      emitStdout(proc, JSON.stringify(toolEvent) + "\n");

      const resultEvent: ResultEvent = { type: "result", subtype: "success", result: "done" };
      emitStdout(proc, JSON.stringify(resultEvent) + "\n");
      emitExit(proc, 0);

      await promise;

      expect(textEvents).toEqual(["thinking..."]);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe("Read");
    });

    it("should timeout and kill process", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const c = new ClaudeCodeClient({ requestTimeout: 5000 });
      const promise = c.executePrompt("slow task");

      // Advance past timeout
      vi.advanceTimersByTime(5001);

      // Simulate process exit after kill
      emitExit(proc, null, "SIGTERM");

      await expect(promise).rejects.toThrow("timed out");
      expect((proc as any).kill).toHaveBeenCalledWith("SIGTERM");

      vi.useRealTimers();
    });

    it("should reject on inactivity timeout when no events received", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const c = new ClaudeCodeClient({ inactivityTimeoutMs: 2000, requestTimeout: 30000 });
      const promise = c.executePrompt("idle task");

      // Advance past inactivity timeout (no events emitted)
      vi.advanceTimersByTime(2001);

      // Simulate process exit after kill
      emitExit(proc, null, "SIGTERM");

      await expect(promise).rejects.toThrow("inactive");
      expect((proc as any).kill).toHaveBeenCalledWith("SIGTERM");

      vi.useRealTimers();
    });

    it("should reset inactivity timer on each stream event", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const c = new ClaudeCodeClient({ inactivityTimeoutMs: 2000, requestTimeout: 30000 });
      const promise = c.executePrompt("active task");

      const systemEvent: SystemEvent = { type: "system", subtype: "init", message: "init", session_id: "s1" };

      // Advance 1.5s, emit event (resets timer)
      vi.advanceTimersByTime(1500);
      emitStdout(proc, JSON.stringify(systemEvent) + "\n");

      // Advance another 1.5s (total 3s, but only 1.5s since last event)
      vi.advanceTimersByTime(1500);
      // Should NOT have timed out yet

      // Now emit result and exit
      const resultEvent: ResultEvent = { type: "result", subtype: "success", result: "done" };
      emitStdout(proc, JSON.stringify(resultEvent) + "\n");
      emitExit(proc, 0);

      const result = await promise;
      expect(result.result).toBe("done");

      vi.useRealTimers();
    });

    it("should allow per-request inactivity timeout override via SpawnOptions", async () => {
      vi.useFakeTimers();
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const c = new ClaudeCodeClient({ inactivityTimeoutMs: 60000, requestTimeout: 300000 });
      const promise = c.executePrompt("test", { inactivityTimeoutMs: 1000 });

      // Advance past per-request inactivity timeout
      vi.advanceTimersByTime(1001);

      emitExit(proc, null, "SIGTERM");

      await expect(promise).rejects.toThrow("inactive");

      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // diagnostic and warning events
  // ---------------------------------------------------------------------------

  describe("diagnostic and warning events", () => {
    it("should emit diagnostic event for stderr output", async () => {
      const proc = createMockProcess();
      mockSpawn.mockReturnValue(proc);

      const diagnostics: string[] = [];
      client.on("diagnostic", (text: string) => diagnostics.push(text));

      const promise = client.executePrompt("test");

      emitStderr(proc, "debug: loading config\n");
      emitStderr(proc, "warn: slow response\n");

      const resultEvent: ResultEvent = { type: "result", subtype: "success", result: "done" };
      emitStdout(proc, JSON.stringify(resultEvent) + "\n");
      emitExit(proc, 0);

      await promise;

      expect(diagnostics).toEqual(["debug: loading config\n", "warn: slow response\n"]);
    });

    it("should emit warning event for malformed JSON lines", () => {
      const proc = createMockProcess();
      const warnings: { type: string; line: string }[] = [];

      client.on("warning", (w: { type: string; line: string }) => warnings.push(w));
      client.parseStreamOutput(proc, () => {});

      emitStdout(proc, "not-valid-json\n");
      emitStdout(proc, "{incomplete\n");

      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toEqual({ type: "malformed_json", line: "not-valid-json" });
      expect(warnings[1]).toEqual({ type: "malformed_json", line: "{incomplete" });
    });

    it("should emit warning for malformed JSON on end flush", () => {
      const proc = createMockProcess();
      const warnings: { type: string; line: string }[] = [];

      client.on("warning", (w: { type: string; line: string }) => warnings.push(w));
      client.parseStreamOutput(proc, () => {});

      emitStdout(proc, "{broken");
      proc.stdout!.emit("end");

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toEqual({ type: "malformed_json", line: "{broken" });
    });
  });

  // ---------------------------------------------------------------------------
  // kill
  // ---------------------------------------------------------------------------

  describe("kill", () => {
    it("should not kill already exited process", async () => {
      const proc = createMockProcess();
      (proc as any).exitCode = 0;

      await client.kill(proc);
      expect((proc as any).kill).not.toHaveBeenCalled();
    });

    it("should send SIGTERM first", async () => {
      const proc = createMockProcess();

      const promise = client.kill(proc);

      // Simulate exit after SIGTERM
      setTimeout(() => emitExit(proc, 0), 10);
      await promise;

      expect((proc as any).kill).toHaveBeenCalledWith("SIGTERM");
    });
  });
});
