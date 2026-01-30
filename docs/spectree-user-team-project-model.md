# SpecTree User, Team, and Project Model

This document provides a comprehensive overview of how SpecTree handles users, teams, and projects, including their relationships, creation, management, and configuration.

> **Note:** This document was updated to reflect the Identity & Collaboration vNext changes. See [identity-collaboration-vnext-implementation-reference.md](./identity-collaboration-vnext-implementation-reference.md) for implementation details.

---

## Table of Contents

1. [Entity Overview](#entity-overview)
2. [Database Schema](#database-schema)
3. [User Management](#user-management)
4. [Team Management](#team-management)
5. [Membership Model](#membership-model)
6. [Personal Scope](#personal-scope)
7. [Project Management](#project-management)
8. [Authentication & Authorization](#authentication--authorization)
9. [Relationships Summary](#relationships-summary)
10. [Current Limitations & Gaps](#current-limitations--gaps)

---

## Entity Overview

SpecTree is a project management tool with a hierarchical data model supporting both team-based and personal work:

```
User ─────────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├──► PersonalScope ──► Project ──► Feature ──► Task                │
  │        │                                                          │
  │        └──► Status (personal workflow)                           │
  │                                                                   │
  └──► Membership (role: admin|member|guest) ──► Team                │
                                                   │                  │
                                                   ├──► Project       │
                                                   │     └──► Feature ◄─ assigneeId
                                                   │           └──► Task ◄─ assigneeId
                                                   │                  │
                                                   └──► Status (team workflow)
```

**Core Entities:**
- **User**: Individual account with authentication credentials
- **PersonalScope**: Private container for each user's personal work (1:1 with User)
- **Team**: Organizational unit that owns projects and defines workflow statuses
- **Membership**: Join table linking users to teams with role-based permissions
- **Project**: Container for features, belongs to either a team OR a personal scope
- **Feature**: Primary work item (like Linear's "Issue"), belongs to a project
- **Task**: Sub-item of a feature, for breaking down work
- **Status**: Workflow state, belongs to either a team OR a personal scope

---

## Database Schema

### User Model

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String   @map("password_hash")
  avatarUrl    String?  @map("avatar_url")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  memberships      Membership[]
  assignedFeatures Feature[]      @relation("AssignedFeatures")
  assignedTasks    Task[]         @relation("AssignedTasks")
  apiTokens        ApiToken[]
  personalScope    PersonalScope?

  @@index([email])
  @@map("users")
}
```

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary identifier |
| `email` | String | Unique, used for authentication |
| `name` | String | Display name |
| `passwordHash` | String | bcrypt-hashed password (10 rounds) |
| `avatarUrl` | String? | Optional profile image URL |
| `isActive` | Boolean | Soft delete flag (default: true) |
| `personalScope` | PersonalScope? | One-to-one relation to user's personal scope |

### PersonalScope Model

```prisma
model PersonalScope {
  id        String   @id @default(uuid())
  userId    String   @unique @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  statuses Status[]
  projects Project[]

  @@map("personal_scopes")
}
```

**Key Constraints:**
- One PersonalScope per user (enforced by `@unique` on `userId`)
- Cascade delete when user is deleted
- Owns statuses and projects within the personal scope

### Team Model

```prisma
model Team {
  id          String   @id @default(uuid())
  name        String
  key         String   @unique
  description String?
  icon        String?
  color       String?
  isArchived  Boolean  @default(false) @map("is_archived")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  memberships Membership[]
  projects    Project[]
  statuses    Status[]

  @@map("teams")
}
```

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary identifier |
| `name` | String | Display name |
| `key` | String | Unique short identifier (e.g., "ENG", "COM") used in feature/task identifiers |
| `isArchived` | Boolean | Soft delete flag |

### Membership Model

```prisma
model Membership {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  teamId    String   @map("team_id")
  role      String   @default("member")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
  @@index([userId])
  @@index([teamId])
  @@map("memberships")
}
```

**Role Values (application-enforced, not DB enum):**
- `admin` - Full CRUD, manage team members
- `member` - Read, create, update own resources
- `guest` - Read only

### Project Model

```prisma
model Project {
  id              String   @id @default(uuid())
  name            String
  description     String?
  icon            String?
  color           String?
  sortOrder       Float    @default(0) @map("sort_order")
  isArchived      Boolean  @default(false) @map("is_archived")
  scopeType       String   @default("team") @map("scope_type") // 'team' or 'personal'
  teamId          String?  @map("team_id")
  personalScopeId String?  @map("personal_scope_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  team          Team?          @relation(fields: [teamId], references: [id], onDelete: Cascade)
  personalScope PersonalScope? @relation(fields: [personalScopeId], references: [id], onDelete: Cascade)
  features      Feature[]

  @@index([teamId])
  @@index([teamId, sortOrder])
  @@index([personalScopeId])
  @@map("projects")
}
```

**Key Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `scopeType` | String | Either "team" or "personal" |
| `teamId` | String? | FK to Team (null for personal projects) |
| `personalScopeId` | String? | FK to PersonalScope (null for team projects) |

**Note:** A project belongs to exactly one scope - either a team OR a personal scope, never both.

### API Token Model

```prisma
model ApiToken {
  id         String    @id @default(uuid())
  name       String
  tokenHash  String    @unique @map("token_hash")
  userId     String    @map("user_id")
  scopes     String?   // JSON array stored as string (SQLite limitation)
  expiresAt  DateTime? @map("expires_at")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@map("api_tokens")
}
```

---

## User Management

### User Creation

**Endpoint:** `POST /api/v1/users`  
**Authentication:** Public (no auth required - registration endpoint)

**Service:** `packages/api/src/services/userService.ts`

```typescript
export async function createUser(input: CreateUserInput): Promise<UserResponse>
```

**Creation Process:**
1. Hash password with bcrypt (10 salt rounds)
2. Create user record in database
3. **Create PersonalScope** with default statuses (Backlog, Todo, In Progress, Done, Canceled)
4. Return user (without passwordHash)

**Input:**
```typescript
interface CreateUserInput {
  email: string;      // Required, must be unique
  name: string;       // Required
  password: string;   // Required, will be hashed
  avatarUrl?: string; // Optional
}
```

**Important Behavior:**
- Email uniqueness is enforced at the database level
- PersonalScope is automatically created for every new user
- Users must be **explicitly invited** to teams (no auto-join)
- No email verification is currently implemented
- No password strength requirements beyond non-empty

### User Updates

**Endpoint:** `PUT /api/v1/users/:id`  
**Authentication:** Required (JWT or API token)

**Updateable Fields:**
- `email` - With uniqueness check
- `name`
- `password` - Re-hashed on update
- `avatarUrl`
- `isActive` - For soft delete/reactivation

### User Deletion (Soft Delete)

**Endpoint:** `DELETE /api/v1/users/:id`

Users are **soft deleted** by setting `isActive = false`. This:
- Prevents login
- Preserves historical data (assigned features/tasks remain)
- Allows potential reactivation

**Guardrails:**
- Cannot delete a user who is the **last admin** of any team
- Must promote another member to admin first, or delete the team

### User Retrieval

**Endpoints:**
- `GET /api/v1/users` - Paginated list (requires auth)
- `GET /api/v1/users/:id` - Single user (requires auth)
- `GET /api/v1/users/me` - Current authenticated user (requires auth)
- `GET /api/v1/auth/me` - Alternative current user endpoint

**Security:** `passwordHash` is **never returned** in API responses.

### Current User Resolution

**Service:** `getCurrentUser()` in `userService.ts`

```typescript
export async function getCurrentUser(): Promise<UserResponse | null> {
  return prisma.user.findFirst({
    where: { isActive: true },
    select: userSelectFields,
  });
}
```

**⚠️ Note:** This is a placeholder implementation that returns the first active user. The actual current user is determined by the authenticated request context via JWT/API token.

---

## Team Management

### Team Creation

**Endpoint:** `POST /api/v1/teams`  
**Authentication:** Required

**Service:** `packages/api/src/services/teamService.ts`

```typescript
export async function createTeam(input: CreateTeamInput): Promise<Team>
```

**Creation Process:**
1. Validate required fields (name, key)
2. Check key uniqueness
3. Create team record
4. **Automatically create default statuses** for the team

**Default Statuses Created:**
| Name | Category | Position |
|------|----------|----------|
| Backlog | backlog | 0 |
| Todo | unstarted | 1 |
| In Progress | started | 2 |
| Done | completed | 3 |
| Canceled | canceled | 4 |

**Input:**
```typescript
interface CreateTeamInput {
  name: string;        // Required
  key: string;         // Required, unique (e.g., "ENG", "DESIGN")
  description?: string;
  icon?: string;
  color?: string;
}
```

**⚠️ Important:** When a team is created, users must be **explicitly invited** as members. Users do not auto-join teams.

### Team Updates

**Endpoint:** `PUT /api/v1/teams/:id`

**Updateable Fields:**
- `name`
- `key` - With uniqueness check
- `description`
- `icon`
- `color`

### Team Deletion (Soft Delete)

**Endpoint:** `DELETE /api/v1/teams/:id`

Teams are **soft deleted** by setting `isArchived = true`. This:
- Hides team from listings
- Preserves all associated data
- Memberships remain in database

### Team Key Usage

The `key` field is used to generate feature/task identifiers:
- Feature identifier: `{TEAM_KEY}-{NUMBER}` (e.g., "ENG-42")
- Task identifier: `{FEATURE_IDENTIFIER}-{NUMBER}` (e.g., "ENG-42-3")

---

## Membership Model

### Membership Overview

Memberships represent the many-to-many relationship between users and teams, with role-based permissions.

**Service:** `packages/api/src/services/membershipService.ts`

### Role Hierarchy

```typescript
const ROLE_HIERARCHY: Record<MembershipRole, number> = {
  admin: 2,   // Full CRUD, manage team members
  member: 1,  // Read, create, update
  guest: 0,   // Read only
};
```

**Role Permissions:**
| Action | Admin | Member | Guest |
|--------|-------|--------|-------|
| View team/projects/features | ✅ | ✅ | ✅ |
| Create features/tasks | ✅ | ✅ | ❌ |
| Update features/tasks | ✅ | ✅ | ❌ |
| Manage team members | ✅ | ❌ | ❌ |
| Delete resources | ✅ | ❌ | ❌ |

### Adding Members to Teams

**Endpoint:** `POST /api/v1/teams/:teamId/members`  
**Authentication:** Required  
**Authorization:** Admin role in the team

```typescript
interface AddMemberInput {
  userId: string;
  role?: MembershipRole; // Defaults to "member"
}
```

**Validation:**
- Team must exist and not be archived
- User must exist and be active
- User must not already be a member

### Updating Member Roles

**Endpoint:** `PUT /api/v1/teams/:teamId/members/:userId`  
**Authorization:** Admin role in the team

**Guardrails:**
- Cannot demote the **last admin** of a team to a non-admin role
- Must promote another member to admin first

### Removing Members

**Endpoint:** `DELETE /api/v1/teams/:teamId/members/:userId`  
**Authorization:** Admin role in the team

**Behavior:** Hard delete of the membership record.

**Guardrails:**
- Cannot remove the **last admin** from a team
- Must promote another member to admin first

### Listing Members

**Endpoint:** `GET /api/v1/teams/:teamId/members`  
**Authorization:** Guest+ role in the team

**Returns:**
```typescript
interface MembershipWithUser {
  id: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}
```

### Listing User's Teams

**Endpoint:** `GET /api/v1/users/:userId/teams`  
**Authentication:** Required

**Returns:** All teams a user is a member of (excludes archived teams).

---

## Personal Scope

### Overview

Personal Scope provides each user with a private workspace for work items not shared with any team. It is a 1:1 relationship with User.

**Service:** `packages/api/src/services/personalScopeService.ts`

### Personal Scope Creation

Personal scopes are created automatically:
1. **On user creation** - Every new user gets a PersonalScope with default statuses
2. **On first access** - Lazy initialization via `GET /api/v1/me/scope`

### Default Personal Statuses

When a PersonalScope is created, these statuses are automatically provisioned:

| Name | Category | Position |
|------|----------|----------|
| Backlog | backlog | 0 |
| Todo | unstarted | 1 |
| In Progress | started | 2 |
| Done | completed | 3 |
| Canceled | canceled | 4 |

### Personal Scope API (`/me/*`)

**Endpoints:**
| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/me/scope` | Get personal scope info (creates if needed) |
| `GET /api/v1/me/projects` | List personal projects (paginated) |
| `POST /api/v1/me/projects` | Create a personal project |
| `GET /api/v1/me/statuses` | List personal workflow statuses |
| `POST /api/v1/me/statuses` | Create a personal status |

### Personal vs Team Projects

| Aspect | Personal Project | Team Project |
|--------|------------------|--------------|
| Visibility | Owner only | Team members |
| Scope | `personalScopeId` set | `teamId` set |
| Statuses | Personal statuses | Team statuses |
| Feature identifiers | `USER-{NUM}` format | `{TEAM_KEY}-{NUM}` format |

---

## Project Management

### Project Creation

#### Team Projects

**Endpoint:** `POST /api/v1/projects`  
**Authentication:** Required

```typescript
interface CreateProjectInput {
  name: string;        // Required
  teamId: string;      // Required - team must exist
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;  // Auto-generated if not provided
}
```

#### Personal Projects

**Endpoint:** `POST /api/v1/me/projects`  
**Authentication:** Required

```typescript
interface CreatePersonalProjectInput {
  name: string;        // Required
  description?: string;
  icon?: string;
  color?: string;
}
```

### Project Scope Types

Projects belong to exactly **one scope** - either a team OR a personal scope:

| Scope Type | Owner | Visibility | Status Source |
|------------|-------|------------|---------------|
| `team` | Team (via `teamId`) | Team members | Team's statuses |
| `personal` | User (via `personalScopeId`) | Owner only | Personal statuses |

### Sort Order

Projects support manual ordering via `sortOrder` (Float):
- Auto-generated using midpoint algorithm when not specified
- Can be reordered via `PUT /api/v1/projects/:id/reorder`

---

## Authentication & Authorization

### Authentication Methods

SpecTree supports two authentication methods:

#### 1. JWT Tokens

**Login:** `POST /api/v1/auth/login`

```typescript
interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;   // 15 minute expiry
  refreshToken: string;  // 7 day expiry
  user: UserResponse;
}
```

**Token Refresh:** `POST /api/v1/auth/refresh`

**Token Structure:**
```typescript
interface TokenPayload {
  sub: string;        // User ID
  type: "access" | "refresh";
  iat: number;
  exp: number;
}
```

#### 2. API Tokens

**Prefix:** `st_` (e.g., `st_abc123xyz789...`)

**Creation:** `POST /api/v1/tokens`

```typescript
interface CreateTokenInput {
  name: string;
  scopes?: string[];    // Optional scope restrictions
  expiresAt?: Date;     // Optional expiration
}
```

**Token Storage:** Tokens are SHA-256 hashed before storage. The plaintext is returned **only once** at creation.

**Usage:** Include in `Authorization: Bearer st_...` header.

### Authentication Middleware

**File:** `packages/api/src/middleware/authenticate.ts`

```typescript
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void>
```

**Process:**
1. Extract Bearer token from `Authorization` header
2. If token starts with `st_`, validate as API token
3. Otherwise, verify as JWT
4. Fetch user from database
5. Check user is active
6. Attach user to `request.user`

**Request Augmentation:**
```typescript
interface FastifyRequest {
  user?: AuthenticatedUser;  // User without passwordHash + teamId/role
  apiToken?: ApiToken;       // Present if authenticated via API token
}
```

### Authorization Middleware

**File:** `packages/api/src/middleware/authorize.ts`

#### requireTeamAccess(paramName)

Verifies the authenticated user is a member of the relevant team.

**Supported Resource Types:**
| Parameter | Resolution |
|-----------|------------|
| `teamId` | Direct team ID |
| `projectId` | Project → Team |
| `featureId` | Feature → Project → Team |
| `taskId` | Task → Feature → Project → Team |
| `statusId` | Status → Team |

**Mapping Syntax:** `"id:projectId"` - Read from `params.id`, treat as projectId.

#### requireRole(...roles)

Checks if the user has one of the required roles in the team context.

**Usage:**
```typescript
fastify.post(
  "/:teamId/members",
  { preHandler: [authenticate, requireTeamAccess("teamId"), requireRole("admin")] },
  async (request, reply) => { ... }
);
```

---

## Relationships Summary

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SpecTree Data Model                            │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐                                                     ┌──────────┐
  │  User   │ ──────────────────────────────────────────────────► │  Team   │
  └────┬────┘             Membership (N:M)                        └────┬─────┘
       │                  role: admin|member|guest                     │
       │                                                               │
       │ 1:1                                                     1:N   │
       ▼                                                               ▼
  ┌───────────────┐                                              ┌──────────┐
  │ PersonalScope │                                              │ Project  │
  └───────┬───────┘                                              └────┬─────┘
          │                                                           │
          │ 1:N                                                  1:N  │
          ▼                                                           ▼
    ┌──────────┐                                                ┌─────────┐
    │ Project  │                                                │ Feature │
    │(personal)│                                                └────┬────┘
    └────┬─────┘                                                     │
         │                                                      1:N  │
    1:N  │                                                           ▼
         ▼                                                      ┌─────────┐
    ┌─────────┐                                                 │  Task   │
    │ Feature │                                                 └─────────┘
    └────┬────┘
         │
    1:N  │
         ▼
    ┌─────────┐
    │  Task   │
    └─────────┘

  Additional Relations:
  - User 1:N Feature (assigneeId, optional)
  - User 1:N Task (assigneeId, optional)
  - User 1:N ApiToken
  - PersonalScope 1:N Status (personal statuses)
  - Team 1:N Status (team statuses)
  - Feature N:1 Status (statusId, optional)
  - Task N:1 Status (statusId, optional)
```

### Cascade Behaviors

| Parent | Child | On Delete |
|--------|-------|-----------|
| User | Membership | CASCADE |
| User | ApiToken | CASCADE |
| User | PersonalScope | CASCADE |
| PersonalScope | Project | CASCADE |
| PersonalScope | Status | CASCADE |
| Team | Membership | CASCADE |
| Team | Project | CASCADE |
| Team | Status | CASCADE |
| Project | Feature | CASCADE |
| Feature | Task | CASCADE |
| Status | Feature.statusId | SET NULL |
| Status | Task.statusId | SET NULL |
| User | Feature.assigneeId | SET NULL |
| User | Task.assigneeId | SET NULL |

---

## Current Limitations & Gaps

### User Management Gaps

1. **No email verification** - Users can register with any email
2. **No password requirements** - Only non-empty validation
3. **No password reset flow** - No forgot password functionality
4. **No user preferences/settings** - No timezone, notification settings, etc.
5. **No profile customization** - Limited to name and avatarUrl
6. **No user roles beyond team membership** - No global admin/superuser concept
7. **No OAuth/SSO integration** - Only email/password authentication
8. **No session management** - Stateless JWT with no revocation capability
9. **No activity tracking** - No audit log for user actions

### Team Management Gaps

1. **No team invitations** - Must directly add users by ID
2. **No team ownership concept** - All admins are equal (but guardrails prevent orphaning)
3. **No team settings/preferences** - No configurable team-level options
4. **No team-level permissions** - Role system is basic (3 levels)

### Membership Gaps

1. **No membership invitations** - No invite-by-email flow
2. **No pending/invited state** - Memberships are immediately active
3. **No self-removal** - Users cannot leave teams themselves
4. **Single role per team** - Cannot have multiple roles/permissions per team
5. **No role delegation** - Admins cannot grant specific permissions

### Authentication Gaps

1. **No 2FA/MFA** - Single factor only
2. **No rate limiting on login** - Vulnerable to brute force
3. **No token blacklist** - Cannot revoke JWT tokens before expiry
4. **No refresh token rotation** - Same refresh token until expiry
5. **API token scopes not enforced** - Scopes are stored but not checked

### Project Management Gaps

1. **No project membership** - All team members see all projects
2. **No project leads/owners** - No designated project ownership
3. **No project archival cascade** - Features/tasks remain when project archived
4. **No project templates** - Cannot duplicate project structure

### Data Model Gaps

1. **Single team per project** - Cannot share projects across teams
2. **No cross-team features** - Features bound to single team via project
3. **No user groups** - Cannot create subsets of users for permissions
4. **No workspaces/organizations** - Teams are the highest organizational unit
5. **No feature/task watchers** - Cannot subscribe to updates

### API Gaps

1. **No bulk operations** - Cannot create/update multiple entities
2. **No batch member operations** - Cannot add multiple members at once
3. **Limited filtering** - Basic query parameters only
4. **No GraphQL** - REST only

---

## Files Reference

### Core Service Files

| File | Purpose |
|------|---------|
| `packages/api/src/services/userService.ts` | User CRUD operations |
| `packages/api/src/services/teamService.ts` | Team CRUD operations |
| `packages/api/src/services/membershipService.ts` | Membership management + last-admin guardrails |
| `packages/api/src/services/personalScopeService.ts` | Personal scope CRUD + default statuses |
| `packages/api/src/services/projectService.ts` | Project CRUD operations |
| `packages/api/src/services/tokenService.ts` | API token management |
| `packages/api/src/services/featureService.ts` | Feature CRUD + assignee handling |
| `packages/api/src/services/taskService.ts` | Task CRUD + assignee handling |

### Route Files

| File | Endpoints |
|------|-----------|
| `packages/api/src/routes/users.ts` | `/api/v1/users/*` |
| `packages/api/src/routes/teams.ts` | `/api/v1/teams/*` |
| `packages/api/src/routes/memberships.ts` | Team member management |
| `packages/api/src/routes/me.ts` | `/api/v1/me/*` (personal scope) |
| `packages/api/src/routes/auth.ts` | `/api/v1/auth/*` |
| `packages/api/src/routes/tokens.ts` | `/api/v1/tokens/*` |

### Middleware Files

| File | Purpose |
|------|---------|
| `packages/api/src/middleware/authenticate.ts` | JWT/API token verification |
| `packages/api/src/middleware/authorize.ts` | Team access & role checking |

### Schema Files

| File | Purpose |
|------|---------|
| `packages/api/prisma/schema.prisma` | Database schema definition |
| `packages/api/src/schemas/auth.ts` | Auth request validation |
| `packages/api/src/schemas/user.ts` | User request validation |
| `packages/api/src/schemas/me.ts` | Personal scope request validation |

---

## Summary

SpecTree implements a comprehensive user/team/project model with support for both collaborative and personal work:

- **Users** are created with email/password and get a PersonalScope for private work
- **PersonalScopes** provide isolated workspaces with their own statuses and projects
- **Teams** are invite-only organizational units with their own statuses
- **Memberships** connect users to teams with three role levels (admin, member, guest)
- **Projects** belong to either a team (shared) or personal scope (private)
- **Authentication** supports JWT and long-lived API tokens
- **Authorization** is scope-aware with team role checks and last-admin guardrails

The system supports small teams with proper access control. Enterprise features like SSO, advanced permissions, and audit logging are not yet implemented.
