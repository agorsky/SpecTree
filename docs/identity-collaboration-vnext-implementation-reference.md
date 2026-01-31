# Identity & Collaboration vNext - Implementation Reference

**Purpose:** This document provides a comprehensive reference for all changes implemented as part of the "Identity & Collaboration vNext" initiative. Use this to quickly understand what was changed, where files are located, and the architectural decisions made.

**Linear Project:** [Identity & Collaboration vNext](https://linear.app/apps316/project/identity-and-collaboration-vnext-16d22abb06ae)

---

## Executive Summary

The Identity & Collaboration vNext project transformed SpecTree from an "everyone sees everything" model to a proper identity system with:

1. **Personal Scopes** - Each user has a private container for personal work
2. **Invite-Only Teams** - Users must be explicitly added to teams (no auto-join)
3. **Deterministic Access Control** - Visibility derived from scope ownership
4. **Last-Admin Guardrails** - Prevents orphaning teams without administrators

### Key Behavioral Changes

| Before | After |
|--------|-------|
| New users auto-joined ALL teams | New users get PersonalScope only, must be invited to teams |
| No concept of private work | PersonalScope provides private projects/features/tasks |
| Everyone could see everything | Visibility restricted to owned scopes and team memberships |
| Could remove last admin from team | Guardrails prevent orphaning teams |

---

## Design Reference

**Primary Specification:** `docs/DESIGN-REFERENCES/spectree-vnext-identity-collaboration-migration.md`

This document contains the full behavioral specification, migration policy, and acceptance criteria that guided the implementation.

---

## Database Schema Changes

### New Model: PersonalScope

**File:** `packages/api/prisma/schema.prisma` (lines 200-211)

```prisma
model PersonalScope {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  statuses Status[]
  epics    Epic[]

  @@map("personal_scopes")
}
```

**Key Constraints:**
- One PersonalScope per user (enforced by `@unique` on `userId`)
- Cascade delete when user is deleted
- Owns statuses and projects within the personal scope

### Modified Models

#### User Model
- Added optional `personalScope` relation (one-to-one)

#### Epic Model
- `teamId` is now **optional** (nullable) - was required
- Added `personalScopeId` (optional) - FK to PersonalScope
- Added `scopeType` field: `"team"` or `"personal"` (defaults to `"team"`)
- New indexes on `personalScopeId`

#### Status Model
- `teamId` is now **optional** (nullable) - was required
- Added `personalScopeId` (optional) - FK to PersonalScope
- New index on `personalScopeId`

### Schema Diagram

```
User (1) ─────────── (0..1) PersonalScope
                              │
                              ├── (0..*) Status
                              └── (0..*) Epic
                                          │
                                          └── (0..*) Feature
                                                      │
                                                      └── (0..*) Task

User (0..*) ─── Membership ─── (0..*) Team
                                        │
                                        ├── (0..*) Status
                                        └── (0..*) Epic
```

---

## New Service: PersonalScopeService

**File:** `packages/api/src/services/personalScopeService.ts`

### Exported Functions

| Function | Description |
|----------|-------------|
| `getPersonalScopeById(id)` | Get PersonalScope by its UUID |
| `getPersonalScopeByUserId(userId)` | Get PersonalScope by user UUID |
| `getPersonalScope(userId)` | Alias for `getPersonalScopeByUserId` |
| `userHasPersonalScope(userId)` | Check if user has a PersonalScope |
| `createPersonalScope(userId)` | Create PersonalScope with default statuses |
| `createDefaultStatuses(personalScopeId)` | Create default workflow statuses |
| `getDefaultBacklogStatus(personalScopeId)` | Get the backlog status for a scope |
| `isEpicInPersonalScope(epicId, userId)` | Authorization check |
| `isPersonalScopeOwner(personalScopeId, userId)` | Authorization check |

### Default Personal Statuses

When a PersonalScope is created, these statuses are automatically created:

| Name | Category | Position |
|------|----------|----------|
| Backlog | backlog | 0 |
| Todo | unstarted | 1 |
| In Progress | started | 2 |
| Done | completed | 3 |
| Canceled | canceled | 4 |

### Error Handling

- `NotFoundError` - User or PersonalScope not found
- `ConflictError` - User already has a PersonalScope

---

## New API Routes: /me/*

**Route File:** `packages/api/src/routes/me.ts`  
**Schema File:** `packages/api/src/schemas/me.ts`

All routes require authentication and operate on the current user's personal scope.

### Endpoints

#### GET /api/v1/me/scope
Get the authenticated user's personal scope. Creates it if it doesn't exist (lazy initialization).

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "createdAt": "datetime",
    "updatedAt": "datetime",
    "_count": { "epics": 0, "statuses": 5 }
  }
}
```

#### GET /api/v1/me/epics
List all epics in the user's personal scope. Supports cursor-based pagination.

**Query Parameters:**
- `cursor` - Pagination cursor
- `limit` - Max results (1-100, default 20)

#### POST /api/v1/me/epics
Create a new epic in the user's personal scope.

**Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "icon": "string (optional)",
  "color": "#hex (optional)"
}
```

