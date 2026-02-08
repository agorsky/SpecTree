/**
 * ACP Session Management — high-level API for creating sessions, sending
 * prompts, and receiving streaming updates.
 */

import { EventEmitter } from "events";

import { OrchestratorError, ErrorCode } from "../errors.js";
import { AcpClient } from "./client.js";
import type {
  AcpSessionOptions,
  SessionNewParams,
  SessionNewResult,
  SessionPromptParams,
  SessionPromptResult,
  SessionUpdateParams,
  SessionCancelParams,
  SessionCancelResult,
} from "./types.js";
import { AcpMethod, isSessionUpdate } from "./types.js";

// ---------------------------------------------------------------------------
// AcpSession
// ---------------------------------------------------------------------------

export type AcpSessionStatus = "idle" | "working" | "completed" | "failed";

export class AcpSession extends EventEmitter {
  readonly sessionId: string;
  private readonly client: AcpClient;
  private status: AcpSessionStatus = "idle";
  private lastContent = "";
  private unsubscribe: (() => void) | null = null;

  constructor(sessionId: string, client: AcpClient) {
    super();
    this.sessionId = sessionId;
    this.client = client;
    this.setupNotificationHandler();
  }

  getStatus(): AcpSessionStatus {
    return this.status;
  }

  // -----------------------------------------------------------------------
  // Prompt Operations
  // -----------------------------------------------------------------------

  async send(prompt: string): Promise<string> {
    if (this.status === "completed" || this.status === "failed") {
      throw new OrchestratorError(
        `Cannot send to session ${this.sessionId} in status "${this.status}"`,
        ErrorCode.AGENT_EXECUTION_FAILED,
        { context: { sessionId: this.sessionId, status: this.status } }
      );
    }

    this.status = "working";
    this.lastContent = "";

    const params: SessionPromptParams = {
      sessionId: this.sessionId,
      message: prompt,
    };

    const result = await this.client.sendRequest<SessionPromptResult>(
      AcpMethod.SessionPrompt,
      params
    );

    return result.messageId;
  }

  async sendAndWait(prompt: string, timeoutMs?: number): Promise<string> {
    const timeout = timeoutMs ?? 300_000; // 5 minutes default

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
          new OrchestratorError(
            `Session ${this.sessionId} sendAndWait timed out after ${timeout}ms`,
            ErrorCode.AGENT_TIMEOUT,
            {
              context: { sessionId: this.sessionId, timeoutMs: timeout },
              recoveryHint:
                "The task may be too complex. Consider breaking it into smaller subtasks.",
            }
          )
        );
      }, timeout);

      const onComplete = (content: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(content);
      };

      const onError = (error: Error) => {
        if (settled) return;
        settled = true;
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
        clearTimeout(timer);
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  async cancel(): Promise<void> {
    const params: SessionCancelParams = {
      sessionId: this.sessionId,
    };

    await this.client.sendRequest<SessionCancelResult>(
      AcpMethod.SessionCancel,
      params
    );
    this.status = "idle";
  }

  async destroy(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.removeAllListeners();
    this.status = "completed";
  }

  // -----------------------------------------------------------------------
  // Notification Handling
  // -----------------------------------------------------------------------

  private setupNotificationHandler(): void {
    this.unsubscribe = this.client.onNotification(
      AcpMethod.SessionUpdate,
      (params: unknown) => {
        if (!isSessionUpdate(params)) return;
        if (params.sessionId !== this.sessionId) return;
        this.handleUpdate(params);
      }
    );
  }

  private handleUpdate(update: SessionUpdateParams): void {
    switch (update.type) {
      case "text":
        if (update.content) {
          this.lastContent += update.content;
          (this as EventEmitter).emit("text", update.content);
        }
        break;

      case "tool_call":
        (this as EventEmitter).emit(
          "tool_call",
          update.toolName ?? "unknown",
          update.toolArgs
        );
        break;

      case "tool_result":
        (this as EventEmitter).emit(
          "tool_result",
          update.toolName ?? "unknown",
          update.toolResult
        );
        break;

      case "complete":
        this.status = "completed";
        (this as EventEmitter).emit(
          "complete",
          update.content ?? this.lastContent
        );
        break;

      case "error": {
        this.status = "failed";
        const error = new OrchestratorError(
          update.error ?? "Unknown ACP session error",
          ErrorCode.AGENT_EXECUTION_FAILED,
          { context: { sessionId: this.sessionId } }
        );
        (this as EventEmitter).emit("error", error);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AcpSessionManager
// ---------------------------------------------------------------------------

export class AcpSessionManager {
  private readonly client: AcpClient;
  private readonly sessions = new Map<string, AcpSession>();

  constructor(client: AcpClient) {
    this.client = client;
  }

  async createSession(options?: AcpSessionOptions): Promise<AcpSession> {
    const params: SessionNewParams = {};
    if (options?.agent) params.agent = options.agent;
    if (options?.systemMessage) params.systemMessage = options.systemMessage;
    if (options?.mcpServers) params.mcpServers = options.mcpServers;
    if (options?.allowedTools) params.allowedTools = options.allowedTools;
    if (options?.workingDirectory)
      params.workingDirectory = options.workingDirectory;
    if (options?.env) params.env = options.env;
    if (options?.permissions) params.permissions = options.permissions;

    const result = await this.client.sendRequest<SessionNewResult>(
      AcpMethod.SessionNew,
      params
    );

    const session = new AcpSession(result.sessionId, this.client);
    this.sessions.set(result.sessionId, session);

    return session;
  }

  getSession(id: string): AcpSession | undefined {
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
