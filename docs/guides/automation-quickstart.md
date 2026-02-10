# SpecTree Automation Tool — Quickstart Guide

This guide walks you through the full SpecTree automation workflow: planning an epic from a natural language description, executing it with AI agents, and validating the results. No prior SpecTree knowledge is required.

## What You'll Do

1. **Plan** — Describe a feature in natural language. The planner agent analyzes the codebase, decomposes the work into features and tasks, and creates a structured SpecTree epic.
2. **Review** — Inspect the generated epic in the SpecTree web UI. Verify the structure, execution order, and acceptance criteria before committing to execution.
3. **Execute** — The orchestrator spawns AI agents (via ACP/Copilot CLI) to implement each feature. Tasks are tracked in SpecTree with real-time progress updates.
4. **Validate** — Run automated validation checks against completed tasks to verify acceptance criteria are met.

---

## Prerequisites

Before starting, make sure these services are running:

### 1. SpecTree API

```bash
cd packages/api
pnpm dev
```

Verify it's running:

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

### 2. SpecTree MCP Server

```bash
cd packages/mcp
pnpm dev
```

The MCP server connects AI agents to SpecTree tools. Verify the `.env` file in `packages/mcp/` contains a valid `SPECTREE_TOKEN`.

### 3. Copilot CLI

Copilot CLI must be installed and authenticated. Verify:

```bash
copilot --version
```

If you don't have it installed, follow the [GitHub Copilot CLI setup guide](https://docs.github.com/en/copilot/github-copilot-in-the-cli).

### 4. Custom Agents and Skills

The automation tool uses custom agents and skills defined in:

- `.github/agents/` — planner, orchestrator, feature-worker, reviewer
- `.github/skills/` — spectree-planning, spectree-session, spectree-validation

These files are already committed to the repository. No setup required.

### 5. Environment Variables

```bash
export SPECTREE_API_URL=http://localhost:3001
export SPECTREE_TOKEN=<your-token-from-packages/mcp/.env>
```

### 6. Build the Orchestrator CLI

```bash
cd packages/orchestrator
pnpm build
```

---

## Step 1: Plan

Use the `@planner` agent to create an epic from a natural language description.

### Option A: Interactive (Copilot CLI)

```bash
copilot -p '@planner "Add a REST API endpoint at /api/v1/preferences with GET and PUT operations for user preferences. Store preferences in a Prisma model. Validate with Zod schemas."' --allow-all-tools
```

### Option B: Shell Script

```bash
./scripts/spectree-plan.sh "Add a REST API endpoint at /api/v1/preferences with GET and PUT operations for user preferences. Store preferences in a Prisma model. Validate with Zod schemas." --team Engineering
```

### Option C: CLI Command

```bash
spectree-agent plan "Add a REST API endpoint at /api/v1/preferences with GET and PUT operations for user preferences." --team Engineering
```

### What Happens

The planner agent:

1. **Analyzes** the codebase to understand existing patterns, frameworks, and conventions
2. **Decomposes** the request into 3-5 features (e.g., database model, validation schemas, route handlers, tests)
3. **Creates tasks** under each feature with acceptance criteria and AI instructions
4. **Sets execution metadata** — execution order, parallelism groups, complexity estimates
5. **Creates the epic** in SpecTree via MCP tools

### Expected Output

```
PLANNING COMPLETE
==================================================

Epic: User Preferences API
  Add REST API endpoints for user preferences...

Features (4):
  1. Prisma Model & Migration [simple]
     ENG-100
      |- Create UserPreference Prisma model
      |- Generate and apply migration

  2. Zod Validation Schemas [parallel: api-layer] [simple]
     ENG-101
      |- Create preference Zod schemas
      |- Add schema validation middleware

  3. API Route Handlers [parallel: api-layer] [moderate]
     ENG-102
      |- GET /api/v1/preferences endpoint
      |- PUT /api/v1/preferences endpoint

  4. Integration Tests [simple]
     ENG-103
      |- Write API endpoint tests
      |- Write Zod schema tests

Summary: 4 features with 8 tasks
Parallel Groups: api-layer

Epic ID: 88cec40c-...
Continue with: spectree-agent run 88cec40c-...
```

