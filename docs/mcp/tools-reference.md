# MCP Tools Reference

Complete reference for all Dispatcher MCP tools available to AI agents.

---

## Quick Start for AI Agents

**First time using Dispatcher?** Call `dispatcher__get_instructions` to learn about all capabilities:

```
dispatcher__get_instructions({ topic: "all" })
```

This returns comprehensive guidance on:
- Available tools and their usage
- Execution metadata for planning work
- Search and filtering capabilities
- Recommended workflow patterns

---

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| [Help](#help) | 1 | Instructions and guidance |
| [**Composite Tools**](#composite-tools) | **7** | **High-level multi-operation tools (reduces call count)** |
| [Epics](#epics) | 5 | Epic/project management |
| [Features](#features) | 4 | Feature management |
| [Tasks](#tasks) | 4 | Task management |
| [Progress](#progress-tracking) | 4 | Auto-progress tracking |
| [Progress Summary](#progress-summary) | 3 | Dashboard and status summaries |
| [Search](#search) | 1 | Unified search |
| [Statuses](#statuses) | 2 | Workflow status queries |
| [Execution](#execution-planning) | 4 | Execution planning and dependencies |
| [AI Context](#ai-context) | 4 | Cross-session context transfer (includes composite) |
| [Session Handoff](#session-handoff) | 5 | Session lifecycle and handoff |
| [Structured Descriptions](#structured-descriptions) | 7 | Rich structured descriptions (includes composite) |
| [Code Context](#code-context) | 8 | Codebase integration (files, git, PRs, includes composite) |
| [Validation Checklists](#validation-checklists) | 8 | Executable acceptance criteria (includes composite) |
| [Changelog](#changelog) | 1 | Entity change history |
| [Decision Log](#decision-log) | 4 | Append-only decision records |
| [Personal](#personal-scope) | 4 | Personal workspace |
| [Templates](#templates) | 5 | Implementation plan templates |
| [Teams](#teams) | 1 | Team management |
| [Ordering](#ordering) | 4 | Reorder items |

---

## Help

### dispatcher__get_instructions

Get instructions and guidance for using Dispatcher effectively. **Recommended to call at the start of a session.**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | enum | No | Topic to get help on (default: "all") |

**Topics:**
- `all` - Complete instructions (recommended for first-time setup)
- `overview` - Basic concepts and hierarchy
- `execution` - Execution planning and dependencies
- `search` - Filtering and search capabilities
- `workflow` - Recommended work patterns
- `personal` - Personal workspace features

**Example:**
```json
{ "topic": "execution" }
```

---

## Composite Tools

**⚡ High-level tools that consolidate multiple operations into single calls.**

These composite tools use action-based routing to reduce the number of tool calls required for common workflows. Instead of making 3-8 separate calls, you make 1 call with an `action` parameter. This significantly reduces token usage and improves performance.

**Benefits:**
- **Fewer calls**: 1 call instead of 3-8 individual calls
- **Lower latency**: Reduced round-trip time
- **Token efficiency**: Less overhead in tool call formatting
- **Simpler workflows**: Single unified interface per domain

**Recommendation:** Use composite tools whenever possible. The individual tools they consolidate are still available but marked as deprecated.

### dispatcher__create_epic_complete

**Create an entire epic with features and tasks in one atomic operation.**

Replaces 15-30+ individual calls to `create_epic`, `create_feature`, `create_task`, `set_structured_description`, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Epic name |
| `team` | string | Yes | Team name, key, or ID |
| `description` | string | No | Epic description |
| `icon` | string | No | Icon identifier |
| `color` | string | No | Hex color code |
| `features` | array | Yes | Array of feature objects (see below) |

**Feature object structure:**
```json
{
  "title": "Feature title",
  "executionOrder": 1,
  "estimatedComplexity": "moderate",
  "canParallelize": true,
  "parallelGroup": "group-1",
  "dependencies": [0],  // indices of earlier features
  "structuredDesc": {
    "summary": "Brief summary",
    "aiInstructions": "Detailed instructions for AI",
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
    "filesInvolved": ["src/file1.ts"],
    "testingStrategy": "Unit tests + integration tests"
  },
  "tasks": [
    {
      "title": "Task title",
      "executionOrder": 1,
      "estimatedComplexity": "simple",
      "structuredDesc": { /* same as feature */ }
    }
  ]
}
```

**Example:**
```json
{
  "name": "User Authentication System",
  "team": "Engineering",
  "features": [
    {
      "title": "Database Schema",
      "executionOrder": 1,
      "estimatedComplexity": "simple",
      "structuredDesc": {
        "summary": "Create users and sessions tables",
        "aiInstructions": "Use PostgreSQL migrations. Add indexes on email and session_token.",
        "acceptanceCriteria": ["Migration runs successfully", "Indexes created"]
      },
      "tasks": [
        {
          "title": "Create users table migration",
          "estimatedComplexity": "trivial",
          "structuredDesc": {
            "summary": "Add users table with email, hashed_password, created_at"
          }
        }
      ]
    }
  ]
}
```

### dispatcher__complete_task_with_validation

**Run all validations and complete a task atomically if they pass.**

Combines `dispatcher__run_all_validations` + `dispatcher__complete_work`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task UUID or identifier (e.g., "COM-123-1") |
| `summary` | string | No | Summary of work completed |
| `workingDirectory` | string | No | Directory for validation commands |
| `stopOnFirstFailure` | boolean | No | Stop after first failed validation |
| `skipValidations` | boolean | No | Skip validations and complete immediately |

**Behavior:**
- Runs ALL validation checks
- If any fail: returns failure details WITHOUT completing
- If all pass: marks task as Done and records completion timestamp
- If no validations defined: completes immediately

**Example:**
```json
{
  "taskId": "COM-123-1",
  "summary": "Implemented user authentication with JWT tokens. All tests passing.",
  "workingDirectory": "/Users/dev/project"
}
```

### dispatcher__manage_ai_context

**Unified interface for AI context operations (get/set/append).**

Consolidates 3 tools: `dispatcher__get_ai_context`, `dispatcher__set_ai_context`, `dispatcher__append_ai_note`.

**Actions:**
- `get_context`: Retrieve AI context and notes
- `set_context`: Replace entire context field
- `append_note`: Add a note to the notes array

**Get context example:**
```json
{
  "action": "get_context",
  "id": "COM-123",
  "type": "feature"
}
```

**Set context example:**
```json
{
  "action": "set_context",
  "id": "COM-123",
  "type": "feature",
  "context": "## Progress\nImplemented 3 of 5 endpoints...",
  "sessionId": "session-abc"
}
```

**Append note example:**
```json
{
  "action": "append_note",
  "id": "COM-123",
  "type": "feature",
  "noteType": "decision",
  "content": "Chose Express over Fastify for better middleware ecosystem",
  "sessionId": "session-abc"
}
```

### dispatcher__manage_code_context

**Unified interface for code artifact tracking (files, functions, branches, commits, PRs).**

Consolidates 7 tools: `dispatcher__get_code_context`, `dispatcher__link_code_file`, `dispatcher__unlink_code_file`, `dispatcher__link_function`, `dispatcher__link_branch`, `dispatcher__link_commit`, `dispatcher__link_pr`.

**Actions:**
- `get_context`: Get all code artifacts
- `link_file`: Link a file path
- `unlink_file`: Remove a file
- `link_function`: Link a function (file:function)
- `link_branch`: Link git branch
- `link_commit`: Link git commit SHA
- `link_pr`: Link pull request

**Link file example:**
```json
{
  "action": "link_file",
  "id": "COM-123",
  "type": "feature",
  "filePath": "src/auth/jwt.ts"
}
```

**Link branch example:**
```json
{
  "action": "link_branch",
  "id": "COM-123",
  "type": "feature",
  "branchName": "feature/COM-123-auth-system"
}
```

### dispatcher__manage_description

**Unified interface for structured descriptions (get/set/update/add).**

Consolidates 6 tools: `dispatcher__get_structured_description`, `dispatcher__set_structured_description`, `dispatcher__update_section`, `dispatcher__add_acceptance_criterion`, `dispatcher__link_file`, `dispatcher__add_external_link`.

**Actions:**
- `get`: Get structured description
- `set`: Replace entire structured description
- `update_section`: Update one section
- `add_criterion`: Append acceptance criterion
- `link_file`: Add file to filesInvolved
- `add_link`: Add external link

**Set structured description example:**
```json
{
  "action": "set",
  "id": "COM-123",
  "type": "feature",
  "structuredDesc": {
    "summary": "User authentication system",
    "aiInstructions": "Use JWT tokens. Store in httpOnly cookies.",
    "acceptanceCriteria": [
      "Users can register with email/password",
      "Login returns JWT token",
      "Protected routes verify tokens"
    ],
    "filesInvolved": ["src/auth/jwt.ts", "src/middleware/auth.ts"],
    "testingStrategy": "Unit tests + E2E tests with Playwright"
  }
}
```

**Update section example:**
```json
{
  "action": "update_section",
  "id": "COM-123",
  "type": "feature",
  "section": "testingStrategy",
  "value": "Unit tests + integration tests + E2E with Cypress"
}
```

### dispatcher__manage_progress

**Unified interface for progress tracking (start/complete/log/report blocker).**

Consolidates 4 tools: `dispatcher__start_work`, `dispatcher__complete_work`, `dispatcher__log_progress`, `dispatcher__report_blocker`.

**Actions:**
- `start_work`: Begin work (sets status to In Progress)
- `complete_work`: Mark as Done (records completion time)
- `log_progress`: Record incremental progress
- `report_blocker`: Report blocker (sets status to Blocked)

**Start work example:**
```json
{
  "action": "start_work",
  "id": "COM-123-1",
  "type": "task",
  "sessionId": "session-abc"
}
```

**Complete work example:**
```json
{
  "action": "complete_work",
  "id": "COM-123-1",
  "type": "task",
  "summary": "Implemented JWT authentication with proper error handling",
  "sessionId": "session-abc"
}
```

**Log progress example:**
```json
{
  "action": "log_progress",
  "id": "COM-123-1",
  "type": "task",
  "message": "Completed login endpoint. Working on logout endpoint.",
  "percentComplete": 50
}
```

### dispatcher__manage_validations

**Unified interface for validation checks (add/list/run/mark/remove/reset).**

Consolidates 7 tools: `dispatcher__add_validation`, `dispatcher__list_validations`, `dispatcher__run_validation`, `dispatcher__run_all_validations`, `dispatcher__mark_manual_validated`, `dispatcher__remove_validation`, `dispatcher__reset_validations`.

**Actions:**
- `add`: Add a validation check
- `list`: List all checks with status
- `run`: Run a single check
- `run_all`: Run all checks
- `mark_manual`: Mark manual check as validated
- `remove`: Remove a check
- `reset`: Reset all to pending

**Add validation example:**
```json
{
  "action": "add",
  "taskId": "COM-123-1",
  "type": "test_passes",
  "description": "All auth tests pass",
  "testCommand": "npm test -- auth"
}
```

**Run all validations example:**
```json
{
  "action": "run_all",
  "taskId": "COM-123-1",
  "workingDirectory": "/Users/dev/project",
  "stopOnFailure": false
}
```

---

## Epics

### dispatcher__list_epics

List epics with optional filtering by team or scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team` | string | No | Filter by team name, key, or ID |
| `scope` | enum | No | "personal", "team", or "all" (default) |
| `includeArchived` | boolean | No | Include archived epics |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

### dispatcher__get_epic

Get detailed information about a specific epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Epic ID (UUID) or exact name |

### dispatcher__create_epic

Create a new team-scoped epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Epic name |
| `team` | string | Yes | Team name, key, or ID |
| `description` | string | No | Epic description |
| `color` | string | No | Hex color code (e.g., "#FF5733") |
| `icon` | string | No | Icon identifier |

### dispatcher__update_epic

Update an existing epic. Only provided fields are updated.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Epic ID (UUID) or exact name |
| `name` | string | No | New epic name |
| `description` | string | No | New description |
| `color` | string | No | New hex color code |
| `icon` | string | No | New icon identifier |

### dispatcher__reorder_epic

Change epic position within its team.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Epic UUID |
| `afterId` | string | No | Place after this epic |
| `beforeId` | string | No | Place before this epic |

---

## Features

### dispatcher__list_features

List features with optional filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epic` | string | No | Filter by epic name or ID |
| `status` | string | No | Filter by status name or ID |
| `assignee` | string | No | Filter by assignee ("me", "none", email, UUID) |
| `query` | string | No | Text search in title |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

### dispatcher__get_feature

Get detailed information about a feature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature ID (UUID) or identifier (e.g., "COM-123") |

### dispatcher__create_feature

Create a new feature in an epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Feature title |
| `epic` | string | Yes | Epic name or ID |
| `description` | string | No | Markdown description |
| `status` | string | No | Initial status name or ID |
| `assignee` | string | No | Assignee ("me", email, UUID) |
| `executionOrder` | number | No | Execution sequence (1, 2, 3...) |
| `canParallelize` | boolean | No | Can run in parallel |
| `parallelGroup` | string | No | Parallel group identifier |
| `dependencies` | string[] | No | Array of dependency UUIDs |
| `estimatedComplexity` | enum | No | "trivial", "simple", "moderate", "complex" |

### dispatcher__update_feature

Update an existing feature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature ID or identifier |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `status` | string | No | New status |
| `assignee` | string | No | New assignee |
| `executionOrder` | number | No | Execution sequence |
| `canParallelize` | boolean | No | Can run in parallel |
| `parallelGroup` | string | No | Parallel group identifier |
| `dependencies` | string[] | No | Array of dependency UUIDs |
| `estimatedComplexity` | enum | No | Complexity estimate |

---

## Tasks

### dispatcher__list_tasks

List tasks with optional filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feature` | string | No | Filter by parent feature |
| `status` | string | No | Filter by status |
| `assignee` | string | No | Filter by assignee |
| `limit` | number | No | Max results |
| `cursor` | string | No | Pagination cursor |

### dispatcher__get_task

Get detailed information about a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Task ID (UUID) or identifier (e.g., "COM-123-1") |

### dispatcher__create_task

Create a new task under a feature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | Yes | Task title |
| `feature_id` | string | Yes | Parent feature ID or identifier |
| `description` | string | No | Markdown description |
| `status` | string | No | Initial status |
| `assignee` | string | No | Assignee |
| `executionOrder` | number | No | Execution sequence |
| `canParallelize` | boolean | No | Can run in parallel |
| `parallelGroup` | string | No | Parallel group identifier |
| `dependencies` | string[] | No | Array of dependency UUIDs |
| `estimatedComplexity` | enum | No | Complexity estimate |

### dispatcher__update_task

Update an existing task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Task ID or identifier |
| `title` | string | No | New title |
| `description` | string | No | New description |
| `status` | string | No | New status |
| `assignee` | string | No | New assignee |
| `executionOrder` | number | No | Execution sequence |
| `canParallelize` | boolean | No | Can run in parallel |
| `parallelGroup` | string | No | Parallel group identifier |
| `dependencies` | string[] | No | Array of dependency UUIDs |
| `estimatedComplexity` | enum | No | Complexity estimate |

---

## Progress Tracking

These tools make status updates natural and automatic for AI workflows. They track timing, log context, and integrate with the AI notes system.

**⚡ Recommended:** Use the composite tool [`dispatcher__manage_progress`](#dispatcher__manage_progress) for better efficiency.

**Full documentation:** [Progress Tracking](./progress-tracking.md)

### dispatcher__start_work

⚠️ **DEPRECATED:** Use `dispatcher__manage_progress` with `action='start_work'` instead.

Begin working on a feature or task. Sets status to "In Progress" and records start time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `sessionId` | string | No | AI session identifier |

### dispatcher__complete_work

⚠️ **DEPRECATED:** Use `dispatcher__manage_progress` with `action='complete_work'` instead.

Mark a feature or task as complete. Sets status to "Done", calculates duration, and logs summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `summary` | string | No | Summary of work completed |
| `sessionId` | string | No | AI session identifier |

### dispatcher__log_progress

⚠️ **DEPRECATED:** Use `dispatcher__manage_progress` with `action='log_progress'` instead.

Log incremental progress without changing status. Use for long-running work items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `message` | string | Yes | Progress message |
| `percentComplete` | number | No | 0-100 progress indicator |
| `sessionId` | string | No | AI session identifier |

### dispatcher__report_blocker

⚠️ **DEPRECATED:** Use `dispatcher__manage_progress` with `action='report_blocker'` instead.

Report that work is blocked. Records reason and optionally links to blocking item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `reason` | string | Yes | Description of what's blocking |
| `blockedById` | string | No | UUID of blocking item |
| `sessionId` | string | No | AI session identifier |

**Recommended workflow:**
1. Call `dispatcher__start_work` when beginning work
2. Use `dispatcher__log_progress` for significant milestones  
3. Call `dispatcher__report_blocker` if blocked
4. Call `dispatcher__complete_work` when done

---

## Progress Summary

These tools provide comprehensive progress summaries and dashboards for understanding project status. **Recommended at the start of an AI session** to quickly understand what needs attention.

**Full documentation:** [Progress Summary](./progress-summary.md)

### dispatcher__get_progress_summary

Get a comprehensive progress summary for an epic. Includes feature/task counts, completion metrics, blocked items, actionable work, and recent completions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

**Returns:**
- Epic info (id, name, description)
- Feature counts (total, completed, inProgress, blocked)
- Task counts (total, completed, inProgress, blocked)
- Metrics (overallProgress %, estimatedRemaining)
- blockedItems (features/tasks blocking progress)
- nextActionable (unblocked items ready to work on)
- recentlyCompleted (recently finished items)
- lastSession (previous session summary if available)

**Example:**
```json
{
  "epic": { "id": "...", "name": "Q1 Features" },
  "featureCounts": { "total": 10, "completed": 4, "inProgress": 2, "blocked": 1 },
  "taskCounts": { "total": 30, "completed": 15, "inProgress": 5, "blocked": 2 },
  "metrics": { "overallProgress": 50, "estimatedRemaining": "3-5 features" },
  "blockedItems": [...],
  "nextActionable": [...],
  "recentlyCompleted": [...]
}
```

### dispatcher__get_my_work

Get all work items assigned to the current user across all accessible epics. Useful for personal dashboards.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | Uses authenticated user context |

**Returns:**
- Features and tasks assigned to current user
- Grouped by status (inProgress, blocked, todo)
- Epic context for each item

### dispatcher__get_blocked_summary

Get all blocked items across all accessible epics, grouped by epic. Useful for identifying blockers across projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | Uses authenticated user context |

**Returns:**
- All blocked features and tasks
- Blocker reasons and timestamps
- Counts grouped by epic

**Recommended session start workflow:**
1. Call `dispatcher__get_progress_summary` for the epic you're working on
2. Review `blockedItems` for issues needing attention
3. Check `nextActionable` for what to work on next
4. Use `lastSession` context to continue from where previous session left off

---

## Search

### dispatcher__search

Unified search across features and tasks with powerful filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Text search in title/description |
| `epic` | string | No | Filter by epic name or ID |
| `status` | string | No | Filter by status name or ID |
| `statusCategory` | enum | No | "backlog", "unstarted", "started", "completed", "canceled" |
| `assignee` | string | No | "me", "none", email, or UUID |
| `createdAt` | string | No | Created after (ISO date or duration like "-P7D") |
| `updatedAt` | string | No | Updated after (ISO date or duration) |
| `type` | enum | No | "feature", "task", or "all" (default) |
| `limit` | number | No | Max results (default: 50, max: 100) |
| `cursor` | string | No | Pagination cursor |

**Duration format:** `-P{n}D` (days), `-P{n}W` (weeks), `-P{n}M` (months)

**Examples:**
```json
// My in-progress features
{ "assignee": "me", "statusCategory": "started", "type": "feature" }

// Auth-related work from last week
{ "query": "auth", "createdAt": "-P7D" }

// Unassigned tasks in an epic
{ "epic": "Q1 Features", "assignee": "none", "type": "task" }
```

---

## Statuses

### dispatcher__list_statuses

List workflow statuses for a team.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team` | string | Yes | Team name, key, or ID |

### dispatcher__get_status

Get details about a specific status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Status ID or name |
| `team` | string | No | Team context (required when using name) |

---

## Execution Planning

These tools help AI agents plan and execute work intelligently.

### dispatcher__get_execution_plan

Get an ordered execution plan for features in an epic. Returns phases with items grouped by dependencies and parallel execution capability.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

**Response structure:**
```json
{
  "epicId": "uuid",
  "phases": [
    {
      "order": 1,
      "items": [...],
      "canRunInParallel": false,
      "estimatedComplexity": "simple"
    }
  ],
  "totalItems": 5
}
```

### dispatcher__set_execution_metadata

Set execution metadata for a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `executionOrder` | number | No | Suggested sequence (1, 2, 3...) |
| `canParallelize` | boolean | No | Can run alongside other items |
| `parallelGroup` | string | No | Group ID for parallel items |
| `dependencies` | string[] | No | UUIDs of items that must complete first |
| `estimatedComplexity` | enum | No | "trivial", "simple", "moderate", "complex" |

### dispatcher__mark_blocked

Mark a feature or task as blocked by another item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Blocked item ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `blockedById` | string | Yes | UUID of the blocking item |

### dispatcher__mark_unblocked

Remove a blocker from a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Item ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `unblockedFromId` | string | Yes | UUID of blocker to remove |

---

## AI Context

AI sessions can store and retrieve context about features, tasks, and epics. This enables cross-session continuity where one AI session can pick up where another left off.

**⚡ Recommended:** Use the composite tool [`dispatcher__manage_ai_context`](#dispatcher__manage_ai_context) for better efficiency.

**Full documentation:** [AI Session Context](./ai-session-context.md)

### dispatcher__get_ai_context

⚠️ **DEPRECATED:** Use `dispatcher__manage_ai_context` with `action='get_context'` instead.

Retrieve AI context for a feature or task. Returns structured context and notes from previous sessions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier (e.g., "COM-123") |
| `type` | enum | Yes | "feature" or "task" |

**Response structure:**
```json
{
  "entityType": "feature",
  "entityId": "uuid",
  "identifier": "COM-123",
  "aiContext": "Structured context from last session...",
  "aiNotes": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "sessionId": "session-abc",
      "type": "decision",
      "content": "Chose to use React Query for data fetching..."
    }
  ],
  "lastAiSessionId": "session-abc",
  "lastAiUpdateAt": "2024-01-15T10:30:00Z"
}
```

### dispatcher__set_ai_context

⚠️ **DEPRECATED:** Use `dispatcher__manage_ai_context` with `action='set_context'` instead.

Set structured context for a feature or task. This replaces the entire AI context field.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `context` | string | Yes | Structured context (max 50,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Use this to store:** Summary of current state, structured data (JSON), key decisions, technical notes.

### dispatcher__append_ai_note

⚠️ **DEPRECATED:** Use `dispatcher__manage_ai_context` with `action='append_note'` instead.

Append a note to a feature or task's AI notes array. Notes are never overwritten, only appended.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `noteType` | enum | Yes | Type of note (see below) |
| `content` | string | Yes | Note content (max 10,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Note types:**
| Type | When to use |
|------|-------------|
| `observation` | What you noticed or discovered |
| `decision` | A choice made and why |
| `blocker` | What's preventing progress |
| `next-step` | What should happen next |
| `context` | General background information |

**Example workflow:**
```json
// At start of session, read context
{ "id": "COM-123", "type": "feature" }

// During work, log observations
{ "id": "COM-123", "type": "feature", "noteType": "observation", 
  "content": "Found existing auth implementation in src/auth/" }

// Log a decision
{ "id": "COM-123", "type": "feature", "noteType": "decision",
  "content": "Decided to extend existing auth rather than replace it" }

// At end of session, set summary context
{ "id": "COM-123", "type": "feature",
  "context": "## Status\nPartially implemented...",
  "sessionId": "session-xyz" }
```

---

## Session Handoff

The Session Handoff System enables AI sessions to preserve context for successor sessions at the epic level. See [Session Handoff](./session-handoff.md) for full documentation.

### dispatcher__start_session

Start a new AI session for an epic. Abandons any existing active sessions and returns handoff from previous session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `externalId` | string | No | External session identifier |

**Returns:** Session details, previous session handoff (summary, nextSteps, blockers, decisions), and epic progress summary.

### dispatcher__end_session

End the current session with handoff data for successors.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `summary` | string | Yes | Summary of work completed (max 10,000 chars) |
| `nextSteps` | string[] | No | Recommended next actions (max 20 items) |
| `blockers` | string[] | No | Blockers encountered (max 20 items) |
| `decisions` | object[] | No | Array of {decision, rationale} (max 20 items) |
| `contextBlob` | string | No | Serialized context (max 50,000 chars) |

### dispatcher__get_last_session

Get the last completed session without starting a new one.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

### dispatcher__get_session_history

Get history of all sessions for an epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `limit` | number | No | Max results (default: 10, max: 100) |

### dispatcher__get_active_session

Check if there's an active session for an epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

---

## Structured Descriptions

These tools enable AI agents to work with structured, AI-friendly descriptions that break down work items into extractable sections.

**⚡ Recommended:** Use the composite tool [`dispatcher__manage_description`](#dispatcher__manage_description) for better efficiency.

**Full documentation:** [Structured Descriptions](./structured-descriptions.md)

### dispatcher__get_structured_description

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='get'` instead.

Get the parsed structured description from a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |

**Returns:** Full `StructuredDescription` object or `null` if not set.

### dispatcher__set_structured_description

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='set'` instead.

Replace the entire structured description.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `structuredDescription` | object | Yes | Full StructuredDescription object |

### dispatcher__update_section

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='update_section'` instead.

Update a single section without affecting others (recommended approach).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `section` | enum | Yes | Section name (see below) |
| `value` | any | Yes | New value for the section |

**Sections:** `summary`, `aiInstructions`, `acceptanceCriteria`, `filesInvolved`, `functionsToModify`, `testingStrategy`, `testFiles`, `relatedItemIds`, `externalLinks`, `technicalNotes`, `riskLevel`, `estimatedEffort`

### dispatcher__add_acceptance_criterion

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='add_criterion'` instead.

Append an acceptance criterion to the list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `criterion` | string | Yes | Criterion to add |

### dispatcher__link_file

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='link_file'` instead.

Add a file path to filesInvolved.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to link |

### dispatcher__add_external_link

⚠️ **DEPRECATED:** Use `dispatcher__manage_description` with `action='add_link'` instead.

Add an external URL reference.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `url` | string | Yes | URL to add |
| `title` | string | No | Link title |
| `description` | string | No | Link description |

---

## Code Context

Code Context tools link features and tasks directly to code artifacts (files, functions, git branches, commits, PRs). This enables AI agents to instantly understand the code context for any work item.

**⚡ Recommended:** Use the composite tool [`dispatcher__manage_code_context`](#dispatcher__manage_code_context) for better efficiency.

**Full documentation:** [Code Context](./code-context.md)

**Difference from Structured Descriptions:**
- Structured descriptions (`filesInvolved`) = files you *plan* to modify
- Code context (`relatedFiles`) = files you *actually* modified

### dispatcher__get_code_context

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='get_context'` instead.

Get all code artifacts (files, functions, branch, commits, PR) for a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |

### dispatcher__link_code_file

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='link_file'` instead.

Add a source file to a feature or task's related files list. Duplicates are silently ignored.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to link |

### dispatcher__unlink_code_file

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='unlink_file'` instead.

Remove a source file from the related files list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to unlink |

### dispatcher__link_function

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='link_function'` instead.

Add a function reference. Functions are stored as `"filePath:functionName"`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File containing the function |
| `functionName` | string | Yes | Function/method name |

### dispatcher__link_branch

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='link_branch'` instead.

Set the git branch for a feature or task. Only one branch per item (replaces previous).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `branch` | string | Yes | Git branch name |

### dispatcher__link_commit

Add a commit SHA to the commits list. Duplicates are ignored; commits accumulate.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `commitSha` | string | Yes | Git commit SHA |

### dispatcher__link_pr

⚠️ **DEPRECATED:** Use `dispatcher__manage_code_context` with `action='link_pr'` instead.

Link a pull request. Only one PR per item (replaces previous).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `prNumber` | number | Yes | Pull request number |
| `prUrl` | string | No | Pull request URL |

### dispatcher__get_code_context

Get all code context for a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |

**Returns:**
```json
{
  "relatedFiles": ["src/services/userService.ts"],
  "relatedFunctions": ["src/services/userService.ts:createUser"],
  "gitBranch": "feature/COM-123-user-auth",
  "gitCommits": ["abc123def456"],
  "gitPrNumber": 42,
  "gitPrUrl": "https://github.com/org/repo/pull/42"
}
```

---

## Validation Checklists

Validation checklists allow tasks to have executable acceptance criteria that verify work is truly "done".

**⚡ Recommended:** Use the composite tool [`dispatcher__manage_validations`](#dispatcher__manage_validations) for better efficiency.

**Full documentation:** [Validation Checklists](./validation-checklists.md)

### dispatcher__add_validation

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='add'` instead.

Add a validation check to a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier (UUID or "COM-123-1") |
| `type` | enum | Yes | Check type: command, file_exists, file_contains, test_passes, manual |
| `description` | string | Yes | Human-readable description |
| `command` | string | For command | Shell command to run |
| `expectedExitCode` | number | No | Expected exit code (default: 0) |
| `timeoutMs` | number | No | Timeout in ms (default: 30000, max: 300000) |
| `filePath` | string | For file_exists/contains | File path to check |
| `searchPattern` | string | For file_contains | Regex pattern to search |
| `testCommand` | string | For test_passes | Test command to run |

**Example:**
```json
{
  "taskId": "COM-123-1",
  "type": "command",
  "description": "Tests pass",
  "command": "pnpm test"
}
```

### dispatcher__list_validations

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='list'` instead.

List all validation checks for a task with status summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |

**Returns:**
```json
{
  "checks": [...],
  "summary": { "total": 3, "passed": 2, "failed": 0, "pending": 1 }
}
```

### dispatcher__run_validation

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='run'` instead.

Run a single validation check.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Validation check ID |
| `workingDirectory` | string | No | Working directory for execution |

### dispatcher__run_all_validations

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='run_all'` instead. Or use `dispatcher__complete_task_with_validation` to run validations and complete the task atomically.

Run all automated validation checks for a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `stopOnFailure` | boolean | No | Stop after first failure (default: false) |
| `workingDirectory` | string | No | Working directory for execution |

**Returns:**
```json
{
  "totalChecks": 4,
  "passed": 3,
  "failed": 1,
  "pending": 0,
  "allPassed": false,
  "results": [...]
}
```

### dispatcher__mark_manual_validated

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='mark_manual'` instead.

Mark a manual validation check as passed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Manual validation check ID |
| `notes` | string | No | Notes about verification |

### dispatcher__remove_validation

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='remove'` instead.

Remove a validation check from a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Validation check ID |

### dispatcher__reset_validations

⚠️ **DEPRECATED:** Use `dispatcher__manage_validations` with `action='reset'` instead.

Reset all validation checks to pending status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |

---

## Changelog

Query entity change history to understand how features, tasks, and epics evolved over time. Returns field-level changes with timestamps.

### dispatcher__get_changelog

Get change history for an entity with field-level details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityType` | enum | Yes | "epic", "feature", or "task" |
| `entityId` | string | Yes | UUID of the entity |
| `epicId` | UUID | No | Filter by epic ID |
| `field` | string | No | Filter by specific field (e.g., "statusId", "title") |
| `changedBy` | UUID | No | Filter by user who made the change |
| `since` | string | No | Filter changes after date (ISO-8601 or duration like "-P7D") |
| `until` | string | No | Filter changes before date (ISO-8601) |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

**Use cases:**
- Track status changes over time
- Find who changed a specific field
- Audit changes within a date range
- Review epic-wide changes

**Example:**
```json
{
  "entityType": "feature",
  "entityId": "550e8400-...",
  "field": "statusId",
  "since": "-P7D"
}
```

---

## Decision Log

Record implementation decisions with their rationale. Creates an append-only audit trail.

> **📚 Full Documentation**: See [Decision Log Guide](./decision-log.md) for complete details and best practices.

### dispatcher__log_decision

Record a new decision with its rationale.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | UUID | Yes | Epic this decision relates to |
| `featureId` | UUID | No | Feature this decision relates to |
| `taskId` | UUID | No | Task this decision relates to |
| `question` | string | Yes | What was being decided |
| `decision` | string | Yes | The choice that was made |
| `rationale` | string | Yes | Why this choice was made |
| `alternatives` | string[] | No | Other options considered |
| `madeBy` | string | No | Who made the decision (default: "AI") |
| `category` | enum | No | Category: architecture, library, approach, scope, design, tradeoff, deferral |
| `impact` | enum | No | Impact level: low, medium, high |

### dispatcher__list_decisions

List decisions with optional filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | UUID | No | Filter by epic |
| `featureId` | UUID | No | Filter by feature |
| `taskId` | UUID | No | Filter by task |
| `category` | enum | No | Filter by category |
| `impact` | enum | No | Filter by impact level |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

### dispatcher__search_decisions

Search decisions by text in question, decision, and rationale.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `epicId` | UUID | No | Limit to specific epic |
| `limit` | number | No | Max results (default: 20) |
| `cursor` | string | No | Pagination cursor |

### dispatcher__get_decision_context

Get all decisions related to current work (task or feature level).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | No | Task identifier (returns task + feature + epic decisions) |
| `featureId` | string | No | Feature identifier (returns feature + epic decisions) |

One of `taskId` or `featureId` is required.

---

## Personal Scope

Each user has a private personal scope for work not shared with any team.

### dispatcher__get_personal_scope

Get or create the user's personal scope.

*No parameters required.*

### dispatcher__list_personal_projects

List epics/projects in the personal scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results |
| `cursor` | string | No | Pagination cursor |

### dispatcher__create_personal_project

Create an epic in the personal scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description |
| `color` | string | No | Hex color code |
| `icon` | string | No | Icon identifier |

### dispatcher__list_personal_statuses

List workflow statuses in the personal scope.

*No parameters required.*

---

## Teams

Manage and query team information.

### dispatcher__list_teams

List all teams the authenticated user has access to.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| None | - | - | Returns all accessible teams |

**Returns:** Array of teams with id, name, key, and team metadata.

**Use this to:**
- Discover available teams before creating epics
- Find team keys for referencing in other operations
- List team-specific workflow statuses

**Example response:**
```json
{
  "teams": [
    {
      "id": "550e8400-...",
      "name": "Engineering",
      "key": "ENG",
      "description": "Core engineering team"
    },
    {
      "id": "660e9500-...",
      "name": "Design",
      "key": "DES"
    }
  ]
}
```

---

## Templates

Implementation plan templates enable creating standardized epic/feature/task structures from reusable definitions. Templates use `{{variable}}` placeholders that are substituted when creating work items.

### dispatcher__list_templates

List available templates with optional filtering by built-in status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `builtInOnly` | boolean | No | Filter to only built-in templates |

**Example:**
```json
{ "builtInOnly": true }
```

### dispatcher__get_template

Get detailed information about a specific template including its structure and variables.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Template name or ID |

**Returns:** Template structure, required variables, and preview of what will be created.

### dispatcher__preview_template

Preview what will be created from a template without actually creating anything.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateName` | string | Yes | Template name to preview |
| `epicName` | string | Yes | Name for the resulting epic |
| `variables` | object | No | Variable substitutions |

**Example:**
```json
{
  "templateName": "Code Feature",
  "epicName": "User Authentication",
  "variables": {
    "featureName": "OAuth Login",
    "moduleName": "auth"
  }
}
```

### dispatcher__create_from_template

Create a full epic/feature/task structure from a template.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateName` | string | Yes | Template name to use |
| `epicName` | string | Yes | Name for the resulting epic |
| `team` | string | Yes | Team name, key, or ID |
| `variables` | object | No | Variable substitutions |

**Example:**
```json
{
  "templateName": "Code Feature",
  "epicName": "User Authentication",
  "team": "Backend",
  "variables": {
    "featureName": "OAuth Login",
    "moduleName": "auth"
  }
}
```

**Returns:** Created epic, features, and tasks with identifiers.

### dispatcher__save_as_template

Save an existing epic's structure as a new template for reuse.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) to save as template |
| `templateName` | string | Yes | Name for the new template |
| `description` | string | No | Template description |

**Example:**
```json
{
  "epicId": "550e8400-e29b-41d4-a716-446655440000",
  "templateName": "My Custom Workflow",
  "description": "Standard workflow for API endpoints"
}
```

### Built-in Templates

The system includes these built-in templates:

| Template | Description | Features |
|----------|-------------|----------|
| **Code Feature** | Standard feature implementation | Design, Implement, Test, Document |
| **Bug Fix** | Bug investigation and fix workflow | Investigate, Reproduce, Fix, Verify |
| **Refactoring** | Code refactoring workflow | Analysis, Implementation, Testing |
| **API Endpoint** | New API endpoint development | Design, Implementation, Testing, Documentation |

Built-in templates cannot be modified or deleted.

---

## Ordering

**Note:** Individual reorder tools are deprecated. Use `dispatcher__reorder_item` instead for a unified interface.

### dispatcher__reorder_item

**Unified interface for reordering epics, features, and tasks.**

Consolidates 3 tools: `dispatcher__reorder_epic`, `dispatcher__reorder_feature`, `dispatcher__reorder_task`.

**Actions:**
- `reorder_epic`: Change epic position within team
- `reorder_feature`: Change feature position within epic
- `reorder_task`: Change task position within feature

**Parameters:**
- `action`: "reorder_epic", "reorder_feature", or "reorder_task"
- `id`: UUID of the item to reorder
- `afterId`: UUID of item to place after (optional)
- `beforeId`: UUID of item to place before (optional)

**Example:**
```json
{
  "action": "reorder_feature",
  "id": "550e8400-...",
  "afterId": "660e9500-..."
}
```

### dispatcher__reorder_epic

⚠️ **DEPRECATED:** Use `dispatcher__reorder_item` with `action='reorder_epic'` instead.

*See [Epics](#dispatcher__reorder_epic) section.*

### dispatcher__reorder_feature

⚠️ **DEPRECATED:** Use `dispatcher__reorder_item` with `action='reorder_feature'` instead.

Change feature position within its epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature UUID |
| `afterId` | string | No | Place after this feature |
| `beforeId` | string | No | Place before this feature |

### dispatcher__reorder_task

⚠️ **DEPRECATED:** Use `dispatcher__reorder_item` with `action='reorder_task'` instead.

Change task position within its feature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Task UUID |
| `afterId` | string | No | Place after this task |
| `beforeId` | string | No | Place before this task |

---

## Complexity Estimates

When setting `estimatedComplexity`, use these guidelines:

| Value | Time Estimate | Description |
|-------|---------------|-------------|
| `trivial` | < 1 hour | Quick fix, config change, typo |
| `simple` | 1-4 hours | Small feature, bug fix |
| `moderate` | 1-3 days | Medium feature, refactoring |
| `complex` | > 3 days | Large feature, architectural change |

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "content": [{ "type": "text", "text": "Error: <message>" }],
  "isError": true
}
```

Common errors:
- **404** - Resource not found
- **401** - Invalid or expired API token
- **403** - Access denied (not a team member)
- **400** - Validation error (invalid parameters)

---

## Related Documentation

- [Progress Tracking](./progress-tracking.md) - Auto-progress tracking tools guide
- [Execution Metadata](./execution-metadata.md) - Detailed execution planning guide
- [AI Session Context](./ai-session-context.md) - Cross-session context transfer guide
- [Session Handoff](./session-handoff.md) - Epic-level session lifecycle and handoff
- [Structured Descriptions](./structured-descriptions.md) - Rich structured descriptions guide
- [Decision Log](./decision-log.md) - Append-only decision records guide
- [API Token Authentication](./api-token-authentication.md) - Token system details
- [Security Architecture](./security-architecture.md) - Security model
