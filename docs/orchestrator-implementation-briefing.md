# Implementation Briefing: SpecTree Parallel Agent Orchestrator CLI

## Purpose of This Document

This document provides complete context for an AI agent to create a comprehensive implementation plan in SpecTree for building a **Parallel Agent Orchestrator CLI Tool**.

---

## 1. Project Vision

### What We're Building

A CLI tool (`@spectree/orchestrator`) that allows developers to:
1. Describe a project/epic in natural language
2. Have AI automatically create structured plans in SpecTree
3. Execute the work using **parallel AI agents** when possible
4. Track progress, decisions, and handoffs automatically

### The "One Prompt" Dream

```bash
spectree-agent run "Build a user authentication system with OAuth, MFA, and session management"
```

This single command should:
1. Create an epic with features and tasks in SpecTree
2. Analyze execution plan (phases, dependencies, parallelism)
3. Spawn multiple AI agent sessions for parallel work
4. Coordinate branch-per-agent strategy
5. Track all progress back to SpecTree
6. Report completion and create PRs

---

## 2. Technical Foundation

### Existing SpecTree Architecture

```
SpecTree/
├── packages/
│   ├── api/          # Fastify REST API + Prisma ORM (SQLite)
│   ├── web/          # React + Vite + Tailwind + Radix UI
│   ├── mcp/          # MCP server for AI integrations (60+ tools)
│   ├── shared/       # Shared TypeScript types
│   └── orchestrator/ # NEW - This is what we're building
```

**Package dependencies:** `shared` ← `api`, `web`, `mcp`; and `api` ← `mcp`

### Key Technologies

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Package Manager | pnpm 9+ with workspaces |
| Build System | Turborepo |
| Language | TypeScript (strict mode) |
| Testing | Vitest |
| CLI Framework | Commander.js (recommended) |
| Agent Engine | **GitHub Copilot SDK** (`@github/copilot-sdk`) |

### GitHub Copilot SDK

The Copilot SDK is the core engine that enables programmatic AI agent control:

```typescript
import { CopilotClient, defineTool } from "@github/copilot-sdk";

const client = new CopilotClient();
const session = await client.createSession({
  model: "gpt-4.1",
  streaming: true,
  tools: [myCustomTool],
  mcpServers: { spectree: {...} }
});

// Send prompt, AI uses tools, returns response
const response = await session.sendAndWait({ prompt: "..." });
```

**SDK Capabilities:**
- Create multiple independent sessions (for parallel agents)
- Custom tools (or use MCP servers)
- Streaming responses with event listeners
- Custom system messages and agent personas

---

## 3. SpecTree MCP Tools Available

The orchestrator will leverage SpecTree's existing MCP tools. Key categories:

### Epic/Feature/Task Management
- `spectree__create_epic` / `spectree__create_feature` / `spectree__create_task`
- `spectree__update_feature` / `spectree__update_task`
- `spectree__get_epic` / `spectree__get_feature` / `spectree__get_task`

### Execution Planning (Critical for Parallelism)
- `spectree__get_execution_plan` - Returns phases with parallel groups
- `spectree__set_execution_metadata` - Set order, dependencies, parallelGroup
- `spectree__mark_blocked` / `spectree__mark_unblocked`

**Execution Plan Response Example:**
```json
{
  "phases": [
    {
      "order": 1,
      "items": [{ "identifier": "COM-1", "title": "Database Schema" }],
      "canRunInParallel": false
    },
    {
      "order": 2,
      "items": [
        { "identifier": "COM-2", "title": "REST API", "parallelGroup": "backend" },
        { "identifier": "COM-3", "title": "MCP Tools", "parallelGroup": "backend" }
      ],
      "canRunInParallel": true
    }
  ]
}
```

### Session Management
- `spectree__start_session` - Begin work on epic, get previous handoff context
- `spectree__end_session` - Save summary, next steps, blockers, decisions
- `spectree__get_progress_summary` - Dashboard view of epic status

### Progress Tracking
- `spectree__start_work` - Mark item as in-progress
- `spectree__complete_work` - Mark item as done with summary
- `spectree__log_progress` - Incremental progress updates

### Code Context
- `spectree__link_code_file` - Link files to features/tasks
- `spectree__link_branch` - Set git branch
- `spectree__link_commit` - Record commits
- `spectree__link_pr` - Link pull requests

### Decision Logging
- `spectree__log_decision` - Record decisions with rationale

### Validation
- `spectree__add_validation` - Add acceptance criteria checks
- `spectree__run_all_validations` - Verify work is complete

---

## 4. Orchestrator Architecture

### Core Components

