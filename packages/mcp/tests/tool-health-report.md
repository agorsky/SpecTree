# MCP Tool Health Report (ENG-78)

**Generated:** 2026-02-27
**Package:** `@dispatcher/mcp` v0.2.3
**Branch:** `feat/eng-75-80-pre-release-hardening`
**Test file:** `packages/mcp/tests/tool-smoke.test.ts`

---

## Summary

| Metric | Count |
|---|---|
| **Total tools registered** | 116 |
| **Active tools** | 86 |
| **Deprecated tools** | 30 |
| **Source modules** | 33 |
| **Source files** | 31 |
| **Smoke tests passing** | 154 / 154 |

---

## Module Breakdown

| Module | Total | Active | Deprecated |
|---|---|---|---|
| help | 1 | 1 | 0 |
| composite | 2 | 2 | 0 |
| ai-context | 4 | 1 | 3 |
| changelog | 1 | 1 | 0 |
| code-context | 8 | 1 | 7 |
| decisions | 4 | 4 | 0 |
| epics | 4 | 4 | 0 |
| epic-requests | 11 | 11 | 0 |
| execution | 4 | 4 | 0 |
| features | 4 | 4 | 0 |
| ordering | 4 | 1 | 3 |
| personal | 5 | 5 | 0 |
| progress | 5 | 1 | 4 |
| search | 1 | 1 | 0 |
| statuses | 2 | 2 | 0 |
| structured-desc | 7 | 1 | 6 |
| summary | 3 | 3 | 0 |
| tasks | 4 | 4 | 0 |
| teams | 1 | 1 | 0 |
| templates | 5 | 5 | 0 |
| sessions | 5 | 5 | 0 |
| validations | 8 | 1 | 7 |
| laws | 4 | 4 | 0 |
| cases | 6 | 6 | 0 |
| agent-scores | 3 | 3 | 0 |
| codebase | 2 | 2 | 0 |
| patterns | 1 | 1 | 0 |
| effort | 1 | 1 | 0 |
| workflow | 2 | 2 | 0 |
| memory-patterns | 1 | 1 | 0 |
| skill-packs/manage | 1 | 1 | 0 |
| skill-packs/get-manifest | 1 | 1 | 0 |
| skill-packs/sync-local | 1 | 1 | 0 |

---

## Complete Tool Registry

### help.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_instructions` | Active | Get instructions and guidance for using SpecTree effectively |

### composite.ts (2 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__create_epic_complete` | Active | Create an epic with all features, tasks, and structured descriptions in a single atomic operation |
| `spectree__complete_task_with_validation` | Active | Run all validations for a task and mark it complete if all pass |

### ai-context.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_ai_context` | Active | Manage AI context and notes for features, tasks, and epics using a unified interface |
| `spectree__get_ai_context` | DEPRECATED | Use `spectree__manage_ai_context` with action='get_context' instead |
| `spectree__set_ai_context` | DEPRECATED | Use `spectree__manage_ai_context` with action='set_context' instead |
| `spectree__append_ai_note` | DEPRECATED | Use `spectree__manage_ai_context` with action='append_note' instead |

### changelog.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_changelog` | Active | Query entity change history with formatted output |

### code-context.ts (8 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_code_context` | Active | Manage code context for features and tasks (7 actions: get_context, link_file, unlink_file, link_function, link_branch, link_commit, link_pr) |
| `spectree__get_code_context` | DEPRECATED | Prefer `spectree__manage_code_context` with action='get_context' |
| `spectree__link_code_file` | DEPRECATED | Prefer `spectree__manage_code_context` with action='link_file' |
| `spectree__unlink_code_file` | DEPRECATED | Prefer `spectree__manage_code_context` with action='unlink_file' |
| `spectree__link_function` | DEPRECATED | Prefer `spectree__manage_code_context` with action='link_function' |
| `spectree__link_branch` | DEPRECATED | Prefer `spectree__manage_code_context` with action='link_branch' |
| `spectree__link_commit` | DEPRECATED | Prefer `spectree__manage_code_context` with action='link_commit' |
| `spectree__link_pr` | DEPRECATED | Prefer `spectree__manage_code_context` with action='link_pr' |

