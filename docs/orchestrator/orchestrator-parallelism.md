# Orchestrator Parallelism & Progress Reporting

## ✅ Implementation Status

> **Updated: 2026-02-10** - All parallelism features fully implemented!

| Feature | Status | Notes |
|---------|--------|-------|
| Feature-level parallelism | ✅ Implemented | Multiple features run in parallel via AgentPool |
| Task-level agent spawning | ✅ Implemented | Each task gets fresh Copilot session (34KB phase-executor) |
| Task parallel execution | ✅ Implemented | Tasks in same parallelGroup run simultaneously |
| Task-level SpecTree tracking | ✅ Implemented | Full start_work/complete_work per task |
| CLI flag | ✅ Implemented | `--no-task-level-agents` to disable |
| Progress events | ✅ Implemented | Complete event system with real-time updates |
| Agent pool management | ✅ Implemented | 800-line implementation managing concurrent sessions |
| Branch isolation | ✅ Implemented | Branch-per-agent strategy (10KB branch-manager) |
| Merge coordination | ✅ Implemented | Automatic merging with conflict detection (9KB) |

### What This Means

**Before:** One agent handled an entire feature (all tasks). Large features caused context compaction.

**After:** Each task spawns a fresh Copilot agent with clean context. This ensures:
- No context compaction within features
- Better focus - each agent only sees its specific task
- Proper SpecTree progress tracking at the task level
- Tasks marked with `canParallelize: true` and same `parallelGroup` run simultaneously

### CLI Usage

```bash
# Default behavior: task-level agents enabled (recommended)
spectree-agent run "Build user dashboard"

# Disable task-level agents (single agent per feature, old behavior)
spectree-agent run "Build user dashboard" --no-task-level-agents
```

---

## Parallelism

The orchestrator supports both **feature-level** and **task-level** parallelism. When a phase or feature is marked as parallelizable, multiple agents are spawned, each working on its own branch. Tasks within a feature can be executed in parallel or sequentially, depending on the execution plan.

- **Parallel execution:** All tasks or features in a parallel group are started simultaneously using `Promise.all()`. Each agent works on an isolated branch.
- **Sequential execution:** Tasks are executed one after another on a shared branch.

## Progress Reporting

The orchestrator emits real-time events for UI and CLI consumption:
- `phase:start`, `phase:complete`
- `item:start`, `item:progress`, `item:complete`, `item:error`
- `agent:spawn`, `agent:start`, `agent:progress`, `agent:complete`, `agent:error`
- `task:start`, `task:complete`

### User Feedback

- The CLI and UI display parallel agent status, progress bars, and merge status after parallel phases.
- Progress is also tracked in the SpecTree backend using dedicated MCP tools (`spectree__start_work`, `spectree__log_progress`, `spectree__complete_work`).

See [docs/mcp/progress-tracking.md](../mcp/progress-tracking.md) for API and tool details.

---

## Current Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Orchestrator                            │
│  - Loads execution plan from SpecTree API                       │
│  - Groups features into phases based on dependencies            │
│  - Coordinates parallel vs sequential execution                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PhaseExecutor                             │
│  - Executes one phase at a time                                 │
│  - Spawns agents for parallel phases via AgentPool              │
│  - Handles sequential phases one item at a time                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AgentPool                               │
│  - Manages concurrent Copilot SDK sessions                      │
│  - Configurable maxAgents (default: 4)                          │
│  - Each agent gets its own git branch                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MergeCoordinator                           │
│  - Merges branches after parallel phases complete               │
│  - Detects and handles merge conflicts                          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/orchestrator/src/orchestrator/orchestrator.ts` | Main orchestration controller |
| `packages/orchestrator/src/orchestrator/phase-executor.ts` | Executes phases (parallel/sequential) |
| `packages/orchestrator/src/orchestrator/agent-pool.ts` | Manages concurrent AI agents |
| `packages/orchestrator/src/orchestrator/plan-generator.ts` | Generates plans from user prompts |
| `packages/orchestrator/src/git/branch-manager.ts` | Git branch operations |
| `packages/orchestrator/src/git/merge-coordinator.ts` | Branch merging logic |

---

## How Parallelism Works Today

### 1. Execution Plan Structure

The SpecTree API returns an execution plan organized into **phases**:

```typescript
interface ExecutionPlan {
  epicId: string;
  phases: ExecutionPhase[];
}

