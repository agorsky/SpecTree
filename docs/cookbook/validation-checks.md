# Setting Up Validation Checks

Validation checks are executable acceptance criteria that verify tasks are complete. This guide shows you how to define, run, and debug validation checks for reliable, automated testing.

**Time Estimate:** ~10 minutes

---

## Prerequisites

- **Epic with tasks created** — See [Creating Your First Epic](./first-epic.md)
- **SpecTree MCP configured** — Validation tools available
- **Tasks with acceptance criteria** — Define what "done" means

**Verify MCP tools:**
```
@spectree help validations
```

---

## What Are Validation Checks?

Validation checks are automated tests that run before marking a task complete. They verify:

- ✅ Code compiles/builds successfully
- ✅ Tests pass
- ✅ Files exist in expected locations
- ✅ Code contains required patterns
- ✅ Manual verification steps completed

**Why use them?**
- Prevent incomplete work from being marked "Done"
- Automate repetitive verification steps
- Document acceptance criteria in executable form

---

## Types of Validation Checks

| Type | Purpose | Example |
|------|---------|---------|
| **command** | Run a shell command, check exit code | `pnpm test --filter api` |
| **file_exists** | Verify a file exists | `packages/api/src/routes/preferences.ts` |
| **file_contains** | Check file contains pattern (regex) | File has `export default function` |
| **test_passes** | Run test command | `pnpm test --filter api --run preferences` |
| **manual** | Requires human verification | "UI looks correct in browser" |

---

## Steps

### Step 1: Identify Task to Validate

Choose a task that needs validation. Example:

**Task:** `ENG-42-1-3` — "Implement GET endpoint handler"

**Acceptance criteria:**
- GET /api/v1/preferences returns 200
- Response matches expected schema
- Handles unauthenticated requests (401)
- Has unit tests

### Step 2: Add Validation Checks

Add checks that verify each acceptance criterion:

#### Check 1: File Exists

Verify the route file was created:

```
@spectree add validation to task ENG-42-1-3 type file_exists with description "Route file exists" and filePath "packages/api/src/routes/preferences.ts"
```

#### Check 2: Test Passes

Verify unit tests run successfully:

```
@spectree add validation to task ENG-42-1-3 type test_passes with description "Unit tests pass" and testCommand "pnpm --filter @spectree/api test --run preferences"
```

#### Check 3: File Contains Pattern

Verify the route handler is exported:

```
@spectree add validation to task ENG-42-1-3 type file_contains with description "Route handler exported" and filePath "packages/api/src/routes/preferences.ts" and searchPattern "export default function preferencesRoutes"
```

#### Check 4: Linting Passes

Verify code follows style guidelines:

```
@spectree add validation to task ENG-42-1-3 type command with description "Linting passes" and command "pnpm --filter @spectree/api lint"
```

### Step 3: Review Validation Checks

List all checks for the task:

```
@spectree list validations for task ENG-42-1-3
```

**Expected output:**

```
Validation Checks for ENG-42-1-3:

1. ✅ file_exists: Route file exists
   File: packages/api/src/routes/preferences.ts

2. ⏳ test_passes: Unit tests pass
   Command: pnpm --filter @spectree/api test --run preferences

3. ⏳ file_contains: Route handler exported
   File: packages/api/src/routes/preferences.ts
   Pattern: export default function preferencesRoutes

4. ⏳ command: Linting passes
   Command: pnpm --filter @spectree/api lint

Status: 1 passed, 3 pending
```

### Step 4: Run Validations

After implementing the task, run all checks:

```
@spectree run all validations for task ENG-42-1-3
```

**What happens:**

SpecTree executes each check in order:
1. Checks if file exists ✅
2. Runs test command ✅
3. Searches file for pattern ✅
4. Runs lint command ✅

**Success output:**

```
✅ All validation checks passed (4/4)

1. ✅ file_exists: Route file exists
2. ✅ test_passes: Unit tests pass (8 tests, 0 failures)
3. ✅ file_contains: Route handler exported
4. ✅ command: Linting passes

Task ENG-42-1-3 is ready to complete.
```

**Failure output:**

```
❌ 1 validation check failed (3/4 passed)

1. ✅ file_exists: Route file exists
2. ❌ test_passes: Unit tests pass
   Error: 2 tests failed
   
   See test output:
     ✗ should return 401 for unauthenticated requests
     ✗ should validate response schema
   
3. ✅ file_contains: Route handler exported
4. ✅ command: Linting passes

Fix failures before completing the task.
```

