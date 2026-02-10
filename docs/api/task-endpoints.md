# Task API Endpoints

This document describes the API endpoints for managing tasks in SpecTree.

## Overview

Tasks are sub-issues that belong to a parent feature. They are used to break down features into smaller, actionable work items. Each task has an auto-generated identifier based on its parent feature (e.g., if the feature is `ENG-42`, tasks are `ENG-42-1`, `ENG-42-2`, etc.). Tasks support all the same metadata as features: status, assignee, structured descriptions, AI context, code context, progress tracking, and validation checks.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- User must have access to the team that owns the task's feature
- Minimum role requirements vary by endpoint (documented per endpoint)

---

## Core CRUD Endpoints

### GET /api/v1/tasks

List tasks with cursor-based pagination and filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Results per page (default: 20, max: 100) |
| `featureId` | UUID \| identifier | Filter by parent feature (e.g., "ENG-42") |
| `status` | string \| string[] | Filter by status name or ID (supports multiple) |
| `statusCategory` | string | Filter by status category: `backlog`, `unstarted`, `started`, `completed`, `canceled` |
| `assignee` | string | Filter by assignee: `me`, `none`, email, or UUID |
| `query` | string | Search in title and description (case-insensitive) |
| `createdAt` | ISO-8601 | Filter by creation date (on or after) |
| `createdBefore` | ISO-8601 | Filter by creation date (before) |
| `updatedAt` | ISO-8601 | Filter by update date (on or after) |
| `updatedBefore` | ISO-8601 | Filter by update date (before) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "featureId": "feature-uuid",
      "identifier": "ENG-42-1",
      "title": "Create OAuth provider configuration",
      "description": "Set up Passport.js strategies for Google and GitHub",
      "statusId": "status-uuid",
      "assigneeId": "user-uuid",
      "sortOrder": 1000,
      "executionOrder": 1,
      "canParallelize": false,
      "parallelGroup": null,
      "dependencies": [],
      "estimatedComplexity": "simple",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "startedAt": "2024-01-15T11:00:00.000Z",
      "completedAt": null,
      "status": {
        "id": "status-uuid",
        "name": "In Progress",
        "category": "started",
        "color": "#3B82F6"
      },
      "assignee": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@toro.com"
      },
      "feature": {
        "id": "feature-uuid",
        "identifier": "ENG-42",
        "title": "User Authentication"
      }
    }
  ],
  "meta": {
    "hasMore": true,
    "cursor": "next-cursor-id"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

---

### GET /api/v1/tasks/:id

Get a single task by ID or identifier (e.g., `ENG-42-1`).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Task ID or identifier (e.g., "ENG-42-1") |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "featureId": "feature-uuid",
    "identifier": "ENG-42-1",
    "title": "Create OAuth provider configuration",
    "description": "Set up Passport.js strategies for Google and GitHub",
    "statusId": "status-uuid",
    "assigneeId": "user-uuid",
    "sortOrder": 1000,
    "executionOrder": 1,
    "canParallelize": false,
    "parallelGroup": null,
    "dependencies": [],
    "estimatedComplexity": "simple",
    "percentComplete": 80,
    "blockerReason": null,
    "durationMinutes": 120,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "startedAt": "2024-01-15T11:00:00.000Z",
    "completedAt": null,
    "feature": {
      "id": "feature-uuid",
      "identifier": "ENG-42",
      "title": "User Authentication",
      "epic": {
        "id": "epic-uuid",
        "name": "Q1 2024 Features"
      }
    },
    "status": {
      "id": "status-uuid",
      "name": "In Progress",
      "category": "started"
    },
    "assignee": {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@toro.com"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team member
- `404 Not Found` - Task not found

---

### POST /api/v1/tasks

Create a new task under a feature. The task identifier is auto-generated (e.g., `ENG-42-1`).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "title": "Create OAuth provider configuration",
  "featureId": "feature-uuid",
  "description": "Set up Passport.js strategies",
  "statusId": "status-uuid",
  "assigneeId": "user-uuid",
  "sortOrder": 1000,
  "executionOrder": 1,
  "estimatedComplexity": "simple"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Task title (max 500 chars) |
| `featureId` | UUID \| identifier | Yes | Parent feature ID or identifier |
| `description` | string | No | Markdown description (max 50,000 chars) |
| `statusId` | UUID | No | Initial status |
| `assigneeId` | UUID | No | User to assign to (or `"me"`) |
| `sortOrder` | number | No | Custom sort order |
| `executionOrder` | number | No | Execution order within feature (1-based) |
| `estimatedComplexity` | enum | No | `trivial`, `simple`, `moderate`, or `complex` |

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-task-uuid",
    "featureId": "feature-uuid",
    "identifier": "ENG-42-1",
    "title": "Create OAuth provider configuration",
    "description": "Set up Passport.js strategies",
    "statusId": "status-uuid",
    "assigneeId": "user-uuid",
    "sortOrder": 1000,
    "executionOrder": 1,
    "estimatedComplexity": "simple",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Feature not found

---

### PUT /api/v1/tasks/:id

Update an existing task. Only provided fields are updated.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Task ID or identifier |

**Request Body (all fields optional):**
```json
{
  "title": "Updated Task Title",
  "description": "Updated description",
  "statusId": "new-status-uuid",
  "assigneeId": "new-user-uuid",
  "executionOrder": 2,
  "canParallelize": true,
  "parallelGroup": "oauth-tasks",
  "dependencies": ["task-uuid-1"],
  "estimatedComplexity": "moderate"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "title": "Updated Task Title",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Task not found

---

### DELETE /api/v1/tasks/:id

Delete a task permanently.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Task ID or identifier |

**Success Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Task not found

---

## Reordering and Bulk Operations

### PUT /api/v1/tasks/:id/reorder

Reorder a task within its feature. Provide `afterId`, `beforeId`, or both.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "afterId": "task-uuid-1",
  "beforeId": "task-uuid-2"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "sortOrder": 1500
  }
}
```

---

### PUT /api/v1/tasks/bulk-update

Bulk update multiple tasks (e.g., change status for all).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "ids": ["task-uuid-1", "task-uuid-2"],
  "statusId": "new-status-uuid"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "updated": 2,
    "tasks": [
      {
        "id": "task-uuid-1",
        "identifier": "ENG-42-1",
        "statusId": "new-status-uuid"
      },
      {
        "id": "task-uuid-2",
        "identifier": "ENG-42-2",
        "statusId": "new-status-uuid"
      }
    ]
  }
}
```

---

## Progress Tracking Endpoints

### POST /api/v1/tasks/:id/start-work

Begin working on a task. Sets status to "In Progress" and records start timestamp.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "statusId": "in-progress-status-uuid",
    "startedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### POST /api/v1/tasks/:id/complete-work

Mark a task as complete. Sets status to "Done", records completion timestamp, calculates duration, and sets progress to 100%.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "summary": "Configured OAuth strategies for Google and GitHub",
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "statusId": "done-status-uuid",
    "startedAt": "2024-01-15T11:00:00.000Z",
    "completedAt": "2024-01-15T13:00:00.000Z",
    "durationMinutes": 120,
    "percentComplete": 100
  }
}
```

