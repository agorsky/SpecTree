# Instruction Files Audit Report

**Generated:** 2026-02-17T00:02:30.714Z

---

## Summary

- **Total Files Scanned:** 17
- **Total Lines:** 3,960
- **Topics Identified:** 12
- **Overlaps Found:** 12
- **Potential Contradictions:** 21

## File Breakdown

| File | Lines | Topics Covered |
|------|-------|----------------|
| `.github/copilot-instructions.md` | 889 | 11 |
| `.github/agents/planner.md` | 494 | 9 |
| `.github/agents/orchestrator.md` | 488 | 10 |
| `.github/skills/spectree-planning/SKILL.md` | 323 | 8 |
| `.github/skills/spectree-plan-review/SKILL.md` | 320 | 8 |
| `.github/skills/spectree-validation/SKILL.md` | 266 | 7 |
| `.github/skills/spectree-session/SKILL.md` | 254 | 8 |
| `.github/agents/feature-worker.md` | 230 | 10 |
| `.github/agents/request-formulator.md` | 211 | 6 |
| `.github/agents/reviewer.md` | 169 | 9 |
| `.github/agents/plan-reviewer.md` | 61 | 7 |
| `.github/instructions/api.instructions.md` | 55 | 2 |
| `.github/instructions/agents.instructions.md` | 46 | 5 |
| `.github/instructions/frontend.instructions.md` | 46 | 1 |
| `.github/instructions/database.instructions.md` | 40 | 4 |
| `.github/instructions/mcp.instructions.md` | 40 | 2 |
| `CLAUDE.md` | 28 | 5 |

## Topic Coverage

### Prohibited Actions

**Covered in 16 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L3, L80, L320, L345, L419
  - Excerpts:
    - "**🔴 NEVER:** `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`"
    - "**Do NOT assume team names.** If the API returns an error like "Access denied" or "Team not found" w..."
    - "3. **Do NOT proceed if data didn't persist** - The tool `spectree__set_execution_metadata` now valid..."
- **`.github/agents/feature-worker.md`**
  - Lines: L28, L38, L185, L203, L219
  - Excerpts:
    - "**NEVER run these commands. They DESTROY all data:**"
    - "If a task requires schema changes, use `npx prisma db push` and `npx prisma generate`. NEVER use `pr..."
    - "4. **If any task was NOT performed** (e.g., skipped, deferred, blocked), leave it in its current sta..."
- **`.github/agents/orchestrator.md`**
  - Lines: L13, L21, L246, L373, L402
  - Excerpts:
    - "You execute SpecTree epics by reading execution plans and delegating feature implementation to featu..."
    - "**Ensure ALL feature-workers follow these rules. NEVER run:**"
    - "// Leave it as-is (Backlog) — NEVER mark unperformed work as Done"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L14, L48, L52-54, L59-60
  - Excerpts:
    - "You review SpecTree epics for implementation readiness. You evaluate whether an epic's description, ..."
    - "**Hard floor:** An epic whose Epic Description Score is below 80 is **never READY**, regardless of t..."
    - "1. **NEVER** modify the epic, features, or tasks — only report findings"
- **`.github/agents/planner.md`**
  - Lines: L90, L98, L186, L232, L357
  - Excerpts:
    - "| `structuredDesc.alternatives` | Approaches already considered & rejected — do NOT re-propose these..."
    - "When `--from-request` is active, the epic request data replaces the need for the user to explain wha..."
    - "- When `--from-request` is active: use the `proposedSolution` and `successMetrics` from the epic req..."
- **`.github/agents/request-formulator.md`**
  - Lines: L204-206
  - Excerpts:
    - "6. **DO NOT** include the 'agent' tool in your tools list — you cannot spawn sub-agents"
    - "7. **DO NOT** submit requests without user confirmation"
    - "8. **DO NOT** skip the duplicate check stage"
- **`.github/agents/reviewer.md`**
  - Lines: L79, L107, L161-162, L166-168
  - Excerpts:
    - "- Security concerns (injection, XSS, etc.)"
    - "- **Security:** No concerns / Concern in Y"
    - "1. **ALWAYS** read the structured description before reviewing — never review without knowing the re..."
- **`.github/instructions/agents.instructions.md`**
  - Lines: L27, L33
  - Excerpts:
    - "- The `planner` agent must NEVER have `agent` in its tools list — it must not spawn sub-agents (espe..."
    - "- 🔴 Database safety: NEVER `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`"
- **`.github/instructions/api.instructions.md`**
  - Lines: L33, L35, L42
  - Excerpts:
    - "- Use custom error classes from `src/errors/index.ts`: `ValidationError` (400), `NotFoundError` (404..."
    - "- Do NOT use raw `reply.status(xxx).send()` for error responses — throw the appropriate `AppError` s..."
    - "- Never bypass auth middleware — all routes handling user data must be authenticated"
- **`.github/instructions/database.instructions.md`**
  - Lines: L10, L38
  - Excerpts:
    - "## 🔴 Forbidden Commands"
    - "- Never run API tests from the project root — the root `vitest.config.ts` does NOT set `DATABASE_URL..."
- **`.github/instructions/frontend.instructions.md`**
  - Lines: L25, L39
  - Excerpts:
    - "- Do NOT mix — Zustand is for UI/client state, React Query for server data"
    - "- Do NOT call `fetch()` directly — use the API client layer"
