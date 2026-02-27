# Epic API Endpoints

This document describes the API endpoints for managing epics in Dispatcher.

## Overview

Epics are top-level containers for features and tasks. Each epic belongs to a team and contains a collection of related features. Epics support structured descriptions, AI context, progress tracking, and comprehensive metadata.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- User must have access to the team that owns the epic
- Minimum role requirements vary by endpoint (documented per endpoint)

---

## Core CRUD Endpoints

### GET /api/v1/epics

List epics with cursor-based pagination and filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Results per page (default: 20, max: 100) |
| `teamId` | UUID | Filter by team ID |
| `includeArchived` | boolean | Include archived epics (default: false) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "teamId": "team-uuid",
      "name": "Q1 2024 Features",
      "description": "Epic containing all Q1 features",
      "icon": "🚀",
      "color": "#3B82F6",
      "sortOrder": 1000,
      "isArchived": false,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z",
      "team": {
        "id": "team-uuid",
        "name": "Engineering",
        "key": "ENG"
      },
      "featureCount": 12
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
- `403 Forbidden` - Not a team member

---

### GET /api/v1/epics/:id

Get a single epic by ID.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Epic ID |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "teamId": "team-uuid",
    "name": "Q1 2024 Features",
    "description": "Epic containing all Q1 features",
    "icon": "🚀",
    "color": "#3B82F6",
    "sortOrder": 1000,
    "isArchived": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "team": {
      "id": "team-uuid",
      "name": "Engineering",
      "key": "ENG"
    },
    "features": [
      {
        "id": "feature-uuid",
        "identifier": "ENG-42",
        "title": "User Authentication",
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
- `404 Not Found` - Epic not found

---

### POST /api/v1/epics

Create a new epic.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "name": "Q2 2024 Features",
  "teamId": "team-uuid",
  "description": "Epic for Q2 features",
  "icon": "⚡",
  "color": "#FF5733",
  "sortOrder": 2000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Epic name (max 255 chars) |
| `teamId` | UUID | Yes | Team this epic belongs to |
| `description` | string | No | Markdown description (max 50,000 chars) |
| `icon` | string | No | Icon emoji or identifier |
| `color` | string | No | Hex color code (e.g., "#FF5733") |
| `sortOrder` | number | No | Custom sort order |

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-epic-uuid",
    "teamId": "team-uuid",
    "name": "Q2 2024 Features",
    "description": "Epic for Q2 features",
    "icon": "⚡",
    "color": "#FF5733",
    "sortOrder": 2000,
    "isArchived": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Team not found

---

### PUT /api/v1/epics/:id

Update an existing epic. Only provided fields are updated.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Epic ID |

**Request Body (all fields optional):**
```json
{
  "name": "Updated Epic Name",
  "description": "Updated description",
  "icon": "🎯",
  "color": "#00FF00",
  "sortOrder": 1500
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "teamId": "team-uuid",
    "name": "Updated Epic Name",
    "description": "Updated description",
    "icon": "🎯",
    "color": "#00FF00",
    "sortOrder": 1500,
    "isArchived": false,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Epic not found

---

### DELETE /api/v1/epics/:id

Soft delete an epic (sets `isArchived = true`). Does not permanently delete the epic.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Epic ID |

**Success Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Epic not found

---

## Archive Management

### POST /api/v1/epics/:id/archive

Archive an epic (sets `isArchived = true`).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `member` or higher

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Q1 2024 Features",
    "isArchived": true,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

### POST /api/v1/epics/:id/unarchive

Unarchive an epic (sets `isArchived = false`).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `member` or higher

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Q1 2024 Features",
    "isArchived": false,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## Reordering

### PUT /api/v1/epics/:id/reorder

Reorder an epic within its team. Provide `afterId`, `beforeId`, or both to specify new position.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "afterId": "epic-uuid-1",
  "beforeId": "epic-uuid-2"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `afterId` | UUID | No | Place this epic after the specified epic |
| `beforeId` | UUID | No | Place this epic before the specified epic |

**Note:** At least one of `afterId` or `beforeId` must be provided. Both referenced epics must belong to the same team.

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Q1 2024 Features",
    "sortOrder": 1500,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request (e.g., referenced epic in different team)
- `404 Not Found` - Epic not found

---

## Advanced Endpoints

### POST /api/v1/epics/complete

Create a complete epic with all features and tasks atomically. See [Template Endpoints](./template-endpoints.md) for similar functionality.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "User Authentication System",
  "teamId": "team-uuid",
  "description": "Complete auth system",
  "icon": "🔐",
  "color": "#3B82F6",
  "features": [
    {
      "title": "Login Flow",
      "executionOrder": 1,
      "estimatedComplexity": "moderate",
      "tasks": [
        {
          "title": "Create login API endpoint",
          "executionOrder": 1
        },
        {
          "title": "Create login UI component",
          "executionOrder": 2
        }
      ]
    }
  ]
}
```

**Success Response (201 Created):**
```json
{
  "data": {
    "epic": {
      "id": "epic-uuid",
      "name": "User Authentication System"
    },
    "features": [
      {
        "id": "feature-uuid",
        "identifier": "ENG-42",
        "title": "Login Flow",
        "tasks": [
          {
            "id": "task-uuid",
            "identifier": "ENG-42-1",
            "title": "Create login API endpoint"
          }
        ]
      }
    ]
  }
}
```

---

### GET /api/v1/epics/:id/progress-summary

Get comprehensive progress summary for an epic, including feature/task counts, completion percentages, blocked items, and next actionable items.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `guest` or higher

**Success Response (200 OK):**
```json
{
  "data": {
    "epicId": "550e8400-e29b-41d4-a716-446655440000",
    "epicName": "Q1 2024 Features",
    "counts": {
      "totalFeatures": 12,
      "completedFeatures": 8,
      "inProgressFeatures": 3,
      "blockedFeatures": 1,
      "totalTasks": 48,
      "completedTasks": 35,
      "inProgressTasks": 10,
      "blockedTasks": 2,
      "pendingTasks": 1
    },
    "progress": {
      "percentComplete": 73,
      "estimatedRemainingComplexity": "moderate"
    },
    "blockedItems": [
      {
        "type": "feature",
        "id": "feature-uuid",
        "identifier": "ENG-42",
        "title": "User Authentication",
        "blockerReason": "Waiting for API design approval"
      }
    ],
    "nextActionableItems": [
      {
        "type": "task",
        "id": "task-uuid",
        "identifier": "ENG-43-2",
        "title": "Implement password validation",
        "executionOrder": 2
      }
    ],
    "recentlyCompleted": [
      {
        "type": "feature",
        "id": "feature-uuid",
        "identifier": "ENG-41",
        "title": "User Profile",
        "completedAt": "2024-01-14T15:30:00.000Z"
      }
    ]
  }
}
```

---

## AI Context Endpoints

### GET /api/v1/epics/:id/ai-context

Get AI context for an epic.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "epic",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "aiContext": "## Current State\nEpic is 70% complete...",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "session-abc",
        "type": "observation",
        "content": "Most features completed, focus on blocked items"
      }
    ],
    "lastAiSessionId": "session-abc",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PUT /api/v1/epics/:id/ai-context

