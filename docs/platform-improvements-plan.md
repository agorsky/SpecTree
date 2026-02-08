# SpecTree Platform Improvements - Automation Framework Guide

**Date:** February 7, 2026
**Purpose:** Input document for the SpecTree automation framework to create and execute 5 platform improvement epics
**Consumer:** Developer using `@planner` agent or `spectree plan` CLI

---

## 1. Overview

This document specifies 5 platform improvements for SpecTree, designed to be created and executed using the SpecTree automation framework (planner agent + orchestrator). Each improvement is specified at the level of detail needed for the `@planner` agent to produce a fully-specified SpecTree epic.

### The 5 Improvements

| # | Epic Name | Effort | Primary Beneficiary |
|---|-----------|--------|-------------------|
| 1 | MCP Tool Consolidation | 2-3 days | AI agents |
| 2 | Real-Time SSE Updates | 2-3 days | Users |
| 3 | Test Database Isolation | 0.5 days | Everyone |
| 4 | Execution Plan Visualization | 2-3 days | Users + AI |
| 5 | Entity Change History | 1-2 days | Teams + AI |

### Cross-Epic Dependencies

```
Epic 3 (Test DB Isolation)     ─── no dependencies, do first
Epic 5 (Change History)        ─── no dependencies, can parallel with 3
Epic 1 (MCP Consolidation)     ─── no dependencies, can parallel with 3/5
Epic 2 (SSE Updates)           ─── benefits from Epic 5 (change events to broadcast)
Epic 4 (Exec Plan Viz)         ─── benefits from Epic 2 (real-time status in viz)
```

**Recommended execution order:**
- **Phase A** (parallel): Epics 3, 5, and 1 — all independent
- **Phase B** (parallel): Epics 2 and 4 — build on Phase A foundations

---

## 2. How to Use This Document

### Option A: Automated Planning (Recommended)

Feed each epic's description to the `@planner` agent. The planner will:
1. Read the codebase to understand the current state
2. Create the epic with features, tasks, and structured descriptions
3. Set execution metadata (ordering, dependencies, parallelism)
4. Evaluate quality and verify the execution plan

```
@planner --gates=auto,auto,review,review,review "<epic description from Section 3-7>"
```

### Option B: Manual Planning with MCP Tools

For more control, create each epic manually using the SpecTree MCP tools:

```typescript
// 1. Create the full hierarchy
spectree__create_epic_complete({ ... })

// 2. Set structured descriptions on every feature and task
spectree__set_structured_description({ ... })

// 3. Set execution metadata
spectree__set_execution_metadata({ ... })

// 4. Add validation checks
spectree__add_validation({ ... })

// 5. Verify the execution plan
spectree__get_execution_plan(epicId)
```

### Option C: Hybrid — Use This Doc as Planner Input

Pass this entire document (or a specific section) as context to a Copilot CLI session with SpecTree MCP access. The session can use `spectree__create_epic_complete` to create each epic atomically, then enrich with structured descriptions.

### After Planning: Execution

Once epics are created and verified:

```bash
# Execute a single epic
spectree run <epic-id>

# Or use the orchestrator agent
@orchestrator "Execute epic <epic-identifier>"
```

---

## 3. Epic 1: MCP Tool Consolidation

### Planner Prompt