```
packages/orchestrator/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── run.ts        # Main "run" command
│   │   │   ├── continue.ts   # Continue existing epic
│   │   │   ├── status.ts     # Check running agents
│   │   │   ├── pause.ts      # Pause an agent
│   │   │   └── auth.ts       # Authenticate with SpecTree
│   │   └── index.ts          # Command registration
│   ├── orchestrator/
│   │   ├── orchestrator.ts   # Main orchestration logic
│   │   ├── phase-executor.ts # Execute phases (parallel/sequential)
│   │   ├── agent-pool.ts     # Manage multiple SDK sessions
│   │   └── plan-generator.ts # Create epic from natural language
│   ├── git/
│   │   ├── branch-manager.ts # Create/manage agent branches
│   │   └── merge-coordinator.ts # Merge completed work
│   ├── spectree/
│   │   ├── api-client.ts     # REST API client
│   │   └── mcp-bridge.ts     # Expose MCP tools to SDK
│   ├── ui/
│   │   ├── progress.ts       # Terminal progress display
│   │   └── agent-status.ts   # Show agent states
│   └── config/
│       └── index.ts          # Configuration management
├── tests/
├── package.json
└── tsconfig.json
```

### Key Flows

#### Flow 1: New Epic from Prompt

```
User: spectree-agent run "Build auth system"
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. Plan Generator                       │
│    - Use Copilot to analyze request     │
│    - Create epic with features/tasks    │
│    - Set execution metadata             │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. Get Execution Plan from SpecTree     │
│    - Phases with parallelism info       │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 3. Phase Executor                       │
│    For each phase:                      │
│    - If canRunInParallel: spawn agents  │
│    - If sequential: single agent        │
│    - Wait for phase completion          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. Completion                           │
│    - Merge branches                     │
│    - End SpecTree session               │
│    - Report summary                     │
└─────────────────────────────────────────┘
```

#### Flow 2: Parallel Agent Execution

```
Phase with canRunInParallel=true
         │
         ▼
┌───────────────────┐  ┌───────────────────┐
│ Agent Pool        │  │ Branch Manager    │
│ Creates sessions  │  │ Creates branches  │
│ per item          │  │ per agent         │
└────────┬──────────┘  └─────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│ worker-1                worker-2        │
│ ┌───────────────┐      ┌───────────────┐│
│ │ SDK Session   │      │ SDK Session   ││
│ │ COM-2: API    │      │ COM-3: MCP    ││
│ │ branch: f/api │      │ branch: f/mcp ││
│ └───────────────┘      └───────────────┘│
│         │                      │        │
│         ▼                      ▼        │
│    Work on files          Work on files │
│    Commit to branch      Commit to branch
│         │                      │        │
│         ▼                      ▼        │
│    Report progress       Report progress│
│    to SpecTree           to SpecTree    │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Wait for all agents in phase            │
│ Promise.all([worker1, worker2])         │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ Merge Coordinator                       │
│ - Merge feature branches to main        │
│ - Resolve any conflicts                 │
└─────────────────────────────────────────┘
```

---

## 5. CLI Commands Specification

### `spectree-agent run <prompt>`

Create and execute a new epic from a natural language description.

```
Options:
  --team <name>       Team to create epic in (prompts if not specified)
  --dry-run           Show plan without executing
  --sequential        Disable parallel execution
  --max-agents <n>    Maximum concurrent agents (default: 4)
  --branch <name>     Base branch (default: current or main)
```

**Example:**
```bash
spectree-agent run "Build user dashboard with activity charts" --team Engineering
```

### `spectree-agent continue <epic>`

Continue working on an existing epic.

```
Options:
  --from <feature>    Start from specific feature
  --skip-completed    Skip already completed items
```

**Example:**
```bash
spectree-agent continue "User Dashboard"
```

### `spectree-agent status`

Show status of running orchestration.

```
Output:
  Epic: User Dashboard (65% complete)
  
  Active Agents:
    worker-1: COM-5 "API endpoints" (branch: feature/COM-5) - 40% complete
    worker-2: COM-6 "MCP tools" (branch: feature/COM-6) - 60% complete
  
  Completed this session:
    ✓ COM-3 "Database schema"
    ✓ COM-4 "Service layer"
  
  Up next:
    COM-7 "Frontend integration" (waiting on COM-5, COM-6)
```

### `spectree-agent pause [worker]`

Pause a running agent or all agents.

### `spectree-agent resume [worker]`

Resume paused agents.

### `spectree-agent auth`

Authenticate with SpecTree API.

```bash
spectree-agent auth
# Opens browser for OAuth or prompts for API token
# Stores token in ~/.spectree/credentials
```

---

## 6. Configuration

### User Configuration (`~/.spectree/config.json`)

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

### Project Configuration (`.spectree.json` in repo root)

```json
{
  "team": "Engineering",
  "testCommand": "pnpm test",
  "lintCommand": "pnpm lint",
  "buildCommand": "pnpm build"
}
```

---

## 7. Dependencies

### Required npm packages

