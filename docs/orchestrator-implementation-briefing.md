# Implementation Briefing: SpecTree Parallel Agent Orchestrator CLI

## Purpose of This Document

This document provides complete context for an AI agent to create a comprehensive implementation plan in SpecTree for building a **Parallel Agent Orchestrator CLI Tool**.

---

## 🔴 CURRENT IMPLEMENTATION STATUS

> **Last Updated:** 2025-02-03

### What Has Been Implemented

The following **scaffolding** has been created in `packages/orchestrator/`:

| Component | Status | Notes |
|-----------|--------|-------|
| `package.json` | ✅ Complete | All dependencies defined, bin entry configured |
| `tsconfig.json` | ✅ Complete | TypeScript configuration |
| `vitest.config.ts` | ✅ Complete | Test configuration |
| `README.md` | ✅ Complete | Package documentation |
| `src/index.ts` | ✅ Complete | CLI entry point with Commander.js |
| `src/cli/index.ts` | ✅ Complete | Command exports |
| `src/cli/commands/run.ts` | 🟡 Stub only | Prints options, no logic |
| `src/cli/commands/continue.ts` | 🟡 Stub only | Prints options, no logic |
| `src/cli/commands/status.ts` | 🟡 Stub only | No logic |
| `src/cli/commands/auth.ts` | 🟡 Stub only | Saves token to conf, no validation |

### What Is NOT Implemented (Empty Directories)

The following directories exist but contain **no files**:

| Directory | Expected Contents | Status |
|-----------|-------------------|--------|
| `src/orchestrator/` | Core orchestration logic | ❌ Empty |
| `src/git/` | Branch and merge management | ❌ Empty |
| `src/spectree/` | API client and MCP bridge | ❌ Empty |
| `src/ui/` | Progress and status display | ❌ Empty |
| `src/config/` | Configuration management | ❌ Empty |
| `tests/` | All tests | ❌ Empty |

### Missing CLI Commands (Per Briefing Spec)

The briefing specifies these commands that are **not implemented**:

- `spectree-agent pause [worker]` - Pause running agents
- `spectree-agent resume [worker]` - Resume paused agents

### Dependencies Installed

```bash
pnpm install  # ✅ Completed successfully
pnpm build    # ✅ TypeScript compiles
```

### CLI Functional (Stubs Only)

```bash
node packages/orchestrator/dist/index.js run "test"  # ✅ Works (stub output)
```

---

## 🎯 REMAINING IMPLEMENTATION WORK

The following sections describe what **must be built** to complete the orchestrator.

### Priority 1: Core Infrastructure (Must Build First)

#### 1.1 Configuration Module (`src/config/index.ts`)
- Load user config from `~/.spectree/config.json`
- Load project config from `.spectree.json` in repo root
- Merge configs with sensible defaults
- Provide typed accessors for all config values
- **Acceptance Criteria:**
  - `getConfig()` returns merged user + project config
  - `getApiUrl()`, `getDefaultTeam()`, `getMaxAgents()` helpers work
  - Creates default config if missing

#### 1.2 SpecTree API Client (`src/spectree/api-client.ts`)
- HTTP client for SpecTree REST API (`/api/v1/...`)
- Authentication with stored token
- Methods for all CRUD operations (epics, features, tasks)
- Get execution plan endpoint
- Error handling with typed errors
- **Acceptance Criteria:**
  - `createEpic()`, `getEpic()`, `updateFeature()` etc. work
  - `getExecutionPlan(epicId)` returns typed phases
  - Auth errors throw specific `AuthError`
  - Network errors throw `NetworkError` with retry hints

#### 1.3 MCP Bridge (`src/spectree/mcp-bridge.ts`)
- Wraps SpecTree MCP tools for Copilot SDK consumption
- Defines tools using `defineTool()` from SDK
- Exposes key MCP tools: start_work, complete_work, log_progress, log_decision, link_code_file, link_branch, link_commit
- **Acceptance Criteria:**
  - Each wrapped tool is compatible with Copilot SDK's tool format
  - Tools call SpecTree API client under the hood
  - Error handling is consistent

### Priority 2: Single Agent Execution (MVP)

#### 2.1 Plan Generator (`src/orchestrator/plan-generator.ts`)
- Takes natural language prompt
- Uses Copilot SDK to create epic structure
- Calls SpecTree API to create epic/features/tasks
- Sets execution metadata (order, complexity, parallelism)
- **Acceptance Criteria:**
  - `generatePlan(prompt, team)` creates full epic in SpecTree
  - Returns created epic ID and feature count
  - Uses structured prompts to ensure consistent output

