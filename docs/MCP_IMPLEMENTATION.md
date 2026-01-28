# SpecTree MCP Server - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Tool Registry System](#tool-registry-system)
5. [Available Tools](#available-tools)
6. [Data Models](#data-models)
7. [Response Patterns](#response-patterns)
8. [Configuration for AI Assistants](#configuration-for-ai-assistants)
9. [Development Guide](#development-guide)
10. [Testing](#testing)

---

## Overview

SpecTree MCP Server is a Model Context Protocol (MCP) server that exposes project management operations to AI agents. It provides a comprehensive set of tools for managing projects, features (issues), tasks (sub-issues), and statuses within a hierarchical project management system.

### Key Concepts

- **MCP (Model Context Protocol)**: A standardized protocol for AI assistants to interact with external tools and services
- **stdio Transport**: The server uses standard input/output for communication, making it ideal for CLI integration
- **JSON-RPC 2.0**: Communication follows the JSON-RPC 2.0 specification

### Package Location

```
packages/mcp/
├── src/
│   ├── index.ts          # Main entry point, server initialization
│   ├── index.test.ts     # Integration tests
│   └── tools/            # Tool implementations
│       ├── index.ts      # Tool registry
│       ├── projects.ts   # Project operations
│       ├── features.ts   # Feature operations
│       ├── tasks.ts      # Task operations
│       ├── statuses.ts   # Status operations
│       ├── ordering.ts   # Reordering operations
│       └── search.ts     # Unified search
├── tests/                # Additional test files
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Architecture

### Server Initialization (index.ts)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

const SERVER_NAME = "spectree-mcp";
const SERVER_VERSION = "0.1.0";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// Register all tools from the registry
registerAllTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Logs go to stderr to avoid interfering with MCP protocol on stdout
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started (stdio transport)`);
}
```

### Tool Registry Pattern (tools/index.ts)

The MCP server uses a modular registry pattern for organizing tools:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Tool registration function type
export type ToolRegistrar = (server: McpServer) => void;

// Registry of all tool registration functions
const toolRegistrars: ToolRegistrar[] = [];

// Register a tool registrar function (called during module initialization)
export function addToolRegistrar(registrar: ToolRegistrar): void {
  toolRegistrars.push(registrar);
}

// Register all tools with the MCP server (called once during server startup)
export function registerAllTools(server: McpServer): void {
  for (const registrar of toolRegistrars) {
    registrar(server);
  }
}

// Import tool modules to trigger their registration
import "./projects.js";
import "./features.js";
import "./tasks.js";
import "./statuses.js";
import "./ordering.js";
import "./search.js";
```

### Database Access

The MCP server directly imports services and the Prisma client from the API package:

```typescript
import {
  projectService,
  featureService,
  taskService,
  statusService,
  userService,
  prisma,
  NotFoundError,
  ValidationError,
} from "@spectree/api/src/services/index.js";
```

This means:
- The MCP server shares the same database connection as the API
- Services contain the business logic for CRUD operations
- Prisma client can be used directly for custom queries

---

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| MCP SDK | @modelcontextprotocol/sdk | ^1.25.3 |
| Schema Validation | Zod | ^3.24.0 |
| Runtime | Node.js | 20+ |
| Language | TypeScript | (strict mode) |
| Package Manager | pnpm | workspace dependencies |
| Build System | TypeScript Compiler (tsc) | |
| Testing | Vitest | |

### Package Dependencies (package.json)

```json
{
  "name": "@spectree/mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "bin": {
    "spectree-mcp": "./dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",
    "@spectree/api": "workspace:*",
    "@spectree/shared": "workspace:*",
    "zod": "^3.24.0"
  }
}
```

---

## Tool Registry System

### How to Add a New Tool

1. Create a new file in `src/tools/` (e.g., `mytools.ts`)
2. Import and use the `addToolRegistrar` function
3. Import your file in `src/tools/index.ts`

Example template:

```typescript
import { z } from "zod";
import { addToolRegistrar } from "./index.js";
import { prisma, NotFoundError } from "@spectree/api/src/services/index.js";

// Helper function for MCP-compliant responses
function createResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// Register tools
addToolRegistrar((server) => {
  server.registerTool(
    "spectree__my_tool",      // Tool name with namespace prefix
    {
      description: "Detailed description of what this tool does...",
      inputSchema: {
        param1: z.string().describe("Description of param1"),
        param2: z.number().optional().describe("Optional param2"),
      },
    },
    async (input) => {
      try {
        // Tool implementation
        const result = await doSomething(input.param1, input.param2);
        return createResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
});
```

### Tool Naming Convention

All tools follow the naming pattern: `spectree__<action>_<resource>`

Examples:
- `spectree__list_projects`
- `spectree__get_feature`
- `spectree__create_task`
- `spectree__update_feature`
- `spectree__reorder_project`
- `spectree__search`

---

## Available Tools

### Project Tools

| Tool | Description |
|------|-------------|
| `spectree__list_projects` | List projects with optional team filter and pagination |
| `spectree__get_project` | Get project by ID or name with features |
| `spectree__create_project` | Create a new project in a team |

#### spectree__list_projects

**Input Schema:**
```typescript
{
  team?: string          // Team ID, name, or key
  includeArchived?: boolean  // Include archived projects (default: false)
  limit?: number         // Max results per page (1-100, default: 20)
  cursor?: string        // Pagination cursor
}
```

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "...",
      "icon": "rocket",
      "color": "#FF5733",
      "sortOrder": 1000,
      "isArchived": false,
      "team": { "id": "uuid", "name": "Engineering", "key": "ENG" },
      "featureCount": 5,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "next-page-cursor",
    "hasMore": true
  }
}
```

#### spectree__get_project

**Input Schema:**
```typescript
{
  query: string  // Project ID (UUID) or exact name
}
```

**Response:** Returns full project with team info and all features.

#### spectree__create_project

**Input Schema:**
```typescript
{
  name: string           // Required - project name
  team: string           // Required - team ID, name, or key
  description?: string   // Optional description
  icon?: string          // Optional icon identifier
  color?: string         // Optional hex color code
}
```

---

### Feature Tools

Features are the primary work items (similar to issues in other systems).

| Tool | Description |
|------|-------------|
| `spectree__list_features` | List features with filtering |
| `spectree__get_feature` | Get feature by ID or identifier |
| `spectree__create_feature` | Create a new feature |
| `spectree__update_feature` | Update an existing feature |

#### spectree__list_features

**Input Schema:**
```typescript
{
  project?: string    // Project ID or name
  status?: string     // Status ID or name
  assignee?: string   // User ID or "me"
  query?: string      // Search in title (case-insensitive)
  limit?: number      // Max results (1-100, default: 20)
  cursor?: string     // Pagination cursor
}
```

#### spectree__get_feature

**Input Schema:**
```typescript
{
  id: string  // Feature UUID or identifier (e.g., "COM-123")
}
```

#### spectree__create_feature

**Input Schema:**
```typescript
{
  title: string        // Required
  project: string      // Required - project ID or name
  description?: string // Markdown supported
  status?: string      // Status ID or name
  assignee?: string    // User ID or "me"
}
```

#### spectree__update_feature

**Input Schema:**
```typescript
{
  id: string           // Required - UUID or identifier
  title?: string       
  description?: string 
  status?: string      
  assignee?: string    
}
```

---

### Task Tools

Tasks are sub-issues under features, with identifiers like `COM-123-1`.

| Tool | Description |
|------|-------------|
| `spectree__list_tasks` | List tasks with filtering |
| `spectree__get_task` | Get task by ID or identifier |
| `spectree__create_task` | Create a new task under a feature |
| `spectree__update_task` | Update an existing task |

#### spectree__list_tasks

**Input Schema:**
```typescript
{
  feature?: string    // Feature ID or identifier (e.g., "COM-123")
  status?: string     // Status ID
  assignee?: string   // User ID
  limit?: number      
  cursor?: string     
}
```

#### spectree__create_task

**Input Schema:**
```typescript
{
  title: string        // Required
  feature_id: string   // Required - feature ID or identifier
  description?: string
  status?: string      // Status ID
  assignee?: string    // User ID
}
```

---

### Status Tools

| Tool | Description |
|------|-------------|
| `spectree__list_statuses` | List all statuses for a team |
| `spectree__get_status` | Get status by ID or name |

#### spectree__list_statuses

**Input Schema:**
```typescript
{
  team: string  // Required - team ID, name, or key
}
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "In Progress",
    "category": "started",
    "color": "#FFA500",
    "position": 2
  }
]
```

**Status Categories:**
- `backlog` - Work not yet scheduled
- `unstarted` - Scheduled but not started
- `started` - Work in progress
- `completed` - Work finished
- `canceled` - Work abandoned

---

### Ordering Tools

| Tool | Description |
|------|-------------|
| `spectree__reorder_project` | Reorder project within team |
| `spectree__reorder_feature` | Reorder feature within project |
| `spectree__reorder_task` | Reorder task within feature |

All reorder tools share a similar schema:

```typescript
{
  id: string         // UUID of item to reorder
  afterId?: string   // Place after this item
  beforeId?: string  // Place before this item
}
```

At least one of `afterId` or `beforeId` must be provided.

---

### Search Tool

| Tool | Description |
|------|-------------|
| `spectree__search` | Unified search across features and tasks |

**Input Schema:**
```typescript
{
  query?: string           // Text search in title/description
  project?: string         // Project filter
  status?: string          // Status ID or name
  statusCategory?: string  // One of: backlog, unstarted, started, completed, canceled
  assignee?: string        // "me", "none", user ID, or email
  createdAt?: string       // ISO date or duration (e.g., "-P7D" for last 7 days)
  updatedAt?: string       // ISO date or duration
  type?: "feature" | "task" | "all"  // Default: "all"
  limit?: number           // Max 100, default 50
  cursor?: string          
}
```

**Response:**
```json
{
  "results": [
    {
      "type": "feature",
      "id": "uuid",
      "identifier": "COM-123",
      "title": "User Authentication",
      "description": "...",
      "statusId": "uuid",
      "assigneeId": "uuid",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "projectId": "uuid"
    },
    {
      "type": "task",
      "id": "uuid",
      "identifier": "COM-123-1",
      "title": "Implement login",
      "featureId": "uuid",
      ...
    }
  ],
  "meta": {
    "total": 2,
    "cursor": "...",
    "hasMore": false
  }
}
```

---

## Data Models

### Entity Hierarchy

```
Team
└── Project
    └── Feature (identifier: TEAM_KEY-NUMBER, e.g., COM-123)
        └── Task (identifier: FEATURE_IDENTIFIER-NUMBER, e.g., COM-123-1)

