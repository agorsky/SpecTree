# MCP Tools Reference

Complete reference for all SpecTree MCP tools available to AI agents.

---

## Quick Start for AI Agents

**First time using SpecTree?** Call `spectree__get_instructions` to learn about all capabilities:

```
spectree__get_instructions({ topic: "all" })
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
| [Epics](#epics) | 4 | Epic/project management |
| [Features](#features) | 4 | Feature management |
| [Tasks](#tasks) | 4 | Task management |
| [Progress](#progress-tracking) | 4 | Auto-progress tracking |
| [Progress Summary](#progress-summary) | 3 | Dashboard and status summaries |
| [Search](#search) | 1 | Unified search |
| [Statuses](#statuses) | 2 | Workflow status queries |
| [Execution](#execution-planning) | 4 | Execution planning and dependencies |
| [AI Context](#ai-context) | 3 | Cross-session context transfer |
| [Session Handoff](#session-handoff) | 6 | Session lifecycle and handoff |
| [Structured Descriptions](#structured-descriptions) | 6 | Rich structured descriptions |
| [Code Context](#code-context) | 7 | Codebase integration (files, git, PRs) |
| [Validation Checklists](#validation-checklists) | 7 | Executable acceptance criteria |
| [Personal](#personal-scope) | 4 | Personal workspace |
| [Templates](#templates) | 5 | Implementation plan templates |
| [Ordering](#ordering) | 3 | Reorder items |

---

## Help

### spectree__get_instructions

Get instructions and guidance for using SpecTree effectively. **Recommended to call at the start of a session.**

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

## Epics

### spectree__list_epics

List epics with optional filtering by team or scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team` | string | No | Filter by team name, key, or ID |
| `scope` | enum | No | "personal", "team", or "all" (default) |
| `includeArchived` | boolean | No | Include archived epics |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

### spectree__get_epic

Get detailed information about a specific epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Epic ID (UUID) or exact name |

### spectree__create_epic

Create a new team-scoped epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Epic name |
| `team` | string | Yes | Team name, key, or ID |
| `description` | string | No | Epic description |
| `color` | string | No | Hex color code (e.g., "#FF5733") |
| `icon` | string | No | Icon identifier |

### spectree__reorder_epic

Change epic position within its team.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Epic UUID |
| `afterId` | string | No | Place after this epic |
| `beforeId` | string | No | Place before this epic |

---

## Features

### spectree__list_features

List features with optional filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epic` | string | No | Filter by epic name or ID |
| `status` | string | No | Filter by status name or ID |
| `assignee` | string | No | Filter by assignee ("me", "none", email, UUID) |
| `query` | string | No | Text search in title |
| `limit` | number | No | Max results (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

### spectree__get_feature

Get detailed information about a feature.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature ID (UUID) or identifier (e.g., "COM-123") |

### spectree__create_feature

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

### spectree__update_feature

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

### spectree__list_tasks

List tasks with optional filtering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feature` | string | No | Filter by parent feature |
| `status` | string | No | Filter by status |
| `assignee` | string | No | Filter by assignee |
| `limit` | number | No | Max results |
| `cursor` | string | No | Pagination cursor |

### spectree__get_task

Get detailed information about a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Task ID (UUID) or identifier (e.g., "COM-123-1") |

### spectree__create_task

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

### spectree__update_task

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

**Full documentation:** [Progress Tracking](./progress-tracking.md)

### spectree__start_work

Begin working on a feature or task. Sets status to "In Progress" and records start time.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `sessionId` | string | No | AI session identifier |

### spectree__complete_work

Mark a feature or task as complete. Sets status to "Done", calculates duration, and logs summary.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `summary` | string | No | Summary of work completed |
| `sessionId` | string | No | AI session identifier |

### spectree__log_progress

Log incremental progress without changing status. Use for long-running work items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `message` | string | Yes | Progress message |
| `percentComplete` | number | No | 0-100 progress indicator |
| `sessionId` | string | No | AI session identifier |

### spectree__report_blocker

Report that work is blocked. Records reason and optionally links to blocking item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `reason` | string | Yes | Description of what's blocking |
| `blockedById` | string | No | UUID of blocking item |
| `sessionId` | string | No | AI session identifier |

