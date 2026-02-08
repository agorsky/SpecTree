# SpecTree Automation Tool — Agent Prompts Runbook

Epic ID: `88cec40c-0ab4-4a6e-afba-ac01f9113b30`

## Terminal Session Plan

```
Phase 1:  Terminal A → ENG-13                       (wait for Done)
Phase 2:  Terminal A → ENG-14  }
          Terminal B → ENG-15  } simultaneous        (wait for all Done)
          Terminal C → ENG-17  }
Phase 3:  Terminal A → ENG-16  }
          Terminal C → ENG-18  } simultaneous        (wait for both Done)
Phase 4:  Terminal A → ENG-20  }  start immediately after Phase 2
          Terminal B → ENG-21  }  (can overlap with Phase 3)
          Terminal C → ENG-19  }  starts after ENG-18 is Done
Phase 5:  Terminal A → ENG-22                        (final validation)
```

## Developer Checklist Between Phases

- [ ] Review code written by each agent
- [ ] Run tests (`pnpm test` in affected packages)
- [ ] Commit the work (`/commit` or manual)
- [ ] Confirm SpecTree feature statuses are updated to "Done"
- [ ] Check for any issues before starting next phase

## MCP Requirement

Every prompt includes an MCP connectivity check as the very first step. If the
agent cannot call `spectree__list_teams`, it will stop immediately rather than
attempting to implement code without SpecTree tracking. Make sure the SpecTree
API is running (`cd packages/api && pnpm dev`) before starting any prompt.

---

## Phase 1 — Foundation Fix (BLOCKER)

### Prompt 1: ENG-13 — MCP Stability Fix & Re-enablement

**Terminal A** | Dependencies: None

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-13 (MCP Stability Fix & Re-enablement).

BEFORE YOU START:
1. Call spectree__get_feature with identifier "ENG-13" to read the full description,
   AI Instructions, and Acceptance Criteria
2. Call spectree__get_structured_description for ENG-13 (type: feature) to see
   detailed acceptance criteria and files involved
3. Read docs/spectree-automation-tool-strategy.md Section 8 for the detailed
   task breakdown (Tasks 1.1 through 1.4)
4. Set ENG-13 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only modify these files:
- packages/mcp/src/index.ts
- packages/mcp/src/tools/composite.ts
- .github/copilot-instructions.md

IMPLEMENTATION GUIDANCE:
- Reproduce the "TypeError: terminated" crash during large create_epic_complete calls
- Add global error handlers to the MCP server process
- Add try/catch with proper error responses in tool handlers
- Add timeout handling for API calls within tool handlers
- Re-enable MCP instructions in copilot-instructions.md (remove HTML comment wrappers)
- Test reliability: run the full planning workflow 3 times in succession

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-13 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you changed and any issues encountered

Do NOT move to other features. Focus only on ENG-13.
```

**After ENG-13:** Review changes, run `cd packages/mcp && pnpm build`, test manually, commit.

---

## Phase 2 — Foundation Layer (3 agents in parallel)

**Gate:** ENG-13 must be Done before starting any of these.

### Prompt 2: ENG-14 — Custom Agents

**Terminal A** | Dependencies: ENG-13

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-14 (Custom Agents).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-13 status is Done.
   If ENG-13 is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-14" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-14 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 2.1-2.4
5. Set ENG-14 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only create/modify files in:
- .github/agents/planner.md
- .github/agents/orchestrator.md
- .github/agents/feature-worker.md
- .github/agents/reviewer.md

IMPLEMENTATION GUIDANCE:
- Create the .github/agents/ directory
- Each agent file has YAML frontmatter (name, description, tools, agents,
  user-invokable) followed by Markdown instructions
- Reference specific SpecTree MCP tool names with concrete call examples
- Set user-invokable: false for feature-worker (sub-agent only)
- Read Section 6 of docs/spectree-automation-tool-strategy.md for agent specs
- YAML tools field uses: read, edit, execute, search, agent, web, todo

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-14 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you created

Do NOT modify files outside .github/agents/. Do NOT move to other features.
```

### Prompt 3: ENG-15 — Custom Skills

**Terminal B** | Dependencies: ENG-13

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-15 (Custom Skills).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-13 status is Done.
   If ENG-13 is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-15" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-15 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 3.1-3.3
