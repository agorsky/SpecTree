# SpecTree MCP Server

> Model Context Protocol (MCP) server for SpecTree, enabling AI agents like GitHub Copilot to manage epics, features, and tasks.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Configuration](#configuration)
4. [Getting an API Token](#getting-an-api-token)
5. [MCP Client Setup](#mcp-client-setup)
6. [Available Tools](#available-tools)
7. [Troubleshooting](#troubleshooting)
8. [Development](#development)

---

## Overview

The SpecTree MCP server exposes project management operations to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io/). It communicates with the SpecTree API using authenticated HTTP requests—**it does not access the database directly**.

### Architecture

```
┌──────────────────┐     HTTP/JSON        ┌──────────────────┐     Prisma      ┌──────────────────┐
│   AI Agent       │ ─────────────────────▶│   SpecTree API   │ ────────────────▶│   SQLite DB      │
│  (Copilot CLI)   │   Bearer st_xxx       │   (Fastify)      │                  │                  │
└──────────────────┘                       └──────────────────┘                  └──────────────────┘
       │
       │ stdio
       ▼
┌──────────────────┐
│   MCP Server     │
│  (this package)  │
└──────────────────┘
```

### Security Benefits

- **No direct database access** – MCP server only communicates via API
- **Token-based authentication** – Requests require a valid API token
- **Revocable access** – Tokens can be instantly revoked without redeployment
- **Audit trail** – All API requests are logged with user context

---

## Prerequisites

Before configuring the MCP server, ensure you have:

1. **SpecTree API server running** – The MCP server requires a running API
2. **API token generated** – See [Getting an API Token](#getting-an-api-token)
3. **Node.js 18+** – Required to run the MCP server

---

## Configuration

The MCP server is configured via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_TOKEN` | **Yes** | – | SpecTree API token (starts with `st_`) |
| `API_BASE_URL` | No | `http://localhost:3001` | Base URL of the SpecTree API |

### Example Configuration

```json
{
  "spectree": {
    "command": "node",
    "args": ["/path/to/spectree/packages/mcp/dist/index.js"],
    "env": {
      "API_TOKEN": "st_K7xH2mPqR5vN8sT1wY4zA6bC9dE0fG3hI...",
      "API_BASE_URL": "http://localhost:3001"
    }
  }
}
```

---

## Getting an API Token

API tokens provide secure, long-lived access to the SpecTree API. Unlike JWTs, they don't expire automatically and are designed for programmatic access.

### Option A: Via Web UI (Recommended)

1. Open the SpecTree web application
2. Navigate to **Settings → API Tokens**
3. Click **Generate New Token**
4. Enter a name (e.g., "Copilot CLI")
5. Click **Create**
6. **Copy the token immediately** – it will only be shown once!

### Option B: Via API (if you have a JWT)

```bash
# First, obtain a JWT by logging in
JWT=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}' \
  | jq -r '.data.accessToken')

# Create an API token
curl -X POST http://localhost:3001/api/v1/tokens \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Copilot CLI"}'

# Response includes the token - SAVE IT!
# {
#   "data": {
#     "id": "...",
#     "token": "st_K7xH2mPq...",  <-- Copy this!
#     ...
#   }
# }
```

### Token Security Best Practices

- **Never commit tokens to git** – Use environment variables or secret managers
- **Store securely** – Use your OS keychain or a secrets manager
- **Rotate periodically** – Generate new tokens and revoke old ones
- **Use descriptive names** – Makes it easy to identify and revoke specific tokens

---

## MCP Client Setup

### GitHub Copilot CLI

Add the following to your MCP configuration file:

**macOS/Linux:** `~/.config/github-copilot/mcp.json`

**Windows:** `%APPDATA%\github-copilot\mcp.json`

```json
{
  "mcpServers": {
    "spectree": {
      "command": "node",
      "args": ["/absolute/path/to/spectree/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_your-token-here",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

> **Important:** Use absolute paths for the `args` value.

### Using npx (Alternative)

If the package is published to npm:

```json
{
  "mcpServers": {
    "spectree": {
      "command": "npx",
      "args": ["@spectree/mcp"],
      "env": {
        "API_TOKEN": "st_your-token-here",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Verify Configuration

After configuration, test by asking Copilot:

```
List all epics in SpecTree
```

If configured correctly, Copilot will use the MCP server to fetch and display your epics.

---

## Available Tools

The MCP server exposes **75 tools** organized into domains. We recommend using **composite tools** for common workflows—they reduce tool calls by 67-97% and provide clearer, action-based interfaces.

### ⭐ Composite Tools (Recommended)

**New in 2026-02:** High-level tools that consolidate multiple operations into a single, action-based interface.

| Tool | Description | Replaces |
|------|-------------|----------|
| `spectree__create_epic_complete` | Atomically create epic with all features, tasks, and descriptions | 15-30 sequential calls |
| `spectree__complete_task_with_validation` | Run validations and complete task if they pass | 2-3 sequential calls |
| `spectree__manage_code_context` | Link/unlink code artifacts (files, functions, branches, commits, PRs) | 6 individual tools |
| `spectree__manage_validations` | Add, run, list, remove validation checks | 7 individual tools |
| `spectree__manage_description` | Get, set, update structured descriptions | 6 individual tools |
| `spectree__manage_progress` | Start, complete, log progress, report blockers | 4 individual tools |
| `spectree__manage_ai_context` | Get, set, append AI context and notes | 3 individual tools |
| `spectree__reorder_item` | Reorder epics, features, or tasks | 3 individual tools |

📖 **See the [Composite Tools Migration Guide](docs/composite-tools-migration.md) for detailed examples and before/after comparisons.**

**Benefits:**
- ✅ **67-97% fewer tool calls** for common workflows
- ✅ **Atomic operations** prevent partial state (e.g., incomplete epic creation)
- ✅ **Action-based interface** makes intent clearer
- ✅ **100% backward compatible** - all individual tools still work

---

### Individual Tools (Also Available)

All individual tools remain functional for backward compatibility:

### Epics

| Tool | Description |
|------|-------------|
| `spectree__list_epics` | List all epics (with pagination) |
| `spectree__get_epic` | Get epic by ID or name |
| `spectree__create_epic` | Create a new epic |

### Features

| Tool | Description |
|------|-------------|
| `spectree__list_features` | List features (filter by epic, status, assignee) |
| `spectree__get_feature` | Get feature by ID or identifier (e.g., `ENG-123`) |
| `spectree__create_feature` | Create a new feature |
| `spectree__update_feature` | Update feature title, description, status, or assignee |

### Tasks

| Tool | Description |
|------|-------------|
| `spectree__list_tasks` | List tasks (filter by feature, status, assignee) |
| `spectree__get_task` | Get task by ID or identifier (e.g., `ENG-123-1`) |
| `spectree__create_task` | Create a new task under a feature |
| `spectree__update_task` | Update task title, description, status, or assignee |

### Statuses

| Tool | Description |
|------|-------------|
| `spectree__list_statuses` | List workflow statuses for a team |
| `spectree__get_status` | Get status details by ID or name |

### Ordering

| Tool | Description |
|------|-------------|
| `spectree__reorder_epic` | Change epic order within team |
| `spectree__reorder_feature` | Change feature order within epic |
| `spectree__reorder_task` | Change task order within feature |

### Search

| Tool | Description |
|------|-------------|
| `spectree__search` | Search features and tasks with filters |

### Personal Scope

| Tool | Description |
|------|-------------|
| `spectree__get_personal_scope` | Get user's personal scope info |
| `spectree__list_personal_projects` | List epics in personal scope |
| `spectree__create_personal_project` | Create an epic in personal scope |
| `spectree__list_personal_statuses` | List workflow statuses in personal scope |

---

## Troubleshooting

### "API_TOKEN environment variable is required"

**Cause:** The MCP server started without an API token configured.

**Solution:** Ensure your MCP configuration includes the `API_TOKEN` in the `env` section:

```json
{
  "env": {
    "API_TOKEN": "st_your-token-here"
  }
}
```

### "Invalid or expired API token"

**Cause:** The token is incorrect, expired, or has been revoked.

**Solutions:**
1. Verify the token is copied correctly (including the `st_` prefix)
2. Generate a new token if the current one was revoked
3. Check if the token has an expiration date that has passed

### "Connection refused" or "ECONNREFUSED"

**Cause:** The SpecTree API server is not running or not reachable.

**Solutions:**
1. Start the API server: `cd packages/api && npm run dev`
2. Verify the `API_BASE_URL` is correct
3. Check for firewall or network issues

### "Request failed after 3 attempts"

**Cause:** Network issues or API server problems.

**Solutions:**
1. Check API server logs for errors
2. Verify network connectivity to the API server
3. Retry after a moment (transient network issues)

### MCP server not appearing in Copilot

**Cause:** Configuration file location or format issues.

**Solutions:**
1. Verify the configuration file is in the correct location
2. Validate JSON syntax (use a JSON validator)
3. Use absolute paths for the `args` value
4. Restart your terminal or IDE after configuration changes

### Debug Mode

To see detailed MCP server logs, check stderr output. The server logs startup information and errors to stderr (not stdout, which is reserved for MCP protocol messages).

---

## Development

### Building

```bash
cd packages/mcp
pnpm build
```

### Running Locally

```bash
# Set environment variables
export API_TOKEN="st_your-dev-token"
export API_BASE_URL="http://localhost:3001"

# Run the server (stdio mode)
node dist/index.js
```

### Testing

```bash
# Run all tests
pnpm test

# Run integration tests (requires API server)
pnpm test:integration

# Watch mode
pnpm test:watch
```

### Project Structure

```
packages/mcp/
├── src/
│   ├── index.ts          # Server entry point
│   ├── api-client.ts     # HTTP client for SpecTree API
│   ├── utils.ts          # Shared utilities
│   └── tools/            # MCP tool definitions
│       ├── index.ts      # Tool registry
│       ├── epics.ts      # Epic tools
│       ├── features.ts   # Feature tools
│       ├── tasks.ts      # Task tools
│       ├── statuses.ts   # Status tools
│       ├── ordering.ts   # Reorder tools
│       ├── search.ts     # Search tool
│       └── personal.ts   # Personal scope tools
├── tests/
│   └── ...
├── package.json
└── tsconfig.json
```

---

## Related Documentation

- [API Token Authentication](../../docs/MCP/api-token-authentication.md) – Detailed token system documentation
- [Security Architecture](../../docs/MCP/security-architecture.md) – Security design and threat model
- [Migration Guide](../../docs/MCP/migration-guide.md) – Migrating from direct DB access

---

## License

This package is part of the SpecTree project.
