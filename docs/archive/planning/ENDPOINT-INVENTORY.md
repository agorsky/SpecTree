# API Endpoint Inventory

**Generated:** February 10, 2026  
**Purpose:** Complete inventory of all REST API endpoints for documentation planning

## Summary

- **Total Route Files:** 17
- **Documented Categories:** 4 (templates, ai-context, validation, invitation)
- **Undocumented Categories:** 13
- **Estimated Total Endpoints:** 150+

## Endpoint Categories

### ✅ DOCUMENTED (4 categories)

#### 1. Templates (`/api/v1/templates`) - template-endpoints.md
- GET `/` - List templates
- GET `/:id` - Get template
- POST `/` - Create template
- PUT `/:id` - Update template
- DELETE `/:id` - Delete template
- POST `/:id/preview` - Preview template
- POST `/:id/create` - Create from template
- POST `/save-from-epic` - Save epic as template

**Status:** ✅ Complete

#### 2. AI Context - ai-context-endpoints.md
- GET `/api/v1/features/:id/ai-context` - Get feature AI context
- PUT `/api/v1/features/:id/ai-context` - Set feature AI context
- POST `/api/v1/features/:id/ai-note` - Append feature AI note
- GET `/api/v1/tasks/:id/ai-context` - Get task AI context
- PUT `/api/v1/tasks/:id/ai-context` - Set task AI context
- POST `/api/v1/tasks/:id/ai-note` - Append task AI note

**Status:** ✅ Complete (Note: Epic AI context exists but not documented separately)

#### 3. Validations (`/api/v1/tasks/:taskId/validations`) - validation-endpoints.md
- GET `/` - List validations
- POST `/` - Add validation
- DELETE `/:checkId` - Remove validation
- POST `/:checkId/run` - Run single validation
- POST `/run-all` - Run all validations
- POST `/:checkId/manual-validate` - Mark manual validated
- POST `/reset` - Reset validations

**Status:** ✅ Complete

#### 4. Invitations - invitation-endpoints.md
- POST `/api/v1/admin/invitations` - Create invitation (admin)
- GET `/api/v1/admin/invitations` - List invitations (admin)
- GET `/api/v1/admin/invitations/:id` - Get invitation (admin)
- DELETE `/api/v1/admin/invitations/:id` - Revoke invitation (admin)
- POST `/api/v1/auth/activate` - Activate account (public)

**Status:** ✅ Complete

---

### 🔴 UNDOCUMENTED - Core CRUD (3 categories)

#### 5. Epics (`/api/v1/epics`) - NEEDS: epic-endpoints.md
**Estimated:** 19 endpoints

**Core CRUD:**
- GET `/` - List epics
- GET `/:id` - Get epic
- POST `/` - Create epic
- PUT `/:id` - Update epic
- DELETE `/:id` - Delete epic
- POST `/:id/archive` - Archive epic
- POST `/:id/unarchive` - Unarchive epic
- POST `/create-complete` - Create epic with features/tasks atomically
- PUT `/:id/reorder` - Reorder epic

**AI Context:**
- GET `/:id/ai-context` - Get epic AI context
- PUT `/:id/ai-context` - Set epic AI context
- POST `/:id/ai-note` - Append epic AI note

**Structured Description:**
- GET `/:id/structured-desc` - Get structured description
- PUT `/:id/structured-desc` - Set structured description
- PATCH `/:id/structured-desc/section` - Update section
- POST `/:id/structured-desc/criterion` - Add acceptance criterion
- POST `/:id/structured-desc/file` - Link file
- POST `/:id/structured-desc/external-link` - Add external link

**Progress/Summary:**
- GET `/:id/summary` - Get progress summary

**Priority:** 🔴 CRITICAL

---

#### 6. Features (`/api/v1/features`) - NEEDS: feature-endpoints.md
**Estimated:** 28+ endpoints