Team
└── Status (workflow statuses are team-specific)
```

### Common Identifier Formats

| Entity | Format | Example |
|--------|--------|---------|
| Feature | `{TEAM_KEY}-{NUMBER}` | `COM-123` |
| Task | `{FEATURE_ID}-{NUMBER}` | `COM-123-1` |
| UUID | Standard UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |

### Resolution Patterns

Tools support flexible identifier resolution:

- **Projects**: ID (UUID) or exact name
- **Features**: ID (UUID) or identifier (e.g., `COM-123`)
- **Tasks**: ID (UUID) or identifier (e.g., `COM-123-1`)
- **Teams**: ID (UUID), name, or key
- **Statuses**: ID (UUID) or name (scoped to team)
- **Assignees**: ID (UUID), `me` (current user), or `none` (unassigned)

---

## Response Patterns

### Success Response

All successful tool responses follow the MCP content format:

```typescript
{
  content: [
    {
      type: "text",
      text: JSON.stringify(data, null, 2)  // Pretty-printed JSON
    }
  ]
}
```

### Error Response

```typescript
{
  content: [
    {
      type: "text",
      text: "Error: <error message>"
    }
  ],
  isError: true
}
```

### Pagination Metadata

```typescript
{
  meta: {
    cursor: string | null,  // Pass to next request for more results
    hasMore: boolean        // True if more pages available
  }
}
```

---

## Configuration for AI Assistants

### GitHub Copilot CLI Configuration

To use the SpecTree MCP server with GitHub Copilot CLI, add it to your MCP configuration:

**Location:** `~/.config/github-copilot/mcp.json` (or your platform's config location)

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/SpecTree/packages/mcp/dist/index.js"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "1433",
        "DB_NAME": "spectree",
        "DB_USER": "sa",
        "DB_PASSWORD": "LocalDev@Password123"
      }
    }
  }
}
```

