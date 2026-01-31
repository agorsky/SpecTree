# Linear Hierarchy Model Documentation

> **Research Task**: COM-136 - Document Linear's hierarchy model
> **Date**: 2026-01-23
> **Purpose**: Inform SpecTree's data model design

## Executive Summary

Linear uses a strict hierarchical structure: **Workspace > Teams > Projects > Issues > Sub-Issues**. SpecTree simplifies this to: **Teams > Epics > Features > Tasks**, where Features map to Linear Issues and Tasks map to Linear Sub-Issues.

---

## Hierarchy Diagram

```
                        ┌─────────────┐
                        │  Workspace  │  (Implicit - API-level)
                        └──────┬──────┘
                               │
                 ┌─────────────┼─────────────┐
                 ▼             ▼             ▼
           ┌──────────┐  ┌──────────┐  ┌──────────┐
           │   Team   │  │   Team   │  │   Team   │
           └────┬─────┘  └──────────┘  └──────────┘
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │Project │ │Project │ │Project │
   └───┬────┘ └────────┘ └────────┘
       │
   ┌───┼───┬───────┐
   ▼   ▼   ▼       ▼
┌─────┐┌─────┐┌─────┐┌─────┐
│Issue││Issue││Issue││Issue│  (parentId = null)
└──┬──┘└─────┘└──┬──┘└─────┘
   │             │
   ▼             ▼
┌─────────┐  ┌─────────┐
│Sub-Issue│  │Sub-Issue│  (parentId = parent issue UUID)
└────┬────┘  └─────────┘
     │
     ▼
┌─────────────┐
│Sub-Sub-Issue│  (Linear allows unlimited nesting*)
└─────────────┘

* Note: While Linear allows sub-issues on sub-issues, SpecTree
  will limit to 2 levels (Features > Tasks) for simplicity.
```

---

## Entity Relationship Map

### 1. Workspace (Implicit)
The workspace is the top-level container, managed at the API/authentication level. It is not explicitly created or managed via the MCP tools but is implicit in the authentication context.

**Key Points**:
- One workspace per Linear organization
- Contains all teams, users, labels, initiatives
- Not directly manipulated via MCP tools

### 2. Teams

**Definition**: Organizational units that own projects, issues, and workflow configurations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes (auto) | Unique identifier |
| `name` | String | **Yes** | Team name (e.g., "Commercial", "OasisAI") |
| `icon` | String | No | Icon identifier (e.g., "Recycle", "Shop") |
| `createdAt` | DateTime | Yes (auto) | Creation timestamp |
| `updatedAt` | DateTime | Yes (auto) | Last update timestamp |

**Foreign Keys**:
- Teams belong to a Workspace (implicit)
- Teams have many Epics
- Teams have many Issues (issues are scoped to teams)
- Teams own their Workflow Statuses

**Sample Data**:
```json
{
  "id": "28e43aa8-7024-4a09-abf8-16b146c6136e",
  "name": "Commercial",
  "icon": "Recycle",
  "createdAt": "2026-01-17T00:19:41.686Z",
  "updatedAt": "2026-01-23T19:07:39.366Z"
}
```

### 3. Projects

**Definition**: Containers for related issues within a team. Projects group work toward a common goal.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes (auto) | Unique identifier |
| `name` | String | **Yes** | Project name |
| `description` | String | No | Markdown description |
| `summary` | String | No | Short plaintext summary (max 255 chars) |
| `color` | String | No | Hex color code (e.g., "#bec2c8") |
| `icon` | String | No | Emoji icon |
| `url` | String | Yes (auto) | Linear web URL |
| `startDate` | Date | No | Project start date |
| `targetDate` | Date | No | Project target date |
| `priority` | Integer | No | 0-4 (0=None, 1=Urgent, 4=Low) |
| `status` | Object | Yes (auto) | Project status (Backlog, In Progress, etc.) |
| `labels` | Array | No | Project labels |
| `initiatives` | Array | No | Associated initiatives |
| `lead` | Object | No | Project lead (user) |
| `createdAt` | DateTime | Yes (auto) | Creation timestamp |
| `updatedAt` | DateTime | Yes (auto) | Last update timestamp |

**Foreign Keys**:
- `teamId` - Projects belong to exactly one Team (required on create via `team` param)
- Projects have many Issues

