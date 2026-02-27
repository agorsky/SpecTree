/**
 * Claude Code Client — spawns `claude -p` as a subprocess per prompt and
 * parses stream-json output from stdout.
 *
 * Unlike AcpClient which maintains one long-lived process with JSON-RPC 2.0,
 * each prompt spawns a fresh `claude` CLI process.
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

import { OrchestratorError, ErrorCode } from "../errors.js";
import type {
  ClaudeCodeClientOptions,
  ClaudeStreamEvent,
} from "./types.js";
import {
  isAssistantEvent,
  isResultEvent,
  isSystemEvent,
} from "./types.js";

const DEFAULT_CLAUDE_PATH = "claude";
const DEFAULT_REQUEST_TIMEOUT_MS = 300_000; // 5 minutes
const KILL_TIMEOUT_MS = 5_000;

/**
 * Options for spawning a Claude process.
 */
export interface SpawnOptions {
  /** Working directory for the process. */
  cwd?: string;
  /** Additional environment variables. */
  env?: Record<string, string>;
  /** Override timeout for this specific execution. */
  timeoutMs?: number;
}

export class ClaudeCodeClient extends EventEmitter {
  private readonly claudePath: string;
  private readonly model: string | undefined;
  private readonly skipPermissions: boolean;
  private readonly mcpConfigPath: string | undefined;
  private readonly systemPrompt: string | undefined;
  private readonly appendSystemPrompt: string | undefined;
  private readonly extraArgs: string[];
  private readonly extraEnv: Record<string, string> | undefined;
  private readonly requestTimeout: number;
  private readonly maxTurns: number | undefined;
  private readonly allowedTools: string[] | undefined;

  constructor(options?: ClaudeCodeClientOptions) {
    super();
    this.claudePath = options?.claudePath ?? DEFAULT_CLAUDE_PATH;
    this.model = options?.model;
    this.skipPermissions = options?.skipPermissions ?? true;
    this.mcpConfigPath = options?.mcpConfigPath;
    this.systemPrompt = options?.systemPrompt;
    this.appendSystemPrompt = options?.appendSystemPrompt;
    this.extraArgs = options?.args ?? [];
    this.extraEnv = options?.env;
    this.requestTimeout = options?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxTurns = options?.maxTurns;
    this.allowedTools = options?.allowedTools;
  }

  // -----------------------------------------------------------------------
  // CLI Argument Building
  // -----------------------------------------------------------------------

  /**
   * Build the CLI argument array for a given prompt.
   */
  buildArgs(prompt: string): string[] {
    const args: string[] = [
      "--print",
      prompt,
      "--output-format",
      "stream-json",
    ];

    if (this.model) {
      args.push("--model", this.model);
    }

    if (this.skipPermissions) {
      args.push("--dangerously-skip-permissions");
    }

    if (this.mcpConfigPath) {
      args.push("--mcp-config", this.mcpConfigPath);
    }

    if (this.systemPrompt) {
      args.push("--system-prompt", this.systemPrompt);
    }

    if (this.appendSystemPrompt) {
      args.push("--append-system-prompt", this.appendSystemPrompt);
    }

    if (this.maxTurns !== undefined) {
      args.push("--max-turns", String(this.maxTurns));
    }

    if (this.allowedTools && this.allowedTools.length > 0) {
      args.push("--allowedTools", ...this.allowedTools);
    }

    args.push(...this.extraArgs);

    return args;
  }

  // -----------------------------------------------------------------------
  // Process Spawn
  // -----------------------------------------------------------------------