#### GET /api/v1/me/statuses
List all workflow statuses in the user's personal scope.

#### POST /api/v1/me/statuses
Create a new status in the user's personal scope.

**Body:**
```json
{
  "name": "string (required)",
  "category": "backlog|unstarted|started|completed|canceled (required)",
  "color": "#hex (optional)",
  "position": "number (optional)"
}
```

---

## Modified Service: UserService

**File:** `packages/api/src/services/userService.ts`

### Changes to createUser()

**Before:** Created user and auto-joined all teams  
**After:** Creates user and provisions PersonalScope with default statuses

```typescript
export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  // ... create user ...
  
  // Create PersonalScope for the new user (with default statuses)
  await createPersonalScope(user.id);
  
  return user;
}
```

### Changes to softDeleteUser()

Added guardrail to prevent deleting users who are the last admin of any team:

```typescript
export async function softDeleteUser(id: string): Promise<UserResponse | null> {
  // GUARDRAIL: Check if user is the last admin of any team
  const lastAdminTeams = await getTeamsWhereUserIsLastAdmin(id);
  if (lastAdminTeams.length > 0) {
    throw new ForbiddenError(
      `Cannot delete user who is the last admin of team(s): ${teamNames}. Promote another member to admin first.`
    );
  }
  // ... soft delete ...
}
```

---

## Modified Service: MembershipService

**File:** `packages/api/src/services/membershipService.ts`

### New Functions

| Function | Description |
|----------|-------------|
| `isLastAdmin(teamId, userId)` | Check if user is the last admin of a specific team |
| `getTeamsWhereUserIsLastAdmin(userId)` | Get all teams where user is last admin |

### Guardrails Added

#### updateMemberRole()
Prevents demoting the last admin to a non-admin role:

```typescript
if (membership.role === "admin" && input.role !== "admin") {
  const userIsLastAdmin = await isLastAdmin(teamId, userId);
  if (userIsLastAdmin) {
    throw new ForbiddenError(
      "Cannot demote the last admin of a team. Promote another member to admin first."
    );
  }
}
```

#### removeMemberFromTeam()
Prevents removing the last admin from a team:

```typescript
if (membership.role === "admin") {
  const userIsLastAdmin = await isLastAdmin(teamId, userId);
  if (userIsLastAdmin) {
    throw new ForbiddenError(
      "Cannot remove the last admin from a team. Promote another member to admin first."
    );
  }
}
```

---

## MCP Server Updates

**Package:** `packages/mcp`

### New Tools

**File:** `packages/mcp/src/tools/personal.ts`

| Tool | Description |
|------|-------------|
| `spectree__get_personal_scope` | Get user's personal scope info |
| `spectree__list_personal_projects` | List personal projects |
| `spectree__create_personal_project` | Create a personal project |
| `spectree__list_personal_statuses` | List personal statuses |

### API Client Updates

**File:** `packages/mcp/src/api-client.ts`

New types added:
- `PersonalScope`
- `PersonalProject`
- `PersonalStatus`
- `ListPersonalProjectsParams/Response`
- `CreatePersonalProjectData`
- `ListPersonalStatusesResponse`

New methods:
- `getPersonalScope()`
- `listPersonalProjects(params)`
- `createPersonalProject(data)`
- `listPersonalStatuses()`
- `resolvePersonalStatusId(statusNameOrId)`

---

## Migration Script

**File:** `packages/api/scripts/migrate-personal-scopes.ts`

### Purpose
One-time migration to provision PersonalScopes for all existing users who don't have one.

### Usage
```bash
cd packages/api
npx tsx scripts/migrate-personal-scopes.ts
```

### Behavior
1. Finds all users without PersonalScope
2. Creates PersonalScope for each (with default statuses)
3. Logs progress and results
4. **Idempotent** - safe to run multiple times
5. **Non-destructive** - does not modify existing PersonalScopes

### Output Example
```
===========================================
PersonalScope Migration Script
===========================================

Total users in database: 10
Users with existing PersonalScope: 3
Users to migrate: 7

Starting migration...

  ✅ Created PersonalScope for: user1@example.com
  ✅ Created PersonalScope for: user2@example.com
  ...

===========================================
Migration Summary
===========================================
Total users: 10
Already had scope: 3
Scopes created: 7
Failures: 0

✅ Migration completed successfully
```

---

## Seed Script Updates

**File:** `packages/api/prisma/seed.ts`

### Changes
1. Creates PersonalScope for admin user (COM-316)
2. Creates default statuses for admin's PersonalScope (COM-320)
3. Creates explicit team membership for admin (COM-318)
4. Creates sample personal projects for demo (COM-313)

### Demo Data Created
- Personal project "Side Project Ideas" with sample features
- Personal project "Learning Goals" with sample features

---

## Test Coverage

### Unit Tests

