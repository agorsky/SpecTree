# Migration Guide: Direct Database to API Authentication

This guide helps you migrate your SpecTree MCP configuration from the legacy direct database access to the new secure API-based authentication.

---

## Overview

### Why We're Making This Change

The original MCP implementation accessed the SQLite database directly via `DATABASE_URL`. While simple, this approach had significant security concerns:

- **No access control** – MCP had unrestricted database access
- **Credential exposure** – Database path exposed in MCP environment
- **No audit trail** – Operations couldn't be tracked or logged
- **No revocation** – Couldn't disable access without changing the database

The new architecture routes all MCP requests through the API server, providing:

- **Token-based authentication** – Each request is authenticated
- **Instant revocation** – Tokens can be disabled immediately
- **Audit logging** – All operations are logged with user context
- **Principle of least privilege** – MCP only has API access, not database access

### What You Need to Do

1. Ensure the API server is running
2. Generate an API token
3. Update your MCP configuration
4. Verify the migration

**Estimated time:** 5-10 minutes

---

## Prerequisites

Before starting, ensure you have:

- [ ] SpecTree API server installed and accessible
- [ ] Access to generate an API token (via web UI or existing JWT)
- [ ] Access to edit your MCP configuration file
- [ ] Node.js 18+ installed

---

## Step-by-Step Migration

### Step 1: Start the API Server

If you're running SpecTree locally, start the API server:

```bash
cd /path/to/spectree/packages/api
pnpm dev
# Server running at http://localhost:3001
```

Verify the server is running:

```bash
curl http://localhost:3001/api/v1/health
# Should return: {"status":"ok"}
```

### Step 2: Generate an API Token

#### Option A: Via Web UI (Recommended)

1. Open the SpecTree web application in your browser
2. Navigate to **Settings → API Tokens**
3. Click **Generate New Token**
4. Enter a descriptive name (e.g., "Copilot MCP")
5. Optionally set an expiration date
6. Click **Create**
7. **Copy the token immediately** – it will only be shown once!

The token will look like: `st_K7xH2mPqR5vN8sT1wY4zA6bC9dE0fG3hI...`

#### Option B: Via API (if you have a JWT)

If you have an existing JWT from the web session:

```bash
# Create an API token
curl -X POST http://localhost:3001/api/v1/tokens \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Copilot MCP"}'

# Response:
# {
#   "data": {
#     "id": "...",
#     "token": "st_K7xH2mPq...",  <-- Save this!
#     "name": "Copilot MCP",
#     ...
#   }
# }
```

### Step 3: Backup Your Current Configuration

Before making changes, save a copy of your current MCP configuration:

**macOS/Linux:**
```bash
cp ~/.config/github-copilot/mcp.json ~/.config/github-copilot/mcp.json.backup
```

**Windows (PowerShell):**
```powershell
Copy-Item "$env:APPDATA\github-copilot\mcp.json" "$env:APPDATA\github-copilot\mcp.json.backup"
```

### Step 4: Update MCP Configuration

Open your MCP configuration file:

- **macOS/Linux:** `~/.config/github-copilot/mcp.json`
- **Windows:** `%APPDATA%\github-copilot\mcp.json`

#### Before (Old Configuration)

```json
{
  "mcpServers": {
    "spectree": {
      "command": "node",
      "args": ["/path/to/spectree/packages/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "file:/path/to/spectree/packages/api/prisma/data/spectree.db"
      }
    }
  }
}
```

#### After (New Configuration)

```json
{
  "mcpServers": {
    "spectree": {
      "command": "node",
      "args": ["/path/to/spectree/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_K7xH2mPqR5vN8sT1wY4zA6bC9dE0fG3hI...",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

**Key changes:**
- Remove `DATABASE_URL` – No longer needed
- Add `API_TOKEN` – Your generated token (required)
- Add `API_BASE_URL` – API server URL (defaults to `http://localhost:3001` if omitted)

### Step 5: Verify the Migration

1. **Restart your terminal or IDE** to pick up the configuration changes

2. **Test with a simple command** – Ask Copilot to list projects:
   ```
   List all projects in SpecTree
   ```

3. **Verify the response** – You should see your projects listed

