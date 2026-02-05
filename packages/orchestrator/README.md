# @spectree/orchestrator

A CLI tool for orchestrating AI agents to implement features in parallel.

## Features

- **Natural language to implementation** — Describe a feature and let AI create and execute the plan
- **Parallel agent execution** — Run multiple AI agents concurrently for faster delivery
- **Git branch management** — Automatic branch creation and merging per feature
- **Progress tracking** — Real-time status updates synced with SpecTree
- **Session handoff** — Pause and resume work with full context preservation

## Installation

### From npm (recommended)

```bash
npm install -g @spectree/orchestrator
```

### From source

```bash
# Clone the repository
git clone https://github.com/yourorg/spectree
cd spectree

# Install dependencies
pnpm install

# Build the orchestrator
pnpm --filter @spectree/orchestrator build

# Link globally for CLI access
cd packages/orchestrator
npm link
```

### Requirements

- Node.js >= 20.0.0
- SpecTree API running (default: `http://localhost:3001`)

## Quick Start

**1. Authenticate with SpecTree**

```bash
spectree-agent auth --token st_your-token-here
```

**2. Run your first orchestration**

```bash
spectree-agent run "Add user login endpoint with JWT authentication" --team Engineering
```

**3. Check status**

```bash
spectree-agent status
```

## Commands

### `spectree-agent run <prompt>`

Create and execute a new epic from a natural language prompt.

```bash
spectree-agent run "Build a user authentication system with OAuth and MFA"
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --team <name>` | Team to create the epic in | Interactive prompt |
| `--dry-run` | Show execution plan without running | `false` |
| `--sequential` | Disable parallel execution | `false` |
| `--max-agents <n>` | Maximum concurrent agents | `4` |
| `-b, --branch <name>` | Base branch for feature branches | Current or `main` |

**Examples:**

```bash
# Basic usage
spectree-agent run "Add OAuth authentication"

# Specify team and limit agents
spectree-agent run "Build dashboard" --team Product --max-agents 2

# Preview the plan without executing
spectree-agent run "Create REST API" --dry-run

# Force sequential execution
spectree-agent run "Refactor database layer" --sequential
```

---

### `spectree-agent continue <epic>`

Resume work on an existing epic by name or ID.

```bash
spectree-agent continue "User Authentication"
```

**Options:**

| Option | Description |
|--------|-------------|
| `--from <feature>` | Start from a specific feature (by identifier, e.g., `COM-5`) |
| `--skip-completed` | Automatically skip already completed items |

**Examples:**

```bash
# Continue from where you left off
spectree-agent continue "User Dashboard"

# Start from a specific feature
spectree-agent continue "Auth System" --from COM-5

# Skip all completed items
spectree-agent continue "API Endpoints" --skip-completed
```

---

### `spectree-agent status`

Show the current orchestration status including progress, active agents, and recent completions.

```bash
spectree-agent status
```

**Options:**

| Option | Description |
|--------|-------------|
| `--epic <name>` | Show status for a specific epic |
| `--agents` | Show detailed agent information |

**Examples:**

```bash
# Show active session status
spectree-agent status

# Check a specific epic's progress
spectree-agent status --epic "User Dashboard"

# Show detailed agent breakdown
spectree-agent status --agents
```

---

### `spectree-agent pause [worker]`

Pause running agents. Pauses all agents if no worker ID specified.

```bash
spectree-agent pause
```

**Options:**

| Option | Description |
|--------|-------------|
| `--save-state` | Explicitly save state before pausing |

**Examples:**

```bash
# Pause all running agents
spectree-agent pause

# Pause a specific worker
spectree-agent pause worker-1

# Pause and save checkpoint
spectree-agent pause --save-state
```

---

### `spectree-agent resume [worker]`

Resume paused agents. Resumes all paused agents if no worker ID specified.

```bash
spectree-agent resume
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Resume even if state is stale (>24 hours old) |

**Examples:**

```bash
# Resume all paused agents
spectree-agent resume

# Resume a specific worker
spectree-agent resume worker-1

