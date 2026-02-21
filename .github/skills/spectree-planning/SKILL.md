---
name: SpecTree Planning
description: "Core planning skill that encodes the full 5-stage pipeline for creating well-structured SpecTree epics from natural language descriptions."
---

# SpecTree Planning Procedure

This skill encodes the full 5-stage pipeline for creating well-structured SpecTree epics from natural language descriptions. Follow each stage sequentially, applying quality checks before proceeding.

## Stage 1: ANALYZE

**Goal:** Understand the request, identify affected codebase areas, and establish technical constraints.

**Steps:**

1. Read the user's natural language feature description carefully.
2. Use codebase search and file reading tools to understand the existing architecture:
   - Identify which packages are affected (`packages/api`, `packages/web`, `packages/orchestrator`, `packages/mcp`, etc.)
   - Read existing patterns in the affected areas (naming conventions, file structure, testing approach)
   - Note any dependencies, constraints, or risks
3. Produce a scope assessment with:
   - **Affected areas:** Which packages, directories, and key files will be touched
   - **Technical constraints:** Framework versions, TypeScript strictness, database considerations
   - **Risk factors:** Anything that could make implementation difficult or risky

**Review Gate:** Present the scope assessment to the user. Wait for confirmation before proceeding. If the user has configured `--gates=auto`, proceed automatically.

---

## Stage 2: DECOMPOSE

**Goal:** Break the analyzed request into features and tasks, create the full SpecTree epic hierarchy.

**Steps:**

1. Determine the target team:
   ```
   spectree__list_teams()
   ```
   If multiple teams exist, ask the user which one to use.

2. Decompose the request into 3-7 features, each with 2-5 tasks. Apply these structuring rules:
   - `executionOrder` is 1-indexed (1 = first). Applies to both features and tasks.
   - Feature `dependencies` array contains feature indices (by executionOrder) that must complete first.
   - Task `dependencies` array contains task indices (within the same feature) that must complete first.
   - `parallelGroup` should be a short identifier like `"api"`, `"frontend"`, `"tests"` when `canParallelize` is true.
   - Features with no dependencies and `canParallelize=true` in the same `parallelGroup` can run simultaneously.
   - Tasks with no dependencies and `canParallelize=true` in the same `parallelGroup` can run simultaneously within their feature.

3. Create the epic atomically:
   ```
   spectree__create_epic_complete({
     name: "Epic Name",
     team: "Engineering",
     description: "Brief summary of what this epic accomplishes",
     features: [
       {
         title: "Feature Title",
         description: "What this feature implements and why",
         executionOrder: 1,
         canParallelize: false,
         parallelGroup: null,
         estimatedComplexity: "moderate",
         dependencies: [],
         tasks: [
           {
             title: "Task Title",
             description: "Specific implementation task details",
             executionOrder: 1,
             canParallelize: false,
             parallelGroup: null,
             dependencies: [],
             estimatedComplexity: "simple"
           }
         ]
       }
     ]
   })
   ```

**Complexity Scale:**
| Level | Description | Token Budget |
|-------|-------------|-------------|
| trivial | Config changes, single-line fixes | ~10k tokens (~15 min) |
| simple | Well-defined changes across 1-3 files | ~30k tokens (~1 hour) |
| moderate | Multi-file changes, some complexity | ~80k tokens (~2-4 hours) |
| complex | Major implementation, many files | ~125k tokens (~4+ hours) |

### Decomposition Checklist

Before creating the epic, verify your decomposition satisfies ALL of these requirements:

#### Structure Rules
- [ ] Epic has 3-10 features
- [ ] Each feature has 2-5 tasks
- [ ] `executionOrder` is 1-indexed (1 = first) for BOTH features AND tasks
- [ ] Feature `dependencies` array contains feature IDs (by `executionOrder`) that must complete first
- [ ] Task `dependencies` array contains task indices (within the same feature) that must complete first
- [ ] `parallelGroup` is a short identifier (e.g., `"api"`, `"frontend"`, `"tests"`) when `canParallelize` is true
- [ ] Features with no dependencies and `canParallelize=true` in the same `parallelGroup` can run simultaneously
- [ ] Tasks with no dependencies and `canParallelize=true` in the same `parallelGroup` can run simultaneously within their feature

#### Content Rules
- [ ] `aiInstructions` for every feature and task are detailed enough for an AI agent to implement **without additional context** — include specific file paths, function names, and step-by-step guidance
- [ ] `acceptanceCriteria` are specific, measurable conditions that can be verified — not vague ("works correctly") but concrete ("TypeScript compiles without errors", "API returns 200 for valid input")
- [ ] `filesInvolved` lists known or likely files to be modified, using full relative paths from repo root
- [ ] `technicalNotes` capture important implementation decisions and constraints
- [ ] `description` for every feature and task is >= 50 characters