**Important:** The MCP server requires database connection environment variables to be set.

### Claude Code Configuration

**Project-level** (`.claude/settings.json` in project root):

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "cwd": "/path/to/SpecTree"
    }
  }
}
```

**Global** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "spectree": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/SpecTree/packages/mcp/dist/index.js"]
    }
  }
}
```

### Prerequisites

Before using the MCP server:

1. **Build the package:**
   ```bash
   cd /path/to/SpecTree
   pnpm install
   pnpm --filter @spectree/mcp build
   ```

2. **Start the database:**
   ```bash
   pnpm docker:up
   # Wait ~30 seconds for database initialization
   ```

3. **Verify the build:**
   ```bash
   node packages/mcp/dist/index.js
   # Should output: "spectree-mcp v0.1.0 started (stdio transport)"
   # Press Ctrl+C to exit
   ```

### Environment Variables Required

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | `localhost` | Database server hostname |
| `DB_PORT` | Yes | `1433` | Database server port |
| `DB_NAME` | Yes | `spectree` | Database name |
| `DB_USER` | Yes | `sa` | Database username |
| `DB_PASSWORD` | Yes | - | Database password |

---

## Development Guide

### Building

```bash
# Build the MCP package
pnpm --filter @spectree/mcp build

# Watch mode (rebuilds on changes)
pnpm --filter @spectree/mcp dev
```