- **`.github/instructions/mcp.instructions.md`**
  - Lines: L39
  - Excerpts:
    - "- Never expose internal server details or stack traces"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L152, L183, L218, L250, L313
  - Excerpts:
    - "| **Acceptance criteria quality** | 15 | Criteria are specific and verifiable — not vague ("works co..."
    - ""Non-admin users receive 403 Forbidden for scope != 'self'","
    - "| **Parallel safety** | 25 | Features in the same `parallelGroup` with `canParallelize=true` do not ..."
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L241, L269
  - Excerpts:
    - "**Review Gate:** Always present the quality score and any issues found. This gate is always interact..."
    - "**Review Gate:** Always present the execution plan. This gate is always interactive (never auto-appr..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L239
  - Excerpts:
    - "3. Do NOT mark the task as complete. Leave it in "In Progress" status."
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L265
  - Excerpts:
    - "5. **Fix before completing** - Never mark a task as done with failing validations. Fix the issues fi..."

### Tool Usage

**Covered in 14 file(s)**

- **`CLAUDE.md`**
  - Lines: L8, L22
  - Excerpts:
    - "- SpecTree MCP tool usage"
    - "- [MCP Tools Reference](./docs/mcp/tools-reference.md) — Complete MCP tools documentation"
- **`.github/copilot-instructions.md`**
  - Lines: L14-16, L21, L24-26, L29-32, L35
  - Excerpts:
    - "- [ ] `spectree__list_teams()` - Discover teams (don't assume names)"
    - "- [ ] `spectree__start_session({ epicId })` - Start session for existing epic"
    - "- [ ] `spectree__list_templates()` - Use templates for new epics"
- **`.github/agents/feature-worker.md`**
  - Lines: L42, L45-48, L51-52, L54, L62
  - Excerpts:
    - "You **MUST** call these SpecTree MCP tools during execution. These calls are **NOT optional**. If yo..."
    - "- `spectree__start_work` — before implementing (sets status to "In Progress")"
    - "- `spectree__link_code_file` — for EVERY file you create or modify"
- **`.github/agents/orchestrator.md`**
  - Lines: L17, L36, L38, L53, L67
  - Excerpts:
    - "Before doing anything, call `spectree__list_teams` to verify SpecTree MCP is connected. If this fail..."
    - "Call `spectree__get_execution_plan` for the specified epic:"
    - "spectree__get_execution_plan({ epicId: "<epic-id>" })"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L20, L34, L36-38
  - Excerpts:
    - "Before doing anything, call `spectree__list_teams` to verify SpecTree MCP is connected. If this fail..."
    - "1. **Load the epic** — `spectree__get_epic({ query: "<epic-id-or-name>" })`"
    - "3. **Evaluate each feature** — `spectree__get_feature` + `spectree__get_structured_description` for ..."
- **`.github/agents/planner.md`**
  - Lines: L17, L75-77, L80, L136-137, L156-157
  - Excerpts:
    - "Before doing anything, call `spectree__list_teams` to verify SpecTree MCP is connected. If this fail..."
    - "1. If the value looks like a UUID, call `spectree__get_epic_request({ id: "<uuid>" })` directly."
    - "2. If the value is a title, you MUST search across ALL statuses. Call `spectree__list_epic_requests(..."
- **`.github/agents/request-formulator.md`**
  - Lines: L18, L93, L143, L145
  - Excerpts:
    - "Before starting the interview, call `spectree__draft_epic_request` to verify SpecTree MCP is connect..."
    - "1. Call `spectree__list_epic_requests` to get all pending/approved requests"
    - "If the user approves, call `spectree__create_epic_request`:"
- **`.github/agents/reviewer.md`**
  - Lines: L16, L24, L26, L52, L54
  - Excerpts:
    - "Before doing anything, call `spectree__list_teams` to verify SpecTree MCP is connected. If this fail..."
    - "Call `spectree__get_structured_description` for the feature or task:"
    - "spectree__get_structured_description({"
- **`.github/instructions/agents.instructions.md`**
  - Lines: L25
  - Excerpts:
    - "- MCP tools require explicit `server-name/*` syntax (e.g., `spectree/*`)"
- **`.github/instructions/mcp.instructions.md`**
  - Lines: L13, L19
  - Excerpts:
    - "server.registerTool("spectree__<action_name>", {"
    - "- Tool names MUST use `spectree__` prefix with double underscore"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L18, L29-30, L37, L43
  - Excerpts:
    - "spectree__get_epic({ query: "<epic-id-or-name>" })"
    - "spectree__get_feature({ id: "<identifier>" })"
    - "spectree__get_structured_description({ type: "feature", id: "<identifier>" })"
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L33, L47, L107, L129, L132
  - Excerpts:
    - "spectree__list_teams()"
    - "spectree__create_epic_complete({"
    - "Every task SHOULD have at least one validation check. Add validations using `spectree__add_validatio..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L12, L23, L40, L53, L65
  - Excerpts:
    - "spectree__start_work({"
    - "spectree__get_ai_context({"
    - "spectree__get_progress_summary({"
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L25, L36, L46, L57, L67
  - Excerpts:
    - "spectree__add_validation({"
    - "spectree__add_validation({"
    - "spectree__add_validation({"

### Validation

**Covered in 13 file(s)**

- **`CLAUDE.md`**
  - Lines: L12
  - Excerpts:
    - "- Testing and validation requirements"