**Core CRUD:**
- GET `/` - List features (supports: epic, status, statusCategory, assignee, query, dates)
- GET `/:id` - Get feature
- POST `/` - Create feature
- PUT `/:id` - Update feature
- PUT `/:id/reorder` - Reorder feature
- PUT `/bulk-update` - Bulk update features
- DELETE `/:id` - Delete feature

**AI Context:**
- GET `/:id/ai-context` - Get AI context
- PUT `/:id/ai-context` - Set AI context
- POST `/:id/ai-note` - Append AI note

**Progress Tracking:**
- POST `/:id/start-work` - Start work
- POST `/:id/complete-work` - Complete work
- POST `/:id/log-progress` - Log progress
- POST `/:id/report-blocker` - Report blocker

**Structured Description:**
- GET `/:id/structured-desc` - Get structured description
- PUT `/:id/structured-desc` - Set structured description
- PATCH `/:id/structured-desc/section` - Update section
- POST `/:id/structured-desc/criterion` - Add acceptance criterion
- POST `/:id/structured-desc/file` - Link file
- POST `/:id/structured-desc/external-link` - Add external link

**Code Context:**
- GET `/:id/code-context` - Get code context
- POST `/:id/code-context/file` - Link file
- DELETE `/:id/code-context/file` - Unlink file
- POST `/:id/code-context/function` - Link function
- POST `/:id/code-context/branch` - Link branch
- POST `/:id/code-context/commit` - Link commit
- POST `/:id/code-context/pr` - Link PR

**Changelog:**
- GET `/:id/changelog` - Get change history

**Priority:** 🔴 CRITICAL

---

#### 7. Tasks (`/api/v1/tasks`) - NEEDS: task-endpoints.md
**Estimated:** 36+ endpoints

**Core CRUD:**
- GET `/` - List tasks (supports: featureId, status, assignee filters)
- GET `/:id` - Get task
- POST `/` - Create task
- PUT `/:id` - Update task
- PUT `/:id/reorder` - Reorder task
- PUT `/bulk-update` - Bulk update tasks
- DELETE `/:id` - Delete task

**AI Context:**
- GET `/:id/ai-context` - Get AI context
- PUT `/:id/ai-context` - Set AI context
- POST `/:id/ai-note` - Append AI note

**Progress Tracking:**
- POST `/:id/start-work` - Start work
- POST `/:id/complete-work` - Complete work
- POST `/:id/log-progress` - Log progress
- POST `/:id/report-blocker` - Report blocker

**Structured Description:**
- GET `/:id/structured-desc` - Get structured description
- PUT `/:id/structured-desc` - Set structured description
- PATCH `/:id/structured-desc/section` - Update section
- POST `/:id/structured-desc/criterion` - Add acceptance criterion
- POST `/:id/structured-desc/file` - Link file
- POST `/:id/structured-desc/external-link` - Add external link

**Code Context:**
- GET `/:id/code-context` - Get code context
- POST `/:id/code-context/file` - Link file
- DELETE `/:id/code-context/file` - Unlink file
- POST `/:id/code-context/function` - Link function
- POST `/:id/code-context/branch` - Link branch
- POST `/:id/code-context/commit` - Link commit
- POST `/:id/code-context/pr` - Link PR

**Validations:** (see validation-endpoints.md)
- 8 endpoints under `/:taskId/validations`

**Changelog:**
- GET `/:id/changelog` - Get change history

**Priority:** 🔴 CRITICAL

---

### 🟡 UNDOCUMENTED - Supporting Resources (5 categories)

#### 8. Teams (`/api/v1/teams`) - NEEDS: team-endpoints.md
**Estimated:** 5 endpoints

- GET `/` - List teams
- GET `/:id` - Get team (supports ID, name, or key)
- POST `/` - Create team
- PUT `/:id` - Update team
- DELETE `/:id` - Delete team

**Priority:** 🟡 HIGH

---

#### 9. Statuses (`/api/v1/statuses`) - NEEDS: status-endpoints.md
**Estimated:** 6 endpoints