5. Set ENG-15 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only create/modify files in:
- .github/skills/spectree-planning/SKILL.md
- .github/skills/spectree-session/SKILL.md
- .github/skills/spectree-validation/SKILL.md

IMPLEMENTATION GUIDANCE:
- Create the .github/skills/ directory with subdirectories for each skill
- Each skill is a directory containing a SKILL.md file
- Skills are pure Markdown procedures (no YAML frontmatter)
- Reference specific SpecTree MCP tool names with concrete call examples
- Each skill must be self-contained and understandable without other files

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-15 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you created

Do NOT modify files outside .github/skills/. Do NOT move to other features.
```

### Prompt 4: ENG-17 — ACP Integration Layer

**Terminal C** | Dependencies: ENG-13

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-17 (ACP Integration Layer).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-13 status is Done.
   If ENG-13 is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-17" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-17 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 5.1-5.4
   and Appendix B for the ACP protocol reference
5. Set ENG-17 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only create/modify files in:
- packages/orchestrator/src/acp/types.ts
- packages/orchestrator/src/acp/client.ts
- packages/orchestrator/src/acp/session.ts
- packages/orchestrator/src/acp/index.ts

IMPLEMENTATION GUIDANCE:
- Create the packages/orchestrator/src/acp/ directory
- ACP uses JSON-RPC 2.0, newline-delimited JSON over stdin/stdout
- Key methods: initialize, session/new, session/prompt, session/update,
  session/cancel, session/request_permission, session/load
- Follow existing patterns: error types from src/errors.ts, config from src/config/
- Use EventEmitter pattern from src/orchestrator/agent-pool.ts
- CRITICAL: exactOptionalPropertyTypes is true — do NOT assign undefined to
  optional properties. Build objects and conditionally add fields.
- Export everything from index.ts barrel file

WHEN COMPLETE:
1. Run: cd packages/orchestrator && npx tsc --noEmit (must compile cleanly)
2. Verify ALL acceptance criteria from the feature description are met
3. Set ENG-17 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
4. Summarize what you created

Do NOT modify files outside packages/orchestrator/src/acp/. Do NOT move to
other features.
```

**After Phase 2:** Review all 3 outputs, run `cd packages/orchestrator && pnpm build`, commit all changes.

---

## Phase 3 — Enhancement Layer (2 agents in parallel)

**Gate:** ENG-14 + ENG-15 + ENG-17 must ALL be Done.

### Prompt 5: ENG-16 — Planning Pipeline Enhancement

**Terminal A** | Dependencies: ENG-14, ENG-15

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-16 (Planning Pipeline Agent Enhancement).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-14 AND ENG-15
   statuses are both Done. If either is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-16" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-16 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 4.1-4.4
5. Set ENG-16 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only modify these files:
- .github/agents/planner.md (created in ENG-14)
- .github/skills/spectree-planning/SKILL.md (created in ENG-15)

IMPLEMENTATION GUIDANCE:
- This feature ENHANCES files created in Phase 2 — read them first
- Read packages/orchestrator/src/orchestrator/plan-generator.ts lines 189-308
  for the existing PLANNER_SYSTEM_PROMPT — encode this knowledge into the
  agent and skill definitions
- Add: iterative workflow, configurable review gates (auto/review/stop),
  task scoping heuristics, quality evaluation checks
- The planner should use SpecTree MCP tools interactively, not just generate JSON
- Review gates are conversational: present results, wait for user approval

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-16 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you enhanced