#### 2.2 Single Agent Orchestrator (`src/orchestrator/orchestrator.ts`)
- Main orchestration controller
- Loads execution plan
- Executes items sequentially (parallel comes later)
- Manages Copilot SDK session lifecycle
- Reports progress back to SpecTree
- **Acceptance Criteria:**
  - `run(epicId)` executes all features/tasks sequentially
  - Each item: start_work → agent executes → complete_work
  - Progress shown in terminal
  - Session properly started and ended

#### 2.3 Run Command Implementation (`src/cli/commands/run.ts`)
- Replace stub with actual implementation
- Authenticate, create plan, execute orchestrator
- Handle `--dry-run` (show plan without executing)
- Handle `--sequential` (force sequential even if parallel allowed)
- **Acceptance Criteria:**
  - `spectree-agent run "prompt"` creates and executes epic
  - `--dry-run` shows plan and exits
  - Error handling with helpful messages

### Priority 3: Git Integration

#### 3.1 Branch Manager (`src/git/branch-manager.ts`)
- Create feature branches from base
- Checkout branches
- Get current branch
- List branches by pattern
- **Acceptance Criteria:**
  - `createBranch(name, base)` creates and checks out branch
  - `getCurrentBranch()` returns current branch name
  - Handles existing branch gracefully

#### 3.2 Merge Coordinator (`src/git/merge-coordinator.ts`)
- Merge feature branch to base
- Detect and report conflicts
- Provide resolution guidance
- **Acceptance Criteria:**
  - `mergeBranch(feature, base)` merges successfully or throws
  - Conflict errors include which files conflict
  - Can abort failed merge cleanly

### Priority 4: Parallel Agent Execution

#### 4.1 Agent Pool (`src/orchestrator/agent-pool.ts`)
- Manage multiple Copilot SDK sessions
- Spawn N agents up to max limit
- Track agent status (idle, working, completed, failed)
- Clean up sessions on completion
- **Acceptance Criteria:**
  - `spawnAgent(task, branch)` creates new SDK session
  - `waitForAll()` resolves when all agents complete
  - Failed agents don't crash the pool
  - Respects `maxConcurrentAgents` config

#### 4.2 Phase Executor (`src/orchestrator/phase-executor.ts`)
- Execute a single phase from execution plan
- If `canRunInParallel`: spawn agents via agent pool
- If not: execute sequentially with single agent
- Wait for phase completion before next phase
- **Acceptance Criteria:**
  - `executePhase(phase)` runs all items in phase
  - Parallel items get separate branches and agents
  - Sequential items use single agent
  - Reports individual item progress

#### 4.3 Enhanced Orchestrator
- Update `orchestrator.ts` to use PhaseExecutor
- Process phases in order
- Merge branches between phases
- **Acceptance Criteria:**
  - Parallel phases spawn multiple agents
  - Branches merged before next phase starts
  - Merge conflicts pause execution with guidance

### Priority 5: UI and Progress Display

#### 5.1 Progress Display (`src/ui/progress.ts`)
- Terminal-based progress for orchestration
- Show overall epic progress (% complete)
- Show current phase and items
- Use `ora` spinners for active work
- **Acceptance Criteria:**
  - Progress updates in real-time
  - Shows which items are in-progress
  - Shows completed items with checkmarks
  - Clear error display

#### 5.2 Agent Status Display (`src/ui/agent-status.ts`)
- Show status of each parallel agent
- Display agent branch, current file, progress
- Update as agents report progress
- **Acceptance Criteria:**
  - Multi-line display for parallel agents
  - Each agent shows: ID, task, branch, progress %
  - Updates without flickering

### Priority 6: Continue and Status Commands

#### 6.1 Continue Command (`src/cli/commands/continue.ts`)
- Load existing epic from SpecTree
- Get execution plan
- Find next incomplete item
- Resume orchestration
- Use session handoff context
- **Acceptance Criteria:**
  - `spectree-agent continue "Epic Name"` resumes work
  - Reads previous session handoff
  - `--from COM-5` starts from specific feature
  - Shows what was already completed

#### 6.2 Status Command (`src/cli/commands/status.ts`)
- Show current orchestration status
- Load active session if any
- Display progress summary
- Show active agents and their status
- **Acceptance Criteria:**
  - Shows "No active orchestration" if none running
  - Shows epic progress with feature breakdown
  - Shows agent status if parallel execution active

### Priority 7: Additional Commands

#### 7.1 Pause Command (`src/cli/commands/pause.ts`)
- Pause running orchestration
- Save state for resume
- Option to pause specific agent or all
- **Acceptance Criteria:**
  - `spectree-agent pause` pauses all agents
  - `spectree-agent pause worker-1` pauses specific agent
  - State saved to allow resume