---

### POST /api/v1/tasks/:id/log-progress

Log progress without changing status. Useful for recording incremental updates.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Completed Google OAuth provider configuration",
  "percentComplete": 50,
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "percentComplete": 50,
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

### POST /api/v1/tasks/:id/report-blocker

Report that a task is blocked.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Waiting for OAuth app credentials",
  "blockedById": "task-uuid-blocking-this",
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "statusId": "blocked-status-uuid",
    "blockerReason": "Waiting for OAuth app credentials",
    "dependencies": ["task-uuid-blocking-this"]
  }
}
```

---

## Validation Endpoints

Tasks support executable validation checks that define acceptance criteria. See [Validation Endpoints](./validation-endpoints.md) for full documentation.

**Summary of validation endpoints:**
- `GET /api/v1/tasks/:taskId/validations` - List all validation checks
- `POST /api/v1/tasks/:taskId/validations` - Add validation check
- `DELETE /api/v1/tasks/:taskId/validations/:checkId` - Remove validation
- `POST /api/v1/tasks/:taskId/validations/:checkId/run` - Run single validation
- `POST /api/v1/tasks/:taskId/validations/run-all` - Run all validations
- `POST /api/v1/tasks/:taskId/validations/:checkId/manual-validate` - Mark manual check validated
- `POST /api/v1/tasks/:taskId/validations/reset` - Reset all validations

**Validation Types:**
- `command` - Run shell command, check exit code
- `file_exists` - Verify file exists
- `file_contains` - Search file content with regex
- `test_passes` - Run test command
- `manual` - Requires human verification

---

## AI Context Endpoints

See also: [AI Context Endpoints](./ai-context-endpoints.md)

### GET /api/v1/tasks/:id/ai-context

Get AI context for a task.

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "task",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "aiContext": "## Current State\n50% complete, Google provider done...",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "session-abc",
        "type": "observation",
        "content": "Found existing Passport.js configuration"
      }
    ],
    "lastAiSessionId": "session-abc",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT /api/v1/tasks/:id/ai-context

Set structured AI context. Replaces existing context.

**Request Body:**
```json
{
  "context": "## Summary\n50% complete, Google done, GitHub remaining...",
  "sessionId": "optional-session-id"
}
```

---

### POST /api/v1/tasks/:id/ai-note

Append a note to the AI notes array.

**Request Body:**
```json
{
  "noteType": "decision",
  "content": "Using Passport Google OAuth2 strategy instead of custom implementation",
  "sessionId": "optional-session-id"
}
```

---

## Code Context Endpoints

### GET /api/v1/tasks/:id/code-context

Get all code artifacts linked to this task.

**Success Response (200 OK):**
```json
{
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "files": ["src/auth/passport-config.ts", "src/auth/strategies/google.ts"],
    "functions": ["src/auth/passport-config.ts:configureGoogle"],
    "branch": "feature/ENG-42-oauth",
    "commits": ["abc1234"],
    "pr": null
  }
}
```

---

### POST /api/v1/tasks/:id/code-context/file

Link a file to this task.

**Request Body:**
```json
{
  "filePath": "src/auth/strategies/google.ts"
}
```

---

### DELETE /api/v1/tasks/:id/code-context/file

Unlink a file from this task.

**Request Body:**
```json
{
  "filePath": "src/auth/strategies/google.ts"
}
```

---

### POST /api/v1/tasks/:id/code-context/function

Link a function to this task.

**Request Body:**
```json
{
  "filePath": "src/auth/passport-config.ts",
  "functionName": "configureGoogle"
}
```

---

### POST /api/v1/tasks/:id/code-context/branch

Link a git branch to this task.

**Request Body:**
```json
{
  "branchName": "feature/ENG-42-oauth"
}
```

---

### POST /api/v1/tasks/:id/code-context/commit

Link a git commit to this task.

**Request Body:**
```json
{
  "commitSha": "abc1234"
}
```

---

### POST /api/v1/tasks/:id/code-context/pr

Link a pull request to this task.

**Request Body:**
```json
{
  "prNumber": 123,
  "prUrl": "https://github.com/org/repo/pull/123"
}
```

---

## Structured Description Endpoints

### GET /api/v1/tasks/:id/structured-desc

Get the structured description for a task.

**Success Response (200 OK):**
```json
{
  "data": {
    "summary": "Configure OAuth providers for Google and GitHub authentication",
    "aiInstructions": "Use Passport.js strategies. Follow security best practices.",
    "acceptanceCriteria": [
      "Google OAuth strategy configured",
      "GitHub OAuth strategy configured",
      "All tests pass"
    ],
    "filesInvolved": [
      "src/auth/passport-config.ts",
      "src/auth/strategies/google.ts",
      "src/auth/strategies/github.ts"
    ],
    "functionsToModify": ["src/auth/passport-config.ts:configureGoogle"],
    "testingStrategy": "Unit tests for each strategy",
    "testFiles": ["tests/auth/strategies.test.ts"],
    "relatedItemIds": ["ENG-42-2"],
    "externalLinks": [
      {
        "url": "https://www.passportjs.org/packages/passport-google-oauth2/",
        "title": "Passport Google OAuth2 Docs"
      }
    ],
    "technicalNotes": "Using environment variables for client IDs and secrets",
    "riskLevel": "low",
    "estimatedEffort": "small"
  }
}
```

---

### PUT /api/v1/tasks/:id/structured-desc

Set the entire structured description. Replaces existing.

**Request Body:**
```json
{
  "summary": "Configure OAuth providers",
  "aiInstructions": "Use Passport.js",
  "acceptanceCriteria": ["Tests pass"],
  "filesInvolved": ["src/auth/passport-config.ts"],
  "riskLevel": "low"
}
```

---

### PATCH /api/v1/tasks/:id/structured-desc/section

Update a specific section.

**Request Body:**
```json
{
  "section": "estimatedEffort",
  "value": "medium"
}
```

---

### POST /api/v1/tasks/:id/structured-desc/criterion

Add an acceptance criterion.

**Request Body:**
```json
{
  "criterion": "Security review completed"
}
```

---

### POST /api/v1/tasks/:id/structured-desc/file

Link a file to filesInvolved.

**Request Body:**
```json
{
  "filePath": "src/auth/strategies/google.ts"
}
```

---

### POST /api/v1/tasks/:id/structured-desc/external-link

Add an external documentation link.

**Request Body:**
```json
{
  "url": "https://docs.passportjs.org/",
  "title": "Passport.js Documentation"
}
```

---

## Changelog

### GET /api/v1/tasks/:id/changelog

Get change history for a task.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `field` | string | Filter by specific field (e.g., "statusId") |
| `since` | ISO-8601 | Changes on or after this date |
| `limit` | number | Max entries (default: 20, max: 100) |

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "task",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42-1",
    "changes": [
      {
        "timestamp": "2024-01-15T11:00:00.000Z",
        "changedBy": "user-uuid",
        "field": "statusId",
        "oldValue": "backlog-uuid",
        "newValue": "in-progress-uuid"
      },
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "changedBy": "user-uuid",
        "field": "percentComplete",
        "oldValue": "0",
        "newValue": "50"
      }
    ]
  }
}
```

---

## Related Documentation

- [Feature Endpoints](./feature-endpoints.md) - Parent feature management
- [Validation Endpoints](./validation-endpoints.md) - Task validation checks (detailed)
- [AI Context Endpoints](./ai-context-endpoints.md) - AI session context
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
