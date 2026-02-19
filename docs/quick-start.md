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
1. Navigate to https://ca-spectree-web-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io
2. Go to Settings → API Tokens → Create Token

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

### Step 5: Submit Your First Epic Request

The recommended way to propose new work in SpecTree is through **Epic Requests** — structured proposals that go through a review process before becoming epics.

Use the **request-formulator** agent to create a well-structured epic request:

```
@request-formulator I want to add a user preferences API with GET and PUT endpoints
```

The request-formulator will guide you through a structured interview covering:
1. **Problem Statement** — What problem are you solving?
2. **Proposed Solution** — What do you want to build?
3. **Impact Assessment** — Who benefits and how?
4. **Success Criteria** — How will you measure success? *(optional)*
5. **Technical Context** — Dependencies, alternatives, effort estimate *(optional)*

After the interview, it checks for duplicate requests, shows a preview, and submits to SpecTree for review.

**Expected output:**
```
✅ Epic Request created successfully!

ID: 550e8400-...
Title: User Preferences API
Status: pending

Your request has been submitted for review.
```

**Time:** ~3 minutes

### Step 6: Review and Approve the Epic Request

Epic requests go through a review cycle before they become epics. Admins can approve or reject requests from the **SpecTree web UI** or via **MCP tools**.

**In the web UI:**
1. Navigate to https://ca-spectree-web-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io/epic-requests
2. Click on the pending request to view details
3. Add comments, react (👍 🔥 👎), and approve or reject

**Via MCP tools (admin only):**
```
@spectree list epic requests with status pending
```

To approve:
```
@spectree approve epic request <request-id>
```

To reject:
```
@spectree reject epic request <request-id>
```

> **Note:** Only global admins can approve or reject requests. Anyone can submit requests, add comments, and react.

**Time:** ~1 minute

### Step 7: Convert the Request into an Epic with the Planner

Once a request is approved, use the **planner** agent with the `--from-request` flag to convert it into a fully structured epic:

```
@planner --from-request "User Preferences API"
```

The planner will:
1. **Analyze** — Read the request's structured fields and scan your codebase
2. **Decompose** — Break the requirement into features and tasks
3. **Detail** — Add structured descriptions, AI instructions, and acceptance criteria
4. **Evaluate** — Score the plan against quality heuristics (must pass ≥ 80)
5. **Verify** — Generate and validate the execution plan

**Expected output:**
```
✅ Created epic ENG-42: User Preferences API
✅ Created feature ENG-42-1: Database Schema & Models (3 tasks)
✅ Created feature ENG-42-2: REST API Endpoints (4 tasks)
✅ Created feature ENG-42-3: Frontend Settings Page (3 tasks)

Epic ready for review: https://ca-spectree-web-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io/epics/ENG-42
```

> **Tip:** You can also invoke the planner directly without an epic request for quick prototyping:
> ```
> @planner "Add a user preferences API with GET and PUT endpoints"
> ```

**Next:** Review the epic at https://ca-spectree-web-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io/epics and adjust as needed.

**Time:** ~5 minutes

### Step 8: Execute the Epic with the Orchestrator

Once you're satisfied with the plan, use the **orchestrator** agent to implement the epic automatically:

```
@orchestrator execute epic ENG-42
```

The orchestrator will:
1. **Load the execution plan** — Retrieve phases, dependencies, and parallel groups
2. **Spawn worker agents** — One per feature, running in parallel where possible
3. **Track progress** — Update task statuses in SpecTree as work completes
4. **Run validations** — Verify acceptance criteria after each task
5. **Review each phase** — Invoke the reviewer agent to check quality

**Expected output:**
```
🚀 Starting orchestrator execution for epic "User Preferences API"
📋 Execution plan: 2 phases, 3 features

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting Phase 1 of 2: Database Schema, REST API Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ Spawning feature-worker for ENG-42-1: Database Schema & Models
⏳ Spawning feature-worker for ENG-42-2: REST API Endpoints
✅ Feature-worker completed ENG-42-1 (3/3 tasks, validations passed)
✅ Feature-worker completed ENG-42-2 (4/4 tasks, validations passed)
🔍 Phase 1 review: PASS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting Phase 2 of 2: Frontend Settings Page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ Spawning feature-worker for ENG-42-3: Frontend Settings Page
✅ Feature-worker completed ENG-42-3 (3/3 tasks, validations passed)
🔍 Phase 2 review: PASS

🏁 All phases complete. Final status: 3/3 features done.
```

You can monitor progress in real time from the SpecTree web UI — tasks move from "Backlog" → "In Progress" → "Done" as workers complete them.

**Time:** Varies by epic size (~10-30 minutes for a small epic)

### Step 9: Review the Results

After orchestration completes:

1. **Review code changes:**
   ```bash
   git status
   git log --oneline -10
   ```

2. **Check the epic in SpecTree:**
   ```
   @spectree get progress summary for epic ENG-42
   ```

3. **Run the reviewer agent** for a final quality check (optional — the orchestrator runs it per-phase automatically):
   ```
   @reviewer review feature ENG-42-1
   ```

4. **Run your project's tests** to confirm everything works end-to-end:
   ```bash
   pnpm test
   ```

> **Tip:** The orchestrator runs on a feature branch. Review the diff and create a pull request when satisfied.

**Time:** ~5 minutes

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
**Solution:** Generate new token at https://ca-spectree-web-dev.happyground-5b47f2ba.eastus.azurecontainerapps.io/settings/api-tokens and update MCP config

### "Cannot connect to database"

**Cause:** Database not initialized  
**Solution:** Run `pnpm --filter @spectree/api db:push` from repository root

---

## What's Next?

- **[Workflow Cookbook](./cookbook/README.md)** — Step-by-step guides for common workflows
- **[Using the Planner Agent](./cookbook/planner-agent.md)** — Deep dive into planner options and gates
- **[Running Orchestrated Implementation](./cookbook/orchestration.md)** — Execute epics with parallel AI agents
- **[Architecture Overview](./architecture/skill-packs.md)** — Understand the Skill Pack system design
- **[Troubleshooting Guide](./troubleshooting.md)** — Comprehensive issue resolution
- **[Full Setup Guide](./guides/setup-guide.md)** — Complete local development setup

---

## Getting Help

**Issues during setup?** Check the [Troubleshooting Guide](./troubleshooting.md)

**Want to dive deeper?** Read the [Workflow Cookbook](./cookbook/README.md) for guided walkthroughs

**Found a bug?** Open an issue at [GitHub Issues](https://github.com/TTC-GGI/SpecTree/issues)
