# SpecTree MCP Implementation Reference

> **Purpose:** Complete technical reference of the SpecTree MCP (Model Context Protocol) server implementation, including all AI workflow enhancements. This document serves as the authoritative source.
>
> **Last Updated:** 2025-02-05
> **Status:** Post-orchestrator cleanup (8 tools removed)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema (AI Fields)](#database-schema-ai-fields)
4. [API Endpoints (AI Features)](#api-endpoints-ai-features)
5. [MCP Tools - Complete Reference](#mcp-tools---complete-reference)
6. [Feature Categories](#feature-categories)
7. [Implementation Files](#implementation-files)
8. [Configuration](#configuration)
9. [Orchestrator Integration Notes](#orchestrator-integration-notes)

---

## Overview

The SpecTree MCP server provides **68 registered tools** across 19 tool modules, enabling AI agents (like GitHub Copilot CLI) to manage project work through the Model Context Protocol.

### Key Statistics

| Metric | Value |
|--------|-------|
| Total MCP Tools | 68 |
| Tool Modules | 19 files |
| AI-Enhanced Database Fields | 14 per Feature/Task |
| Dedicated AI Models | 3 (AiSession, Decision, PlanTemplate) |
| API Route Files (AI-related) | 4 (sessions, decisions, templates, plus feature/task extensions) |

### Recent Changes (2025-02)

**Removed Modules (8 tools):**
- `sessions.ts` (6 tools) - Session management now handled by orchestrator
- `workflow.ts` (2 tools) - Workflow guidance replaced by orchestrator prompts
- `reminders.ts` (helper) - Contextual reminders no longer needed
- `workflowChecker.ts` (helper) - Workflow state checking removed
- `workflowStages.ts` (helper) - Workflow stage definitions removed

**Reason:** The orchestrator CLI (`packages/orchestrator/`) manages sessions, workflow, and agent coordination externally. AI agents no longer need to self-manage these concerns via MCP tools.

### Design Philosophy

The MCP implementation was designed around these principles:

1. **AI-Native Workflows** - Tools designed for how AI agents think and work
2. **Session Continuity** - Context transfers automatically between AI sessions
3. **Execution Planning** - Dependencies, ordering, and parallelization built-in
4. **Progress Tracking** - Status updates integrated into the workflow
5. **Decision Auditability** - Append-only decision log with rationale

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              MCP ARCHITECTURE                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐ │
│  │   AI Agent      │  stdio  │   MCP Server    │  HTTP   │   SpecTree API  │ │
│  │  (Copilot CLI)  │◄───────►│ (packages/mcp)  │◄───────►│  (packages/api) │ │
│  └─────────────────┘         └─────────────────┘         └────────┬────────┘ │
│                                     │                              │          │
│                              76 Tools                        Prisma ORM      │
│                                     │                              │          │
│                              ┌──────┴──────┐               ┌───────▼───────┐ │
│                              │ Tool Modules │               │   SQLite DB   │ │
│                              │  (21 files)  │               └───────────────┘ │
│                              └─────────────┘                                  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/mcp/
├── src/
│   ├── index.ts              # Server entry point
│   ├── api-client.ts         # HTTP client for SpecTree API
│   ├── utils.ts              # Shared utilities
│   └── tools/                # 19 tool modules (68 tools total)
│       ├── index.ts          # Tool registry
│       ├── ai-context.ts     # AI context management (3 tools)
│       ├── code-context.ts   # Code artifact linking (7 tools)
│       ├── composite.ts      # Composite operations (2 tools)
│       ├── decisions.ts      # Decision logging (4 tools)
│       ├── epics.ts          # Epic management (4 tools)
│       ├── execution.ts      # Execution planning (4 tools)
│       ├── features.ts       # Feature management (4 tools)
│       ├── help.ts           # Instructions/guidance (1 tool)
│       ├── ordering.ts       # Reordering (3 tools)
│       ├── personal.ts       # Personal scope (4 tools)
│       ├── progress.ts       # Progress tracking (4 tools)
│       ├── search.ts         # Unified search (1 tool)
│       ├── statuses.ts       # Status queries (2 tools)
│       ├── structured-desc.ts # Rich descriptions (6 tools)
│       ├── summary.ts        # Progress summaries (3 tools)
│       ├── tasks.ts          # Task management (4 tools)
│       ├── teams.ts          # Team listing (1 tool)
│       ├── templates.ts      # Plan templates (5 tools)
│       ├── utils.ts          # Shared utilities
│       └── validations.ts    # Validation checks (7 tools)
```

> **Note:** Session management (`sessions.ts`), workflow guidance (`workflow.ts`), and related helper files were removed in 2025-02 as part of the orchestrator migration. The orchestrator manages these concerns externally.

---

## Database Schema (AI Fields)

### Feature Model - AI Enhancement Fields

```prisma
model Feature {
  // ... core fields ...

  // Execution metadata for AI agents
  executionOrder      Int?     @map("execution_order")      // Suggested sequence (1, 2, 3...)
  canParallelize      Boolean  @default(false)              // Can run alongside other features?
  parallelGroup       String?  @map("parallel_group")       // Features in same group can run together
  dependencies        String?  @map("dependencies")         // JSON array of feature IDs that must complete first
  estimatedComplexity String?  @map("estimated_complexity") // trivial | simple | moderate | complex

  // AI session context for cross-session continuity
  aiContext       String?   @map("ai_context")          // Structured context for AI consumption
  aiNotes         String?   @map("ai_notes")            // JSON array of append-only notes
  lastAiSessionId String?   @map("last_ai_session_id")  // Track last AI session
  lastAiUpdateAt  DateTime? @map("last_ai_update_at")

  // Progress tracking fields
  startedAt       DateTime? @map("started_at")          // When work started
  completedAt     DateTime? @map("completed_at")        // When work completed
  durationMinutes Int?      @map("duration_minutes")    // Calculated work duration
  percentComplete Int?      @map("percent_complete")    // 0-100 progress indicator
  blockerReason   String?   @map("blocker_reason")      // What's blocking progress

  // Structured description (JSON blob)
  structuredDescription String? @map("structured_description")  // JSON: StructuredDescription

  // Code context (JSON blob)
  codeContext     String?   @map("code_context")        // JSON: CodeContext (files, branch, commits, PR)
}
```

### Task Model - AI Enhancement Fields

```prisma
model Task {
  // ... core fields ...

  // SAME 14 AI fields as Feature:
  // - executionOrder, canParallelize, parallelGroup, dependencies, estimatedComplexity
  // - aiContext, aiNotes, lastAiSessionId, lastAiUpdateAt
  // - startedAt, completedAt, durationMinutes, percentComplete, blockerReason
  // - structuredDescription, codeContext
}
```

### AiSession Model

```prisma
model AiSession {
  id             String    @id @default(uuid())
  epicId         String    @map("epic_id")
  externalId     String?   @map("external_id") // Optional external session ID (e.g., from Copilot)
  startedAt      DateTime  @default(now())
  endedAt        DateTime?
  status         String    @default("active") // active | completed | abandoned
  
  // Work tracking
  itemsWorkedOn  String?   @map("items_worked_on") // JSON array of {type, id, identifier, action}
  summary        String?   // AI-generated summary of session work
  
  // Handoff info for successor sessions
  nextSteps      String?   @map("next_steps")    // JSON array of recommended next actions
  blockers       String?   // JSON array of blockers encountered
  decisions      String?   // JSON array of decisions made with rationale
  contextBlob    String?   @map("context_blob")  // Serialized context for next session

  epic Epic @relation(fields: [epicId], references: [id], onDelete: Cascade)
}
```

### Decision Model

```prisma
model Decision {
  id           String   @id @default(uuid())
  
  // Context - at least epicId is required
  epicId       String   @map("epic_id")
  featureId    String?  @map("feature_id")
  taskId       String?  @map("task_id")
  
  // Decision details
  question     String   // What was being decided
  decision     String   // The choice made
  rationale    String   // Why this choice was made
  alternatives String?  // JSON: What else was considered
  
  // Metadata
  madeBy       String   @map("made_by")     // "AI" | "human" | user ID
  madeAt       DateTime @default(now())
  
  // Optional categorization
  category     String?  // "architecture" | "library" | "approach" | "scope" | "design" | "tradeoff" | "deferral"
  impact       String?  // "low" | "medium" | "high"

  epic    Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)
  feature Feature? @relation(fields: [featureId], references: [id], onDelete: Cascade)
  task    Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)
}
```

### PlanTemplate Model

```prisma
model PlanTemplate {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isBuiltIn   Boolean  @default(false)
  structure   String   // JSON: TemplateStructure (features, tasks, variables)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?  @map("created_by_id")

  createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull)
}
```

---

## API Endpoints (AI Features)

### Sessions (`/api/v1/sessions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/start` | Start a new AI session for an epic |
| POST | `/sessions/end` | End session with handoff data |
| GET | `/sessions/:epicId/active` | Get active session for epic |
| GET | `/sessions/:epicId/last` | Get last completed session |
| GET | `/sessions/:epicId/history` | Get session history |
| POST | `/sessions/log-work` | Log work done during session |

### Decisions (`/api/v1/decisions`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/decisions` | Log a decision with rationale |
| GET | `/decisions` | List decisions with filters |
| GET | `/decisions/search` | Search decisions by text |
| GET | `/decisions/context/:type/:id` | Get decisions for feature/task context |

### Templates (`/api/v1/templates`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates` | List all templates (built-in + custom) |
| GET | `/templates/:name` | Get template by name |
| POST | `/templates/preview` | Preview template expansion |
| POST | `/templates/apply` | Create epic from template |
| POST | `/templates/save` | Save epic as new template |

### Extended Feature/Task Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/features/:id/execution-metadata` | Set execution metadata |
| GET | `/features/:id/ai-context` | Get AI context |
| PATCH | `/features/:id/ai-context` | Set AI context |
| POST | `/features/:id/ai-notes` | Append AI note |
| GET | `/features/:id/structured-description` | Get structured description |
| PATCH | `/features/:id/structured-description` | Set structured description |
| PATCH | `/features/:id/structured-description/:section` | Update single section |
| GET | `/features/:id/code-context` | Get code context |
| POST | `/features/:id/code-context/file` | Link file |
| DELETE | `/features/:id/code-context/file` | Unlink file |
| POST | `/features/:id/code-context/function` | Link function |
| PATCH | `/features/:id/code-context/branch` | Link branch |
| POST | `/features/:id/code-context/commit` | Link commit |
| PATCH | `/features/:id/code-context/pr` | Link PR |
| POST | `/features/:id/start-work` | Start work (sets status, timestamps) |
| POST | `/features/:id/complete-work` | Complete work (calculates duration) |
| POST | `/features/:id/log-progress` | Log incremental progress |
| POST | `/features/:id/report-blocker` | Report a blocker |

*Same endpoints exist for `/tasks/:id/...`*

### Execution Plan

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/epics/:id/execution-plan` | Get ordered execution plan with phases |

### Progress Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/epics/:id/progress-summary` | Get comprehensive progress dashboard |
| GET | `/me/work` | Get current user's assigned work |
| GET | `/blocked-summary` | Get all blocked items across epics |

---

## MCP Tools - Complete Reference

### Help (1 tool)

| Tool | Description |
|------|-------------|
| `spectree__get_instructions` | Get comprehensive instructions for using SpecTree effectively |

### Epics (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__list_epics` | List epics with pagination and filtering |
| `spectree__get_epic` | Get epic by ID or name |
| `spectree__create_epic` | Create a new epic in a team |
| `spectree__create_personal_project` | Create epic in personal scope (alias) |

### Features (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__list_features` | List features with filters (epic, status, assignee) |
| `spectree__get_feature` | Get feature by ID or identifier (e.g., `ENG-123`) |
| `spectree__create_feature` | Create feature in an epic |
| `spectree__update_feature` | Update feature properties |

### Tasks (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__list_tasks` | List tasks with filters (feature, status, assignee) |
| `spectree__get_task` | Get task by ID or identifier (e.g., `ENG-123-1`) |
| `spectree__create_task` | Create task under a feature |
| `spectree__update_task` | Update task properties |

### Statuses (2 tools)

| Tool | Description |
|------|-------------|
| `spectree__list_statuses` | List workflow statuses for a team |
| `spectree__get_status` | Get status details by ID or name |

### Ordering (3 tools)

| Tool | Description |
|------|-------------|
| `spectree__reorder_epic` | Change epic order within team |
| `spectree__reorder_feature` | Change feature order within epic |
| `spectree__reorder_task` | Change task order within feature |

### Search (1 tool)

| Tool | Description |
|------|-------------|
| `spectree__search` | Unified search for features and tasks |

### Personal Scope (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_personal_scope` | Get user's personal scope info |
| `spectree__list_personal_projects` | List epics in personal scope |
| `spectree__create_personal_project` | Create epic in personal scope |
| `spectree__list_personal_statuses` | List personal workflow statuses |

### Teams (1 tool)

| Tool | Description |
|------|-------------|
| `spectree__list_teams` | List teams accessible to user |

### Execution Planning (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_execution_plan` | Get ordered phases with parallel groups |
| `spectree__set_execution_metadata` | Set order, dependencies, parallelization |
| `spectree__mark_blocked` | Add dependency (blocker) |
| `spectree__mark_unblocked` | Remove dependency |

### AI Context (3 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_ai_context` | Retrieve AI context and notes for feature/task |
| `spectree__set_ai_context` | Set/replace AI context (full replacement) |
| `spectree__append_ai_note` | Append note (observation, decision, blocker, next-step) |

### Progress Tracking (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__start_work` | Begin work (sets status, start timestamp) |
| `spectree__complete_work` | Complete work (sets status, calculates duration) |
| `spectree__log_progress` | Log incremental progress with optional % |
| `spectree__report_blocker` | Report blocker with reason |

### Progress Summary (3 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_progress_summary` | Comprehensive epic dashboard |
| `spectree__get_my_work` | Get user's assigned work queue |
| `spectree__get_blocked_summary` | Get all blocked items |

### Session Handoff (6 tools)

| Tool | Description |
|------|-------------|
| `spectree__start_session` | Start AI session, get previous handoff |
| `spectree__end_session` | End session with summary, next steps, blockers |
| `spectree__get_active_session` | Check for active session |
| `spectree__get_last_session` | Get last completed session's handoff |
| `spectree__get_session_history` | Get session history for epic |
| `spectree__log_session_work` | Log work done during session |

### Structured Descriptions (6 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_structured_description` | Get parsed structured description |
| `spectree__set_structured_description` | Set entire structured description |
| `spectree__update_section` | Update single section (summary, aiInstructions, etc.) |
| `spectree__add_acceptance_criterion` | Append acceptance criterion |
| `spectree__link_file` | Link file to filesInvolved |
| `spectree__add_external_link` | Add external documentation link |

### Code Context (7 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_code_context` | Get all code artifacts (files, branch, commits, PR) |
| `spectree__link_code_file` | Link file to feature/task |
| `spectree__unlink_code_file` | Remove file link |
| `spectree__link_function` | Link function (file:function format) |
| `spectree__link_branch` | Set git branch |
| `spectree__link_commit` | Add commit SHA |
| `spectree__link_pr` | Set pull request number and URL |

### Validation Checklists (7 tools)

| Tool | Description |
|------|-------------|
| `spectree__add_validation` | Add validation check (command, file_exists, file_contains, test_passes, manual) |
| `spectree__list_validations` | List validation checks for task |
| `spectree__run_validation` | Run single validation check |
| `spectree__run_all_validations` | Run all validations for task |
| `spectree__mark_manual_validated` | Mark manual check as validated |
| `spectree__remove_validation` | Remove validation check |
| `spectree__reset_validations` | Reset all validations to pending |

### Decision Log (4 tools)

| Tool | Description |
|------|-------------|
| `spectree__log_decision` | Record decision with rationale (append-only) |
| `spectree__list_decisions` | List decisions with filters |
| `spectree__search_decisions` | Search decisions by text |
| `spectree__get_decision_context` | Get decisions for current work context |

### Templates (5 tools)

| Tool | Description |
|------|-------------|
| `spectree__list_templates` | List available templates |
| `spectree__get_template` | Get template details |
| `spectree__preview_template` | Preview template expansion |
| `spectree__create_from_template` | Create epic from template |
| `spectree__save_as_template` | Save epic as template |

### Composite Tools (2 tools)

| Tool | Description |
|------|-------------|
| `spectree__create_epic_complete` | Create epic with all features/tasks atomically |
| `spectree__complete_task_with_validation` | Run validations and complete if all pass |

### Workflow Guidance (2 tools)

| Tool | Description |
|------|-------------|
| `spectree__get_next_required_action` | Get context-aware next action guidance |
| `spectree__get_workflow_stages` | Get all workflow stage definitions |

---

## Feature Categories

### Tier 1: Execution Metadata & Progress (Implemented)

**Purpose:** Enable AI agents to understand work order and track progress automatically.

| Feature | Status | Tools |
|---------|--------|-------|
| Execution order | ✅ | `set_execution_metadata`, `get_execution_plan` |
| Dependencies | ✅ | `mark_blocked`, `mark_unblocked` |
| Parallelization | ✅ | `canParallelize`, `parallelGroup` fields |
| Complexity estimates | ✅ | `estimatedComplexity` field |
| Auto-progress tracking | ✅ | `start_work`, `complete_work`, `log_progress` |
| Duration calculation | ✅ | Auto-calculated on completion |

### Tier 2: Session Continuity & Templates (Implemented)

**Purpose:** Enable seamless handoffs between AI sessions and quick project setup.

| Feature | Status | Tools |
|---------|--------|-------|
| Session start/end | ✅ | `start_session`, `end_session` |
| Session handoff | ✅ | Summary, next steps, blockers, decisions |
| Session history | ✅ | `get_session_history`, `get_last_session` |
| AI context | ✅ | `get_ai_context`, `set_ai_context` |
| AI notes (append-only) | ✅ | `append_ai_note` |
| Plan templates | ✅ | Full CRUD + apply + save-as |
| Built-in templates | ✅ | Code Feature, Bug Fix, Refactoring, API Endpoint |

### Tier 3: Code Integration & Validation (Implemented)

**Purpose:** Link code artifacts and define executable acceptance criteria.

| Feature | Status | Tools |
|---------|--------|-------|
| File linking | ✅ | `link_code_file`, `unlink_code_file` |
| Function linking | ✅ | `link_function` |
| Branch linking | ✅ | `link_branch` |
| Commit linking | ✅ | `link_commit` |
| PR linking | ✅ | `link_pr` |
| Structured descriptions | ✅ | `set_structured_description`, etc. |
| Validation checks | ✅ | Command, file exists, file contains, test passes, manual |
| Validation execution | ✅ | `run_validation`, `run_all_validations` |
| Decision logging | ✅ | `log_decision` with categories and impact |
| Decision search | ✅ | `search_decisions`, `get_decision_context` |

### Supporting Features (Implemented)

| Feature | Status | Tools |
|---------|--------|-------|
| Progress dashboard | ✅ | `get_progress_summary` |
| My work queue | ✅ | `get_my_work` |
| Blocked summary | ✅ | `get_blocked_summary` |
| Workflow guidance | ✅ | `get_next_required_action`, `get_workflow_stages` |
| Composite operations | ✅ | `create_epic_complete`, `complete_task_with_validation` |

---

## Implementation Files

### MCP Server Package

| File | Purpose |
|------|---------|
| `packages/mcp/src/index.ts` | Server entry point |
| `packages/mcp/src/api-client.ts` | HTTP client for SpecTree API |
| `packages/mcp/src/tools/index.ts` | Tool registry (21 registrars) |
| `packages/mcp/src/tools/*.ts` | Individual tool modules |

### API Package (AI-related)

| File | Purpose |
|------|---------|
| `packages/api/src/routes/sessions.ts` | Session endpoints |
| `packages/api/src/routes/decisions.ts` | Decision endpoints |
| `packages/api/src/routes/templates.ts` | Template endpoints |
| `packages/api/src/services/sessionService.ts` | Session business logic |
| `packages/api/src/services/decisionService.ts` | Decision business logic |
| `packages/api/src/services/templateService.ts` | Template business logic |
| `packages/api/src/services/featureService.ts` | Feature service (AI fields) |
| `packages/api/src/services/taskService.ts` | Task service (AI fields) |

### Documentation

| File | Purpose |
|------|---------|
| `packages/mcp/README.md` | MCP server setup guide |
| `docs/mcp/tools-reference.md` | Complete tool reference |
| `docs/mcp/ai-native-epic-workflow-guide.md` | "3 prompts" workflow guide |
| `docs/mcp/session-handoff.md` | Session continuity docs |
| `docs/mcp/execution-metadata.md` | Execution planning docs |
| `docs/mcp/structured-descriptions.md` | Rich descriptions docs |
| `docs/mcp/code-context.md` | Code linking docs |
| `docs/mcp/validation-checklists.md` | Validation system docs |
| `docs/mcp/decision-log.md` | Decision logging docs |
| `docs/mcp/progress-summary.md` | Progress tracking docs |
| `docs/mcp/templates.md` | Template system docs |
| `docs/archive/planning/ai-enhancement-proposals.md` | Original enhancement proposals (archived) |

---

## Configuration

### MCP Client Configuration

```json
{
  "mcpServers": {
    "spectree": {
      "command": "node",
      "args": ["/path/to/spectree/packages/mcp/dist/index.js"],
      "env": {
        "API_TOKEN": "st_your-token-here",
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_TOKEN` | Yes | - | SpecTree API token (prefix `st_`) |
| `API_BASE_URL` | No | `http://localhost:3001` | API server URL |

---

## Orchestrator Integration Notes

### What the Orchestrator Manages

The orchestrator CLI (`packages/orchestrator/`) externally manages:

| Concern | How Orchestrator Handles It |
|---------|----------------------------|
| Sessions | Creates/ends sessions via SpecTree API when spawning/completing agents |
| Workflow | Explicitly prompts agents with specific task assignments |
| Progress | Calls `start_work`/`complete_work` API endpoints when assigning work |
| Branches | Creates feature branches before agent execution |
| Context | Passes context to agents via prompts, reads back via API |

### MCP Tools Still Used by Orchestrator

The orchestrator's MCP Bridge (OAS-421) wraps these MCP tools for agent access:

| Tool | Usage |
|------|-------|
| `log_progress` | Agents report incremental progress |
| `log_decision` | Agents record implementation decisions |
| `link_code_file` | Agents report modified files |
| `link_commit` | Orchestrator links commits after agent work |
| `get_task_context` | Agents retrieve task requirements |

### API Endpoints vs MCP Tools

The orchestrator uses **direct API calls** (not MCP) for:
- Session management (`/api/sessions/*`)
- Work state transitions (`/api/features/:id/start-work`, `/api/tasks/:id/complete-work`)
- Branch/PR linking (`/api/features/:id/code-context`)

MCP tools remain available for:
- Non-orchestrator workflows (direct Copilot CLI usage)
- Agent-side operations within orchestrator-managed sessions

---

## Summary

The SpecTree MCP implementation provides:

- **68 MCP tools** across 19 modules
- **3 dedicated database models** (AiSession, Decision, PlanTemplate)
- **14 AI-enhancement fields** per Feature/Task
- **Integration points** for orchestrator-managed workflows

The MCP server and orchestrator CLI are complementary - MCP provides tool-level access for AI agents, while the orchestrator coordinates multi-agent execution externally.
