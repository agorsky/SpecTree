# Status API Endpoints

This document describes the API endpoints for managing workflow statuses in Dispatcher.

## Overview

Statuses represent workflow states for features and tasks (e.g., "Backlog", "In Progress", "Done"). Each team has its own set of customizable statuses. Statuses are categorized (`backlog`, `unstarted`, `started`, `completed`, `canceled`) and can be ordered within their team.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- Specific role requirements documented per endpoint

---

## Endpoints

### GET /api/v1/statuses

List all statuses, optionally filtered by team.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `teamId` | UUID | Filter by team ID (required for team-specific statuses) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "teamId": "team-uuid",
      "name": "Backlog",
      "category": "backlog",
      "color": "#94A3B8",
      "position": 0,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": "status-uuid-2",
      "teamId": "team-uuid",
      "name": "In Progress",
      "category": "started",
      "color": "#3B82F6",
      "position": 2,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    },
    {
      "id": "status-uuid-3",
      "teamId": "team-uuid",
      "name": "Done",
      "category": "completed",
      "color": "#10B981",
      "position": 5,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

---

### GET /api/v1/statuses/:id

Get a single status by ID.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Status ID |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "teamId": "team-uuid",
    "name": "In Progress",
    "category": "started",
    "color": "#3B82F6",
    "position": 2,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z",
    "team": {
      "id": "team-uuid",
      "name": "Engineering",
      "key": "ENG"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `404 Not Found` - Status not found

---

### POST /api/v1/statuses

Create a new status for a team.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher (on the specified team)

**Request Body:**
```json
{
  "name": "Code Review",
  "teamId": "team-uuid",
  "category": "started",
  "color": "#F59E0B",
  "position": 3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Status name (max 100 chars) |
| `teamId` | UUID | Yes | Team this status belongs to |
| `category` | enum | Yes | Status category (see below) |
| `color` | string | No | Hex color code (e.g., "#3B82F6") |
| `position` | number | No | Display order (auto-generated if omitted) |

**Status Categories:**

| Category | Description | Use Cases |
|----------|-------------|-----------|
| `backlog` | Not yet ready to start | Backlog, Icebox |
| `unstarted` | Ready to start but not yet started | To Do, Ready |
| `started` | Actively being worked on | In Progress, In Review, Testing |
| `completed` | Successfully finished | Done, Merged, Deployed |
| `canceled` | Will not be completed | Canceled, Won't Fix, Duplicate |

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-status-uuid",
    "teamId": "team-uuid",
    "name": "Code Review",
    "category": "started",
    "color": "#F59E0B",
    "position": 3,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input (e.g., invalid category)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team member with sufficient permissions
- `404 Not Found` - Team not found
- `409 Conflict` - Status name already exists for this team

---

### PUT /api/v1/statuses/:id

Update an existing status.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Status ID |

**Request Body (all fields optional):**
```json
{
  "name": "Under Review",
  "category": "started",
  "color": "#8B5CF6",
  "position": 4
}
```

**Note:** `teamId` cannot be changed after creation.

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "teamId": "team-uuid",
    "name": "Under Review",
    "category": "started",
    "color": "#8B5CF6",
    "position": 4,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Status not found
- `409 Conflict` - Status name already exists for this team

---

### PUT /api/v1/statuses/:id/reorder

Reorder a status within its team. Provide `afterId`, `beforeId`, or both to specify new position.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `member` or higher

**Request Body:**
```json
{
  "afterId": "status-uuid-1",
  "beforeId": "status-uuid-2"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `afterId` | UUID | No | Place this status after the specified status |
| `beforeId` | UUID | No | Place this status before the specified status |

**Note:** At least one of `afterId` or `beforeId` must be provided. Both referenced statuses must belong to the same team.

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Code Review",
    "position": 3.5,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request (e.g., referenced status in different team)
- `404 Not Found` - Status not found

---

### DELETE /api/v1/statuses/:id

Delete a status. Cannot delete if features or tasks are currently using this status.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `admin` (team admin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Status ID |

**Success Response (204 No Content)**

**Error Responses:**
- `400 Bad Request` - Status is in use by features or tasks
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team admin
- `404 Not Found` - Status not found

---

## Status Categories Explained

### Category Behaviors

Different status categories trigger different system behaviors:

| Category | Auto-behaviors |
|----------|----------------|
| `started` | Sets `startedAt` timestamp on transition from non-started |
| `completed` | Sets `completedAt` timestamp, calculates `durationMinutes` |
| `canceled` | Marks item as not completed but closed |

### Filtering by Category

Many endpoints support filtering by status category:
```
GET /api/v1/features?statusCategory=started
```

This returns all features with statuses in the "started" category, regardless of their specific status name.

---

## Common Status Workflows

### Basic Workflow
1. Backlog (category: `backlog`)
2. To Do (category: `unstarted`)
3. In Progress (category: `started`)
4. Done (category: `completed`)

### Development Workflow
1. Backlog (category: `backlog`)
2. Ready (category: `unstarted`)
3. In Progress (category: `started`)
4. In Review (category: `started`)
5. Testing (category: `started`)
6. Done (category: `completed`)

### With Canceled State
1. Backlog (category: `backlog`)
2. To Do (category: `unstarted`)
3. In Progress (category: `started`)
4. Done (category: `completed`)
5. Canceled (category: `canceled`)

---

## Related Documentation

- [Team Endpoints](./team-endpoints.md) - Teams own statuses
- [Feature Endpoints](./feature-endpoints.md) - Features use statuses
- [Task Endpoints](./task-endpoints.md) - Tasks use statuses
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