interface ExecutionPhase {
  order: number;           // Phase sequence number
  canRunInParallel: boolean;  // Determined by items' canParallelize flags
  items: ExecutionItem[];     // Features in this phase
}

interface ExecutionItem {
  id: string;
  identifier: string;      // e.g., "ENG-54"
  title: string;
  type: "feature" | "task";
  description: string;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];  // IDs of items that must complete first
}
```

### 2. Phase Grouping Logic

Features are grouped into phases based on:

1. **Dependencies**: Features with unmet dependencies wait in later phases
2. **Parallelization flags**: Features with `canParallelize: true` and same `parallelGroup` are grouped together
3. **Execution order**: Lower `executionOrder` values are scheduled first

### 3. Parallel Execution Flow

When a phase has `canRunInParallel: true`:

```typescript
// From phase-executor.ts
private async executeParallel(items: ExecutionItem[], baseBranch: string): Promise<ItemResult[]> {
  const agentPromises = [];

  // 1. Spawn an agent for EACH item (feature)
  for (const item of items) {
    const branchName = this.branchManager.generateBranchName(item.identifier, item.title);
    await this.branchManager.createBranch(branchName, baseBranch);
    
    const agent = await this.agentPool.spawnAgent(item, branchName);
    const promise = this.agentPool.startAgent(agent.id, taskPrompt);
    
    agentPromises.push({ item, agent, branch: branchName, promise });
  }

  // 2. Wait for ALL agents to complete simultaneously
  const agentResults = await Promise.all(agentPromises.map(ap => ap.promise));
  
  return itemResults;
}
```

### 4. Sequential Execution Flow

When a phase has `canRunInParallel: false`:

```typescript
// From phase-executor.ts
private async executeSequential(items: ExecutionItem[], baseBranch: string): Promise<ItemResult[]> {
  const results = [];
  let sharedBranch: string | undefined;

  for (const item of items) {
    // Create shared branch on first item
    if (!sharedBranch) {
      sharedBranch = this.branchManager.generateBranchName(items[0].identifier, `sequential-${items.length}-items`);
      await this.branchManager.createBranch(sharedBranch, baseBranch);
    }

    // Execute one at a time
    const result = await this.executeSingleItem(item, sharedBranch);
    results.push(result);

    if (!result.success) {
      break; // Stop on first failure
    }
  }

  return results;
}
```

### 5. What Agents Receive

Each agent receives the **feature description** (which includes tasks as documentation):

```typescript
private buildTaskPrompt(item: ExecutionItem): string {
  return `
# Task: ${item.title}
**Identifier:** ${item.identifier}
**Type:** ${item.type}

## Description
${item.description}

## Instructions
1. Implement the task according to the description above
2. Use log_progress to report significant milestones
3. Use log_decision to record any important choices
4. Link files you create or modify with link_code_file
5. When complete, provide a brief summary of what you did
  `;
}
```

The agent sees the **Sub-Issue Implementation Order** table in the description but implements tasks sequentially as a single unit of work.

---

## ~~Limitations~~ Resolved Limitations

> **✅ These limitations have been addressed with task-level agent spawning.**

### ~~1. Tasks Are Not First-Class Execution Items~~ → RESOLVED

~~The execution plan only contains **features**. Tasks exist in the feature's description but are not scheduled independently.~~

**New Behavior:** The PhaseExecutor now fetches tasks for each feature via `listTasks()` API and spawns dedicated agents for each task.

```
Execution Plan (after task-level agents)
├── Phase 1
│   └── Feature: ENG-54 (Backend API)
│       ├── Task: ENG-54-1 ← Agent 1 (fresh context)
│       ├── Task: ENG-54-2 ← Agent 2 (fresh context)
│       └── Task: ENG-54-3 ← Agent 3 (fresh context)
├── Phase 2  
│   └── Feature: ENG-55 (Frontend Dashboard)
│       ├── Task: ENG-55-1 ← Agent 4 (fresh context)
│       └── Task: ENG-55-2 ← Agent 5 (fresh context)
```

### ~~2. No Task-Level Branch Isolation~~ → PARTIALLY RESOLVED

Tasks now get dedicated agents but still share the feature branch. Full task branch isolation is planned for a future release.

### ~~3. Task Parallelization Flags Are Documentation Only~~ → RESOLVED

The `canParallelize` and `parallelGroup` fields on tasks are now **actively used**:
- Tasks with `canParallelize: true` AND the same `parallelGroup` run simultaneously via `Promise.all()`
- Tasks without these flags or in different groups run sequentially

---

## Remaining Limitation: Task Branch Isolation

While each task gets its own agent with fresh context, all tasks within a feature currently work on the **same git branch**. Future enhancement will add:

1. Create sub-branches: `feature/ENG-55/task-ENG-55-1`, `feature/ENG-55/task-ENG-55-2`
2. Parallel tasks work on isolated branches
3. Merge task branches back to feature branch when task phase completes

This is tracked for a future release.

---

## Progress Reporting & User Feedback (CRITICAL)

> ⚠️ **REQUIREMENT**: The orchestrator MUST provide clear, real-time feedback to users about execution status, especially when parallelism is occurring. This is essential for user trust and debugging.

### Current Event System

The orchestrator emits events that can be consumed by UI components:

```typescript
// From orchestrator.ts
this.emit("phase:start", {
  type: "phase:start",
  phase,
  message: `Starting phase ${phase.order} with ${phase.items.length} items (${phase.canRunInParallel ? "parallel" : "sequential"})`,
});