Do NOT modify files outside the two listed above. Do NOT move to other features.
```

### Prompt 6: ENG-18 — Orchestrator Refactor (SDK to ACP)

**Terminal C** | Dependencies: ENG-17

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-18 (Orchestrator Refactor — SDK to ACP).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-17 status is Done.
   If ENG-17 is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-18" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-18 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 6.1-6.5
5. Read the ACP module created in ENG-17: packages/orchestrator/src/acp/
6. Set ENG-18 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only modify these files:
- packages/orchestrator/src/orchestrator/agent-pool.ts
- packages/orchestrator/src/orchestrator/phase-executor.ts
- packages/orchestrator/src/orchestrator/orchestrator.ts
- packages/orchestrator/src/orchestrator/plan-generator.ts
- packages/orchestrator/src/orchestrator/recovery.ts
- packages/orchestrator/package.json

IMPLEMENTATION GUIDANCE:
- Replace CopilotClient.createSession() → AcpSessionManager.createSession()
- Replace session.send() → acpSession.send()
- Replace session.on(event, handler) → acpSession.on(event, handler)
- Replace session.destroy() → acpSession.destroy()
- SDK → ACP event mapping: assistant.message_delta→text, session.idle→complete,
  tool.execution_start→tool_call, tool.execution_complete→tool_result
- Work in dependency order: agent-pool → phase-executor → orchestrator → plan-generator
- Do NOT change model-agnostic logic: pool management, phase execution,
  progress tracking, SpecTree integration, git operations, error handling
- Remove @github/copilot-sdk from package.json dependencies

WHEN COMPLETE:
1. Run: cd packages/orchestrator && npx tsc --noEmit (must compile cleanly)
2. Run: cd packages/orchestrator && pnpm test (existing tests must pass with mocked ACP)
3. Verify no imports from @github/copilot-sdk remain
4. Set ENG-18 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
5. Summarize what you refactored

Do NOT modify files outside the listed scope. Do NOT move to other features.
```

**After Phase 3:** Review refactored code carefully, run full test suite, commit.

---

## Phase 4 — Integration Layer (optimized parallel scheduling)

**ENG-20 and ENG-21 can start as soon as Phase 2 is Done (overlap with Phase 3).**
**ENG-19 must wait until ENG-18 (Phase 3) is Done.**

### Prompt 7: ENG-20 — Shell Scripts for Automation

**Terminal A** | Dependencies: ENG-14, ENG-15 | Can start after Phase 2

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-20 (Shell Scripts for Automation).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-14 AND ENG-15
   statuses are both Done. If either is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-20" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-20 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 8.1-8.3
5. Set ENG-20 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only create/modify files in:
- scripts/spectree-plan.sh
- scripts/spectree-run.sh
- scripts/spectree-validate.sh

IMPLEMENTATION GUIDANCE:
- Create the scripts/ directory at project root if needed
- Each script: bash shebang, usage help (--help), env var configuration, error handling
- Scripts use: copilot -p "<prompt>" --allow-all-tools --agent=<name>
- Reference the agent names from .github/agents/ (created in ENG-14)
- Exit codes: 0 success, 1 failure
- Make all scripts executable (chmod +x)

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-20 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you created

Do NOT modify files outside scripts/. Do NOT move to other features.
```

### Prompt 8: ENG-21 — Copilot Instructions Update

**Terminal B** | Dependencies: ENG-13, ENG-14, ENG-15 | Can start after Phase 2

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-21 (Copilot Instructions Update).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-13, ENG-14, AND
   ENG-15 statuses are all Done. If any is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-21" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-21 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 9.1-9.3
5. Read .github/agents/ to see what agents were created in ENG-14
6. Read .github/skills/ to see what skills were created in ENG-15
7. Set ENG-21 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only modify:
- .github/copilot-instructions.md

IMPLEMENTATION GUIDANCE:
- Do NOT re-do MCP re-enablement (that was ENG-13). Only ADD new content.
- Add: Custom Agents section documenting @planner, @orchestrator, @reviewer
- Add: Custom Skills section documenting available skills
- Add: Session Start Checklist with SpecTree session initialization
- Add: Automation Workflow section explaining spectree plan and spectree run
- Include usage examples for each agent

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-21 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Summarize what you added

Do NOT modify any files other than .github/copilot-instructions.md.
Do NOT move to other features.
```

### Prompt 9: ENG-19 — CLI Command Updates

**Terminal C** | Dependencies: ENG-17, ENG-18 | Must wait for Phase 3

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing a feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-19 (CLI Command Updates).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ENG-17 AND ENG-18
   statuses are both Done. If either is NOT Done, STOP and tell me.
2. Call spectree__get_feature with identifier "ENG-19" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-19 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 7.1-7.3
5. Read existing CLI: packages/orchestrator/src/cli/index.ts and state.ts
6. Read the ACP module: packages/orchestrator/src/acp/
7. Set ENG-19 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Only modify files in:
- packages/orchestrator/src/cli/index.ts
- packages/orchestrator/src/cli/state.ts

