# Advanced API Endpoints Reference

This document provides a quick reference for advanced Dispatcher API endpoints including sessions, decisions, code context, and other specialized features.

## Overview

This guide covers:
- AI Session Management
- Decision Logging
- Execution Plans
- Changelog
- Code Context (covered in [Feature](./feature-endpoints.md) and [Task](./task-endpoints.md) docs)

For complete examples and details, refer to individual endpoint documentation.

---

## AI Session Endpoints

AI sessions track AI agent work across epic/feature/task implementation. Each session stores context for handoff between agents.

### POST /api/v1/sessions/epic/start

Start a new AI session for an epic.

**Request Body:**
```json
{
  "epicId": "epic-uuid",
  "externalId": "optional-external-session-id"
}
```

**Response:**
```json
{
  "session": {
    "id": "session-uuid",
    "epicId": "epic-uuid",
    "startedAt": "2024-01-15T10:00:00.000Z"
  },
  "previousSession": {
    "summary": "Completed 3 features, 2 blocked",
    "nextSteps": ["Unblock ENG-42", "Start ENG-43"]
  },
  "epicProgress": {
    "completedFeatures": 8,
    "totalFeatures": 12
  }
}
```

---

### POST /api/v1/sessions/epic/end

End the active AI session for an epic with handoff data.

**Request Body:**
```json
{
  "epicId": "epic-uuid",
  "summary": "Completed features ENG-42 and ENG-43",
  "nextSteps": ["Start ENG-44", "Review ENG-42 PR"],
  "blockers": ["ENG-45 waiting for API credentials"],
  "decisions": [
    {
      "decision": "Use Passport.js for OAuth",
      "rationale": "More mature than custom implementation"
    }
  ]
}
```

**Response:**
```json
{
  "session": {
    "id": "session-uuid",
    "epicId": "epic-uuid",
    "startedAt": "2024-01-15T10:00:00.000Z",
    "endedAt": "2024-01-15T14:30:00.000Z",
    "durationMinutes": 270
  }
}
```

---

### GET /api/v1/sessions/epic/active

Get the currently active session for an epic.

**Query:** `?epicId=<epic-uuid>`

---

### GET /api/v1/sessions/epic/last

Get the last completed session for an epic (without starting new session).

**Query:** `?epicId=<epic-uuid>`

---

### GET /api/v1/sessions/epic/history

Get session history for an epic.

**Query:** `?epicId=<epic-uuid>&limit=10`

---

## Decision Logging Endpoints

Decisions preserve the reasoning behind implementation choices for future reference.

### POST /api/v1/decisions

Log a decision with rationale.

**Request Body:**
```json
{
  "epicId": "epic-uuid",
  "featureId": "feature-uuid",
  "taskId": "task-uuid",
  "question": "Which state management library to use?",
  "decision": "Use Zustand",
  "rationale": "Simpler API, smaller bundle size, sufficient for our needs. Redux would be overkill.",
  "alternatives": ["Redux", "MobX", "Jotai"],
  "category": "library",
  "impact": "medium",
  "madeBy": "AI"
}
```

**Decision Categories:**
- `architecture` - System design decisions
- `library` - Package/dependency choices
- `approach` - Implementation strategy
- `scope` - Feature inclusion/exclusion
- `design` - UI/UX decisions
- `tradeoff` - Explicit tradeoff acknowledgment
- `deferral` - Postponed decisions

**Impact Levels:**
- `low` - Minor impact, easily reversible
- `medium` - Moderate impact, some effort to change
- `high` - Major impact, significant effort to reverse

---

### GET /api/v1/decisions

List decisions with filtering.

**Query Parameters:**
- `epicId` - Filter by epic
- `featureId` - Filter by feature
- `taskId` - Filter by task
- `category` - Filter by decision category
- `impact` - Filter by impact level
- `limit` - Results per page (default: 20, max: 100)

---

### GET /api/v1/decisions/search

Search decisions by text query.

**Query:** `?query=authentication&epicId=<epic-uuid>`

---

### GET /api/v1/decisions/task/:taskId/context

Get all decisions related to a task (task, feature, and epic level).

---

### GET /api/v1/decisions/feature/:featureId/context

Get all decisions related to a feature (feature and epic level).

---

## Execution Plan Endpoints

Execution plans show the ordered sequence of features based on dependencies and parallelization.

### GET /api/v1/execution-plans

Get execution plan for an epic.

**Query:** `?epicId=<epic-uuid>`

**Response:**
```json
{
  "data": {
    "epicId": "epic-uuid",
    "epicName": "Q1 2024 Features",
    "phases": [
      {
        "phase": 1,
        "canParallelize": false,
        "items": [
          {
            "id": "feature-uuid",
            "identifier": "ENG-42",
            "title": "User Authentication",
            "executionOrder": 1,
            "estimatedComplexity": "moderate",
            "dependencies": []
          }
        ]
      },
      {
        "phase": 2,
        "canParallelize": true,
        "items": [
          {
            "id": "feature-uuid-2",
            "identifier": "ENG-43",
            "title": "User Profile",
            "executionOrder": 2,
            "estimatedComplexity": "simple",
            "dependencies": ["ENG-42"]
          },
          {
            "id": "feature-uuid-3",
            "identifier": "ENG-44",
            "title": "Email Notifications",
            "executionOrder": 2,
            "estimatedComplexity": "simple",
            "dependencies": ["ENG-42"],
            "parallelGroup": "post-auth"
          }
        ]
      }
    ]
  }
}
```

