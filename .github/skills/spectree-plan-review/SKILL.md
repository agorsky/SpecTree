---
name: SpecTree Plan Review
description: "Quality rubrics, scoring methodology, and review process for evaluating SpecTree epics before implementation."
---

# SpecTree Plan Quality Review Procedure

This skill defines the quality rubrics, scoring methodology, and review process for evaluating SpecTree epics before implementation. Use this to determine whether an epic is ready for orchestrator execution.

## When to Use

- After the planner creates an epic (Stage 6 of the planning pipeline)
- Before invoking `@orchestrator` to execute an epic
- On demand when a user wants a quality check on any epic

---

## Review Process

### Step 1: Load the Epic

```
spectree__get_epic({ query: "<epic-id-or-name>" })
```

### Step 2: Evaluate Epic Description

Read the full epic description text. Score it against the Epic Description Rubric.

### Step 3: Evaluate Features

For each feature:
```
spectree__get_feature({ id: "<identifier>" })
spectree__get_structured_description({ type: "feature", id: "<identifier>" })
```

### Step 4: Evaluate Tasks

For each task in every feature:
```
spectree__get_structured_description({ type: "task", id: "<identifier>" })
```

### Step 5: Evaluate Execution Plan

```
spectree__get_execution_plan({ epicId: "<epic-id>" })
```

### Step 6: Compute Scores and Report

Use the rubrics below to score each dimension, compute the weighted overall score, and present the review report.

---

## Quality Rubrics

### Epic Description Rubric (0-100)

The epic description is the permanent reference document. It must be comprehensive enough that any engineer (human or AI) can understand the full scope, approach, and constraints without reading anything else.

| Check | Points | Condition |
|-------|--------|-----------|
| **Overview/Source** | 10 | Has a clear overview or source reference explaining what this epic is about |
| **Problem Statement** | 10 | Clearly articulates the problem being solved — not just a feature request, but *why* it matters |
| **Goals** | 10 | Has a goals table or list with specific, measurable objectives |
| **Proposed Approach** | 15 | Describes the technical approach with enough detail to understand the architecture — includes specific patterns, endpoints, components, or data flows |
| **Scope Definition** | 10 | Defines what's in scope and/or what's explicitly out of scope. Includes default behaviors, edge cases, or boundary conditions |
| **Execution Plan** | 10 | Has an execution plan table mapping phases to features with identifiers and complexity |
| **Technical Considerations** | 15 | Covers key files, risk areas, existing infrastructure, scalability concerns, or constraints |
| **Success Criteria** | 10 | Has specific, verifiable success criteria (not vague aspirations) |
| **Supporting Sections** | 10 | Includes at least 2 of: Target Audience, Alternatives Considered, Dependencies, Access Control, UI/UX Requirements |

**Scoring rules:**
- Award **full points** if the section is present AND substantive (multiple sentences, specific details)
- Award **half points** if the section is present but thin (single sentence or generic)
- Award **zero** if the section is missing entirely

**Word count baseline:** An epic description under 300 words is almost certainly too sparse. Flag any description under 300 words as a critical issue regardless of section scores.

### Good vs Bad Epic Descriptions

**Bad (would score ~30/100):**
```markdown
## Overview
Add scope filtering to the activity dashboard.

## Problem
Users need to filter activity by scope.

## Approach
Extend the API and add frontend filters.
```

**Good (would score ~95/100):**
```markdown
## Overview
Enhance the existing Activity Dashboard to provide Admin users with the ability
to filter activity data at multiple scope levels...

## Problem Statement
The Activity Dashboard currently shows all activity without any ability to
filter by scope or level. Administrators cannot quickly determine utilization
levels for the entire application, specific teams, or individual users...

## Goals
| Goal | Description |
|------|-------------|
| **Scope Filtering** | Add four scope-level filters for Admin users... |
| **Performance** | Filter changes target under 2 seconds... |

## Proposed Approach
The implementation follows a non-breaking enhancement pattern:
- **Backend:** Extend existing `/api/v1/user-activity` endpoint with optional
  `scope` and `scopeId` query parameters
- **Authorization:** If `scope !== 'self'`, check `isGlobalAdmin`...
- **Service Layer:** Implement `getEpicsByScope()` helper...

## Execution Plan
| Phase | Feature | Identifier | Complexity |
|-------|---------|------------|------------|
| 1 | Backend API Scope Filtering | ENG-84 | Moderate |
...

## Technical Considerations
### Key Files
- **Backend Route:** `packages/api/src/routes/userActivity.ts`
...
### Risk Areas
- 🟡 **Performance:** "All Activity" scope could be slow...
...

## Success Criteria
1. **Accuracy** — Activity data must be accurate at every scope level
2. **Performance** — Filter changes under 2 seconds
...

## Alternatives Considered
1. **Separate Analytics Page** — rejected because...
...

## Dependencies
1. ✅ Existing Activity Dashboard (fully implemented)
...
```