### decisions.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__log_decision` | Active | Record a decision with its rationale |
| `spectree__list_decisions` | Active | Get decisions for a specific context |
| `spectree__search_decisions` | Active | Find relevant decisions by searching question, decision, and rationale text |
| `spectree__get_decision_context` | Active | Get all decisions related to current work |

### epics.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_epics` | Active | List epics in the workspace with paginated results |
| `spectree__get_epic` | Active | Get detailed information about a specific epic by ID or name |
| `spectree__create_epic` | Active | Create a new epic (container for features) |
| `spectree__update_epic` | Active | Update an existing epic |

### epic-requests.ts (11 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__draft_epic_request` | Active | Get an empty template for creating an Epic Request with field descriptions |
| `spectree__create_epic_request` | Active | Create a new Epic Request (proposal for a new epic requiring approval) |
| `spectree__list_epic_requests` | Active | List all epic requests with cursor-based pagination and optional filtering |
| `spectree__get_epic_request` | Active | Get a single epic request by ID with full details |
| `spectree__update_epic_request` | Active | Update an existing epic request |
| `spectree__delete_epic_request` | Active | Delete an epic request |
| `spectree__react_to_epic_request` | Active | Add or update a reaction on an epic request |
| `spectree__comment_on_epic_request` | Active | Create a new comment on an epic request |
| `spectree__list_epic_request_comments` | Active | List all comments for an epic request |
| `spectree__transfer_epic_request_scope` | Active | Transfer an epic request between personal and team scope |
| `spectree__transfer_epic_scope` | Active | Transfer an epic between personal and team scope |

### execution.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_execution_plan` | Active | Get an ordered execution plan for features in an epic |
| `spectree__set_execution_metadata` | Active | Set execution metadata for a feature or task |
| `spectree__mark_blocked` | Active | Mark a feature or task as blocked by another item |
| `spectree__mark_unblocked` | Active | Remove a blocker from a feature or task |

### features.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_features` | Active | List features with optional filtering by epic, status, assignee |
| `spectree__get_feature` | Active | Get detailed information about a specific feature |
| `spectree__create_feature` | Active | Create a new feature in an epic |
| `spectree__update_feature` | Active | Update an existing feature |

### ordering.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__reorder_item` | Active | Reorder epics, features, or tasks using a unified interface |
| `spectree__reorder_epic` | DEPRECATED | Use `spectree__reorder_item` with action='reorder_epic' instead |
| `spectree__reorder_feature` | DEPRECATED | Use `spectree__reorder_item` with action='reorder_feature' instead |
| `spectree__reorder_task` | DEPRECATED | Use `spectree__reorder_item` with action='reorder_task' instead |

### personal.ts (5 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_personal_scope` | Active | Get the authenticated user's personal scope information |
| `spectree__list_personal_projects` | Active | List all projects in the authenticated user's personal scope |
| `spectree__create_personal_project` | Active | Create a new project in the authenticated user's personal scope |
| `spectree__list_personal_statuses` | Active | List all workflow statuses in the authenticated user's personal scope |
| `spectree__list_personal_epic_requests` | Active | List epic requests in the authenticated user's personal scope |

### progress.ts (5 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_progress` | Active | Manage progress tracking for features and tasks using a unified interface |
| `spectree__start_work` | DEPRECATED | Use `spectree__manage_progress` with action='start_work' instead |
| `spectree__complete_work` | DEPRECATED | Use `spectree__manage_progress` with action='complete_work' instead |
| `spectree__log_progress` | DEPRECATED | Use `spectree__manage_progress` with action='log_progress' instead |
| `spectree__report_blocker` | DEPRECATED | Use `spectree__manage_progress` with action='report_blocker' instead |

### search.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__search` | Active | Search for features and tasks with various filters |

### statuses.ts (2 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_statuses` | Active | List all workflow statuses for a team |
| `spectree__get_status` | Active | Get detailed information about a specific status |

