# SpecTree Identity & Collaboration Model (vNext) — Goal State + Migration Policy

**Audience:** GitHub Copilot CLI (for generating a detailed implementation plan)  
**Intent:** High-level behavioral and domain model specification (no code-level implementation details)

---

## 0) Decisions Locked In

1) **Personal project sharing behavior:** When a user shares a personal project, it **moves** to a Team scope (no copy/clone).  
2) **Team joining policy:** Teams are **invite-only** (no self-join).  
3) **Membership creation UX:** **Admins can directly add users** to a team (no acceptance/pending required).

---

## 1) Current State Baseline (from the existing implementation document)

### 1.1 Conceptual hierarchy
SpecTree currently uses a hierarchical model:

- **User**
  - **Membership** (role: `admin | member | guest`) → **Team**
    - **Project**
      - **Feature** (optional assignee)
        - **Task** (optional assignee)

### 1.2 Project ownership constraint
- A **Project belongs to exactly one Team** (single `teamId` style ownership).
- Therefore Features and Tasks inherit Team authorization via **Feature → Project → Team → Membership**.

### 1.3 Current onboarding behavior (key mismatch with vNext)
- New users are currently **automatically added to all existing non-archived teams** as `member`.
- The implementation document calls this an **asymmetry**: new users join all teams, but creating a new team does not auto-add all users.

### 1.4 Current gaps that matter for vNext
The implementation document explicitly lists (among others):

- **Placeholder getCurrentUser()** behavior (not truly contextual per logged-in user)
- **No team invitations** (membership created immediately; must add by ID)
- **No workspaces/organizations** (teams are the top-level org boundary)
- **Single team per project** (no multi-team projects)

These are important because enforcing private personal work requires **true per-user auth context** and membership rules that are not “everyone sees everything.”

---

## 2) Product Goals (vNext)

1) **Personal Work (private-by-default)**  
   Each user can create private Projects/Features/Tasks that no other user can access.

2) **Team Collaboration (shared-by-membership)**  
   Users collaborate in Teams; membership controls visibility and permissions.

3) **Deterministic Access Control**  
   A user’s ability to view or mutate content is derived exclusively from:
   - **Scope** of the resource (Personal vs Team)
   - **Team membership role** (for Team-scoped resources)

---

## 3) Target Model (Concepts + Rules)

### 3.1 Core concept: Scope (visibility boundary)
Every Project is owned by exactly one **Scope**:

- **Personal Scope** — private container owned by one user  
- **Team Scope** — shared container owned by one team

**Rule:** Project ownership is exclusive: **Personal OR Team**, never both.

> This deliberately preserves the current constraint “project belongs to exactly one owning container,” while adding a Personal container type.

---

### 3.2 Personal Scope (Private-by-default)
Each user has exactly one Personal Scope.

**Behavior**
- Personal Scope is **non-discoverable** and accessible only by the owner.
- Personal projects behave like team projects (statuses, ordering, features/tasks).
- Only the owner can create/update/delete content in Personal scope.
- No one else can view/search/assign/modify Personal-scope items.

**UX implication**
- Personal work appears under a “Personal” area, separate from Teams.

---

### 3.3 Team Scope (Invite-only)
Teams remain the primary collaboration unit.

**Membership**
- **Invite-only**: users cannot self-join.
- **Admins can directly add** users to a team (membership becomes active immediately).
- Roles are `admin | member | guest`.

**Permissions**
- `admin`: manage team + membership + full CRUD in team scope
- `member`: full CRUD in team scope (except admin-only team/membership actions)
- `guest`: **read-only** in team scope

---

### 3.4 Authoritative visibility rules
A user can view a Project/Feature/Task if and only if:

- It is owned by the user’s **Personal Scope**, OR
- It is owned by a **Team Scope** where the user has Membership (`guest` or higher)

No other visibility paths exist.

---

## 4) Sharing Personal Work (DECIDED: Move to Team Scope)

**Sharing a personal project = Move Personal → Team**

When the owner chooses to share:
- The project’s scope changes from **Personal Scope** to a selected **Team Scope**
- All contained Features/Tasks become Team-scoped content
- The project disappears from the user’s Personal area and appears in the Team

**Not supported in v1**
- Copy/clone personal project into a team while retaining a private original

---

## 5) Team Joining / Membership Lifecycle (DECIDED: Direct Add)

### 5.1 Membership creation
- Team admins can **directly add** a user to a team (no acceptance step).
- No self-join.

### 5.2 Membership removal / leaving
Define one clear policy (recommended):
- Users **may leave** a team voluntarily, unless they are the last admin.
- Admins can remove any non-admin member; admins can remove other admins with guardrails.

**Guardrail**
- Prevent removing/leaving if it would result in **zero admins** on the team.

---

## 6) What Changes vs Current (Minimum Required Delta)

### 6.1 Onboarding defaults must change
Replace “new users auto-join all teams” with:
- On user creation: **create Personal Scope**
- Do **not** auto-add to any team

### 6.2 Auth context must be truly per-user
Personal privacy cannot work if “current user” is ambiguous.
- vNext requires that the runtime auth context reliably identifies the logged-in user for every request.

