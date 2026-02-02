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
| [Search](#search) | 1 | Unified search |
| [Statuses](#statuses) | 2 | Workflow status queries |
| [Execution](#execution-planning) | 4 | Execution planning and dependencies |
| [Personal](#personal-scope) | 4 | Personal workspace |
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

- [Execution Metadata](./execution-metadata.md) - Detailed execution planning guide
- [API Token Authentication](./api-token-authentication.md) - Token system details
- [Security Architecture](./security-architecture.md) - Security model