### Running Locally

```bash
# Direct execution
node packages/mcp/dist/index.js

# Via pnpm
pnpm --filter @spectree/mcp start
```

### Adding a New Tool

1. Create or modify a file in `packages/mcp/src/tools/`
2. Use the `addToolRegistrar` pattern
3. Define input schema with Zod
4. Implement the tool handler
5. Return MCP-compliant responses
6. Add tests in `packages/mcp/tests/`
7. If new file, import it in `tools/index.ts`

### Code Patterns Used

**Identifier Resolution:**
```typescript
async function resolveProjectId(project: string): Promise<string> {
  // Try UUID first
  const projectById = await prisma.project.findUnique({
    where: { id: project },
    select: { id: true },
  });
  if (projectById) return projectById.id;

  // Try name
  const projectByName = await prisma.project.findFirst({
    where: { name: project, isArchived: false },
    select: { id: true },
  });
  if (projectByName) return projectByName.id;

  throw new NotFoundError(`Project '${project}' not found`);
}
```

**Current User Resolution:**
```typescript
async function resolveAssigneeId(assignee: string | undefined): Promise<string | undefined> {
  if (!assignee) return undefined;
  
  if (assignee.toLowerCase() === "me") {
    const currentUser = await userService.getCurrentUser();
    if (!currentUser) {
      throw new Error("No current user context available");
    }
    return currentUser.id;
  }
  
  return assignee;
}
```

---

## Testing

### Running Tests

```bash
# Run all MCP tests
pnpm --filter @spectree/mcp test

# Watch mode
pnpm --filter @spectree/mcp test:watch

# Run specific test file
pnpm --filter @spectree/mcp test tests/projects.test.ts
```

### Test Structure

Integration tests spawn the MCP server as a child process and communicate via stdio:

```typescript
import { spawn, type ChildProcess } from "node:child_process";

describe("SpecTree MCP Server", () => {
  let serverProcess: ChildProcess | null = null;

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("should initialize and list tools", async () => {
    serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize
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

    // ... assertions
  });
});
```

### MCP Protocol Test Flow

1. Spawn server process
2. Send `initialize` request
3. Send `notifications/initialized`
4. Send `tools/list` to enumerate tools
5. Send `tools/call` to execute specific tools
6. Parse and verify responses

---

## Troubleshooting

### MCP server not appearing in tools list

1. Verify build: `pnpm --filter @spectree/mcp build`
2. Check absolute paths in configuration
3. Restart the AI assistant completely
4. Check logs for connection errors

### Database connection errors

1. Ensure Docker is running: `docker-compose ps`
2. Verify database is initialized: `docker-compose logs sqlserver-init`
3. Check environment variables match `.env`

### Tool execution errors

1. Check if database is accessible
2. Verify entities exist (projects, teams, etc.)
3. Look at stderr output for detailed error messages

---

## Summary for AI Agents

When working with SpecTree via MCP:

1. **First discover available resources:**
   - Use `spectree__list_projects` to see projects
   - Use `spectree__list_statuses` with a team to see workflow states

2. **Navigate the hierarchy:**
   - Projects contain Features
   - Features contain Tasks
   - Statuses are team-specific

3. **Use flexible identifiers:**
   - Features: `COM-123` or UUID
   - Tasks: `COM-123-1` or UUID
   - Teams: name, key, or UUID
   - Assignees: `me`, `none`, or UUID

4. **For search across items:**
   - Use `spectree__search` with filters
   - Support for date ranges with ISO durations (`-P7D`)
   - Filter by status category for workflow-based queries

5. **All responses are JSON:**
   - Pretty-printed for readability
   - Include pagination metadata
   - Errors flagged with `isError: true`