### structured-desc.ts (7 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_description` | Active | Manage structured descriptions for features, tasks, and epics (6 actions) |
| `spectree__get_structured_description` | DEPRECATED | Use `spectree__manage_description` with action='get' instead |
| `spectree__set_structured_description` | DEPRECATED | Use `spectree__manage_description` with action='set' instead |
| `spectree__update_section` | DEPRECATED | Use `spectree__manage_description` with action='update_section' instead |
| `spectree__add_acceptance_criterion` | DEPRECATED | Use `spectree__manage_description` with action='add_criterion' instead |
| `spectree__link_file` | DEPRECATED | Use `spectree__manage_description` with action='link_file' instead |
| `spectree__add_external_link` | DEPRECATED | Use `spectree__manage_description` with action='add_link' instead |

### summary.ts (3 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_progress_summary` | Active | Get comprehensive progress summary for an epic |
| `spectree__get_my_work` | Active | Get all work items assigned to the current user/session |
| `spectree__get_blocked_summary` | Active | Get all blocked items across all accessible epics |

### tasks.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_tasks` | Active | List tasks with optional filtering by feature, status, or assignee |
| `spectree__get_task` | Active | Get detailed information about a specific task |
| `spectree__create_task` | Active | Create a new task under a feature |
| `spectree__update_task` | Active | Update an existing task |

### teams.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_teams` | Active | List teams the authenticated user has access to |

### templates.ts (5 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_templates` | Active | List all available plan templates |
| `spectree__get_template` | Active | Get detailed information about a specific template |
| `spectree__preview_template` | Active | Preview what will be created from a template without actually creating anything |
| `spectree__create_from_template` | Active | Create a complete epic with features and tasks from a template |
| `spectree__save_as_template` | Active | Save an existing epic's structure as a new reusable template |

### sessions.ts (5 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__start_session` | Active | Start a new AI session for an epic |
| `spectree__end_session` | Active | End the active AI session for an epic with handoff data |
| `spectree__get_active_session` | Active | Check if there is an active AI session for an epic |
| `spectree__get_last_session` | Active | Get the last completed session for an epic |
| `spectree__get_session_history` | Active | Get the history of AI sessions for an epic |

### validations.ts (8 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_validations` | Active | Manage validation checks for tasks (7 actions) |
| `spectree__add_validation` | DEPRECATED | Prefer `spectree__manage_validations` with action='add' |
| `spectree__list_validations` | DEPRECATED | Prefer `spectree__manage_validations` with action='list' |
| `spectree__run_validation` | DEPRECATED | Prefer `spectree__manage_validations` with action='run' |
| `spectree__run_all_validations` | DEPRECATED | Prefer `spectree__manage_validations` with action='run_all' |
| `spectree__mark_manual_validated` | DEPRECATED | Prefer `spectree__manage_validations` with action='mark_manual' |
| `spectree__remove_validation` | DEPRECATED | Prefer `spectree__manage_validations` with action='remove' |
| `spectree__reset_validations` | DEPRECATED | Prefer `spectree__manage_validations` with action='reset' |

### laws.ts (4 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_laws` | Active | List all laws in the registry |
| `spectree__get_law` | Active | Get a specific law by its ID or lawCode |
| `spectree__create_law` | Active | Create a new law in the registry |
| `spectree__update_law` | Active | Update an existing law |

### cases.ts (6 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_cases` | Active | List court cases filed against AI agents |
| `spectree__get_case` | Active | Get full details of a court case |
| `spectree__file_case` | Active | File a new court case against an AI agent for a law violation |
| `spectree__issue_verdict` | Active | Issue a verdict on a court case |
| `spectree__mark_case_corrected` | Active | Mark a case as corrected after remediation |
| `spectree__dismiss_case` | Active | Dismiss a court case |

### agent-scores.ts (3 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__list_agent_scores` | Active | Get the agent score leaderboard |
| `spectree__get_agent_score` | Active | Get the score details for a single agent by name |
| `spectree__adjust_agent_score` | Active | Manually adjust an agent's score |

### codebase.ts (2 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__scan_project_structure` | Active | Scan a project's directory structure, dependencies, database models, and recent git history |
| `spectree__analyze_file_impact` | Active | Analyze the impact of modifying specific files |

