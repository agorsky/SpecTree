# Session Handoff System

The Session Handoff System provides explicit session management for AI agents working on Dispatcher epics, enabling context preservation and handoff between sessions.

## Overview

When an AI session ends and a new one starts, valuable context is typically lost:
- What was accomplished in the previous session
- What was tried but didn't work
- What should be done next
- Decisions made and their rationale

The Session Handoff System solves this by providing:
- Explicit session start/end protocols
- Automatic work tracking during sessions
- Structured handoff data for successor sessions
- Session history for understanding epic progress

## Data Model

### AiSession

```prisma
model AiSession {
  id             String    @id @default(uuid())
  epicId         String    // Epic this session is working on
  externalId     String?   // Optional external session ID (e.g., Copilot session ID)
  startedAt      DateTime  // When the session started
  endedAt        DateTime? // When the session ended
  status         String    // "active" | "completed" | "abandoned"
  
  // Work tracking
  itemsWorkedOn  String?   // JSON array of {type, id, identifier, action, timestamp}
  summary        String?   // AI-generated summary of session work
  
  // Handoff info for successor sessions
  nextSteps      String?   // JSON array of recommended next actions
  blockers       String?   // JSON array of blockers encountered
  decisions      String?   // JSON array of {decision, rationale}
  contextBlob    String?   // Serialized context for next session
}
```

## MCP Tools

### dispatcher__start_session

Start a new AI session for an epic. Creates a session record, abandons any existing active sessions, and returns handoff data from the previous session.

**Input:**
- `epicId` (required): Epic ID (UUID) or exact epic name
- `externalId` (optional): External session identifier from the AI agent

**Returns:**
- New session details
- Previous session handoff (if exists):
  - summary
  - nextSteps
  - blockers  
  - decisions
  - contextBlob
  - itemsWorkedOn
- Epic progress summary

**Example:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "epicId": "bbc7f42f-aa1c-471c-81af-74c5cd6d33d4",
  "startedAt": "2024-01-15T10:00:00.000Z",
  "epicProgress": {
    "totalFeatures": 5,
    "completedFeatures": 2,
    "inProgressFeatures": 1,
    "totalTasks": 15,
    "completedTasks": 8
  },
  "previousSession": {
    "summary": "Implemented user authentication flow...",
    "nextSteps": ["Add password reset", "Write tests for auth endpoints"],
    "blockers": ["Need design mockups for password reset page"],
    "decisions": [{"decision": "Use JWT for tokens", "rationale": "Simpler stateless auth"}]
  }
}
```

### dispatcher__end_session

End the current AI session with handoff data for successor sessions.

**Input:**
- `epicId` (required): Epic ID (UUID) or exact epic name
- `summary` (required): Summary of work completed (max 10,000 chars)
- `nextSteps` (optional): Array of recommended next actions (max 20 items)
- `blockers` (optional): Array of blockers encountered (max 20 items)
- `decisions` (optional): Array of {decision, rationale} objects (max 20 items)
- `contextBlob` (optional): Serialized context for next session (max 50,000 chars)

**Example:**
```typescript
await dispatcher__end_session({
  epicId: "Mobile App Redesign",
  summary: "Completed login screen implementation and started on profile page",
  nextSteps: [
    "Finish profile page header component",
    "Add error handling for API calls",
    "Review PR from previous session"
  ],
  blockers: [
    "API endpoint for profile update not yet deployed"
  ],
  decisions: [
    {
      decision: "Use React Query for data fetching",
      rationale: "Better caching and automatic refetch on focus"
    }
  ]
});
```

### dispatcher__get_last_session

Get the last completed session for an epic without starting a new one.

**Input:**
- `epicId` (required): Epic ID or name

**Returns:** Session details including all handoff data, or null if no completed sessions exist.

### dispatcher__get_session_history

Get the history of all sessions for an epic.

**Input:**
- `epicId` (required): Epic ID or name
- `limit` (optional): Maximum sessions to return (default: 10, max: 100)

**Returns:** List of sessions with summaries and counts.

### dispatcher__get_active_session

Check if there's an active session for an epic.

**Input:**
- `epicId` (required): Epic ID or name

**Returns:** Active session details or null.

## Automatic Work Tracking

The following operations automatically track work progress:
- `dispatcher__manage_progress` with action `start_work` - begins work on an item
- `dispatcher__manage_progress` with action `complete_work` - completes work on an item
- `dispatcher__manage_progress` with action `log_progress` - logs incremental progress

This means AI agents don't need to manually track work - it's built into the progress tools.

## Best Practices

### Starting a Session

Always start a session before beginning work on an epic:

```typescript
// At the start of your work
const { previousSession, epicProgress } = await dispatcher__start_session({
  epicId: "COM-5",
  externalId: "copilot-session-xyz"  // Optional: your session ID
});

// Review previous session context
if (previousSession) {
  console.log("Previous summary:", previousSession.summary);
  console.log("Suggested next steps:", previousSession.nextSteps);
  console.log("Known blockers:", previousSession.blockers);
}
```

### Ending a Session

Always end your session with good handoff data:

```typescript
// At the end of your work
await dispatcher__end_session({
  epicId: "COM-5",
  summary: "Implemented session handoff feature including Prisma model, " +
           "service layer, API routes, and MCP tools. All tests passing.",
  nextSteps: [
    "Add integration tests for session routes",
    "Document session handoff in main README",
    "Consider adding session analytics dashboard"
  ],
  blockers: [],  // None currently
  decisions: [
    {
      decision: "Store JSON arrays as strings in SQLite",
      rationale: "SQLite doesn't support native arrays; consistent with existing patterns"
    },
    {
      decision: "Auto-abandon old active sessions on new session start",
      rationale: "Prevents orphaned sessions and ensures clean state"
    }
  ]
});
```

### Handoff Data Guidelines

**Summary:**
- Be specific about what was accomplished
- Mention any code changes made
- Note the current state of the work

**Next Steps:**
- Be actionable and specific
- Prioritize the most important items
- Include any dependencies or blockers

**Decisions:**
- Document significant architectural choices
- Include rationale for future context
- Note any trade-offs considered

**Context Blob:**
- Use for complex state that doesn't fit elsewhere
- Can be JSON, markdown, or structured data
- Useful for work-in-progress code snippets

## Session States

| Status | Description |
|--------|-------------|
| `active` | Session is currently in progress |
| `completed` | Session ended normally with handoff data |
| `abandoned` | Session was replaced by a new session |

## API Endpoints

The Session Handoff System exposes the following REST endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/start` | Start a new session |
| POST | `/api/v1/sessions/:epicId/end` | End active session |
| GET | `/api/v1/sessions/:epicId/active` | Get active session |
| GET | `/api/v1/sessions/:epicId/last` | Get last completed session |
| GET | `/api/v1/sessions/:epicId/history` | Get session history |
| GET | `/api/v1/sessions/by-id/:id` | Get session by ID |
| POST | `/api/v1/sessions/:epicId/log-work` | Log work item |
| POST | `/api/v1/sessions/by-id/:id/abandon` | Abandon a session |

## Integration with Existing Features

The Session Handoff System complements existing AI context features:

- **AI Context (`aiContext` field)**: Per-feature/task structured context
- **AI Notes (`aiNotes` field)**: Per-feature/task append-only notes  
- **Session Handoff**: Per-epic session-level context and work tracking

Use AI Context/Notes for item-specific details, and Session Handoff for session-level workflow and epic progress.
