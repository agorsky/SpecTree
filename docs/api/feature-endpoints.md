# Feature API Endpoints

This document describes the API endpoints for managing features in SpecTree.

## Overview

Features are the primary work items in SpecTree, similar to issues in other project management tools. Each feature belongs to an epic, has an auto-generated identifier (e.g., `ENG-42`), and can contain multiple tasks. Features support rich metadata including status, assignee, structured descriptions, AI context, code context, and progress tracking.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- User must have access to the team that owns the feature's epic
- Minimum role requirements vary by endpoint (documented per endpoint)

---

## Core CRUD Endpoints

### GET /api/v1/features

List features with cursor-based pagination and advanced filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Results per page (default: 20, max: 100) |
| `epicId` | UUID | Filter by epic ID |
| `status` | string \| string[] | Filter by status name or ID (supports multiple via repeated param) |
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
      "epicId": "epic-uuid",
      "identifier": "ENG-42",
      "title": "User Authentication",
      "description": "Implement OAuth 2.0 authentication",
      "statusId": "status-uuid",
      "assigneeId": "user-uuid",
      "sortOrder": 1000,
      "executionOrder": 1,
      "canParallelize": false,
      "parallelGroup": null,
      "dependencies": [],
      "estimatedComplexity": "moderate",
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
      "_count": {
        "tasks": 5
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

### GET /api/v1/features/:id

Get a single feature by ID or identifier (e.g., `ENG-42`).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Feature ID or identifier (e.g., "ENG-42") |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "epicId": "epic-uuid",
    "identifier": "ENG-42",
    "title": "User Authentication",
    "description": "Implement OAuth 2.0 authentication",
    "statusId": "status-uuid",
    "assigneeId": "user-uuid",
    "sortOrder": 1000,
    "executionOrder": 1,
    "canParallelize": false,
    "parallelGroup": null,
    "dependencies": [],
    "estimatedComplexity": "moderate",
    "percentComplete": 60,
    "blockerReason": null,
    "durationMinutes": 240,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "startedAt": "2024-01-15T11:00:00.000Z",
    "completedAt": null,
    "epic": {
      "id": "epic-uuid",
      "name": "Q1 2024 Features"
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
    },
    "tasks": [
      {
        "id": "task-uuid",
        "identifier": "ENG-42-1",
        "title": "Create OAuth provider config",
        "statusId": "status-uuid",
        "sortOrder": 1000
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team member
- `404 Not Found` - Feature not found

---

### POST /api/v1/features

Create a new feature. The feature identifier is auto-generated based on the epic's team key (e.g., `ENG-42`).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "title": "User Authentication",
  "epicId": "epic-uuid",
  "description": "Implement OAuth 2.0 authentication",
  "statusId": "status-uuid",
  "assigneeId": "user-uuid",
  "sortOrder": 1000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Feature title (max 500 chars) |
| `epicId` | UUID | Yes | Parent epic ID |
| `description` | string | No | Markdown description (max 50,000 chars) |
| `statusId` | UUID | No | Initial status |
| `assigneeId` | UUID | No | User to assign to (or `"me"`) |
| `sortOrder` | number | No | Custom sort order |

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-feature-uuid",
    "epicId": "epic-uuid",
    "identifier": "ENG-42",
    "title": "User Authentication",
    "description": "Implement OAuth 2.0 authentication",
    "statusId": "status-uuid",
    "assigneeId": "user-uuid",
    "sortOrder": 1000,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Epic not found

---

### PUT /api/v1/features/:id

Update an existing feature. Only provided fields are updated.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Feature ID or identifier |

**Request Body (all fields optional):**
```json
{
  "title": "Updated Feature Title",
  "description": "Updated description",
  "statusId": "new-status-uuid",
  "assigneeId": "new-user-uuid",
  "executionOrder": 2,
  "canParallelize": true,
  "parallelGroup": "auth-group",
  "dependencies": ["feature-uuid-1"],
  "estimatedComplexity": "complex"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "title": "Updated Feature Title",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Feature not found

---

### DELETE /api/v1/features/:id

Delete a feature permanently.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| identifier | Feature ID or identifier |

**Success Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Feature not found

---

## Reordering and Bulk Operations

### PUT /api/v1/features/:id/reorder

Reorder a feature within its epic. Provide `afterId`, `beforeId`, or both.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "afterId": "feature-uuid-1",
  "beforeId": "feature-uuid-2"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "sortOrder": 1500
  }
}
```

---

### PUT /api/v1/features/bulk-update

Bulk update multiple features (e.g., change status for all).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "ids": ["feature-uuid-1", "feature-uuid-2"],
  "statusId": "new-status-uuid"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "updated": 2,
    "features": [
      {
        "id": "feature-uuid-1",
        "identifier": "ENG-42",
        "statusId": "new-status-uuid"
      },
      {
        "id": "feature-uuid-2",
        "identifier": "ENG-43",
        "statusId": "new-status-uuid"
      }
    ]
  }
}
```

---

## Progress Tracking Endpoints

### POST /api/v1/features/:id/start-work

Begin working on a feature. Sets status to "In Progress" and records start timestamp.

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
    "identifier": "ENG-42",
    "statusId": "in-progress-status-uuid",
    "startedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### POST /api/v1/features/:id/complete-work

Mark a feature as complete. Sets status to "Done", records completion timestamp, calculates duration, and sets progress to 100%.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "summary": "Implemented OAuth 2.0 with Google and GitHub providers",
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "statusId": "done-status-uuid",
    "startedAt": "2024-01-15T11:00:00.000Z",
    "completedAt": "2024-01-15T15:30:00.000Z",
    "durationMinutes": 270,
    "percentComplete": 100
  }
}
```

---

### POST /api/v1/features/:id/log-progress

Log progress without changing status. Useful for recording incremental updates.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Completed OAuth provider configuration",
  "percentComplete": 60,
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "percentComplete": 60,
    "updatedAt": "2024-01-15T13:00:00.000Z"
  }
}
```

---

### POST /api/v1/features/:id/report-blocker

Report that a feature is blocked.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Waiting for API design approval",
  "blockedById": "feature-uuid-blocking-this",
  "sessionId": "optional-session-id"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "statusId": "blocked-status-uuid",
    "blockerReason": "Waiting for API design approval",
    "dependencies": ["feature-uuid-blocking-this"]
  }
}
```