Note the **Epic ID** — you'll need it for the next steps.

---

## Step 2: Review

Before executing, review the generated epic in the SpecTree web UI.

### Open the Web UI

```bash
# Start the web UI if not already running
cd packages/web
pnpm dev
```

Navigate to `http://localhost:5173` and find your epic. Check:

- **Feature count** — Is 3-5 features reasonable for the scope?
- **Task count** — Does each feature have 2-4 tasks?
- **Execution order** — Are dependencies correct? (Database before API routes, API routes before tests)
- **Parallelism** — Are independent features marked as parallelizable?
- **Acceptance criteria** — Does each task have clear, testable criteria?
- **AI instructions** — Do tasks have enough context for an AI agent to implement them?

### Modify if Needed

You can edit features and tasks directly in the SpecTree UI before execution. Common adjustments:

- Remove unnecessary tasks
- Add missing acceptance criteria
- Adjust execution order
- Split overly large tasks

---

## Step 3: Execute

Run the orchestrator to execute the epic. Each feature is implemented by an AI agent.

### Option A: CLI Command (Recommended)

```bash
spectree-agent run <epic-id>
```

### Option B: Shell Script

```bash
./scripts/spectree-run.sh <epic-id>
```

### Option C: Dry Run (Preview Only)

See the execution plan without actually running anything:

```bash
spectree-agent run <epic-id> --dry-run
```

### Execution Modes

| Flag | Behavior |
|------|----------|
| (default) | Sequential execution, one feature at a time |
| `--parallel 2` | Run up to 2 features in parallel |
| `--phase 2` | Execute only phase 2 |
| `--dry-run` | Show execution plan without executing |

### What Happens During Execution

1. **Session starts** — A SpecTree session is created to track this execution run
2. **Phase execution** — Features are executed in order, respecting dependencies
3. **ACP sessions** — Each task spawns a Copilot CLI session via ACP (Agent Client Protocol)
4. **Git branches** — Feature branches are created for parallel work
5. **Progress tracking** — SpecTree is updated in real-time as tasks complete
6. **Branch merging** — Completed feature branches are merged back

### Terminal Output During Execution

```
SpecTree Parallel Agent Orchestrator

  Executing epic...

  [ENG-100] Prisma Model & Migration
    ✓ Creating Prisma model... (reading schema.prisma)
    ✓ Adding migration... (running prisma migrate)
    ✓ Completed in 45s

  [ENG-101] Zod Validation Schemas    [ENG-102] API Route Handlers
    ✓ Creating schemas...               ✓ Creating GET handler...
    ✓ Adding middleware...               ✓ Creating PUT handler...
    ✓ Completed in 30s                   ✓ Completed in 55s

  [ENG-103] Integration Tests
    ✓ Writing endpoint tests...
    ✓ Writing schema tests...
    ✓ Completed in 40s

  Orchestration Results

  ✓ All items completed successfully

  Completed (4):
    ✓ ENG-100 Prisma Model & Migration
    ✓ ENG-101 Zod Validation Schemas
    ✓ ENG-102 API Route Handlers
    ✓ ENG-103 Integration Tests

  Total duration: 170.0s
```

---

## Step 4: Validate

After execution, run the validator to check all acceptance criteria.

### Run Validations

```bash
spectree-agent validate <epic-id>
```

Or with the shell script:

```bash
./scripts/spectree-validate.sh <epic-id>
```

### Expected Output

```
VALIDATION RESULTS
==================================================

Epic: User Preferences API

  Task                Checks    Passed    Failed    Status
  ----------------------------------------------------------
  ENG-100-1           2         2         0          PASS
  ENG-100-2           1         1         0          PASS
  ENG-101-1           2         2         0          PASS
  ENG-102-1           3         3         0          PASS
  ENG-102-2           3         3         0          PASS
  ENG-103-1           2         2         0          PASS

  ----------------------------------------------------------

  All 13 validation checks passed across 6 tasks.
```