If you encounter errors, see the [Troubleshooting](#troubleshooting) section below.

---

## Rollback Procedure

If something goes wrong, you can temporarily revert to the old configuration:

```bash
# macOS/Linux
cp ~/.config/github-copilot/mcp.json.backup ~/.config/github-copilot/mcp.json

# Windows (PowerShell)
Copy-Item "$env:APPDATA\github-copilot\mcp.json.backup" "$env:APPDATA\github-copilot\mcp.json"
```

> ⚠️ **Note:** The direct database access method is deprecated and will be removed in a future version. Use rollback only for temporary debugging, then retry the migration.

---

## Troubleshooting

### "API_TOKEN environment variable is required"

**Cause:** MCP started without a token.

**Solution:** Ensure `API_TOKEN` is in your configuration's `env` section:
```json
"env": {
  "API_TOKEN": "st_your-token-here"
}
```

### "Invalid or expired API token"

**Cause:** Token is incorrect, expired, or revoked.

**Solutions:**
1. Verify the token is copied correctly (including `st_` prefix)
2. Check if the token was revoked in Settings → API Tokens
3. Generate a new token if the old one expired

### "Connection refused" or "ECONNREFUSED"

**Cause:** API server is not running or unreachable.

**Solutions:**
1. Start the API server: `cd packages/api && pnpm dev`
2. Verify `API_BASE_URL` matches your server URL
3. Check if a firewall is blocking the connection

### "Request failed after 3 attempts"

**Cause:** Network issues or API server errors.

**Solutions:**
1. Check API server logs for errors
2. Verify network connectivity
3. Wait a moment and retry (may be transient)

### Token Not Working After Migration

**Cause:** Configuration file may have syntax errors or wrong path.

**Solutions:**
1. Validate JSON syntax using a JSON linter
2. Ensure you're editing the correct configuration file
3. Check that the `args` path is absolute, not relative

For more troubleshooting help, see the [MCP README](../../packages/mcp/README.md#troubleshooting).

---

## Frequently Asked Questions

### Do I need to keep the API server running?

**Yes.** The MCP server now requires a running API server to function. If the API server stops, MCP operations will fail with connection errors.

For local development, start the API server before using Copilot with SpecTree:
```bash
cd packages/api && pnpm dev
```

### Can I still use the web UI?

**Yes.** The web UI is completely unchanged. It continues to use its own authentication (JWTs for sessions) and accesses the API directly.

### What happens to my existing data?

**Nothing changes.** Your data remains in the same SQLite database. Only the access method changes—instead of MCP reading the database directly, it now goes through the API server which reads the database.

### Can I use multiple tokens?

**Yes.** You can generate multiple API tokens for different purposes:
- One for Copilot CLI on your laptop
- One for Copilot in VS Code
- One for CI/CD automation

Each token can be revoked independently.

### How do I revoke a token?

In the web UI: **Settings → API Tokens → Revoke**

The token is immediately invalidated. Any MCP configuration using that token will receive "Invalid or expired API token" errors.

### What if I lose my token?

API tokens are shown only once when created (the server stores only a hash). If you lose your token:
1. Generate a new token
2. Update your MCP configuration with the new token
3. Optionally revoke the old token

### Is the API token secure?

Yes. The token system is designed with security in mind:
- Tokens are 256-bit random values (cryptographically secure)
- Only a SHA-256 hash is stored in the database
- Tokens can be revoked instantly
- Optional expiration dates for time-limited access

For more details, see the [Security Architecture](./security-architecture.md) document.

---

## Next Steps

After successful migration:

1. **Delete your backup** (once you've verified everything works):
   ```bash
   rm ~/.config/github-copilot/mcp.json.backup
   ```

2. **Learn about all capabilities** – Ask the AI to call `spectree__get_instructions` or read the [Tools Reference](./tools-reference.md)

3. **Explore the new features** – The API provides consistent, authenticated access to all SpecTree operations

4. **Set up additional tokens** – Create separate tokens for different devices or use cases

5. **Review security architecture** – Read the [Security Architecture](./security-architecture.md) document to understand the full security model

---

## Related Documentation

- [MCP Tools Reference](./tools-reference.md) – Complete reference for all MCP tools
- [MCP README](../../packages/mcp/README.md) – Full MCP server documentation
- [API Token Authentication](./api-token-authentication.md) – Token system details
- [Security Architecture](./security-architecture.md) – Security design and threat model
- [Execution Metadata](./execution-metadata.md) – Execution planning for AI agents