---

### Feature Rubric (0-100, scored per feature)

| Check | Points | Condition |
|-------|--------|-----------|
| **Structured description exists** | 15 | Has a structured description with non-empty `summary` |
| **AI instructions present** | 20 | Has non-empty `aiInstructions` with step-by-step guidance. Must reference specific file paths and function names — not vague ("implement the feature") |
| **Acceptance criteria count** | 15 | Has >= 3 acceptance criteria |
| **Acceptance criteria quality** | 15 | Criteria are specific and verifiable — not vague ("works correctly") but concrete ("returns 403 Forbidden for non-admin users") |
| **Files involved listed** | 10 | Has >= 1 file in `filesInvolved` with full relative paths from repo root |
| **Execution metadata set** | 15 | Has `executionOrder` (non-null), `estimatedComplexity` (non-null), and appropriate `dependencies` (explicit, not relying on executionOrder alone) |
| **Risk and effort assessed** | 10 | Has `riskLevel` and `estimatedEffort` in structured description |

### Good vs Bad Feature Descriptions

**Bad AI instructions (0 points):**
```
"Implement the scope filtering feature"
```

**Good AI instructions (20 points):**
```
"1. Read packages/api/src/routes/userActivity.ts to understand current endpoint
2. Study packages/api/src/services/userActivityService.ts epic resolution logic
3. Add scope ('self'|'all'|'team'|'user') and scopeId (string) to querystring schema
4. Add admin check: if scope !== 'self', require isGlobalAdmin
5. Implement getEpicsByScope() helper in userActivityService.ts
6. Preserve existing timezone handling and pagination logic
7. Test with existing frontend to ensure no breaking changes"
```

**Bad acceptance criteria (0 points):**
```
["Feature works correctly", "No bugs"]
```

**Good acceptance criteria (15 points):**
```
["API accepts scope and scopeId query parameters without breaking existing clients",
 "Non-admin users receive 403 Forbidden for scope != 'self'",
 "Scope='team' returns activity only for epics belonging to specified team ID",
 "All existing timezone and pagination functionality works with scope filtering"]
```

---

### Task Rubric (0-100, scored per task)

