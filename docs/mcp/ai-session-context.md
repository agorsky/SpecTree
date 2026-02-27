# AI Session Context

> **⚠️ DEPRECATION NOTICE:**  
> The individual AI context tools (`dispatcher__get_ai_context`, `dispatcher__set_ai_context`, `dispatcher__append_ai_note`) are **DEPRECATED**.  
>  
> **Use instead:** `dispatcher__manage_ai_context` with action-based routing:
> - `action='get_context'` - Retrieve AI context and notes
> - `action='set_context'` - Replace entire context
> - `action='append_note'` - Add a note
>
> See [Tools Reference](./tools-reference.md#dispatcher__manage_ai_context) for complete documentation.

This guide explains how AI agents can use Dispatcher's AI context features for cross-session continuity and knowledge transfer.

---

## Overview

When an AI session works on a feature or task and ends, the next session often lacks crucial context:
- What was tried and why it didn't work
- Decisions made and their rationale
- Where work left off
- Accumulated learnings and observations

The AI Session Context feature solves this by providing dedicated fields on Features and Tasks for AI-to-AI communication.

---

## Data Model

### Fields

Each Feature and Task has four AI context fields:

| Field | Type | Description |
|-------|------|-------------|
| `aiContext` | string | Structured context (summary, current state, technical notes) |
| `aiNotes` | JSON array | Append-only log of observations, decisions, blockers |
| `lastAiSessionId` | string | Identifier of the last AI session that modified context |
| `lastAiUpdateAt` | datetime | When context was last updated |

### AI Note Structure

```typescript
interface AiNote {
  timestamp: string;      // ISO 8601
  sessionId?: string;     // Optional session identifier
  type: "observation" | "decision" | "blocker" | "next-step" | "context";
  content: string;
}
```

---

## MCP Tools

### dispatcher__get_ai_context

Retrieve all AI context for a feature or task.

```json
{
  "id": "COM-123",
  "type": "feature"
}
```

**Response:**
```json
{
  "entityType": "feature",
  "entityId": "82225b83-...",
  "identifier": "COM-123",
  "aiContext": "## Current State\nImplementation 70% complete...",
  "aiNotes": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "sessionId": "session-abc",
      "type": "decision",
      "content": "Chose React Query over SWR for data fetching"
    }
  ],
  "lastAiSessionId": "session-abc",
  "lastAiUpdateAt": "2024-01-15T10:30:00Z"
}
```

### dispatcher__set_ai_context

Set or update the structured AI context field.

```json
{
  "id": "COM-123",
  "type": "feature",
  "context": "## Current State\nImplementation complete.\n\n## Key Files\n- src/auth/provider.ts\n- src/hooks/useAuth.ts",
  "sessionId": "session-xyz"
}
```

### dispatcher__append_ai_note

Add a note to the AI notes array. Notes are append-only.

```json
{
  "id": "COM-123",
  "type": "feature",
  "noteType": "observation",
  "content": "Found that the existing auth provider already handles refresh tokens",
  "sessionId": "session-xyz"
}
```

---

## Note Types

Choose the appropriate note type for each entry:

| Type | When to Use | Example |
|------|-------------|---------|
| `observation` | Something you discovered | "The API already has pagination built in" |
| `decision` | A choice you made and why | "Using Zod for validation because it integrates with tRPC" |
| `blocker` | What's preventing progress | "Blocked: Need database credentials for staging" |
| `next-step` | What should happen next | "Next: Implement the /users endpoint" |
| `context` | General background information | "This module was originally written for v1 API" |

---

## Best Practices

### At Session Start

1. **Always read context first:**
   ```json
   dispatcher__get_ai_context({ "id": "COM-123", "type": "feature" })
   ```

2. **Review notes for:**
   - Previous blockers that may be resolved
   - Decisions that constrain your approach
   - Where work left off

### During Work

1. **Log significant observations:**
   - Unexpected findings in the codebase
   - Discovered constraints or requirements
   - Technical details that affect implementation

2. **Log decisions with rationale:**
   - Architectural choices
   - Library/tool selections
   - Trade-offs made

3. **Log blockers immediately:**
   - Missing dependencies or access
   - Unclear requirements
   - Technical limitations discovered

### At Session End

1. **Update structured context:**
   ```json
   dispatcher__set_ai_context({
     "id": "COM-123",
     "type": "feature",
     "context": "## Status\nPartially complete\n\n## Completed\n- Database schema\n- API routes\n\n## Remaining\n- Frontend components\n- Tests",
     "sessionId": "your-session-id"
   })
   ```

2. **Leave a next-step note:**
   ```json
   dispatcher__append_ai_note({
     "id": "COM-123",
     "type": "feature",
     "noteType": "next-step",
     "content": "Continue with React components in packages/web/src/features/"
   })
   ```

---

## API Endpoints

For direct API access (without MCP):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/features/:id/ai-context` | Get AI context for a feature |
| PUT | `/api/v1/features/:id/ai-context` | Set AI context for a feature |
| POST | `/api/v1/features/:id/ai-note` | Append note to a feature |
| GET | `/api/v1/tasks/:id/ai-context` | Get AI context for a task |
| PUT | `/api/v1/tasks/:id/ai-context` | Set AI context for a task |
| POST | `/api/v1/tasks/:id/ai-note` | Append note to a task |

### Request/Response Examples

**Append AI Note:**
```http
POST /api/v1/features/82225b83.../ai-note
Content-Type: application/json

{
  "noteType": "decision",
  "content": "Using SQLite for simplicity",
  "sessionId": "optional-session-id"
}
```

**Set AI Context:**
```http
PUT /api/v1/features/82225b83.../ai-context
Content-Type: application/json

{
  "context": "## Summary\nFeature is 80% complete...",
  "sessionId": "optional-session-id"
}
```

---

## Related Documentation

- [Tools Reference](./tools-reference.md) - Complete MCP tools reference
- [Execution Metadata](./execution-metadata.md) - Planning work execution
