# SpecTree Validation Procedures

This skill defines how to run, interpret, and act on SpecTree validation checks. Validations are executable acceptance criteria attached to tasks that verify work was completed correctly.

## Validation Types

SpecTree supports five validation types:

| Type | Description | Parameters |
|------|-------------|------------|
| `command` | Run a shell command, check exit code | `command`, `expectedExitCode` (default: 0) |
| `file_exists` | Verify a file exists at a path | `filePath` |
| `file_contains` | Search file content with regex pattern | `filePath`, `searchPattern` |
| `test_passes` | Run a specific test command | `testCommand` |
| `manual` | Requires human verification | (none - marked manually) |

---

## Adding Validations

Add validation checks to a task before or during implementation:

### Command Validation
```
spectree__add_validation({
  taskId: "ENG-123-1",
  type: "command",
  description: "TypeScript compiles without errors",
  command: "cd packages/api && pnpm exec tsc --noEmit",
  expectedExitCode: 0
})
```

### File Exists Validation
```
spectree__add_validation({
  taskId: "ENG-123-1",
  type: "file_exists",
  description: "API route file exists",
  filePath: "packages/api/src/routes/preferences.ts"
})
```

### File Contains Validation
```
spectree__add_validation({
  taskId: "ENG-123-1",
  type: "file_contains",
  description: "Route exports a router",
  filePath: "packages/api/src/routes/preferences.ts",
  searchPattern: "export.*router"
})
```

### Test Passes Validation
```
spectree__add_validation({
  taskId: "ENG-123-1",
  type: "test_passes",
  description: "Unit tests pass",
  testCommand: "cd packages/api && pnpm test src/routes/preferences.test.ts"
})
```

### Manual Validation
```
spectree__add_validation({
  taskId: "ENG-123-1",
  type: "manual",
  description: "UI renders correctly in the browser at /settings/preferences"
})
```

---

## Running Validations

### List All Validations for a Task

Before running, see what checks exist:

```
spectree__list_validations({
  taskId: "ENG-123-1"
})
```

Returns an array of validation objects with their IDs, types, descriptions, and current pass/fail status.

### Run All Validations at Once

```
spectree__run_all_validations({
  taskId: "ENG-123-1"
})
```

### Run a Single Validation

For debugging a specific failing check:

```
spectree__run_validation({
  taskId: "ENG-123-1",
  checkId: "<validation-uuid>"
})
```

---

## Interpreting Results

The `run_all_validations` response contains:

```json
{
  "allPassed": false,
  "totalChecks": 4,
  "passedChecks": 3,
  "failedChecks": 1,
  "results": [
    {
      "id": "<uuid>",
      "type": "command",
      "description": "TypeScript compiles without errors",
      "passed": true,
      "output": "No errors found"
    },
    {
      "id": "<uuid>",
      "type": "file_exists",
      "description": "API route file exists",
      "passed": true
    },
    {
      "id": "<uuid>",
      "type": "file_contains",
      "description": "Route exports a router",
      "passed": true,
      "output": "Match found at line 15"
    },
    {
      "id": "<uuid>",
      "type": "test_passes",
      "description": "Unit tests pass",
      "passed": false,
      "error": "Test failed: expected 200 but got 404",
      "output": "FAIL src/routes/preferences.test.ts\n  GET /preferences\n    x should return user preferences (15ms)"
    }
  ]
}
```

**Key fields:**
- `allPassed` - `true` only when every check passes
- `totalChecks` - Total number of validation checks
- `passedChecks` / `failedChecks` - Count of each
- `results[].passed` - Whether this specific check passed
- `results[].error` - Error message when a check fails
- `results[].output` - Command stdout or match details

### Handling Failures

When validations fail:

1. **Read the error output** to understand what went wrong
2. **Fix the issue** in the code
3. **Re-run the failing validation** to confirm the fix:
   ```
   spectree__run_validation({
     taskId: "ENG-123-1",
     checkId: "<failed-validation-uuid>"
   })
   ```
4. **Repeat** until all validations pass

---

## Completing with Validation (Atomic Workflow)

The preferred way to complete a task is the atomic validate-and-complete operation. This runs all validations and only marks the task as complete if every check passes:

```
spectree__complete_task_with_validation({
  taskId: "ENG-123-1",
  summary: "Implemented user preferences API with GET/PUT endpoints, Zod validation, and Prisma queries."
})
```

**Behavior:**
- If all validations pass: task is marked "Done" with the provided summary
- If any validation fails: task remains "In Progress" and the response includes the failing checks with error details

This is safer than calling `complete_work` directly because it prevents marking tasks as done when acceptance criteria aren't actually met.

### When to Use Each Approach

| Approach | When to Use |
|----------|-------------|
| `complete_task_with_validation` | Default. Use this for any task that has validation checks. |
| `complete_work` | Only when there are no automated validation checks (e.g., tasks with only manual validations). |
| `run_all_validations` then `complete_work` | When you want to inspect results before completing (e.g., debugging). |

---

## Manual Validations

Some checks require human judgment and cannot be automated:

### Marking a Manual Validation as Passed

After a human has verified the criterion:

```
spectree__mark_manual_validated({
  taskId: "ENG-123-1",
  checkId: "<manual-validation-uuid>"
})
```

### When Manual Validation Is Needed

- UI/UX reviews ("Does the page look correct?")
- Performance benchmarks ("Is the response time acceptable?")
- Cross-browser testing ("Works in Chrome, Firefox, Safari")
- Accessibility audits ("Screen reader compatible")

Manual validations should be the exception, not the rule. Prefer automated checks wherever possible.

---

## Managing Validations

### Removing a Validation

If a validation is no longer relevant (e.g., acceptance criteria changed):

```
spectree__remove_validation({
  taskId: "ENG-123-1",
  checkId: "<validation-uuid>"
})
```

### Resetting All Validations

To clear all validation results and re-run from scratch:

```
spectree__reset_validations({
  taskId: "ENG-123-1"
})
```

This clears pass/fail status but keeps the validation definitions.

---

## Best Practices

1. **Add validations early** - Define validation checks when detailing the task (Stage 3 of planning), not after implementation.
2. **At least one automated check per task** - Every task should have at least a `command` type validation (e.g., TypeScript compilation, linting).
3. **Match acceptance criteria** - Each acceptance criterion in the structured description should map to at least one validation check.
4. **Use `complete_task_with_validation`** - Always prefer the atomic validate-and-complete over separate calls.
5. **Fix before completing** - Never mark a task as done with failing validations. Fix the issues first.