// From agent-pool.ts
interface AgentPoolEvents {
  "agent:spawn": (agent: Agent) => void;
  "agent:start": (agent: Agent) => void;
  "agent:progress": (agent: Agent, progress: number, message?: string) => void;
  "agent:complete": (agent: Agent, result: AgentResult) => void;
  "agent:error": (agent: Agent, error: Error) => void;
}

// From phase-executor.ts
interface PhaseExecutorEvents {
  "phase:start": (phase: ExecutionPhase) => void;
  "phase:complete": (phase: ExecutionPhase, result: PhaseResult) => void;
  "item:start": (item: ExecutionItem, branch?: string) => void;
  "item:progress": (item: ExecutionItem, progress: number, message?: string) => void;
  "item:complete": (item: ExecutionItem, result: ItemResult) => void;
  "item:error": (item: ExecutionItem, error: Error) => void;
}
```

### Required UI Display Components

#### 1. Execution Overview Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 Executing: User Activity Dashboard                          │
│  ════════════════════════════════════════════════════════════   │
│                                                                 │
│  Phase 2 of 3 │ ⏱️ 2m 34s elapsed │ 🔄 PARALLEL MODE            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✅ Phase 1: Backend API (completed in 4m 12s)          │   │
│  │  🔄 Phase 2: Frontend Dashboard (in progress)           │   │
│  │  ⏳ Phase 3: Auth & Security (waiting)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Parallel Agent Status Panel

When parallel execution is occurring, show ALL active agents:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔀 PARALLEL EXECUTION - 3 agents active                        │
│  ════════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Agent 1: ENG-55-1 IntervalSelector                      │   │
│  │ Branch: feature/ENG-55-1-interval-selector              │   │
│  │ Status: 🔄 Working (45%)                                │   │
│  │ Current: Creating component file...                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Agent 2: ENG-55-2 ActivityChart                         │   │
│  │ Branch: feature/ENG-55-2-activity-chart                 │   │
│  │ Status: 🔄 Working (30%)                                │   │
│  │ Current: Implementing Recharts integration...           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Agent 3: ENG-55-3 ActivityTable                         │   │
│  │ Branch: feature/ENG-55-3-activity-table                 │   │
│  │ Status: 🔄 Working (60%)                                │   │
│  │ Current: Adding pagination controls...                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Sequential Execution Display

When running sequentially, show clear linear progress:

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 SEQUENTIAL EXECUTION                                        │
│  ════════════════════════════════════════════════════════════   │
│                                                                 │
│  Feature: ENG-54 Backend API                                    │
│  Branch: feature/ENG-54-backend-api                             │
│                                                                 │
│  Tasks:                                                         │
│  ✅ 1. ENG-54-1 Design API schema (completed)                   │
│  🔄 2. ENG-54-2 Implement aggregation logic (in progress 70%)   │
│  ⏳ 3. ENG-54-3 Add auth, pagination, rate-limiting (waiting)   │
│                                                                 │
│  Current: Building Prisma queries for activity aggregation...   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Merge Status Display

After parallel phase completes, show merge progress:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔀 MERGING PARALLEL BRANCHES                                   │
│  ════════════════════════════════════════════════════════════   │
│                                                                 │
│  Target: main                                                   │
│                                                                 │
│  ✅ feature/ENG-55-1-interval-selector → main (merged)          │
│  🔄 feature/ENG-55-2-activity-chart → main (merging...)         │
│  ⏳ feature/ENG-55-3-activity-table → main (waiting)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Requirements

#### CLI Output (Terminal)

**File:** `packages/orchestrator/src/ui/progress-display.ts` (new)

```typescript
import ora from 'ora';
import chalk from 'chalk';

