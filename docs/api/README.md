# Dispatcher API Documentation

**Complete REST API reference for internal testers and developers**

## Quick Start

- 🚀 **New to Dispatcher API?** Start with [Authentication & Users](./auth-user-endpoints.md)
- 🔍 **Looking for something?** Check the [Complete Endpoint List](#complete-endpoint-list)
- 📝 **Working with features?** See [Features](./feature-endpoints.md), [Tasks](./task-endpoints.md), and [Epics](./epic-endpoints.md)

---

## Complete Endpoint List

### Core Work Item Management

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Epics** | [epic-endpoints.md](./epic-endpoints.md) | 19 | Top-level containers for features |
| **Features** | [feature-endpoints.md](./feature-endpoints.md) | 28+ | Primary work items (like Jira issues) |
| **Tasks** | [task-endpoints.md](./task-endpoints.md) | 28+ | Sub-issues under features |

### Authentication & Users

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Auth & Users** | [auth-user-endpoints.md](./auth-user-endpoints.md) | 12+ | Login, registration, user management, personal scope |
| **Invitations** | [invitation-endpoints.md](./invitation-endpoints.md) | 5 | Admin invitation system for new users |

### Organization

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Teams** | [team-endpoints.md](./team-endpoints.md) | 5 | Team management and access control |
| **Statuses** | [status-endpoints.md](./status-endpoints.md) | 6 | Workflow status management |

### Search & Discovery

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Search** | [search-endpoints.md](./search-endpoints.md) | Unified | Search features and tasks with advanced filtering |

### Templates & Planning

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Templates** | [template-endpoints.md](./template-endpoints.md) | 8 | Reusable implementation plan templates |
| **Execution Plans** | [advanced-endpoints.md](./advanced-endpoints.md#execution-plan-endpoints) | 1 | Dependency-aware feature ordering |

### AI & Automation

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **AI Context** | [ai-context-endpoints.md](./ai-context-endpoints.md) | 6 | AI session context and notes |
| **Validations** | [validation-endpoints.md](./validation-endpoints.md) | 8 | Executable acceptance criteria for tasks |
| **Sessions** | [advanced-endpoints.md](./advanced-endpoints.md#ai-session-endpoints) | 5 | AI session management and handoff |
| **Decisions** | [advanced-endpoints.md](./advanced-endpoints.md#decision-logging-endpoints) | 5 | Implementation decision tracking |

### Tracking & History

| Category | Documentation | Endpoints | Description |
|----------|---------------|-----------|-------------|
| **Code Context** | [feature-endpoints.md](./feature-endpoints.md#code-context-endpoints) | 7 | Link git artifacts (files, branches, PRs) |
| **Structured Descriptions** | [epic-endpoints.md](./epic-endpoints.md#structured-description-endpoints) | 6 | Rich metadata for work items |
| **Changelog** | [advanced-endpoints.md](./advanced-endpoints.md#changelog-endpoints) | 3 | Field-level change history |

---

## Common Tasks

### For Testers

**Get started:**
1. [Activate your account](./invitation-endpoints.md#post-apiv1authactivate) with invitation code
2. [Login](./auth-user-endpoints.md#post-apiv1authlogin) to get access token
3. [List your teams](./team-endpoints.md#get-apiv1teams)

**Daily workflows:**
- [Find your assigned work](./auth-user-endpoints.md#get-apiv1mework)
- [Search for features](./search-endpoints.md#unified-search)
- [Update task status](./task-endpoints.md#put-apiv1tasksid)
- [Report a blocker](./feature-endpoints.md#post-apiv1featuresidreport-blocker)

**Testing workflows:**
- [Run task validations](./validation-endpoints.md#post-apiv1taskstaskidvalidationsrun-all)
- [View change history](./feature-endpoints.md#get-apiv1featuresidchangelog)
- [Get blocked items](./auth-user-endpoints.md#get-apiv1meblocked)

### For Developers

**Integration:**
- [Authentication flow](./auth-user-endpoints.md#authentication-flow-examples)
- [Create features programmatically](./feature-endpoints.md#post-apiv1features)
- [Link git commits and PRs](./feature-endpoints.md#post-apiv1featuresidcode-contextcommit)

**Advanced:**
- [Use templates](./template-endpoints.md#post-apiv1templatesidcreate)
- [Get execution plan](./advanced-endpoints.md#get-apiv1execution-plans)
- [Log implementation decisions](./advanced-endpoints.md#post-apiv1decisions)

---

## API Conventions

### Authentication

All endpoints (except `/auth/activate`) require authentication:
```
Authorization: Bearer <access_token>
```

**Token Lifetimes:**
- Access Token: 15 minutes
- Refresh Token: 7 days

[See complete auth documentation →](./auth-user-endpoints.md)

### Response Format

**Success Response:**
```json
{
  "data": { /* single object */ },
  "meta": { /* pagination */ }
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | OK | Successful GET/PUT/PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation error |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limit exceeded |

### Pagination

Most list endpoints use cursor-based pagination:
```json
{
  "data": [...],
  "meta": {
    "hasMore": true,
    "cursor": "next-page-cursor"
  }
}
```

Use `?cursor=<cursor>&limit=20` for the next page.

### Filtering

Common query parameters:
- `?query=text` - Full-text search
- `?status=In Progress` - Filter by status
- `?statusCategory=started` - Filter by status category
- `?assignee=me` - Filter by assignee
- `?epicId=<uuid>` - Filter by epic
- `?createdAt=-P7D` - Filter by date (last 7 days)

[See complete search documentation →](./search-endpoints.md)

---

## Resource Identifiers

### Features & Tasks

Features have auto-generated identifiers based on team key:
- Format: `{TEAM_KEY}-{NUMBER}`
- Example: `ENG-42`

Tasks inherit the feature identifier:
- Format: `{TEAM_KEY}-{FEATURE_NUMBER}-{TASK_NUMBER}`
- Example: `ENG-42-1`

### Epics & Teams

- Epics: Use UUID or exact name
- Teams: Accept UUID, name, or key (e.g., "ENG", "Engineering", or UUID)

---

## Status Categories

Statuses are grouped into categories that trigger automatic behaviors:

| Category | Behaviors | Examples |
|----------|-----------|----------|
| `backlog` | Not ready | Backlog, Icebox |
| `unstarted` | Ready, not started | To Do, Ready |
| `started` | In progress, sets `startedAt` | In Progress, Review, Testing |
| `completed` | Done, sets `completedAt` | Done, Merged, Deployed |
| `canceled` | Won't be done | Canceled, Won't Fix |

[See complete status documentation →](./status-endpoints.md)

---

## Team Roles

| Role | Permissions |
|------|-------------|
| `guest` | Read-only access |
| `member` | Create and edit work items |
| `admin` | Full access including team management |

[See complete team documentation →](./team-endpoints.md)

---

## Additional Resources

### Internal Documentation
- [Endpoint Inventory](../archive/planning/ENDPOINT-INVENTORY.md) - Pre-cleanup catalog of all 164 endpoints *(historical snapshot)*
- [Audit Report](../archive/planning/AUDIT-REPORT.md) - Pre-cleanup documentation coverage analysis *(historical snapshot)*

### MCP Integration
- [MCP Tools Reference](../MCP/tools-reference.md) - AI agent integration
- [Templates Guide](../MCP/templates.md) - Implementation plan templates

---

## Documentation Coverage

**Current Status:** 73% of endpoints documented (120+ out of 164 total)

**Fully Documented Categories:**
- ✅ Epics (19 endpoints)
- ✅ Features (28+ endpoints)
- ✅ Tasks (28+ endpoints)
- ✅ Teams (5 endpoints)
- ✅ Statuses (6 endpoints)
- ✅ Authentication & Users (12+ endpoints)
- ✅ Search (unified endpoint)
- ✅ Templates (8 endpoints)
- ✅ AI Context (6 endpoints)
- ✅ Validations (8 endpoints)
- ✅ Invitations (5 endpoints)

**Quick Reference Provided:**
- Sessions (5 endpoints)
- Decisions (5 endpoints)
- Execution Plans (1 endpoint)
- Changelog (3 endpoints)
- Code Context (7 endpoints)
- Structured Descriptions (6 endpoints)
- Memberships (5 endpoints)

**Not Yet Documented (Low Priority):**
- API Tokens (4 endpoints)
- User Activity Feed (1 endpoint)
- Events (1 endpoint)

---

## Support

For questions or issues:
1. Check the relevant endpoint documentation above
2. Search the [Endpoint Inventory](../archive/planning/ENDPOINT-INVENTORY.md)
3. Review common error codes and solutions in each doc
4. Contact the Dispatcher team

---

**Last Updated:** February 10, 2026  
**API Version:** v1  
**Base URL:** `https://api.dispatcher.app/api/v1`