# Force resume stale state
spectree-agent resume --force
```

---

### `spectree-agent auth`

Authenticate with the SpecTree API.

```bash
spectree-agent auth --token st_your-token-here
```

**Options:**

| Option | Description |
|--------|-------------|
| `--token <token>` | API token (must start with `st_`) |

**Getting a Token:**

1. Open SpecTree web application
2. Navigate to **Settings → API Tokens**
3. Click **Generate New Token**
4. Copy the token and run: `spectree-agent auth --token <your-token>`

## Configuration

Configuration is loaded from multiple sources with the following priority (highest to lowest):

1. CLI arguments
2. Environment variables (`SPECTREE_*`)
3. Project config (`.spectree.json` in repo root)
4. User config (`~/.config/spectree-orchestrator/config.json`)
5. Default values

### User Configuration

Located at `~/.config/spectree-orchestrator/config.json`:

```json
{
  "apiUrl": "http://localhost:3001",
  "defaultTeam": "Engineering",
  "maxConcurrentAgents": 4,
  "autoMerge": true,
  "branchPrefix": "feature/",
  "copilot": {
    "model": "gpt-4.1"
  }
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `apiUrl` | SpecTree API endpoint | `http://localhost:3001` |
| `defaultTeam` | Default team for new epics | — |
| `maxConcurrentAgents` | Max parallel agents (1-10) | `4` |
| `autoMerge` | Auto-merge completed branches | `true` |
| `branchPrefix` | Prefix for feature branches | `feature/` |
| `copilot.model` | AI model to use | `gpt-4.1` |

### Project Configuration

Create `.spectree.json` in your repository root:

```json
{
  "team": "Engineering",
  "testCommand": "pnpm test",
  "lintCommand": "pnpm lint",
  "buildCommand": "pnpm build"
}
```

| Field | Description |
|-------|-------------|
| `team` | Team for this project (overrides user default) |
| `testCommand` | Command to run tests |
| `lintCommand` | Command to run linting |
| `buildCommand` | Command to build the project |

### Environment Variables

| Variable | Maps to |
|----------|---------|
| `SPECTREE_API_URL` | `apiUrl` |
| `SPECTREE_DEFAULT_TEAM` | `defaultTeam` |
| `SPECTREE_MAX_AGENTS` | `maxConcurrentAgents` |

## Troubleshooting

### "Not authenticated"

You need to authenticate before using the CLI:

```bash
spectree-agent auth --token st_your-token-here
```

### "API connection failed"

1. Verify SpecTree API is running at the configured URL
2. Check `apiUrl` in your config: `~/.config/spectree-orchestrator/config.json`
3. Test connectivity: `curl http://localhost:3001/api/health`

### "Epic not found"

The epic name may not match exactly. Try:

```bash
# List available epics
spectree-agent status

# Use a more specific name or the full UUID
spectree-agent continue "Full Epic Name"
```

### Merge conflicts

When agents working in parallel create conflicting changes:

1. Resolve conflicts manually in the affected branch
2. Commit the resolution
3. Resume orchestration: `spectree-agent continue "Epic Name"`

### Stale state warning

If resuming after >24 hours, you'll see a warning. To proceed:

```bash
spectree-agent resume --force
```

### Reset authentication

Delete the config file and re-authenticate:

```bash
rm ~/.config/spectree-orchestrator/config.json
spectree-agent auth --token st_your-new-token
```

## Development

```bash
# Build
pnpm --filter @spectree/orchestrator build

# Watch mode
pnpm --filter @spectree/orchestrator dev

# Run tests
pnpm --filter @spectree/orchestrator test

# Type checking
pnpm --filter @spectree/orchestrator typecheck

# Run locally without building
npx tsx src/index.ts run "test prompt"
```

## Architecture

```
src/
├── index.ts              # CLI entry point
├── cli/
│   ├── commands/         # CLI command implementations
│   │   ├── run.ts        # Create and execute epic
│   │   ├── continue.ts   # Resume existing epic
│   │   ├── status.ts     # Show progress
│   │   ├── pause.ts      # Pause agents
│   │   ├── resume.ts     # Resume agents
│   │   └── auth.ts       # Authentication
│   └── state.ts          # Session state management
├── orchestrator/         # Core orchestration logic
│   ├── orchestrator.ts   # Main orchestration controller
│   ├── phase-executor.ts # Execute phases (parallel/sequential)
│   ├── agent-pool.ts     # Manage multiple SDK sessions
│   └── plan-generator.ts # Create epic from natural language
├── git/
│   ├── branch-manager.ts # Create/manage agent branches
│   └── merge-coordinator.ts # Merge completed work
├── spectree/
│   ├── api-client.ts     # REST API client
│   └── mcp-bridge.ts     # Expose MCP tools to SDK
├── ui/
│   ├── progress.ts       # Terminal progress display
│   └── agent-status.ts   # Show agent states
└── config/
    ├── index.ts          # Configuration management
    ├── loader.ts         # Config file loading
    └── schemas.ts        # Zod validation schemas
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@github/copilot-sdk` | Core AI agent engine |
| `commander` | CLI framework |
| `ora` | Terminal spinners |
| `chalk` | Colored output |
| `inquirer` | Interactive prompts |
| `simple-git` | Git operations |
| `conf` | Configuration storage |
| `ws` | WebSocket for real-time updates |
| `zod` | Schema validation |

## License

MIT