---

## AI Context Endpoints

See also: [AI Context Endpoints](./ai-context-endpoints.md)

### GET /api/v1/features/:id/ai-context

Get AI context for a feature.

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "feature",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "aiContext": "## Current State\n60% complete, OAuth providers configured...",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "session-abc",
        "type": "decision",
        "content": "Chose Passport.js over custom implementation"
      }
    ],
    "lastAiSessionId": "session-abc",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT /api/v1/features/:id/ai-context

Set structured AI context. Replaces existing context.

**Request Body:**
```json
{
  "context": "## Summary\n60% complete...",
  "sessionId": "optional-session-id"
}
```

---

### POST /api/v1/features/:id/ai-note

Append a note to the AI notes array.

**Request Body:**
```json
{
  "noteType": "observation",
  "content": "Found existing auth library in codebase",
  "sessionId": "optional-session-id"
}
```

---

## Code Context Endpoints

### GET /api/v1/features/:id/code-context

Get all code artifacts linked to this feature.

**Success Response (200 OK):**
```json
{
  "data": {
    "featureId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
    "files": ["src/auth/oauth.ts", "src/auth/passport-config.ts"],
    "functions": ["src/auth/oauth.ts:configureOAuth"],
    "branch": "feature/ENG-42-oauth",
    "commits": ["abc1234", "def5678"],
    "pr": {
      "number": 123,
      "url": "https://github.com/org/repo/pull/123"
    }
  }
}
```

---

### POST /api/v1/features/:id/code-context/file

