# Linear API Patterns and Response Shapes

This document captures Linear's API response patterns to inform SpecTree's REST API design. The goal is to ensure consistency when switching between Linear and SpecTree MCP servers.

## Table of Contents

1. [Standard Response Envelope](#standard-response-envelope)
2. [Pagination Pattern](#pagination-pattern)
3. [Error Response Format](#error-response-format)
4. [Common Field Patterns](#common-field-patterns)
5. [Entity-Specific Shapes](#entity-specific-shapes)
6. [Design Recommendations for SpecTree](#design-recommendations-for-spectree)

---

## Standard Response Envelope

### List Operations

Linear's list operations return a consistent envelope with the following structure:

```json
{
  "<entities>": [...],
  "hasNextPage": boolean,
  "cursor": string | undefined
}
```

**Key observations:**
- The entity array key is pluralized (e.g., `issues`, `projects`, `teams`, `users`, `labels`, `documents`)
- `hasNextPage` is always present as a boolean
- `cursor` is only present when `hasNextPage` is `true`
- When there are no more pages, `cursor` is omitted entirely

**Example - List Issues Response:**
```json
{
  "issues": [
    {
      "id": "3a980d03-9ce5-4bd3-a597-96884401adb1",
      "identifier": "COM-214",
      "title": "Technology Stack & Architecture Decisions",
      "description": "## Overview...",
      "url": "https://linear.app/apps316/issue/COM-214/...",
      "gitBranchName": "agorsky/com-214-technology-stack...",
      "createdAt": "2026-01-23T23:54:12.192Z",
      "updatedAt": "2026-01-24T00:59:11.820Z",
      "status": "Done",
      "labels": [],
      "attachments": [],
      "documents": [],
      "createdBy": "Aaron Gorsky",
      "createdById": "7041a413-8328-4f0c-8151-77e2ff7112d0",
      "project": "SpecTreeAnalysis",
      "projectId": "c2d21591-b523-448d-a1c3-5750682c8069",
      "team": "Commercial",
      "teamId": "28e43aa8-7024-4a09-abf8-16b146c6136e"
    }
  ],
  "hasNextPage": true,
  "cursor": "3a980d03-9ce5-4bd3-a597-96884401adb1"
}
```

### Single Entity Operations (Get)

Single entity responses return the entity directly without an envelope:

```json
{
  "id": "...",
  "identifier": "...",
  ...all entity fields...
}
```

**Note:** No wrapper object - the entity is returned at the root level.

---

## Pagination Pattern

Linear uses **cursor-based pagination** with the following characteristics:

### Request Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 50 | 250 | Number of results to return |
| `cursor` | string | - | - | Cursor from previous response |
| `orderBy` | string | `updatedAt` | - | Sort order (`createdAt` or `updatedAt`) |

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `hasNextPage` | boolean | Whether more results exist |
| `cursor` | string (optional) | Pass to next request to get more results |

### Pagination Flow

```
1. Initial Request:
   GET /issues?limit=50

2. Response includes:
   { "issues": [...], "hasNextPage": true, "cursor": "abc123" }

3. Next Page Request:
   GET /issues?limit=50&cursor=abc123

4. Final Page Response:
   { "issues": [...], "hasNextPage": false }
   // Note: cursor field is omitted when hasNextPage is false
```

### Cursor Format

The cursor appears to be the UUID of the last entity in the result set. This is an opaque value that clients should not parse or construct.

**Example cursor values:**
- `df225193-7d07-4106-8b93-4c9935193f9a`
- `79bf75d7-8963-4513-a1bf-73c6bd157d7e`

---

## Error Response Format

Linear returns errors as simple error objects or strings:

### Entity Not Found

```json
{
  "error": "Entity not found: Issue - Could not find referenced Issue."
}
```

Or as a simple error string:
```
Error: Project not found
```

### Error Pattern Analysis

| Scenario | Error Format |
|----------|--------------|
| Issue not found | `Entity not found: Issue - Could not find referenced Issue.` |
| Project not found | `Error: Project not found` |
| Invalid identifier | `Entity not found: Issue - Could not find referenced Issue.` |

**Key observations:**
- Errors include the entity type in the message
- The MCP layer may transform/simplify error responses
- No HTTP status codes visible through MCP (handled at transport layer)

### Recommended Error Shape for SpecTree

Based on REST best practices and Linear's patterns:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Issue not found",
    "entity": "Issue",
    "details": {}
  }
}
```

---

## Common Field Patterns

### Universal Fields (Present on All Entities)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier (UUID v4 format) |
| `createdAt` | string (ISO 8601) | Creation timestamp |
| `updatedAt` | string (ISO 8601) | Last update timestamp |

### Common Optional Fields

| Field | Type | Present On |
|-------|------|------------|
| `name` | string | Teams, Users, Labels, Projects |
| `description` | string | Issues, Projects, Labels |
| `url` | string | Issues, Projects, Documents |
| `color` | string (hex) | Projects, Labels |

### Timestamp Format

All timestamps use ISO 8601 format with millisecond precision:
```
2026-01-23T23:54:12.192Z
```

### ID Formats

- **UUID**: `3a980d03-9ce5-4bd3-a597-96884401adb1` (primary identifiers)
- **Identifier**: `COM-214` (human-readable issue identifiers)
- **Slug**: `spectreeanalysis-edc2b6ffe46b` (URL-friendly identifiers)

---

## Entity-Specific Shapes

### Issue

```typescript
interface Issue {
  // Identity
  id: string;                    // UUID
  identifier: string;            // e.g., "COM-214"

  // Content
  title: string;
  description: string;           // Markdown content
  url: string;                   // Linear web URL
  gitBranchName: string;         // Suggested git branch name

  // Timestamps
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601

  // Status
  status: string;                // e.g., "Done", "In Progress", "Backlog"

  // Relations (denormalized names + IDs)
  createdBy: string;             // User name
  createdById: string;           // User UUID
  project: string;               // Project name
  projectId: string;             // Project UUID
  team: string;                  // Team name
  teamId: string;                // Team UUID
  parentId?: string;             // Parent issue UUID (for sub-issues)

  // Collections
  labels: Label[];
  attachments: Attachment[];
  documents: Document[];

  // Relations (when includeRelations=true)
  relations?: {
    blocks: Issue[];
    blockedBy: Issue[];
    relatedTo: Issue[];
    duplicateOf: Issue | null;
  };
}
```

### Project

```typescript
interface Project {
  id: string;                    // UUID
  name: string;
  summary: string;               // Optional short description
  description: string;           // Optional full description
  color: string;                 // Hex color code
  url: string;                   // Linear web URL

  createdAt: string;
  updatedAt: string;

  // Relations
  labels: Label[];
  initiatives: Initiative[];
  lead: User | {};               // Empty object if no lead
  status: {
    id: string;
    name: string;                // e.g., "Backlog", "In Progress"
  };
}
```

### Team

```typescript
interface Team {
  id: string;
  name: string;
  icon?: string;                 // e.g., "Recycle", "Shop"
  createdAt: string;
  updatedAt: string;
}
```

### User

```typescript
interface User {
  id: string;
  name: string;                  // Full name or email
  email: string;
  displayName: string;           // Username/handle

  isAdmin: boolean;
  isGuest: boolean;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;

  status: string;                // e.g., "Offline (last seen 2026-01-23T19:16:53.780Z)"
}
```

### Label

```typescript
interface Label {
  id: string;
  name: string;
  color: string;                 // Hex color code
  description?: string;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  body: string;                  // Markdown content
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
  };
}
```

### Document

```typescript
interface Document {
  id: string;
  title: string;
  content: string;               // Markdown content (may be truncated)
  icon?: string;                 // e.g., ":book:"
  url: string;
  slugId: string;                // URL-friendly identifier

  createdAt: string;
  updatedAt: string;

  creator: { id: string; name: string; };
  updatedBy: { id: string; name: string; };
  project: { id: string; name: string; };
  initiative: Initiative | null;
}
```

### Issue Status (Workflow State)

```typescript
interface IssueStatus {
  id: string;
  name: string;                  // e.g., "Backlog", "In Progress", "Done"
  type: string;                  // "backlog" | "unstarted" | "started" | "completed" | "canceled"
}
```

---

## Design Recommendations for SpecTree

Based on Linear's patterns, SpecTree should implement:

### 1. Consistent Response Envelope

```typescript
// List Response
interface ListResponse<T> {
  [entityName: string]: T[];     // Pluralized entity name
  hasNextPage: boolean;
  cursor?: string;               // Only present when hasNextPage is true
}

// Single Entity Response
// Return entity directly, no wrapper
```

### 2. Cursor-Based Pagination

- Use cursor-based pagination (not offset-based)
- Default limit: 50, max limit: 250
- Cursor should be an opaque string (entity ID)
- Support `orderBy` parameter with `createdAt`/`updatedAt`

### 3. Standard Field Naming

- Use camelCase for all field names
- Always include: `id`, `createdAt`, `updatedAt`
- Include both name and ID for relations: `project` + `projectId`
- Use ISO 8601 for all timestamps

### 4. Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;        // e.g., "NOT_FOUND", "VALIDATION_ERROR"
    message: string;     // Human-readable message
    entity?: string;     // Entity type if applicable
    field?: string;      // Field name for validation errors
    details?: object;    // Additional context
  };
}
```

### 5. Query Parameters for List Operations

| Parameter | Description |
|-----------|-------------|
| `limit` | Number of results (default 50, max 250) |
| `cursor` | Pagination cursor |
| `orderBy` | Sort field (`createdAt`, `updatedAt`) |
| `includeArchived` | Include archived entities |
| `query` | Text search |
| Entity-specific filters (e.g., `project`, `team`, `assignee`) |

### 6. Denormalized Relations

Include both the human-readable name AND the ID for foreign keys:
```json
{
  "project": "SpecTreeAnalysis",
  "projectId": "c2d21591-b523-448d-a1c3-5750682c8069"
}
```

This allows:
- UI to display names without additional lookups
- Code to reference by ID for API calls

---

## Appendix: Sample API Calls

### List Issues with Pagination

```
Request 1: limit=3
Response: { issues: [...], hasNextPage: true, cursor: "abc" }

Request 2: limit=3, cursor="abc"
Response: { issues: [...], hasNextPage: true, cursor: "def" }

Request 3: limit=3, cursor="def"
Response: { issues: [...], hasNextPage: false }
```

### Get Single Issue

```
Request: GET /issue/COM-214
Response: { id: "...", identifier: "COM-214", title: "...", ... }
```

### Error Response

```
Request: GET /issue/INVALID-999
Response: { error: { code: "NOT_FOUND", message: "Issue not found", entity: "Issue" } }
```

---

*Document created for Linear ticket COM-139*
*Last updated: 2026-01-23*
