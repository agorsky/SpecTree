/**
 * Claude Code Session Management — high-level API for creating sessions,
 * sending prompts, and receiving streaming updates.
 *
 * Maintains the same interface contract as AcpSession/AcpSessionManager
 * for drop-in replacement in AgentPool and Orchestrator.
 */

import { EventEmitter } from "events";
import { randomUUID } from "crypto";

import { OrchestratorError, ErrorCode } from "../errors.js";
import { ClaudeCodeClient, type SpawnOptions } from "./client.js";
import type {
  ClaudeCodeClientOptions,
  ClaudeSessionOptions,
  ClaudeSessionStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// ClaudeCodeSession
// ---------------------------------------------------------------------------

export class ClaudeCodeSession extends EventEmitter {
  readonly sessionId: string;
  private readonly client: ClaudeCodeClient;
  private readonly options: ClaudeSessionOptions | undefined;
  private status: ClaudeSessionStatus = "idle";
  private lastContent = "";
  private currentReject: ((reason: Error) => void) | null = null;

  constructor(
    sessionId: string,
    client: ClaudeCodeClient,
    options?: ClaudeSessionOptions,
  ) {
    super();
    this.sessionId = sessionId;
    this.client = client;
    this.options = options;
  }

  getStatus(): ClaudeSessionStatus {
    return this.status;
  }

  // -----------------------------------------------------------------------
  // Prompt Operations
  // -----------------------------------------------------------------------

  /**
   * Send a prompt and return a message ID (UUID).
   * The prompt is executed asynchronously — listen for events to track progress.
   */
  async send(prompt: string): Promise<string> {
    if (this.status === "completed" || this.status === "failed") {
      throw new OrchestratorError(
        `Cannot send to session ${this.sessionId} in status "${this.status}"`,
        ErrorCode.AGENT_EXECUTION_FAILED,
        { context: { sessionId: this.sessionId, status: this.status } },
      );
    }

    if (this.status === "working") {
      throw new OrchestratorError(
        `Session ${this.sessionId} is already working on a prompt`,
        ErrorCode.AGENT_EXECUTION_FAILED,
        { context: { sessionId: this.sessionId, status: this.status } },
      );
    }

    this.status = "working";
    this.lastContent = "";

    const messageId = randomUUID();

    // Build spawn options from session options
    const spawnOptions: SpawnOptions = {};
    if (this.options?.workingDirectory) {
      spawnOptions.cwd = this.options.workingDirectory;
    }
    if (this.options?.env) {
      spawnOptions.env = this.options.env;
    }

    // Create a new ClaudeCodeClient with session-specific overrides
    const sessionClient = this.buildSessionClient();

    // Execute asynchronously — wire events
    sessionClient.executePrompt(prompt, spawnOptions)
      .then((result) => {
        this.status = "completed";
        this.lastContent = result.result;
        (this as EventEmitter).emit("complete", result.result);
      })
      .catch((err: unknown) => {
        this.status = "failed";
        const error = err instanceof Error
          ? err
          : new OrchestratorError(
              String(err),
              ErrorCode.AGENT_EXECUTION_FAILED,
              { context: { sessionId: this.sessionId } },
            );
        (this as EventEmitter).emit("error", error);
      });

    // Forward client events to session
    this.wireClientEvents(sessionClient);

    return messageId;
  }

  /**
   * Send a prompt and wait for the complete result.
   * Returns the final content string or throws on error/timeout.
   */
  async sendAndWait(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? 300_000; // 5 minutes default

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      this.currentReject = reject;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.currentReject = null;
        reject(
          new OrchestratorError(
            `Session ${this.sessionId} sendAndWait timed out after ${timeout}ms`,
            ErrorCode.AGENT_TIMEOUT,
            {
              context: { sessionId: this.sessionId, timeoutMs: timeout },
              recoveryHint: "The task may be too complex. Consider breaking it into smaller subtasks.",
            },
          ),
        );
      }, timeout);

      const onComplete = (content: string) => {
        if (settled) return;
        settled = true;
        this.currentReject = null;
        clearTimeout(timer);
        cleanup();
        resolve(content);
      };

      const onError = (error: Error) => {
        if (settled) return;
        settled = true;
        this.currentReject = null;
        clearTimeout(timer);
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        this.removeListener("complete", onComplete);
        this.removeListener("error", onError);
      };

      this.on("complete", onComplete);
      this.on("error", onError);

      this.send(prompt).catch((err: unknown) => {
        if (settled) return;
        settled = true;
        this.currentReject = null;
        clearTimeout(timer);
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /**
   * Cancel the current prompt execution.
   */
  async cancel(): Promise<void> {
    if (this.currentReject) {
      this.currentReject(
        new OrchestratorError(
          `Session ${this.sessionId} cancelled`,
          ErrorCode.AGENT_EXECUTION_FAILED,
          { context: { sessionId: this.sessionId } },
        ),
      );
      this.currentReject = null;
    }
    this.status = "idle";
  }

  /**
   * Destroy the session and clean up resources.
   */
  async destroy(): Promise<void> {
    await this.cancel();
    this.removeAllListeners();
    this.status = "completed";
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Build a session-specific client with option overrides.
   */
  private buildSessionClient(): ClaudeCodeClient {
    if (!this.options) return this.client;

    // Build options object, only including defined values
    const opts: ClaudeCodeClientOptions = {
      claudePath: (this.client as any).claudePath as string,
      skipPermissions: this.options.skipPermissions ?? (this.client as any).skipPermissions as boolean,
      requestTimeout: (this.client as any).requestTimeout as number,
    };

    const model = this.options.model ?? (this.client as any).model;
    if (model) opts.model = model as string;

    const systemPrompt = this.options.systemPrompt ?? this.options.systemMessage ?? (this.client as any).systemPrompt;
    if (systemPrompt) opts.systemPrompt = systemPrompt as string;

    if (this.options.env) opts.env = this.options.env;

    const allowedTools = this.options.allowedTools ?? (this.client as any).allowedTools;
    if (allowedTools) opts.allowedTools = allowedTools as string[];

    return new ClaudeCodeClient(opts);
  }

  /**
   * Forward client events to session EventEmitter.
   */
  private wireClientEvents(client: ClaudeCodeClient): void {
    client.on("text", (content: string) => {
      this.lastContent += content;
      (this as EventEmitter).emit("text", content);
    });

    client.on("tool_call", (toolName: string, args: unknown) => {
      (this as EventEmitter).emit("tool_call", toolName, args);
    });
  }
}

// ---------------------------------------------------------------------------
// ClaudeCodeSessionManager
// ---------------------------------------------------------------------------

export class ClaudeCodeSessionManager {
  private readonly client: ClaudeCodeClient;
  private readonly sessions = new Map<string, ClaudeCodeSession>();

  constructor(client: ClaudeCodeClient) {
    this.client = client;
  }

  /**
   * Create a new session. Unlike AcpSessionManager, this does not make
   * a network call — the actual claude process is spawned on send().
   */
  async createSession(options?: ClaudeSessionOptions): Promise<ClaudeCodeSession> {
    const sessionId = randomUUID();
    const session = new ClaudeCodeSession(sessionId, this.client, options);
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(id: string): ClaudeCodeSession | undefined {
    return this.sessions.get(id);
  }

  async destroySession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await session.destroy();
      this.sessions.delete(id);
    }
  }

  async destroyAll(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      destroyPromises.push(session.destroy());
    }
    await Promise.all(destroyPromises);
    this.sessions.clear();
  }

  get activeSessions(): number {
    return this.sessions.size;
  }
}
