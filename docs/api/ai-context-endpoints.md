# AI Context API Endpoints

This document describes the API endpoints for the AI Session Context feature.

## Overview

AI Context endpoints enable AI sessions to store and retrieve structured context, supporting cross-session continuity and knowledge transfer.

## Authentication

All endpoints require:
- Valid JWT access token or API token in the `Authorization` header
- User must have access to the team that owns the feature/task

---

## Feature AI Context Endpoints

### GET /api/v1/features/:id/ai-context

Get AI context for a feature.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Feature ID |

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "feature",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "COM-123",
    "aiContext": "## Current State\nImplementation 70% complete...",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "session-abc",
        "type": "decision",
        "content": "Chose React Query over SWR for data fetching"
      }
    ],
    "lastAiSessionId": "session-abc",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Not a team member
- `404 Not Found` - Feature not found

---

### PUT /api/v1/features/:id/ai-context

Set structured AI context for a feature. Replaces existing context.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Feature ID |

**Request Body:**
```json
{
  "context": "## Summary\nFeature implementation is 80% complete.\n\n## Completed\n- Database schema\n- API routes\n\n## Remaining\n- Frontend components",
  "sessionId": "optional-session-identifier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `context` | string | Yes | Structured context (max 50,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "feature",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "COM-123",
    "aiContext": "## Summary\n...",
    "aiNotes": [...],
    "lastAiSessionId": "optional-session-identifier",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### POST /api/v1/features/:id/ai-note

Append a note to a feature's AI notes array. Notes are append-only.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Feature ID |

**Request Body:**
```json
{
  "noteType": "observation",
  "content": "Found existing auth implementation in src/auth/",
  "sessionId": "optional-session-identifier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `noteType` | enum | Yes | One of: `observation`, `decision`, `blocker`, `next-step`, `context` |
| `content` | string | Yes | Note content (max 10,000 chars) |
| `sessionId` | string | No | Identifier for this AI session |

**Note Types:**
| Type | When to Use |
|------|-------------|
| `observation` | Something discovered during work |
| `decision` | A choice made and its rationale |
| `blocker` | What's preventing progress |
| `next-step` | What should happen next |
| `context` | General background information |

**Success Response (200 OK):**
```json
{
  "data": {
    "entityType": "feature",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "identifier": "COM-123",
    "aiContext": "...",
    "aiNotes": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "sessionId": "optional-session-identifier",
        "type": "observation",
        "content": "Found existing auth implementation in src/auth/"
      }
    ],
    "lastAiSessionId": "optional-session-identifier",
    "lastAiUpdateAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Task AI Context Endpoints

### GET /api/v1/tasks/:id/ai-context

Get AI context for a task. Same response format as features.

### PUT /api/v1/tasks/:id/ai-context

Set AI context for a task. Same request/response format as features.

### POST /api/v1/tasks/:id/ai-note

Append a note to a task's AI notes. Same request/response format as features.

---

## Data Model

### AI Note Structure

```typescript
interface AiNote {
  timestamp: string;      // ISO 8601 format
  sessionId?: string;     // Optional session identifier
  type: "observation" | "decision" | "blocker" | "next-step" | "context";
  content: string;
}
```

### Database Fields

Both Feature and Task models include:

| Field | Type | Description |
|-------|------|-------------|
| `aiContext` | string (nullable) | Structured context for AI consumption |
| `aiNotes` | string (nullable) | JSON array of AiNote objects |
| `lastAiSessionId` | string (nullable) | ID of last AI session that modified context |
| `lastAiUpdateAt` | datetime (nullable) | When context was last updated |

---

## Best Practices

### For AI Agents

1. **At session start**: Call GET to read context from previous sessions
2. **During work**: Use POST to append significant observations and decisions
3. **At session end**: Use PUT to set a summary context for the next session

### Example Workflow

```bash
# 1. Read existing context
GET /api/v1/features/550e8400.../ai-context

# 2. Log an observation during work
POST /api/v1/features/550e8400.../ai-note
{"noteType": "observation", "content": "API already has pagination"}

# 3. Log a decision
POST /api/v1/features/550e8400.../ai-note
{"noteType": "decision", "content": "Using existing pagination, no changes needed"}

# 4. Set summary at end
PUT /api/v1/features/550e8400.../ai-context
{"context": "## Status\nComplete. Used existing pagination.", "sessionId": "session-xyz"}
```

---

## Related Documentation

- [MCP AI Session Context](../MCP/ai-session-context.md) - MCP tools documentation
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