```
Build an MCP tool consolidation system for SpecTree. The MCP server currently
exposes 83 individual tools to AI agents, which burns excessive context window
tokens and increases decision fatigue. Consolidate related tools into composite,
action-based tools to reduce the surface area to ~25 primary tools.

The consolidation should:
1. Group related tools by domain (code-context, validation, structured-desc, etc.)
2. Create composite tools with an "action" parameter that routes internally
3. Keep the original granular tools available but mark them as secondary/hidden
4. Ensure backward compatibility — existing tool calls must still work
5. Update tool descriptions to guide AI toward the composite tools
6. Measure and document the token savings

Key tool groups to consolidate:
- Code Context (7 tools → 1): link_code_file, unlink_code_file, link_function,
  link_branch, link_commit, link_pr, get_code_context → manage_code_context
- Validation (7 tools → 1): add_validation, list_validations, run_validation,
  run_all_validations, mark_manual_validated, remove_validation,
  reset_validations → manage_validations
- Structured Description (6 tools → 1): get/set_structured_description,
  update_section, add_acceptance_criterion, link_file,
  add_external_link → manage_description
- Ordering (3 tools → 1): reorder_epic, reorder_feature,
  reorder_task → reorder_item
- Progress (4 tools → 1): start_work, complete_work, log_progress,
  report_blocker → manage_progress
- AI Context (3 tools → 1): get/set_ai_context,
  append_ai_note → manage_ai_context

Target files: packages/mcp/src/tools/*.ts, packages/mcp/src/index.ts
Team: Engineering
```

### Suggested Feature Breakdown

| # | Feature | Complexity | Parallel? |
|---|---------|-----------|-----------|
| 1 | Design composite tool interface pattern | simple | No (first) |
| 2 | Consolidate Code Context tools | moderate | Yes (group A) |
| 3 | Consolidate Validation tools | moderate | Yes (group A) |
| 4 | Consolidate Structured Description tools | moderate | Yes (group A) |
| 5 | Consolidate Progress + AI Context + Ordering tools | moderate | Yes (group A) |
| 6 | Backward compatibility layer | simple | No (after group A) |
| 7 | Update tool descriptions and test | simple | No (last) |

### Key Technical Decisions

- **Action parameter pattern**: Each composite tool takes `{ action: "link_file" | "unlink_file" | "get_context" | ... }` and routes internally
- **Schema validation**: Use Zod discriminated unions — the schema changes based on the `action` value so AI agents get clear parameter guidance per action
- **Backward compat**: Keep original tools registered but with descriptions that say "Prefer `manage_code_context` instead"
- **Token measurement**: Count tool definition tokens before and after, document in PR

### Files Involved

```
packages/mcp/src/tools/code-context.ts    → Add manage_code_context composite
packages/mcp/src/tools/validation.ts      → Add manage_validations composite
packages/mcp/src/tools/structured-desc.ts → Add manage_description composite
packages/mcp/src/tools/progress.ts        → Add manage_progress composite
packages/mcp/src/tools/ai-context.ts      → Add manage_ai_context composite
packages/mcp/src/tools/ordering.ts        → Add reorder_item composite
packages/mcp/src/tools/index.ts           → Registration order, composite first
packages/mcp/src/api-client.ts            → No changes (composites delegate to same API calls)
```

### Acceptance Criteria (Epic-Level)

- [ ] Composite tools registered and functional for all 6 groups
- [ ] AI agent connecting sees composite tools listed before granular tools
- [ ] Original granular tools still work (backward compatibility)
- [ ] Tool definition token count reduced by at least 40%
- [ ] All existing MCP tests pass
- [ ] New tests cover composite tool routing for each action

---

## 4. Epic 2: Real-Time SSE Updates

### Planner Prompt

```
Add Server-Sent Events (SSE) to the SpecTree platform for real-time updates.
Currently the web frontend has no real-time communication with the API server.
When AI agents update task status, log progress, or complete work via MCP tools,
the dashboard doesn't reflect changes until the user manually refreshes.

Implementation requirements:
1. API Server (packages/api): Add a GET /api/v1/events SSE endpoint
   - Authenticated (require valid JWT)
   - Streams entity change events: status changes, progress updates,
     task completions, blocker reports, decision logs
   - Use the existing internal EventEmitter in packages/api/src/events/
     as the foundation — extend it to cover all entity types
   - Event format: { type: "feature.updated", data: { id, field, value } }
   - Support filtering by epicId query parameter
   - Handle connection keepalive (30s heartbeat)
   - Clean up connections on client disconnect

2. Web Frontend (packages/web): Subscribe to SSE and invalidate React Query cache
   - Create a useEventSource hook that connects to /api/v1/events
   - On receiving events, invalidate the relevant React Query cache keys
   - Show a subtle toast/indicator when external changes arrive
   - Reconnect automatically on connection drop (exponential backoff)
   - Only connect when user is authenticated

3. API Service Layer: Emit events on all write operations
   - Extend the existing EventEmitter to fire on: feature/task/epic
     create/update/delete, status changes, progress logs, decision logs,
     validation results, code context links
   - Each event includes: entityType, entityId, action, changedFields, userId

Do NOT use WebSockets — SSE is simpler, sufficient for one-directional
server-to-client updates, and works over standard HTTP.

Target packages: packages/api (server), packages/web (client)
Team: Engineering
```

