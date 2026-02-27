# Dispatcher Automation Tool Strategy

**Date:** February 6, 2026
**Purpose:** Input document for an AI planner to create a complete Dispatcher epic
**Consumer:** AI model in a Copilot CLI session with Dispatcher MCP access

---

## 1. Preamble & Document Purpose

This document is the **primary input for an AI planner** tasked with creating a Dispatcher epic that fully specifies the work to build the Dispatcher Automation Tool. The planner should read this document end-to-end, then use Dispatcher MCP tools to create the epic:

- `dispatcher__create_epic_complete` - Create the full epic/feature/task hierarchy atomically
- `dispatcher__set_structured_description` - Add AI instructions, acceptance criteria, files involved
- `dispatcher__set_execution_metadata` - Set execution order, dependencies, parallelism
- `dispatcher__get_execution_plan` - Verify the generated execution plan is correct

**Section 8 of this document is the definitive specification.** It contains 10 features organized into 5 execution phases, with fully-specified tasks including AI instructions, acceptance criteria, files involved, and validations. The planner should create the Dispatcher epic by translating Section 8 directly - do NOT re-derive or re-interpret the feature/task structure. Every field in Section 8 maps to a Dispatcher structured description field.

This document is **self-contained**. An AI in a fresh session should be able to understand everything needed to create the epic without reading other files (though source file references are provided for implementers who will execute the tasks).

---

## 2. Vision & Problem Statement

### 2a. The Manual Workflow That Works

Today, the developer uses a proven 7-step manual workflow for AI-assisted development with Dispatcher and Copilot CLI (Claude Opus 4.6):

1. **Conceive** - Developer identifies a body of work (e.g., "build a user activity dashboard")
2. **Plan iteratively in Dispatcher** - Open a Copilot CLI session and iteratively create a structured epic in Dispatcher via MCP tools:
   - Create the epic with `dispatcher__create_epic_complete`
   - Review the generated features and tasks
   - Refine: add acceptance criteria, AI instructions, technical notes, files involved
   - Set execution metadata: ordering, dependencies, parallelism groups
   - Repeat refinement until the execution plan (`dispatcher__get_execution_plan`) looks right
3. **Review the execution plan** - Verify phases, parallelism, and dependency order make sense
4. **Spawn feature sessions** - Manually open new Copilot CLI terminal sessions, one per feature (or per parallel group)
5. **Provide context** - Copy-paste the feature identifier and instruct each session to read its requirements from Dispatcher
6. **Monitor and coordinate** - Watch sessions, answer permission prompts, handle failures, manage git branches
7. **Merge and verify** - Merge feature branches, run validations, mark work complete in Dispatcher

This workflow produces **excellent results**. The structured planning in Dispatcher ensures each AI session has clear, detailed requirements. The execution metadata enables intelligent parallelism. The session handoff system provides cross-session continuity.

**But it's tedious and not standardizable.** Steps 2, 4, 5, and 6 require significant manual effort and tacit knowledge. A colleague cannot replicate this workflow without sitting with the developer and learning the patterns.

### 2b. The Vision: Two Integrated Tools

The automation tool consists of **two capabilities** that together replace the manual workflow:

#### Planning Pipeline (replaces steps 2-3)

A standardized, repeatable process for turning a natural language description into a fully-specified Dispatcher epic. The key innovation is **configurable review gates** - the developer can choose to review at each stage or let the pipeline run autonomously.

**This is the #1 pain point.** The iterative planning process is where the most tacit knowledge lives. Standardizing it means any colleague can produce high-quality Dispatcher epics by running a single command and answering review prompts.

The pipeline has 5 stages:
1. **Analyze** - Read the codebase, understand the request, identify scope
2. **Decompose** - Break into features with execution ordering and dependencies
3. **Detail** - Add acceptance criteria, AI instructions, files involved, technical notes to every feature and task
4. **Evaluate** - Score the plan against quality heuristics (task scoping, acceptance criteria count, etc.)
5. **Verify** - Generate the execution plan and validate it's internally consistent

At each stage, the developer can configure a **review gate**: `auto` (proceed without review), `review` (show results and wait for approval), or `stop` (halt for manual intervention).

#### Execution Engine (replaces steps 4-7)

An automated orchestrator that reads the execution plan from Dispatcher and executes it by spawning Copilot CLI sessions via ACP (Agent Client Protocol). It manages:
- Session spawning with full Dispatcher context injection
- Parallel execution of independent features
- Sequential execution of dependent features
- Git branch management (create, merge, conflict detection)
- Progress tracking back to Dispatcher
- Error handling and retry

---

## 3. Existing Assets Inventory

### 3a. Dispatcher Platform (Fully Working)

The Dispatcher platform is production-ready and requires no changes for the automation tool:

- **API** (`packages/api/`): Fastify REST API with full CRUD for Epics, Features, Tasks. Includes execution plans, structured descriptions, AI context, decision logs, validation checklists, session handoff, progress tracking, code context linking, templates.
- **MCP Server** (`packages/mcp/`): 69 registered tools (`dispatcher__*`) exposing the full API surface to AI agents. Organized into: CRUD operations, execution planning, structured descriptions, AI context, validation, progress tracking, code context, decisions, templates, search, personal scope.
- **Web Frontend** (`packages/web/`): React + Vite + Tailwind + Radix UI dashboard for viewing and managing epics, features, tasks, and progress.

### 3b. Orchestrator Package (~14,300 lines)

The existing orchestrator (`packages/orchestrator/`) was built using the `@github/copilot-sdk` (now superseded by ACP). It contains substantial reusable code alongside SDK-coupled code that needs refactoring.

#### Model-Agnostic Code (~8,400 lines) - REUSE DIRECTLY

These modules have zero dependency on the Copilot SDK and can be used as-is:

| Module | File | Lines | What It Does |
|--------|------|-------|--------------|
| **DispatcherClient** | `src/dispatcher/api-client.ts` | 1,527 | Full HTTP client for Dispatcher REST API with retry, timeout, error mapping. Covers teams, epics, features, tasks, execution plans, sessions, progress, code context, decisions, structured descriptions, templates, AI context, validations. |
| **MCP Bridge** | `src/dispatcher/mcp-bridge.ts` | 1,007 | 11 Copilot SDK tool definitions wrapping Dispatcher operations (log_progress, log_decision, link_code_file, get_task_context, get_code_context, report_blocker, get_ai_context, append_ai_note, run_validation, run_all_validations, get_structured_description). Tool schemas and handlers are reusable even if the SDK wrapper changes. |
| **BranchManager** | `src/git/branch-manager.ts` | 383 | Git branch operations: create, checkout, delete, generate names from identifiers, detect default branch. |
| **MergeCoordinator** | `src/git/merge-coordinator.ts` | 347 | Merge strategies, conflict detection, merge state management. |
| **Error System** | `src/errors.ts` | 660 | Typed error hierarchy: OrchestratorError, AgentError, AuthError, NetworkError, DispatcherAPIError with error codes, serialization, recovery hints. |
| **Config System** | `src/config/` | 587 | Configuration loading (env vars, file-based), schemas (Zod), defaults. Manages API URL, tokens, model selection, concurrency settings. |
| **CLI Framework** | `src/cli/` | 391 | Command parsing, state management, CLI entry points. |
| **UI Components** | `src/ui/` | 1,412 | Terminal UI: agent status display, progress bars, activity tracker, task-level progress, spinner integration (ora). |

#### SDK-Coupled Code (~5,200 lines) - REFACTOR TO ACP

These modules import from `@github/copilot-sdk` and need to be refactored to use ACP instead:

| Module | File | Lines | What It Does | Refactor Strategy |
|--------|------|-------|--------------|-------------------|
| **AgentPool** | `src/orchestrator/agent-pool.ts` | 795 | Manages concurrent `CopilotSession` objects. Spawn, track, terminate agents. Event-based progress reporting. Pool capacity management. | Replace `CopilotClient.createSession()` with ACP `session/new`. Replace `session.send()` / `session.on()` with ACP `session/prompt` / `session/update`. Keep pool management, event system, capacity logic. |
| **Orchestrator** | `src/orchestrator/orchestrator.ts` | 1,080 | Top-level coordinator: reads execution plans, manages phases, delegates to PhaseExecutor, handles session lifecycle. | Replace session management with ACP sessions. Keep phase coordination, error handling, Dispatcher integration. |
| **PhaseExecutor** | `src/orchestrator/phase-executor.ts` | 1,063 | Executes a single phase: parallel or sequential items, git branch per item, Dispatcher progress tracking, task-level agent spawning. | Replace `agentPool.spawnAgent()` / `agentPool.startAgent()` with ACP session creation. Keep phase logic, git integration, progress tracking. |
| **PlanGenerator** | `src/orchestrator/plan-generator.ts` | 1,558 | Generates Dispatcher epics from natural language using AI. Contains `PLANNER_SYSTEM_PROMPT` (119 lines of proven prompt engineering), response parsing/validation, Dispatcher creation logic. | Extract the system prompt and validation logic. The Dispatcher creation logic (`createPlanInDispatcher`, `createFeature`, `createTask`) is reusable. Replace `CopilotClient.createSession` + `sendAndWait` with ACP session. |
| **Recovery** | `src/orchestrator/recovery.ts` | 626 | Checkpoint/restore for interrupted orchestration runs. | Adapt to ACP session model. |

#### Key Proven Artifacts to Preserve

1. **`PLANNER_SYSTEM_PROMPT`** (plan-generator.ts:189-308): A 119-line prompt that instructs AI to produce structured JSON with epic/feature/task breakdown, execution ordering, complexity estimates, acceptance criteria, AI instructions, and validation checks. This prompt has been tested and produces good results - it should be the foundation of the Planning Pipeline agent.

2. **`PARALLEL_AGENT_SYSTEM_PROMPT`** (agent-pool.ts:151-180): System prompt for parallel agents that establishes the execution context, available tools, and workflow rules. Adapt for the feature-worker agent definition.

3. **Task prompt builder** (phase-executor.ts:727-801): Builds rich prompts for task-level agents including feature context, progress tracking tool instructions with concrete JSON examples, and structured workflow guidance. Adapt for ACP session prompts.

4. **Execution plan builder** (api-client.ts:1014-1085): Topological sort algorithm that builds execution phases from items with dependencies and parallel groups. Already works correctly - used by `getExecutionPlan()`.

### 3c. What Doesn't Exist Yet

- **No custom agents** - `.github/agents/` directory does not exist
- **No custom skills** - `.github/skills/` directory does not exist
- **No ACP integration** - No code for Agent Client Protocol (JSON-RPC over stdio)
- **MCP is disabled** - `.github/copilot-instructions.md` has all Dispatcher MCP tool instructions commented out due to "TypeError: terminated" errors during large operations

---

## 4. Architecture Design

### Two-Capability Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                │
│                                                                      │
│  $ copilot @planner "Build a user activity dashboard"                │
│  $ copilot @orchestrator "Execute epic ENG-42"                       │
│  $ dispatcher plan "Build a user activity dashboard"                   │
│  $ dispatcher run ENG-42                                               │
└──────────────────┬───────────────────────────┬───────────────────────┘
                   │                           │
          ┌────────▼────────┐         ┌────────▼────────┐
          │    PLANNING     │         │   EXECUTION     │
          │    PIPELINE     │         │   ENGINE        │
          │                 │         │                 │
          │  Copilot CLI    │         │  ACP-based      │
          │  agent + skill  │         │  orchestrator   │
          │                 │         │                 │
          │  5-stage        │         │  Phase mgmt     │
          │  pipeline with  │         │  Session spawn  │
          │  review gates   │         │  Git branches   │
          │                 │         │  Progress track  │
          └────────┬────────┘         └────────┬────────┘
                   │                           │
                   └─────────┬─────────────────┘
                             │
                    ┌────────▼────────┐
                    │   SPECTREE      │
                    │   (MCP + API)   │
                    │                 │
                    │  Context        │
                    │  backbone       │
                    │  for both       │
                    │  capabilities   │
                    └─────────────────┘
```

### 4a. Planning Pipeline

The Planning Pipeline is implemented as a **Copilot CLI custom agent** (`planner.md`) combined with a **custom skill** (`dispatcher-planning/SKILL.md`). It runs inside a normal Copilot CLI session and uses Dispatcher MCP tools.

#### 5-Stage Pipeline

```
Stage 1: ANALYZE
  Input:  Natural language description + codebase access
  Output: Scope assessment, affected areas, technical constraints
  Gate:   Configurable (auto/review/stop)

Stage 2: DECOMPOSE
  Input:  Analysis from stage 1
  Output: Feature list with execution ordering, dependencies, parallelism
  Tools:  dispatcher__create_epic_complete (creates full hierarchy)
  Gate:   Configurable

Stage 3: DETAIL
  Input:  Created epic with features and tasks
  Output: Every feature and task has: acceptance criteria, AI instructions,
          files involved, technical notes, risk level, effort estimate
  Tools:  dispatcher__set_structured_description (for each item)
  Gate:   Configurable

Stage 4: EVALUATE
  Input:  Fully detailed epic
  Output: Quality score + specific issues found
  Checks: - Each task scoped to ~125k tokens?
          - At least 2 acceptance criteria per task?
          - AI instructions present and specific?
          - Files involved listed?
          - Dependencies form valid DAG?
          - Parallel groups are actually independent?
  Gate:   Always review (shows score + issues)

Stage 5: VERIFY
  Input:  Evaluated epic
  Output: Execution plan visualization
  Tools:  dispatcher__get_execution_plan
  Check:  Phases match intended ordering, no circular deps,
          parallel features don't touch same files
  Gate:   Always review (shows execution plan)
```

#### Review Gate Configuration

The developer sets gate behavior via the planning command:

```
# Full auto (trust the AI)
@planner --gates=auto "Build a user activity dashboard"

# Review at each stage (default for new users)
@planner --gates=review "Build a user activity dashboard"

# Auto through decompose, review from detail onwards
@planner --gates=auto,auto,review,review,review "Build a user activity dashboard"
```

### 4b. Execution Engine

The Execution Engine is a **programmatic ACP client** that reads execution plans from Dispatcher and drives Copilot CLI sessions. It does NOT run inside a Copilot CLI session - it's a Node.js process that controls Copilot CLI externally.

#### Execution Flow

```
1. Read execution plan
   └── dispatcher__get_execution_plan(epicId) → phases[]

2. For each phase:
   ├── Determine execution mode (parallel vs sequential)
   ├── For each item in phase:
   │   ├── Create git branch (via BranchManager)
   │   ├── Build context prompt (from Dispatcher structured descriptions)
   │   ├── Spawn Copilot CLI session via ACP
   │   │   └── copilot --acp → JSON-RPC connection
   │   │       └── session/new → session/prompt → stream session/update
   │   ├── Monitor progress via ACP events + Dispatcher polling
   │   └── On completion: mark done in Dispatcher, merge branch
   ├── Wait for all parallel items to complete
   └── Verify phase results before proceeding

