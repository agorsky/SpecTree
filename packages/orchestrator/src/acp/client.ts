/**
 * ACP Client — spawns `copilot --acp` as a subprocess and communicates
 * via JSON-RPC 2.0 over newline-delimited JSON on stdin/stdout.
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

import { OrchestratorError, ErrorCode } from "../errors.js";
import type {
  AcpClientOptions,
  InitializeResult,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  PendingRequest,
  SessionRequestPermissionResponse,
  AcpMethodName,
} from "./types.js";
import {
  AcpMethod,
  isPermissionRequest,
} from "./types.js";

const DEFAULT_COPILOT_PATH = "copilot";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const KILL_TIMEOUT_MS = 5_000;

const CLIENT_INFO = {
  name: "spectree-orchestrator",
  version: "1.0.0",
};

export class AcpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private readonly pendingRequests = new Map<number | string, PendingRequest>();
  private buffer = "";
  private readonly notificationHandlers = new Map<
    string,
    Set<(params: unknown) => void>
  >();
  private connected = false;

  private readonly copilotPath: string;
  private readonly spawnArgs: string[];
  private readonly spawnEnv: Record<string, string> | undefined;
  private readonly requestTimeout: number;
  private readonly autoApprovePermissions: boolean;

  constructor(options?: AcpClientOptions) {
    super();
    this.copilotPath = options?.copilotPath ?? DEFAULT_COPILOT_PATH;
    this.spawnArgs = ["--acp", ...(options?.args ?? [])];
    this.spawnEnv = options?.env;
    this.requestTimeout = options?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.autoApprovePermissions = options?.autoApprovePermissions ?? true;
  }

  // -----------------------------------------------------------------------
  // Connection lifecycle
  // -----------------------------------------------------------------------

  async connect(): Promise<InitializeResult> {
    if (this.connected) {
      throw new OrchestratorError(
        "ACP client is already connected",
        ErrorCode.AGENT_EXECUTION_FAILED,
        { recoveryHint: "Call disconnect() before reconnecting." }
      );
    }

    const env = this.spawnEnv
      ? { ...process.env, ...this.spawnEnv }
      : process.env;

    try {
      this.process = spawn(this.copilotPath, this.spawnArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        env,
      });
    } catch (err) {
      throw new OrchestratorError(
        `Failed to spawn ACP process: ${this.copilotPath}`,
        ErrorCode.AGENT_SPAWN_FAILED,
        {
          context: { copilotPath: this.copilotPath, args: this.spawnArgs },
          recoveryHint:
            "Ensure the copilot CLI is installed and the path is correct.",
          cause: err instanceof Error ? err : new Error(String(err)),
        }
      );
    }

    this.setupProcessHandlers();
    this.connected = true;

    const result = await this.sendRequest<InitializeResult>(
      AcpMethod.Initialize,
      { clientInfo: CLIENT_INFO }
    );
    (this as EventEmitter).emit("connected");
    return result;
  }

  async disconnect(): Promise<void> {
    if (!this.process) return;

    this.connected = false;
    this.rejectAllPending(
      new OrchestratorError(
        "ACP client disconnecting",
        ErrorCode.AGENT_EXECUTION_FAILED,
        { recoveryHint: "Reconnect if further operations are needed." }
      )
    );

    const proc = this.process;
    this.process = null;

    await new Promise<void>((resolve) => {
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

  isConnected(): boolean {
    return this.connected && this.process !== null;
  }

  // -----------------------------------------------------------------------
  // JSON-RPC Request / Response
  // -----------------------------------------------------------------------

  sendRequest<T = unknown>(
    method: AcpMethodName | string,
    params?: unknown
  ): Promise<T> {
    if (!this.process?.stdin?.writable) {
      return Promise.reject(
        new OrchestratorError(
          "ACP process is not connected",
          ErrorCode.AGENT_EXECUTION_FAILED,
          { recoveryHint: "Call connect() before sending requests." }
        )
      );
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
    };
    if (params !== undefined) {
      request.params = params;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new OrchestratorError(
            `ACP request timed out: ${method} (id=${id})`,
            ErrorCode.AGENT_TIMEOUT,
            {
              context: { method, id, timeoutMs: this.requestTimeout },
              recoveryHint: "The copilot process may be unresponsive.",
            }
          )
        );
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      const line = JSON.stringify(request) + "\n";
      this.process!.stdin!.write(line, (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          clearTimeout(timer);
          reject(
            new OrchestratorError(
              `Failed to write to ACP stdin: ${err.message}`,
              ErrorCode.AGENT_EXECUTION_FAILED,
              { cause: err }
            )
          );
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Notification Handling
  // -----------------------------------------------------------------------

  onNotification(
    method: string,
    handler: (params: unknown) => void
  ): () => void {
    let handlers = this.notificationHandlers.get(method);
    if (!handlers) {
      handlers = new Set();
      this.notificationHandlers.set(method, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers!.delete(handler);
      if (handlers!.size === 0) {
        this.notificationHandlers.delete(method);
      }
    };
  }

  // -----------------------------------------------------------------------
  // Permission Response
  // -----------------------------------------------------------------------

  sendPermissionResponse(
    requestId: number | string,
    response: SessionRequestPermissionResponse
  ): void {
    if (!this.process?.stdin?.writable) return;

    const rpcResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: requestId,
    };
    rpcResponse.result = response;

    const line = JSON.stringify(rpcResponse) + "\n";
    this.process.stdin.write(line);
  }

  // -----------------------------------------------------------------------
  // Private: Process Event Handlers
  // -----------------------------------------------------------------------

  private setupProcessHandlers(): void {
    const proc = this.process;
    if (!proc) return;

    // Line-buffered stdout reader
    proc.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      // Keep the last incomplete line in the buffer
      this.buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        this.handleMessage(trimmed);
      }
    });

    // Stderr for logging
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        // Emit as a debug-level event; callers can log if desired
        (this as EventEmitter).emit("stderr", text);
      }
    });

    proc.on("error", (err: Error) => {
      this.connected = false;
      this.rejectAllPending(
        new OrchestratorError(
          `ACP process error: ${err.message}`,
          ErrorCode.AGENT_SPAWN_FAILED,
          { cause: err }
        )
      );
      (this as EventEmitter).emit("error", err);
    });

    proc.on("exit", (code: number | null, signal: string | null) => {
      const wasConnected = this.connected;
      this.connected = false;
      this.process = null;

      this.rejectAllPending(
        new OrchestratorError(
          `ACP process exited (code=${code}, signal=${signal})`,
          ErrorCode.AGENT_EXECUTION_FAILED,
          { context: { exitCode: code, signal } }
        )
      );

      if (wasConnected) {
        (this as EventEmitter).emit("disconnected", code);
      }
    });
  }

  private handleMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Malformed JSON — skip
      return;
    }

    if (msg.jsonrpc !== "2.0") return;

    // Response (has `id`, no `method`)
    if ("id" in msg && !("method" in msg)) {
      this.handleResponse(msg as unknown as JsonRpcResponse);
      return;
    }

    // Request from server (has `id` and `method`) — currently only permission requests
    if ("id" in msg && "method" in msg) {
      this.handleServerRequest(
        msg as unknown as JsonRpcRequest
      );
      return;
    }

    // Notification (has `method`, no `id`)
    if ("method" in msg && !("id" in msg)) {
      this.handleNotification(msg as unknown as JsonRpcNotification);
      return;
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timer);

    if (response.error) {
      pending.reject(
        new OrchestratorError(
          `ACP JSON-RPC error: ${response.error.message} (code=${response.error.code})`,
          ErrorCode.AGENT_EXECUTION_FAILED,
          { context: { rpcErrorCode: response.error.code, data: response.error.data } }
        )
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private handleServerRequest(request: JsonRpcRequest): void {
    if (request.method === AcpMethod.SessionRequestPermission) {
      if (isPermissionRequest(request.params)) {
        if (this.autoApprovePermissions) {
          this.sendPermissionResponse(request.id, { approved: true });
        } else {
          (this as EventEmitter).emit(
            "permissionRequest",
            request.params,
            request.id
          );
        }
      }
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const handlers = this.notificationHandlers.get(notification.method);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(notification.params);
        } catch {
          // swallow handler errors to prevent breaking the message loop
        }
      }
    }

    (this as EventEmitter).emit("notification", notification.method, notification.params);
  }

  private rejectAllPending(error: OrchestratorError): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}