- **`.github/copilot-instructions.md`**
  - Lines: L24, L161, L171, L525, L527
  - Excerpts:
    - "- [ ] `spectree__run_all_validations()` - Verify acceptance criteria"
    - "- `spectree__get_structured_description({ id, type })` — read acceptance criteria"
    - "- `spectree__run_all_validations({ taskId })` — verify acceptance criteria"
- **`.github/agents/feature-worker.md`**
  - Lines: L4, L19, L48, L54, L117
  - Excerpts:
    - "full context from the orchestrator including requirements, acceptance criteria,"
    - "- **Structured descriptions** — summary, AI instructions, acceptance criteria, files involved"
    - "- `spectree__complete_task_with_validation` — when done (validates + sets status to "Done")"
- **`.github/agents/orchestrator.md`**
  - Lines: L90, L334, L364-365, L368
  - Excerpts:
    - "// Get structured description (requirements, acceptance criteria, AI instructions)"
    - "## Acceptance Criteria"
    - "- spectree__run_all_validations - Verify your work"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L5, L57
  - Excerpts:
    - "acceptance criteria, AI instructions, and execution plans against quality standards."
    - "6. **ALWAYS** check acceptance criteria for specificity — "works correctly" is not an acceptance cri..."
- **`.github/agents/planner.md`**
  - Lines: L92, L249, L336-337, L403, L488
  - Excerpts:
    - "| `structuredDesc.successMetrics` | Seed for acceptance criteria |"
    - "description: "Feature description with acceptance criteria","
    - "- **Features:** At least 3 acceptance criteria each"
- **`.github/agents/reviewer.md`**
  - Lines: L3-4, L12, L34, L38, L40
  - Excerpts:
    - "description: "Reviews completed features against their SpecTree acceptance criteria."
    - "Runs validations, checks code quality, and verifies requirements are met."
    - "You review completed work against acceptance criteria stored in SpecTree. You verify that implementa..."
- **`.github/instructions/api.instructions.md`**
  - Lines: L12, L29, L33, L40, L44
  - Excerpts:
    - "- `src/schemas/{domain}.ts` — Zod schemas for request/response validation"
    - "- `validateBody(schema)` or `validateParams(schema)` — Zod validation"
    - "- Use custom error classes from `src/errors/index.ts`: `ValidationError` (400), `NotFoundError` (404..."
- **`.github/instructions/database.instructions.md`**
  - Lines: L31
  - Excerpts:
    - "- SQLite has no native enums — use string fields with application-level validation"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L151-152, L175, L180, L196-197, L241
  - Excerpts:
    - "| **Acceptance criteria count** | 15 | Has >= 3 acceptance criteria |"
    - "| **Acceptance criteria quality** | 15 | Criteria are specific and verifiable — not vague ("works co..."
    - "**Bad acceptance criteria (0 points):**"
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L105, L107, L109, L117, L125
  - Excerpts:
    - "#### Validation Rules"
    - "Every task SHOULD have at least one validation check. Add validations using `spectree__add_validatio..."
    - "| Validation Type | When to Use | Example |"
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L71, L95, L106, L108, L174
  - Excerpts:
    - "This gives you the AI instructions, acceptance criteria, files involved, and technical notes you nee..."
    - "- When reaching a milestone in the acceptance criteria"
    - "question: "Which validation library to use for request bodies?","
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L1, L3, L5, L7, L19
  - Excerpts:
    - "# SpecTree Validation Procedures"
    - "This skill defines how to run, interpret, and act on SpecTree validation checks. Validations are exe..."
    - "## Validation Types"

### Workflow Guidance

**Covered in 12 file(s)**

- **`CLAUDE.md`**
  - Lines: L10-11
  - Excerpts:
    - "- Git workflow (release flow strategy)"
    - "- Implementation planning guidelines"
- **`.github/copilot-instructions.md`**
  - Lines: L40, L42, L52, L467, L656
  - Excerpts:
    - "## 🔴 CRITICAL: Use SpecTree for Implementation Planning"
    - "**When SpecTree MCP tools are available, ALWAYS use SpecTree for implementation planning instead of ..."
    - "### Planning Workflow"
- **`.github/agents/feature-worker.md`**
  - Lines: L12, L18, L56, L58, L147
  - Excerpts:
    - "You implement a single SpecTree feature by completing all its tasks in execution order. You are spaw..."
    - "- **Task list** with execution ordering"
    - "## Per-Task Workflow"
- **`.github/agents/orchestrator.md`**
  - Lines: L32
  - Excerpts:
    - "## Execution Workflow"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L30
  - Excerpts:
    - "## Review Workflow"
- **`.github/agents/planner.md`**
  - Lines: L19, L82, L183, L390, L393
  - Excerpts:
    - "> **Note:** For database safety rules, execution guidelines, and comprehensive tool usage patterns, ..."
    - "**Field mapping — how epic request data feeds the planning pipeline:**"
    - "- Set execution ordering: which features must come first?"
- **`.github/agents/request-formulator.md`**
  - Lines: L22, L51
  - Excerpts:
    - "## Interview Workflow"
    - "- How will this improve the system/product/workflow?"
