# SpecTree Orchestrator Architecture

> **Version:** 1.0  
> **Last Updated:** 2026-02-04  
> **Package:** `@spectree/orchestrator`

## Overview

The SpecTree Orchestrator is a CLI tool that coordinates multiple AI agents to implement software features in parallel. It bridges the gap between natural language project descriptions and structured, executed development work.

### Purpose

Enable developers to:
1. Describe projects/epics in natural language
2. Automatically create structured execution plans in SpecTree
3. Execute work using parallel AI agents when tasks are independent
4. Track all progress, decisions, and handoffs automatically

### Key Capabilities

- **Parallel Execution**: Multiple Copilot SDK sessions run concurrently on independent tasks
- **Branch-per-Agent**: Each parallel agent works on its own git branch to prevent conflicts
- **Phase-based Execution**: Work is organized into phases with dependency awareness
- **Automatic Merging**: Completed branches are merged after each phase
- **Progress Tracking**: All work is tracked in SpecTree with real-time updates
- **Session Continuity**: Handoff context preserved for resuming interrupted work

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer                                       │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│  │   run   │  │ continue │  │ status │  │ pause  │  │  auth  │             │
│  │ command │  │ command  │  │command │  │command │  │command │             │
│  └────┬────┘  └────┬─────┘  └───┬────┘  └───┬────┘  └───┬────┘             │
│       │            │            │           │           │                   │
│       └────────────┴────────────┴───────────┴───────────┘                   │
│                                │                                            │
│                    src/cli/commands/*.ts                                    │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Orchestrator Core                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Orchestrator                                  │    │
│  │                    src/orchestrator/orchestrator.ts                  │    │
│  │                                                                      │    │
│  │  • Executes complete epics via phased execution                      │    │
│  │  • Manages session lifecycle with SpecTree                           │    │
│  │  • Coordinates branch merging between phases                         │    │
│  │  • Emits progress events for UI consumption                          │    │
│  └─────────────────────────────┬───────────────────────────────────────┘    │
│                                │                                            │
│           ┌────────────────────┼────────────────────┐                       │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Plan Generator  │  │ Phase Executor  │  │   Agent Pool    │             │
│  │                 │  │                 │  │                 │             │
│  │ Creates epic    │  │ Runs phases in  │  │ Manages Copilot │             │
│  │ structure from  │  │ parallel or     │  │ SDK sessions    │             │
│  │ NL prompt       │  │ sequential mode │  │ (concurrent)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  src/orchestrator/plan-generator.ts    src/orchestrator/agent-pool.ts       │
│  src/orchestrator/phase-executor.ts    src/orchestrator/recovery.ts         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SpecTree      │    │      Git        │    │    Copilot      │
│   Client        │    │    Manager      │    │      SDK        │
│                 │    │                 │    │                 │
│ API calls to    │    │ Branch/merge    │    │ AI agent        │
│ SpecTree REST   │    │ operations      │    │ sessions        │
│ API             │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
│ src/spectree/        │ src/git/             │ @github/copilot-sdk
│ api-client.ts        │ branch-manager.ts    │
│ mcp-bridge.ts        │ merge-coordinator.ts │
└──────────────────────┴──────────────────────┴───────────────────
```

---

## Core Components

### 1. CLI Layer (`src/cli/`)

Entry point for user interaction. Built with [Commander.js](https://github.com/tj/commander.js/).

| Command | File | Description |
|---------|------|-------------|
| `run <prompt>` | `commands/run.ts` | Create and execute new epic from natural language |
| `continue <epic>` | `commands/continue.ts` | Resume work on existing epic |
| `status` | `commands/status.ts` | Display current orchestration status |
| `auth` | `commands/auth.ts` | Authenticate with SpecTree API |

**Key Responsibilities:**
- Parse command-line arguments and options
- Initialize configuration with CLI overrides
- Coordinate between user input and orchestrator core
- Display progress and results

### 2. Orchestrator (`src/orchestrator/orchestrator.ts`)

Main orchestration controller that coordinates all components.

```typescript
interface OrchestratorOptions {
  client: SpecTreeClient;      // API client for SpecTree
  tools: Tool<unknown>[];      // Agent tools (from MCP bridge)
  maxAgents?: number;          // Max concurrent agents (default: 4)
  copilotClient?: CopilotClient;
  branchManager?: BranchManager;
  mergeCoordinator?: MergeCoordinator;
}

interface RunOptions {
  sequential?: boolean;        // Force sequential execution
  fromFeature?: string;        // Start from specific feature
  sessionId?: string;          // Associate with SpecTree session
  baseBranch?: string;         // Base branch for feature branches
}
```

**Responsibilities:**
- Load execution plan from SpecTree
- Process phases in order
- Coordinate PhaseExecutor for each phase
- Merge branches between phases
- Handle merge conflicts with pause/resume
- Track and emit progress events

### 3. Phase Executor (`src/orchestrator/phase-executor.ts`)

Executes a single phase from the execution plan.

```typescript
interface PhaseExecutorOptions {
  agentPool: AgentPool;
  branchManager: BranchManager;
  specTreeClient: SpecTreeClient;
  sessionId?: string;
  baseBranch?: string;
}
```

**Execution Modes:**

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Parallel** | `phase.canRunInParallel && items.length > 1` | Each item gets own branch + agent |
| **Sequential** | Otherwise | Items executed one at a time on shared branch |

**Responsibilities:**
- Create git branches for parallel items
- Spawn agents via AgentPool
- Track item progress in SpecTree (start_work, complete_work)
- Aggregate results from all items in phase

### 4. Agent Pool (`src/orchestrator/agent-pool.ts`)

Manages multiple concurrent Copilot SDK sessions.

```typescript
interface AgentPoolOptions {
  maxAgents: number;              // Pool size limit
  tools: Tool<unknown>[];         // Tools for each agent
  specTreeClient: SpecTreeClient;
  copilotClient?: CopilotClient;
  model?: string;                 // Copilot model (default from config)
}

interface Agent {
  id: string;              // e.g., "worker-1"
  taskId: string;          // e.g., "COM-5"
  branch: string;          // e.g., "feature/COM-5"
  status: AgentStatus;     // idle | working | completed | failed | paused
  session: CopilotSession; // SDK session handle
  progress: number;        // 0-100
}
```

**Events Emitted:**
- `agent:spawn` - Agent created
- `agent:start` - Agent began working
- `agent:progress` - Progress update
- `agent:complete` - Agent finished successfully
- `agent:error` - Agent failed
- `pool:full` - No capacity for new agents
- `pool:empty` - All agents completed

### 5. Plan Generator (`src/orchestrator/plan-generator.ts`)

Creates epic structure from natural language prompts.

**Flow:**
1. Take user's natural language description
2. Use Copilot SDK to analyze and structure
3. Create epic, features, and tasks via SpecTree API
4. Set execution metadata (order, parallelism, dependencies)
5. Return created epic ID

### 6. SpecTree Client (`src/spectree/api-client.ts`)

HTTP client for the SpecTree REST API.

**Features:**
- Bearer token authentication
- Automatic retry with exponential backoff
- 30-second request timeout
- Typed error mapping

**Key Operations:**

| Category | Methods |
|----------|---------|
| **Epics** | `createEpic`, `getEpic`, `updateEpic`, `listEpics` |
| **Features** | `createFeature`, `getFeature`, `updateFeature`, `listFeatures` |
| **Tasks** | `createTask`, `getTask`, `updateTask`, `listTasks` |
| **Execution** | `getExecutionPlan`, `startWork`, `completeWork`, `logProgress` |
| **Sessions** | `startSession`, `endSession`, `getSession` |
| **Decisions** | `logDecision`, `getDecisions` |
| **Code Context** | `linkCodeFile`, `linkBranch`, `linkCommit` |

### 7. MCP Bridge (`src/spectree/mcp-bridge.ts`)

Wraps SpecTree operations as Copilot SDK tools for agents.

**Agent Tools (5):**

| Tool | Purpose |
|------|---------|
| `log_progress` | Report incremental progress on task |
| `log_decision` | Record implementation decisions with rationale |
| `link_code_file` | Report files created/modified |
| `get_task_context` | Retrieve task requirements and description |
| `get_code_context` | Get linked files, branch, commits |

**Note:** Orchestrator-only operations (`start_work`, `complete_work`, `link_branch`, `link_commit`) are NOT exposed as agent tools. The orchestrator controls work lifecycle externally.

### 8. Git Manager (`src/git/`)

Git operations for branch-per-agent strategy.

**Branch Manager (`branch-manager.ts`):**
```typescript
class BranchManager {
  createBranch(name: string, base?: string): Promise<void>;
  checkout(branch: string): Promise<void>;
  getCurrentBranch(): Promise<string>;
  branchExists(name: string): Promise<boolean>;
  generateBranchName(identifier: string, title: string): string;
  getDefaultBranch(): Promise<string>;
}
```

**Merge Coordinator (`merge-coordinator.ts`):**
```typescript
class MergeCoordinator {
  mergeBranch(feature: string, base: string): Promise<MergeResult>;
  abortMerge(): Promise<void>;
  hasMergeConflicts(): Promise<boolean>;
  getConflictingFiles(): Promise<string[]>;
}
```

### 9. Configuration (`src/config/`)

Multi-source configuration with priority merging.

**Config Priority (highest to lowest):**
1. CLI arguments
2. Environment variables (`SPECTREE_*`)
3. Project config (`.spectree.json` in repo root)
4. User config (`~/.spectree/config.json`)
5. Default values

**Key Configuration:**

```typescript
interface Config {
  apiUrl: string;              // SpecTree API URL
  defaultTeam?: string;        // Default team for new epics
  maxConcurrentAgents: number; // Max parallel agents (default: 4)
  autoMerge: boolean;          // Auto-merge after phases (default: true)
  branchPrefix: string;        // Branch prefix (default: "feature/")
  copilot: {
    model: string;             // Copilot model (default: "gpt-4.1")
  };
  testCommand?: string;        // Project test command
  lintCommand?: string;        // Project lint command
  buildCommand?: string;       // Project build command
}
```

### 10. Error Handling (`src/errors.ts`)

Typed error classes with recovery hints.

**Error Types:**

| Class | Use Case |
|-------|----------|
| `OrchestratorError` | Base class for all errors |
| `AuthError` | Authentication failures |
| `NetworkError` | Connection/timeout issues |
| `AgentError` | Agent spawn/execution failures |
| `MergeConflictError` | Git merge conflicts |
| `SpecTreeAPIError` | API response errors |
| `ConfigError` | Configuration issues |

**Error Codes:**
```typescript
enum ErrorCode {
  AUTH_MISSING_TOKEN, AUTH_INVALID_TOKEN, AUTH_EXPIRED_TOKEN,
  NETWORK_CONNECTION_FAILED, NETWORK_TIMEOUT, NETWORK_SERVER_ERROR,
  AGENT_SPAWN_FAILED, AGENT_EXECUTION_FAILED, AGENT_TIMEOUT,
  MERGE_CONFLICT, GIT_OPERATION_FAILED,
  SPECTREE_API_ERROR, SPECTREE_NOT_FOUND, SPECTREE_VALIDATION_ERROR,
  CONFIG_INVALID, CONFIG_MISSING,
  UNKNOWN_ERROR
}
```

### 11. UI Components (`src/ui/`)

Terminal-based progress display.

**Progress Display (`progress.ts`):**
- Overall epic progress (% complete)
- Current phase and items
- Spinner for active work

**Agent Status Display (`agent-status.ts`):**
- Multi-agent parallel view
- Per-agent: ID, task, branch, progress %
- Real-time updates without flickering

---

## Data Flow

### Run Command Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. User: spectree-agent run "Build auth system with OAuth and MFA"          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Plan Generator                                                            │
│    • Parse natural language prompt                                           │
│    • Use Copilot SDK to structure into epic/features/tasks                   │
│    • Call SpecTree API to create entities                                    │
│    • Set execution metadata (order, parallelism, dependencies)               │
│    └─► Returns: epicId                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Load Execution Plan                                                       │
│    • SpecTree API: GET /api/v1/epics/{id}/execution-plan                     │
│    └─► Returns: phases with parallelism info                                 │
│                                                                              │
│    {                                                                         │
│      phases: [                                                               │
│        { order: 1, items: [...], canRunInParallel: false },                  │
│        { order: 2, items: [...], canRunInParallel: true },                   │
│      ]                                                                       │
│    }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. For Each Phase                                                            │
│                                                                              │
│    ┌─ If canRunInParallel ─────────────────────────────────────────────┐    │
│    │                                                                    │    │
│    │  For each item in parallel:                                        │    │
│    │    • Create branch: feature/{identifier}                           │    │
│    │    • Spawn agent via AgentPool                                     │    │
│    │    • Mark start_work in SpecTree                                   │    │
│    │    • Agent executes task (uses tools)                              │    │
│    │    • Mark complete_work in SpecTree                                │    │
│    │                                                                    │    │
│    │  Wait for all agents: Promise.all([...])                           │    │
│    │                                                                    │    │
│    └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│    ┌─ If sequential ────────────────────────────────────────────────────┐    │
│    │                                                                    │    │
│    │  For each item in order:                                           │    │
│    │    • Create shared branch (first item only)                        │    │
│    │    • Execute single agent                                          │    │
│    │    • Track progress                                                │    │
│    │    • Stop on first failure                                         │    │
│    │                                                                    │    │
│    └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. After Each Phase: Merge Branches                                          │
│                                                                              │
│    For each feature branch from parallel execution:                          │
│      • MergeCoordinator.mergeBranch(featureBranch, baseBranch)               │
│      • If conflict: pause execution, emit merge:conflict event               │
│                                                                              │
│    ┌─ On Merge Conflict ────────────────────────────────────────────────┐    │
│    │  • Save checkpoint state                                           │    │
│    │  • Display conflicting files                                       │    │
│    │  • User resolves manually                                          │    │
│    │  • spectree-agent continue to resume                               │    │
│    └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Completion                                                                │
│    • End SpecTree session (save handoff context)                             │
│    • Display final summary                                                   │
│    • Return RunResult with completed/failed items                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Parallel Agent Execution Detail

```
Phase with canRunInParallel=true, 3 items
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agent Pool                                      │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  worker-1   │  │  worker-2   │  │  worker-3   │                          │
│  │             │  │             │  │             │                          │
│  │ Task: COM-2 │  │ Task: COM-3 │  │ Task: COM-4 │                          │
│  │ Branch:     │  │ Branch:     │  │ Branch:     │                          │
│  │ feature/    │  │ feature/    │  │ feature/    │                          │
│  │   COM-2     │  │   COM-3     │  │   COM-4     │                          │
│  │             │  │             │  │             │                          │
│  │ SDK Session │  │ SDK Session │  │ SDK Session │                          │
│  │ (Copilot)   │  │ (Copilot)   │  │ (Copilot)   │                          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                          │
│         │                │                │                                  │
│         ▼                ▼                ▼                                  │
│    ┌─────────────────────────────────────────────────────────┐              │
│    │              Agent Tools (MCP Bridge)                    │              │
│    │  • log_progress    • link_code_file                     │              │
│    │  • log_decision    • get_task_context                   │              │
│    │  • get_code_context                                     │              │
│    └─────────────────────────────────────────────────────────┘              │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
                    Promise.all([worker-1, worker-2, worker-3])
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      All agents complete     │
                    │                              │
                    │  Results:                    │
                    │   worker-1: ✓ success        │
                    │   worker-2: ✓ success        │
                    │   worker-3: ✗ failed         │
                    └──────────────────────────────┘
                                   │
                                   ▼
                    Merge successful branches to base
```

---

## Extension Points

### Custom Agent Tools

Add custom tools for agents in `src/spectree/mcp-bridge.ts`:

```typescript
import { defineTool } from "@github/copilot-sdk";

export function createCustomTools(client: SpecTreeClient): Tool<unknown>[] {
  return [
    defineTool({
      name: "my_custom_tool",
      description: "Description of what this tool does",
      parameters: {
        type: "object",
        properties: {
          param1: { type: "string", description: "Parameter description" },
        },
        required: ["param1"],
      },
      handler: async ({ param1 }) => {
        // Implement tool logic
        return { success: true, data: "result" };
      },
    }),
  ];
}
```

### Custom Execution Strategy

Implement custom phase execution by extending `PhaseExecutor`:

```typescript
import { PhaseExecutor, type PhaseResult } from "./phase-executor.js";
import type { ExecutionPhase } from "../spectree/api-client.js";

export class CustomPhaseExecutor extends PhaseExecutor {
  /**
   * Override parallel execution with custom logic
   */
  protected async executeParallel(
    items: ExecutionItem[],
    baseBranch: string
  ): Promise<ItemResult[]> {
    // Custom parallel logic, e.g.:
    // - Different batching strategy
    // - Priority-based ordering
    // - Resource-aware scheduling
    return super.executeParallel(items, baseBranch);
  }
}
```

### Custom Progress Display

Create custom UI by listening to orchestrator events:

```typescript
const orchestrator = new Orchestrator(options);