### Validation Check Types

| Type | What It Checks |
|------|---------------|
| `file_exists` | A specific file was created |
| `command` | A shell command exits with expected code (e.g., `tsc --noEmit`) |
| `manual` | Requires manual verification (shown as pending) |

### If Validations Fail

1. Read the error details in the validation output
2. Fix the failing task manually or re-run it
3. Run validations again to confirm the fix

---

## Complete Example

Here's the full workflow from start to finish:

```bash
# 1. Start services
cd packages/api && pnpm dev &
cd packages/mcp && pnpm dev &
cd packages/web && pnpm dev &

# 2. Plan
spectree-agent plan "Add a REST API endpoint at /api/v1/preferences with GET and PUT for user preferences. Prisma model. Zod validation." --team Engineering
# Output: Epic ID: abc123...

# 3. Review in UI
open http://localhost:5173

# 4. Execute
spectree-agent run abc123...

# 5. Validate
spectree-agent validate abc123...

# 6. Review the generated code
git log --oneline
git diff main
```

---

## Troubleshooting

### "SpecTree MCP is not connected"

The AI agent cannot reach SpecTree tools. Check:

1. Is the SpecTree API running? (`curl http://localhost:3001/health`)
2. Is the MCP server running? (`cd packages/mcp && pnpm dev`)
3. Is the `SPECTREE_TOKEN` set in `packages/mcp/.env`?

### "SPECTREE_API_URL not configured"

```bash
export SPECTREE_API_URL=http://localhost:3001
```

### "Authentication Error" / "Missing token"

```bash
spectree-agent auth --token <your-token>
```

Or set the environment variable:

```bash
export SPECTREE_TOKEN=<your-token>
```

### "Team not found"

List available teams:

```bash
# Via MCP (in Copilot CLI)
# Call spectree__list_teams

# Or check the API directly
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/teams
```

### Agent hangs or becomes unresponsive

```bash
# Check status
spectree-agent status

# Cancel and retry
Ctrl+C
spectree-agent run <epic-id>  # Resumes from last completed task
```

### "TypeError: terminated" from MCP server

The MCP server crashed during a large operation. This was fixed in ENG-13 but if it recurs:

1. Restart the MCP server: `cd packages/mcp && pnpm dev`
2. Retry the operation

### TypeScript compilation errors after execution

```bash
cd packages/api  # or whichever package
npx tsc --noEmit
```

Fix any type errors the AI agent introduced, then re-run validation.

### Git merge conflicts

If parallel features modify the same files:

```bash
git status
git diff
# Resolve conflicts manually
git add .
git commit -m "Resolve merge conflicts"
```

---

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Epic** | A container for features, representing a complete piece of work |
| **Feature** | A logical unit of work within an epic (e.g., "Database Model") |
| **Task** | A specific implementation step within a feature |
| **Execution Order** | The order in which features are executed (lower = first) |
| **Parallel Group** | Features in the same group can run simultaneously |
| **ACP** | Agent Client Protocol — JSON-RPC interface for driving Copilot CLI |
| **Phase** | A group of features at the same execution order level |
| **Validation** | Automated checks that verify acceptance criteria |

---

## Tips

- **Start small**: Use a simple, well-scoped description for your first run. Complex multi-system changes may need manual intervention.
- **Review before executing**: Always check the generated plan in the SpecTree UI. It's much easier to fix the plan than to fix generated code.
- **Use `--dry-run`**: Preview the execution plan before committing to a full run.
- **Monitor progress**: Watch the terminal output and SpecTree UI during execution to catch issues early.
- **Copilot premium requests**: Each task consumes Copilot premium requests. Keep task count reasonable (5-15 tasks per epic).