**Create API Required Fields**:
- `name` (string) - Required
- `team` (string) - Required (team name or ID)

**Sample Data**:
```json
{
  "id": "c2d21591-b523-448d-a1c3-5750682c8069",
  "name": "SpecTreeAnalysis",
  "color": "#bec2c8",
  "summary": "",
  "description": "",
  "url": "https://linear.app/apps316/project/spectreeanalysis-edc2b6ffe46b",
  "status": {
    "id": "28d1a819-c543-4183-8ecd-0d66cc310c58",
    "name": "Backlog"
  },
  "labels": [],
  "initiatives": [],
  "lead": {}
}
```

### 4. Issues (SpecTree: Features)

**Definition**: Work items within a project. Can have sub-issues and various metadata.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes (auto) | Unique identifier |
| `identifier` | String | Yes (auto) | Human-readable ID (e.g., "COM-136") |
| `title` | String | **Yes** | Issue title |
| `description` | String | No | Markdown description |
| `url` | String | Yes (auto) | Linear web URL |
| `gitBranchName` | String | Yes (auto) | Suggested git branch name |
| `status` | String | Yes (auto) | Current status name |
| `priority` | Integer | No | 0-4 (0=None, 1=Urgent, 4=Low) |
| `estimate` | Number | No | Story points or time estimate |
| `dueDate` | Date | No | Due date |
| `labels` | Array | No | Issue labels |
| `attachments` | Array | No | File attachments |
| `documents` | Array | No | Linked documents |
| `project` | String | No | Project name |
| `projectId` | UUID | No | Project UUID |
| `parentId` | UUID | No | Parent issue UUID (for sub-issues) |
| `team` | String | **Yes** | Team name |
| `teamId` | UUID | Yes (auto) | Team UUID |
| `cycle` | Object | No | Sprint/cycle reference |
| `assignee` | Object | No | Assigned user |
| `createdBy` | String | Yes (auto) | Creator name |
| `createdById` | UUID | Yes (auto) | Creator UUID |
| `createdAt` | DateTime | Yes (auto) | Creation timestamp |
| `updatedAt` | DateTime | Yes (auto) | Last update timestamp |