- GET `/` - List statuses (query: teamId)
- GET `/:id` - Get status
- POST `/` - Create status
- PUT `/:id` - Update status
- PUT `/:id/reorder` - Reorder status
- DELETE `/:id` - Delete status

**Priority:** 🟡 HIGH

---

#### 10. Authentication & Users - NEEDS: auth-endpoints.md, user-endpoints.md
**Estimated:** 12+ endpoints

**Auth (`/api/v1/auth`):**
- POST `/login` - Login
- POST `/refresh` - Refresh token
- GET `/logout` - Logout
- POST `/register` - Register (if enabled)
- POST `/activate` - Activate account (see invitation-endpoints.md)

**Users (`/api/v1/users`):**
- GET `/` - List users
- GET `/me` - Get current user
- GET `/:id` - Get user
- POST `/` - Create user
- PUT `/:id` - Update user
- DELETE `/:id` - Delete user

**Me (`/api/v1/me`):**
- GET `/` - Get profile
- GET `/personal-scope` - Get personal scope
- GET `/personal-projects` - List personal projects
- POST `/personal-projects` - Create personal project
- GET `/personal-statuses` - List personal statuses
- POST `/personal-statuses` - Create personal status
- GET `/work` - Get my work
- GET `/blocked` - Get my blocked items

**Priority:** 🟡 HIGH

---

#### 11. Sessions (`/api/v1/sessions`) - NEEDS: session-endpoints.md
**Estimated:** 8 endpoints

**Epic Sessions:**
- POST `/epic/start` - Start AI session
- POST `/epic/end` - End AI session
- GET `/epic/active` - Get active session
- GET `/epic/last` - Get last completed session
- GET `/epic/history` - Get session history

**Feature/Task Sessions:**
- POST `/feature/start` - Start feature session
- POST `/task/start` - Start task session
- GET `/feature/:id/history` - Get feature session history

**Priority:** 🟡 HIGH

---

#### 12. Search (`/api/v1/search`) - NEEDS: search-endpoints.md
**Estimated:** 2-3 endpoints

- GET `/` or POST `/` - Unified search (features + tasks)
  - Query params: query, epicId, status, statusCategory, assignee, type, createdAt, updatedAt
  - Returns combined results with type indicator

**Priority:** 🟡 HIGH

---

### 🟢 UNDOCUMENTED - Advanced Features (5 categories)

#### 13. Decisions (`/api/v1/decisions`) - NEEDS: decision-endpoints.md
**Estimated:** 6 endpoints

- POST `/` - Log decision
- GET `/` - List decisions (query: epicId, featureId, taskId, category, impact)
- GET `/search` - Search decisions
- GET `/task/:taskId/context` - Get decision context for task
- GET `/feature/:featureId/context` - Get decision context for feature
- GET `/:id` - Get decision by ID

**Priority:** 🟢 MEDIUM

---

#### 14. Changelog (`/api/v1/changelog`) - NEEDS: changelog-endpoints.md
**Estimated:** 2 endpoints

- GET `/epic/:epicId` - Get epic changelog
- GET `/feature/:featureId` - Get feature changelog (also available as `/api/v1/features/:id/changelog`)

**Priority:** 🟢 MEDIUM

---

#### 15. Execution Plans (`/api/v1/execution-plans`) - NEEDS: execution-plan-endpoints.md
**Estimated:** 1-2 endpoints

- GET `/` - Get execution plan for epic (query: epicId)
  - Returns phases with features ordered by dependencies

**Priority:** 🟢 MEDIUM

---

#### 16. Memberships (`/api/v1/memberships`) - NEEDS: membership-endpoints.md
**Estimated:** 5 endpoints

- GET `/teams/:teamId/members` - List team members
- POST `/teams/:teamId/members` - Add member
- PUT `/teams/:teamId/members/:userId` - Update member role
- DELETE `/teams/:teamId/members/:userId` - Remove member
- GET `/users/:userId/teams` - Get user's teams