### 6.3 Invite-only but direct-add
Current gaps mention “no invitations” and “must add by ID.”
- vNext keeps “direct add” as the primary mechanism.
- “Invite-only” means **no self-join**, not “must accept an invitation.”

---

## 7) Explicitly Out of Scope for vNext (to avoid plan sprawl)

- **Multi-team projects** (project owned by multiple teams)
- **Workspaces/organizations / multi-tenancy**
- **Advanced RBAC / permission grants beyond admin/member/guest**
- **Audit log, MFA, token revocation** (may be added later)

---

## 8) Acceptance Criteria (Copilot-ready)

### Personal Scope
- A user can create a personal project and **no other user can view or query it**.
- Personal projects support features/tasks and normal workflows (status, ordering, assignment-to-self).
- Personal scope content is never visible through team views or team search.

### Team Scope
- A user can only view team projects if they are a member of that team (`guest`+).
- `guest` is read-only; `member/admin` can create/update features/tasks.

### Onboarding
- New users are not auto-added to existing teams.
- New users start with: Personal Scope only.

### Share = Move
- Sharing a personal project moves it into a team scope and removes it from Personal views.

### Direct Add
- Team admins can directly add users to the team; membership is active immediately.

---

# Migration Behavior Policy (Current → vNext)

## 9) Migration Principles

### 9.1 Avoid surprise access revocations
Do not silently remove existing user access during migration.

### 9.2 “Invite-only” applies going forward
Existing memberships remain as-is; invite-only governs new membership creation going forward.

### 9.3 Projects do not change scope automatically
Existing team projects remain team-scoped; Personal scopes start empty.

---

## 10) Migration Steps and Expected Outcomes

### Step A — Backfill Personal Scope for every existing user
**Behavior**
- Create a Personal Scope for each existing active user.
- Personal scopes are private and owner-only.

**Outcome**
- Every user now has a private container.
- No change to team visibility.

---

### Step B — Preserve existing team memberships
**Behavior**
- Keep all existing Membership records unchanged.

**Outcome**
- Existing users keep the same access they had pre-migration.

---

### Step C — Change new-user onboarding default
**Behavior**
- New users get a Personal Scope and zero team memberships by default.

**Outcome**
- Privacy and invite-only membership behavior applies to all new users.

---

### Step D — Enforce invite-only with admin direct-add
**Behavior**
- Membership can only be created by an admin action (direct-add).
- No self-join.

**Outcome**
- Teams become meaningful collaboration boundaries.

---

## 11) Optional tightening phase (recommended, not automatic)
Because the current system may have “everyone in everything,” introduce an admin-driven cleanup option:

- “Membership Audit” tools for admins to review/downgrade/remove members
- Do not run as part of migration automatically

---

## 12) Edge-case policies

### 12.1 Last-admin guardrail
- Prevent team from ending up with zero admins through removal/leave.

### 12.2 Archived teams
Pick one consistent rule (recommended):
- Archived teams remain visible to existing members but are read-only and hidden from primary navigation by default.

### 12.3 Deactivated users
- Their personal scope becomes inaccessible (unless you later introduce a global instance admin).

---

## 13) Post-migration checks
- Existing users: same team access as before + new Personal Scope
- New users: Personal-only until added to a team
- Personal privacy: enforced (no leakage via queries/search)
- Share: move Personal → Team works end-to-end
- Direct-add: admin can add user and access is immediate

---

# Copilot CLI Prompt (Single Paste)

## 14) Implementation-plan prompt (no code)
Paste this into Copilot CLI:

> Create an implementation plan to evolve SpecTree’s current model (User–Membership–Team–Project–Feature–Task) so that each user has a private Personal Scope for personal projects/features/tasks, and also can be invited into Teams for collaborative work.  
>  
> Current constraints: Projects belong to exactly one Team today, and authorization checks traverse Feature → Project → Team → Membership. New users currently auto-join all teams; this must change. The current implementation document also flags a placeholder getCurrentUser() behavior; vNext must have true per-request user context to enforce privacy.  
>  
> vNext requirements (decisions locked):  
> - Every user has a Personal Scope that is private-by-default and contains personal projects.  
> - Team membership is invite-only (no self-join), but admins can DIRECTLY ADD users (no acceptance/pending state).  
> - Team-scoped work uses membership roles (admin/member/guest) for CRUD permissions; guests are read-only.  
> - Visibility is derived from scope: users always see their Personal Scope; users only see Teams they are members of.  
> - New user signup creates a Personal Scope and does NOT auto-join any team.  
> - Sharing a personal project is a MOVE: the project changes from Personal Scope to Team Scope (no copy/clone).  
>  
> Migration behavior policy:  
> - Backfill a Personal Scope for every existing user; personal scopes start empty.  
> - Preserve all existing team memberships exactly as-is (no automatic removals/downgrades). Invite-only governs how new memberships are created going forward.  
> - Existing team projects remain team-scoped; no automatic project moves.  
> - New users: create Personal Scope only; no auto-team membership.  
> - Include guardrails for last-admin, archived teams behavior, and guest restrictions.  
>  
> Deliverables: a phased plan (milestones), domain/data model changes, API surface changes, authorization changes, migration/backfill strategy, and acceptance tests—WITHOUT writing code.