export class ProgressDisplay {
  private spinner: ora.Ora;
  private activeAgents: Map<string, AgentDisplayState> = new Map();
  
  /**
   * Display parallel execution status with multiple agent spinners
   */
  showParallelExecution(phase: ExecutionPhase): void {
    console.log(chalk.cyan.bold(`\n🔀 PARALLEL EXECUTION - Phase ${phase.order}`));
    console.log(chalk.gray(`   ${phase.items.length} agents running simultaneously\n`));
    
    for (const item of phase.items) {
      const spinner = ora({
        text: `${item.identifier}: ${item.title}`,
        prefixText: '  ',
      }).start();
      
      this.activeAgents.set(item.id, { spinner, item });
    }
  }
  
  /**
   * Update a specific agent's progress
   */
  updateAgentProgress(agentId: string, progress: number, message?: string): void {
    const state = this.activeAgents.get(agentId);
    if (state) {
      const progressBar = this.renderProgressBar(progress);
      state.spinner.text = `${state.item.identifier}: ${message || state.item.title} ${progressBar}`;
    }
  }
  
  /**
   * Mark an agent as complete
   */
  completeAgent(agentId: string, success: boolean, summary?: string): void {
    const state = this.activeAgents.get(agentId);
    if (state) {
      if (success) {
        state.spinner.succeed(chalk.green(`${state.item.identifier}: Complete`));
      } else {
        state.spinner.fail(chalk.red(`${state.item.identifier}: Failed`));
      }
      this.activeAgents.delete(agentId);
    }
  }
  
  /**
   * Show sequential execution with task checklist
   */
  showSequentialExecution(feature: ExecutionItem, tasks: TaskInfo[]): void {
    console.log(chalk.yellow.bold(`\n📝 SEQUENTIAL EXECUTION`));
    console.log(chalk.white(`   Feature: ${feature.identifier} ${feature.title}\n`));
    
    for (const task of tasks) {
      const status = task.completed ? chalk.green('✅') : 
                     task.inProgress ? chalk.yellow('🔄') : 
                     chalk.gray('⏳');
      console.log(`   ${status} ${task.order}. ${task.identifier} ${task.title}`);
    }
  }
  