### Suggested Feature Breakdown

| # | Feature | Complexity | Parallel? |
|---|---------|-----------|-----------|
| 1 | Extend API event emitter to cover all entities | moderate | No (first) |
| 2 | SSE endpoint in Fastify | moderate | No (depends on 1) |
| 3 | Frontend useEventSource hook | moderate | Yes (with 4) |
| 4 | React Query cache invalidation on events | moderate | Yes (with 3) |
| 5 | Connection management (keepalive, reconnect, auth) | simple | No (after 3+4) |
| 6 | Integration testing | simple | No (last) |

### Key Technical Decisions

- **SSE over WebSockets**: One-directional, works over HTTP/2, no extra dependency, Fastify supports it natively via `reply.raw`
- **Event granularity**: Entity-level events (not field-level) — `{ type: "feature.updated", id: "uuid" }` triggers React Query invalidation of that feature's cache key
- **Filtering**: `GET /api/v1/events?epicId=xxx` to limit events to a specific epic (reduces noise for focused work)
- **No Fastify plugin**: Use `reply.raw.write()` directly for SSE — simpler than adding a dependency

### Files Involved

```
packages/api/src/events/emitter.ts        → Extend with all entity types
packages/api/src/events/types.ts           → NEW: Event type definitions
packages/api/src/routes/events.ts          → NEW: SSE endpoint
packages/api/src/index.ts                  → Register events route
packages/api/src/services/*.ts             → Add event emissions to write operations
packages/web/src/hooks/use-event-source.ts → NEW: SSE subscription hook
packages/web/src/hooks/use-live-updates.ts → NEW: React Query invalidation bridge
packages/web/src/App.tsx                   → Mount live updates provider
packages/web/src/components/common/live-indicator.tsx → NEW: Visual indicator
```

### Acceptance Criteria (Epic-Level)

- [ ] SSE endpoint streams events for all entity mutations
- [ ] Frontend auto-refreshes affected data within 1 second of server-side change
- [ ] Connection survives page navigation within the SPA
- [ ] Automatic reconnection on network drop with exponential backoff
- [ ] Events filtered by epicId when query parameter provided
- [ ] Heartbeat keeps connection alive through proxies/load balancers
- [ ] No memory leaks — connections cleaned up on client disconnect
- [ ] Dashboard updates in real-time when MCP tools modify data (manual test)

---

## 5. Epic 3: Test Database Isolation

### Planner Prompt

```
Fix test database isolation for SpecTree. On Feb 6, 2026, running tests
accidentally overwrote the production SQLite database (spectree.db) with
test fixture data, causing catastrophic data loss.

This is a critical infrastructure fix with very low effort:

1. Ensure tests ALWAYS use a separate database file (spectree-test.db)
   or an in-memory SQLite database (:memory:)
2. Add a runtime guard in the Prisma client that refuses to connect
   to the production database path when NODE_ENV=test
3. Add a vitest globalSetup that:
   - Asserts DATABASE_URL does NOT point to spectree.db
   - Creates a fresh test database with migrations
   - Seeds minimal test fixtures
4. Add a vitest globalTeardown that cleans up the test database
5. Update all test configuration files to set DATABASE_URL explicitly
6. Add a pre-test npm script that validates the database target

Current state:
- Database: packages/api/prisma/data/spectree.db (SQLite)
- Tests: packages/api/tests/ and packages/orchestrator/tests/
- Test runner: vitest
- The copilot-instructions.md CLAIMS tests use spectree-test.db but
  this is not actually enforced in all test configurations

Target packages: packages/api, packages/orchestrator
Team: Engineering
```