```json
{
  "dependencies": {
    "@github/copilot-sdk": "latest",
    "commander": "^12.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0",
    "inquirer": "^9.0.0",
    "simple-git": "^3.0.0",
    "conf": "^12.0.0",
    "ws": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0",
    "@types/inquirer": "^9.0.0",
    "@types/ws": "^8.0.0"
  }
}
```

### Why these packages:

| Package | Purpose |
|---------|---------|
| `@github/copilot-sdk` | Core AI agent engine |
| `commander` | CLI framework (industry standard) |
| `ora` | Terminal spinners for progress |
| `chalk` | Colored terminal output |
| `inquirer` | Interactive prompts |
| `simple-git` | Git operations (branch, commit, merge) |
| `conf` | Configuration storage |
| `ws` | WebSocket for real-time updates |

---

## 8. Testing Strategy

### Unit Tests
- Orchestrator logic
- Phase execution
- Branch management

### Integration Tests
- Full flow with mock Copilot SDK
- SpecTree API interaction

### E2E Tests (Manual)
- Real Copilot SDK with test epic
- Verify parallel execution works

---

## 9. Error Handling

### Scenarios to Handle

1. **Agent Failure**: One parallel agent fails
   - Pause other agents
   - Report error with context
   - Option to retry or skip

2. **Merge Conflict**: Branch can't merge
   - Stop and report
   - Provide resolution guidance

3. **SpecTree API Down**: Can't connect
   - Retry with backoff
   - Cache progress locally

4. **Copilot Rate Limit**: Too many requests
   - Queue and throttle
   - Reduce parallelism

---

## 10. Team Visibility (Future Web Dashboard)

After CLI is working, extend SpecTree web with:

- `/orchestrator/runs` - List of orchestration runs
- `/orchestrator/runs/:id` - Single run detail with agent progress
- Real-time WebSocket updates
- Intervention controls (pause/resume/cancel)

---

## 11. Success Criteria

The implementation is complete when:

1. **CLI Installable**: `npm install -g @spectree/orchestrator`

2. **Basic Flow Works**:
   ```bash
   spectree-agent run "Add user preferences API endpoint"
   # Creates epic, executes work, reports completion
   ```

3. **Parallel Execution Works**:
   - Multiple agents run concurrently when execution plan allows
   - Each agent has its own branch
   - All progress tracked in SpecTree

4. **Session Management**:
   - Start/end sessions properly
   - Handoff context preserved
   - Can resume interrupted work

5. **Team Usable**:
   - Easy authentication
   - Clear documentation
   - Helpful error messages

---

## 12. Reference Documents

These documents contain additional context (already in the codebase):

| Document | Location | Content |
|----------|----------|---------|
| SpecTree README | `/README.md` | Full project documentation |
| MCP Tools Reference | `/docs/MCP/tools-reference.md` | All 60+ MCP tools |
| Execution Metadata | `/docs/MCP/execution-metadata.md` | Parallel execution details |
| Session Handoff | `/docs/MCP/session-handoff.md` | Session management |
| Copilot SDK Analysis | `/docs/analysis-spectree-mcp-vs-copilot-sdk.md` | SDK capabilities |
| Platform Analysis | `/docs/platform-analysis-for-spectree-orchestrator.md` | Architecture decision |
| Copilot Instructions | `/.github/copilot-instructions.md` | SpecTree conventions |

---

## 13. Questions for Implementation Planning

When creating the implementation plan, consider:

1. **Phasing**: What's the minimum viable first release?
2. **Risk**: What could go wrong and how to mitigate?
3. **Testing**: How to test parallel agents without real Copilot costs?
4. **Dependencies**: What must exist before parallel execution can work?
5. **Documentation**: What docs do team members need?

---

## 14. Suggested Epic Structure

The implementation plan should create an epic with features roughly like:

1. **Project Setup** - Initialize package, deps, TypeScript config
2. **CLI Framework** - Basic command structure with Commander
3. **SpecTree Integration** - API client, authentication
4. **Single Agent Execution** - One agent working through tasks
5. **Execution Plan Integration** - Use SpecTree's execution plans
6. **Parallel Agent Pool** - Multiple concurrent SDK sessions
7. **Branch Management** - Git branch-per-agent strategy
8. **Progress UI** - Terminal progress display
9. **Error Handling & Recovery** - Robust error handling
10. **Documentation & Testing** - User docs, tests

Each feature should have multiple tasks with detailed acceptance criteria.

---

## Summary

This briefing provides everything needed to create a comprehensive SpecTree implementation plan for the Parallel Agent Orchestrator CLI. The agent should use SpecTree's own tools to create the epic, with proper execution metadata for parallelism, detailed structured descriptions, and clear acceptance criteria.

The goal is a tool that makes parallel AI-assisted development accessible to the whole team through a simple CLI interface.