**Recommended workflow:**
1. Call `spectree__start_work` when beginning work
2. Use `spectree__log_progress` for significant milestones  
3. Call `spectree__report_blocker` if blocked
4. Call `spectree__complete_work` when done

---

## Progress Summary

These tools provide comprehensive progress summaries and dashboards for understanding project status. **Recommended at the start of an AI session** to quickly understand what needs attention.

**Full documentation:** [Progress Summary](./progress-summary.md)

### spectree__get_progress_summary

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

### spectree__get_my_work

Get all work items assigned to the current user across all accessible epics. Useful for personal dashboards.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | Uses authenticated user context |

**Returns:**
- Features and tasks assigned to current user
- Grouped by status (inProgress, blocked, todo)
- Epic context for each item

### spectree__get_blocked_summary

Get all blocked items across all accessible epics, grouped by epic. Useful for identifying blockers across projects.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| (none) | - | - | Uses authenticated user context |

**Returns:**
- All blocked features and tasks
- Blocker reasons and timestamps
- Counts grouped by epic

**Recommended session start workflow:**
1. Call `spectree__get_progress_summary` for the epic you're working on
2. Review `blockedItems` for issues needing attention
3. Check `nextActionable` for what to work on next
4. Use `lastSession` context to continue from where previous session left off

---

## Search

### spectree__search

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

### spectree__list_statuses