  private renderProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return chalk.gray(`[${chalk.green('█'.repeat(filled))}${' '.repeat(empty)}] ${progress}%`);
  }
}
```

#### Event Wiring

**File:** `packages/orchestrator/src/cli/commands/run.ts`

```typescript
import { ProgressDisplay } from '../ui/progress-display.js';

// Wire up progress display to orchestrator events
const display = new ProgressDisplay();

orchestrator.on('phase:start', (event) => {
  if (event.phase.canRunInParallel) {
    display.showParallelExecution(event.phase);
  } else {
    display.showSequentialExecution(event.phase.items[0], /* tasks */);
  }
});

orchestrator.on('agent:progress', (agent, progress, message) => {
  display.updateAgentProgress(agent.id, progress, message);
});

orchestrator.on('agent:complete', (agent, result) => {
  display.completeAgent(agent.id, result.success, result.summary);
});

orchestrator.on('item:start', (item, branch) => {
  display.showItemStart(item, branch);
});

orchestrator.on('merge:start', (branches, target) => {
  display.showMergeStart(branches, target);
});

orchestrator.on('merge:progress', (branch, status) => {
  display.updateMergeProgress(branch, status);
});
```

### Required Events to Add

The following events need to be added to support comprehensive progress reporting:

| Event | Emitter | Data | Purpose |
|-------|---------|------|---------|
| `execution:start` | Orchestrator | `{ epicId, totalPhases, totalItems }` | Overall execution begins |
| `execution:complete` | Orchestrator | `{ success, duration, summary }` | Overall execution ends |
| `phase:start` | PhaseExecutor | `{ phase, isParallel, itemCount }` | Phase begins |
| `phase:complete` | PhaseExecutor | `{ phase, results, duration }` | Phase ends |
| `agent:spawn` | AgentPool | `{ agent, item, branch }` | New agent created |
| `agent:progress` | AgentPool | `{ agent, progress, message }` | Agent reports progress |
| `agent:complete` | AgentPool | `{ agent, result }` | Agent finishes |
| `merge:start` | MergeCoordinator | `{ branches, targetBranch }` | Branch merging begins |
| `merge:branch` | MergeCoordinator | `{ branch, status }` | Individual branch merged |
| `merge:conflict` | MergeCoordinator | `{ branch, conflictFiles }` | Merge conflict detected |
| `merge:complete` | MergeCoordinator | `{ success, mergedCount }` | All merging done |

### User-Facing Messages

All progress messages should be:

1. **Clear**: Use plain language, not technical jargon
2. **Actionable**: If something fails, explain what the user can do
3. **Contextual**: Show what's happening and why
4. **Visual**: Use emojis, colors, and progress bars consistently

#### Message Examples

```
✅ Good Messages:
- "🔀 Running 3 tasks in parallel (IntervalSelector, ActivityChart, ActivityTable)"
- "⏳ Waiting for Backend API to complete before starting Frontend..."
- "🔄 Agent 2 (ActivityChart): Implementing chart component (45% complete)"
- "✅ Phase 2 complete: All 3 parallel tasks succeeded in 2m 15s"
- "⚠️ Merge conflict in src/components/Dashboard.tsx - manual resolution needed"