### Suggested Feature Breakdown

| # | Feature | Complexity | Parallel? |
|---|---------|-----------|-----------|
| 1 | Prisma client production DB guard | trivial | Yes (with 2) |
| 2 | Vitest globalSetup/globalTeardown for API tests | simple | Yes (with 1) |
| 3 | Orchestrator test isolation | simple | No (after 1+2) |
| 4 | Pre-test validation script + CI guard | trivial | No (last) |

### Key Technical Decisions

- **In-memory vs file**: Use a file-based `spectree-test.db` (not `:memory:`) so that tests can share a database across multiple test files while still being isolated from production
- **Guard location**: Put the guard in the Prisma client singleton initialization — fail loudly with a clear error message if `NODE_ENV=test` and `DATABASE_URL` contains `spectree.db` (without `-test`)
- **Migration strategy**: Run `prisma migrate deploy` in globalSetup to apply all migrations to the test DB
- **Cleanup**: Truncate all tables between test suites, drop DB file in globalTeardown

### Files Involved

```
packages/api/prisma/test-setup.ts          → NEW: globalSetup for test DB
packages/api/prisma/test-teardown.ts       → NEW: globalTeardown cleanup
packages/api/vitest.config.ts              → Set DATABASE_URL, register setup/teardown
packages/api/src/lib/prisma.ts             → Add production DB guard
packages/orchestrator/vitest.config.ts     → Set DATABASE_URL
packages/orchestrator/tests/setup.ts       → Ensure test DB isolation
package.json                               → Add pretest validation script
```

### Acceptance Criteria (Epic-Level)

- [ ] Running `pnpm test` in packages/api uses spectree-test.db, never spectree.db
- [ ] Running `pnpm test` in packages/orchestrator uses spectree-test.db or mocks
- [ ] Prisma client throws clear error if test environment targets production DB
- [ ] Tests pass with a fresh (empty) test database
- [ ] Production database is completely untouched after full test suite run
- [ ] Pre-test script exits with error if DATABASE_URL misconfigured

---

## 6. Epic 4: Execution Plan Visualization

### Planner Prompt

```
Add an Execution Plan visualization to the SpecTree web dashboard. The execution
plan system (phases, dependencies, parallel groups, complexity estimates) is a
core differentiator but has no visual representation — it's only accessible via
the API endpoint GET /api/v1/execution-plans/:epicId.

Create an "Execution Plan" tab on the Epic Detail page that renders:

1. Phase swim lanes — horizontal lanes showing Phase 1, Phase 2, Phase 3, etc.
2. Feature/task cards within each phase, showing:
   - Identifier (e.g., ENG-5)
   - Title
   - Status (color-coded: gray=pending, blue=in-progress, green=done, red=blocked)
   - Complexity badge (trivial/simple/moderate/complex)
   - Assignee avatar (if assigned)
3. Dependency arrows — SVG lines connecting dependent items across phases
4. Parallel grouping — items in the same parallelGroup shown side-by-side
5. Progress overlay — completion percentage bar on each card
6. Click interaction — clicking a card navigates to the feature/task detail page

Technical approach:
- Use CSS Grid for phase layout (each phase is a row)
- Use SVG overlay for dependency arrows
- Cards are standard React components with Tailwind styling
- Data comes from the existing execution-plans API endpoint
- If SSE is available (Epic 2), status changes animate in real-time
- Responsive: stack phases vertically on small screens

Do NOT use a heavy visualization library (D3, vis.js, etc.). CSS Grid + SVG
arrows is sufficient and keeps the bundle small.

Target package: packages/web
Team: Engineering
```

### Suggested Feature Breakdown