| Check | Points | Condition |
|-------|--------|-----------|
| **Structured description exists** | 15 | Has a structured description with non-empty `summary` |
| **AI instructions present** | 25 | Has non-empty `aiInstructions` specific enough for a fresh AI session to implement without additional context. Must include concrete file paths, function names, and step-by-step guidance |
| **Acceptance criteria count** | 15 | Has >= 2 acceptance criteria |
| **Acceptance criteria quality** | 15 | Criteria are specific and testable — a fresh agent could determine pass/fail without ambiguity |
| **Files involved listed** | 15 | Has >= 1 file in `filesInvolved` with full relative paths. Paths must reference real directories (flag suspicious paths like `packages/api/performance/` if that directory doesn't exist) |
| **Self-contained** | 15 | Task description + AI instructions are sufficient to implement without reading other tasks. A fresh session with no prior context could complete this task |

### Self-Containment Test

Ask yourself: "If I gave this task's structured description to a fresh AI session with no other context, could it complete the work?" If the answer is no, the task is not self-contained. Common failures:
- References "the component created in the previous task" without naming it
- Says "follow the same pattern" without specifying which pattern
- Lists files to modify but doesn't explain what changes to make
- Assumes knowledge of decisions made in other tasks

---

### Execution Plan Rubric (0-100)

| Check | Points | Condition |
|-------|--------|-----------|
| **All features included** | 25 | Every feature in the epic appears in the execution plan |
| **Execution order set** | 25 | Every feature has a non-null `executionOrder` |
| **Dependencies valid** | 25 | No circular dependencies. All referenced dependency IDs exist. Features that logically depend on each other have explicit `dependencies` set (not just relying on `executionOrder`). Example: a frontend feature consuming a backend API should explicitly depend on the backend feature |
| **Parallel safety** | 25 | Features in the same `parallelGroup` with `canParallelize=true` do not modify the same files (check `filesInvolved` for overlaps). Features that are sequential should not be in the same parallel group |

### Common Execution Plan Issues

- **Missing explicit dependencies:** Features are ordered correctly by `executionOrder` but have `dependencies: null`. This is fragile — if someone changes the execution order, dependent features could run before their prerequisites
- **Overly sequential:** Every feature is sequential when some could run in parallel. Not a correctness issue, but reduces execution efficiency
- **File conflicts in parallel groups:** Two features in the same parallel group both modify `packages/api/src/routes/users.ts` — this will cause merge conflicts

---

## Overall Score Calculation

```
Epic Description Score:    XX/100
Feature Score (avg):       XX/100  (individual: F1=XX, F2=XX, ...)
Task Score (avg):          XX/100  (individual: T1.1=XX, T1.2=XX, ...)
Execution Plan Score:      XX/100
────────────────────────────────────
Overall Score:             XX/100  (weighted average)
```

**Weights:**
- Epic Description: **30%** — most commonly under-specified; drives all downstream quality
- Feature Average: **25%** — defines scope and acceptance criteria for feature-workers
- Task Average: **25%** — determines whether feature-workers can execute independently
- Execution Plan: **20%** — ensures correct ordering and parallelism

**Thresholds:**
- **95-100:** ✅ **READY** — Implementation can proceed
- **80-94:** ⚠️ **NEEDS IMPROVEMENT** — Specific issues must be fixed before execution
- **Below 80:** ❌ **NOT READY** — Significant gaps that would likely cause implementation failures

**Hard floor:** An epic whose Epic Description Score is below 80 is **never READY**, regardless of the overall score. A weak epic description undermines everything downstream.

---

## Review Report Format

Present findings in this structured format:

```markdown
## Plan Review: {EPIC_NAME}

### Summary
- **Epic:** {name}
- **Features:** {count}
- **Tasks:** {total count}
- **Overall Score:** {XX}/100 — {READY / NEEDS IMPROVEMENT / NOT READY}

### Epic Description: {XX}/100

| Section | Status | Notes |
|---------|--------|-------|
| Overview/Source | ✅/⚠️/❌ | Details |
| Problem Statement | ✅/⚠️/❌ | Details |
| Goals | ✅/⚠️/❌ | Details |
| ... | ... | ... |

**Word count:** {N} words

### Features: {XX}/100 (avg)

| Feature | Score | Issues |
|---------|-------|--------|
| ENG-XX: Title | XX/100 | Issue list or "No issues" |

### Tasks: {XX}/100 (avg)

| Task | Score | Issues |
|------|-------|--------|
| ENG-XX-1: Title | XX/100 | Issue list or "No issues" |

### Execution Plan: {XX}/100

| Check | Status | Notes |
|-------|--------|-------|
| All features included | ✅/❌ | ... |
| Execution order set | ✅/❌ | ... |
| Dependencies valid | ✅/❌ | ... |
| Parallel safety | ✅/❌ | ... |

### Critical Issues (must fix before execution)
1. **[Category]** Description and recommended fix

### Recommendations (nice to have)
1. Suggestion for improvement

### Verdict: {READY ✅ / NEEDS IMPROVEMENT ⚠️ / NOT READY ❌}
Summary paragraph.
```

---

## Rules

1. **Score every dimension** — never skip a rubric check or eyeball quality
2. **Check word count** — sparse epic descriptions are the #1 failure mode
3. **Verify file paths** — ensure `filesInvolved` references real directories/files in the codebase
4. **Test self-containment** — for each task, ask "could a fresh session complete this?"
5. **Check acceptance criteria specificity** — "works correctly" is never acceptable
6. **Verify explicit dependencies** — relying solely on `executionOrder` is fragile
7. **Never modify the plan** — only report findings. The planner or user decides what to fix