---

## Changelog Endpoints

Changelog tracks all changes to entities (epics, features, tasks) at the field level.

### GET /api/v1/features/:id/changelog

Get change history for a feature. See [Feature Endpoints](./feature-endpoints.md#get-apiv1featuresidchangelog).

**Query Parameters:**
- `field` - Filter by specific field (e.g., "statusId")
- `since` - Changes on or after this date (ISO-8601)
- `limit` - Max entries (default: 20, max: 100)

---

### GET /api/v1/tasks/:id/changelog

Get change history for a task. See [Task Endpoints](./task-endpoints.md#get-apiv1tasksidchangelog).

---

### GET /api/v1/changelog/epic/:epicId

Get change history for an epic.

---

## Summary & Progress Endpoints

### GET /api/v1/epics/:id/progress-summary

Get comprehensive progress summary for an epic. See [Epic Endpoints](./epic-endpoints.md#get-apiv1epicsidprogress-summary).

Returns:
- Feature/task counts (total, completed, in-progress, blocked)
- Progress percentage
- Blocked items with reasons
- Next actionable items
- Recently completed items

---

### GET /api/v1/me/work

Get all work assigned to current user. See [Auth & User Endpoints](./auth-user-endpoints.md#get-apiv1mework).

---

### GET /api/v1/me/blocked

Get all blocked items assigned to current user. See [Auth & User Endpoints](./auth-user-endpoints.md#get-apiv1meblocked).

---

## Code Context Endpoints

Code context endpoints link git artifacts (files, functions, branches, commits, PRs) to features and tasks.

See detailed documentation:
- [Feature Code Context](./feature-endpoints.md#code-context-endpoints)
- [Task Code Context](./task-endpoints.md#code-context-endpoints)

**Summary:**
- `GET /:id/code-context` - Get all linked artifacts
- `POST /:id/code-context/file` - Link file
- `DELETE /:id/code-context/file` - Unlink file
- `POST /:id/code-context/function` - Link function
- `POST /:id/code-context/branch` - Link branch
- `POST /:id/code-context/commit` - Link commit
- `POST /:id/code-context/pr` - Link pull request

---

## Structured Description Endpoints

Structured descriptions provide rich metadata for epics, features, and tasks.

See detailed documentation:
- [Epic Structured Descriptions](./epic-endpoints.md#structured-description-endpoints)
- [Feature Structured Descriptions](./feature-endpoints.md#structured-description-endpoints)
- [Task Structured Descriptions](./task-endpoints.md#structured-description-endpoints)

**Summary:**
- `GET /:id/structured-desc` - Get description
- `PUT /:id/structured-desc` - Set description
- `PATCH /:id/structured-desc/section` - Update section
- `POST /:id/structured-desc/criterion` - Add acceptance criterion
- `POST /:id/structured-desc/file` - Link file
- `POST /:id/structured-desc/external-link` - Add external link

**Sections:**
- `summary` - Brief description
- `aiInstructions` - Instructions for AI agents
- `acceptanceCriteria` - List of criteria to meet
- `filesInvolved` - File paths
- `functionsToModify` - Functions to change
- `testingStrategy` - Testing approach
- `testFiles` - Test file paths
- `technicalNotes` - Implementation notes
- `riskLevel` - `low`, `medium`, `high`
- `estimatedEffort` - `trivial`, `small`, `medium`, `large`, `xl`

---

## Membership Endpoints

Team membership management.

### GET /api/v1/teams/:teamId/members

List team members.

---

### POST /api/v1/teams/:teamId/members

Add member to team.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "role": "member"
}
```

**Roles:** `guest`, `member`, `admin`

---

### PUT /api/v1/teams/:teamId/members/:userId

Update member role.

---

### DELETE /api/v1/teams/:teamId/members/:userId

Remove member from team.

---

### GET /api/v1/users/:userId/teams

Get all teams a user belongs to.

---

## Related Documentation

- [Epic Endpoints](./epic-endpoints.md) - Epic CRUD
- [Feature Endpoints](./feature-endpoints.md) - Feature CRUD
- [Task Endpoints](./task-endpoints.md) - Task CRUD
- [Team Endpoints](./team-endpoints.md) - Team management
- [Status Endpoints](./status-endpoints.md) - Workflow statuses
- [Auth & User Endpoints](./auth-user-endpoints.md) - Authentication & users
- [Search Endpoints](./search-endpoints.md) - Search & filtering
- [AI Context Endpoints](./ai-context-endpoints.md) - AI context (detailed)
- [Validation Endpoints](./validation-endpoints.md) - Task validations (detailed)
- [Template Endpoints](./template-endpoints.md) - Implementation templates
- [Invitation Endpoints](./invitation-endpoints.md) - User invitations
- [MCP Tools Reference](../MCP/tools-reference.md) - Complete MCP tools reference