- **`.github/agents/reviewer.md`**
  - Lines: L20, L129
  - Excerpts:
    - "## Review Workflow"
    - "2. For each completed feature, run the full review workflow above"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L7, L216, L222, L295
  - Excerpts:
    - "- After the planner creates an epic (Stage 6 of the planning pipeline)"
    - "| **Execution order set** | 25 | Every feature has a non-null `executionOrder` |"
    - "- **Missing explicit dependencies:** Features are ordered correctly by `executionOrder` but have `de..."
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L1, L257, L269, L317
  - Excerpts:
    - "# SpecTree Planning Procedure"
    - "- **Phase ordering:** Earlier phases contain features with lower execution orders"
    - "**Review Gate:** Always present the execution plan. This gate is always interactive (never auto-appr..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L3
  - Excerpts:
    - "This skill defines the protocol for managing SpecTree-integrated AI sessions. Every AI session worki..."
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L179, L261
  - Excerpts:
    - "## Completing with Validation (Atomic Workflow)"
    - "1. **Add validations early** - Define validation checks when detailing the task (Stage 3 of planning..."

### Structured Descriptions

**Covered in 12 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L35, L38, L145-146, L174, L179
  - Excerpts:
    - "- [ ] `spectree__update_epic()` - Append execution summary to epic description (phase results, metri..."
    - "- [ ] `spectree__end_session()` with summary + nextSteps"
    - "summary: "Add database tables for activity tracking","
- **`.github/agents/feature-worker.md`**
  - Lines: L19, L141, L169, L204, L206
  - Excerpts:
    - "- **Structured descriptions** — summary, AI instructions, acceptance criteria, files involved"
    - "summary: "Implemented GET and PUT endpoints for user preferences with Zod validation""
    - "summary: "Implemented all 3 tasks: API routes, database model, frontend page. All tests passing.""
- **`.github/agents/orchestrator.md`**
  - Lines: L90, L119, L132, L139, L146
  - Excerpts:
    - "// Get structured description (requirements, acceptance criteria, AI instructions)"
    - "✅ Feature-worker completed <identifier>: <brief result summary>"
    - "content: "Completed by orchestrator phase execution. Feature-worker output: <summary from sub-agent ..."
- **`.github/agents/plan-reviewer.md`**
  - Lines: L4, L14, L53
  - Excerpts:
    - "before implementation begins. Evaluates epic descriptions, structured descriptions,"
    - "You review SpecTree epics for implementation readiness. You evaluate whether an epic's description, ..."
    - "2. **ALWAYS** read every structured description — never skip items"
- **`.github/agents/planner.md`**
  - Lines: L26, L39, L78, L98, L105
  - Excerpts:
    - "Stage 3: DETAIL    → Set structured descriptions for every item"
    - "| **auto** (default) | Proceed to next stage without pausing. Output a brief summary but don't wait...."
    - "4. **IMPORTANT:** Once the epic request is resolved, print its title, status, and a summary of its s..."
- **`.github/agents/request-formulator.md`**
  - Lines: L101
  - Excerpts:
    - "Problem: "Brief summary of the existing problem statement""
- **`.github/agents/reviewer.md`**
  - Lines: L33, L40, L115, L124, L126
  - Excerpts:
    - "- **Summary** — what was supposed to be built"
    - "List all acceptance criteria from the structured description. Each criterion becomes a line item in ..."
    - "{Summary of key findings and required changes}"
- **`.github/instructions/agents.instructions.md`**
  - Lines: L35, L37
  - Excerpts:
    - "- 🔴 Structured descriptions required for ALL features and ALL tasks"
    - "- 🔴 Epic execution summary must be appended after completion"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L149-150, L155, L194-195, L203, L261
  - Excerpts:
    - "| **Structured description exists** | 15 | Has a structured description with non-empty `summary` |"
    - "| **AI instructions present** | 20 | Has non-empty `aiInstructions` with step-by-step guidance. Must..."
    - "| **Risk and effort assessed** | 10 | Has `riskLevel` and `estimatedEffort` in structured descriptio..."
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L50, L99-100, L125, L136-138, L169
  - Excerpts:
    - "description: "Brief summary of what this epic accomplishes","
    - "- [ ] `aiInstructions` for every feature and task are detailed enough for an AI agent to implement *..."
    - "- [ ] `acceptanceCriteria` are specific, measurable conditions that can be verified — not vague ("wo..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L30, L40, L53, L62, L174
  - Excerpts:
    - "- **previousSession.summary** - What was accomplished last time"
    - "spectree__get_progress_summary({"
    - "spectree__get_blocked_summary({"
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L186, L191, L263
  - Excerpts:
    - "summary: "Implemented user preferences API with GET/PUT endpoints, Zod validation, and Prisma querie..."
    - "- If all validations pass: task is marked "Done" with the provided summary"
    - "3. **Match acceptance criteria** - Each acceptance criterion in the structured description should ma..."

### Database Safety

**Covered in 10 file(s)**

- **`CLAUDE.md`**
  - Lines: L9, L21
  - Excerpts:
    - "- Database safety rules"
    - "- [Database Safety Guide](./docs/database-safety-guide.md) — Critical database operation rules"
- **`.github/copilot-instructions.md`**
  - Lines: L3, L415, L420-422, L428
  - Excerpts:
    - "**🔴 NEVER:** `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`"
    - "## 🔴 CRITICAL: Database Safety"
    - "- `npx prisma migrate reset` - Deletes all data"
- **`.github/agents/feature-worker.md`**
  - Lines: L26, L29-31, L34, L36, L38
  - Excerpts:
    - "## 🔴 DATABASE SAFETY — ABSOLUTE RULES"
    - "- ❌ `prisma migrate dev` — wipes and recreates the database"
    - "- ❌ `prisma migrate reset` — deletes all data"