Set structured AI context for an epic. Replaces existing context.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "context": "## Summary\nEpic implementation is 80% complete.\n\n## Completed\n- Authentication\n- Authorization\n\n## Remaining\n- Password reset",
  "sessionId": "optional-session-identifier"
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "epic",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "aiContext": "## Summary\n...",
    "lastAiSessionId": "optional-session-identifier",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/epics/:id/ai-note

Append a note to an epic's AI notes array. Notes are append-only.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "noteType": "observation",
  "content": "Found performance bottleneck in auth module",
  "sessionId": "optional-session-identifier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `noteType` | enum | Yes | One of: `observation`, `decision`, `blocker`, `next-step`, `context` |
| `content` | string | Yes | Note content (max 10,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "epic",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "optional-session-identifier",
        "type": "observation",
        "content": "Found performance bottleneck in auth module"
      }
    ]
  }
}
```

---

## Structured Description Endpoints

### GET /api/v1/epics/:id/structured-desc

Get the structured description for an epic.

**Success Response (200 OK):**
```json
{
  "data": {
    "summary": "User authentication system with OAuth and 2FA",
    "aiInstructions": "Focus on security best practices",
    "acceptanceCriteria": [
      "All auth flows must be tested",
      "Security audit must pass"
    ],
    "filesInvolved": ["src/auth/", "src/middleware/"],
    "technicalNotes": "Using Passport.js for auth",
    "riskLevel": "high",
    "estimatedEffort": "xl"
  }
}
```

---

### PUT /api/v1/epics/:id/structured-desc

Set the entire structured description. Replaces existing description.

**Request Body:**
```json
{
  "summary": "User authentication system",
  "aiInstructions": "Follow OAuth 2.0 spec",
  "acceptanceCriteria": ["Tests pass", "Security audit complete"],
  "filesInvolved": ["src/auth/"],
  "technicalNotes": "Using Passport.js",
  "riskLevel": "high",
  "estimatedEffort": "xl"
}
```

---

### PATCH /api/v1/epics/:id/structured-desc/section

Update a specific section without touching other sections.

**Request Body:**
```json
{
  "section": "riskLevel",
  "value": "medium"
}
```

---

### POST /api/v1/epics/:id/structured-desc/acceptance-criteria

Add an acceptance criterion to the epic.

**Request Body:**
```json
{
  "criterion": "All security tests must pass"
}
```

---

### POST /api/v1/epics/:id/structured-desc/files

Link a file to the epic's filesInvolved list.

**Request Body:**
```json
{
  "filePath": "src/auth/passport-config.ts"
}
```

---

### POST /api/v1/epics/:id/structured-desc/links

Add an external documentation link.

**Request Body:**
```json
{
  "url": "https://docs.example.com/auth",
  "title": "Auth System Design Doc"
}
```

---

## Related Documentation

- [Feature Endpoints](./feature-endpoints.md) - Feature management
- [Task Endpoints](./task-endpoints.md) - Task management
- [AI Context Endpoints](./ai-context-endpoints.md) - AI session context
- [Template Endpoints](./template-endpoints.md) - Create epics from templates
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