List workflow statuses for a team.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team` | string | Yes | Team name, key, or ID |

### spectree__get_status

Get details about a specific status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Status ID or name |
| `team` | string | No | Team context (required when using name) |

---

## Execution Planning

These tools help AI agents plan and execute work intelligently.

### spectree__get_execution_plan

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

### spectree__set_execution_metadata

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

### spectree__mark_blocked

Mark a feature or task as blocked by another item.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Blocked item ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `blockedById` | string | Yes | UUID of the blocking item |

### spectree__mark_unblocked

Remove a blocker from a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Item ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `unblockedFromId` | string | Yes | UUID of blocker to remove |

---

## AI Context

These tools enable AI sessions to store and retrieve context, enabling cross-session continuity and knowledge transfer. When an AI session works on a task, it can leave notes and context for the next session.

### spectree__get_ai_context

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

### spectree__set_ai_context

Set structured context for a feature or task. This replaces the entire AI context field.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `context` | string | Yes | Structured context (max 50,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Use this to store:** Summary of current state, structured data (JSON), key decisions, technical notes.

### spectree__append_ai_note

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

### spectree__start_session

Start a new AI session for an epic. Abandons any existing active sessions and returns handoff from previous session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `externalId` | string | No | External session identifier |

**Returns:** Session details, previous session handoff (summary, nextSteps, blockers, decisions), and epic progress summary.

### spectree__end_session

End the current session with handoff data for successors.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `summary` | string | Yes | Summary of work completed (max 10,000 chars) |
| `nextSteps` | string[] | No | Recommended next actions (max 20 items) |
| `blockers` | string[] | No | Blockers encountered (max 20 items) |
| `decisions` | object[] | No | Array of {decision, rationale} (max 20 items) |
| `contextBlob` | string | No | Serialized context (max 50,000 chars) |

### spectree__get_last_session

Get the last completed session without starting a new one.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

### spectree__get_session_history

Get history of all sessions for an epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `limit` | number | No | Max results (default: 10, max: 100) |

### spectree__get_active_session

Check if there's an active session for an epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |

### spectree__log_session_work

Manually log work on an item to the active session. Usually called automatically by `spectree__start_work` and `spectree__complete_work`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `epicId` | string | Yes | Epic ID (UUID) or exact name |
| `itemId` | string | Yes | UUID of feature or task |
| `itemType` | enum | Yes | "feature" or "task" |
| `identifier` | string | Yes | Human-readable identifier (e.g., "COM-123") |
| `action` | string | Yes | Action performed (e.g., "started", "completed") |

---

## Structured Descriptions

These tools enable AI agents to work with structured, AI-friendly descriptions that break down work items into extractable sections. See [Structured Descriptions](./structured-descriptions.md) for full documentation.

### spectree__get_structured_description

Get the parsed structured description from a feature or task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |

**Returns:** Full `StructuredDescription` object or `null` if not set.

### spectree__set_structured_description

Replace the entire structured description.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `structuredDescription` | object | Yes | Full StructuredDescription object |

### spectree__update_section

Update a single section without affecting others (recommended approach).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `section` | enum | Yes | Section name (see below) |
| `value` | any | Yes | New value for the section |

**Sections:** `summary`, `aiInstructions`, `acceptanceCriteria`, `filesInvolved`, `functionsToModify`, `testingStrategy`, `testFiles`, `relatedItemIds`, `externalLinks`, `technicalNotes`, `riskLevel`, `estimatedEffort`

### spectree__add_acceptance_criterion

Append an acceptance criterion to the list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `criterion` | string | Yes | Criterion to add |

### spectree__link_file

Add a file path to filesInvolved.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to link |

### spectree__add_external_link

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

Code Context tools link features and tasks directly to code artifacts (files, functions, git branches, commits, PRs). This enables AI agents to instantly understand the code context for any work item. See [Code Context](./code-context.md) for full documentation.

**Difference from Structured Descriptions:**
- Structured descriptions (`filesInvolved`) = files you *plan* to modify
- Code context (`relatedFiles`) = files you *actually* modified

### spectree__link_code_file

Add a source file to a feature or task's related files list. Duplicates are silently ignored.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to link |

### spectree__unlink_code_file

Remove a source file from the related files list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File path to unlink |

### spectree__link_function

Add a function reference. Functions are stored as `"filePath:functionName"`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `filePath` | string | Yes | File containing the function |
| `functionName` | string | Yes | Function/method name |

### spectree__link_branch

Set the git branch for a feature or task. Only one branch per item (replaces previous).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `branch` | string | Yes | Git branch name |

### spectree__link_commit

Add a commit SHA to the commits list. Duplicates are ignored; commits accumulate.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `commitSha` | string | Yes | Git commit SHA |

### spectree__link_pr

Link a pull request. Only one PR per item (replaces previous).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature/task ID or identifier |
| `type` | enum | Yes | "feature" or "task" |
| `prNumber` | number | Yes | Pull request number |
| `prUrl` | string | No | Pull request URL |

### spectree__get_code_context

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

Validation checklists allow tasks to have executable acceptance criteria that verify work is truly "done". See [Validation Checklists](./validation-checklists.md) for full documentation.

### spectree__add_validation

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

### spectree__list_validations

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

### spectree__run_validation

Run a single validation check.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Validation check ID |
| `workingDirectory` | string | No | Working directory for execution |

### spectree__run_all_validations

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

### spectree__mark_manual_validated

Mark a manual validation check as passed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Manual validation check ID |
| `notes` | string | No | Notes about verification |

### spectree__remove_validation

Remove a validation check from a task.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |
| `checkId` | string (UUID) | Yes | Validation check ID |

### spectree__reset_validations

Reset all validation checks to pending status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | Yes | Task identifier |

---

## Personal Scope

Each user has a private personal scope for work not shared with any team.

### spectree__get_personal_scope

Get or create the user's personal scope.

*No parameters required.*

### spectree__list_personal_projects

List epics/projects in the personal scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max results |
| `cursor` | string | No | Pagination cursor |

### spectree__create_personal_project

Create an epic in the personal scope.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description |
| `color` | string | No | Hex color code |
| `icon` | string | No | Icon identifier |

### spectree__list_personal_statuses

List workflow statuses in the personal scope.

*No parameters required.*

---

## Templates

Implementation plan templates enable creating standardized epic/feature/task structures from reusable definitions. Templates use `{{variable}}` placeholders that are substituted when creating work items.

### spectree__list_templates

List available templates with optional filtering by built-in status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `builtInOnly` | boolean | No | Filter to only built-in templates |

**Example:**
```json
{ "builtInOnly": true }
```

### spectree__get_template

Get detailed information about a specific template including its structure and variables.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Template name or ID |

**Returns:** Template structure, required variables, and preview of what will be created.

### spectree__preview_template

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

### spectree__create_from_template

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

### spectree__save_as_template

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

### spectree__reorder_epic

*See [Epics](#spectree__reorder_epic) section.*

### spectree__reorder_feature

Change feature position within its epic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Feature UUID |
| `afterId` | string | No | Place after this feature |
| `beforeId` | string | No | Place before this feature |

### spectree__reorder_task

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
- [API Token Authentication](./api-token-authentication.md) - Token system details
- [Security Architecture](./security-architecture.md) - Security model
