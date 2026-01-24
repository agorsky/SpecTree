# Linear Status Workflow and State Machine

This document describes Linear's workflow states and transitions to inform SpecTree's status system.

## Overview

Linear uses a category-based status system where each status belongs to one of five categories. Statuses are **team-scoped**, meaning each team can have its own set of custom statuses, but they all map to one of the five universal categories.

## Status Categories

Linear defines **5 status categories** (called "types" in the API):

| Category | Description | Example Statuses |
|----------|-------------|------------------|
| `backlog` | Issues that are low priority or not yet ready for work | Backlog, Triage |
| `unstarted` | Issues ready to be worked on but not yet started | Todo, Ready |
| `started` | Issues currently being worked on | In Progress, In Review, In QA |
| `completed` | Issues that have been finished successfully | Done, Merged, Shipped |
| `canceled` | Issues that will not be completed | Canceled, Duplicate, Won't Fix |

## Default Status Types

Based on analysis of multiple Linear teams, the default statuses are:

### Backlog Category
- **Backlog** - Low priority or not yet triaged issues

### Unstarted Category
- **Todo** - Ready to be worked on

### Started Category
- **In Progress** - Currently being worked on
- **In Review** - Code review or approval stage

### Completed Category
- **Done** - Successfully completed

### Canceled Category
- **Canceled** - Will not be completed
- **Duplicate** - Duplicate of another issue

## Status Scope

**Statuses are team-scoped**, not global:
- Each team maintains its own set of workflow states
- Status IDs are unique per team (same status name = different ID per team)
- Teams can customize their workflow by adding/removing statuses
- When moving issues between teams, the status may need to be remapped

Evidence from API responses:
```
Commercial Team:
  - Backlog: 98ce3927-2b1a-4887-ac88-299f11777a62
  - Todo: 023cb9e5-0fd3-4c52-b3ae-cb79dd8acd01

OasisAI Team:
  - Backlog: 721f0240-22ac-4f43-802d-21458c72b336
  - Todo: 28f3f0c6-d91c-4364-a83a-ddeb9da9c528
```

## Status Transitions

Linear uses an **open state machine** - there are no hard restrictions on status transitions:

- **Any status can transition to any other status**
- No blocked transitions in the default configuration
- Teams can implement soft restrictions through automation rules
- The category determines the semantic meaning, not the transition path

### Typical Workflow Flow
```
Backlog -> Todo -> In Progress -> In Review -> Done
                       |
                       +-> Canceled/Duplicate
```

### Key Observations
1. Issues can move backwards (e.g., Done -> In Progress for reopening)
2. Issues can skip stages (e.g., Backlog -> Done for quick fixes)
3. Canceled/Duplicate are terminal states but can be reopened
4. The `started` category can have multiple statuses for different stages

## Custom Status Creation Rules

### Creating Custom Statuses
- Custom statuses must be assigned to one of the 5 categories
- Each team can create unlimited custom statuses
- Custom statuses inherit the behavior of their category
- Status names can be duplicated across teams but not within a team

### Common Custom Status Examples
| Custom Status | Typical Category | Use Case |
|--------------|------------------|----------|
| Triage | backlog | Initial assessment needed |
| Ready | unstarted | Groomed and ready for sprint |
| In QA | started | Testing phase |
| In Design | started | Design work in progress |
| Blocked | started | Waiting on external dependency |
| Merged | completed | Code merged, awaiting deploy |
| Shipped | completed | Deployed to production |
| Won't Fix | canceled | Intentionally not addressing |

### Category Constraints
- `backlog`: Issues not actively tracked in sprints
- `unstarted`: Issues planned but work hasn't begun
- `started`: Active work is happening (progress tracking enabled)
- `completed`: Counts toward velocity/completion metrics
- `canceled`: Excluded from completion metrics

## Status Assignment to Issues

### Initial Status
- New issues default to the first status in the team's `backlog` or `unstarted` category
- Can be explicitly set during issue creation via `state` parameter
- API accepts status name, status ID, or category type

### Updating Status
- Use `update_issue` with `state` parameter
- Accepts status name (matched within team), ID, or category type
- Status changes are tracked in issue history

### Status in API Response
```json
{
  "status": "In Progress",
  "state": {
    "id": "019c7efa-f716-44e0-b786-4230100d4387",
    "type": "started",
    "name": "In Progress"
  }
}
```

## Status Icons and Colors

Based on API analysis, status metadata includes:
- **ID**: Unique identifier (UUID)
- **Name**: Display name (e.g., "In Progress")
- **Type**: Category (backlog, unstarted, started, completed, canceled)

Note: Colors and icons are rendered by Linear's UI based on the category type, not stored as explicit properties on each status.

### Default Category Colors (Linear UI)
| Category | Typical Color |
|----------|---------------|
| backlog | Gray |
| unstarted | Gray/Blue |
| started | Yellow/Orange |
| completed | Green |
| canceled | Red |

## SpecTree Status Mapping

SpecTree uses a simplified 5-status system that maps directly to Linear's categories:

| SpecTree Status | Linear Category | Description |
|-----------------|-----------------|-------------|
| Backlog | `backlog` | Not yet prioritized |
| Todo | `unstarted` | Ready to start |
| In Progress | `started` | Work in progress |
| Done | `completed` | Successfully finished |
| Canceled | `canceled` | Will not be done |

### Mapping Rules
1. When syncing TO Linear: SpecTree status maps to the first status in the corresponding Linear category for the team
2. When syncing FROM Linear: Linear status category maps to the corresponding SpecTree status
3. This ensures compatibility regardless of custom team statuses

### Example Sync Scenarios
```
SpecTree "In Progress" -> Linear "In Progress" (team's default started status)
Linear "In Review" -> SpecTree "In Progress" (both are 'started' category)
Linear "Duplicate" -> SpecTree "Canceled" (both are 'canceled' category)
```

## Implementation Recommendations

1. **Store both status name and category type** - Category provides stable mapping
2. **Use category for sync logic** - Don't rely on matching exact status names
3. **Query team statuses on first sync** - Build a lookup table per team
4. **Handle missing statuses gracefully** - Fall back to category-based mapping
5. **Preserve original status on bidirectional sync** - Don't lose granularity

## References

- Linear Issue: [COM-138](https://linear.app/apps316/issue/COM-138/3-document-linears-status-workflow-and-state-machine)
- Linear API: Workflow States are accessed via `list_issue_statuses`, `get_issue_status`