**Foreign Keys**:
- `teamId` - Issues belong to exactly one Team (required)
- `projectId` - Issues can optionally belong to a Project
- `parentId` - Sub-issues reference their parent Issue
- `statusId` - Issues have one Status (per team's workflow)
- `assigneeId` - Issues can have one assignee
- `cycleId` - Issues can belong to one Cycle

**Issue Relations** (via `includeRelations: true`):
```json
{
  "relations": {
    "blocks": [],       // Issues this issue blocks
    "blockedBy": [],    // Issues blocking this issue
    "relatedTo": [],    // Related issues
    "duplicateOf": null // Duplicate reference
  }
}
```

**Create API Required Fields**:
- `title` (string) - Required
- `team` (string) - Required (team name or ID)

**Sample Data**:
```json
{
  "id": "8f0eef56-7ea7-4a46-8ccc-3d4d651260cf",
  "identifier": "COM-136",
  "title": "1. Document Linear's hierarchy model",
  "description": "## Objective\n\nDocument how Linear structures...",
  "url": "https://linear.app/apps316/issue/COM-136/...",
  "gitBranchName": "agorsky/com-136-1-document-linears-hierarchy-model",
  "status": "In Progress",
  "project": "SpecTreeAnalysis",
  "projectId": "c2d21591-b523-448d-a1c3-5750682c8069",
  "parentId": "2f8c40fc-506e-46c5-9453-5f01a799f2cb",
  "team": "Commercial",
  "teamId": "28e43aa8-7024-4a09-abf8-16b146c6136e",
  "labels": [],
  "createdBy": "Aaron Gorsky",
  "createdAt": "2026-01-23T23:38:09.596Z"
}
```

### 5. Sub-Issues (SpecTree: Tasks)

**Definition**: Child issues nested under a parent issue. Structurally identical to Issues but with a `parentId` set.

Sub-issues share the exact same schema as Issues. The only difference is:
- `parentId` is set to the parent issue's UUID
- Inherits `project` and `cycle` from parent (if set at creation time)
- Does NOT inherit: team, labels, assignee

**Sample Sub-Issue Data**:
```json
{
  "id": "8f0eef56-7ea7-4a46-8ccc-3d4d651260cf",
  "identifier": "COM-136",
  "title": "1. Document Linear's hierarchy model",
  "parentId": "2f8c40fc-506e-46c5-9453-5f01a799f2cb",
  "team": "Commercial",
  "teamId": "28e43aa8-7024-4a09-abf8-16b146c6136e",
  "project": "SpecTreeAnalysis",
  "projectId": "c2d21591-b523-448d-a1c3-5750682c8069"
}
```

---

## Nesting Limitations

### Sub-Issue Nesting Depth

Based on research (Linear documentation and API exploration):

| Aspect | Linear Behavior | SpecTree Recommendation |
|--------|-----------------|------------------------|
| Max Depth | **Unlimited** (sub-issues can have sub-issues) | **2 levels** (Features > Tasks only) |
| Practical Limit | UI becomes unwieldy at 3+ levels | Enforce at API level |
| Parent Inheritance | Project, Cycle inherited at creation | Same behavior |
| Status Sync | Optional auto-complete parent when all children done | Implement in v2 |

### Key Findings

1. **Linear allows unlimited nesting**: A sub-issue can have its own sub-issues. However, this is rarely used in practice.

2. **SpecTree Simplification**: Limit to 2 levels:
   - Level 1: **Features** (issues with `parentId = null`)
   - Level 2: **Tasks** (issues with `parentId = feature UUID`)
   - Reject attempts to create tasks under tasks

3. **Orphaned Entities**: Linear does not allow truly orphaned issues:
   - Issues MUST belong to a Team
   - Issues CAN exist without a Project (team-level backlog)
   - Sub-issues MUST have a valid parent

---

## Foreign Key Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        FOREIGN KEY MAP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Teams ◄───────────────┬───────────────┬────────────────────┐   │
│    │                   │               │                    │   │
│    │ teamId (FK)       │ teamId (FK)   │ teamId (FK)        │   │
│    ▼                   ▼               ▼                    │   │
│  Projects          Issues          Statuses                 │   │
│    │                   │                                    │   │
│    │ projectId (FK)    │ parentId (FK, self-ref)            │   │
│    │                   ▼                                    │   │
│    └─────────────► Sub-Issues                               │   │
│                        │                                    │   │
│                        │ statusId (FK)                      │   │
│                        ▼                                    │   │
│                    Statuses ◄───────────────────────────────┘   │
│                                                                 │
│  Users ◄──────────────────────────────────────────────────────  │
│    │                                                            │
│    │ assigneeId (FK)   createdById (FK)   lead (FK)             │
│    ▼                   ▼                  ▼                     │
│  Issues             Issues             Projects                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Summary Table

| Parent Entity | Child Entity | FK Field | Cardinality | Required |
|--------------|--------------|----------|-------------|----------|
| Workspace | Team | (implicit) | 1:N | Yes |
| Team | Project | teamId | 1:N | Yes (on create) |
| Team | Issue | teamId | 1:N | Yes |
| Team | Status | teamId | 1:N | Yes |
| Project | Issue | projectId | 1:N | No |
| Issue | Sub-Issue | parentId | 1:N | Yes (for sub) |
| Status | Issue | statusId | 1:N | Yes (auto) |
| User | Issue | assigneeId | 1:N | No |
| User | Issue | createdById | 1:N | Yes (auto) |
| User | Project | leadId | 1:N | No |
| Cycle | Issue | cycleId | 1:N | No |

---

## Workflow Statuses

Statuses are **per-team** and follow Linear's 5-category system:

| Category | Type | Default Status | Color |
|----------|------|----------------|-------|
| Backlog | `backlog` | Backlog | Gray |
| Unstarted | `unstarted` | Todo | Blue |
| Started | `started` | In Progress, In Review | Yellow/Orange |
| Completed | `completed` | Done | Green |
| Canceled | `canceled` | Canceled, Duplicate | Red |

**Sample Status List** (Commercial team):
```json
[
  {"id": "98ce3927-...", "type": "backlog", "name": "Backlog"},
  {"id": "023cb9e5-...", "type": "unstarted", "name": "Todo"},
  {"id": "019c7efa-...", "type": "started", "name": "In Progress"},
  {"id": "2ed4e1ce-...", "type": "started", "name": "In Review"},
  {"id": "9253b186-...", "type": "completed", "name": "Done"},
  {"id": "3fa62dc0-...", "type": "canceled", "name": "Canceled"},
  {"id": "10ec8fce-...", "type": "canceled", "name": "Duplicate"}
]
```

---

## Issue Labels

Labels are defined at the **workspace level** but can be filtered by team. They are reusable across all issues.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes (auto) | Unique identifier |
| `name` | String | **Yes** | Label name |
| `color` | String | No | Hex color code |
| `description` | String | No | Label description |
| `isGroup` | Boolean | No | Parent label for grouping |
| `parentId` | UUID | No | Parent label group ID |

**Sample Labels**:
```json
[
  {"id": "...", "name": "Bug", "color": "#EB5757"},
  {"id": "...", "name": "Feature", "color": "#BB87FC"},
  {"id": "...", "name": "priority/high", "color": "#FF4444"},
  {"id": "...", "name": "priority/medium", "color": "#FFAA44"},
  {"id": "...", "name": "priority/low", "color": "#44AA44"}
]
```

---

## Users

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes (auto) | Unique identifier |
| `name` | String | Yes | Full name |
| `email` | String | Yes | Email address |
| `displayName` | String | Yes | Display/username |
| `isAdmin` | Boolean | Yes | Admin privileges |
| `isGuest` | Boolean | Yes | Guest user flag |
| `isActive` | Boolean | Yes | Active status |
| `status` | String | Yes | Online status |
| `createdAt` | DateTime | Yes (auto) | Creation timestamp |
| `updatedAt` | DateTime | Yes (auto) | Last update timestamp |

**Sample User**:
```json
{
  "id": "7041a413-8328-4f0c-8151-77e2ff7112d0",
  "name": "Aaron Gorsky",
  "email": "agorsky@gmail.com",
  "displayName": "agorsky",
  "isAdmin": true,
  "isGuest": false,
  "isActive": true
}
```

---

## SpecTree Mapping Summary

| Linear Entity | SpecTree Entity | Key Differences |
|--------------|-----------------|-----------------|
| Workspace | (implicit) | No explicit workspace entity |
| Team | Team | Identical structure |
| Project | Epic | Identical structure |
| Issue | Feature | No nesting beyond tasks |
| Sub-Issue | Task | Cannot have children |
| Status | Status | Per-team, 5 categories |
| Label | Label | Workspace-level |
| User | User | Identical structure |
| Cycle | (excluded v1) | Sprints not in MVP |
| Initiative | (excluded v1) | Strategic planning not in MVP |

---

## API Patterns Observed

### Identifier Resolution
Linear MCP tools support flexible identifier resolution:
- UUID: `"8f0eef56-7ea7-4a46-8ccc-3d4d651260cf"`
- Short ID: `"COM-136"`
- Name: `"Commercial"` (for teams)
- Special: `"me"` (for assignee/user)

### Pagination
- Cursor-based pagination
- `hasNextPage` boolean
- `cursor` for next page
- Default `limit`: 50, Max: 250

### Response Shape
```json
{
  "issues": [...],
  "hasNextPage": true,
  "cursor": "uuid-of-last-item"
}
```

---

## Recommendations for SpecTree

1. **Enforce 2-Level Hierarchy**: Reject `parentId` on entities that already have a parent
2. **Auto-Generate Identifiers**: Use `{TEAM_KEY}-{SEQUENCE}` format (e.g., COM-1, COM-2)
3. **Team-Scoped Statuses**: Create default statuses when team is created
4. **Required Fields on Create**:
   - Team: `name`
   - Epic: `name`, `teamId`
   - Feature: `title`, `teamId`
   - Task: `title`, `teamId`, `featureId` (parentId)
5. **Cascade Deletes**: Consider soft-delete with orphan cleanup
6. **Status Inheritance**: Tasks inherit default status from team, not parent feature

---

## Sources

- Linear MCP Tool Exploration (live API data)
- [Linear Docs: Parent and Sub-Issues](https://linear.app/docs/parent-and-sub-issues)
- [Linear Changelog: Sub-Initiatives](https://linear.app/changelog/2025-07-10-sub-initiatives) (for context on nesting limits)