- **`.github/agents/orchestrator.md`**
  - Lines: L19, L22-24, L26-27
  - Excerpts:
    - "## 🔴 DATABASE SAFETY — ABSOLUTE RULES"
    - "- ❌ `prisma migrate dev` — wipes and recreates the database"
    - "- ❌ `prisma migrate reset` — deletes all data"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L22
  - Excerpts:
    - "> **Note:** For database safety rules, execution guidelines, and comprehensive tool usage patterns, ..."
- **`.github/agents/planner.md`**
  - Lines: L19
  - Excerpts:
    - "> **Note:** For database safety rules, execution guidelines, and comprehensive tool usage patterns, ..."
- **`.github/agents/request-formulator.md`**
  - Lines: L20
  - Excerpts:
    - "> **Note:** For database safety rules, execution guidelines, and comprehensive tool usage patterns, ..."
- **`.github/agents/reviewer.md`**
  - Lines: L18
  - Excerpts:
    - "> **Note:** For database safety rules, execution guidelines, and comprehensive tool usage patterns, ..."
- **`.github/instructions/agents.instructions.md`**
  - Lines: L33
  - Excerpts:
    - "- 🔴 Database safety: NEVER `prisma migrate reset`, `prisma migrate dev`, `db push --force-reset`"
- **`.github/instructions/database.instructions.md`**
  - Lines: L13-15, L17
  - Excerpts:
    - "- `prisma migrate reset` — deletes all data"
    - "- `prisma migrate dev` — may require destructive reset"
    - "- `prisma db push --force-reset` — deletes all data"

### Agent-Specific

**Covered in 9 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L181, L738, L743-747, L750, L752
  - Excerpts:
    - "After completing execution of an epic (all phases done), you MUST update the epic's description with..."
    - "### @planner - SpecTree Planning Pipeline"
    - "Usage: @planner "Build a user activity dashboard""
- **`.github/agents/feature-worker.md`**
  - Lines: L2, L4-5, L10, L12, L16
  - Excerpts:
    - "name: Feature Worker"
    - "full context from the orchestrator including requirements, acceptance criteria,"
    - "and code context. NOT user-invokable - only spawned as a sub-agent by the orchestrator.""
- **`.github/agents/orchestrator.md`**
  - Lines: L2, L7, L11, L61, L71
  - Excerpts:
    - "name: SpecTree Orchestrator"
    - "agents: ['feature-worker', 'reviewer']"
    - "# SpecTree Orchestrator Agent"
- **`.github/agents/plan-reviewer.md`**
  - Lines: L2, L12, L26-27
  - Excerpts:
    - "name: Plan Reviewer"
    - "# SpecTree Plan Reviewer Agent"
    - "- **Automatically after the planner completes Stage 5** — the planner invokes you as Stage 6"
- **`.github/agents/planner.md`**
  - Lines: L2, L11, L49, L53, L57
  - Excerpts:
    - "name: SpecTree Planner"
    - "# SpecTree Planner Agent"
    - "@planner "Build a user preferences API""
- **`.github/agents/reviewer.md`**
  - Lines: L2, L10
  - Excerpts:
    - "name: SpecTree Reviewer"
    - "# SpecTree Reviewer Agent"