orchestrator.on("phase:start", (event) => {
  console.log(`Starting phase ${event.phase?.order}`);
});

orchestrator.on("item:progress", (event) => {
  updateProgressBar(event.item?.identifier, event.percentComplete);
});

orchestrator.on("merge:conflict", (event) => {
  showConflictDialog(event.error as MergeConflictError);
});
```

### Custom Configuration Sources

Extend configuration by modifying `src/config/loader.ts`:

```typescript
// Add a new config source, e.g., from a remote server
export async function loadRemoteConfig(): Promise<PartialUserConfig> {
  const response = await fetch("https://config.example.com/spectree");
  return response.json();
}

// Update mergeConfig to include new source
export function mergeConfig(cliOverrides?: CliOverrides): Config {
  const defaults = createDefaultConfig();
  const remote = loadRemoteConfig();  // New source
  const user = loadUserConfig();
  const project = loadProjectConfig();
  const env = loadEnvConfig();
  
  return deepMerge(defaults, remote, user, project, env, cliOverrides);
}
```

---

## API Contracts

### SpecTree REST API

All API types are defined in `packages/orchestrator/src/spectree/api-client.ts`.

**Base URL:** Configurable via `apiUrl` config (default: `http://localhost:3001`)

**Authentication:** Bearer token in `Authorization` header

