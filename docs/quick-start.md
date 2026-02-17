# SpecTree Quick Start

Get up and running with SpecTree in under 5 minutes. This guide covers installation, MCP configuration, and your first workflow.

---

## Prerequisites

Before installing SpecTree, ensure you have:

- **Node.js 20+** — Check with `node --version`
- **GitHub CLI (`gh`)** — Authenticated via SSO (`gh auth status` to verify)
- **GitHub Copilot** — Required for AI agent integration ([Get Copilot](https://github.com/features/copilot))

---

## Installation

### Step 1: Configure npm for internal packages (one-time)

SpecTree is distributed via GitHub Packages. Run these commands once to configure npm:

```bash
# Ensure your GitHub CLI session has package read access
gh auth refresh -s read:packages

# Tell npm to use GitHub Packages for @ttc-ggi packages
npm config set @ttc-ggi:registry https://npm.pkg.github.com

# Pass your GitHub CLI session token to npm (npm can't use SSO directly)
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
```

This reuses your existing `gh` CLI login — no need to manually create or manage tokens.

> **Note:** If you later run `gh auth login` or `gh auth refresh` for any reason, re-run the `npm config set .../:_authToken` command above to update the cached token.

**Time:** ~10 seconds

### Step 2: Install SpecTree Skill Packs

```bash
npx @ttc-ggi/spectree-cli install @spectree/full --registry https://ca-spectree-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io
```

This installs the full SpecTree Skill Pack suite including:
- **Planner** — Decompose requirements into structured epics
- **Orchestrator** — Execute features with parallel AI agents
- **Reviewer** — Validate implementations against acceptance criteria
- **Worker** — Feature implementation agent

**Time:** ~30 seconds

### Step 3: Configure GitHub Copilot

Add the SpecTree MCP server to GitHub Copilot's settings:

**macOS/Linux:** `~/.config/github-copilot/config.json`  
**Windows:** `%APPDATA%\github-copilot\config.json`

```json
{
  "mcp": {
    "servers": {
      "spectree": {
        "command": "npx",
        "args": ["@ttc-ggi/spectree-mcp"],
        "env": {
          "SPECTREE_API_URL": "https://ca-spectree-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io",
          "SPECTREE_TOKEN": "your-api-token-here"
        }
      }
    }
  }
}
```

**Get your API token:**
1. Start SpecTree locally: `pnpm dev` (from the SpecTree repository)
2. Navigate to http://localhost:5173
3. Go to Settings → API Tokens → Create Token

**Time:** ~2 minutes

### Step 4: Verify Installation

Open GitHub Copilot and test connectivity:

```
@spectree list epics
```

**Expected output:** List of epics in your workspace (or empty list if none exist).

**Troubleshooting:** If you see "MCP server not responding," check:
- SpecTree API is running (`curl http://localhost:3001/health`)
- MCP config has the correct `SPECTREE_TOKEN`
- Restart GitHub Copilot after config changes

**Time:** ~30 seconds

### Step 5: Create Your First Epic

Try the planner workflow from the cookbook:

```
@spectree create an epic for adding user preferences API with GET and PUT endpoints
```

The planner agent will:
1. Analyze your codebase
2. Decompose the requirement into features and tasks
3. Add execution metadata (order, dependencies, complexity)
4. Create the epic in SpecTree

**Next:** Review the epic at http://localhost:5173/epics and adjust as needed.

**Time:** ~2 minutes

---

## Quick Troubleshooting

### "Unable to authenticate" or "401 Unauthorized" from npm

**Cause:** npm not configured for GitHub Packages  
**Solution:** Run the one-time setup from Step 1:
```bash
gh auth refresh -s read:packages
npm config set @ttc-ggi:registry https://npm.pkg.github.com
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
```
Make sure you're logged into GitHub CLI first: `gh auth login`

### "403 Forbidden" when installing packages

**Cause:** Your GitHub token is missing the `read:packages` scope  
**Solution:**
```bash
# Add the packages scope to your token
gh auth refresh -s read:packages

# Re-set the npm token (important — the old cached token won't have the new scope)
npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
```

### "Command not found: spectree"

**Cause:** CLI not in PATH after installation  
**Solution:** Run `npm install -g @ttc-ggi/spectree-cli` or use `npx @ttc-ggi/spectree-cli` prefix

### "MCP server spectree not responding"

**Cause:** MCP configuration incorrect or SpecTree not running  
**Solution:**
1. Verify API is running: `curl http://localhost:3001/health`
2. Check MCP config file has correct `SPECTREE_TOKEN`
3. Restart GitHub Copilot

### "Invalid API token"

**Cause:** Token expired or incorrect  
**Solution:** Generate new token at http://localhost:5173/settings/api-tokens and update MCP config

### "Cannot connect to database"

**Cause:** Database not initialized  
**Solution:** Run `pnpm --filter @spectree/api db:push` from repository root

---

## What's Next?

- **[Architecture Overview](./architecture/skill-packs.md)** — Understand the Skill Pack system design
- **[Workflow Cookbook](./cookbook/README.md)** — Step-by-step guides for common workflows
- **[Troubleshooting Guide](./troubleshooting.md)** — Comprehensive issue resolution
- **[Full Setup Guide](./guides/setup-guide.md)** — Complete local development setup

---

## Getting Help

**Issues during setup?** Check the [Troubleshooting Guide](./troubleshooting.md)

**Want to dive deeper?** Read the [Workflow Cookbook](./cookbook/README.md) for guided walkthroughs

**Found a bug?** Open an issue at [GitHub Issues](https://github.com/TTC-GGI/SpecTree/issues)