3. Post-execution:
   ├── Run all validations (dispatcher__run_all_validations)
   ├── Generate summary
   └── End Dispatcher session with handoff
```

#### Context Injection

Each ACP session receives a rich prompt built from Dispatcher data:

```markdown
# Task: {TASK_IDENTIFIER} - {TASK_TITLE}

## Requirements
{from dispatcher__get_structured_description}

## Acceptance Criteria
{from structured description acceptanceCriteria[]}

## AI Instructions
{from structured description aiInstructions}

## Files Involved
{from structured description filesInvolved[]}

## Previous Context
{from dispatcher__get_ai_context}

## Code Context
{from dispatcher__get_code_context}

## Decisions Made So Far
{from dispatcher__get_decision_context}

## Your Tools
You have Dispatcher MCP tools. Use them to:
- dispatcher__log_progress - Report progress
- dispatcher__log_decision - Record decisions
- dispatcher__link_code_file - Track modified files
- dispatcher__run_all_validations - Verify your work
- dispatcher__complete_task_with_validation - Validate and complete

## When Done
1. Run dispatcher__complete_task_with_validation
2. Ensure all modified files are linked
3. Leave an AI note summarizing what was done
```

---

## 5. Technical Decisions

### ACP over Copilot SDK

The `@github/copilot-sdk` is being replaced by **ACP (Agent Client Protocol)** as the programmatic interface to Copilot CLI. ACP provides:

- **Model-agnostic**: Works with any model Copilot CLI supports (including Claude via Anthropic API)
- **Native feature access**: Custom agents, skills, MCP servers all work automatically
- **JSON-RPC standard**: Well-defined protocol with streaming support
- **Process isolation**: Each session runs in its own Copilot CLI process

The existing orchestrator's SDK-coupled code (~5,200 lines) will be refactored to use ACP's `session/new`, `session/prompt`, and `session/update` instead of `CopilotClient.createSession()`, `session.send()`, and `session.on()`.

### Planning Pipeline as Agent + Skill (Not Programmatic Code)

The Planning Pipeline runs **inside** Copilot CLI as a custom agent rather than as standalone code. This means:

- The planner has full access to the codebase (can read files, search code)
- It uses Dispatcher MCP tools directly (no HTTP client needed)
- It benefits from Copilot CLI's context management
- The developer interacts with it conversationally (can refine, ask questions)

The skill encodes the 5-stage procedure; the agent provides the persona and tool access.

### Execution Engine as ACP Client

The Execution Engine runs **outside** Copilot CLI as a Node.js process. This provides:

- Deterministic phase management (not at the model's discretion)
- Programmatic error handling and retry logic
- Precise control over session spawning and teardown
- Git branch management between sessions
- Progress tracking and reporting

### Dispatcher MCP as Context Backbone

Both capabilities use Dispatcher as their shared data store:

- Planning Pipeline **writes** to Dispatcher (creates epics, features, tasks, structured descriptions)
- Execution Engine **reads** from Dispatcher (execution plans, structured descriptions, AI context)
- Worker sessions **read and write** to Dispatcher (progress, decisions, code context, validations)

This is the key architectural insight: **Dispatcher provides the persistent memory that ephemeral AI sessions lack.**

### Re-enable MCP in copilot-instructions.md

The MCP tools are currently disabled in `.github/copilot-instructions.md` due to "TypeError: terminated" errors. This must be fixed and re-enabled as a prerequisite for the automation tool. Without MCP access, neither the Planning Pipeline nor worker sessions can interact with Dispatcher.

---

## 6. Custom Agents Specification

All agents are defined in `.github/agents/` as Markdown files with YAML frontmatter.

### `planner.md` - Planning Pipeline Agent

```yaml
---
name: Dispatcher Planner
description: "Creates structured Dispatcher epics from natural language descriptions.
  Runs a 5-stage pipeline: Analyze → Decompose → Detail → Evaluate → Verify.
  Use when the user wants to plan, design, or spec out a feature or body of work."
tools: ['read', 'search', 'agent', 'web']
user-invokable: true
---
```

**Role:** User-invokable agent that takes a natural language description and produces a fully-specified Dispatcher epic through the 5-stage planning pipeline. Encodes the iterative refinement process that currently requires tacit knowledge.

**Key behaviors:**
- Reads the codebase to understand scope and constraints
- Uses `dispatcher__create_epic_complete` to create the full hierarchy
- Sets structured descriptions on every feature and task
- Evaluates against quality heuristics
- Generates and verifies the execution plan
- Supports configurable review gates at each stage

### `orchestrator.md` - Execution Coordinator Agent

```yaml
---
name: Dispatcher Orchestrator
description: "Executes Dispatcher epic execution plans by coordinating feature-worker
  agents. Reads the execution plan, manages phases, and delegates features to
  sub-agents. Use when the user wants to execute an epic or run a specific phase."
tools: ['agent', 'execute', 'read']
agents: ['feature-worker', 'reviewer']
user-invokable: true
---
```

**Role:** User-invokable agent that reads a Dispatcher execution plan and delegates feature implementation to sub-agents. This is the Copilot CLI-native orchestration path (alternative to the programmatic ACP engine for simpler use cases).

**Key behaviors:**
- Reads execution plan from Dispatcher
- Spawns feature-worker sub-agents via `#runSubagent` (parallel when safe)
- Waits for completion, handles errors
- Updates Dispatcher progress after each feature
- Triggers the reviewer agent after each phase

### `feature-worker.md` - Feature Implementation Agent

```yaml
---
name: Feature Worker
description: "Implements all tasks within a single Dispatcher feature. Receives
  context from the orchestrator including requirements, acceptance criteria,
  and code context. NOT user-invokable - only spawned as a sub-agent."
tools: ['read', 'edit', 'execute', 'search']
user-invokable: false
---
```

**Role:** Sub-agent only. Receives a feature identifier and full context, then implements all tasks sequentially within the feature. Each sub-agent works in isolation with its own context window.

**Key behaviors:**
- Reads structured description and AI instructions from Dispatcher
- Completes tasks in execution order
- Runs validations before marking tasks complete
- Links all modified files to Dispatcher
- Logs decisions with rationale
- Leaves AI notes for future sessions

### `reviewer.md` - Review Agent

```yaml
---
name: Dispatcher Reviewer
description: "Reviews completed features against their Dispatcher acceptance criteria.
  Runs validations, checks code quality, and verifies requirements are met.
  Use when you want to review a completed feature or task."
tools: ['read', 'search', 'execute']
user-invokable: true
---
```

**Role:** Reviews completed work against acceptance criteria defined in Dispatcher. Can be user-invoked or called by the orchestrator after each phase.

**Key behaviors:**
- Reads acceptance criteria from structured descriptions
- Runs all validation checks
- Reviews code changes against requirements
- Reports issues or approves completion

---

## 7. Custom Skills Specification

All skills are defined in `.github/skills/` as directories containing a `SKILL.md` file.

### `dispatcher-planning/SKILL.md` - Planning Procedure

Encodes the full 5-stage planning pipeline as a repeatable procedure. This is loaded by the planner agent but can also be used by any agent that needs to create Dispatcher epics.

**Contents:**
- Stage-by-stage instructions with MCP tool calls
- Quality heuristics for task scoping (see Section 10)
- Review gate behavior documentation
- Example structured descriptions at each detail level
- The proven `PLANNER_SYSTEM_PROMPT` structure (from plan-generator.ts) adapted as a planning checklist

### `dispatcher-session/SKILL.md` - Session Start/End Protocol

Encodes the Dispatcher session management workflow that every AI session should follow.

**Contents:**
- Session start: `dispatcher__start_session`, read previous context, check progress
- During work: `dispatcher__log_progress`, `dispatcher__log_decision`, `dispatcher__link_code_file`
- Session end: `dispatcher__end_session` with summary, next steps, blockers, decisions
- Error handling: `dispatcher__report_blocker` when stuck

### `dispatcher-validation/SKILL.md` - Validation Procedures

Encodes validation workflows for verifying completed work.

**Contents:**
- How to run `dispatcher__run_all_validations` and interpret results
- How to use `dispatcher__complete_task_with_validation` for atomic validate-and-complete
- Fallback procedures when automated validation isn't sufficient
- How to add new validation checks when acceptance criteria change

---

## 8. Implementation Requirements (10 Features)

> **For the AI planner:** Each feature below maps to one Dispatcher feature. Each task maps to one Dispatcher task. The structured fields (AI Instructions, Acceptance Criteria, Files Involved, Technical Notes, Risk Level, Estimated Effort, Validations) map directly to `dispatcher__set_structured_description` and `dispatcher__add_validation` calls. Translate this section 1:1 into Dispatcher items.

---

### Feature 1: MCP Stability Fix & Re-enablement

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** none
**Risk Level:** medium
**Estimated Effort:** medium

**Description:**
The Dispatcher MCP server (`packages/mcp/`) crashes with "TypeError: terminated" during large operations, particularly `dispatcher__create_epic_complete` calls that create many features and tasks atomically. The MCP tool instructions in `.github/copilot-instructions.md` are currently wrapped in HTML comment blocks (`<!-- ... -->`) to prevent agents from calling them. This feature fixes the stability issue and re-enables the MCP instructions.

**AI Instructions:**
1. Start the MCP server locally and reproduce the crash. Run the Dispatcher API (`cd packages/api && pnpm dev`), then start the MCP server (`cd packages/mcp && pnpm dev`). Use a Copilot CLI session with MCP loaded to call `dispatcher__create_epic_complete` with a payload of 7 features and 25 tasks.
2. Check `packages/mcp/src/index.ts` for process lifecycle handling. Look for missing error handlers on the MCP server transport, unhandled promise rejections, or missing `process.on('uncaughtException')` handlers.
3. Check `packages/mcp/src/tools/composite.ts` (the `dispatcher__create_epic_complete` handler starting at line 186) for long-running operations that might exceed MCP transport timeouts.
4. The fix likely involves: (a) adding global error handlers to the MCP server process, (b) adding try/catch with proper error responses in tool handlers, (c) adding timeout handling for API calls within tool handlers, (d) possibly chunking the `create_epic_complete` API call on the server side.
5. After fixing, re-enable MCP instructions in `.github/copilot-instructions.md` by removing the HTML comment wrappers (`<!--` and `-->`) around the two disabled sections: "Dispatcher MCP Integration" (lines ~22-362) and "AI Session Context MCP Tools" (lines ~412-554).
6. Test reliability by running the full planning workflow 3 times in succession.

**Acceptance Criteria:**
- [ ] MCP server handles `dispatcher__create_epic_complete` with 7 features and 25+ tasks without crashing or "TypeError: terminated"
- [ ] MCP server handles 10 consecutive tool calls without process termination
- [ ] `.github/copilot-instructions.md` has both MCP sections active (not wrapped in HTML comments)
- [ ] Running `dispatcher__list_teams` → `dispatcher__create_epic_complete` → `dispatcher__get_execution_plan` in one session works reliably

**Files Involved:**
- `packages/mcp/src/index.ts`
- `packages/mcp/src/tools/composite.ts`
- `.github/copilot-instructions.md`

