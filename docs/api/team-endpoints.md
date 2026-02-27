# Team API Endpoints

This document describes the API endpoints for managing teams in Dispatcher.

## Overview

Teams are organizational units that own epics, features, and tasks. Each team has its own workflow statuses, members, and team key (used for generating feature identifiers like `ENG-42`). Teams control access and permissions for all work items they own.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- Specific role requirements documented per endpoint

---

## Endpoints

### GET /api/v1/teams

List all teams the authenticated user has access to.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor from previous response |
| `limit` | number | Results per page (default: 20, max: 100) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Engineering",
      "key": "ENG",
      "description": "Engineering team for all product development",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "_count": {
        "members": 15,
        "epics": 8
      }
    },
    {
      "id": "another-team-uuid",
      "name": "Product",
      "key": "PROD",
      "description": "Product management team",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "_count": {
        "members": 5,
        "epics": 3
      }
    }
  ],
  "meta": {
    "hasMore": false,
    "cursor": null
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token

---

### GET /api/v1/teams/:id

Get a single team by ID, name, or key.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** `guest` or higher

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID \| string | Team ID, name, or key (e.g., "ENG", "Engineering", or UUID) |

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Engineering",
    "key": "ENG",
    "description": "Engineering team for all product development",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z",
    "members": [
      {
        "userId": "user-uuid",
        "role": "admin",
        "user": {
          "id": "user-uuid",
          "name": "John Doe",
          "email": "john@toro.com"
        }
      }
    ],
    "_count": {
      "members": 15,
      "epics": 8,
      "statuses": 6
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team member
- `404 Not Found` - Team not found

---

### POST /api/v1/teams

Create a new team.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** Global admin (typically restricted to system administrators)

**Request Body:**
```json
{
  "name": "Engineering",
  "key": "ENG",
  "description": "Engineering team for product development"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Team name (max 255 chars, must be unique) |
| `key` | string | Yes | Team key (2-10 uppercase letters, unique) |
| `description` | string | No | Team description |

**Team Key Requirements:**
- 2-10 characters
- Uppercase letters only (A-Z)
- Used for feature identifiers (e.g., `ENG-42`)
- Must be unique across all teams

**Success Response (201 Created):**
```json
{
  "data": {
    "id": "new-team-uuid",
    "name": "Engineering",
    "key": "ENG",
    "description": "Engineering team for product development",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input (e.g., key not uppercase, name taken)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a global admin
- `409 Conflict` - Team name or key already exists

---

### PUT /api/v1/teams/:id

Update an existing team.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Required Role:** `admin` (team admin)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Team ID |

**Request Body (all fields optional):**
```json
{
  "name": "Engineering - Updated",
  "description": "Updated team description"
}
```

**Note:** Team key cannot be changed after creation (would break existing feature identifiers).

**Success Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Engineering - Updated",
    "key": "ENG",
    "description": "Updated team description",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team admin
- `404 Not Found` - Team not found

---

### DELETE /api/v1/teams/:id

Delete a team permanently. This is a destructive operation that may cascade to epics, features, and tasks.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Required Role:** Global admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Team ID |

**Success Response (204 No Content)**

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a global admin
- `404 Not Found` - Team not found

---

## Team Membership Endpoints

Team membership management endpoints:
- `GET /api/v1/teams/:teamId/members` - List team members
- `POST /api/v1/teams/:teamId/members` - Add member to team
- `PUT /api/v1/teams/:teamId/members/:userId` - Update member role
- `DELETE /api/v1/teams/:teamId/members/:userId` - Remove member from team

> **Note:** Detailed membership endpoint documentation is planned for a future update.

---

## Team Roles

| Role | Permissions |
|------|-------------|
| `guest` | Read-only access to team's work items |
| `member` | Create and edit work items, cannot manage team settings |
| `admin` | Full access including team settings and member management |

---

## Related Documentation

- [Status Endpoints](./status-endpoints.md) - Team workflow statuses
- [Epic Endpoints](./epic-endpoints.md) - Epics belong to teams
- [MCP Tools Reference](../mcp/tools-reference.md) - Complete MCP tools reference