**Key Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/epics/{id}/execution-plan` | Get phases with parallelism info |
| `POST` | `/api/v1/features/{id}/start-work` | Mark feature as in-progress |
| `POST` | `/api/v1/features/{id}/complete-work` | Mark feature as done |
| `POST` | `/api/v1/features/{id}/log-progress` | Log incremental progress |
| `POST` | `/api/v1/sessions` | Start a new session |
| `PUT` | `/api/v1/sessions/{id}` | End session with handoff |

### Internal Interfaces

**ExecutionPlan:**
```typescript
interface ExecutionPlan {
  epicId: string;
  epicName: string;
  totalItems: number;
  totalPhases: number;
  phases: ExecutionPhase[];
}

interface ExecutionPhase {
  order: number;
  items: ExecutionItem[];
  canRunInParallel: boolean;
}

interface ExecutionItem {
  id: string;
  identifier: string;           // e.g., "COM-5"
  title: string;
  description: string | null;
  type: "feature" | "task";
  estimatedComplexity: string | null;
  dependencies: string[];        // Identifiers of blocking items
  parallelGroup: string | null;  // Group for parallel execution
}
```

**CheckpointState (Recovery):**
```typescript
interface CheckpointState {
  epicId: string;
  sessionId?: string;
  currentPhase: number;
  completedItems: string[];
  failedItems: string[];
  baseBranch: string;
  pendingMerges: string[];      // Branches awaiting merge
  mergeConflict?: {
    branch: string;
    files: string[];
  };
  savedAt: string;               // ISO timestamp
}
```

**Session Handoff:**
```typescript
interface SessionHandoff {
  sessionId: string;
  epicId: string;
  summary?: string;
  completedItems: string[];
  blockers?: string[];
  nextSteps?: string[];
  decisions?: string[];
  savedAt: string;
}
```

---

## Directory Structure

```
packages/orchestrator/
├── src/
│   ├── index.ts                 # CLI entry point (Commander.js)
│   │
│   ├── cli/
│   │   ├── index.ts             # Command exports
│   │   ├── state.ts             # CLI state management
│   │   └── commands/
│   │       ├── run.ts           # spectree-agent run
│   │       ├── continue.ts      # spectree-agent continue
│   │       ├── status.ts        # spectree-agent status
│   │       └── auth.ts          # spectree-agent auth
│   │
│   ├── orchestrator/
│   │   ├── index.ts             # Orchestrator exports
│   │   ├── orchestrator.ts      # Main orchestration controller
│   │   ├── phase-executor.ts    # Phase execution (parallel/sequential)
│   │   ├── agent-pool.ts        # Copilot SDK session pool
│   │   ├── plan-generator.ts    # NL → epic structure
│   │   └── recovery.ts          # Checkpoint/recovery logic
│   │
│   ├── git/
│   │   ├── index.ts             # Git exports
│   │   ├── branch-manager.ts    # Branch create/checkout
│   │   └── merge-coordinator.ts # Branch merging
│   │
│   ├── spectree/
│   │   ├── index.ts             # SpecTree exports
│   │   ├── api-client.ts        # REST API client
│   │   └── mcp-bridge.ts        # Agent tools (Copilot SDK format)
│   │
│   ├── ui/
│   │   ├── index.ts             # UI exports
│   │   ├── progress.ts          # Progress display
│   │   └── agent-status.ts      # Parallel agent status
│   │
│   ├── config/
│   │   ├── index.ts             # Config access + convenience methods
│   │   ├── loader.ts            # Multi-source config loading
│   │   ├── schemas.ts           # Config type definitions
│   │   └── defaults.ts          # Default configuration values
│   │
│   ├── errors.ts                # Typed error classes
│   └── utils/                   # Shared utilities
│
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # End-to-end tests
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@github/copilot-sdk` | latest | Core AI agent engine |
| `commander` | ^12.0.0 | CLI framework |
| `ora` | ^8.0.0 | Terminal spinners |
| `chalk` | ^5.0.0 | Colored terminal output |
| `inquirer` | ^9.0.0 | Interactive prompts |
| `simple-git` | ^3.0.0 | Git operations |
| `conf` | ^12.0.0 | Configuration storage |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Implementation Briefing | `/docs/orchestrator-implementation-briefing.md` | Full implementation spec |
| MCP Tools Reference | `/docs/MCP/tools-reference.md` | All SpecTree MCP tools |
| Session Handoff | `/docs/MCP/session-handoff.md` | Session management details |
| Copilot SDK Analysis | `/docs/analysis-spectree-mcp-vs-copilot-sdk.md` | SDK capabilities |
| User Documentation | `/packages/orchestrator/README.md` | User guide |

---

## Glossary

| Term | Definition |
|------|------------|
| **Agent** | A Copilot SDK session executing a single task |
| **Agent Pool** | Manager for concurrent SDK sessions |
| **Execution Plan** | Phases with items and parallelism info from SpecTree |
| **Phase** | Group of items that execute together (parallel or sequential) |
| **Parallel Group** | Items that can safely execute concurrently |
| **Checkpoint** | Saved state for crash recovery |
| **Handoff** | Session summary for continuity between sessions |
| **MCP Bridge** | Adapter exposing SpecTree operations as SDK tools |
