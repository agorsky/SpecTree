# Auto-Progress Tracking Tools

This document describes the purpose-built MCP tools for automatic progress tracking in Dispatcher.

> **⚠️ DEPRECATION NOTICE:**  
> The individual tools documented here (`dispatcher__start_work`, `dispatcher__complete_work`, `dispatcher__log_progress`, `dispatcher__report_blocker`) are **DEPRECATED**.  
>  
> **Use instead:** `dispatcher__manage_progress` with action-based routing:
> - `action='start_work'` - Begin working on an item
> - `action='complete_work'` - Mark item as complete
> - `action='log_progress'` - Record incremental progress
> - `action='report_blocker'` - Report blockage
>
> See [Tools Reference](./tools-reference.md#dispatcher__manage_progress) for complete documentation.

## Overview

The progress tracking tools make status updates natural and automatic for AI workflows. Instead of relying on manual status updates, these tools integrate progress tracking directly into the work lifecycle.

## Why These Tools Exist

Previously, AI sessions often forgot to update task/feature status after completing work. Users had to explicitly remind the AI to mark items as done. Status updates felt like an afterthought rather than part of the workflow.

These dedicated tools solve this by:
- Making progress tracking a natural part of the workflow
- Automatically calculating timing data
- Recording context about work progress
- Providing clear, purpose-built interfaces for each progress state

## Available Tools

### dispatcher__start_work

Begin working on a feature or task. Call this when you start working on an item.

**Actions:**
- Sets status to "In Progress"
- Records the start timestamp (`startedAt`)
- Logs an AI note about starting work

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Feature/task identifier (e.g., 'COM-123' or 'COM-123-1') |
| type | "feature" \| "task" | Yes | Whether this is a feature or task |
| sessionId | string | No | AI session identifier for tracking |

**Example:**
```
Use dispatcher__start_work with id="COM-123" type="feature" to begin work
```

### dispatcher__complete_work

Mark a feature or task as complete. Call this when you've finished work on an item.

**Actions:**
- Sets status to "Done"
- Records the completion timestamp (`completedAt`)
- Calculates and stores duration (if `startedAt` was set)
- Sets percentComplete to 100
- Clears any blocker reason
- Optionally logs a summary as an AI note

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Feature/task identifier |
| type | "feature" \| "task" | Yes | Whether this is a feature or task |
| summary | string | No | Optional summary of work completed |
| sessionId | string | No | AI session identifier |

**Example:**
```
Use dispatcher__complete_work with id="COM-123" type="feature" summary="Implemented the progress tracking API and MCP tools"
```

### dispatcher__log_progress

Log incremental progress without changing status. Use for long-running work items.

**Actions:**
- Appends a progress message to AI notes
- Optionally updates percentComplete (0-100)

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Feature/task identifier |
| type | "feature" \| "task" | Yes | Whether this is a feature or task |
| message | string | Yes | Progress message describing current state |
| percentComplete | number | No | Optional 0-100 progress indicator |
| sessionId | string | No | AI session identifier |

**Example:**
```
Use dispatcher__log_progress with id="COM-123" type="feature" message="Schema changes complete, working on service layer" percentComplete=40
```

### dispatcher__report_blocker

Report that work is blocked. Use when something prevents progress.

**Actions:**
- Sets status to "Blocked" (if available)
- Records the blocker reason
- Optionally links to the blocking item (adds to dependencies)
- Logs a blocker note

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Feature/task identifier |
| type | "feature" \| "task" | Yes | Whether this is a feature or task |
| reason | string | Yes | Description of what's blocking progress |
| blockedById | string (UUID) | No | Optional ID of the blocking feature/task |
| sessionId | string | No | AI session identifier |

**Example:**
```
Use dispatcher__report_blocker with id="COM-123" type="feature" reason="Waiting for API review approval"
```

## Database Fields

The following fields were added to support progress tracking:

| Field | Type | Description |
|-------|------|-------------|
| startedAt | DateTime? | When work began |
| completedAt | DateTime? | When work was completed |
| durationMinutes | Int? | Calculated work duration |
| percentComplete | Int? | 0-100 progress indicator |
| blockerReason | String? | Description of what's blocking |

These fields exist on both Feature and Task models.

## Workflow Integration

### Recommended Workflow

1. **Starting work:** Call `dispatcher__start_work` at the beginning
2. **During work:** Use `dispatcher__log_progress` for significant milestones
3. **When blocked:** Call `dispatcher__report_blocker` with details
4. **Completing work:** Call `dispatcher__complete_work` with summary

### Hints in Existing Tools

The `dispatcher__update_feature` and `dispatcher__update_task` tools now include hints reminding AI agents about progress tools:

```
TIP: After completing significant work on a task, consider using:
- dispatcher__complete_work to mark it done (auto-calculates duration)
- dispatcher__log_progress to note partial progress
- dispatcher__start_work to begin work (sets status and timestamps)
```

## API Endpoints

Progress tracking is also available via REST API:

### Features
- `POST /api/v1/features/:id/progress/start` - Start work
- `POST /api/v1/features/:id/progress/complete` - Complete work
- `POST /api/v1/features/:id/progress/log` - Log progress
- `POST /api/v1/features/:id/progress/blocker` - Report blocker

### Tasks
- `POST /api/v1/tasks/:id/progress/start` - Start work
- `POST /api/v1/tasks/:id/progress/complete` - Complete work
- `POST /api/v1/tasks/:id/progress/log` - Log progress
- `POST /api/v1/tasks/:id/progress/blocker` - Report blocker

All endpoints require authentication and team membership (member role or higher).

## Related Tools

### Progress Summary

For dashboard views and session start context, see [Progress Summary](./progress-summary.md):

- `dispatcher__get_progress_summary` - Get comprehensive epic status
- `dispatcher__get_my_work` - Get your work across all epics
- `dispatcher__get_blocked_summary` - Get all blocked items

These complement the progress tracking tools by providing high-level visibility into overall project status.

## Benefits

1. **Clear, purpose-built tools** - Each tool has a specific purpose
2. **Natural workflow integration** - Status updates become part of the work lifecycle
3. **Automatic timing** - Duration calculated automatically
4. **Formal blocker tracking** - Blockers are recorded and linked
5. **AI note integration** - Progress is logged to AI notes for continuity