### patterns.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__detect_patterns` | Active | Detect codebase patterns and conventions by analyzing example files |

### effort.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__estimate_effort` | Active | Estimate the effort and complexity of a task based on file analysis |

### workflow.ts (2 tools)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_next_required_action` | Active | Analyze current work item state and suggest the next required action |
| `spectree__get_session_state` | Active | Get the current state of an AI session and allowed state transitions |

### memory-patterns.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_patterns` | Active | Manage reusable patterns and conventions in the pattern registry (5 actions: list, get, create, update, delete) |

### skill-packs/manage.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__manage_skill_packs` | Active | Manage Skill Packs with action-based routing (5 actions) |

### skill-packs/get-manifest.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__get_pack_manifest` | Active | Get the detailed manifest for a specific version of a skill pack |

### skill-packs/sync-local.ts (1 tool)

| Tool Name | Status | Description |
|---|---|---|
| `spectree__sync_local_packs` | Active | Detect drift between local skill pack installations and the registry |

---

## Tool Categories

### API-backed tools (use HTTP API client)
Most tools (107 of 116) communicate with the SpecTree backend via the HTTP API client. These require a running API server and valid auth token for live operation.

### Local filesystem tools (no API calls)
The following 6 tools operate on the local filesystem only and do not require API connectivity:
- `spectree__scan_project_structure` (codebase.ts)
- `spectree__analyze_file_impact` (codebase.ts)
- `spectree__detect_patterns` (patterns.ts)
- `spectree__estimate_effort` (effort.ts)
- `spectree__get_instructions` (help.ts)
- `spectree__sync_local_packs` (skill-packs/sync-local.ts)

### Composite tools (consolidated interfaces)
These 8 tools consolidate multiple deprecated tools into single action-based interfaces:
- `spectree__manage_ai_context` (replaces 3 deprecated tools)
- `spectree__manage_code_context` (replaces 7 deprecated tools)
- `spectree__manage_description` (replaces 6 deprecated tools)
- `spectree__manage_progress` (replaces 4 deprecated tools)
- `spectree__manage_validations` (replaces 7 deprecated tools)
- `spectree__manage_patterns` (5 actions, no deprecated predecessors)
- `spectree__manage_skill_packs` (5 actions, no deprecated predecessors)
- `spectree__reorder_item` (replaces 3 deprecated tools)

---

## Issues Found

### No critical issues detected

All 116 tools:
- Register successfully without errors
- Have non-empty descriptions
- Have defined input schemas
- Have handler functions

### Observations

1. **High deprecated tool count (30 tools, 26% of total):** The deprecated tools are maintained for backward compatibility but increase the tool surface area. Consider a deprecation removal timeline.

2. **Large tool surface area:** 116 total tools (86 active) is a substantial set. The composite tool pattern has helped reduce the effective tool count for new consumers, but the deprecated tools still appear in MCP introspection.

3. **Naming consistency:** All tools follow the `spectree__` prefix convention consistently. Composite tools use `manage_*` naming while CRUD tools use `list_*`, `get_*`, `create_*`, `update_*` patterns.

4. **epic-requests module is the largest:** With 11 tools, `epic-requests.ts` has the most tools. None are deprecated, suggesting this is a newer module that was designed with the current patterns from the start.

5. **No duplicate tool names detected:** All 116 tool names are unique. No naming conflicts.

---

## How to Run the Smoke Test

```bash
# Run registration tests only (no API needed)
cd packages/mcp
npx vitest run tests/tool-smoke.test.ts

# Run with HTTP smoke tests (requires API at localhost:3001)
SPECTREE_SMOKE_HTTP=1 npx vitest run tests/tool-smoke.test.ts

# Override API URL and auth token
SPECTREE_SMOKE_HTTP=1 \
  SPECTREE_API_URL=http://localhost:3001 \
  SPECTREE_AUTH_TOKEN=st_wShsQaYUgKEL9uJosNtLlLx2bqQe0t5tVCN9DxYWIVA \
  npx vitest run tests/tool-smoke.test.ts
```
