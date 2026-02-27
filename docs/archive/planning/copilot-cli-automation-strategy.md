# Copilot CLI Automation Strategy for Dispatcher

**Date:** February 6, 2026
**Author:** Analysis by Claude Opus 4.6
**Status:** Strategic Recommendation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [What You're Doing Right](#what-youre-doing-right)
4. [What You're Doing Wrong (or Suboptimally)](#what-youre-doing-wrong-or-suboptimally)
5. [The #runSubagent Opportunity](#the-runsubagent-opportunity)
6. [Proposed Architecture: Feature Sessions + Task Subagents](#proposed-architecture-feature-sessions--task-subagents)
7. [Copilot CLI Features You're Not Using](#copilot-cli-features-youre-not-using)
8. [The Orchestrator Decision: Build vs. Native](#the-orchestrator-decision-build-vs-native)
9. [Recommended Implementation Roadmap](#recommended-implementation-roadmap)
10. [Appendix: Copilot CLI Tool Reference](#appendix-copilot-cli-tool-reference)

---

## Executive Summary

Your instinct is correct: **Dispatcher + Copilot CLI can achieve Claude Code-level orchestration, and you're closer than you think.** But the approach needs a fundamental shift.

The current Dispatcher orchestrator (`packages/orchestrator/`) was designed as a custom Copilot SDK application that programmatically spawns and manages `CopilotSession` objects. This was the right design for late 2025. But as of January 2026, Copilot CLI has shipped native features that make most of that custom orchestration unnecessary:

| Capability You Built | Native Copilot CLI Equivalent (Jan 2026+) |
|---|---|
| `AgentPool` (parallel sessions) | `#runSubagent` with parallel execution |
| `PhaseExecutor` (phase sequencing) | Custom agents with `agents:` field + orchestrator agent |
| `MCP Bridge` (Dispatcher tools for agents) | MCP server loaded directly via `--additional-mcp-config` or agent YAML |
| `PlanGenerator` (prompt → epic) | Built-in Plan agent + Dispatcher MCP tools |
| Progress tracking | `log_progress` / `append_ai_note` via MCP tools |

**The recommendation: Stop building a Copilot SDK application. Start building Copilot CLI agents and skills that leverage #runSubagent for orchestration, with Dispatcher as the context backbone via MCP.**

---

## Current State Assessment

### What Exists Today

**Dispatcher Platform (Working)**
- REST API with full CRUD for Epics/Features/Tasks
- Execution plans with parallelism metadata, dependencies, and phasing
- MCP server exposing 50+ tools for AI agent access
- Structured descriptions, AI context, decision logs, validation checklists
- Session handoff system for cross-session continuity

**Orchestrator (Partially Built, Stalled)**
- CLI tool using Copilot SDK (`@github/copilot-sdk`)
- `AgentPool` for parallel `CopilotSession` management (up to 4 agents)
- `PhaseExecutor` for phase-based execution
- `MCP Bridge` wrapping 11 Dispatcher operations as Copilot SDK tools
- Git branch management and merge coordination
- Currently not in production use

**MCP Integration (Disabled)**
- `.github/copilot-instructions.md` has Dispatcher MCP usage **commented out** due to "TypeError: terminated" errors
- Agents told to use `plan.md` files instead
- The MCP server itself works -- the issue was stability under large operations

### The Gap

You have a sophisticated project management backend (Dispatcher) and a half-built custom orchestrator, but **no working automation pipeline**. Meanwhile, Copilot CLI has evolved to provide most of the orchestration primitives natively. The custom orchestrator is solving a problem that Copilot CLI now solves out of the box.

---

## What You're Doing Right

### 1. Dispatcher as the Single Source of Truth

This is the biggest thing you got right. Having a structured, queryable, API-driven project management system that AI agents can read from and write to is exactly what's needed. Neither Claude Code nor Copilot CLI provide this natively. Dispatcher gives you:

- **Persistent context** that survives session boundaries
- **Structured requirements** (acceptance criteria, AI instructions, technical notes)
- **Execution plans** with dependency graphs and parallelism hints
- **Decision audit trails** so agents don't repeat mistakes
- **Code context linking** so agents know what files matter

This is your competitive advantage over raw Copilot CLI usage. Don't lose it.

### 2. Execution Metadata Design

The `executionOrder`, `estimatedComplexity`, `dependencies`, and `canRunInParallel` fields on features/tasks are exactly what an orchestration system needs. This structured metadata is what enables intelligent parallel vs. sequential decisions.

### 3. MCP Server Architecture

Exposing Dispatcher via MCP rather than direct database access is the right architectural choice. It means any AI agent system (Copilot CLI, Claude Code, VS Code Copilot, custom tools) can consume Dispatcher. The 50+ tool surface area is comprehensive.

### 4. Session Handoff Design

The `start_session` / `end_session` / `append_ai_note` / `get_ai_context` pattern is exactly how multi-session workflows should preserve context. This solves the context window limitation problem.

---

## What You're Doing Wrong (or Suboptimally)

### 1. Building a Custom Copilot SDK Orchestrator

**Problem:** The `packages/orchestrator/` package reimplements what Copilot CLI now does natively. You wrote:
- `AgentPool` → Copilot CLI has `#runSubagent` with parallel execution
- `PhaseExecutor` → Custom agents can delegate to other agents via `agents:` config
- `MCP Bridge` → Copilot CLI loads MCP servers natively
- `PlanGenerator` → The built-in Plan agent does this

**Why this happened:** When you started (late 2025), the Copilot SDK was the only programmatic interface. `#runSubagent` didn't ship until January 8, 2026. Custom agents with `agents:` delegation shipped October 2025 but wasn't mature. You were ahead of the tooling.

**Impact:** Significant engineering effort spent on infrastructure that's now redundant. The orchestrator has stalled, the MCP tools are disabled, and you're manually managing sessions.

**Fix:** Pivot to Copilot CLI-native agents and skills (detailed in section 6).

### 2. Disabling MCP Tools in copilot-instructions.md

**Problem:** The Dispatcher MCP tools are commented out in `.github/copilot-instructions.md`, forcing agents to use `plan.md` files. This completely bypasses Dispatcher's value proposition.

**Root cause:** "TypeError: terminated" errors during large operations. This is likely the MCP server process crashing under load, not a fundamental design flaw.

**Impact:** Every Copilot session starts from scratch with no structured context. You lose:
- Cross-session continuity
- Progress tracking
- Decision audit trails
- Execution plan awareness
- All the Dispatcher metadata you carefully designed

**Fix:** Debug the MCP stability issue (likely a process timeout or memory issue), then re-enable. In the meantime, load the MCP server with conservative settings (smaller batch sizes, retry logic).

### 3. No `.github/agents/` or `.github/skills/` Defined

**Problem:** You have zero custom agents and zero skills defined. This means Copilot CLI has no project-specific knowledge beyond `.github/copilot-instructions.md`.

**Impact:** Every session, Copilot starts cold. It doesn't know:
- How to use Dispatcher effectively
- Your project's execution patterns
- How to plan work using your templates
- How to hand off between sessions

**Fix:** Create purpose-built agents for your workflow (detailed in section 6).

### 4. Manual Session Management

**Problem:** You're manually creating new Copilot CLI sessions for each piece of work, manually providing context, and manually managing what gets done when.

**Impact:** This is the exact workflow you built Dispatcher to eliminate. You have execution plans with dependency graphs, but you're not using them to drive automated session creation.

**Fix:** Use `#runSubagent` delegation or scripted headless mode to automate session creation.

### 5. Not Using Copilot CLI's Headless Mode for Automation

**Problem:** `copilot -p "prompt" --allow-all-tools` can execute tasks non-interactively. Combined with Dispatcher MCP tools, you could script entire execution plans.

**Impact:** Missing easy automation wins for routine tasks (running validations, updating progress, checking for blockers).

---

## The #runSubagent Opportunity

### What #runSubagent Is

`#runSubagent` is a **tool** (not a slash command) available in Copilot CLI that spawns an isolated, autonomous agent session. When invoked:

1. Copilot spins up a fresh "mini-agent" with its own context window
2. The sub-agent receives **only** the context explicitly provided in its prompt
3. The sub-agent executes autonomously (analyzing code, editing files, running commands)
4. Upon completion, only a **summary** flows back to the parent session
5. The parent's context window is not polluted with intermediate work

**Key facts:**
- Sub-agents **can run in parallel** in Copilot CLI (shipped January 14, 2026)
- Sub-agents **cannot nest** (a sub-agent cannot spawn another sub-agent)
- Sub-agents are **context-isolated** by design (no parent context inheritance)
- Custom agents can specify which other agents they can invoke via the `agents:` YAML field
- Each sub-agent invocation costs ~2 premium requests (synthetic user messages)

### How This Maps to Your Vision

Your question was: *"Could the system create a new session for each feature and then in that agent it spawns off new #runSubagents to complete the tasks?"*

**Yes, but with a crucial architectural constraint: no nesting.** Sub-agents cannot spawn sub-agents. This means you need a **two-level** architecture, not three:

```
Level 0: Orchestrator Agent (you or a script)
  ├── Level 1: Feature Agent (sub-agent per feature)
  │     └── Executes tasks sequentially within the feature
  ├── Level 1: Feature Agent (parallel, if independent)
  │     └── Executes tasks sequentially within the feature
  └── Level 1: Feature Agent (blocked until dependencies resolve)
        └── Executes tasks sequentially within the feature
```

Because sub-agents can't nest, a Feature Agent cannot spawn Task-level sub-agents. Instead, the Feature Agent handles all tasks within the feature sequentially in its own context window. This is actually fine because:

1. Tasks within a feature are usually sequential (dependencies)
2. A single feature's tasks share context (same files, same patterns)
3. The feature agent's context window is large enough for the tasks within it

**The parallelism happens at the feature level, not the task level.**

However, there IS an alternative pattern for task-level parallelism when tasks within a feature are independent...

---

## Proposed Architecture: Feature Sessions + Task Subagents

### Architecture A: Two-Level (Recommended for Most Work)

```
┌─────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR AGENT (.github/agents/orchestrator.md)             │
│                                                                 │
│ 1. Reads execution plan from Dispatcher (dispatcher__get_execution_ │
│    plan)                                                        │
│ 2. For each PHASE:                                              │
│    a. Identifies parallel vs sequential features                │
│    b. Spawns Feature Agents via #runSubagent (parallel if safe) │
│    c. Waits for all Feature Agents to complete                  │
│    d. Triggers branch merges (if parallel)                      │
│ 3. Updates Dispatcher progress after each phase                   │
│ 4. Handles errors and reports blockers                          │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ FEATURE AGENT   │ │ FEATURE AGENT   │ │ FEATURE AGENT   │
│ (sub-agent)     │ │ (sub-agent)     │ │ (sub-agent)     │
│                 │ │                 │ │                 │
│ Context:        │ │ Context:        │ │ Context:        │
│ - Feature desc  │ │ - Feature desc  │ │ - Feature desc  │
│ - Task list     │ │ - Task list     │ │ - Task list     │
│ - AI context    │ │ - AI context    │ │ - AI context    │
│ - Code context  │ │ - Code context  │ │ - Code context  │
│                 │ │                 │ │                 │
│ Executes tasks  │ │ Executes tasks  │ │ Executes tasks  │
│ sequentially    │ │ sequentially    │ │ sequentially    │
│ within feature  │ │ within feature  │ │ within feature  │
│                 │ │                 │ │                 │
│ Reports back:   │ │ Reports back:   │ │ Reports back:   │
│ - Summary       │ │ - Summary       │ │ - Summary       │
│ - Files changed │ │ - Files changed │ │ - Files changed │
│ - Decisions     │ │ - Decisions     │ │ - Decisions     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
     (parallel)          (parallel)         (sequential,
                                            after phase 1)
```

### Architecture B: Flat (For Task-Level Parallelism)

When a feature has independent tasks that could run in parallel, skip the feature-level agent and have the orchestrator spawn task-level sub-agents directly:

```
ORCHESTRATOR AGENT
  ├── #runSubagent: Task ENG-1-1 (parallel)
  ├── #runSubagent: Task ENG-1-2 (parallel)
  ├── #runSubagent: Task ENG-1-3 (parallel)
  │   (wait for all three)
  ├── #runSubagent: Task ENG-2-1 (next feature, sequential)
  └── #runSubagent: Task ENG-2-2 (sequential)
```

This gives maximum parallelism but requires the orchestrator to manage more sub-agents and handle more merge coordination.

### Architecture C: Hybrid (Recommended)

Use Architecture A for features with sequential tasks, and Architecture B for features with independent tasks. Let the execution plan metadata drive the decision:

```typescript
// Pseudocode for the orchestrator agent's logic
for (const phase of executionPlan.phases) {
  const featurePromises = phase.items.map(async (feature) => {
    const tasks = await dispatcher__list_tasks({ featureId: feature.id });
    const hasParallelTasks = tasks.some(t => !t.dependencies?.length);

    if (hasParallelTasks && tasks.length > 1) {
      // Architecture B: Spawn task-level sub-agents
      for (const taskGroup of groupByDependency(tasks)) {
        await Promise.all(taskGroup.map(task =>
          runSubagent(`Complete task ${task.identifier}: ${task.title}`)
        ));
      }
    } else {
      // Architecture A: Single feature agent handles all tasks
      await runSubagent(`Complete feature ${feature.identifier} with all tasks`);
    }
  });

  if (phase.canRunInParallel) {
    await Promise.all(featurePromises);
  } else {
    for (const promise of featurePromises) await promise;
  }
}
```

### Context Injection Strategy

Since sub-agents don't inherit parent context, you must explicitly inject everything they need. Dispatcher makes this possible:

```markdown
## Sub-Agent Prompt Template

You are working on task {TASK_IDENTIFIER}: {TASK_TITLE}

### Requirements
{STRUCTURED_DESCRIPTION from dispatcher__get_structured_description}

### Acceptance Criteria
{ACCEPTANCE_CRITERIA from structured description}

### AI Instructions
{AI_INSTRUCTIONS from structured description}

### Previous Session Context
{AI_CONTEXT from dispatcher__get_ai_context}

### Related Code
{CODE_CONTEXT from dispatcher__get_code_context}

### Decisions Made So Far
{DECISIONS from dispatcher__get_decision_context}

### Your MCP Tools
You have access to Dispatcher MCP tools. Use them to:
- dispatcher__log_progress - Report your progress
- dispatcher__log_decision - Record implementation decisions
- dispatcher__link_code_file - Report files you modify
- dispatcher__append_ai_note - Leave notes for future sessions
- dispatcher__run_all_validations - Verify your work

### When You're Done
1. Run dispatcher__run_all_validations to verify acceptance criteria
2. Use dispatcher__link_code_file for every file you modified
3. Use dispatcher__append_ai_note with a summary of what you did
```

This is the key insight: **Dispatcher provides the persistent memory that sub-agents lack.** Each sub-agent reads its context from Dispatcher at the start, does its work, and writes its results back to Dispatcher. The next sub-agent (or the next session) picks up where it left off.

---

## Copilot CLI Features You're Not Using

### 1. Custom Agents (`.github/agents/`)

**What:** Markdown files with YAML frontmatter that define specialized agent personas. Copilot auto-selects them based on task relevance.

**What you should create:**

```
.github/agents/
├── orchestrator.md        # Reads execution plans, delegates to sub-agents
├── feature-worker.md      # Completes a feature's tasks sequentially
├── planner.md             # Creates Dispatcher epics from natural language
├── reviewer.md            # Reviews completed features against acceptance criteria
└── session-manager.md     # Handles session start/end with Dispatcher handoff
```

**Example: `orchestrator.md`**
```yaml
---
name: Dispatcher Orchestrator
description: "Executes Dispatcher epic execution plans by delegating features to sub-agents.
  Use when the user wants to execute an epic, run a phase, or automate feature implementation."
tools: ['agent', 'read', 'execute', 'edit', 'search']
agents: ['feature-worker', 'reviewer']
---

# Dispatcher Orchestrator Agent

You orchestrate the execution of Dispatcher epics by reading execution plans
and delegating work to feature-worker sub-agents.

## Workflow

1. Call dispatcher__get_execution_plan for the specified epic
2. For each phase in the plan:
   a. Identify which features can run in parallel (canRunInParallel: true)
   b. For each feature, prepare context by calling:
      - dispatcher__get_structured_description
      - dispatcher__get_ai_context
      - dispatcher__get_code_context
      - dispatcher__get_decision_context
   c. Spawn feature-worker sub-agents with full context
   d. Wait for completion
   e. Call dispatcher__complete_work for each completed feature
3. After all phases complete, generate summary

## Rules
- NEVER skip reading the execution plan
- ALWAYS inject full Dispatcher context into sub-agent prompts
- ALWAYS update Dispatcher progress after each feature completes
- If a sub-agent fails, log the error and continue with other features
```

**Example: `feature-worker.md`**
```yaml
---
name: Feature Worker
description: "Completes all tasks within a single Dispatcher feature. Receives full context
  from the orchestrator including requirements, acceptance criteria, and code context."
tools: ['read', 'edit', 'execute', 'search']
user-invokable: false
---

# Feature Worker Agent

You implement a single feature by completing all its tasks sequentially.

## Your Context
You will receive:
- Feature identifier and description
- List of tasks with acceptance criteria
- AI instructions for implementation
- Previous session context and decisions
- Code context (files involved)

## Workflow
1. Read the feature requirements carefully
2. For each task (in executionOrder):
   a. Call dispatcher__start_work for the task
   b. Implement according to AI instructions
   c. Run dispatcher__run_all_validations
   d. Call dispatcher__link_code_file for modified files
   e. Call dispatcher__log_decision for any implementation choices
   f. Call dispatcher__complete_work with summary
3. After all tasks: call dispatcher__append_ai_note with feature summary

## Rules
- MUST complete tasks in executionOrder
- MUST run validations before marking complete
- MUST link all modified files
- MUST log decisions with rationale
```

### 2. Agent Skills (`.github/skills/`)

**What:** Reusable instruction sets that Copilot loads when relevant. Unlike agents (which are personas), skills are procedures.

**What you should create:**

```
.github/skills/
├── dispatcher-planning/
│   └── SKILL.md           # How to create a Dispatcher epic from requirements
├── dispatcher-session/
│   └── SKILL.md           # Session start/end protocol
├── dispatcher-validation/
│   └── SKILL.md           # How to run and interpret validations
└── code-review-dispatcher/
    └── SKILL.md           # Review against Dispatcher acceptance criteria
```

### 3. Headless Mode for Scripted Execution

**What:** `copilot -p "prompt" --allow-all-tools` runs non-interactively. Chain with shell scripts.

**Example automation script:**
```bash
#!/bin/bash
# execute-epic.sh - Run all features in an epic

EPIC_ID=$1

# Step 1: Get execution plan
PLAN=$(copilot -p "Using dispatcher MCP tools, get the execution plan for epic $EPIC_ID and output it as JSON" --allow-all-tools --silent)

# Step 2: For each feature in the plan
echo "$PLAN" | jq -r '.phases[].items[].identifier' | while read FEATURE_ID; do
  echo "Starting feature: $FEATURE_ID"

  copilot -p "Complete all tasks for Dispatcher feature $FEATURE_ID.
    1. Read the feature's structured description and AI instructions
    2. Complete each task in order
    3. Run validations
    4. Link modified files
    5. Log decisions
    6. Mark complete" \
    --allow-all-tools \
    --agent feature-worker \
    --additional-mcp-config ./mcp-dispatcher.json

  echo "Completed feature: $FEATURE_ID"
done
```

### 4. `/delegate` for Background Execution

**What:** Delegates work to the Copilot Coding Agent, which runs asynchronously on GitHub's infrastructure and opens a draft PR.

**When to use:** For features that don't need immediate local results. The coding agent works in the background while you continue other work.

```
/delegate Complete Dispatcher feature ENG-42. Read the structured description
and AI instructions from Dispatcher MCP, implement all tasks, run validations,
and link all modified files.
```

### 5. ACP (Agent Client Protocol) for Programmatic Control

**What:** JSON-RPC protocol for driving Copilot CLI as a subprocess. Your orchestrator could use this instead of the Copilot SDK directly.

```bash
# Start Copilot CLI in ACP mode
copilot --acp --port 8080
```

Then your orchestrator sends JSON-RPC messages to create sessions, send prompts, and receive streaming updates. This gives you the same programmatic control as the Copilot SDK but through Copilot CLI (which handles all the agent infrastructure, sub-agents, MCP loading, etc.).

**This may be the best path forward for your orchestrator:** Instead of managing `CopilotSession` objects directly via the SDK, drive Copilot CLI via ACP and let it handle sub-agent orchestration, MCP loading, and tool management natively.

### 6. Session Resume for Continuity

```bash
# Resume most recent session
copilot --continue

# Resume specific session
copilot --resume <session-id>

# Interactive picker
copilot --resume
```

Combined with Dispatcher's session handoff system, this gives you two layers of continuity:
- **Copilot session state** (conversation history, permissions)
- **Dispatcher session state** (structured progress, decisions, context)

---

## The Orchestrator Decision: Build vs. Native

You have three options. Here's the honest assessment:

### Option 1: Abandon the Custom Orchestrator, Go Full Copilot CLI Native

**Approach:** Delete `packages/orchestrator/`. Define everything as `.github/agents/` and `.github/skills/`. Use `#runSubagent` for parallelism. Use Dispatcher MCP for context.

**Pros:**
- Zero maintenance on orchestration infrastructure
- Automatically benefits from Copilot CLI updates
- Simpler architecture
- Works immediately (no SDK debugging)

**Cons:**
- Less control over execution flow
- No programmatic error handling (agents may hallucinate)
- `#runSubagent` parallelism is at the model's discretion, not yours
- Premium request costs for each sub-agent (~2 per invocation)
- Can't guarantee agents follow the execution plan exactly

**Verdict:** Good for 80% of use cases. Not suitable if you need deterministic orchestration.

### Option 2: Rebuild the Orchestrator Using ACP Instead of Copilot SDK

**Approach:** Keep the orchestrator concept but drive Copilot CLI via ACP (JSON-RPC over stdio) instead of the Copilot SDK directly. The orchestrator becomes a thin coordination layer.

**Pros:**
- Programmatic control over execution flow
- Deterministic phase/dependency management
- Copilot CLI handles sub-agents, MCP, tools natively
- Your orchestrator only manages sequencing and error handling
- ACP is an open standard with growing ecosystem

**Cons:**
- ACP is in public preview (API may change)
- More complex than pure CLI approach
- Still requires maintaining the orchestrator package

**Verdict:** Best for your use case. Gives you deterministic control with minimal infrastructure.

### Option 3: Complete the Current Copilot SDK Orchestrator

**Approach:** Finish `packages/orchestrator/` as designed, using `@github/copilot-sdk` directly.

**Pros:**
- Most control over every aspect
- Direct SDK access for fine-grained event handling
- No dependency on CLI features

**Cons:**
- Duplicates what Copilot CLI now does natively
- Copilot SDK is in technical preview (breaking changes likely)
- Significant remaining work (stability, error handling, testing)
- You maintain all the plumbing (session management, tool registration, etc.)
- No access to built-in agents (Explore, Plan, Code-review, Task)

**Verdict:** Not recommended. Too much infrastructure for diminishing returns.

### Recommendation: Option 2 (ACP) for orchestration + Option 1 (native agents) for execution

Use a thin ACP-based orchestrator for deterministic phase management, but let Copilot CLI custom agents handle the actual feature/task execution. Best of both worlds:

```
Your Orchestrator (ACP Client)
  │
  ├── Reads execution plan from Dispatcher API
  ├── Manages phase sequencing and dependencies
  ├── For each feature:
  │     └── Sends prompt to Copilot CLI via ACP
  │         └── Copilot CLI loads the feature-worker agent
  │             └── Agent uses Dispatcher MCP tools
  │             └── Agent may use #runSubagent for subtasks
  ├── Waits for completion via ACP streaming events
  ├── Handles errors, retries, and blockers
  └── Manages git branches and merges
```

---

## Recommended Implementation Roadmap

### Phase 0: Quick Wins (Do This Week)

1. **Fix Dispatcher MCP stability**
   - Investigate "TypeError: terminated" errors
   - Likely cause: process timeout or unhandled promise rejection
   - Add retry logic and graceful error handling
   - Re-enable MCP tools in `.github/copilot-instructions.md`

2. **Create basic `.github/agents/`**
   ```
   .github/agents/
   ├── planner.md           # Creates Dispatcher epics
   └── session-manager.md   # Session start/end protocol
   ```

3. **Create basic `.github/skills/`**
   ```
   .github/skills/
   └── dispatcher-workflow/
       └── SKILL.md          # Core Dispatcher usage patterns
   ```

4. **Test `#runSubagent` manually**
   - Open Copilot CLI session
   - Ask it to complete a simple Dispatcher task using a sub-agent
   - Verify MCP tools work within sub-agents
   - Measure premium request consumption

### Phase 1: Agent Definitions (1-2 Weeks)

1. **Create the full agent suite:**
   - `orchestrator.md` - Reads execution plans, delegates features
   - `feature-worker.md` - Completes a feature's tasks (sub-agent only)
   - `reviewer.md` - Reviews against acceptance criteria
   - `planner.md` - Creates Dispatcher epics from requirements

2. **Create the skill suite:**
   - `dispatcher-planning/SKILL.md` - Epic creation workflow
   - `dispatcher-session/SKILL.md` - Session start/end protocol
   - `dispatcher-validation/SKILL.md` - Validation procedures

3. **Test end-to-end with a real feature:**
   - Create a small Dispatcher epic (2-3 features, 2-3 tasks each)
   - Use the orchestrator agent to execute it
   - Verify sub-agents complete tasks and update Dispatcher

### Phase 2: Scripted Automation (2-3 Weeks)

1. **Create shell scripts for common workflows:**
   - `scripts/execute-epic.sh` - Run all features in an epic
   - `scripts/validate-epic.sh` - Run all validations
   - `scripts/review-epic.sh` - Review all completed features

2. **Test headless execution:**
   ```bash
   copilot -p "@orchestrator Execute epic ENG-42" --allow-all-tools
   ```

3. **Measure and optimize:**
   - Track premium request consumption per epic
   - Identify which tasks benefit from sub-agents vs. inline execution
   - Tune parallelism settings

### Phase 3: ACP Orchestrator (4-6 Weeks, Optional)

Only if Phase 1-2 reveals that you need more deterministic control:

1. **Build thin ACP client in `packages/orchestrator/`:**
   - Spawns Copilot CLI via `copilot --acp`
   - Sends `session/new` and `session/prompt` messages
   - Handles `session/update` streaming events
   - Responds to `session/request_permission` automatically

2. **Integrate with Dispatcher execution plans:**
   - Read plans from Dispatcher API
   - Map features to ACP sessions
   - Track completion via both ACP events and Dispatcher API

3. **Add git coordination:**
   - Branch creation before each parallel feature
   - Merge coordination after phase completion
   - Conflict detection and pause/resume

### Phase 4: Mature Automation (Ongoing)

1. **Copilot CLI plugin for Dispatcher:**
   - Package agents + skills + MCP config as an installable plugin
   - `copilot /plugin install dispatcher/copilot-plugin`
   - Makes Dispatcher orchestration available in any repo

2. **CI/CD integration:**
   - GitHub Actions workflow that executes Dispatcher epics
   - Triggered by issue assignment or label

3. **Multi-repo support:**
   - Dispatcher features that span multiple repositories
   - Each sub-agent works in its own repo clone

---

## Appendix: Copilot CLI Tool Reference

### Headless Mode Flags

| Flag | Purpose |
|---|---|
| `-p` / `--prompt` | Non-interactive single prompt |
| `--allow-all-tools` | Auto-approve all tool executions |
| `--allow-all-paths` | Auto-approve filesystem access |
| `--allow-all-urls` | Auto-approve URL access |
| `--allow-all` / `--yolo` | Enable all permissions |
| `--allow-tool <pattern>` | Allow specific tool (e.g., `shell(git *)`) |
| `--deny-tool <pattern>` | Block specific tool (e.g., `shell(rm *)`) |
| `--silent` | Suppress output |
| `--agent=<name>` | Use specific custom agent |
| `--additional-mcp-config` | Load extra MCP servers |
| `--continue` | Resume most recent session |
| `--resume <id>` | Resume specific session |

### Custom Agent YAML Fields

```yaml
---
name: string                    # Display name
description: string             # Required. When to use this agent
tools: [string]                 # Tool whitelist: read, edit, execute, search, agent, web, todo
agents: [string]                # Other agents this one can invoke as sub-agents
model: string                   # Model override
infer: boolean                  # Auto-select based on task (default: true)
user-invokable: boolean         # Can user directly invoke (default: true)
disable-model-invocation: bool  # Prevent auto-invocation (default: false)
mcp-servers:                    # Additional MCP servers
  server-name:
    type: 'local'
    command: 'command'
    args: ['--arg']
    tools: ['*']
    env:
      KEY: ${{ secrets.VALUE }}
---
```

### #runSubagent Characteristics

| Property | Value |
|---|---|
| Context isolation | Full (no parent inheritance) |
| Parallel execution | Supported in CLI (Jan 2026+) |
| Nesting | Not allowed (sub-agents can't spawn sub-agents) |
| Cost | ~2 premium requests per invocation |
| Result format | Summary only (intermediate steps not returned) |
| Tool access | Configurable per-agent via YAML |
| MCP access | Inherited from CLI configuration |
| Max concurrent | Limited by Copilot API rate limits |

### ACP (Agent Client Protocol) Quick Reference

```bash
# Start ACP server
copilot --acp              # stdio mode
copilot --acp --port 8080  # TCP mode
```

Key JSON-RPC methods:
- `initialize` - Negotiate capabilities
- `session/new` - Create new session
- `session/prompt` - Send message
- `session/update` - Receive streaming updates (notification)
- `session/cancel` - Abort current operation
- `session/request_permission` - Permission gate (callback)
- `session/load` - Resume session

### Dispatcher MCP Tools Available to Agents

**Planning:** `list_epics`, `get_epic`, `create_epic`, `get_execution_plan`, `list_templates`, `create_from_template`

**Execution:** `start_work`, `complete_work`, `log_progress`, `log_decision`

**Context:** `get_structured_description`, `get_ai_context`, `set_ai_context`, `append_ai_note`, `get_code_context`, `get_decision_context`

**Validation:** `add_validation`, `run_validation`, `run_all_validations`, `list_validations`

**Linking:** `link_code_file`, `link_branch`, `link_commit`, `link_pr`, `link_function`

---

## Key Takeaways

1. **Dispatcher is the right idea.** A structured, AI-queryable project management system is exactly what multi-session AI workflows need. Don't abandon it.

2. **The custom orchestrator was ahead of its time.** Copilot CLI now provides most of what you built. Pivot to native features instead of maintaining custom infrastructure.

3. **`#runSubagent` is your parallel execution primitive.** It's the Copilot CLI equivalent of Claude Code's Task tool. Use it for feature-level parallelism.

4. **Context injection via Dispatcher MCP is the secret weapon.** Sub-agents are context-isolated by design, but Dispatcher provides persistent memory. Read context from Dispatcher at sub-agent start, write results back at end. This is how you achieve cross-session continuity without context window limitations.

5. **Start with agents and skills, add ACP later.** You can get 80% of the automation value with zero custom code by defining the right `.github/agents/` and `.github/skills/`. Only build the ACP orchestrator if you need deterministic control over phasing and dependencies.

6. **Fix the MCP stability issue first.** Everything depends on agents being able to read from and write to Dispatcher. The commented-out MCP tools are the biggest blocker.

7. **Premium request costs are real.** Each sub-agent invocation costs ~2 premium requests. An epic with 5 features and 3 tasks each could consume 30+ premium requests. Monitor and optimize.