- **`.github/instructions/agents.instructions.md`**
  - Lines: L27-28
  - Excerpts:
    - "- The `planner` agent must NEVER have `agent` in its tools list — it must not spawn sub-agents (espe..."
    - "- The `feature-worker` must have `user-invokable: false` — it's only spawned by the orchestrator"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L3, L7-8, L319
  - Excerpts:
    - "This skill defines the quality rubrics, scoring methodology, and review process for evaluating SpecT..."
    - "- After the planner creates an epic (Stage 6 of the planning pipeline)"
    - "- Before invoking `@orchestrator` to execute an epic"
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L13, L295
  - Excerpts:
    - "- Identify which packages are affected (`packages/api`, `packages/web`, `packages/orchestrator`, `pa..."
    - "2. **Concrete file references** — "Modify the API client" is bad. "Modify `packages/orchestrator/src..."

### Code Context

**Covered in 8 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L25, L29, L167, L172, L507
  - Excerpts:
    - "- [ ] `spectree__link_code_file()` - Link modified files"
    - "- [ ] `spectree__link_code_file()` - For EVERY file created or modified"
    - "- `spectree__link_code_file({ id, type, filePath })` — for EVERY file touched"
- **`.github/agents/feature-worker.md`**
  - Lines: L5, L19, L21, L46, L89
  - Excerpts:
    - "and code context. NOT user-invokable - only spawned as a sub-agent by the orchestrator.""
    - "- **Structured descriptions** — summary, AI instructions, acceptance criteria, files involved"
    - "- **Code context** — previously linked files"
- **`.github/agents/orchestrator.md`**
  - Lines: L343, L352-353, L363, L369
  - Excerpts:
    - "## Files Involved"
    - "## Code Context"
    - "{from spectree__get_code_context, or "No code context yet" if empty}"
- **`.github/agents/planner.md`**
  - Lines: L339, L404, L441
  - Excerpts:
    - "- **Files Involved:** At least 1 file per task. Use full relative paths from the repo root."
    - "| Files involved listed | 25 | At least 1 file per task with full relative paths |"
    - "Detail Score:     85/100  (3 issues: Tasks 2.1, 4.3 missing files involved; Task 5.2 has 1 acceptanc..."
- **`.github/agents/reviewer.md`**
  - Lines: L35, L168
  - Excerpts:
    - "- **Files involved** — where to look for the implementation"
    - "8. **NEVER** assume a task was completed just because its status is Done — verify against AI notes, ..."
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L153, L198
  - Excerpts:
    - "| **Files involved listed** | 10 | Has >= 1 file in `filesInvolved` with full relative paths from re..."
    - "| **Files involved listed** | 15 | Has >= 1 file in `filesInvolved` with full relative paths. Paths ..."
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L125, L217, L292, L307
  - Excerpts:
    - "**Goal:** Enrich every feature and task with structured descriptions containing AI instructions, acc..."
    - "| Files involved listed | At least 1 file per task | Identify target files |"
    - "Each task MUST be **self-contained** — an AI agent should be able to complete it with only the infor..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L71, L126
  - Excerpts:
    - "This gives you the AI instructions, acceptance criteria, files involved, and technical notes you nee..."
    - "spectree__link_code_file({"

### Session Management

**Covered in 6 file(s)**

- **`CLAUDE.md`**
  - Lines: L13
  - Excerpts:
    - "- Session handoff and context management"
- **`.github/copilot-instructions.md`**
  - Lines: L15, L38, L62-63, L361, L363
  - Excerpts:
    - "- [ ] `spectree__start_session({ epicId })` - Start session for existing epic"
    - "- [ ] `spectree__end_session()` with summary + nextSteps"
    - "spectree__start_session({ epicId: "Epic Name" })"
- **`.github/agents/orchestrator.md`**
  - Lines: L53, L55, L204, L210, L267
  - Excerpts:
    - "spectree__start_session({ epicId: "<epic-id>" })"
    - "Review any previous session handoff data returned and use it for context."
    - "// d) Check if AI notes are empty — if so, add a fallback note"
- **`.github/agents/reviewer.md`**
  - Lines: L142, L152, L168
  - Excerpts:
    - "- **Tasks marked Done that have no AI notes or progress logged** — suspicious, may indicate bulk sta..."
    - "| ENG-43-5 | Marked Done but AI notes say "skipped" | Revert to Backlog |"
    - "8. **NEVER** assume a task was completed just because its status is Done — verify against AI notes, ..."
- **`.github/instructions/database.instructions.md`**
  - Lines: L21
  - Excerpts:
    - "- **SQL Server fields:** All JSON and long-text `String` fields MUST use `@db.NVarChar(Max)`. Prisma..."
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L20
  - Excerpts:
    - "### 2. Check Previous Session Context"

### Progress Tracking

**Covered in 5 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L31, L160, L165, L174, L477
  - Excerpts:
    - "- [ ] `spectree__log_progress()` - At every significant milestone"
    - "- `spectree__start_work({ id, type })` — mark item in-progress"
    - "- `spectree__log_progress({ id, type, message, percentComplete })` — at milestones"
- **`.github/agents/feature-worker.md`**
  - Lines: L45, L47, L62, L64, L100
  - Excerpts:
    - "- `spectree__start_work` — before implementing (sets status to "In Progress")"
    - "- `spectree__log_progress` — after each significant step"
    - "Call `spectree__start_work` to mark the task as in progress:"
- **`.github/agents/orchestrator.md`**
  - Lines: L105, L143, L185, L244, L251
  - Excerpts:
    - "spectree__start_work({ type: "feature", id: "<feature-identifier>" })"
    - "spectree__complete_work({"
    - "spectree__complete_work({"
- **`.github/skills/spectree-session/SKILL.md`**
  - Lines: L12, L84, L171, L178, L185
  - Excerpts:
    - "spectree__start_work({"
    - "spectree__log_progress({"
    - "spectree__complete_work({"
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L194, L201-202
  - Excerpts:
    - "This is safer than calling `complete_work` directly because it prevents marking tasks as done when a..."
    - "| `complete_work` | Only when there are no automated validation checks (e.g., tasks with only manual..."
    - "| `run_all_validations` then `complete_work` | When you want to inspect results before completing (e..."

### Epic Creation

**Covered in 5 file(s)**

- **`.github/copilot-instructions.md`**
  - Lines: L84, L110, L209, L319, L332
  - Excerpts:
    - "🔴 **IMPORTANT:** You MUST use templates when creating epics. Templates ensure proper structure with..."
    - "**Step 5: Create features with execution metadata**"
    - "**1. Create features with execution metadata:**"
- **`.github/agents/planner.md`**
  - Lines: L188, L242, L274
  - Excerpts:
    - "3. Create the epic atomically using `spectree__create_epic_complete`:"
    - "spectree__create_epic_complete({"
    - "4. After creation, set execution metadata for features that need it:"
- **`.github/agents/request-formulator.md`**
  - Lines: L143, L145
  - Excerpts:
    - "If the user approves, call `spectree__create_epic_request`:"
    - "spectree__create_epic_request({"
- **`.github/skills/spectree-plan-review/SKILL.md`**
  - Lines: L154
  - Excerpts:
    - "| **Execution metadata set** | 15 | Has `executionOrder` (non-null), `estimatedComplexity` (non-null..."
- **`.github/skills/spectree-planning/SKILL.md`**
  - Lines: L47
  - Excerpts:
    - "spectree__create_epic_complete({"

### Best Practices

**Covered in 2 file(s)**

- **`.github/agents/feature-worker.md`**
  - Lines: L40
  - Excerpts:
    - "## 🔴 CRITICAL REQUIREMENTS"
- **`.github/skills/spectree-validation/SKILL.md`**
  - Lines: L259
  - Excerpts:
    - "## Best Practices"

## Overlaps (Topics in Multiple Files)

### Prohibited Actions

Appears in **16** files:

- `.github/copilot-instructions.md` (L3, L80, L320, L345, L419)
- `.github/agents/feature-worker.md` (L28, L38, L185, L203, L219)
- `.github/agents/orchestrator.md` (L13, L21, L246, L373, L402)
- `.github/agents/plan-reviewer.md` (L14, L48, L52-54, L59-60)
- `.github/agents/planner.md` (L90, L98, L186, L232, L357)
- `.github/agents/request-formulator.md` (L204-206)
- `.github/agents/reviewer.md` (L79, L107, L161-162, L166-168)
- `.github/instructions/agents.instructions.md` (L27, L33)
- `.github/instructions/api.instructions.md` (L33, L35, L42)
- `.github/instructions/database.instructions.md` (L10, L38)
- `.github/instructions/frontend.instructions.md` (L25, L39)
- `.github/instructions/mcp.instructions.md` (L39)
- `.github/skills/spectree-plan-review/SKILL.md` (L152, L183, L218, L250, L313)
- `.github/skills/spectree-planning/SKILL.md` (L241, L269)
- `.github/skills/spectree-session/SKILL.md` (L239)
- `.github/skills/spectree-validation/SKILL.md` (L265)

### Tool Usage

Appears in **14** files:

- `CLAUDE.md` (L8, L22)
- `.github/copilot-instructions.md` (L14-16, L21, L24-26, L29-32, L35)
- `.github/agents/feature-worker.md` (L42, L45-48, L51-52, L54, L62)
- `.github/agents/orchestrator.md` (L17, L36, L38, L53, L67)
- `.github/agents/plan-reviewer.md` (L20, L34, L36-38)
- `.github/agents/planner.md` (L17, L75-77, L80, L136-137, L156-157)
- `.github/agents/request-formulator.md` (L18, L93, L143, L145)
- `.github/agents/reviewer.md` (L16, L24, L26, L52, L54)
- `.github/instructions/agents.instructions.md` (L25)
- `.github/instructions/mcp.instructions.md` (L13, L19)
- `.github/skills/spectree-plan-review/SKILL.md` (L18, L29-30, L37, L43)
- `.github/skills/spectree-planning/SKILL.md` (L33, L47, L107, L129, L132)
- `.github/skills/spectree-session/SKILL.md` (L12, L23, L40, L53, L65)
- `.github/skills/spectree-validation/SKILL.md` (L25, L36, L46, L57, L67)

### Validation

Appears in **13** files:

- `CLAUDE.md` (L12)
- `.github/copilot-instructions.md` (L24, L161, L171, L525, L527)
- `.github/agents/feature-worker.md` (L4, L19, L48, L54, L117)
- `.github/agents/orchestrator.md` (L90, L334, L364-365, L368)
- `.github/agents/plan-reviewer.md` (L5, L57)
- `.github/agents/planner.md` (L92, L249, L336-337, L403, L488)
- `.github/agents/reviewer.md` (L3-4, L12, L34, L38, L40)
- `.github/instructions/api.instructions.md` (L12, L29, L33, L40, L44)
- `.github/instructions/database.instructions.md` (L31)
- `.github/skills/spectree-plan-review/SKILL.md` (L151-152, L175, L180, L196-197, L241)
- `.github/skills/spectree-planning/SKILL.md` (L105, L107, L109, L117, L125)
- `.github/skills/spectree-session/SKILL.md` (L71, L95, L106, L108, L174)
- `.github/skills/spectree-validation/SKILL.md` (L1, L3, L5, L7, L19)

### Workflow Guidance

Appears in **12** files:

- `CLAUDE.md` (L10-11)
- `.github/copilot-instructions.md` (L40, L42, L52, L467, L656)
- `.github/agents/feature-worker.md` (L12, L18, L56, L58, L147)
- `.github/agents/orchestrator.md` (L32)
- `.github/agents/plan-reviewer.md` (L30)
- `.github/agents/planner.md` (L19, L82, L183, L390, L393)
- `.github/agents/request-formulator.md` (L22, L51)
- `.github/agents/reviewer.md` (L20, L129)
- `.github/skills/spectree-plan-review/SKILL.md` (L7, L216, L222, L295)
- `.github/skills/spectree-planning/SKILL.md` (L1, L257, L269, L317)
- `.github/skills/spectree-session/SKILL.md` (L3)
- `.github/skills/spectree-validation/SKILL.md` (L179, L261)

### Structured Descriptions

Appears in **12** files:

- `.github/copilot-instructions.md` (L35, L38, L145-146, L174, L179)
- `.github/agents/feature-worker.md` (L19, L141, L169, L204, L206)
- `.github/agents/orchestrator.md` (L90, L119, L132, L139, L146)
- `.github/agents/plan-reviewer.md` (L4, L14, L53)
- `.github/agents/planner.md` (L26, L39, L78, L98, L105)
- `.github/agents/request-formulator.md` (L101)
- `.github/agents/reviewer.md` (L33, L40, L115, L124, L126)
- `.github/instructions/agents.instructions.md` (L35, L37)
- `.github/skills/spectree-plan-review/SKILL.md` (L149-150, L155, L194-195, L203, L261)
- `.github/skills/spectree-planning/SKILL.md` (L50, L99-100, L125, L136-138, L169)
- `.github/skills/spectree-session/SKILL.md` (L30, L40, L53, L62, L174)
- `.github/skills/spectree-validation/SKILL.md` (L186, L191, L263)

### Database Safety

Appears in **10** files:

- `CLAUDE.md` (L9, L21)
- `.github/copilot-instructions.md` (L3, L415, L420-422, L428)
- `.github/agents/feature-worker.md` (L26, L29-31, L34, L36, L38)
- `.github/agents/orchestrator.md` (L19, L22-24, L26-27)
- `.github/agents/plan-reviewer.md` (L22)
- `.github/agents/planner.md` (L19)
- `.github/agents/request-formulator.md` (L20)
- `.github/agents/reviewer.md` (L18)
- `.github/instructions/agents.instructions.md` (L33)
- `.github/instructions/database.instructions.md` (L13-15, L17)

### Agent-Specific

Appears in **9** files:

- `.github/copilot-instructions.md` (L181, L738, L743-747, L750, L752)
- `.github/agents/feature-worker.md` (L2, L4-5, L10, L12, L16)
- `.github/agents/orchestrator.md` (L2, L7, L11, L61, L71)
- `.github/agents/plan-reviewer.md` (L2, L12, L26-27)
- `.github/agents/planner.md` (L2, L11, L49, L53, L57)
- `.github/agents/reviewer.md` (L2, L10)
- `.github/instructions/agents.instructions.md` (L27-28)
- `.github/skills/spectree-plan-review/SKILL.md` (L3, L7-8, L319)
- `.github/skills/spectree-planning/SKILL.md` (L13, L295)

### Code Context

Appears in **8** files:

- `.github/copilot-instructions.md` (L25, L29, L167, L172, L507)
- `.github/agents/feature-worker.md` (L5, L19, L21, L46, L89)
- `.github/agents/orchestrator.md` (L343, L352-353, L363, L369)
- `.github/agents/planner.md` (L339, L404, L441)
- `.github/agents/reviewer.md` (L35, L168)
- `.github/skills/spectree-plan-review/SKILL.md` (L153, L198)
- `.github/skills/spectree-planning/SKILL.md` (L125, L217, L292, L307)
- `.github/skills/spectree-session/SKILL.md` (L71, L126)

### Session Management

Appears in **6** files:

- `CLAUDE.md` (L13)
- `.github/copilot-instructions.md` (L15, L38, L62-63, L361, L363)
- `.github/agents/orchestrator.md` (L53, L55, L204, L210, L267)
- `.github/agents/reviewer.md` (L142, L152, L168)
- `.github/instructions/database.instructions.md` (L21)
- `.github/skills/spectree-session/SKILL.md` (L20)

### Progress Tracking

Appears in **5** files:

- `.github/copilot-instructions.md` (L31, L160, L165, L174, L477)
- `.github/agents/feature-worker.md` (L45, L47, L62, L64, L100)
- `.github/agents/orchestrator.md` (L105, L143, L185, L244, L251)
- `.github/skills/spectree-session/SKILL.md` (L12, L84, L171, L178, L185)
- `.github/skills/spectree-validation/SKILL.md` (L194, L201-202)

### Epic Creation

Appears in **5** files:

- `.github/copilot-instructions.md` (L84, L110, L209, L319, L332)
- `.github/agents/planner.md` (L188, L242, L274)
- `.github/agents/request-formulator.md` (L143, L145)
- `.github/skills/spectree-plan-review/SKILL.md` (L154)
- `.github/skills/spectree-planning/SKILL.md` (L47)

### Best Practices

Appears in **2** files:

- `.github/agents/feature-worker.md` (L40)
- `.github/skills/spectree-validation/SKILL.md` (L259)

## Contradictions

### 🔴 Database Safety (high severity)

**File 1:** `CLAUDE.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `CLAUDE.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `CLAUDE.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/orchestrator.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/plan-reviewer.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/planner.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/request-formulator.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/reviewer.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/copilot-instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/instructions/database.instructions.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/orchestrator.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/plan-reviewer.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/planner.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/request-formulator.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/agents/reviewer.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/feature-worker.md`
- Prohibits prisma migrate dev

**File 2:** `.github/instructions/database.instructions.md`
- Does not prohibit prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/orchestrator.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/plan-reviewer.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/planner.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/request-formulator.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/agents/reviewer.md`
- Does not prohibit prisma migrate dev

**File 2:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

### 🔴 Database Safety (high severity)

**File 1:** `.github/instructions/agents.instructions.md`
- Prohibits prisma migrate dev

**File 2:** `.github/instructions/database.instructions.md`
- Does not prohibit prisma migrate dev

## Recommendations

1. **Consolidation Priority:**
   - Focus on topics with highest overlap (Prohibited Actions)
   - Address high-severity contradictions first

2. **Line Count Target:**
   - Current total: 3,960 lines
   - Target: < 2000 lines in copilot-instructions.md
   - Reduction needed: 1,960 lines

3. **Deduplication Opportunities:**
   - Prohibited Actions: consolidate from 16 files into 1
   - Tool Usage: consolidate from 14 files into 1
   - Validation: consolidate from 13 files into 1
   - Workflow Guidance: consolidate from 12 files into 1
   - Structured Descriptions: consolidate from 12 files into 1

4. **Agent-Specific Instructions:**
   - Move agent-specific content to .github/agents/
   - Keep core patterns in copilot-instructions.md
   - Use references instead of duplication