❌ Bad Messages:
- "Executing phase 2"
- "Agent spawned"
- "Promise.all resolved"
- "Branch merged"
```

### Implementation Roadmap Update

Add to Phase 2:

| Task | Effort | Files |
|------|--------|-------|
| Create ProgressDisplay class | ✅ Done | `packages/orchestrator/src/ui/progress-display.ts` |
| Add missing events to Orchestrator | ✅ Done | `orchestrator.ts`, `phase-executor.ts` |
| Wire events to ProgressDisplay in CLI | ⏳ Pending | `cli/commands/run.ts` |
| Add merge progress events | ⏳ Pending | `merge-coordinator.ts` |

---

## ✅ Task-Level Parallelism - IMPLEMENTED

> **This feature has been implemented.** The proposal below documents what was built.

### Goals ✅

1. ✅ Allow tasks within a feature to run in parallel when marked `canParallelize: true`
2. ⏳ Maintain git branch isolation for parallel tasks (future work)
3. ⏳ Merge task branches back to feature branch before feature completion (future work)
4. ✅ Preserve the current feature-level parallelism

### Implemented Architecture

```
Execution (with task-level agents)
├── Phase 1: Feature ENG-54
│   ├── ENG-54-1 ← Agent spawned (fresh context)
│   ├── ENG-54-2 ← Agent spawned (fresh context, after 54-1)
│   └── ENG-54-3 ← Agent spawned (fresh context, after 54-2)
│
├── Phase 2: Feature ENG-55 (has parallel tasks)
│   ├── Parallel Group A:
│   │   ├── ENG-55-1 (IntervalSelector)  ← Agent A (simultaneous)
│   │   ├── ENG-55-2 (ActivityChart)     ← Agent B (simultaneous)
│   │   └── ENG-55-3 (ActivityTable)     ← Agent C (simultaneous)
│   └── ENG-55-4 (Integration)           ← Agent D (after A, B, C complete)
│
└── Phase 3: Feature ENG-56
    └── (sequential tasks, each with own agent)
```

### Key Implementation Details

**File:** `packages/orchestrator/src/orchestrator/phase-executor.ts`

```typescript
// Enabled by default, can be disabled with --no-task-level-agents
private taskLevelAgents: boolean;

// Main method that decides whether to use task-level execution
private async executeSingleItem(
  item: ExecutionItem,
  branch: string
): Promise<ItemResult> {
  // If task-level agents enabled and this is a feature, execute each task separately
  if (this.taskLevelAgents && item.type === "feature") {
    return this.executeFeatureWithTaskLevelAgents(item, branch, startTime);
  }
  // Otherwise, execute the item with a single agent (original behavior)
  return this.executeSingleItemDirectly(item, branch, startTime);
}

// Fetches tasks, groups by parallelGroup, spawns dedicated agents
private async executeFeatureWithTaskLevelAgents(
  feature: ExecutionItem,
  branch: string,
  startTime: number
): Promise<ItemResult> {
  // 1. Fetch tasks for this feature
  const tasksResponse = await this.specTreeClient.listTasks({ featureId: feature.id });
  
  // 2. Sort by execution order
  // 3. Group by parallelGroup - same group runs simultaneously
  // 4. For each task: spawn fresh agent, execute, track in SpecTree
  // 5. Return aggregated results
}
```

### Events Emitted

```typescript
// Task-level events (in addition to existing item events)
"task:start": (task: Task, feature: ExecutionItem, branch?: string) => void;
"task:complete": (task: Task, feature: ExecutionItem, success: boolean) => void;
"task:error": (task: Task, feature: ExecutionItem, error: Error) => void;
```

### CLI Output Example

```
  📋 Feature ENG-55: Executing 4 tasks with individual agents
    🤖 Starting agent for task ENG-55-1: IntervalSelector Component
    🔀 Executing 3 tasks in parallel: ENG-55-1, ENG-55-2, ENG-55-3
    ✅ Task ENG-55-1 completed (45.2s)
    ✅ Task ENG-55-2 completed (52.1s)
    ✅ Task ENG-55-3 completed (48.7s)
    🤖 Starting agent for task ENG-55-4: Integration Testing
    ✅ Task ENG-55-4 completed (23.4s)