#### 7.2 Resume Command (`src/cli/commands/resume.ts`)
- Resume paused orchestration
- Restore state and continue
- **Acceptance Criteria:**
  - `spectree-agent resume` continues from pause point
  - Picks up where left off

### Priority 8: Error Handling and Recovery

#### 8.1 Error Types (`src/errors.ts`)
- Define typed errors: AuthError, NetworkError, AgentError, MergeConflictError
- Include context and recovery hints
- **Acceptance Criteria:**
  - Each error type has code, message, context
  - Recovery hints are actionable

#### 8.2 Retry Logic
- Automatic retry for transient failures
- Exponential backoff
- Max retry limits
- **Acceptance Criteria:**
  - Network errors retry 3 times
  - Auth errors don't retry (require user action)
  - Agent errors offer retry or skip

#### 8.3 Recovery State
- Save checkpoint state during execution
- Allow resuming from last checkpoint on crash
- **Acceptance Criteria:**
  - State saved after each completed item
  - `spectree-agent continue` resumes from checkpoint

### Priority 9: Testing

#### 9.1 Unit Tests (`tests/unit/`)
- Test configuration loading
- Test API client methods (with mocks)
- Test branch manager
- Test phase execution logic
- **Target:** 80% code coverage for core modules

#### 9.2 Integration Tests (`tests/integration/`)
- Test full flow with mocked SDK
- Test SpecTree API integration
- Test git operations
- **Target:** Key flows covered

#### 9.3 E2E Tests (`tests/e2e/`)
- Manual test script with real SDK
- Test parallel execution
- Document results
- **Target:** Documented manual test procedure

### Priority 10: Documentation

#### 10.1 User Documentation
- Installation guide
- Authentication setup
- Command reference with examples
- Troubleshooting guide
- **Location:** `packages/orchestrator/README.md`

#### 10.2 Architecture Documentation
- Component diagram
- Data flow diagrams
- Extension points
- **Location:** `docs/orchestrator-architecture.md`

---

## 📋 DETAILED COMPONENT SPECIFICATIONS

The following sections provide additional context for implementation.

---

## Appendix A: Project Vision

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

## Appendix B: Technical Foundation

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

## Appendix C: SpecTree MCP Tools Available

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

## Appendix D: Orchestrator Architecture

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

## Appendix E: CLI Commands Specification

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

## Appendix F: Configuration

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

## Appendix G: Dependencies

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

## Appendix H: Testing Strategy

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

## Appendix I: Error Handling

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

## Appendix J: Team Visibility (Future Web Dashboard)

After CLI is working, extend SpecTree web with:

- `/orchestrator/runs` - List of orchestration runs
- `/orchestrator/runs/:id` - Single run detail with agent progress
- Real-time WebSocket updates
- Intervention controls (pause/resume/cancel)

---

## Appendix K: Success Criteria

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

## Appendix L: Reference Documents

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

## Appendix M: Questions for Implementation Planning

When creating the implementation plan, consider:

1. **Phasing**: What's the minimum viable first release?
2. **Risk**: What could go wrong and how to mitigate?
3. **Testing**: How to test parallel agents without real Copilot costs?
4. **Dependencies**: What must exist before parallel execution can work?
5. **Documentation**: What docs do team members need?

---

## Appendix N: Suggested Epic Structure

The implementation plan should create an epic with features roughly like:

1. ~~**Project Setup** - Initialize package, deps, TypeScript config~~ ✅ DONE
2. ~~**CLI Framework** - Basic command structure with Commander~~ ✅ DONE (stubs only)
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

---

## 📊 IMPLEMENTATION METRICS

| Metric | Value |
|--------|-------|
| **Files Implemented** | 7 (package.json, tsconfig.json, vitest.config.ts, README.md, index.ts, cli/index.ts, 4 command stubs) |
| **Files Remaining** | ~15-20 core modules |
| **Estimated Completion** | ~15-20% (scaffolding complete, core logic not started) |
| **Priority 1-2 Must Complete** | Config, API Client, MCP Bridge, Plan Generator, Orchestrator, Run Command |
| **Dependencies Ready** | ✅ All npm dependencies installed and TypeScript compiles |

### Quick Start for Implementation Agent

```bash
# The package is ready for development
cd packages/orchestrator
pnpm dev  # Watch mode

# Run the stub CLI
node dist/index.js run "test"

# Files to implement (in priority order):
# 1. src/config/index.ts
# 2. src/spectree/api-client.ts  
# 3. src/spectree/mcp-bridge.ts
# 4. src/orchestrator/plan-generator.ts
# 5. src/orchestrator/orchestrator.ts
# 6. Update src/cli/commands/run.ts with real logic
```