Link a file to this feature.

**Request Body:**
```json
{
  "filePath": "src/auth/oauth.ts"
}
```

---

### DELETE /api/v1/features/:id/code-context/file

Unlink a file from this feature.

**Request Body:**
```json
{
  "filePath": "src/auth/oauth.ts"
}
```

---

### POST /api/v1/features/:id/code-context/function

Link a function to this feature.

**Request Body:**
```json
{
  "filePath": "src/auth/oauth.ts",
  "functionName": "configureOAuth"
}
```

---

### POST /api/v1/features/:id/code-context/branch

Link a git branch to this feature.

**Request Body:**
```json
{
  "branchName": "feature/ENG-42-oauth"
}
```

---

### POST /api/v1/features/:id/code-context/commit

Link a git commit to this feature.

**Request Body:**
```json
{
  "commitSha": "abc1234"
}
```

---

### POST /api/v1/features/:id/code-context/pr

Link a pull request to this feature.

**Request Body:**
```json
{
  "prNumber": 123,
  "prUrl": "https://github.com/org/repo/pull/123"
}
```

---

## Structured Description Endpoints

### GET /api/v1/features/:id/structured-desc

Get the structured description for a feature.

**Success Response (200 OK):**
```json
{
  "data": {
    "summary": "Implement OAuth 2.0 authentication with multiple providers",
    "aiInstructions": "Use Passport.js. Support Google and GitHub.",
    "acceptanceCriteria": [
      "OAuth flow works for Google",
      "OAuth flow works for GitHub",
      "All tests pass"
    ],
    "filesInvolved": ["src/auth/oauth.ts", "src/auth/passport-config.ts"],
    "functionsToModify": ["src/auth/oauth.ts:configureOAuth"],
    "testingStrategy": "Unit tests for each provider, integration tests for full flow",
    "testFiles": ["tests/auth/oauth.test.ts"],
    "relatedItemIds": ["ENG-41"],
    "externalLinks": [
      {
        "url": "https://docs.passportjs.org/",
        "title": "Passport.js Documentation"
      }
    ],
    "technicalNotes": "Using Passport.js strategy pattern",
    "riskLevel": "medium",
    "estimatedEffort": "large"
  }
}
```

---

### PUT /api/v1/features/:id/structured-desc

Set the entire structured description. Replaces existing.

**Request Body:**
```json
{
  "summary": "Implement OAuth 2.0",
  "aiInstructions": "Use Passport.js",
  "acceptanceCriteria": ["Tests pass"],
  "filesInvolved": ["src/auth/oauth.ts"],
  "riskLevel": "medium"
}
```

---

### PATCH /api/v1/features/:id/structured-desc/section

Update a specific section.

**Request Body:**
```json
{
  "section": "riskLevel",
  "value": "low"
}
```

---

### POST /api/v1/features/:id/structured-desc/criterion

Add an acceptance criterion.

**Request Body:**
```json
{
  "criterion": "Security audit must pass"
}
```

---

### POST /api/v1/features/:id/structured-desc/file

Link a file to filesInvolved.

**Request Body:**
```json
{
  "filePath": "src/auth/oauth.ts"
}
```

---

### POST /api/v1/features/:id/structured-desc/external-link

Add an external documentation link.

**Request Body:**
```json
{
  "url": "https://docs.example.com/oauth",
  "title": "OAuth Design Doc"
}
```

---

## Changelog

### GET /api/v1/features/:id/changelog

Get change history for a feature.

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
    "entityType": "feature",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "ENG-42",
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
        "field": "title",
        "oldValue": "User Auth",
        "newValue": "User Authentication"
      }
    ]
  }
}
```

---

## Related Documentation

- [Epic Endpoints](./epic-endpoints.md) - Parent container management
- [Task Endpoints](./task-endpoints.md) - Child task management
- [AI Context Endpoints](./ai-context-endpoints.md) - AI session context
- [Validation Endpoints](./validation-endpoints.md) - Task validation checks
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