**Technical Notes:**
- The MCP server uses `@modelcontextprotocol/sdk` and registers tools via `server.registerTool()`. See `packages/mcp/src/tools/` for all tool files.
- The API client used by MCP tools is in `packages/mcp/src/api-client.ts` (separate from the orchestrator's api-client).
- The Dispatcher API must be running locally for MCP tools to work. Default API URL: `http://localhost:3001`.
- The MCP token is stored in `packages/mcp/.env`.

#### Task 1.1: Reproduce and Diagnose the TypeError

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** false
**Estimated Effort:** small
**Risk Level:** low

**Description:** Reproduce the "TypeError: terminated" error by calling `dispatcher__create_epic_complete` via MCP with a large payload. Capture the full error stack trace, identify whether it's a transport timeout, process crash, or unhandled rejection.

**AI Instructions:**
1. Ensure the Dispatcher API is running: `cd packages/api && pnpm dev`
2. Start the MCP server: `cd packages/mcp && pnpm dev`
3. Read `packages/mcp/src/index.ts` to understand how the MCP server is initialized and what error handlers exist
4. Read `packages/mcp/src/tools/composite.ts` to understand the `create_epic_complete` implementation
5. Trigger the error by calling `dispatcher__create_epic_complete` with a large payload (7 features, 3-5 tasks each) from a Copilot CLI session with MCP configured
6. Capture the error output. Check: Does the MCP process exit? Is it a transport-level error? Is there an unhandled promise rejection?
7. Log findings using `dispatcher__log_progress` and `dispatcher__log_decision` with the diagnosis

**Acceptance Criteria:**
- [ ] Error is reproduced with a documented reproduction case
- [ ] Root cause category identified (transport timeout / process crash / unhandled rejection / memory)
- [ ] Findings logged as a decision in Dispatcher

**Files Involved:**
- `packages/mcp/src/index.ts`
- `packages/mcp/src/tools/composite.ts`
- `packages/mcp/src/api-client.ts`

**Validations:**
- `{ "type": "manual", "description": "Error has been reproduced and root cause documented" }`

---

#### Task 1.2: Fix the Root Cause

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Fix the identified root cause of the "TypeError: terminated" error. Apply the appropriate fix based on the diagnosis from Task 1.1.

**AI Instructions:**
1. Based on the diagnosis from Task 1.1, apply the appropriate fix:
   - **If transport timeout:** Increase the MCP transport timeout configuration. Check if `@modelcontextprotocol/sdk` supports custom timeout settings in the server options.
   - **If unhandled promise rejection:** Add try/catch blocks around all async operations in tool handlers. Ensure every tool handler in `packages/mcp/src/tools/*.ts` catches errors and returns proper MCP error responses via `createErrorResponse()` (defined in `packages/mcp/src/tools/utils.ts`).
   - **If process crash:** Add `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers in `packages/mcp/src/index.ts` that log the error and attempt recovery rather than crashing.
   - **If memory pressure:** The `create_epic_complete` handler creates many API calls sequentially. Consider adding a small delay between API calls or batching them.
2. The fix should be minimal and targeted - don't refactor unrelated code.
3. Test the fix by running the same reproduction case from Task 1.1.

**Acceptance Criteria:**
- [ ] The specific root cause is fixed with a targeted code change
- [ ] The reproduction case from Task 1.1 no longer crashes
- [ ] TypeScript compiles without errors: `pnpm exec tsc --noEmit` in `packages/mcp/`

**Files Involved:**
- `packages/mcp/src/index.ts`
- `packages/mcp/src/tools/composite.ts`
- `packages/mcp/src/tools/utils.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles without errors", "command": "cd packages/mcp && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "manual", "description": "Reproduction case no longer crashes the MCP server" }`

---

#### Task 1.3: Add Defensive Error Handling

**Execution Order:** 3
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [2]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Add defensive error handling to the MCP server to prevent future crashes from unhandled errors in any tool handler.

**AI Instructions:**
1. Read `packages/mcp/src/tools/utils.ts` to understand the existing `createErrorResponse()` helper.
2. Review each tool registration file in `packages/mcp/src/tools/`:
   - `composite.ts` (create_epic_complete, complete_task_with_validation)
   - `execution.ts` (get_execution_plan, set_execution_metadata, mark_blocked, mark_unblocked)
   - Check other files: `epics.ts`, `features.ts`, `tasks.ts`, `progress.ts`, `descriptions.ts`, `context.ts`, `validation.ts`, `decisions.ts`, `search.ts`, `templates.ts`, `personal.ts`, `instructions.ts`
3. Ensure every tool handler's async callback is wrapped in try/catch with `createErrorResponse(error)` as the catch return.
4. Add global error handlers in `packages/mcp/src/index.ts`:
   ```typescript
   process.on('uncaughtException', (error) => { console.error('MCP uncaughtException:', error); });
   process.on('unhandledRejection', (reason) => { console.error('MCP unhandledRejection:', reason); });
   ```
5. Do NOT add retry logic inside tool handlers - let the caller (Copilot CLI) retry.

**Acceptance Criteria:**
- [ ] All tool handlers in `packages/mcp/src/tools/*.ts` have try/catch error handling
- [ ] Global uncaughtException and unhandledRejection handlers exist in the MCP server entry point
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/mcp/src/index.ts`
- `packages/mcp/src/tools/composite.ts`
- `packages/mcp/src/tools/execution.ts`
- `packages/mcp/src/tools/utils.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/mcp && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "file_contains", "description": "Global error handlers exist", "filePath": "packages/mcp/src/index.ts", "searchPattern": "uncaughtException" }`

---

#### Task 1.4: Re-enable MCP Instructions

**Execution Order:** 4
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [3]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Remove the HTML comment wrappers from `.github/copilot-instructions.md` that disable the MCP tool sections. Update any stale content in the re-enabled sections.

**AI Instructions:**
1. Open `.github/copilot-instructions.md` and find the two disabled sections:
   - Section 1: "DISABLED: Dispatcher MCP Integration" - approximately lines 22-362, wrapped in `<!-- ... -->`
   - Section 2: "DISABLED: AI Session Context MCP Tools" - approximately lines 412-554, wrapped in `<!-- ... -->`
2. Remove the opening `<!--` and closing `-->` comment markers for both sections.
3. Remove the "TEMPORARY: Dispatcher MCP Tools Disabled" header at the top of the file (lines 3-10 approximately).
4. Remove the "DISABLED" labels from the section headers.
5. Review the re-enabled content for any stale references. Update if needed. Note: don't add documentation for agents/skills yet - that's Feature 9.
6. Verify the file is valid Markdown after changes.

**Acceptance Criteria:**
- [ ] No HTML comment wrappers around MCP sections in `.github/copilot-instructions.md`
- [ ] The "TEMPORARY: Dispatcher MCP Tools Disabled" notice is removed
- [ ] The Quick Reference checklist is visible (not commented out)
- [ ] The file is valid Markdown

**Files Involved:**
- `.github/copilot-instructions.md`

**Validations:**
- `{ "type": "file_contains", "description": "MCP Quick Reference is active", "filePath": ".github/copilot-instructions.md", "searchPattern": "Quick Reference \\(READ FIRST\\)" }`
- `{ "type": "file_contains", "description": "No remaining disabled sections", "filePath": ".github/copilot-instructions.md", "searchPattern": "(?!.*DISABLED:)" }`

---

#### Task 1.5: Verify MCP Reliability

**Execution Order:** 5
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [4]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Run the full MCP planning workflow 3 times to verify stability. Test with progressively larger payloads.

**AI Instructions:**
1. Start the Dispatcher API and MCP server.
2. Test 1 (small): Call `dispatcher__list_teams`, then `dispatcher__create_epic_complete` with 3 features, 2 tasks each. Verify success.
3. Test 2 (medium): Call `dispatcher__create_epic_complete` with 5 features, 3 tasks each. Then call `dispatcher__get_execution_plan` on the created epic. Verify success.
4. Test 3 (large): Call `dispatcher__create_epic_complete` with 7 features, 4 tasks each (28 tasks total). Then call `dispatcher__set_structured_description` on 3 of the features. Then call `dispatcher__get_execution_plan`. Verify success.
5. If any test fails, log the failure and create a follow-up task.
6. Clean up test epics after verification.

**Acceptance Criteria:**
- [ ] All 3 test runs complete without MCP server crashes
- [ ] `dispatcher__get_execution_plan` returns valid execution plans for all test epics
- [ ] No "TypeError: terminated" errors observed

**Files Involved:**
- (No code changes - verification only)

**Validations:**
- `{ "type": "manual", "description": "3 consecutive MCP test runs complete without crashes" }`

---

### Feature 2: Custom Agents

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "phase-2-foundation"
**Dependencies:** none
**Risk Level:** low
**Estimated Effort:** medium

**Description:**
Create 4 custom agent definitions in `.github/agents/`. These Markdown files with YAML frontmatter define specialized AI personas that Copilot CLI auto-selects based on task relevance. The agents are the user-facing interface to the automation tool.

The agents reference Dispatcher MCP tools extensively. While they can be written without MCP running, they should be tested after Feature 1 completes.

**AI Instructions:**
1. Create the `.github/agents/` directory if it doesn't exist.
2. Each agent file has YAML frontmatter (name, description, tools, agents, user-invokable) followed by Markdown instructions.
3. The agent instructions should reference specific Dispatcher MCP tool names (e.g., `dispatcher__create_epic_complete`) and include concrete examples of how to call them.
4. Refer to Section 6 of this strategy document for the agent specifications.
5. The YAML `tools` field uses Copilot CLI tool categories: `read`, `edit`, `execute`, `search`, `agent`, `web`, `todo`.
6. The YAML `agents` field lists other agents this one can invoke via `#runSubagent`.
7. Set `user-invokable: false` for feature-worker (sub-agent only).

**Acceptance Criteria:**
- [ ] `.github/agents/planner.md` exists with valid YAML frontmatter and planning pipeline instructions
- [ ] `.github/agents/orchestrator.md` exists with execution plan delegation logic
- [ ] `.github/agents/feature-worker.md` exists with `user-invokable: false` and task implementation workflow
- [ ] `.github/agents/reviewer.md` exists with acceptance criteria review process
- [ ] All 4 files have valid YAML frontmatter that Copilot CLI can parse

**Files Involved:**
- `.github/agents/planner.md`
- `.github/agents/orchestrator.md`
- `.github/agents/feature-worker.md`
- `.github/agents/reviewer.md`

**Technical Notes:**
- Copilot CLI custom agent YAML fields: `name` (string), `description` (string, required), `tools` (string[]), `agents` (string[]), `model` (string), `infer` (boolean), `user-invokable` (boolean), `mcp-servers` (object).
- The `description` field is what Copilot CLI uses to decide when to auto-select the agent. Make it specific.
- MCP servers configured globally in the Copilot CLI config are automatically available to all agents.

#### Task 2.1: Create planner.md Agent Definition

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "agents"
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Create the Dispatcher Planner agent that takes natural language descriptions and produces fully-specified Dispatcher epics through a 5-stage planning pipeline.

**AI Instructions:**
1. Create `.github/agents/planner.md`.
2. YAML frontmatter:
   ```yaml
   ---
   name: Dispatcher Planner
   description: "Creates structured Dispatcher epics from natural language descriptions. Runs a 5-stage pipeline: Analyze, Decompose, Detail, Evaluate, Verify. Use when the user wants to plan, design, or spec out a feature or body of work."
   tools: ['read', 'search', 'agent', 'web']
   user-invokable: true
   ---
   ```
3. Markdown body should include:
   - **Role statement**: "You create comprehensive Dispatcher epics from natural language feature requests."
   - **5-stage pipeline** (Analyze → Decompose → Detail → Evaluate → Verify) with specific MCP tool calls at each stage
   - **Stage 1 (Analyze)**: Read relevant codebase files using `read` and `search` tools. Identify scope, affected packages, technical constraints. Output: scope assessment.
   - **Stage 2 (Decompose)**: Break into features with execution ordering. Call `dispatcher__list_teams` to get team ID, then `dispatcher__create_epic_complete` with all features and tasks. Output: created epic.
   - **Stage 3 (Detail)**: For every feature and task, call `dispatcher__set_structured_description` with: summary, aiInstructions, acceptanceCriteria (3+ per feature, 2+ per task), filesInvolved, technicalNotes, riskLevel, estimatedEffort.
   - **Stage 4 (Evaluate)**: Score the plan against quality heuristics (from Section 10 of the strategy document). Report issues.
   - **Stage 5 (Verify)**: Call `dispatcher__get_execution_plan` and verify phases, dependencies, parallelism.
   - **Review gates**: Explain that the user can say "auto" to skip review or "stop" to halt at any stage.
   - **Rules section**: MUST call `dispatcher__list_teams` before creating epics. MUST set structured descriptions for ALL items. MUST verify the execution plan at the end.
4. The planning prompt structure should be adapted from `PLANNER_SYSTEM_PROMPT` in `packages/orchestrator/src/orchestrator/plan-generator.ts` (lines 189-308). This proven prompt defines: complexity levels (trivial/simple/moderate/complex), risk levels (low/medium/high), effort estimates (trivial/small/medium/large/xl), validation types (command/file_exists/file_contains/test_passes/manual), and rules for execution ordering and parallelism.

**Acceptance Criteria:**
- [ ] `.github/agents/planner.md` exists with valid YAML frontmatter
- [ ] Agent body references all 5 pipeline stages with specific MCP tool calls
- [ ] Agent includes quality heuristics for evaluation
- [ ] Agent instructions mention review gate options

**Files Involved:**
- `.github/agents/planner.md`

**Validations:**
- `{ "type": "file_exists", "description": "Planner agent file exists", "filePath": ".github/agents/planner.md" }`
- `{ "type": "file_contains", "description": "References create_epic_complete", "filePath": ".github/agents/planner.md", "searchPattern": "dispatcher__create_epic_complete" }`
- `{ "type": "file_contains", "description": "References set_structured_description", "filePath": ".github/agents/planner.md", "searchPattern": "dispatcher__set_structured_description" }`

---

#### Task 2.2: Create orchestrator.md Agent Definition

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "agents"
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Create the Dispatcher Orchestrator agent that reads execution plans from Dispatcher and delegates feature implementation to sub-agents.

**AI Instructions:**
1. Create `.github/agents/orchestrator.md`.
2. YAML frontmatter:
   ```yaml
   ---
   name: Dispatcher Orchestrator
   description: "Executes Dispatcher epic execution plans by coordinating feature-worker agents. Reads the execution plan, manages phases, and delegates features to sub-agents. Use when the user wants to execute an epic or run a specific phase."
   tools: ['agent', 'execute', 'read']
   agents: ['feature-worker', 'reviewer']
   user-invokable: true
   ---
   ```
3. Markdown body should include:
   - **Role statement**: "You execute Dispatcher epics by reading execution plans and delegating feature implementation to feature-worker sub-agents."
   - **Workflow**:
     1. Call `dispatcher__get_execution_plan` for the specified epic
     2. For each phase: identify parallel vs sequential items
     3. For each feature: gather context by calling `dispatcher__get_structured_description`, `dispatcher__get_ai_context`, `dispatcher__get_code_context`, `dispatcher__get_decision_context`
     4. Spawn feature-worker sub-agents via `#runSubagent` with full context in the prompt
     5. For parallel features: spawn all sub-agents at once
     6. For sequential features: wait for each to complete before starting next
     7. After each feature completes: call `dispatcher__complete_work` to mark done
     8. After all phases: invoke the reviewer agent to check work
   - **Context injection template**: Include the full prompt template from Section 4b of this strategy document that injects Dispatcher data into sub-agent prompts
   - **Error handling**: If a sub-agent fails, log the error with `dispatcher__report_blocker`, skip the feature, and continue with remaining features in the phase
   - **Rules**: NEVER skip reading the execution plan. ALWAYS inject full Dispatcher context. ALWAYS update progress after each feature.

**Acceptance Criteria:**
- [ ] `.github/agents/orchestrator.md` exists with valid YAML frontmatter
- [ ] `agents:` field lists `feature-worker` and `reviewer`
- [ ] Body includes context injection template with MCP tool calls
- [ ] Body includes error handling instructions

**Files Involved:**
- `.github/agents/orchestrator.md`

**Validations:**
- `{ "type": "file_exists", "description": "Orchestrator agent file exists", "filePath": ".github/agents/orchestrator.md" }`
- `{ "type": "file_contains", "description": "Lists feature-worker agent", "filePath": ".github/agents/orchestrator.md", "searchPattern": "feature-worker" }`
- `{ "type": "file_contains", "description": "References get_execution_plan", "filePath": ".github/agents/orchestrator.md", "searchPattern": "dispatcher__get_execution_plan" }`

---

#### Task 2.3: Create feature-worker.md Agent Definition

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "agents"
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Create the Feature Worker agent that implements all tasks within a single feature. This is a sub-agent only - not directly user-invokable.

**AI Instructions:**
1. Create `.github/agents/feature-worker.md`.
2. YAML frontmatter:
   ```yaml
   ---
   name: Feature Worker
   description: "Implements all tasks within a single Dispatcher feature. Receives full context from the orchestrator including requirements, acceptance criteria, and code context. NOT user-invokable - only spawned as a sub-agent by the orchestrator."
   tools: ['read', 'edit', 'execute', 'search']
   user-invokable: false
   ---
   ```
3. Markdown body should include:
   - **Role statement**: "You implement a single Dispatcher feature by completing all its tasks in execution order."
   - **Expected context**: The orchestrator will provide: feature identifier, task list, structured descriptions, AI instructions, acceptance criteria, files involved, previous AI context, code context, decisions.
   - **Per-task workflow** (adapted from `phase-executor.ts` lines 727-801):
     1. Call `dispatcher__start_work` for the task
     2. Read the task's AI instructions carefully
     3. Implement the task according to instructions
     4. Call `dispatcher__link_code_file` for every file created or modified
     5. Call `dispatcher__log_progress` after each significant step
     6. Call `dispatcher__log_decision` for any implementation choices
     7. Run `dispatcher__run_all_validations` for the task
     8. Call `dispatcher__complete_task_with_validation` to validate and mark done
   - **Progress tracking tool examples** with concrete JSON (adapted from phase-executor.ts):
     ```json
     // Log progress
     { "type": "task", "id": "ENG-42-1", "message": "Created API route handler", "percentComplete": 50 }
     // Log decision
     { "epicId": "...", "taskId": "...", "question": "Which validation library?", "decision": "Use Zod", "rationale": "Already used in project", "category": "library" }
     // Link code file
     { "type": "task", "id": "ENG-42-1", "filePath": "src/routes/preferences.ts" }
     ```
   - **Rules**: MUST complete tasks in executionOrder. MUST run validations before marking complete. MUST link ALL modified files. MUST log decisions with rationale. Do NOT modify files outside the task's scope.

**Acceptance Criteria:**
- [ ] `.github/agents/feature-worker.md` exists with `user-invokable: false`
- [ ] Body includes per-task workflow with specific MCP tool calls
- [ ] Body includes concrete JSON examples for progress tracking tools
- [ ] Body includes rules about scope isolation and validation requirements

**Files Involved:**
- `.github/agents/feature-worker.md`

**Validations:**
- `{ "type": "file_exists", "description": "Feature worker agent file exists", "filePath": ".github/agents/feature-worker.md" }`
- `{ "type": "file_contains", "description": "Set as sub-agent only", "filePath": ".github/agents/feature-worker.md", "searchPattern": "user-invokable: false" }`

---

#### Task 2.4: Create reviewer.md Agent Definition

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "agents"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Create the Dispatcher Reviewer agent that reviews completed features against their Dispatcher acceptance criteria.

**AI Instructions:**
1. Create `.github/agents/reviewer.md`.
2. YAML frontmatter:
   ```yaml
   ---
   name: Dispatcher Reviewer
   description: "Reviews completed features against their Dispatcher acceptance criteria. Runs validations, checks code quality, and verifies requirements are met. Use when you want to review a completed feature or task."
   tools: ['read', 'search', 'execute']
   user-invokable: true
   ---
   ```
3. Markdown body should include:
   - **Role statement**: "You review completed work against acceptance criteria stored in Dispatcher."
   - **Review workflow**:
     1. Call `dispatcher__get_structured_description` for the feature/task
     2. Read the acceptance criteria list
     3. For each criterion: verify it's met by reading the relevant code
     4. Call `dispatcher__run_all_validations` to run automated checks
     5. Call `dispatcher__get_code_context` to see what files were modified
     6. Review the modified files for code quality
     7. Report findings: passed criteria, failed criteria, code quality issues
   - **Output format**: Structured review report with pass/fail per criterion

**Acceptance Criteria:**
- [ ] `.github/agents/reviewer.md` exists with valid YAML frontmatter
- [ ] Body includes review workflow with MCP tool calls
- [ ] Body includes output format specification

**Files Involved:**
- `.github/agents/reviewer.md`

**Validations:**
- `{ "type": "file_exists", "description": "Reviewer agent file exists", "filePath": ".github/agents/reviewer.md" }`
- `{ "type": "file_contains", "description": "References run_all_validations", "filePath": ".github/agents/reviewer.md", "searchPattern": "dispatcher__run_all_validations" }`

---

### Feature 3: Custom Skills

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "phase-2-foundation"
**Dependencies:** none
**Risk Level:** low
**Estimated Effort:** medium

**Description:**
Create 3 custom skill definitions in `.github/skills/`. Skills are reusable instruction sets (procedures) that Copilot CLI loads when relevant. Unlike agents (personas), skills are step-by-step procedures that any agent can reference.

**AI Instructions:**
1. Create the `.github/skills/` directory with subdirectories for each skill.
2. Each skill is a directory containing a `SKILL.md` file.
3. Skills don't have YAML frontmatter - they're pure Markdown procedures.
4. Skills should reference specific Dispatcher MCP tool names with concrete call examples.

**Acceptance Criteria:**
- [ ] `.github/skills/dispatcher-planning/SKILL.md` exists with the 5-stage planning procedure
- [ ] `.github/skills/dispatcher-session/SKILL.md` exists with session start/during/end protocol
- [ ] `.github/skills/dispatcher-validation/SKILL.md` exists with validation run/interpret/complete workflow
- [ ] Each skill file is self-contained and can be understood without reading other files

**Files Involved:**
- `.github/skills/dispatcher-planning/SKILL.md`
- `.github/skills/dispatcher-session/SKILL.md`
- `.github/skills/dispatcher-validation/SKILL.md`

**Technical Notes:**
- Copilot CLI loads skills from `.github/skills/<name>/SKILL.md`.
- Skills are loaded contextually when the conversation topic matches.
- Skills complement agents - an agent provides the persona, a skill provides the procedure.

#### Task 3.1: Create dispatcher-planning Skill

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "skills"
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Create the planning procedure skill that encodes the full 5-stage pipeline for creating Dispatcher epics.

**AI Instructions:**
1. Create `.github/skills/dispatcher-planning/SKILL.md`.
2. Content should encode the 5-stage pipeline from Section 4a of this strategy document:
   - **Stage 1 (Analyze)**: Instructions to read the codebase, identify affected packages, list technical constraints.
   - **Stage 2 (Decompose)**: Instructions to call `dispatcher__list_teams`, then `dispatcher__create_epic_complete` with the full hierarchy. Include the JSON schema expected by `create_epic_complete` (from `packages/mcp/src/tools/composite.ts`): name, team, description, features[] with title, executionOrder, estimatedComplexity, canParallelize, parallelGroup, dependencies, tasks[] with title, executionOrder, estimatedComplexity, structuredDesc.
   - **Stage 3 (Detail)**: For each feature and task, call `dispatcher__set_structured_description`. List all fields: summary, aiInstructions, acceptanceCriteria, filesInvolved, functionsToModify, testingStrategy, testFiles, technicalNotes, riskLevel, estimatedEffort.
   - **Stage 4 (Evaluate)**: Quality heuristics checklist from Section 10.
   - **Stage 5 (Verify)**: Call `dispatcher__get_execution_plan` and validate the output.
3. Include concrete examples of good vs bad structured descriptions (adapted from `.github/copilot-instructions.md` lines 246-293).
4. Include the complexity/risk/effort scales from `PLANNER_SYSTEM_PROMPT` (plan-generator.ts lines 201-224).

**Acceptance Criteria:**
- [ ] Skill encodes all 5 stages with specific MCP tool calls
- [ ] Skill includes the `create_epic_complete` input schema
- [ ] Skill includes quality heuristics checklist
- [ ] Skill includes concrete examples of good vs bad structured descriptions

**Files Involved:**
- `.github/skills/dispatcher-planning/SKILL.md`

**Validations:**
- `{ "type": "file_exists", "description": "Planning skill exists", "filePath": ".github/skills/dispatcher-planning/SKILL.md" }`
- `{ "type": "file_contains", "description": "Contains all 5 stages", "filePath": ".github/skills/dispatcher-planning/SKILL.md", "searchPattern": "Stage 5" }`

---

#### Task 3.2: Create dispatcher-session Skill

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "skills"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Create the session management skill encoding start/during/end protocols for Dispatcher-integrated sessions.

**AI Instructions:**
1. Create `.github/skills/dispatcher-session/SKILL.md`.
2. Content should cover three phases:
   - **Session Start**:
     1. Call `dispatcher__start_session({ epicId })` to start a session
     2. Review `previousSession` for continuity (summary, nextSteps, blockers, decisions)
     3. Call `dispatcher__get_progress_summary({ epicId })` to see current progress
     4. Call `dispatcher__get_blocked_summary({ epicId })` to see blockers
   - **During Work**:
     1. Call `dispatcher__start_work({ id, type })` before working on an item
     2. Call `dispatcher__log_progress({ id, type, message, percentComplete })` periodically
     3. Call `dispatcher__log_decision({ ... })` for important choices
     4. Call `dispatcher__link_code_file({ type, id, filePath })` for modified files
     5. Call `dispatcher__complete_work({ id, type, summary })` when done
   - **Session End**:
     1. Call `dispatcher__end_session` with summary, nextSteps, blockers, decisions
3. Include concrete JSON examples for each tool call.
4. Adapted from the session handoff documentation in `.github/copilot-instructions.md` (disabled section lines ~417-472).

**Acceptance Criteria:**
- [ ] Skill covers start, during, and end phases with specific MCP calls
- [ ] Skill includes concrete JSON examples for each tool
- [ ] Skill is self-contained

**Files Involved:**
- `.github/skills/dispatcher-session/SKILL.md`

**Validations:**
- `{ "type": "file_exists", "description": "Session skill exists", "filePath": ".github/skills/dispatcher-session/SKILL.md" }`

---

#### Task 3.3: Create dispatcher-validation Skill

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "skills"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Create the validation procedure skill encoding how to run, interpret, and act on Dispatcher validation checks.

**AI Instructions:**
1. Create `.github/skills/dispatcher-validation/SKILL.md`.
2. Content:
   - **Validation types**: command, file_exists, file_contains, test_passes, manual
   - **Running validations**:
     1. Call `dispatcher__list_validations({ taskId })` to see all checks
     2. Call `dispatcher__run_all_validations({ taskId })` to run all at once
     3. Or `dispatcher__run_validation({ taskId, checkId })` for individual checks
   - **Interpreting results**: Explain the response format (allPassed, totalChecks, passedChecks, failedChecks, individual results with error/output)
   - **Completing with validation**: `dispatcher__complete_task_with_validation({ taskId, summary })` runs all validations and marks complete only if all pass
   - **Adding new validations**: `dispatcher__add_validation({ taskId, type, description, command, ... })`
   - **Manual validations**: `dispatcher__mark_manual_validated({ taskId, checkId })`

**Acceptance Criteria:**
- [ ] Skill covers all validation types and their parameters
- [ ] Skill covers the validate-and-complete atomic workflow
- [ ] Skill explains result interpretation

**Files Involved:**
- `.github/skills/dispatcher-validation/SKILL.md`

**Validations:**
- `{ "type": "file_exists", "description": "Validation skill exists", "filePath": ".github/skills/dispatcher-validation/SKILL.md" }`

---

### Feature 4: Planning Pipeline Agent Enhancement

**Execution Order:** 3
**Estimated Complexity:** complex
**Can Parallelize:** true
**Parallel Group:** "phase-3-enhancement"
**Dependencies:** [Feature 2, Feature 3]
**Risk Level:** medium
**Estimated Effort:** large

**Description:**
Enhance the planner agent (from Feature 2) and planning skill (from Feature 3) with the full iterative workflow, configurable review gates, task scoping heuristics, and the proven planning prompt structure. This feature transforms the basic agent definition into a sophisticated planning pipeline.

**AI Instructions:**
1. This feature builds on `.github/agents/planner.md` and `.github/skills/dispatcher-planning/SKILL.md` created in Features 2 and 3.
2. The key enhancement is encoding the tacit knowledge from the existing `PLANNER_SYSTEM_PROMPT` (plan-generator.ts:189-308) into the agent and skill definitions.
3. Read the `PLANNER_SYSTEM_PROMPT` carefully - it defines: the JSON response format, complexity/risk/effort scales, validation types, and rules for execution ordering and parallelism.
4. The enhanced planner should NOT just generate JSON - it should use Dispatcher MCP tools interactively to create, refine, and verify the epic.

**Acceptance Criteria:**
- [ ] Planner produces epics where every task has: acceptance criteria (2+), AI instructions, files involved
- [ ] Execution plan has correct phase ordering and parallelism
- [ ] Review gates work: saying "auto" proceeds without review, saying "stop" halts
- [ ] Quality evaluation identifies: missing acceptance criteria, tasks with no AI instructions, tasks scoped too large, parallel features sharing files

**Files Involved:**
- `.github/agents/planner.md`
- `.github/skills/dispatcher-planning/SKILL.md`

**Technical Notes:**
- The planning pipeline runs inside a Copilot CLI session, NOT programmatically. The planner agent has full codebase access via `read` and `search` tools.
- Review gates are conversational: the planner presents results and waits for user approval at each stage.
- The `PLANNER_SYSTEM_PROMPT` (plan-generator.ts:189-308) is the proven reference for structuring AI planning prompts.

#### Task 4.1: Add Review Gate Logic to Planner Agent

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Add review gate configuration to the planner agent so users can control which stages require review.

**AI Instructions:**
1. Update `.github/agents/planner.md` to support gate configuration.
2. Add a section explaining gate modes: `auto` (proceed silently), `review` (show results, wait for approval), `stop` (halt for manual intervention).
3. The planner should parse user commands like:
   - `@planner "Build X"` → default to `review` at all stages
   - `@planner --gates=auto "Build X"` → auto at all stages
   - `@planner --gates=auto,auto,review,review,review "Build X"` → per-stage config
4. At each review gate, the planner should: summarize what was done, show key outputs, ask "Continue to next stage? (yes/no/modify)".
5. If the user says "modify", the planner should ask what to change and re-run the current stage.

**Acceptance Criteria:**
- [ ] Planner agent instructions include review gate documentation
- [ ] Default behavior is `review` at all stages
- [ ] Gate configuration syntax is documented

**Files Involved:**
- `.github/agents/planner.md`

**Validations:**
- `{ "type": "file_contains", "description": "Review gate documentation", "filePath": ".github/agents/planner.md", "searchPattern": "review gate" }`

---

#### Task 4.2: Encode PLANNER_SYSTEM_PROMPT as Planning Checklist

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Integrate the proven `PLANNER_SYSTEM_PROMPT` structure (from plan-generator.ts:189-308) into the planning skill as a checklist the planner follows during decomposition.

**AI Instructions:**
1. Read `packages/orchestrator/src/orchestrator/plan-generator.ts` lines 189-308 (the `PLANNER_SYSTEM_PROMPT`).
2. Extract the key structural rules:
   - 3-7 features per epic, 2-5 tasks per feature
   - Complexity levels: trivial (~15 min), simple (~1 hour), moderate (~2-4 hours), complex (~4+ hours)
   - Risk levels: low, medium, high
   - Effort estimates: trivial (<1hr), small (1-4hr), medium (1-2d), large (3-5d), xl (>5d)
   - Validation types: command, file_exists, file_contains, test_passes, manual
   - executionOrder is 1-indexed, dependencies reference executionOrder numbers
   - parallelGroup for concurrent items, canParallelize flag
   - aiInstructions should be detailed enough for implementation without additional context
   - acceptanceCriteria should be specific, measurable, verifiable
   - validations recommended for every task (at least one command check for typecheck/lint)
3. Add this as a "Decomposition Checklist" section in `.github/skills/dispatcher-planning/SKILL.md`.
4. Frame it as requirements the planner MUST satisfy, not as a JSON format (since the planner uses MCP tools, not JSON output).

**Acceptance Criteria:**
- [ ] Planning skill includes decomposition checklist with all PLANNER_SYSTEM_PROMPT rules
- [ ] Complexity, risk, and effort scales are documented
- [ ] Validation type requirements are documented
- [ ] Feature/task count guidelines are documented

**Files Involved:**
- `.github/skills/dispatcher-planning/SKILL.md`

**Validations:**
- `{ "type": "file_contains", "description": "Complexity scale documented", "filePath": ".github/skills/dispatcher-planning/SKILL.md", "searchPattern": "trivial.*simple.*moderate.*complex" }`

---

#### Task 4.3: Add Task Scoping Heuristics

**Execution Order:** 3
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "planning-detail"
**Dependencies:** [2]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Add the task scoping heuristics from Section 10 of this strategy document to the planning skill.

**AI Instructions:**
1. Add a "Task Scoping" section to `.github/skills/dispatcher-planning/SKILL.md`.
2. Include the heuristics table from Section 10:
   - Acceptance criteria count >= 2 per task
   - AI instructions present and non-empty for every task
   - Files involved listed (at least 1 per task)
   - Task scope <= 125k tokens
   - Description length >= 50 characters
   - Feature task count: 2-5 per feature
   - Feature count: 3-10 per epic
   - No circular dependencies
   - Parallel items don't share files
3. Frame these as checks the planner should run during Stage 4 (Evaluate).

**Acceptance Criteria:**
- [ ] Planning skill includes task scoping heuristics table
- [ ] All 9 heuristics from Section 10 are listed with thresholds and actions

**Files Involved:**
- `.github/skills/dispatcher-planning/SKILL.md`

**Validations:**
- `{ "type": "file_contains", "description": "Scoping heuristics present", "filePath": ".github/skills/dispatcher-planning/SKILL.md", "searchPattern": "125k tokens" }`

---

#### Task 4.4: Add Quality Evaluation Scoring

**Execution Order:** 3
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "planning-detail"
**Dependencies:** [2]
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Add a quality scoring system for Stage 4 (Evaluate) that the planner uses to assess the generated epic.

**AI Instructions:**
1. Add a "Quality Evaluation" section to the planner agent instructions (`.github/agents/planner.md`).
2. Define a scoring rubric:
   - **Structure Score** (0-100): Feature count in range? Task count per feature in range? Execution order set? Dependencies valid?
   - **Detail Score** (0-100): All structured descriptions set? AI instructions present? Acceptance criteria present? Files involved listed?
   - **Scoping Score** (0-100): Tasks appropriately sized? No overlapping file scope in parallel tasks?
   - **Overall Score**: Average of three scores. Minimum 80 to proceed.
3. The planner should output the score and list specific issues found.
4. If score < 80, the planner should fix the issues before proceeding to Stage 5.

**Acceptance Criteria:**
- [ ] Planner agent includes quality scoring rubric with three sub-scores
- [ ] Scoring thresholds are defined (minimum 80 overall)
- [ ] Planner instructions say to fix issues if score is too low

**Files Involved:**
- `.github/agents/planner.md`

**Validations:**
- `{ "type": "file_contains", "description": "Quality scoring rubric", "filePath": ".github/agents/planner.md", "searchPattern": "Structure Score" }`

---

### Feature 5: ACP Integration Layer

**Execution Order:** 2
**Estimated Complexity:** complex
**Can Parallelize:** true
**Parallel Group:** "phase-2-foundation"
**Dependencies:** none
**Risk Level:** high
**Estimated Effort:** large

**Description:**
Create a new `src/acp/` module in the orchestrator package that implements the ACP (Agent Client Protocol) client. ACP is a JSON-RPC 2.0 protocol for driving Copilot CLI sessions programmatically via stdio. This module spawns `copilot --acp` as a subprocess and communicates via JSON-RPC messages over stdin/stdout.

**AI Instructions:**
1. Create the `packages/orchestrator/src/acp/` directory.
2. Follow the existing code patterns in the orchestrator package:
   - Use the error types from `src/errors.ts` (OrchestratorError, ErrorCode)
   - Follow the config patterns from `src/config/` for any ACP-specific settings
   - Use TypeScript strict mode (the project has `exactOptionalPropertyTypes: true`)
   - Export everything from an `index.ts` barrel file
3. Refer to Appendix B of this strategy document for the ACP protocol reference.

**Acceptance Criteria:**
- [ ] `packages/orchestrator/src/acp/` module exists with types, client, session, and index files
- [ ] Can spawn a Copilot CLI process in ACP mode via `child_process.spawn`
- [ ] Can create sessions, send prompts, and receive streaming updates via JSON-RPC
- [ ] Handles process crashes with error events and cleanup
- [ ] Auto-approves permission requests in automated mode
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/acp/types.ts`
- `packages/orchestrator/src/acp/client.ts`
- `packages/orchestrator/src/acp/session.ts`
- `packages/orchestrator/src/acp/index.ts`

**Technical Notes:**
- ACP uses JSON-RPC 2.0 (see jsonrpc.org/specification). Messages are newline-delimited JSON over stdin/stdout.
- The `copilot --acp` command starts Copilot CLI in ACP server mode.
- Key JSON-RPC methods: `initialize`, `session/new`, `session/prompt`, `session/update` (notification), `session/cancel`, `session/request_permission` (callback), `session/load`.
- The project uses `exactOptionalPropertyTypes: true` in TypeScript. This means you CANNOT assign `undefined` to optional properties. Build objects and conditionally add fields instead.
- Follow the EventEmitter pattern used in `src/orchestrator/agent-pool.ts` for event-based APIs.

#### Task 5.1: Define ACP TypeScript Types

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Define comprehensive TypeScript type definitions for the ACP JSON-RPC protocol.

**AI Instructions:**
1. Create `packages/orchestrator/src/acp/types.ts`.
2. Define JSON-RPC 2.0 base types:
   ```typescript
   interface JsonRpcRequest { jsonrpc: "2.0"; id: number | string; method: string; params?: unknown; }
   interface JsonRpcResponse { jsonrpc: "2.0"; id: number | string; result?: unknown; error?: JsonRpcError; }
   interface JsonRpcNotification { jsonrpc: "2.0"; method: string; params?: unknown; }
   interface JsonRpcError { code: number; message: string; data?: unknown; }
   ```
3. Define ACP-specific message types for each method:
   - `InitializeParams` / `InitializeResult` (capabilities negotiation)
   - `SessionNewParams` (config, agent, MCP servers) / `SessionNewResult` (sessionId)
   - `SessionPromptParams` (sessionId, message) / `SessionPromptResult`
   - `SessionUpdateParams` (sessionId, type: "text" | "tool_call" | "tool_result" | "complete" | "error", content)
   - `SessionCancelParams` (sessionId)
   - `SessionRequestPermissionParams` (sessionId, tool, command) — callback from server
   - `SessionLoadParams` (sessionId) / `SessionLoadResult`
4. Define event types:
   ```typescript
   interface AcpSessionEvent { sessionId: string; type: "text" | "tool_call" | "tool_result" | "complete" | "error"; content?: string; toolName?: string; toolArgs?: unknown; toolResult?: unknown; error?: string; }
   ```
5. Remember `exactOptionalPropertyTypes: true` — do not use `field?: Type | undefined`. Use `field?: Type` (the property is either present with a value or absent).
6. Export all types.

**Acceptance Criteria:**
- [ ] All ACP JSON-RPC message types are defined
- [ ] JSON-RPC base types are correctly specified
- [ ] Session lifecycle event types are defined
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/acp/types.ts`

**Validations:**
- `{ "type": "file_exists", "description": "ACP types file exists", "filePath": "packages/orchestrator/src/acp/types.ts" }`
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

#### Task 5.2: Implement ACP Client

**Execution Order:** 2
**Estimated Complexity:** complex
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** large
**Risk Level:** high

**Description:** Implement the ACP client that spawns `copilot --acp` as a subprocess and communicates via JSON-RPC over stdio.

**AI Instructions:**
1. Create `packages/orchestrator/src/acp/client.ts`.
2. Implement class `AcpClient` extending `EventEmitter`:
   ```typescript
   export class AcpClient extends EventEmitter {
     private process: ChildProcess | null;
     private nextId: number;
     private pendingRequests: Map<number, { resolve, reject, timeout }>;
     private buffer: string; // Line-buffered stdin reader
   }
   ```
3. Constructor takes options: `{ copilotPath?: string; args?: string[]; env?: Record<string, string>; requestTimeout?: number; }`.
4. `connect()` method:
   - Spawn `copilot --acp` using `child_process.spawn` with `stdio: ['pipe', 'pipe', 'pipe']`
   - Set up stdout line reader (split on `\n`, parse each line as JSON)
   - Handle stderr for logging
   - Handle process `exit`, `error` events
   - Send `initialize` JSON-RPC request
   - Return the initialization result
5. `sendRequest(method, params)` method:
   - Create JSON-RPC request with auto-incrementing `id`
   - Write to subprocess stdin as `JSON.stringify(request) + "\n"`
   - Return a Promise that resolves when the matching response arrives
   - Add timeout handling (default 30s, configurable)
6. `onNotification(method, handler)` method:
   - Register a handler for JSON-RPC notifications (messages with no `id`)
   - Return an unsubscribe function (following the pattern from agent-pool.ts)
7. `disconnect()` method:
   - Kill the subprocess gracefully (SIGTERM, then SIGKILL after timeout)
   - Reject all pending requests
   - Clean up event listeners
8. Message routing in the stdout handler:
   - If message has `id` → it's a response → resolve the matching pending request
   - If message has no `id` → it's a notification → dispatch to registered handlers
   - If message is a `session/request_permission` callback → auto-approve if in automated mode, else emit event
9. Error handling:
   - Use `OrchestratorError` from `src/errors.ts` for ACP-specific errors
   - Handle process crash: emit `error` event, reject all pending requests, attempt restart if configured
   - Handle malformed JSON: log and skip
10. Follow the patterns in `src/dispatcher/api-client.ts` for retry logic and timeout handling.

**Acceptance Criteria:**
- [ ] `AcpClient` class can spawn a `copilot --acp` subprocess
- [ ] JSON-RPC request/response round-trip works (send request, receive response)
- [ ] Notifications are received and dispatched to handlers
- [ ] Process crash is detected and reported via error event
- [ ] Pending requests are rejected on disconnect/crash
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/acp/client.ts`

**Validations:**
- `{ "type": "file_exists", "description": "ACP client file exists", "filePath": "packages/orchestrator/src/acp/client.ts" }`
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "file_contains", "description": "Uses child_process.spawn", "filePath": "packages/orchestrator/src/acp/client.ts", "searchPattern": "child_process" }`

---

#### Task 5.3: Implement ACP Session Management

**Execution Order:** 3
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [2]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Implement session management on top of the ACP client, providing a high-level API for creating sessions, sending prompts, and receiving streaming updates.

**AI Instructions:**
1. Create `packages/orchestrator/src/acp/session.ts`.
2. Implement class `AcpSession` extending `EventEmitter`:
   ```typescript
   export class AcpSession extends EventEmitter {
     readonly sessionId: string;
     private client: AcpClient;
     private status: "idle" | "working" | "completed" | "failed";
   }
   ```
3. `AcpSession` is created by `AcpSessionManager` (see below), not directly by users.
4. Methods:
   - `send(prompt: string): Promise<string>` — Send a prompt to the session. Returns a messageId. Non-blocking (events deliver results). This mirrors the pattern from `agent-pool.ts` where `session.send()` returns a Promise<string>.
   - `sendAndWait(prompt: string, timeoutMs?: number): Promise<string>` — Send a prompt and wait for `complete` event. Returns the final text content. This mirrors `PlanGenerator.generatePlanStructure()` pattern.
   - `cancel(): Promise<void>` — Cancel the current operation.
   - `destroy(): Promise<void>` — End the session.
5. Events emitted (mirroring agent-pool.ts pattern):
   - `text` (content: string) — streaming text delta
   - `tool_call` (toolName: string, args: unknown) — tool execution started
   - `tool_result` (toolName: string, result: unknown) — tool execution completed
   - `complete` (content: string) — session reached idle state
   - `error` (error: Error) — session error
6. Implement `AcpSessionManager`:
   ```typescript
   export class AcpSessionManager {
     private client: AcpClient;
     private sessions: Map<string, AcpSession>;
     async createSession(options?: { agent?: string; systemMessage?: string }): Promise<AcpSession>;
     async destroyAll(): Promise<void>;
     getSession(id: string): AcpSession | undefined;
   }
   ```
7. `createSession` sends `session/new` via ACP client, creates `AcpSession` wrapper, registers notification handler for `session/update` events for this session, and returns the session.
8. The notification handler for `session/update` should parse the update type and emit the appropriate event on the `AcpSession` instance.

**Acceptance Criteria:**
- [ ] `AcpSession` class supports send, sendAndWait, cancel, destroy
- [ ] `AcpSessionManager` can create and destroy sessions
- [ ] Session events (text, tool_call, tool_result, complete, error) are emitted correctly
- [ ] `sendAndWait` blocks until completion or timeout
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/acp/session.ts`

**Validations:**
- `{ "type": "file_exists", "description": "ACP session file exists", "filePath": "packages/orchestrator/src/acp/session.ts" }`
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

#### Task 5.4: Create ACP Module Index and Write Unit Tests

**Execution Order:** 4
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [3]
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Create the barrel export file and write unit tests for the ACP module using mocked subprocess.

**AI Instructions:**
1. Create `packages/orchestrator/src/acp/index.ts`:
   ```typescript
   export { AcpClient, type AcpClientOptions } from "./client.js";
   export { AcpSession, AcpSessionManager, type AcpSessionOptions } from "./session.js";
   export * from "./types.js";
   ```
2. Create test file `packages/orchestrator/tests/acp/client.test.ts`:
   - Use `vitest` with `vi.fn()`, `vi.mock()`
   - Mock `child_process.spawn` to return a fake subprocess with stdin/stdout/stderr streams
   - Test: connect() spawns process and sends initialize
   - Test: sendRequest() sends JSON-RPC and resolves on response
   - Test: notification handlers are called for server notifications
   - Test: disconnect() kills process and rejects pending requests
   - Test: process crash emits error event
3. Create test file `packages/orchestrator/tests/acp/session.test.ts`:
   - Mock AcpClient
   - Test: createSession sends session/new request
   - Test: send() sends session/prompt request
   - Test: sendAndWait() resolves when complete notification arrives
   - Test: sendAndWait() rejects on timeout
   - Test: session events are emitted from notifications
4. Follow existing test patterns in `packages/orchestrator/tests/` (use `vi.useFakeTimers()` for timeouts, build objects conditionally for `exactOptionalPropertyTypes`).

**Acceptance Criteria:**
- [ ] `src/acp/index.ts` exports all public types and classes
- [ ] Client tests cover: connect, sendRequest, notifications, disconnect, crash handling
- [ ] Session tests cover: create, send, sendAndWait, timeout, events
- [ ] All tests pass: `cd packages/orchestrator && pnpm exec vitest run tests/acp/`

**Files Involved:**
- `packages/orchestrator/src/acp/index.ts`
- `packages/orchestrator/tests/acp/client.test.ts`
- `packages/orchestrator/tests/acp/session.test.ts`

**Validations:**
- `{ "type": "file_exists", "description": "ACP index exports", "filePath": "packages/orchestrator/src/acp/index.ts" }`
- `{ "type": "command", "description": "ACP tests pass", "command": "cd packages/orchestrator && pnpm exec vitest run tests/acp/", "expectedExitCode": 0 }`

---

### Feature 6: Orchestrator Refactor (SDK → ACP)

**Execution Order:** 3
**Estimated Complexity:** complex
**Can Parallelize:** true
**Parallel Group:** "phase-3-enhancement"
**Dependencies:** [Feature 5]
**Risk Level:** high
**Estimated Effort:** xl

**Description:**
Refactor the 4 SDK-coupled orchestrator modules (~5,200 lines) to use ACP instead of `@github/copilot-sdk`. This replaces `CopilotClient`/`CopilotSession` with the ACP client/session from Feature 5 throughout AgentPool, Orchestrator, PhaseExecutor, and PlanGenerator.

**AI Instructions:**
1. The key pattern change throughout: replace `CopilotClient.createSession()` with `AcpSessionManager.createSession()`, replace `session.send()` with `acpSession.send()`, replace `session.on(event, handler)` with `acpSession.on(event, handler)` (same EventEmitter pattern), replace `session.destroy()` with `acpSession.destroy()`.
2. The ACP session API (from Feature 5) is intentionally designed to mirror the Copilot SDK session API, minimizing the refactoring effort.
3. Do NOT change the model-agnostic logic: pool management, phase execution, progress tracking, Dispatcher integration, git operations, error handling patterns.
4. Work through the files in dependency order: agent-pool first (lowest level), then phase-executor (uses agent-pool), then orchestrator (uses phase-executor), then plan-generator (independent).

**Acceptance Criteria:**
- [ ] No imports from `@github/copilot-sdk` remain in the orchestrator modules
- [ ] AgentPool uses AcpSessionManager instead of CopilotClient
- [ ] PhaseExecutor spawns ACP sessions instead of SDK sessions
- [ ] PlanGenerator uses ACP session for AI plan generation
- [ ] All existing unit tests pass with mocked ACP client
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/orchestrator/agent-pool.ts`
- `packages/orchestrator/src/orchestrator/phase-executor.ts`
- `packages/orchestrator/src/orchestrator/orchestrator.ts`
- `packages/orchestrator/src/orchestrator/plan-generator.ts`
- `packages/orchestrator/src/orchestrator/recovery.ts`
- `packages/orchestrator/package.json`

**Technical Notes:**
- The Copilot SDK types used: `CopilotClient`, `CopilotSession` (inferred), `Tool<T>`. The ACP equivalents: `AcpClient`/`AcpSessionManager`, `AcpSession`, no tool type needed (tools are loaded by Copilot CLI from MCP config, not passed programmatically).
- Key SDK pattern: `session.on('assistant.message_delta', handler)` → ACP equivalent: `acpSession.on('text', handler)`.
- Key SDK pattern: `session.on('session.idle', handler)` → ACP equivalent: `acpSession.on('complete', handler)`.
- Key SDK pattern: `session.on('tool.execution_start', handler)` → ACP equivalent: `acpSession.on('tool_call', handler)`.
- The `MCP Bridge` (`src/dispatcher/mcp-bridge.ts`) defines tools using `defineTool` from `@github/copilot-sdk`. With ACP, tools are loaded by Copilot CLI from MCP server config, NOT passed to sessions programmatically. The MCP bridge tool definitions may still be useful as documentation/reference but won't be passed to ACP sessions.

#### Task 6.1: Refactor AgentPool

**Execution Order:** 1
**Estimated Complexity:** complex
**Can Parallelize:** false
**Estimated Effort:** large
**Risk Level:** high

**Description:** Replace CopilotClient with AcpSessionManager in AgentPool. This is the lowest-level change that everything else depends on.

**AI Instructions:**
1. Open `packages/orchestrator/src/orchestrator/agent-pool.ts` (795 lines).
2. Replace imports:
   - Remove: `import { CopilotClient, type Tool } from "@github/copilot-sdk";`
   - Add: `import { AcpSessionManager, type AcpSession } from "../acp/index.js";`
3. Update `AgentPoolOptions`:
   - Remove: `tools: Tool<unknown>[]` (ACP loads tools via MCP config, not programmatically)
   - Remove: `copilotClient?: CopilotClient`
   - Add: `sessionManager: AcpSessionManager`
   - Keep: `maxAgents`, `specTreeClient`, `model`
4. Update `Agent` interface:
   - Change `session: CopilotSession` to `session: AcpSession`
5. Update constructor:
   - Remove: `this.copilotClient = options.copilotClient ?? new CopilotClient()`
   - Remove: `this.tools = options.tools`
   - Add: `this.sessionManager = options.sessionManager`
6. Update `spawnAgent()` method (lines 231-286):
   - Replace `this.copilotClient.createSession({ model, systemMessage, tools })` with `this.sessionManager.createSession({ agent: "feature-worker", systemMessage: this.buildAgentPrompt(task) })`
   - The ACP session doesn't need tools passed in - they come from MCP config
7. Update `startAgent()` method (lines 295-443):
   - Replace `session.on('assistant.message_delta', ...)` with `session.on('text', ...)`
   - Replace `session.on('assistant.message', ...)` with `session.on('complete', ...)`
   - Replace `session.on('tool.execution_start', ...)` with `session.on('tool_call', ...)`
   - Replace `session.on('tool.execution_complete', ...)` with `session.on('tool_result', ...)`
   - Replace `session.on('session.idle', ...)` with handled by `complete` event
   - Replace `session.on('session.error', ...)` with `session.on('error', ...)`
   - Replace `session.send({ prompt })` with `session.send(prompt)` (ACP send takes a string)
   - The unsubscribe pattern stays the same (both return unsubscribe functions)
8. Update `terminateAgent()` to call `session.destroy()` (same API).
9. Update tests in `packages/orchestrator/tests/` to mock `AcpSessionManager` instead of `CopilotClient`.

**Acceptance Criteria:**
- [ ] No `@github/copilot-sdk` imports in agent-pool.ts
- [ ] Agent type uses `AcpSession` instead of CopilotSession
- [ ] Event mapping is correct (SDK events → ACP events)
- [ ] Pool management logic (spawn, track, terminate, capacity) unchanged
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/orchestrator/agent-pool.ts`
- `packages/orchestrator/tests/orchestrator/agent-pool.test.ts` (if exists)

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "file_contains", "description": "Uses AcpSessionManager", "filePath": "packages/orchestrator/src/orchestrator/agent-pool.ts", "searchPattern": "AcpSessionManager" }`

---

#### Task 6.2: Refactor PhaseExecutor

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Update PhaseExecutor to work with the refactored AgentPool (which now uses ACP sessions).

**AI Instructions:**
1. Open `packages/orchestrator/src/orchestrator/phase-executor.ts` (1,063 lines).
2. The PhaseExecutor uses AgentPool, not CopilotClient directly. Most changes are indirect through the updated AgentPool API.
3. Check `PhaseExecutorOptions` - if it references `Tool<T>` or CopilotClient types, remove them.
4. The agent event forwarding (lines 166-191) maps AgentPool events to PhaseExecutor events. These should still work since AgentPool's event names (`agent:message`, `agent:tool-call`, `agent:tool-result`) are internal and unchanged.
5. Verify `executeSingleTask()` (lines 650-722) still works with the new Agent type (which now has `AcpSession` instead of `CopilotSession`).
6. The `buildTaskPromptWithFeatureContext()` method (lines 727-801) builds prompts that are sent to agents. This is unchanged since it produces strings that work with both SDK and ACP.
7. Main focus: ensure the PhaseExecutor compiles and all type references are correct after the AgentPool change.

**Acceptance Criteria:**
- [ ] PhaseExecutor compiles without errors after AgentPool refactor
- [ ] No direct references to Copilot SDK types
- [ ] Phase execution logic (parallel/sequential/task-level) unchanged
- [ ] Progress tracking and Dispatcher integration unchanged

**Files Involved:**
- `packages/orchestrator/src/orchestrator/phase-executor.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

#### Task 6.3: Refactor PlanGenerator

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "refactor-parallel"
**Dependencies:** [1]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Refactor PlanGenerator to use ACP session instead of CopilotClient for AI plan generation.

**AI Instructions:**
1. Open `packages/orchestrator/src/orchestrator/plan-generator.ts` (1,558 lines).
2. Replace imports:
   - Remove: `import { CopilotClient } from "@github/copilot-sdk";`
   - Add: `import { AcpSessionManager, type AcpSession } from "../acp/index.js";`
3. Update `PlanGenerator` class:
   - Change `private copilotClient: CopilotClient` to `private sessionManager: AcpSessionManager`
   - Update constructor to accept `AcpSessionManager` instead of `CopilotClient`
4. Update `generatePlanStructure()` method (lines 521-555):
   - Replace `this.copilotClient.createSession({ model, systemMessage, tools })` with `this.sessionManager.createSession({ systemMessage: PLANNER_SYSTEM_PROMPT })`
   - Replace `session.sendAndWait({ prompt }, 300000)` with `session.sendAndWait(prompt, 300000)`
   - Replace `response.data.content` with `response` (ACP sendAndWait returns the content string directly)
   - Replace `session.destroy()` with `session.destroy()`
5. Keep ALL other logic unchanged:
   - `PLANNER_SYSTEM_PROMPT` (lines 189-308) - keep as-is
   - `parseAIResponse()` - keep as-is
   - `validatePlannerResponse()` - keep as-is
   - `createPlanInDispatcher()` - keep as-is (uses DispatcherClient, not SDK)
   - `buildMarkdownDescription()` - keep as-is
   - All types (PlannerResponse, PlannedFeature, PlannedTask, etc.) - keep as-is
6. Update the convenience function `generatePlan()` at the bottom (lines 1549-1557) to accept `AcpSessionManager` instead of `CopilotClient`.

**Acceptance Criteria:**
- [ ] No `@github/copilot-sdk` imports in plan-generator.ts
- [ ] `PLANNER_SYSTEM_PROMPT` preserved exactly as-is
- [ ] Plan parsing and validation logic preserved exactly as-is
- [ ] Dispatcher creation logic preserved exactly as-is
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/orchestrator/plan-generator.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "file_contains", "description": "PLANNER_SYSTEM_PROMPT preserved", "filePath": "packages/orchestrator/src/orchestrator/plan-generator.ts", "searchPattern": "PLANNER_SYSTEM_PROMPT" }`

---

#### Task 6.4: Refactor Orchestrator and Recovery, Remove SDK Dependency

**Execution Order:** 3
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [2, 3]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Refactor the top-level Orchestrator and Recovery modules, then remove the `@github/copilot-sdk` package dependency.

**AI Instructions:**
1. Open `packages/orchestrator/src/orchestrator/orchestrator.ts` (1,080 lines):
   - Replace CopilotClient references with AcpSessionManager
   - Update constructor to create/accept AcpSessionManager
   - Update the method that creates AgentPool to pass AcpSessionManager instead of CopilotClient and tools
   - Keep all phase coordination, error handling, and Dispatcher integration unchanged
2. Open `packages/orchestrator/src/orchestrator/recovery.ts` (626 lines):
   - Replace any CopilotClient/CopilotSession references with ACP types
   - Checkpoint/restore logic for session state may need adaptation since ACP sessions are process-based
3. Update `packages/orchestrator/src/orchestrator/index.ts` to re-export ACP types if needed.
4. Check `packages/orchestrator/package.json` for `@github/copilot-sdk` in dependencies. If no other file imports it, remove it: `cd packages/orchestrator && pnpm remove @github/copilot-sdk`
5. Run `pnpm exec tsc --noEmit` to verify the entire package compiles.
6. Run existing tests: `pnpm exec vitest run` (some may fail due to changed mock interfaces - update mocks as needed).

**Acceptance Criteria:**
- [ ] No `@github/copilot-sdk` imports anywhere in `packages/orchestrator/src/`
- [ ] `@github/copilot-sdk` removed from package.json (if no longer used)
- [ ] TypeScript compiles without errors across the entire orchestrator package
- [ ] Existing tests pass (with updated mocks)

**Files Involved:**
- `packages/orchestrator/src/orchestrator/orchestrator.ts`
- `packages/orchestrator/src/orchestrator/recovery.ts`
- `packages/orchestrator/src/orchestrator/index.ts`
- `packages/orchestrator/package.json`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`
- `{ "type": "command", "description": "Tests pass", "command": "cd packages/orchestrator && pnpm exec vitest run", "expectedExitCode": 0 }`

---

### Feature 7: CLI Command Updates

**Execution Order:** 4
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "phase-4-integration"
**Dependencies:** [Feature 5, Feature 6]
**Risk Level:** low
**Estimated Effort:** medium

**Description:**
Update the orchestrator CLI with new commands for the planning pipeline (`dispatcher plan`) and validation (`dispatcher validate`), and update the existing run command to use ACP. The CLI framework is in `packages/orchestrator/src/cli/`.

**AI Instructions:**
1. Read the existing CLI structure in `packages/orchestrator/src/cli/` to understand the command framework.
2. Read `packages/orchestrator/src/cli/state.ts` (352 lines) for CLI state management patterns.
3. New commands should follow the existing patterns for argument parsing, config loading, and error display.

**Acceptance Criteria:**
- [ ] `dispatcher plan "<description>"` invokes the planner via ACP and creates a Dispatcher epic
- [ ] `dispatcher validate <epic-id>` runs all validations for an epic's tasks and reports results
- [ ] `dispatcher run <epic-id>` executes an epic via ACP sessions
- [ ] `dispatcher run --dry-run <epic-id>` shows the execution plan without executing
- [ ] All commands have `--help` documentation
- [ ] TypeScript compiles without errors

**Files Involved:**
- `packages/orchestrator/src/cli/index.ts`
- `packages/orchestrator/src/cli/state.ts`

**Technical Notes:**
- The CLI uses the config system from `src/config/` for API URL, token, model settings.
- CLI output uses the UI components from `src/ui/` (progress bars, spinners, agent status).

#### Task 7.1: Add `plan` Command

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** true
**Parallel Group:** "cli-commands"
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Add the `dispatcher plan "<description>"` command that invokes the planner agent via ACP to create a Dispatcher epic.

**AI Instructions:**
1. Add a `plan` command handler to the CLI.
2. The command takes a required string argument: the natural language description.
3. Optional flags: `--team <name>` (default: auto-detect), `--dry-run` (show plan without creating), `--gates <config>` (review gate configuration).
4. Implementation:
   - Create AcpClient, connect to Copilot CLI in ACP mode
   - Create a session with the planner agent: `sessionManager.createSession({ agent: "planner" })`
   - Send the description as a prompt with gate configuration
   - Stream progress to terminal using UI components from `src/ui/progress.ts`
   - On completion: display the created epic summary (name, features, tasks, execution plan)
5. Handle errors: if ACP connection fails, suggest checking Copilot CLI installation.

**Acceptance Criteria:**
- [ ] `dispatcher plan "Build a user preferences API"` creates an epic via the planner agent
- [ ] `dispatcher plan --dry-run "..."` shows what would be created without creating
- [ ] Progress is displayed in the terminal during planning
- [ ] Created epic summary is displayed on completion

**Files Involved:**
- `packages/orchestrator/src/cli/index.ts` (add command registration)

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

#### Task 7.2: Add `validate` Command

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "cli-commands"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Add the `dispatcher validate <epic-id>` command that runs all validations for an epic's tasks.

**AI Instructions:**
1. Add a `validate` command handler to the CLI.
2. The command takes a required argument: epic ID or name.
3. Implementation:
   - Use DispatcherClient (from `src/dispatcher/api-client.ts`) to get the epic
   - List all features and tasks for the epic
   - For each task with validations: call `dispatcherClient.runAllValidations(taskId)`
   - Aggregate results and display a summary table
4. Output format: table showing task identifier, validation count, passed, failed, status.
5. Exit code: 0 if all pass, 1 if any fail.

**Acceptance Criteria:**
- [ ] `dispatcher validate <epic-id>` runs all validations for the epic
- [ ] Output shows per-task validation results
- [ ] Exit code reflects pass/fail status

**Files Involved:**
- `packages/orchestrator/src/cli/index.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

#### Task 7.3: Update `run` Command for ACP

**Execution Order:** 2
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Dependencies:** [1, 2]
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Update the existing `dispatcher run <epic-id>` command to use ACP instead of the Copilot SDK, and add `--dry-run`, `--phase`, and `--parallel` flags.

**AI Instructions:**
1. Find the existing `run` command in the CLI framework.
2. Update it to:
   - Create AcpClient and AcpSessionManager
   - Use the refactored Orchestrator (from Feature 6) which now uses ACP
   - Add `--dry-run` flag: show execution plan phases without executing
   - Add `--phase <n>` flag: execute only phase N
   - Add `--parallel <n>` flag: max concurrent ACP sessions (default: 4)
3. Display execution progress using UI components.
4. On completion: show summary of completed/failed features, total duration.

**Acceptance Criteria:**
- [ ] `dispatcher run <epic-id>` executes the epic via ACP
- [ ] `dispatcher run --dry-run <epic-id>` shows execution plan
- [ ] `dispatcher run --phase 2 <epic-id>` executes only phase 2
- [ ] `dispatcher run --parallel 2 <epic-id>` limits to 2 concurrent sessions
- [ ] Execution progress is displayed in the terminal

**Files Involved:**
- `packages/orchestrator/src/cli/index.ts`

**Validations:**
- `{ "type": "command", "description": "TypeScript compiles", "command": "cd packages/orchestrator && pnpm exec tsc --noEmit", "expectedExitCode": 0 }`

---

### Feature 8: Shell Scripts for Automation

**Execution Order:** 4
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "phase-4-integration"
**Dependencies:** [Feature 2, Feature 3]
**Risk Level:** low
**Estimated Effort:** small

**Description:**
Create shell scripts for headless execution of common workflows, enabling one-command automation and CI/CD integration. These scripts use Copilot CLI's headless mode (`-p` flag) with the custom agents.

**AI Instructions:**
1. Create the `scripts/` directory at the project root if it doesn't exist.
2. Each script should be a bash script with: shebang, usage help, environment variable configuration, error handling.
3. Scripts use `copilot -p "<prompt>" --allow-all-tools --agent=<name>` for headless execution.

**Acceptance Criteria:**
- [ ] All scripts are executable (`chmod +x`)
- [ ] All scripts have `--help` that shows usage
- [ ] Environment variables configure API URL and token
- [ ] Scripts exit with appropriate error codes (0 success, 1 failure)

**Files Involved:**
- `scripts/dispatcher-plan.sh`
- `scripts/dispatcher-run.sh`
- `scripts/dispatcher-validate.sh`

#### Task 8.1: Create dispatcher-plan.sh

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "scripts"
**Estimated Effort:** trivial
**Risk Level:** low

**Description:** Create a shell script for headless epic planning.

**AI Instructions:**
1. Create `scripts/dispatcher-plan.sh`:
   ```bash
   #!/bin/bash
   set -euo pipefail

   # Usage
   if [[ "${1:-}" == "--help" ]] || [[ $# -lt 1 ]]; then
     echo "Usage: dispatcher-plan.sh <description> [--team <name>]"
     echo "Creates a Dispatcher epic from a natural language description."
     echo ""
     echo "Environment variables:"
     echo "  SPECTREE_API_URL  - Dispatcher API URL (default: http://localhost:3001)"
     echo "  SPECTREE_TOKEN    - Dispatcher API token"
     exit 0
   fi

   DESCRIPTION="$1"
   TEAM="${2:-}"

   PROMPT="Create a Dispatcher epic for: ${DESCRIPTION}"
   if [[ -n "$TEAM" ]]; then
     PROMPT="${PROMPT}. Use team: ${TEAM}"
   fi

   copilot -p "@planner ${PROMPT}" --allow-all-tools
   ```
2. Make executable: `chmod +x scripts/dispatcher-plan.sh`.

**Acceptance Criteria:**
- [ ] Script exists and is executable
- [ ] `--help` shows usage
- [ ] Script invokes Copilot CLI with the planner agent

**Files Involved:**
- `scripts/dispatcher-plan.sh`

**Validations:**
- `{ "type": "file_exists", "description": "Plan script exists", "filePath": "scripts/dispatcher-plan.sh" }`

---

#### Task 8.2: Create dispatcher-run.sh and dispatcher-validate.sh

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "scripts"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Create shell scripts for headless epic execution and validation.

**AI Instructions:**
1. Create `scripts/dispatcher-run.sh` following the same pattern as dispatcher-plan.sh:
   - Takes epic ID as argument
   - Invokes `copilot -p "@orchestrator Execute epic ${EPIC_ID}" --allow-all-tools`
   - Optional `--phase <n>` flag passed through to the prompt
2. Create `scripts/dispatcher-validate.sh`:
   - Takes epic ID as argument
   - Invokes the orchestrator CLI directly: `npx dispatcher validate "${EPIC_ID}"`
   - (Uses the CLI command from Feature 7, not Copilot CLI, since validation is deterministic)
3. Make both executable.

**Acceptance Criteria:**
- [ ] Both scripts exist and are executable
- [ ] dispatcher-run.sh invokes the orchestrator agent
- [ ] dispatcher-validate.sh runs validation via CLI

**Files Involved:**
- `scripts/dispatcher-run.sh`
- `scripts/dispatcher-validate.sh`

**Validations:**
- `{ "type": "file_exists", "description": "Run script exists", "filePath": "scripts/dispatcher-run.sh" }`
- `{ "type": "file_exists", "description": "Validate script exists", "filePath": "scripts/dispatcher-validate.sh" }`

---

### Feature 9: Copilot Instructions Update

**Execution Order:** 4
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "phase-4-integration"
**Dependencies:** [Feature 1, Feature 2, Feature 3]
**Risk Level:** low
**Estimated Effort:** small

**Description:**
Update `.github/copilot-instructions.md` to document the custom agents and skills, add the automation workflow to the session checklist, and ensure all MCP sections are active.

**AI Instructions:**
1. After Feature 1 re-enables MCP sections, this feature adds documentation for the new agents and skills.
2. Do NOT re-do the MCP re-enablement (that's Feature 1, Task 1.4). This feature only adds new content.

**Acceptance Criteria:**
- [ ] Custom agents section documents `@planner`, `@orchestrator`, `@reviewer` with usage examples
- [ ] Custom skills section documents available skills
- [ ] Session Start Checklist includes Dispatcher session initialization
- [ ] Automation Workflow section explains `dispatcher plan` and `dispatcher run`

**Files Involved:**
- `.github/copilot-instructions.md`

#### Task 9.1: Add Custom Agents Documentation

**Execution Order:** 1
**Estimated Complexity:** simple
**Can Parallelize:** true
**Parallel Group:** "docs"
**Estimated Effort:** small
**Risk Level:** low

**Description:** Add a section to copilot-instructions.md documenting the custom agents.

**AI Instructions:**
1. Add a new section `## Custom Agents` to `.github/copilot-instructions.md` (after the Architecture section, before Build/Test/Lint).
2. Document each user-invokable agent:
   ```markdown
   ## Custom Agents

   ### @planner - Dispatcher Planning Pipeline
   Creates structured Dispatcher epics from natural language descriptions.
   ```
   Usage: @planner "Build a user activity dashboard"
   ```
   Runs a 5-stage pipeline: Analyze → Decompose → Detail → Evaluate → Verify.
   Supports review gates: `@planner --gates=auto "..."` to skip reviews.

   ### @orchestrator - Epic Execution
   Executes Dispatcher execution plans by delegating features to sub-agents.
   ```
   Usage: @orchestrator "Execute epic ENG-42"
   ```
   Reads the execution plan, spawns feature-worker sub-agents in parallel where safe.

   ### @reviewer - Acceptance Review
   Reviews completed features against Dispatcher acceptance criteria.
   ```
   Usage: @reviewer "Review feature ENG-42-1"
   ```
   Runs validations and checks code quality against structured descriptions.
   ```
3. Note that `feature-worker` is a sub-agent only (not directly invokable).

**Acceptance Criteria:**
- [ ] Custom Agents section exists with 3 user-invokable agents documented
- [ ] Each agent has a usage example
- [ ] feature-worker noted as sub-agent only

**Files Involved:**
- `.github/copilot-instructions.md`

**Validations:**
- `{ "type": "file_contains", "description": "Agents section exists", "filePath": ".github/copilot-instructions.md", "searchPattern": "Custom Agents" }`

---

#### Task 9.2: Add Automation Workflow and Update Checklist

**Execution Order:** 2
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Add an automation workflow section and update the session start checklist.

**AI Instructions:**
1. Add a `## Automation Workflow` section documenting:
   - `dispatcher plan "<description>"` - CLI command for planning
   - `dispatcher run <epic-id>` - CLI command for execution
   - `dispatcher validate <epic-id>` - CLI command for validation
   - Shell scripts in `scripts/` for headless execution
2. Update the `SESSION START CHECKLIST` section to add:
   - Check if working on a Dispatcher epic: `dispatcher__list_epics`
   - If yes: `dispatcher__start_session({ epicId })` to initialize session context
   - Review previous session context for continuity
3. Add a `## Custom Skills` section noting the 3 skills: dispatcher-planning, dispatcher-session, dispatcher-validation.

**Acceptance Criteria:**
- [ ] Automation Workflow section documents CLI commands and scripts
- [ ] Session Start Checklist includes Dispatcher session initialization
- [ ] Custom Skills section lists available skills

**Files Involved:**
- `.github/copilot-instructions.md`

**Validations:**
- `{ "type": "file_contains", "description": "Automation section exists", "filePath": ".github/copilot-instructions.md", "searchPattern": "Automation Workflow" }`

---

### Feature 10: End-to-End Testing

**Execution Order:** 5
**Estimated Complexity:** complex
**Can Parallelize:** false
**Dependencies:** [Feature 1, Feature 2, Feature 3, Feature 4, Feature 5, Feature 6, Feature 7, Feature 8, Feature 9]
**Risk Level:** medium
**Estimated Effort:** large

**Description:**
Validate the entire automation tool end-to-end: use the planner to create an epic, use the orchestrator to execute it, verify results. Write a quickstart guide and have a colleague run the workflow without guidance. This feature is the final validation that everything works together.

**AI Instructions:**
1. This feature depends on ALL other features being complete.
2. Use a small, well-defined test scenario: "Add a new REST API endpoint for user preferences with CRUD operations."
3. The test exercises: planning pipeline → Dispatcher epic creation → execution engine → ACP sessions → git branches → Dispatcher progress tracking → validation → completion.

**Acceptance Criteria:**
- [ ] Planning pipeline creates a well-structured epic from natural language
- [ ] Execution engine completes all tasks with correct Dispatcher progress tracking
- [ ] Git branches are created per feature and merged after completion
- [ ] Validations pass for all completed tasks
- [ ] A colleague can run the full workflow using only the quickstart guide

**Files Involved:**
- `docs/automation-quickstart.md`
- `packages/orchestrator/tests/e2e/` (test files)

**Technical Notes:**
- E2E tests require a running Dispatcher API, MCP server, and Copilot CLI.
- Tests may consume Copilot premium requests. Use the smallest possible test scenario.
- The colleague test is a manual acceptance criterion - document any issues found.

#### Task 10.1: Create Test Scenario and Run Planning Pipeline

**Execution Order:** 1
**Estimated Complexity:** moderate
**Can Parallelize:** false
**Estimated Effort:** medium
**Risk Level:** medium

**Description:** Define a test scenario and run the planning pipeline to create a test epic.

**AI Instructions:**
1. Define the test scenario: "Add a REST API endpoint at `/api/v1/preferences` with GET, PUT operations for user preferences. Store preferences in a new Prisma model. Add validation with Zod schemas."
2. Run: `@planner "Add a REST API endpoint at /api/v1/preferences with GET, PUT operations for user preferences. Store preferences in a new Prisma model. Add validation with Zod schemas."`
3. Verify the created epic has:
   - 3-5 features (database, API routes, validation, tests)
   - Each feature has 2-4 tasks
   - All tasks have acceptance criteria and AI instructions
   - Execution plan has correct phase ordering
4. Document any issues with the planning output.

**Acceptance Criteria:**
- [ ] Test epic is created in Dispatcher via the planner agent
- [ ] Epic has reasonable structure (3-5 features with tasks)
- [ ] All items have structured descriptions
- [ ] Execution plan is valid

**Files Involved:**
- (No code changes - testing only)

**Validations:**
- `{ "type": "manual", "description": "Test epic created with valid structure" }`

---

#### Task 10.2: Run Execution Engine on Test Epic

**Execution Order:** 2
**Estimated Complexity:** complex
**Can Parallelize:** false
**Dependencies:** [1]
**Estimated Effort:** large
**Risk Level:** high

**Description:** Execute the test epic using the orchestrator and verify all tasks complete correctly.

**AI Instructions:**
1. Run: `dispatcher run <test-epic-id>` (or `@orchestrator "Execute epic <test-epic-id>"`)
2. Monitor execution:
   - Are ACP sessions being created?
   - Are worker agents reading task requirements from Dispatcher?
   - Are progress updates appearing in Dispatcher?
   - Are git branches being created?
   - Are files being modified?
3. After completion:
   - Check Dispatcher: are all tasks marked Done?
   - Check git: are feature branches created and merged?
   - Run validations: `dispatcher validate <test-epic-id>`
4. Document any failures, errors, or issues.

**Acceptance Criteria:**
- [ ] Execution engine runs all phases of the test epic
- [ ] All tasks are marked complete in Dispatcher
- [ ] Git branches were created and merged
- [ ] Validations pass

**Files Involved:**
- (No code changes - testing only)

**Validations:**
- `{ "type": "manual", "description": "Test epic executed successfully with all tasks complete" }`

---

#### Task 10.3: Write Quickstart Guide

**Execution Order:** 3
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [2]
**Estimated Effort:** small
**Risk Level:** low

**Description:** Write `docs/automation-quickstart.md` - a colleague-facing guide for running the full automation workflow.

**AI Instructions:**
1. Create `docs/automation-quickstart.md` with:
   - **Prerequisites**: Dispatcher API running, MCP server running, Copilot CLI installed, agents and skills in place
   - **Step 1: Plan** - How to run `@planner` with a description
   - **Step 2: Review** - How to view the epic in Dispatcher web UI and verify structure
   - **Step 3: Execute** - How to run `dispatcher run <epic-id>`
   - **Step 4: Verify** - How to run `dispatcher validate <epic-id>` and review results
   - **Troubleshooting**: Common issues and solutions
2. Write for someone who has never used Dispatcher or the automation tool.
3. Include screenshots or terminal output examples where helpful.
4. Based on learnings from Tasks 10.1 and 10.2 - document any gotchas discovered during testing.

**Acceptance Criteria:**
- [ ] `docs/automation-quickstart.md` exists
- [ ] Covers prerequisites, plan, review, execute, verify steps
- [ ] Written for a colleague unfamiliar with the workflow
- [ ] Includes troubleshooting section

**Files Involved:**
- `docs/automation-quickstart.md`

**Validations:**
- `{ "type": "file_exists", "description": "Quickstart guide exists", "filePath": "docs/automation-quickstart.md" }`

---

#### Task 10.4: Colleague Validation

**Execution Order:** 4
**Estimated Complexity:** simple
**Can Parallelize:** false
**Dependencies:** [3]
**Estimated Effort:** medium
**Risk Level:** low

**Description:** Have a colleague run the full workflow using only the quickstart guide. Document any issues they encounter.

**AI Instructions:**
1. Give the colleague `docs/automation-quickstart.md` and access to the development environment.
2. The colleague should follow the guide to:
   - Plan an epic using `@planner`
   - Review the epic in Dispatcher
   - Execute the epic using `dispatcher run`
   - Validate the results
3. The colleague should NOT receive any verbal guidance - only the quickstart document.
4. Document all issues:
   - Steps that were unclear
   - Errors encountered
   - Things they had to ask about
5. Create follow-up tasks for any issues found.

**Acceptance Criteria:**
- [ ] Colleague completed the workflow using only the quickstart guide
- [ ] Issues documented with severity (blocking / confusing / minor)
- [ ] Follow-up tasks created for any issues found

**Files Involved:**
- (No code changes - manual validation)

**Validations:**
- `{ "type": "manual", "description": "Colleague completed workflow using quickstart guide" }`

---

## 9. Execution Order & Parallelism

```
Phase 1: Feature 1 (MCP Stability Fix & Re-enablement)
         ├── BLOCKER for testing and runtime use of all other features
         └── Should complete first - agents/skills/ACP can be written
             in parallel but cannot be tested without working MCP

Phase 2: Features 2, 3, 5 (PARALLEL)
         ├── Feature 2: Custom Agents
         ├── Feature 3: Custom Skills
         └── Feature 5: ACP Integration Layer
         These are independent: agents/skills are Markdown files,
         ACP is TypeScript code. No shared files.

Phase 3: Features 4, 6 (PARALLEL)
         ├── Feature 4: Planning Pipeline Enhancement (depends on 2, 3)
         └── Feature 6: Orchestrator Refactor SDK→ACP (depends on 5)
         Feature 4 enhances agents/skills from Phase 2.
         Feature 6 uses ACP layer from Phase 2.
         They don't overlap in files.

Phase 4: Features 7, 8, 9 (PARALLEL)
         ├── Feature 7: CLI Command Updates (depends on 5, 6)
         ├── Feature 8: Shell Scripts (depends on 2, 3)
         └── Feature 9: Copilot Instructions Update (depends on 1, 2, 3)
         All are relatively independent integration work.

Phase 5: Feature 10 (End-to-End Testing)
         └── Depends on ALL features 1-9
         Must be last - validates the complete system.
```

### Dependency Graph

```
Feature 1 (MCP Fix)
    │
    ├───────────────────────────────────────── Feature 9 (Instructions)
    │
    ▼
Feature 2 (Agents) ──────┬──────────────────── Feature 8 (Scripts)
    │                     │                         │
    │                     ▼                         │
    ├──────────────► Feature 4 (Planning Enhancement)
    │                                               │
Feature 3 (Skills) ──────┘                         │
    │                                               │
    ├──────────────────────────────────────────────►│
    │                                               │
Feature 5 (ACP Layer)                               │
    │                                               │
    ▼                                               │
Feature 6 (SDK→ACP Refactor)                        │
    │                                               │
    ▼                                               │
Feature 7 (CLI Commands) ─────────────────────────►│
                                                    │
                                                    ▼
                                              Feature 10 (E2E Testing)
```

---

## 10. Task Scoping Guidelines

### Token Budget Per Task

Each task should be scoped to approximately **one Copilot CLI session (~125k tokens)**. This is roughly:

- **Trivial** (~15 min, ~10k tokens): Config changes, single-file edits, simple fixes
- **Simple** (~1 hour, ~30k tokens): Well-defined single-purpose changes across 1-3 files
- **Moderate** (~2-4 hours, ~80k tokens): Multi-file changes with some complexity, requires understanding context
- **Complex** (~4+ hours, ~125k tokens): Major implementation across many files, requires architectural decisions

### Self-Containment Rules

Each task must be **self-contained** - an AI agent should be able to complete it with only the information in Dispatcher (structured description, AI instructions, acceptance criteria, files involved) plus codebase access. Specifically:

1. **No implicit dependencies** - If task B requires knowing what task A produced, task B's description must say "Read the output of task A from [specific file/location]"
2. **Concrete file references** - "Modify the API client" is bad. "Modify `packages/orchestrator/src/dispatcher/api-client.ts`" is good.
3. **Explicit acceptance criteria** - Every task needs at least 2 verifiable acceptance criteria
4. **AI instructions** - Step-by-step implementation guidance specific enough for a fresh AI session

### Quality Heuristics

The planning pipeline should evaluate tasks against these heuristics:

| Heuristic | Threshold | Action if Violated |
|-----------|-----------|-------------------|
| Acceptance criteria count | >= 2 per task | Add more criteria |
| AI instructions present | Non-empty for every task | Add implementation steps |
| Files involved listed | At least 1 file per task | Identify target files |
| Task scope (estimated) | <= 125k tokens (complex) | Split into smaller tasks |
| Description length | >= 50 characters | Expand description |
| Feature task count | 2-5 tasks per feature | Split or merge features |
| Feature count per epic | 3-10 features | Adjust scope |
| Dependency validity | No circular dependencies | Fix dependency graph |
| Parallel safety | Parallel items don't share files | Add dependencies or separate |

---

## 11. Verification Strategy

### Planning Pipeline Verification

1. **Create a test epic** - Use the planner agent to create an epic for a known scenario (e.g., "Add a new REST endpoint for user preferences with CRUD operations")
2. **Verify structure** - Epic has 3-7 features, each with 2-5 tasks
3. **Verify detail** - Every feature and task has structured descriptions with acceptance criteria, AI instructions, files involved
4. **Verify execution plan** - `dispatcher__get_execution_plan` returns phases with correct ordering and parallelism
5. **Verify scoping** - Tasks are scoped to ~125k tokens as measured by description + AI instructions length

### Execution Engine Verification

1. **Execute the test epic** - Run `dispatcher run <test-epic-id>`
2. **Verify ACP sessions** - Sessions are spawned correctly, prompts include full Dispatcher context
3. **Verify progress tracking** - Dispatcher shows real-time progress updates during execution
4. **Verify git integration** - Feature branches created, changes committed, branches merged
5. **Verify completion** - All tasks marked done in Dispatcher, validations pass

### Integration Verification (Colleague Test)

The ultimate test: a colleague who has NOT built the automation tool should be able to:

1. Read `docs/automation-quickstart.md`
2. Run `@planner "Build a feature to export dashboard data as CSV"`
3. Review the generated epic in Dispatcher
4. Run `dispatcher run <epic-id>`
5. Verify the feature was implemented correctly

If the colleague can do this without asking for help, the automation tool is successful.

---

## 12. Appendices

### Appendix A: MCP Tools Quick Reference

**Planning tools** (used by planner agent):
- `dispatcher__list_teams` - Discover teams
- `dispatcher__create_epic_complete` - Create full epic hierarchy atomically
- `dispatcher__set_structured_description` - Set AI instructions, acceptance criteria, etc.
- `dispatcher__set_execution_metadata` - Set execution order, dependencies, parallelism
- `dispatcher__get_execution_plan` - Generate phased execution plan
- `dispatcher__list_templates` / `dispatcher__create_from_template` - Template-based creation

**Execution tools** (used by worker sessions):
- `dispatcher__start_work` / `dispatcher__complete_work` - Work lifecycle
- `dispatcher__log_progress` - Report incremental progress
- `dispatcher__log_decision` - Record implementation decisions
- `dispatcher__link_code_file` - Track modified files
- `dispatcher__run_all_validations` - Verify acceptance criteria
- `dispatcher__complete_task_with_validation` - Atomic validate + complete
- `dispatcher__append_ai_note` - Leave notes for future sessions
- `dispatcher__report_blocker` - Report blocking issues

**Context tools** (used by any session):
- `dispatcher__get_structured_description` - Read requirements
- `dispatcher__get_ai_context` - Read previous session context
- `dispatcher__get_code_context` - Read linked code artifacts
- `dispatcher__get_decision_context` - Read past decisions
- `dispatcher__get_progress_summary` - Read epic progress
- `dispatcher__search` - Search across all items

### Appendix B: ACP Protocol Reference

ACP (Agent Client Protocol) uses JSON-RPC 2.0 over stdio or TCP.

**Starting ACP:**
```bash
copilot --acp              # stdio mode (recommended for orchestrator)
copilot --acp --port 8080  # TCP mode
```

**Key JSON-RPC methods:**

| Method | Direction | Purpose |
|--------|-----------|---------|
| `initialize` | Client → Server | Negotiate capabilities |
| `session/new` | Client → Server | Create a new session with config |
| `session/prompt` | Client → Server | Send message to session |
| `session/update` | Server → Client | Streaming progress notification |
| `session/cancel` | Client → Server | Abort current operation |
| `session/request_permission` | Server → Client | Permission gate callback |
| `session/load` | Client → Server | Resume a previous session |

**Session lifecycle:**
```
initialize → session/new → session/prompt ←→ session/update → (repeat) → session/cancel
```

**Permission handling for automation:**
When running in automated mode, the orchestrator should auto-approve permission requests:
```json
// Server sends:
{"method": "session/request_permission", "params": {"tool": "shell", "command": "git checkout -b ..."}}

// Client responds:
{"result": {"approved": true}}
```

### Appendix C: Copilot CLI Headless Mode Reference

**Flags for headless execution:**

| Flag | Purpose |
|------|---------|
| `-p` / `--prompt` | Non-interactive single prompt |
| `--allow-all-tools` | Auto-approve all tool executions |
| `--allow-all-paths` | Auto-approve filesystem access |
| `--allow-all` / `--yolo` | Enable all permissions |
| `--agent=<name>` | Use specific custom agent |
| `--additional-mcp-config` | Load extra MCP servers |
| `--silent` | Suppress output |
| `--continue` | Resume most recent session |
| `--resume <id>` | Resume specific session |

**Example headless commands:**
```bash
# Plan an epic
copilot -p "@planner Build a user activity dashboard" --allow-all-tools

# Execute an epic
copilot -p "@orchestrator Execute epic ENG-42" --allow-all-tools

# Review completed work
copilot -p "@reviewer Review feature ENG-42-1" --allow-all-tools
```

### Appendix D: Reusable Code Reference

Files in `packages/orchestrator/src/` that can be reused directly (no SDK dependency):

| File | Lines | Reuse Strategy |
|------|-------|----------------|
| `dispatcher/api-client.ts` | 1,527 | Use as-is. Full HTTP client for Dispatcher API. |
| `dispatcher/mcp-bridge.ts` | 1,007 | Adapt tool schemas for agent prompt templates. Handler logic reusable. |
| `git/branch-manager.ts` | 383 | Use as-is. Git branch CRUD operations. |
| `git/merge-coordinator.ts` | 347 | Use as-is. Merge strategies and conflict detection. |
| `errors.ts` | 660 | Use as-is. Typed error hierarchy with codes and serialization. |
| `config/loader.ts` | 323 | Use as-is. Config loading from env vars and files. |
| `config/schemas.ts` | 79 | Use as-is. Zod schemas for config validation. |
| `config/index.ts` | 185 | Use as-is. Config module entry point. |
| `ui/agent-status.ts` | 531 | Use as-is. Terminal UI for agent status display. |
| `ui/progress.ts` | 467 | Use as-is. Progress bar and spinner integration. |
| `ui/task-progress.ts` | 177 | Use as-is. Task-level progress display. |
| `ui/activity-tracker.ts` | 124 | Use as-is. Activity logging display. |
| `cli/state.ts` | 352 | Use as-is. CLI state management. |

Files that need refactoring (SDK dependency):

| File | Lines | Refactor Required |
|------|-------|-------------------|
| `orchestrator/agent-pool.ts` | 795 | Replace `CopilotClient` with ACP client |
| `orchestrator/orchestrator.ts` | 1,080 | Replace session management with ACP |
| `orchestrator/phase-executor.ts` | 1,063 | Replace agent spawning with ACP sessions |
| `orchestrator/plan-generator.ts` | 1,558 | Replace `createSession`/`sendAndWait` with ACP |
| `orchestrator/recovery.ts` | 626 | Adapt checkpoint/restore for ACP sessions |

### Appendix E: Existing Prompt Engineering Artifacts

**PLANNER_SYSTEM_PROMPT** (plan-generator.ts:189-308)

A proven 119-line system prompt that instructs AI to produce structured JSON with:
- Epic name and description with AI instructions and acceptance criteria
- 3-7 features with execution ordering, dependencies, parallelism, complexity estimates
- 2-5 tasks per feature with AI instructions, acceptance criteria, files involved
- Validation checks (command, file_exists, file_contains, test_passes, manual)
- Risk levels (low/medium/high) and effort estimates (trivial/small/medium/large/xl)

This prompt should be adapted as the foundation of the planning skill's decomposition stage.

**PARALLEL_AGENT_SYSTEM_PROMPT** (agent-pool.ts:151-180)

A 30-line system prompt establishing:
- Parallel execution context (isolated branches, no cross-agent interference)
- Available Dispatcher tools (log_progress, log_decision, link_code_file, etc.)
- Workflow: review → plan → implement → log → test → complete

This prompt should be adapted for the feature-worker agent definition.

**Task Prompt Builder** (phase-executor.ts:727-801)

A rich prompt template that includes:
- Task/feature identification and parent context
- Structured description content
- Concrete tool usage examples with JSON payloads
- Step-by-step workflow instructions
- Progress tracking requirements

This template should be adapted for ACP session context injection.
