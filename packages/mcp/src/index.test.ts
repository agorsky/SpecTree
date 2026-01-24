/**
 * Tests for SpecTree MCP Server
 */

import { describe, it, expect, afterEach } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Sends a JSON-RPC message to the server and waits for a response
 */
function sendRequest(
  serverProcess: ChildProcess,
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, 5000);

    const onData = (data: Buffer): void => {
      clearTimeout(timeout);
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          if (response.id === request.id) {
            serverProcess.stdout?.off("data", onData);
            resolve(response);
            return;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    };

    serverProcess.stdout?.on("data", onData);

    const message = JSON.stringify(request) + "\n";
    serverProcess.stdin?.write(message);
  });
}

describe("SpecTree MCP Server", () => {
  let serverProcess: ChildProcess | null = null;

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("should initialize and list tools", async () => {
    const serverPath = join(__dirname, "../dist/index.js");
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize the server
    const initResponse = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    expect(initResponse.result).toBeDefined();
    const initResult = initResponse.result as {
      serverInfo: { name: string; version: string };
    };
    expect(initResult.serverInfo.name).toBe("spectree-mcp");
    expect(initResult.serverInfo.version).toBe("0.1.0");

    // Send initialized notification
    serverProcess.stdin?.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );

    // List available tools
    const toolsResponse = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(toolsResponse.result).toBeDefined();
    const toolsResult = toolsResponse.result as {
      tools: { name: string; description: string }[];
    };
    expect(toolsResult.tools.some((t) => t.name === "echo")).toBe(true);
  });

  it("should execute echo tool correctly", async () => {
    const serverPath = join(__dirname, "../dist/index.js");
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize
    await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });

    serverProcess.stdin?.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    );

    // Call echo tool
    const echoResponse = await sendRequest(serverProcess, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "echo",
        arguments: { message: "Hello, MCP!" },
      },
    });

    expect(echoResponse.result).toBeDefined();
    const echoResult = echoResponse.result as {
      content: { type: string; text: string }[];
    };
    expect(echoResult.content[0]?.type).toBe("text");
    expect(echoResult.content[0]?.text).toBe("Echo: Hello, MCP!");
  });
});