```

---

## Future Work: Task Branch Isolation

The remaining piece is git branch isolation for parallel tasks. This would involve:

**File:** `packages/api/src/routes/execution-plans.ts`

```typescript
interface ExecutionPlan {
  epicId: string;
  phases: FeaturePhase[];
}

interface FeaturePhase {
  order: number;
  canRunInParallel: boolean;
  features: FeatureExecutionItem[];
}

interface FeatureExecutionItem {
  id: string;
  identifier: string;
  title: string;
  description: string;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];
  // NEW: Task-level execution plan
  taskPhases: TaskPhase[];
}

interface TaskPhase {
  order: number;
  canRunInParallel: boolean;
  tasks: TaskExecutionItem[];
}

interface TaskExecutionItem {
  id: string;
  identifier: string;
  title: string;
  description: string;
  canParallelize: boolean;
  parallelGroup: string | null;
  dependencies: string[];
}
```

#### 2. Create TaskPhaseExecutor

**New file:** `packages/orchestrator/src/orchestrator/task-phase-executor.ts`

```typescript
export class TaskPhaseExecutor extends EventEmitter {
  private agentPool: AgentPool;
  private branchManager: BranchManager;
  
  /**
   * Execute all task phases for a feature.
   * Handles parallel and sequential task execution within a feature.
   */
  async executeFeatureTasks(
    feature: FeatureExecutionItem,
    featureBranch: string
  ): Promise<FeatureTaskResult> {
    const results: TaskPhaseResult[] = [];
    
    for (const taskPhase of feature.taskPhases) {
      if (taskPhase.canRunInParallel && taskPhase.tasks.length > 1) {
        // Spawn agent per task, each on sub-branch
        const taskResults = await this.executeTasksParallel(
          taskPhase.tasks,
          featureBranch
        );
        results.push(taskResults);
        
        // Merge task branches back to feature branch
        await this.mergeTaskBranches(taskResults, featureBranch);
      } else {
        // Sequential task execution
        const taskResults = await this.executeTasksSequential(
          taskPhase.tasks,
          featureBranch
        );
        results.push(taskResults);
      }
    }
    
    return { feature, taskPhaseResults: results };
  }
  
  private async executeTasksParallel(
    tasks: TaskExecutionItem[],
    featureBranch: string
  ): Promise<TaskPhaseResult> {
    const agentPromises = [];
    
    for (const task of tasks) {
      // Create task branch from feature branch
      const taskBranch = `${featureBranch}-task-${task.identifier}`;
      await this.branchManager.createBranch(taskBranch, featureBranch);
      
      // Spawn dedicated agent for this task
      const agent = await this.agentPool.spawnAgent(task, taskBranch);
      const promise = this.agentPool.startAgent(agent.id, this.buildTaskPrompt(task));
      
      agentPromises.push({ task, agent, branch: taskBranch, promise });
    }
    
    // Wait for all task agents
    const results = await Promise.all(agentPromises.map(ap => ap.promise));
    
    return { phase: taskPhase, results };
  }
}
```

#### 3. Modify PhaseExecutor

**File:** `packages/orchestrator/src/orchestrator/phase-executor.ts`

```typescript
// Add TaskPhaseExecutor integration
private taskPhaseExecutor: TaskPhaseExecutor;