IMPLEMENTATION GUIDANCE:
- Add: spectree plan "<description>" — invokes planner via ACP, creates epic
- Add: spectree validate <epic-id> — runs all validations, reports results
- Update: spectree run <epic-id> — execute epic via ACP sessions
- Add: spectree run --dry-run <epic-id> — show plan without executing
- All commands need --help documentation
- Follow existing patterns for argument parsing, config loading, error display
- Use config system from src/config/ and UI components from src/ui/

WHEN COMPLETE:
1. Run: cd packages/orchestrator && npx tsc --noEmit (must compile cleanly)
2. Verify ALL acceptance criteria from the feature description are met
3. Set ENG-19 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
4. Summarize what you implemented

Do NOT modify files outside packages/orchestrator/src/cli/.
Do NOT move to other features.
```

**After Phase 4:** Review all outputs, run full build and tests, commit.

---

## Phase 5 — End-to-End Validation (FINAL)

**Gate:** ALL features ENG-13 through ENG-21 must be Done.

### Prompt 10: ENG-22 — End-to-End Testing

**Terminal A** | Dependencies: ALL

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

BRANCH CHECK: You must be on branch "feature/spectree-automation-tool".
Run: git branch --show-current
If you are on a different branch, run: git checkout feature/spectree-automation-tool
Do NOT create new branches.

You are implementing the FINAL feature from the "SpecTree Automation Tool" epic
(ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

YOUR TASK: Implement feature ENG-22 (End-to-End Testing).

BEFORE YOU START:
1. Call spectree__list_features for this epic and confirm ALL features ENG-13
   through ENG-21 have status Done. If ANY feature is NOT Done, STOP and list
   which features are incomplete.
2. Call spectree__get_feature with identifier "ENG-22" to read the full description,
   AI Instructions, and Acceptance Criteria
3. Call spectree__get_structured_description for ENG-22 (type: feature)
4. Read docs/spectree-automation-tool-strategy.md Section 8 for tasks 10.1-10.3
5. Set ENG-22 status to "In Progress" using spectree__update_feature with
   statusId: "24b55d5a-ab41-4b22-a6dd-8b62c127eabe"

SCOPE — Create/modify files in:
- docs/automation-quickstart.md
- packages/orchestrator/tests/e2e/

IMPLEMENTATION GUIDANCE:
- Use test scenario: "Add a new REST API endpoint for user preferences with
  CRUD operations"
- Test the full pipeline: planning → epic creation → execution → ACP sessions →
  git branches → SpecTree progress tracking → validation → completion
- Write docs/automation-quickstart.md with step-by-step guide a developer can
  follow without prior knowledge
- Write E2E test files that exercise the key integration points
- E2E tests require running SpecTree API, MCP server, and Copilot CLI
- Use smallest possible test scenario to minimize Copilot premium request usage

WHEN COMPLETE:
1. Verify ALL acceptance criteria from the feature description are met
2. Set ENG-22 status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
3. Provide a full summary of the E2E test results and quickstart guide contents

This is the final feature. When ENG-22 is Done, the entire epic is complete.
```

---

## Quick Reference

| Prompt | Feature | Phase | Terminal | Dependencies | Can Overlap With |
|--------|---------|-------|----------|--------------|------------------|
| 1 | ENG-13 | 1 | A | None | Nothing |
| 2 | ENG-14 | 2 | A | ENG-13 | Prompts 3, 4 |
| 3 | ENG-15 | 2 | B | ENG-13 | Prompts 2, 4 |
| 4 | ENG-17 | 2 | C | ENG-13 | Prompts 2, 3 |
| 5 | ENG-16 | 3 | A | ENG-14, ENG-15 | Prompt 6 |
| 6 | ENG-18 | 3 | C | ENG-17 | Prompt 5 |
| 7 | ENG-20 | 4 | A | ENG-14, ENG-15 | Prompts 5, 6, 8, 9 |
| 8 | ENG-21 | 4 | B | ENG-13-15 | Prompts 5, 6, 7, 9 |
| 9 | ENG-19 | 4 | C | ENG-17, ENG-18 | Prompts 7, 8 |
| 10 | ENG-22 | 5 | A | ALL | Nothing |

## Recovery

### Session Crash (agent error, network issue)