#### Validation Rules

Every task SHOULD have at least one validation check. Add validations using `spectree__add_validation` after the epic is created.

| Validation Type | When to Use | Example |
|----------------|-------------|---------|
| `command` | Run a shell command, check exit code | `{ type: "command", command: "pnpm exec tsc --noEmit", expectedExitCode: 0 }` — TypeScript compiles |
| `file_exists` | Verify a file was created | `{ type: "file_exists", filePath: "src/components/NewComponent.tsx" }` |
| `file_contains` | Search file content with regex | `{ type: "file_contains", filePath: "src/routes/index.ts", searchPattern: "router\\.get.*preferences" }` |
| `test_passes` | Run a specific test command | `{ type: "test_passes", testCommand: "pnpm test src/specific/file.test.ts" }` |
| `manual` | Requires human verification | `{ type: "manual", description: "Verify the UI renders correctly in dark mode" }` |

At minimum, include a `command` validation for TypeScript type-checking (`pnpm exec tsc --noEmit`) on every task that modifies `.ts` or `.tsx` files.

**Review Gate:** Present the feature/task breakdown to the user. Wait for confirmation before proceeding.

---

## Stage 3: DETAIL

**Goal:** Enrich every feature and task with structured descriptions containing AI instructions, acceptance criteria, files involved, and metadata.

**Steps:**

For each feature and task in the epic, call `spectree__set_structured_description`:

```
spectree__set_structured_description({
  id: "ENG-123",       // feature identifier
  type: "feature",     // or "task"
  structuredDesc: {
    summary: "Human-readable summary of what needs to be done",
    aiInstructions: "Step-by-step implementation guidance...",
    acceptanceCriteria: [
      "Criterion 1: Specific measurable outcome",
      "Criterion 2: Another verifiable condition"
    ],
    filesInvolved: ["packages/api/src/routes/users.ts"],
    functionsToModify: ["packages/api/src/routes/users.ts:createUser"],
    technicalNotes: "Implementation details, constraints, decisions",
    testingStrategy: "How to test this feature",
    testFiles: ["packages/api/tests/users.test.ts"],
    riskLevel: "low",         // low | medium | high
    estimatedEffort: "medium"  // trivial | small | medium | large | xl
  }
})
```

**Risk Levels:**
| Level | Description |
|-------|-------------|
| low | Well-understood changes with minimal risk |
| medium | Some uncertainty or moderate impact |
| high | Significant complexity or broad impact |

**Effort Estimates:**
| Level | Description |
|-------|-------------|
| trivial | Less than 1 hour |
| small | 1-4 hours |
| medium | 1-2 days |
| large | 3-5 days |
| xl | More than 5 days |

### Good vs Bad Structured Descriptions

**Bad (insufficient detail):**
```json
{
  "summary": "Add database tables",
  "aiInstructions": "Create the schema",
  "acceptanceCriteria": ["Tables exist"],
  "filesInvolved": []
}
```

**Good (sufficient detail):**
```json
{
  "summary": "Create database schema for activity tracking with ActivityLog table, proper indexes, and relations",
  "aiInstructions": "1. Add ActivityLog model to schema.prisma with fields: id, userId, activityType (enum), metadata (JSON), createdAt, updatedAt. 2. Add index on (userId, createdAt) and (activityType). 3. Run prisma generate. 4. Create ActivityLogType enum in shared/types. 5. Export types from shared index.",
  "acceptanceCriteria": [
    "ActivityLog model exists in Prisma schema with all required fields",
    "Migration creates table with indexes on userId, activityType, createdAt",
    "TypeScript types are exported from @spectree/shared",
    "Existing tests still pass after migration"
  ],
  "filesInvolved": [
    "packages/api/prisma/schema.prisma",
    "packages/shared/src/types/activity.ts"
  ],
  "riskLevel": "medium",
  "estimatedEffort": "small"
}
```

**Key differences:** The good example has specific file paths, numbered implementation steps, multiple verifiable acceptance criteria, and concrete field/model names.

**Review Gate:** Present a summary of the structured descriptions to the user. Wait for confirmation before proceeding.

---

## Stage 4: EVALUATE

**Goal:** Run quality heuristics against the fully detailed epic and identify issues.

**Quality Heuristics Checklist:**