| # | Feature | Complexity | Parallel? |
|---|---------|-----------|-----------|
| 1 | Execution plan API hook + data types | simple | Yes (with 2) |
| 2 | Phase swim lane layout component | moderate | Yes (with 1) |
| 3 | Execution item card component | simple | No (after 2) |
| 4 | SVG dependency arrow renderer | moderate | No (after 2+3) |
| 5 | Epic Detail page integration (new tab) | simple | No (after 3+4) |
| 6 | Real-time status updates (if SSE available) | simple | No (last) |

### Key Technical Decisions

- **No external library**: CSS Grid + SVG keeps bundle size small and avoids learning curve
- **Arrow rendering**: Calculate source/target coordinates from DOM positions using `getBoundingClientRect()`, render as SVG `<path>` elements with curved bezier paths
- **Responsive design**: Phases stack vertically, cards flow naturally
- **Status colors**: Match existing status color scheme from the feature list components
- **New tab**: Add "Plan" tab to existing Epic Detail page alongside existing "Features" content

### Files Involved

```
packages/web/src/hooks/queries/use-execution-plan.ts  → NEW: React Query hook
packages/web/src/lib/api/execution-plans.ts           → NEW: API client function
packages/web/src/components/execution-plan/
  plan-view.tsx           → NEW: Main plan visualization container
  phase-lane.tsx          → NEW: Single phase swim lane
  plan-item-card.tsx      → NEW: Feature/task card within plan
  dependency-arrows.tsx   → NEW: SVG arrow overlay
packages/web/src/pages/epics/epic-detail.tsx → Add "Plan" tab
packages/web/src/lib/api/types.ts            → Add ExecutionPlan types
```

### Acceptance Criteria (Epic-Level)

- [ ] Epic Detail page has a "Plan" tab showing the execution plan
- [ ] Phases render as distinct visual rows/lanes
- [ ] Cards show identifier, title, status (color-coded), complexity, and assignee
- [ ] Dependency arrows connect items across phases
- [ ] Parallel group items appear side-by-side within their phase
- [ ] Clicking a card navigates to the feature/task detail page
- [ ] Empty state shown when epic has no execution metadata
- [ ] Layout is responsive (stacks vertically on small screens)

---

## 7. Epic 5: Entity Change History (Audit Log)

### Planner Prompt

```
Add an entity change history (audit log) system to SpecTree. Currently,
decisions are tracked via the append-only decision log, but general changes
(status updates, description edits, reassignments, title changes) have no
record of who changed what, when, or what the previous value was.

This is critical for:
- Team collaboration: "Who changed this status?" "What was the old description?"
- AI accountability: When the orchestrator runs parallel agents, trace what happened
- Debugging: Understand the sequence of changes that led to current state

Implementation:

1. Database: Add a ChangeLog model to the Prisma schema
   - id (UUID), entityType (epic/feature/task), entityId (UUID)
   - field (string), oldValue (text, nullable), newValue (text, nullable)
   - changedBy (userId UUID, nullable — null for system/migration changes)
   - changedAt (DateTime), sessionId (string, nullable for AI attribution)
   - action (created/updated/deleted/status_changed)

2. Service Layer: Hook into existing services to emit changelog entries
   - On every update mutation, diff the before/after values
   - Record each changed field as a separate changelog entry
   - Include the authenticated user ID as changedBy
   - Special handling for status changes (include status name, not just ID)

3. API: Add changelog endpoints
   - GET /api/v1/changelog?entityType=feature&entityId=<uuid> — get history
   - GET /api/v1/changelog?epicId=<uuid>&since=<iso-date> — get recent changes
   - Paginated, ordered by changedAt descending

4. Frontend: Feed changelog into the existing Activity Panel
   - The activity-panel.tsx, activity-timeline.tsx, activity-item.tsx components
     already exist but have limited data
   - Add changelog entries as activity items with appropriate icons and formatting
   - Show "Status changed from 'In Progress' to 'Done' by Aaron" style entries

5. MCP: Expose changelog to AI agents
   - Add spectree__get_changelog tool (or action in a composite tool)
   - AI agents can query what changed since their last session

Target packages: packages/api (schema, services, routes), packages/web (activity),
packages/mcp (tool)
Team: Engineering
```