If a session crashes mid-feature:
1. Check SpecTree — the feature status tells you where it stopped
2. Check `git status` — see what files were partially modified
3. Re-run the same prompt. The agent will see the feature is "In Progress"
   and the partially-written code, and can continue from where it left off.
4. If needed, `git stash` or `git checkout .` to reset and start the feature fresh.

### Context Window Exhaustion (0% remaining)

Complex features (especially ENG-18 Orchestrator Refactor) can exhaust the
context window before finishing. When you see "Context low (0% remaining)"
and `/compact` fails with "Conversation too long":

1. **Don't panic** — all code changes are already saved to disk.
2. **Close the dead session** (`Ctrl+C` or `Ctrl+D`). It cannot be recovered.
3. **Assess what's done** in a new session or this terminal:
   ```bash
   # See what files were modified
   git status
   # Check if old SDK imports remain
   grep -r "copilot-sdk\|CopilotClient\|CopilotSession" packages/orchestrator/src/orchestrator/
   # Check if it compiles
   cd packages/orchestrator && npx tsc --noEmit
   ```
4. **Write a continuation prompt** for a fresh session. Use this template:

```
CRITICAL — MCP CONNECTIVITY CHECK:
Before doing ANYTHING else, call spectree__list_teams to verify SpecTree MCP
is connected. If this call fails or the tool is not available, STOP IMMEDIATELY
and tell me: "SpecTree MCP is not connected. Cannot proceed."
Do NOT attempt to implement anything without MCP access.

You are CONTINUING a partially-completed feature from the "SpecTree Automation
Tool" epic (ID: 88cec40c-0ab4-4a6e-afba-ac01f9113b30).

CONTEXT: The previous session ran out of context window while implementing
ENG-XX (<feature title>). Here is what was completed:
- <list completed tasks from the dead session's task list>

YOUR TASK: Finish the remaining work for ENG-XX.

WHAT'S LEFT:
1. <describe remaining tasks based on your assessment>
2. Run TypeScript compilation check: cd packages/orchestrator && npx tsc --noEmit
3. Run tests: cd packages/orchestrator && pnpm test
4. Fix any compilation or test failures
5. Set ENG-XX status to "Done" using spectree__update_feature with
   statusId: "d3cd5620-f550-4603-a394-fd53f172d04b"
6. Summarize the final state

SCOPE — Only modify files in:
- <list the same files from the original prompt>

Do NOT start any other features. Focus only on finishing ENG-XX.
```

### Preventing Context Exhaustion

Features most likely to exhaust context (ordered by risk):

| Feature | Risk | Why | Mitigation |
|---------|------|-----|------------|
| ENG-18 | **High** | 5 files, ~5,200 lines of refactoring | Break into 2 sessions: files 1-3, then files 4-5 + verify |
| ENG-17 | Medium | New module with 4 files from scratch | Usually fits in one session |
| ENG-16 | Medium | Requires reading large PLANNER_SYSTEM_PROMPT | Tell agent to read only lines 189-308, not the whole file |
| ENG-22 | Medium | E2E testing touches everything | Keep test scenario minimal |

**If you suspect a feature will exhaust context**, you can proactively split
it into two prompts. For example, split ENG-18 into:

- **Prompt 6a:** "Refactor agent-pool.ts and phase-executor.ts only. Do NOT
  set the feature status to Done — more work remains."
- **Prompt 6b:** "Continue ENG-18. Refactor orchestrator.ts, plan-generator.ts,
  and recovery.ts. Remove SDK from package.json. Verify compilation and tests.
  Set ENG-18 to Done."

### Branch Issues

If an agent creates an unexpected branch (e.g., `feature/COM-1-sequential-1-items`
instead of `feature/spectree-automation-tool`), you have two options:

1. **Merge the changes back:**
   ```bash
   git checkout feature/spectree-automation-tool
   git merge feature/COM-1-sequential-1-items
   ```

2. **Cherry-pick specific commits:**
   ```bash
   git checkout feature/spectree-automation-tool
   git cherry-pick <commit-hash>
   ```

Always verify you're on the correct branch before starting a new prompt. Add
this to the prompt if needed:
```
IMPORTANT: You must work on branch "feature/spectree-automation-tool".
If you are on a different branch, switch to it first:
git checkout feature/spectree-automation-tool
Do NOT create new branches.
```