### Step 5: Fix Failures

If checks fail:

1. Review the error output
2. Fix the code/tests
3. Re-run validations
4. Repeat until all pass

**Re-run a specific check:**

```
@spectree run validation <checkId> for task ENG-42-1-3
```

**Reset all checks to pending:**

```
@spectree reset validations for task ENG-42-1-3
```

### Step 6: Complete Task with Validation

Once all checks pass, complete the task:

```
@spectree complete task ENG-42-1-3 with validation
```

**What happens:**

1. Runs all validation checks
2. If all pass → marks task "Done"
3. If any fail → task stays "In Progress", shows failures

---

## Advanced Validation Patterns

### Timeout for Long-Running Commands

Set a timeout (default: 30 seconds, max: 5 minutes):

```
@spectree add validation type command with description "Build succeeds" and command "pnpm build" and timeoutMs 120000
```

### Expected Exit Code

Expect non-zero exit codes:

```
@spectree add validation type command with description "Grep finds pattern" and command "grep 'TODO' src/**/*.ts" and expectedExitCode 1
```

### Multiple File Checks

Verify multiple files exist:

```
@spectree add validation type file_exists with description "Model file exists" and filePath "packages/api/prisma/schema.prisma"

@spectree add validation type file_contains with description "UserPreferences model defined" and filePath "packages/api/prisma/schema.prisma" and searchPattern "model UserPreferences"
```

### Manual Verification

For UI/visual checks:

```
@spectree add validation type manual with description "Preferences page displays correctly in browser"
```

**To complete:**

```
@spectree mark manual validation <checkId> for task ENG-42-1-3 validated with notes "Verified in Chrome, Firefox, Safari"
```

---

## Common Pitfalls

### "Command not found" Errors

**Problem:** Command runs in shell but fails in validation  
**Solution:** Use absolute paths or ensure PATH is set correctly:

```bash
# Instead of:
"command": "node script.js"

# Use:
"command": "node /full/path/to/script.js"
```

### Tests Fail in Validation but Pass Locally

**Problem:** Different working directory or environment  
**Solution:** Specify `workingDirectory` parameter:

```
@spectree add validation type test_passes with testCommand "pnpm test" and workingDirectory "/Users/you/project"
```

### Regex Pattern Doesn't Match

**Problem:** Pattern is too specific or has escaping issues  
**Solution:** Test regex separately first:

```bash
grep -E "your-pattern" your-file.ts
```

Use simple patterns and avoid special characters.

### Timeout Too Short

**Problem:** Build/test commands take longer than 30 seconds  
**Solution:** Increase timeout:

```
timeoutMs: 180000  // 3 minutes
```

---

## Best Practices

### 1. Start Simple

Begin with basic checks:
- File exists
- Command runs successfully
- Tests pass

Add complex regex/pattern checks later.

### 2. One Check per Criterion

Each acceptance criterion = one validation check.

**Don't:**
```
"Build and test both pass" (combined)
```

**Do:**
```
"Build succeeds"
"Tests pass"
```

### 3. Fast Checks First

Order checks by speed:
1. File existence (instant)
2. Pattern matching (fast)
3. Linting (medium)
4. Tests (slow)
5. Build (slowest)

Fail fast on quick checks.

### 4. Clear Descriptions

Use descriptive names that explain what's being verified:

**Bad:** "Check 1", "Validation A"  
**Good:** "Unit tests pass", "Route file exists"

### 5. Avoid Brittle Patterns

Use flexible regex patterns:

**Brittle:**
```regex
export default function preferencesRoutes\(fastify: FastifyInstance\): void
```

**Flexible:**
```regex
export default function preferencesRoutes
```

---

## Expected Output

After setting up validations:

✅ 3-5 validation checks per task  
✅ Mix of automated and manual checks  
✅ Fast checks ordered before slow ones  
✅ Clear, actionable descriptions  

**Time saved:** 10-15 minutes per task on manual verification

---

## Next Steps

- **[Run Orchestrated Implementation](./orchestration.md)** — Execute tasks with auto-validation
- **[Code Review with Reviewer Agent](./reviewer-agent.md)** — Combine validation with AI code review

---

## What You Learned

✅ Types of validation checks and when to use them  
✅ Adding checks via MCP tools  
✅ Running and debugging validations  
✅ Best practices for reliable automation  

**Pro Tip:** Add validation checks as you write tasks, not after. It clarifies acceptance criteria early.