### Suggested Feature Breakdown

| # | Feature | Complexity | Parallel? |
|---|---------|-----------|-----------|
| 1 | ChangeLog Prisma model + migration | simple | No (first) |
| 2 | Changelog service (diff + record) | moderate | No (after 1) |
| 3 | Hook changelog into feature/task/epic services | moderate | No (after 2) |
| 4 | Changelog API endpoints | simple | Yes (with 5) |
| 5 | Frontend Activity Panel integration | moderate | Yes (with 4) |
| 6 | MCP tool for AI access | simple | No (last) |

### Key Technical Decisions

- **Per-field entries**: Store one row per changed field (not one row per save). This enables fine-grained "what changed" views without parsing JSON diffs
- **Text values**: Store `oldValue` and `newValue` as text (stringify objects/arrays). Keeps the schema simple and queryable
- **Status denormalization**: For status changes, store the status name alongside the ID so the changelog is human-readable without joins
- **No soft delete**: Changelog entries are append-only and never deleted
- **Performance**: Index on `(entityType, entityId, changedAt)` for efficient per-entity queries

### Files Involved

```
packages/api/prisma/schema.prisma                   → Add ChangeLog model
packages/api/src/services/changelogService.ts        → NEW: Record + query changes
packages/api/src/services/featureService.ts          → Add changelog hooks to updates
packages/api/src/services/taskService.ts             → Add changelog hooks to updates
packages/api/src/services/epicService.ts             → Add changelog hooks to updates
packages/api/src/routes/changelog.ts                 → NEW: GET /api/v1/changelog
packages/api/src/index.ts                            → Register changelog routes
packages/web/src/hooks/queries/use-changelog.ts      → NEW: React Query hook
packages/web/src/lib/api/changelog.ts                → NEW: API client
packages/web/src/components/activity/activity-panel.tsx → Integrate changelog data
packages/web/src/components/activity/activity-item.tsx  → New item types for changes
packages/mcp/src/tools/changelog.ts                  → NEW: spectree__get_changelog
```

### Acceptance Criteria (Epic-Level)

- [ ] Every feature/task/epic update creates changelog entries
- [ ] Changelog records who made each change and when
- [ ] Status changes show human-readable status names (not just UUIDs)
- [ ] Activity Panel on Feature/Task Detail pages shows change history
- [ ] API endpoint supports filtering by entity, epic, and date range
- [ ] Changelog entries include sessionId for AI attribution
- [ ] MCP tool allows AI agents to query recent changes
- [ ] No performance regression on write operations (changelog inserts are fast)

---

## 8. Execution Playbook

### Step-by-Step Instructions

#### Prerequisites

1. SpecTree API running: `cd packages/api && pnpm dev`
2. SpecTree MCP tools available in your Copilot CLI session
3. MCP token configured in `packages/mcp/.env`

#### Phase A: Independent Epics (Run in Parallel)

Open 3 Copilot CLI sessions simultaneously:

**Session 1 — Epic 3 (Test DB Isolation):**
```
@planner --gates=auto,auto,review,review,review "Fix test database isolation
for SpecTree. On Feb 6, 2026, running tests overwrote the production SQLite
database with test fixture data. Ensure tests ALWAYS use a separate database,
add runtime guards, and add globalSetup/globalTeardown for vitest. See
docs/platform-improvements-plan.md Section 5 for full specification."
```

**Session 2 — Epic 5 (Change History):**
```
@planner --gates=auto,auto,review,review,review "Add an entity change history
audit log to SpecTree. Track who changed what field, when, and what the previous
value was for all features, tasks, and epics. Add ChangeLog model, hook into
services, expose via API and MCP, and integrate with the existing Activity Panel
in the frontend. See docs/platform-improvements-plan.md Section 7 for full
specification."
```