| Heuristic | Threshold | Action if Violated |
|-----------|-----------|-------------------|
| Acceptance criteria count | >= 2 per task | Add more criteria |
| AI instructions present | Non-empty for every task | Add implementation steps |
| Files involved listed | At least 1 file per task | Identify target files |
| Task scope (estimated) | <= 125k tokens (complex) | Split into smaller tasks |
| Description length | >= 50 characters | Expand description |
| Feature task count | 2-5 tasks per feature | Split or merge features |
| Feature count per epic | 3-10 features | Adjust scope |
| Dependency validity | No circular dependencies | Fix dependency graph |
| Parallel safety | Parallel items don't share files | Add dependencies or separate |

**Steps:**

1. For each task, verify:
   - Does it have >= 2 acceptance criteria?
   - Does it have non-empty AI instructions?
   - Does it list at least 1 file involved?
   - Is the estimated complexity appropriate for the scope?
2. For each feature, verify:
   - Does it have 2-5 tasks?
   - Are the task dependencies valid (no circular deps)?
3. For the epic, verify:
   - Does it have 3-10 features?
   - Do parallel features in the same group actually work on independent files?

**Scoring:** Count the number of passing heuristics vs total. Report as a quality score (e.g., "34/36 heuristics pass").

**Review Gate:** Always present the quality score and any issues found. This gate is always interactive (never auto-approved).

---

## Stage 5: VERIFY

**Goal:** Generate and validate the execution plan to ensure correct ordering and parallelism.

**Steps:**

1. Generate the execution plan:
   ```
   spectree__get_execution_plan({ epicId: "<epic-uuid>" })
   ```

2. Verify the output:
   - **Phase ordering:** Earlier phases contain features with lower execution orders
   - **No circular dependencies:** The plan resolves to a valid DAG
   - **Parallel correctness:** Features in the same phase marked as parallel don't modify the same files
   - **Completeness:** Every feature and task appears in exactly one phase

3. Present the execution plan visualization to the user:
   ```
   Phase 1: [Feature A (sequential)]
   Phase 2: [Feature B, Feature C] (parallel - group "api")
   Phase 3: [Feature D] (depends on B, C)
   ```

**Review Gate:** Always present the execution plan. This gate is always interactive (never auto-approved). The user must confirm the plan looks correct before the planning process is complete.

---

## Task Scoping Reference

Use these guidelines during Stage 2 (DECOMPOSE) and Stage 4 (EVALUATE) to ensure tasks are properly scoped.

### Token Budget Per Task

Each task should be scoped to approximately **one AI session (~125k tokens)**. Use the complexity level as a proxy:

| Complexity | Token Budget | Time Estimate | Typical Scope |
|-----------|-------------|---------------|---------------|
| trivial | ~10k tokens | ~15 min | Config changes, single-file edits, simple fixes |
| simple | ~30k tokens | ~1 hour | Well-defined single-purpose changes across 1-3 files |
| moderate | ~80k tokens | ~2-4 hours | Multi-file changes with some complexity, requires understanding context |
| complex | ~125k tokens | ~4+ hours | Major implementation across many files, requires architectural decisions |

If a task would exceed the `complex` budget, split it into smaller tasks.

### Self-Containment Rules

Each task MUST be **self-contained** — an AI agent should be able to complete it with only the information in SpecTree (structured description, AI instructions, acceptance criteria, files involved) plus codebase access.

1. **No implicit dependencies** — If task B requires knowing what task A produced, task B's description must say "Read the output of task A from [specific file/location]"
2. **Concrete file references** — "Modify the API client" is bad. "Modify `packages/orchestrator/src/spectree/api-client.ts`" is good.
3. **Explicit acceptance criteria** — Every task needs at least 2 verifiable acceptance criteria
4. **AI instructions** — Step-by-step implementation guidance specific enough for a fresh AI session

### Quality Heuristics Summary

Use this table as a quick reference during the EVALUATE stage:

| # | Heuristic | Threshold | Action if Violated |
|---|-----------|-----------|-------------------|
| 1 | Acceptance criteria count | >= 2 per task, >= 3 per feature | Add more criteria |
| 2 | AI instructions present | Non-empty for every item | Add implementation steps |
| 3 | Files involved listed | At least 1 file per task | Identify target files |
| 4 | Task scope (estimated) | <= 125k tokens (complex) | Split into smaller tasks |
| 5 | Description length | >= 50 characters | Expand description |
| 6 | Feature task count | 2-5 tasks per feature | Split or merge features |
| 7 | Feature count per epic | 3-10 features | Adjust scope |
| 8 | Dependency validity | No circular dependencies | Fix dependency graph |
| 9 | Parallel safety | Parallel items don't share files | Add dependencies or separate |

---

## After Planning

Once all 5 stages are complete and approved:
- The epic is fully created in SpecTree with all structured descriptions
- The execution plan is validated and ready for the execution engine
- The user can run `spectree run <epic-id>` to begin automated execution