  /**
   * Spawn a claude CLI process with the given prompt.
   * Returns the raw ChildProcess — callers are responsible for cleanup.
   */
  spawnProcess(prompt: string, options?: SpawnOptions): ChildProcess {
    const args = this.buildArgs(prompt);
    const env = this.extraEnv || options?.env
      ? { ...process.env, ...this.extraEnv, ...options?.env }
      : process.env;

    try {
      return spawn(this.claudePath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: options?.cwd,
        env,
      });
    } catch (err) {
      throw new OrchestratorError(
        `Failed to spawn Claude Code process: ${this.claudePath}`,
        ErrorCode.AGENT_SPAWN_FAILED,
        {
          context: { claudePath: this.claudePath, args },
          recoveryHint: "Ensure the claude CLI is installed and the path is correct.",
          cause: err instanceof Error ? err : new Error(String(err)),
        },
      );
    }
  }

  // -----------------------------------------------------------------------
  // Stream-JSON Parser
  // -----------------------------------------------------------------------

  /**
   * Parse stdout stream-json output line by line.
   * Emits typed ClaudeStreamEvent objects via callback.
   */
  parseStreamOutput(
    proc: ChildProcess,
    onEvent: (event: ClaudeStreamEvent) => void,
  ): void {
    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          // Malformed JSON — skip
          continue;
        }

        const event = parsed as unknown as ClaudeStreamEvent;
        if (isAssistantEvent(event) || isResultEvent(event) || isSystemEvent(event)) {
          onEvent(event);
        }
      }
    });
  }

  // -----------------------------------------------------------------------
  // Process Kill
  // -----------------------------------------------------------------------

  /**
   * Kill a process with SIGTERM, then SIGKILL after timeout.
   */
  async kill(proc: ChildProcess): Promise<void> {
    if (proc.exitCode !== null || proc.killed) return;

    return new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // process may already be dead
        }
        resolve();
      }, KILL_TIMEOUT_MS);

      proc.once("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });

      try {
        proc.kill("SIGTERM");
      } catch {
        clearTimeout(killTimer);
        resolve();
      }
    });
  }

  // -----------------------------------------------------------------------
  // High-Level Prompt Execution
  // -----------------------------------------------------------------------

  /**
   * Execute a prompt and return the final result text.
   *
   * Spawns a fresh claude process, parses stream-json events,
   * emits intermediate events, and waits for completion or timeout.
   */
  executePrompt(prompt: string, options?: SpawnOptions): Promise<{
    result: string;
    costUsd?: number;
    durationMs?: number;
    sessionId?: string;
  }> {
    const timeoutMs = options?.timeoutMs ?? this.requestTimeout;

    return new Promise((resolve, reject) => {
      let proc: ChildProcess;
      try {
        proc = this.spawnProcess(prompt, options);
      } catch (err) {
        reject(err);
        return;
      }

      let settled = false;
      let lastContent = "";
      let stderr = "";
      let resultData: {
        result: string;
        costUsd?: number;
        durationMs?: number;
        sessionId?: string;
      } | null = null;

      // Timeout handler
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        void this.kill(proc).then(() => {
          reject(
            new OrchestratorError(
              `Claude Code prompt timed out after ${timeoutMs}ms`,
              ErrorCode.AGENT_TIMEOUT,
              {
                context: { timeoutMs, prompt: prompt.substring(0, 200) },
                recoveryHint: "The task may be too complex. Consider breaking it into smaller subtasks.",
              },
            ),
          );
        });
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
      };

      // Capture stderr
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // Parse stream-json events
      this.parseStreamOutput(proc, (event) => {
        if (isAssistantEvent(event)) {
          for (const block of event.message.content) {
            if (block.type === "text") {
              lastContent += block.text;
              (this as EventEmitter).emit("text", block.text, event.session_id);
            } else if (block.type === "tool_use") {
              (this as EventEmitter).emit("tool_call", block.name, block.input, event.session_id);
            }
          }
        } else if (isResultEvent(event)) {
          resultData = {
            result: event.result || lastContent,
            costUsd: event.cost_usd,
            durationMs: event.duration_ms,
            sessionId: event.session_id,
          };

          if (event.subtype === "error" || event.is_error) {
            (this as EventEmitter).emit("error", event.result, event.session_id);
          } else {
            (this as EventEmitter).emit("complete", resultData.result, event.session_id);
          }
        } else if (isSystemEvent(event)) {
          (this as EventEmitter).emit("system", event.message, event.session_id);
        }
      });

      // Handle process error
      proc.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(
          new OrchestratorError(
            `Claude Code process error: ${err.message}`,
            ErrorCode.AGENT_SPAWN_FAILED,
            { cause: err },
          ),
        );
      });

      // Handle process exit
      proc.on("exit", (code: number | null, signal: string | null) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (code === 0 || resultData) {
          // If we have result data from a ResultEvent, use it
          if (resultData) {
            if (resultData.result || lastContent) {
              resolve({
                ...resultData,
                result: resultData.result || lastContent,
              });
            } else {
              resolve({ result: lastContent });
            }
          } else {
            resolve({ result: lastContent });
          }
        } else {
          // Non-zero exit
          const errorMessage = stderr.trim() || `Claude Code exited with code ${code}`;
          reject(
            new OrchestratorError(
              errorMessage,
              ErrorCode.AGENT_EXECUTION_FAILED,
              {
                context: { exitCode: code, signal, stderr: stderr.substring(0, 1000) },
                recoveryHint: "Check the claude CLI installation and API key configuration.",
              },
            ),
          );
        }
      });
    });
  }
}
