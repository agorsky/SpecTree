# Search & Query API Endpoints

This document describes the search and query endpoints for finding features and tasks in Dispatcher.

## Overview

Dispatcher provides a unified search endpoint that can search across features, tasks, or both simultaneously. The search supports full-text search, filtering by status/assignee/epic, and date range queries.

## Authentication

All search endpoints require:
- Valid JWT access token or API token in the `Authorization` header

---

## Unified Search

### GET /api/v1/search

Search across features and/or tasks with comprehensive filtering options.

**Note:** This endpoint is actually implemented via the `/api/v1/features` endpoint with cross-entity search capabilities.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Text search in title and description (case-insensitive) |
| `type` | enum | Search scope: `feature`, `task`, or `all` (default: `all`) |
| `epicId` | UUID | Filter by epic (features only, tasks inherit from feature) |
| `status` | string \| string[] | Filter by status name or ID (multiple via repeated param) |
| `statusCategory` | string | Filter by category: `backlog`, `unstarted`, `started`, `completed`, `canceled` |
| `assignee` | string | Filter by assignee: `me`, `none`, email, or UUID |
| `createdAt` | ISO-8601 | Items created on or after this date |
| `createdBefore` | ISO-8601 | Items created before this date |
| `updatedAt` | ISO-8601 | Items updated on or after this date |
| `updatedBefore` | ISO-8601 | Items updated before this date |
| `cursor` | string | Pagination cursor |
| `limit` | number | Results per page (default: 50, max: 100) |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "type": "feature",
      "id": "feature-uuid",
      "identifier": "ENG-42",
      "title": "User Authentication",
      "description": "Implement OAuth authentication",
      "statusId": "status-uuid",
      "status": {
        "name": "In Progress",
        "category": "started"
      },
      "assignee": {
        "name": "John Doe",
        "email": "john@toro.com"
      },
      "epic": {
        "name": "Q1 2024 Features"
      },
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "type": "task",
      "id": "task-uuid",
      "identifier": "ENG-42-1",
      "title": "Create OAuth provider config",
      "description": "Set up Google and GitHub OAuth",
      "statusId": "status-uuid",
      "status": {
        "name": "In Progress",
        "category": "started"
      },
      "assignee": {
        "name": "John Doe",
        "email": "john@toro.com"
      },
      "feature": {
        "identifier": "ENG-42",
        "title": "User Authentication"
      },
      "createdAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 2,
    "hasMore": false,
    "cursor": null
  }
}
```

---

## Search Examples

### Search by Text

Find all items containing "authentication":
```bash
GET /api/v1/features?query=authentication
```

### Search My Work

Find all items assigned to me:
```bash
GET /api/v1/features?assignee=me
```

### Search by Status Category

Find all items currently being worked on:
```bash
GET /api/v1/features?statusCategory=started
```

### Search with Multiple Filters

Find my in-progress tasks in a specific epic:
```bash
GET /api/v1/tasks?featureId=ENG-42&assignee=me&statusCategory=started
```

### Search by Date Range

Find items created in the last 7 days:
```bash
GET /api/v1/features?createdAt=-P7D
```

Find items updated this month:
```bash
GET /api/v1/features?updatedAt=2024-01-01&updatedBefore=2024-02-01
```

---

## Date Filters

Date parameters accept two formats:

### ISO-8601 Date
Absolute date: `2024-01-15`

### ISO-8601 Duration
Relative date: `-P7D` (last 7 days), `-P1M` (last month)

**Examples:**
- `-P1D` - Last 24 hours
- `-P7D` - Last 7 days
- `-P1M` - Last month
- `-P3M` - Last 3 months
- `-P1Y` - Last year

---

## Assignee Filter Values

The `assignee` parameter accepts:

| Value | Description |
|-------|-------------|
| `me` | Items assigned to the authenticated user |
| `none` | Unassigned items |
| `email@toro.com` | Items assigned to user with this email |
| `UUID` | Items assigned to user with this ID |

---

## Status Filtering

### By Status Name
```
?status=In Progress
```

### By Multiple Statuses
```
?status=In Progress&status=Code Review
```

### By Status Category
```
?statusCategory=started
```

Categories group multiple related statuses:
- `backlog` - Not ready (Backlog, Icebox)
- `unstarted` - Ready but not started (To Do, Ready)
- `started` - Active work (In Progress, Review, Testing)
- `completed` - Done (Done, Merged, Deployed)
- `canceled` - Won't be done (Canceled, Won't Fix)

---

## Pagination

Search results use cursor-based pagination:

```bash
# First request
GET /api/v1/features?query=auth&limit=20

# Response includes cursor
{
  "data": [...],
  "meta": {
    "hasMore": true,
    "cursor": "next-page-cursor"
  }
}

# Next page
GET /api/v1/features?query=auth&limit=20&cursor=next-page-cursor
```

---

## Feature-Specific Search

### GET /api/v1/features

See [Feature Endpoints](./feature-endpoints.md) for complete feature search documentation.

**Key capabilities:**
- Full-text search in title and description
- Filter by epic, status, statusCategory, assignee
- Date range filtering
- Cursor-based pagination

---

## Task-Specific Search

### GET /api/v1/tasks

See [Task Endpoints](./task-endpoints.md) for complete task search documentation.

**Key capabilities:**
- Full-text search in title and description
- Filter by parent feature
- Filter by status, statusCategory, assignee
- Date range filtering
- Cursor-based pagination

---

## Search Best Practices

### For Testers

**Find your current work:**
```
GET /api/v1/features?assignee=me&statusCategory=started
```

**Find blocked items:**
```
GET /api/v1/features?query=blocked
```

**Find recent activity:**
```
GET /api/v1/features?updatedAt=-P1D
```

### For Dashboards

**Epic progress:**
```
GET /api/v1/features?epicId=<epic-uuid>&statusCategory=completed
```

**Team activity:**
```
GET /api/v1/features?updatedAt=-P7D&epicId=<epic-uuid>
```

**Unassigned work:**
```
GET /api/v1/features?assignee=none&statusCategory=unstarted
```

---

## Related Documentation

- [Feature Endpoints](./feature-endpoints.md) - Feature CRUD and search
- [Task Endpoints](./task-endpoints.md) - Task CRUD and search
- [Status Endpoints](./status-endpoints.md) - Status categories
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