| File | Tests |
|------|-------|
| `packages/api/tests/services/personalScopeService.test.ts` | PersonalScope CRUD, default statuses, authorization helpers |
| `packages/api/tests/services/userService.test.ts` | User creation with PersonalScope, last-admin guardrails |
| `packages/api/tests/services/membershipService.test.ts` | Last-admin checks, guardrails on demotion/removal |
| `packages/api/tests/scripts/migrate-personal-scopes.test.ts` | Migration script idempotency and error handling |

### Integration Tests

**Directory:** `packages/api/tests/integration/`

| File | Purpose |
|------|---------|
| `userLifecycle.test.ts` | User creation → PersonalScope auto-created |
| `scopeIsolation.test.ts` | Personal data invisible to other users |
| `crossScopeErrors.test.ts` | Proper 403 errors for unauthorized access |
| `guardrails.test.ts` | Last-admin guardrails work correctly |

### MCP Tests

| File | Tests |
|------|-------|
| `packages/mcp/tests/personal.test.ts` | Personal scope MCP tools |

---

## Linear Issues Reference

All issues in the project were completed in the following order:

### Phase 1: Database Foundation
- **COM-267** - Add PersonalScope Database Model ✅

### Phase 2: Service Layer & Guardrails (Parallel)
- **COM-280** - Create Personal Scope Service Layer ✅
- **COM-277** - Refactor User Creation ✅
- **COM-275** - Add Personal Scope Authorization Middleware ✅
- **COM-278** - Add Last-Admin Guardrails ✅
- **COM-279** - Create Migration Script for Existing Users ✅

### Phase 3: Query Updates
- **COM-274** - Update List Queries for Scope-Based Visibility ✅

### Phase 4: API & Seed Updates (Parallel)
- **COM-272** - Create Personal Scope API Routes (/me/*) ✅
- **COM-273** - Update Seed Script for New Identity Model ✅

### Phase 5: MCP Server
- **COM-276** - Update MCP Server for Personal Scope Support ✅

### Phase 6: Integration Tests
- **COM-281** - Create Integration Tests ✅

---

## Key Files Quick Reference

### New Files
```
packages/api/src/services/personalScopeService.ts     # PersonalScope business logic
packages/api/src/routes/me.ts                         # /me/* API routes
packages/api/src/schemas/me.ts                        # Zod schemas for /me routes
packages/api/scripts/migrate-personal-scopes.ts      # Migration script
packages/mcp/src/tools/personal.ts                   # MCP tools for personal scope
packages/api/tests/services/personalScopeService.test.ts
packages/api/tests/scripts/migrate-personal-scopes.test.ts
packages/api/tests/integration/userLifecycle.test.ts
packages/api/tests/integration/scopeIsolation.test.ts
packages/api/tests/integration/crossScopeErrors.test.ts
packages/api/tests/integration/guardrails.test.ts
packages/mcp/tests/personal.test.ts
```

### Modified Files
```
packages/api/prisma/schema.prisma                     # Added PersonalScope model
packages/api/prisma/seed.ts                          # Updated seeding logic
packages/api/src/services/userService.ts             # PersonalScope on user create
packages/api/src/services/membershipService.ts       # Last-admin guardrails
packages/mcp/src/api-client.ts                       # Personal scope API methods
packages/mcp/src/tools/index.ts                      # Registers personal tools
```

---

## Troubleshooting Common Issues

### Issue: User doesn't have a PersonalScope
**Cause:** User was created before migration ran  
**Solution:** Run the migration script: `npx tsx scripts/migrate-personal-scopes.ts`

### Issue: Cannot delete user - "last admin" error
**Cause:** User is the only admin of one or more teams  
**Solution:** Promote another user to admin in those teams first

### Issue: Cannot demote/remove user from team
**Cause:** User is the last admin of that team  
**Solution:** Promote another user to admin first

### Issue: Personal projects not showing in MCP
**Cause:** API token doesn't have access or wrong endpoint  
**Solution:** Use `spectree__list_personal_projects` tool, ensure valid API token

### Issue: 404 on /me/scope endpoint
**Cause:** User not authenticated or invalid token  
**Solution:** Ensure Bearer token is included in Authorization header

---

## Database Safety Reminder

⚠️ **NEVER run these commands - they DELETE ALL DATA:**
```bash
npx prisma migrate reset      # ❌ Deletes everything
npx prisma migrate dev        # ❌ May require reset
npx prisma db push --force-reset  # ❌ Deletes everything
```

✅ **Safe commands:**
```bash
npm run db:backup             # Always backup first
npm run db:migrate:safe       # Backs up then migrates  
npx prisma db push           # Safe schema sync (no --force-reset!)
npx prisma generate          # Regenerate client (safe)
```

---

## Contact / Questions

For questions about this implementation, refer to:
1. The design spec: `docs/DESIGN-REFERENCES/spectree-vnext-identity-collaboration-migration.md`
2. The Linear project for detailed issue descriptions
3. Test files for expected behavior examples