**Priority:** 🟢 MEDIUM

---

#### 17. Tokens (`/api/v1/tokens`) - NEEDS: token-endpoints.md
**Estimated:** 4 endpoints

- POST `/` - Create API token
- GET `/` - List tokens
- GET `/:id` - Get token
- DELETE `/:id` - Revoke token

**Priority:** 🟢 LOW

---

#### 18. User Activity (`/api/v1/user-activity`) - NEEDS: activity-endpoints.md
**Estimated:** 1 endpoint

- GET `/` - Get user activity feed

**Priority:** 🟢 LOW

---

#### 19. Events (`/api/v1/events`) - NEEDS: event-endpoints.md
**Estimated:** 1 endpoint

- GET `/` - Get events (query: epicId)

**Priority:** 🟢 LOW

---

## Gap Analysis

### Coverage by Priority

| Priority | Categories | Documented | Missing | Coverage % |
|----------|-----------|------------|---------|------------|
| 🔴 CRITICAL | 3 (Core CRUD) | 0 | 3 | 0% |
| 🟡 HIGH | 5 (Supporting) | 0 | 5 | 0% |
| 🟢 MEDIUM | 5 (Advanced) | 0 | 5 | 0% |
| ✅ DONE | 4 (Existing) | 4 | 0 | 100% |
| **TOTAL** | **17** | **4** | **13** | **23.5%** |

### Endpoint Count Estimates

| Category | Endpoints | Documented | Missing |
|----------|-----------|------------|---------|
| Epics | 19 | 0 | 19 |
| Features | 28 | 0 | 28 |
| Tasks | 36 | 8 (validations only) | 28 |
| Teams | 5 | 0 | 5 |
| Statuses | 6 | 0 | 6 |
| Auth/Users | 12 | 1 (activate only) | 11 |
| Sessions | 8 | 0 | 8 |
| Decisions | 6 | 0 | 6 |
| Changelog | 2 | 0 | 2 |
| Execution Plans | 2 | 0 | 2 |
| Memberships | 5 | 0 | 5 |
| Tokens | 4 | 0 | 4 |
| Search | 2 | 0 | 2 |
| Activity | 1 | 0 | 1 |
| Events | 1 | 0 | 1 |
| Templates | 8 | 8 | 0 |
| AI Context | 6 | 6 | 0 |
| Validations | 8 | 8 | 0 |
| Invitations | 5 | 5 | 0 |
| **TOTAL** | **~164** | **36** | **~128** |

**Current Coverage: ~22% of endpoints documented**

---

## Documentation Plan

### Phase 1: Core CRUD (ENG-3-2)
Create documentation for the 3 core resources that testers need most:
1. `epic-endpoints.md` (19 endpoints)
2. `feature-endpoints.md` (28 endpoints)
3. `task-endpoints.md` (28 CRUD endpoints - validations already done)

**Total:** ~75 endpoints to document

### Phase 2: Supporting Resources (ENG-3-3)
Create documentation for frequently-used supporting endpoints:
1. `team-endpoints.md` (5 endpoints)
2. `status-endpoints.md` (6 endpoints)
3. `auth-endpoints.md` + `user-endpoints.md` (12 endpoints)
4. `session-endpoints.md` (8 endpoints)
5. `search-endpoints.md` (2 endpoints)

**Total:** ~33 endpoints to document

### Phase 3: Advanced Features (Future)
Document remaining specialized endpoints:
- Decisions, Changelog, Execution Plans, Memberships, Tokens, Activity, Events

**Total:** ~20 endpoints to document

---

## Next Steps

1. ✅ Task ENG-3-1: Audit complete
2. ⏳ Task ENG-3-4: Endpoint discovery (THIS DOCUMENT)
3. ⏳ Task ENG-3-2: Create Phase 1 docs (Core CRUD)
4. ⏳ Task ENG-3-3: Create Phase 2 docs (Supporting Resources)
