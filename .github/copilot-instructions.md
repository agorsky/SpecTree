# Copilot Instructions for Dispatcher

**🔴 NEVER:** `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`

---

Dispatcher is a project management tool similar to Linear, with a REST API, React frontend, and MCP server for AI integration.

---

## ⚡ Quick Reference (READ FIRST)

**Before Implementation:**
- [ ] `dispatcher__list_teams()` - Discover teams (don't assume names)
- [ ] `dispatcher__start_session({ epicId })` - Start session for existing epic
- [ ] `dispatcher__list_templates()` - Use templates for new epics

**During Epic Creation:**
- [ ] Every feature: `executionOrder`, `estimatedComplexity`, `dependencies`
- [ ] Minimum 3 tasks per feature with detailed descriptions
- [ ] `dispatcher__set_structured_description()` for ALL features and tasks

**Before Completing:**
- [ ] `dispatcher__run_all_validations()` - Verify acceptance criteria
- [ ] `dispatcher__link_code_file()` - Link modified files
- [ ] `dispatcher__log_decision()` - Record important choices

**During Implementation (EVERY file/decision):**
- [ ] `dispatcher__link_code_file()` - For EVERY file created or modified
- [ ] `dispatcher__log_decision()` - For every non-trivial choice
- [ ] `dispatcher__log_progress()` - At every significant milestone
- [ ] `dispatcher__append_ai_note()` - Observations & context for future sessions

**After Epic Execution (MANDATORY):**
- [ ] `dispatcher__update_epic()` - Append execution summary to epic description (phase results, metrics, files)

**At Session End:**
- [ ] `dispatcher__end_session()` with summary + nextSteps

## 🔴 CRITICAL: Use Dispatcher for Implementation Planning

**When Dispatcher MCP tools are available, ALWAYS use Dispatcher for implementation planning instead of creating plan.md files.**

### When to Use Dispatcher

Use Dispatcher when the user asks to:
- "Build", "implement", "create", or "develop" a feature
- "Plan" or "design" a new capability
- Work on something that requires multiple steps or phases
- Track progress on complex work

### Planning Workflow

**Step 1: Check for existing work**
```typescript
dispatcher__list_epics()  // See existing epics
dispatcher__search({ query: "relevant keywords" })  // Find related items
```

**Step 2: Start a session (if working on existing epic)**
```typescript
dispatcher__start_session({ epicId: "Epic Name" })
// Review previousSession context for continuity
```

**Step 3: Discover available teams (if creating new epic)**

🔴 **IMPORTANT:** Before creating an epic, you MUST determine the correct team:

```typescript
// If user specifies a team, use it directly
// If team is NOT specified, discover available teams and ASK:
const { teams } = await dispatcher__list_teams();
// teams = [{ id: "uuid-here", name: "Engineering", key: "ENG" }, { id: "uuid-here", name: "Commercial", key: "COM" }]

// Then ask the user:
// "Which team should I create this epic in? Available teams: Engineering (ENG), Commercial (COM)"
```

**Do NOT assume team names.** If the API returns an error like "Access denied" or "Team not found" when creating an epic, call `dispatcher__list_teams()` to see available teams and ask the user to choose.

**Step 4: Create epic using a template (MANDATORY)**

🔴 **IMPORTANT:** You MUST use templates when creating epics. Templates ensure proper structure with features, tasks, and execution metadata.

```typescript
// Step 4a: List available templates
dispatcher__list_templates()
// Available: "Code Feature", "Bug Fix", "Refactoring", "API Endpoint"

// Step 4b: Preview what will be created
dispatcher__preview_template({
  templateName: "Code Feature",
  epicName: "User Activity Dashboard",
  variables: { topic: "Activity Dashboard" }
})

// Step 4c: Create from template (creates full hierarchy)
dispatcher__create_from_template({
  templateName: "Code Feature",
  epicName: "User Activity Dashboard",
  team: "Engineering",  // Use actual team from step 3
  variables: { topic: "Activity Dashboard" }
})
```

**Only create epics manually if NO template fits** (rare). If creating manually, you MUST still create all features and tasks with full details.
```

**Step 5: Create features with execution metadata**
```typescript
dispatcher__create_feature({
  title: "Database Schema",
  epic: "User Activity Dashboard",
  executionOrder: 1,
  estimatedComplexity: "moderate",
  description: "Add ActivityLog and related tables..."
})

dispatcher__create_feature({
  title: "Activity Service",
  epic: "User Activity Dashboard",
  executionOrder: 2,
  dependencies: ["<uuid-of-schema-feature>"],
  estimatedComplexity: "moderate"
})
```

**Step 6: Add tasks for granular work**
```typescript
dispatcher__create_task({
  title: "Add ActivityLog table to Prisma schema",
  feature_id: "SPEC-123",
  executionOrder: 1,
  estimatedComplexity: "simple"
})
```

**Step 7: Add structured details**
```typescript
dispatcher__set_structured_description({
  id: "SPEC-123",
  type: "feature",
  structuredDesc: {
    summary: "Add database tables for activity tracking",
    acceptanceCriteria: [
      "ActivityLog table exists with proper indexes",
      "Migration runs without errors"
    ],
    filesInvolved: ["packages/api/prisma/schema.prisma"],
    riskLevel: "medium",
    estimatedEffort: "medium"
  }
})
```

### During Implementation

**At START:**
- `dispatcher__start_work({ id, type })` — mark item in-progress
- `dispatcher__get_structured_description({ id, type })` — read acceptance criteria
- `dispatcher__get_ai_context({ id, type })` — read prior session notes

**While working (call repeatedly):**
- `dispatcher__log_progress({ id, type, message, percentComplete })` — at milestones
- `dispatcher__log_decision({ epicId, question, decision, rationale, category })` — for choices
- `dispatcher__link_code_file({ id, type, filePath })` — for EVERY file touched
- `dispatcher__append_ai_note({ id, type, noteType, content })` — observations, context

**Before completing:**
- `dispatcher__run_all_validations({ taskId })` — verify acceptance criteria
- `dispatcher__link_branch({ id, type, branchName })` — link git branch
- `dispatcher__link_commit({ id, type, commitSha })` — link merge/squash commit
- `dispatcher__complete_work({ id, type, summary })` — mark done

**After PR creation:**
- `dispatcher__link_pr({ id, type, prNumber, prUrl })` — link the pull request

### 🔴 MANDATORY: Epic Execution Summary

After completing execution of an epic (all phases done), you MUST update the epic's description with a permanent execution summary. This applies to orchestrator-driven execution AND manual multi-feature work.

**Call `dispatcher__update_epic`** to append a `## ✅ Execution Complete` section to the existing description. The summary MUST include:

1. **Phase results table** — each phase with feature identifiers and ✅/❌ status
2. **Verification metrics** — test counts, lines added/removed, file counts
3. **Artifacts created** — what was built (tools, components, services, etc.)
4. **Files created/modified** — grouped by phase or feature

**Why this matters:** The epic description is the permanent record visible to all users and future AI sessions. Without this summary, there is no way to understand what was actually accomplished.

### 🔴 MANDATORY: Template Usage

**Templates MUST be used for all epic creation.** Available built-in templates:

| Template | Use Case | Variables |
|----------|----------|-----------|
| **Code Feature** | New features, enhancements | `{{topic}}` |
| **Bug Fix** | Bug investigation/fixes | `{{bugTitle}}`, `{{component}}` |
| **Refactoring** | Code improvements | `{{refactoringTarget}}` |
| **API Endpoint** | New API development | `{{endpointName}}`, `{{resource}}` |

If templates aren't available (empty list), **run database seed first** or create manually following all requirements below.

### 🔴 MANDATORY: Epic Creation Requirements

When creating a new epic, you MUST complete ALL of the following:

**1. Create features with execution metadata:**
Every feature MUST have:
- `executionOrder` - Numeric order for sequencing
- `estimatedComplexity` - "trivial", "simple", "moderate", or "complex"
- `dependencies` - UUIDs of features that must complete first (if any)

**2. Create tasks for EVERY feature:**
- **Minimum 3 tasks per feature** (break down the work)
- Each task MUST have `executionOrder` and `estimatedComplexity`
- Each task MUST have a detailed `description` explaining what needs to be done

**3. Set structured descriptions FOR EVERY FEATURE AND TASK:**
For each feature, call `dispatcher__set_structured_description` with:
- `summary` - Clear description of what the feature does (REQUIRED)
- `acceptanceCriteria` - List of conditions that define "done" (REQUIRED, min 3 items)
- `aiInstructions` - Specific guidance for AI working on this feature (REQUIRED)
- `filesInvolved` - Files that will need to be modified
- `technicalNotes` - Implementation constraints or considerations
- `riskLevel` - "low", "medium", or "high"
- `estimatedEffort` - "trivial", "small", "medium", "large", or "xl"

For each task, call `dispatcher__set_structured_description` with:
- `summary` - What this task accomplishes (REQUIRED)
- `acceptanceCriteria` - How to verify the task is done (REQUIRED, min 2 items)
- `aiInstructions` - Step-by-step guidance for implementation (REQUIRED)

**4. Verify execution plan:**
After creating all features and tasks, call `dispatcher__get_execution_plan` and review it.

### 🔴 MANDATORY: Minimum Information Checklists

**Another AI session MUST be able to complete the work based on the information provided.** Use these checklists:

#### Feature Checklist (ALL required)
- [ ] `title` - Descriptive title explaining what the feature does
- [ ] `description` - Detailed description with context and requirements
- [ ] `executionOrder` - Where this fits in the sequence
- [ ] `estimatedComplexity` - "trivial", "simple", "moderate", or "complex"
- [ ] `dependencies` - UUIDs of blocking features (if any)
- [ ] Structured description with:
  - [ ] `summary` - 2-3 sentences explaining the feature
  - [ ] `acceptanceCriteria` - At least 3 testable criteria
  - [ ] `aiInstructions` - Detailed implementation guidance

#### Task Checklist (ALL required)
- [ ] `title` - Specific, actionable task title
- [ ] `description` - What needs to be done and why
- [ ] `executionOrder` - Order within the feature
- [ ] `estimatedComplexity` - "trivial", "simple", "moderate", or "complex"
- [ ] Structured description with:
  - [ ] `summary` - What this task accomplishes
  - [ ] `acceptanceCriteria` - At least 2 verification criteria
  - [ ] `aiInstructions` - Step-by-step implementation guidance

#### Example of GOOD vs BAD Feature

❌ **BAD (too sparse):**
```typescript
dispatcher__create_feature({
  title: "Database Schema",
  epic: "Activity Dashboard",
  description: "Add tables"
})
```

✅ **GOOD (sufficient detail):**
```typescript
dispatcher__create_feature({
  title: "Activity Tracking Database Schema",
  epic: "Activity Dashboard",
  executionOrder: 1,
  estimatedComplexity: "moderate",
  description: `Add database tables for tracking user activity events.

## Requirements
- Store activity type, timestamp, user, and metadata
- Support querying by user, time range, and activity type
- Index for efficient queries on common access patterns

## Technical Approach
- Add ActivityLog model to Prisma schema
- Create migration with indexes
- Add TypeScript types to shared package`
})

// Then ALSO set structured description:
dispatcher__set_structured_description({
  id: "COM-xxx",
  type: "feature",
  structuredDesc: {
    summary: "Create database schema for activity tracking with ActivityLog table, proper indexes, and relations",
    acceptanceCriteria: [
      "ActivityLog model exists in Prisma schema with all required fields",
      "Migration creates table with indexes on userId, activityType, createdAt",
      "TypeScript types are exported from @dispatcher/shared",
      "Existing tests still pass after migration"
    ],
    aiInstructions: "1. Add ActivityLog model to schema.prisma with fields: id, userId, activityType (enum), metadata (JSON), createdAt, updatedAt. 2. Add index on (userId, createdAt) and (activityType). 3. Run prisma generate. 4. Create ActivityLogType enum in shared/types. 5. Export types from shared index.",
    filesInvolved: ["packages/api/prisma/schema.prisma", "packages/shared/src/types/activity.ts"],
    riskLevel: "medium",
    estimatedEffort: "small"
  }
})
```

### 🔴 MANDATORY: Verification After Tool Calls

After calling any MCP tool that creates or updates data, you MUST:

1. **Check the response for errors** - If the tool returns an error, STOP and report it
2. **Verify critical fields were set** - For execution metadata, check the returned object has non-null values
3. **Do NOT proceed if data didn't persist** - The tool `dispatcher__set_execution_metadata` now validates this automatically

Example verification:
```typescript
// Create feature
const feature = await dispatcher__create_feature({ ... });

// Verify it was created
if (!feature.identifier) {
  throw new Error("Feature creation failed - no identifier returned");
}

// Set execution metadata
const updated = await dispatcher__set_execution_metadata({
  id: feature.identifier,
  type: "feature",
  executionOrder: 1,
  estimatedComplexity: "moderate"
});

// The tool now validates automatically and returns error if data didn't persist
```

### 🔴 MANDATORY: Sequential vs Parallel Creation

**DO NOT create features in parallel.** Create them sequentially to avoid identifier race conditions:

```typescript
// ✅ CORRECT: Sequential creation
const feature1 = await dispatcher__create_feature({ title: "Feature 1", ... });
const feature2 = await dispatcher__create_feature({ title: "Feature 2", ... });

// ❌ WRONG: Parallel creation (can cause identifier conflicts)
await Promise.all([
  dispatcher__create_feature({ title: "Feature 1", ... }),
  dispatcher__create_feature({ title: "Feature 2", ... })
]);
```

### End of Session

Always end with session handoff:
```typescript
dispatcher__end_session({
  epicId: "User Activity Dashboard",
  summary: "Completed database schema and started service layer",
  nextSteps: ["Implement activityService.ts", "Add API routes"],
  blockers: [],
  decisions: [{ decision: "Used event-driven logging", rationale: "Non-blocking, better performance" }]
})
```

### When NOT to Use Dispatcher

- Quick one-off questions or explanations
- Single-file fixes (typos, small bugs)
- Exploratory code reading without planned changes
- When user explicitly asks for a file-based plan


---

## 🚀 SESSION START CHECKLIST

**At the start of every coding session, Copilot MUST:**

1. **Check git status and branch state:**
   ```bash
   git fetch origin && git status
   ```

2. **If on `main`, remind user to create a feature branch before making changes**

3. **If on a feature/bugfix branch, check if it's behind main:**
   ```bash
   git log HEAD..origin/main --oneline
   ```
   - If commits exist, recommend: `git rebase origin/main`

4. **Before any code changes, confirm the branch is synced with remote**

5. **If working on a Dispatcher epic, initialize session context:**
   ```typescript
   dispatcher__list_epics()  // Check for tracked epics
   dispatcher__start_session({ epicId: "<epic-id>" })  // Initialize session
   // Review previousSession.summary, nextSteps, blockers, decisions for continuity
   ```

**Prompt the user if:**
- Working directly on `main` (should create feature branch)
- Branch is more than 1 day old without sync
- About to commit without recent fetch

---

## 🔴 CRITICAL: Database Safety

This project has experienced data loss from unsafe Prisma commands. Follow these rules strictly.

**NEVER run:**
- `npx prisma migrate reset` - Deletes all data
- `npx prisma migrate dev` - May require reset
- `npx prisma db push --force-reset` - Deletes all data

**ALWAYS:**
```bash
npm run db:backup              # Backup first
npm run db:migrate:safe        # Safe migration (backs up automatically)
npx prisma db push             # Schema sync without --force-reset
```

Tests use a separate database (`dispatcher-test.db`) configured in `packages/api/vitest.config.ts`. Do not modify this configuration.

---

## AI Session Context

### Per-Item Context (Features/Tasks)

Dispatcher provides dedicated AI context fields on Features and Tasks for cross-session continuity:

- `dispatcher__get_ai_context` - Read context from previous sessions
- `dispatcher__set_ai_context` - Set structured summary context  
- `dispatcher__append_ai_note` - Log observations, decisions, blockers, next-steps

See `docs/mcp/ai-session-context.md` for full documentation.

### Progress Summary (Dashboard)

Get comprehensive progress summaries at session start to quickly understand project status:

- `dispatcher__get_progress_summary` - Epic summary with counts, blockers, and next actions
- `dispatcher__get_my_work` - Your assigned items across all epics  
- `dispatcher__get_blocked_summary` - All blocked items grouped by epic

**Recommended at session start:**
```typescript
const summary = await dispatcher__get_progress_summary({ epicId: "My Epic" });
// summary.blockedItems - Items needing attention
// summary.nextActionable - What to work on next
// summary.lastSession - Previous session context
```

See `docs/mcp/progress-summary.md` for full documentation.

### Session Handoff (Epics)

For epic-level workflow continuity, use the Session Handoff System:

**At session start:**
```typescript
const { previousSession, epicProgress } = await dispatcher__start_session({
  epicId: "Epic Name or ID"
});
// Review previousSession.summary, nextSteps, blockers, decisions
```

**During work:** Work is automatically tracked when using `dispatcher__start_work` and `dispatcher__complete_work`.

**At session end:**
```typescript
await dispatcher__end_session({
  epicId: "Epic Name or ID",
  summary: "What was accomplished",
  nextSteps: ["Recommended next actions"],
  blockers: ["Any blockers encountered"],
  decisions: [{ decision: "Choice made", rationale: "Why" }]
});
```

See `docs/mcp/session-handoff.md` for full documentation.

### Structured Descriptions

Features and Tasks support rich, structured descriptions with AI-friendly sections:

- `dispatcher__get_structured_description` - Get parsed structured description
- `dispatcher__set_structured_description` - Replace entire structured description
- `dispatcher__update_section` - Update single section (recommended approach)
- `dispatcher__add_acceptance_criterion` - Append acceptance criterion
- `dispatcher__link_file` - Add file to filesInvolved list
- `dispatcher__add_external_link` - Add external URL reference

**Available sections:** `summary` (required), `aiInstructions`, `acceptanceCriteria`, `filesInvolved`, `functionsToModify`, `testingStrategy`, `testFiles`, `relatedItemIds`, `externalLinks`, `technicalNotes`, `riskLevel`, `estimatedEffort`

See `docs/mcp/structured-descriptions.md` for full documentation.

### Code Context (Codebase Integration)

Link features and tasks directly to code artifacts for instant code context:

- `dispatcher__link_code_file` - Link a source file
- `dispatcher__unlink_code_file` - Remove a file link
- `dispatcher__link_function` - Link a function (format: `filePath:functionName`)
- `dispatcher__link_branch` - Set git branch
- `dispatcher__link_commit` - Add commit SHA
- `dispatcher__link_pr` - Link pull request
- `dispatcher__get_code_context` - Get all code context

**Difference from Structured Descriptions:**
- Structured descriptions (`filesInvolved`) = files you *plan* to modify
- Code context (`relatedFiles`) = files you *actually* modified

See `docs/mcp/code-context.md` for full documentation.

### Validation Checklists

Tasks can have executable validation checks that define "done" in a verifiable way:

- `dispatcher__add_validation` - Add a validation check (command, file_exists, file_contains, test_passes, manual)
- `dispatcher__list_validations` - List checks with status summary
- `dispatcher__run_validation` - Run a single check
- `dispatcher__run_all_validations` - Run all checks
- `dispatcher__mark_manual_validated` - Mark manual check as passed
- `dispatcher__remove_validation` - Remove a check
- `dispatcher__reset_validations` - Reset all to pending

See `docs/mcp/validation-checklists.md` for full documentation.

### Decision Log

Record implementation decisions with their rationale using the Decision Log. Creates an append-only audit trail for understanding past choices.

- `dispatcher__log_decision` - Record a new decision with rationale
- `dispatcher__list_decisions` - List decisions with filters (epic, feature, task, category, impact)
- `dispatcher__search_decisions` - Search decision text
- `dispatcher__get_decision_context` - Get all decisions for a task or feature context

**When to log decisions:**
- Choosing between libraries/approaches
- Deciding to skip or defer something
- Making assumptions about requirements
- Changing direction from original plan

**Example:**
```typescript
await dispatcher__log_decision({
  epicId: "epic-uuid",
  featureId: "feature-uuid",  // optional
  question: "Which state management library to use?",
  decision: "Use Zustand instead of Redux",
  rationale: "Simpler API, smaller bundle, sufficient for our needs",
  alternatives: ["Redux", "MobX"],
  category: "library",  // architecture, library, approach, scope, design, tradeoff, deferral
  impact: "medium"      // low, medium, high
});
```

See `docs/mcp/decision-log.md` for full documentation.


---

## Build, Test, and Lint

```bash
# Full suite
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages
pnpm typecheck        # TypeScript checking

# Single package
pnpm --filter @dispatcher/api test
pnpm --filter @dispatcher/web build

# Single test file (from packages/api)
cd packages/api
npx vitest run tests/services/featureService.test.ts

# Watch mode for a specific test
npx vitest tests/services/featureService.test.ts
```

---

## Architecture

### Monorepo Structure

```
packages/
├── api/      → Fastify REST API + Prisma ORM (SQLite)
├── web/      → React + Vite + Tailwind + Radix UI
├── mcp/      → MCP server (imports from api package)
└── shared/   → Shared TypeScript types (no dependencies)
```

Package dependencies: `shared` ← `api`, `web`, `mcp`; and `api` ← `mcp`

### API Layer Pattern

Routes → Services → Prisma. Each domain has:
- `src/routes/{domain}.ts` - Fastify route handlers with Zod validation
- `src/services/{domain}Service.ts` - Business logic and database access
- `src/schemas/{domain}.ts` - Zod schemas for request/response validation

### Error Handling

Use custom error classes from `src/errors/index.ts`:
- `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409)
- `UnauthorizedError` (401), `ForbiddenError` (403)

All extend `AppError` with `statusCode`, `code`, and optional `details`.

### Database

- Schema: `packages/api/prisma/schema.prisma`
- Data: `packages/api/prisma/data/dispatcher.db` (SQLite)
- Generated client: `packages/api/src/generated/prisma/`

---

## Key Conventions

### TypeScript
- Strict mode enabled; avoid `any`
- Use type-only imports: `import type { User } from "./types"`
- Files: kebab-case (`user-service.ts`), React components: PascalCase (`UserProfile.tsx`)

### Validation
- All API inputs validated with Zod schemas
- Common schemas in `src/schemas/common.ts` (pagination, date filters, UUID params)

### Frontend
- Functional components with hooks; prefer named exports
- Use `cn()` utility for conditional Tailwind classes
- State management: Zustand; data fetching: TanStack Query

### Testing
- Tests in `packages/api/tests/` mirror source structure
- Integration tests use factories from `tests/fixtures/factories.ts`
- Test setup handles separate test database automatically

---

## 🔴 CRITICAL: Git Workflow Safety

This project follows the **Git Release Flow** strategy. Full documentation: `docs/git/`

### Before Creating ANY Branch

**ALWAYS sync with remote first:**
```bash
git fetch origin
git checkout main
git pull origin main
```

**Then create your branch:**
```bash
git checkout -b feature/TICKET-123-description
```

### Branch Source Rules

| Work Type | Branch From | PR Target |
|-----------|-------------|-----------|
| New feature | `main` (freshly pulled) | `main` |
| Bug fix (dev) | `main` (freshly pulled) | `main` |
| Bug fix (QA/release) | `release/x.y` | `release/x.y` |
| Hotfix (production) | Recreate from tag | `release/x.y` |

### Before Opening a PR

**ALWAYS check for upstream changes:**
```bash
git fetch origin
git log HEAD..origin/main --oneline  # See what's new on main
```

**If main has advanced, rebase your feature branch:**
```bash
git rebase origin/main
# Resolve any conflicts
git push --force-with-lease  # Safe force push for your branch only
```

### Forbidden Actions

**NEVER:**
- Create a branch without fetching first
- Work on a branch for extended periods without syncing with main
- Force push to `main` or `release/*` branches
- Rebase shared branches or release branches after RC tags exist
- Cherry-pick as a primary strategy (use merge-forward)

### Long-Running Work Sessions

If working across multiple sessions or days:
```bash
# At start of each session
git fetch origin
git rebase origin/main  # Keep your branch current
```

### Forward-Port Requirement

Every fix on `release/*` **MUST** be forward-ported to `main` within 2 business days:
```bash
git checkout main
git pull origin main
git merge release/x.y
# Open PR for forward-port
```

### Quick Reference

- **Policy docs:** `docs/git/git-release-flow-strategy-final-with-definitions.md`
- **Cheat sheet:** `docs/git/git-release-flow-cheat-sheet.md`
- **PR template:** `docs/git/PULL_REQUEST_TEMPLATE.md`

---

## Custom Agents

Six custom agents are defined in `.github/agents/`. Five are user-invokable; `feature-worker` is a sub-agent only.

### @planner - Dispatcher Planning Pipeline

Creates structured Dispatcher epics from natural language descriptions. Runs a 5-stage pipeline: Analyze → Decompose → Detail → Evaluate → Verify. Supports configurable review gates at each stage.

```
Usage: @planner "Build a user activity dashboard"
       @planner --gates=auto "Build a user preferences API"
       @planner --gates=auto,auto,review,review,review "Build a CSV export feature"
       @planner --from-request "My Epic Request Title"
       @planner --from-request "My Epic Request Title" --gates=auto
```

The planner reads the codebase to understand scope, creates the epic with `dispatcher__create_epic_complete`, sets structured descriptions on every feature and task, evaluates quality, and verifies the execution plan.

**`--from-request` flag:** When provided, the planner fetches an existing Epic Request (by title or UUID) and uses its structured description (problem statement, proposed solution, impact assessment, etc.) as the requirements source. This avoids re-explaining what was already captured during the request-formulator interview. The planner still performs codebase analysis for technical context.

### @request-formulator - AI-Assisted Epic Request Creation

Guides users through a structured interview to craft high-quality Epic Requests. Conducts a multi-step interview covering problem statement, proposed solution, impact assessment, success criteria, target audience, and technical context.

```
Usage: @request-formulator "I want to propose adding real-time notifications"
```

The request-formulator conducts an interactive interview gathering requirements, checks for duplicate requests via `dispatcher__list_epic_requests`, presents a formatted preview with both markdown description and structured JSON, and submits via `dispatcher__create_epic_request` with both `description` and `structuredDesc` fields.

**When to recommend:** When a user mentions wanting to "propose a feature", "suggest an epic", "request a new feature", or "submit an idea for review". The formulator helps users create well-structured proposals that are easier for admins to review and approve.

### @orchestrator - Epic Execution

Executes Dispatcher execution plans by delegating features to feature-worker sub-agents. Reads the execution plan, spawns workers in parallel where safe, and tracks progress back to Dispatcher.

```
Usage: @orchestrator "Execute epic ENG-42"
```

The orchestrator reads the execution plan via `dispatcher__get_execution_plan`, gathers full context for each feature from Dispatcher (structured descriptions, AI context, code context, decisions), builds context prompts, and spawns feature-worker sub-agents. After each phase, it invokes the reviewer agent to verify the work.

**Monitoring Progress:** The orchestrator logs progress to Dispatcher at the epic level after each phase. While execution is running, you can check progress from a second terminal:
```
@copilot "Check progress on epic <epic-id>"
# → calls dispatcher__get_progress_summary({ epicId: "<epic-id>" })
```
Or check epic AI notes for detailed phase-by-phase updates:
```
@copilot "Show AI notes for epic <epic-name>"
# → calls dispatcher__get_ai_context({ type: "epic", id: "<epic-id>" })
```

> **Note:** When invoked via the `task` tool, the orchestrator's text output is buffered and returned at the end. Dispatcher polling is the recommended way to monitor real-time progress.

### @reviewer - Acceptance Review

Reviews completed features against their Dispatcher acceptance criteria. Runs validations, checks code quality, and verifies requirements are met.

```
Usage: @reviewer "Review feature ENG-42-1"
```

The reviewer reads acceptance criteria from structured descriptions, runs `dispatcher__run_all_validations`, reviews code changes, and presents a structured review report with per-criterion PASS/FAIL/PARTIAL verdicts.

### @plan-reviewer - Epic Quality Review

Reviews Dispatcher epics, features, and tasks for completeness and quality before implementation begins. Evaluates epic descriptions, structured descriptions, acceptance criteria, AI instructions, and execution plans against quality standards.

```
Usage: @plan-reviewer "Review epic ENG-42"
```

The plan-reviewer loads the epic and all features/tasks, evaluates them against the `dispatcher-plan-review` skill rubrics, scores each dimension, and produces a structured readiness report with an overall READY/NOT READY verdict.

### feature-worker (Sub-Agent Only)

Implements all tasks within a single Dispatcher feature. **Not user-invokable** — only spawned by the orchestrator as a sub-agent. Receives full context from the orchestrator including requirements, acceptance criteria, and code context. Follows a strict per-task workflow: `dispatcher__start_work` → implement → `dispatcher__link_code_file` → `dispatcher__log_progress` → `dispatcher__complete_task_with_validation`.

---

## Custom Skills

Four reusable procedure skills are available in `.github/skills/`. Skills are step-by-step procedures that any agent can reference — they complement agents by providing the "how" while agents provide the "who".

| Skill | Location | Purpose |
|-------|----------|---------|
| **dispatcher-planning** | `.github/skills/dispatcher-planning/SKILL.md` | 5-stage planning pipeline procedure with quality heuristics, review gates, and task scoping guidelines |
| **dispatcher-session** | `.github/skills/dispatcher-session/SKILL.md` | Session start/during/end protocol for Dispatcher context continuity across AI sessions |
| **dispatcher-validation** | `.github/skills/dispatcher-validation/SKILL.md` | Validation run/interpret/complete workflow for verifying acceptance criteria with automated checks |
| **dispatcher-plan-review** | `.github/skills/dispatcher-plan-review/SKILL.md` | Quality rubrics, scoring methodology, and review process for evaluating epic readiness before orchestrator execution |

---

## Automation Workflow

### Planning (`dispatcher plan`)

Create a fully-specified Dispatcher epic from a natural language description:

```bash
# Interactive planning with review gates (default)
dispatcher plan "Build a user activity dashboard"

# Headless planning (auto-approve all stages except Evaluate)
dispatcher plan --auto "Build a user preferences API"
```

Or use the planner agent directly in a Copilot CLI session:

```
@planner "Build a user activity dashboard"
@planner --from-request "My Epic Request Title"
```

The planning pipeline produces an epic with features, tasks, structured descriptions (AI instructions, acceptance criteria, files involved), execution ordering, and a validated execution plan.

### Execution (`dispatcher run`)

Execute a Dispatcher epic's execution plan:

```bash
# Execute all phases
dispatcher run <epic-id>

# Dry run — show execution plan without executing
dispatcher run --dry-run <epic-id>
```

The execution engine reads the execution plan from Dispatcher, spawns Copilot CLI sessions (via ACP) for each feature, manages git branches, tracks progress, and runs validations on completion.

### Validation (`dispatcher validate`)

Run all validation checks for an epic's tasks and report results:

```bash
dispatcher validate <epic-id>
```

### Shell Scripts

Headless automation scripts are available in `scripts/` for CI/CD integration:

| Script | Purpose |
|--------|---------|
| `scripts/dispatcher-plan.sh` | Headless planning pipeline |
| `scripts/dispatcher-run.sh` | Headless epic execution |
| `scripts/dispatcher-validate.sh` | Headless validation run |

```bash
# Example: Full headless workflow
./scripts/dispatcher-plan.sh "Build a CSV export feature"
./scripts/dispatcher-run.sh ENG-42
./scripts/dispatcher-validate.sh ENG-42
```