**Session 3 — Epic 1 (MCP Consolidation):**
```
@planner --gates=auto,auto,review,review,review "Consolidate the SpecTree MCP
server from 83 individual tools to ~25 composite tools. Group related tools by
domain (code-context, validation, structured-desc, progress, ai-context, ordering)
into composite tools with an action parameter. Keep backward compatibility with
original tools. See docs/platform-improvements-plan.md Section 3 for full
specification."
```

**After planning completes for each, review the execution plans:**
```typescript
spectree__get_execution_plan("<epic-id>")
```

**Then execute each epic:**
```
@orchestrator "Execute epic <epic-identifier>"
```

Or via CLI:
```bash
spectree run <epic-id>
```

#### Phase B: Dependent Epics (After Phase A)

**Session 4 — Epic 2 (SSE Updates):**
```
@planner --gates=auto,auto,review,review,review "Add Server-Sent Events to
SpecTree for real-time dashboard updates. Add SSE endpoint to the API server,
extend the internal EventEmitter to cover all entity mutations, create frontend
useEventSource hook with React Query cache invalidation. See
docs/platform-improvements-plan.md Section 4 for full specification."
```

**Session 5 — Epic 4 (Execution Plan Viz):**
```
@planner --gates=auto,auto,review,review,review "Add an Execution Plan
visualization tab to the Epic Detail page. Render phases as swim lanes with
feature/task cards, SVG dependency arrows, parallel group layout, and status
color-coding. Use CSS Grid + SVG, no external visualization library. See
docs/platform-improvements-plan.md Section 6 for full specification."
```

### Review Gate Strategy

For these improvements, the recommended gate configuration is:

```
--gates=auto,auto,review,review,review
```

| Stage | Gate | Rationale |
|-------|------|-----------|
| 1. Analyze | auto | Codebase analysis is reliable, no decisions to make |
| 2. Decompose | auto | Feature breakdown is well-specified in this document |
| 3. Detail | review | Verify AI instructions and acceptance criteria are correct |
| 4. Evaluate | review | Always review quality scores — catch missing details |
| 5. Verify | review | Always review execution plan — catch dependency errors |

### Monitoring Execution

During orchestrator execution, monitor progress:

```typescript
// Check overall progress
spectree__get_progress_summary({ epicId: "<epic-id>" })

// Check for blocked items
spectree__get_blocked_summary({ epicId: "<epic-id>" })

// View decisions made by AI agents
spectree__list_decisions({ epicId: "<epic-id>" })
```

### Post-Execution Validation

After each epic completes:

```bash
# Run all validation checks
spectree validate <epic-id>

# Run the test suite
pnpm test

# Check for TypeScript errors
pnpm typecheck

# Review git log for the epic's branches
git log --oneline --graph --all
```

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP consolidation breaks existing tool calls | High | Keep original tools registered (backward compat) |
| SSE connections leak memory | Medium | Implement proper cleanup on disconnect, add connection limits |
| Test isolation migration breaks existing tests | Low | Run full test suite after changes, fix any failures |
| Execution plan viz has complex SVG edge cases | Low | Start simple (straight lines), iterate to curves |
| Changelog adds write latency | Low | Batch inserts, add after commit (async if needed) |
| Parallel epic execution causes merge conflicts | Medium | Phase A epics touch different packages/files — conflicts unlikely |

---

## 10. Success Metrics

After all 5 epics are complete, measure:

1. **MCP token reduction**: Compare tool definition token count before/after consolidation. Target: 40%+ reduction.
2. **Dashboard freshness**: Time between MCP tool mutation and UI update. Target: < 2 seconds with SSE.
3. **Test safety**: Run `pnpm test` 10 times — production DB must be untouched every time.
4. **Plan visibility**: Execution plan tab shows correct phase/dependency/parallel layout for the Automation Tool epic (existing complex epic).
5. **Change traceability**: Activity Panel shows full history for any feature modified by AI agents.