private async executeSingleItem(
  item: FeatureExecutionItem,
  branch: string
): Promise<ItemResult> {
  // Check if feature has task-level parallelization
  const hasParallelTasks = item.taskPhases.some(
    tp => tp.canRunInParallel && tp.tasks.length > 1
  );
  
  if (hasParallelTasks) {
    // Use TaskPhaseExecutor for granular control
    return this.taskPhaseExecutor.executeFeatureTasks(item, branch);
  } else {
    // Legacy: single agent handles entire feature
    const agent = await this.agentPool.spawnAgent(item, branch);
    return this.agentPool.startAgent(agent.id, this.buildTaskPrompt(item));
  }
}
```

#### 4. Update Plan Generator

**File:** `packages/orchestrator/src/orchestrator/plan-generator.ts`

The plan generator already captures task-level parallelization data. No changes needed for plan generation, but the SpecTree API client needs to pass this data through.

#### 5. Git Branch Strategy

```
main
└── feature/ENG-55-frontend-dashboard (feature branch)
    ├── feature/ENG-55-frontend-dashboard-task-ENG-55-1 (task branch)
    ├── feature/ENG-55-frontend-dashboard-task-ENG-55-2 (task branch)
    └── feature/ENG-55-frontend-dashboard-task-ENG-55-3 (task branch)
```

After parallel tasks complete:
1. Merge task branches → feature branch
2. Handle any merge conflicts
3. Continue to next task phase
4. When feature completes, merge feature branch → main

---

## Implementation Roadmap

### Phase 1: API Enhancement (Backend)

| Task | Effort | Files |
|------|--------|-------|
| Extend execution plan API to include task phases | Medium | `packages/api/src/routes/execution-plans.ts` |
| Add task grouping logic (parallel groups, dependencies) | Medium | `packages/api/src/services/execution-plan.ts` |
| Update API types | Small | `packages/api/src/types/` |

### Phase 2: Orchestrator Core (CLI)

| Task | Effort | Files |
|------|--------|-------|
| Create TaskPhaseExecutor class | Large | New file |
| Modify PhaseExecutor to delegate to TaskPhaseExecutor | Medium | `phase-executor.ts` |
| Update AgentPool to handle task-level items | Small | `agent-pool.ts` |
| Add task branch naming convention | Small | `branch-manager.ts` |

### Phase 3: Merge Handling

| Task | Effort | Files |
|------|--------|-------|
| Implement task→feature branch merging | Medium | `merge-coordinator.ts` |
| Handle task-level merge conflicts | Medium | `merge-coordinator.ts` |
| Add conflict resolution UI hooks | Medium | `phase-executor.ts` |

### Phase 4: Testing & Documentation

| Task | Effort | Files |
|------|--------|-------|
| Unit tests for TaskPhaseExecutor | Medium | `__tests__/` |
| Integration tests for parallel tasks | Large | `__tests__/` |
| Update user documentation | Small | `docs/` |

### Estimated Total Effort

| Phase | Effort |
|-------|--------|
| Phase 1: API Enhancement | 2-3 days |
| Phase 2: Orchestrator Core | 3-4 days |
| Phase 3: Merge Handling | 2-3 days |
| Phase 4: Testing & Docs | 2-3 days |
| **Total** | **9-13 days** |

---

## Considerations

### When Task-Level Parallelism Makes Sense

✅ **Good candidates:**
- Independent UI components (different files)
- Separate API endpoints (no shared code)
- Independent test suites
- Documentation tasks

❌ **Poor candidates:**
- Tasks that modify the same files
- Tasks with implicit dependencies
- Tasks that require shared state
- Very small tasks (overhead > benefit)

### Potential Issues

1. **Merge Conflicts**: More branches = more potential conflicts
2. **Agent Overhead**: Spawning many agents has resource cost
3. **Complexity**: Debugging parallel task failures is harder
4. **Context Loss**: Each task agent has limited context about siblings

### Mitigation Strategies

1. **Smart Grouping**: Only parallelize tasks with no file overlap
2. **Pool Limits**: Respect `maxAgents` across both feature and task levels
3. **Detailed Logging**: Track which agent modified which files
4. **Fallback Mode**: If merge conflicts occur, offer sequential retry

---

## References

- [Orchestrator Architecture](./orchestrator-architecture.md)
- [Orchestrator Implementation Briefing](./orchestrator-implementation-briefing.md)
- [Platform Analysis for SpecTree Orchestrator](../archive/analysis/platform-analysis-for-spectree-orchestrator.md)
