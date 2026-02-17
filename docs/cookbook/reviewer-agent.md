# Code Review with Reviewer Agent

The reviewer agent validates implementations against acceptance criteria, checks code quality, and provides structured feedback. This guide shows you how to use it for automated code review.

**Time Estimate:** ~15 minutes

---

## Prerequisites

- **Reviewer agent installed:** `spectree install @spectree/orchestrator` (includes reviewer)
- **Completed feature or task** to review
- **Acceptance criteria defined** on features/tasks
- **Git working directory clean** (all changes committed)

**Verify reviewer is available:**
```
@reviewer help
```

---

## How the Reviewer Works

The reviewer agent:

1. **Reads acceptance criteria** — From SpecTree structured descriptions
2. **Analyzes code changes** — Reviews files linked to the feature/task
3. **Runs validation checks** — Executes automated tests and checks
4. **Checks code quality** — Linting, patterns, conventions
5. **Provides feedback** — Structured report with issues and suggestions
6. **Updates SpecTree** — Logs review notes and blocker status

---

## Steps

### Step 1: Complete Your Implementation

Before review, ensure:

✅ All tasks are implemented  
✅ Code compiles and runs  
✅ Files are committed to Git  
✅ Manual testing done  

**Check status:**

```
@spectree get feature ENG-42-1
```

Verify all tasks are marked "Done" or "In Progress".

### Step 2: Invoke the Reviewer

Request a review for a feature:

```
@reviewer review feature ENG-42-1
```

Or for an entire epic:

```
@reviewer review epic ENG-42
```

**What happens:**

The reviewer will:
1. Load acceptance criteria
2. Identify modified files
3. Run validation checks
4. Analyze code quality
5. Generate review report

**Expected output (initial):**

```
🔍 Starting review for ENG-42-1: REST API endpoints for preferences

Loading acceptance criteria...
✅ 4 acceptance criteria found

Identifying modified files...
✅ 8 files linked to this feature

Running validation checks...
⏳ Running 5 validation checks...
```

### Step 3: Review Validation Results

The reviewer runs all validation checks:

```
Running validation checks:
  ✅ file_exists: Route file exists
  ✅ test_passes: Unit tests pass (12 tests)
  ✅ file_contains: Route handler exported
  ✅ command: Linting passes
  ❌ command: Type checking passes
     Error: src/routes/preferences.ts:15:10 - error TS2345
            Argument of type 'string' is not assignable to parameter of type 'number'

Validation: 4/5 passed (1 failure)
```

### Step 4: Review Code Quality Analysis

The reviewer checks code quality:

```
Code Quality Analysis:

Files Reviewed: 8
  ├─ packages/api/src/routes/preferences.ts
  ├─ packages/api/src/services/preferences.ts
  ├─ packages/api/prisma/schema.prisma
  └─ ... 5 more

Issues Found: 3

1. ⚠️  Missing error handling (Medium)
   File: packages/api/src/services/preferences.ts:42
   Issue: Database call not wrapped in try-catch
   Suggestion: Add error handling for Prisma operations

2. 📝 TODO comment found (Low)
   File: packages/api/src/routes/preferences.ts:28
   Issue: TODO: Add rate limiting
   Suggestion: Create a task to implement rate limiting

3. ⚠️  Inconsistent naming (Medium)
   File: packages/api/src/routes/preferences.ts:15
   Issue: Variable 'user_id' uses snake_case, project uses camelCase
   Suggestion: Rename to 'userId'
```

### Step 5: Review Acceptance Criteria

The reviewer checks each criterion:

```
Acceptance Criteria Review:

1. ✅ GET endpoint returns user preferences with 200 status
   Verified: Route handler returns 200, matches expected schema

2. ✅ PUT endpoint updates preferences and returns 200 status
   Verified: Update logic implemented, validation added

3. ❌ Invalid requests return 400 with error details
   Issue: Missing validation for invalid theme values
   File: packages/api/src/routes/preferences.ts:55
   Required: Add theme enum validation ['light', 'dark', 'system']

4. ⚠️  All endpoints have unit test coverage
   Partial: GET endpoint has 8 tests, PUT has 4 tests
   Missing: Tests for edge cases (malformed JSON, concurrent updates)
```

### Step 6: Receive Final Report

The reviewer provides a summary:

```
📋 Review Summary for ENG-42-1

Status: ⚠️  Needs Revision

Validation Checks: 4/5 passed
Code Quality: 3 issues (2 medium, 1 low)
Acceptance Criteria: 3/4 met

🔴 Blockers (Must Fix):
  1. TypeScript type error in preferences.ts:15
  2. Missing validation for theme enum values
  3. Missing unit tests for edge cases

⚠️  Recommendations (Should Fix):
  1. Add error handling for database operations
  2. Rename user_id to userId (convention consistency)

💡 Suggestions (Consider):
  1. Create task for rate limiting (from TODO comment)

Next Steps:
  1. Fix blockers listed above
  2. Run validations again: @spectree run validations for feature ENG-42-1
  3. Request another review: @reviewer review feature ENG-42-1
```

### Step 7: Fix Issues

Address blockers and recommendations:

#### Fix 1: TypeScript Error

Edit `packages/api/src/routes/preferences.ts`:

```typescript
// Before:
const userId = request.user.id;  // Type issue

// After:
const userId = Number(request.user.id);
```

#### Fix 2: Add Enum Validation

Add validation schema:

```typescript
const themeSchema = z.enum(['light', 'dark', 'system']);
```

#### Fix 3: Add Unit Tests

Create tests for edge cases:

```typescript
test('PUT /preferences rejects invalid theme', async () => {
  // Test implementation...
});
```

### Step 8: Re-run Review

After fixes, request another review:

```
@reviewer review feature ENG-42-1
```

**Success output:**

```
📋 Review Summary for ENG-42-1

Status: ✅ Approved

Validation Checks: 5/5 passed
Code Quality: 1 minor issue (1 low)
Acceptance Criteria: 4/4 met

Previous Issues:
  ✅ Fixed: TypeScript type error
  ✅ Fixed: Missing theme enum validation
  ✅ Fixed: Unit test coverage

Remaining (Low Priority):
  1. 📝 TODO comment for rate limiting (tracked as suggestion)

🎉 Feature ENG-42-1 is ready to merge!

Recommendation: Create follow-up task for rate limiting before release.
```

### Step 9: Update SpecTree

The reviewer automatically logs review notes:

```
@spectree get ai context for feature ENG-42-1
```

**Shows reviewer notes:**

```
AI Notes:
  - [2026-02-16 14:30] Review completed by @reviewer
    Status: Approved
    Blockers Fixed: 3
    Suggestions: 1 follow-up task recommended (rate limiting)
  - All acceptance criteria met
  - Code quality: Good (1 minor TODO)
```

---

## Advanced Review Options

### Strict Mode

Enforce stricter checks:

```
@reviewer review feature ENG-42-1 --strict
```

Treats warnings as blockers.

### Focus Areas

Review specific aspects only:

```
@reviewer review feature ENG-42-1 --focus security,performance
```

Available focuses: `security`, `performance`, `accessibility`, `testing`.

### Compare Against Branch

Review changes compared to another branch:

```
@reviewer review feature ENG-42-1 --compare main
```

Only analyzes diff between current branch and `main`.

### Auto-Fix (Experimental)

Let the reviewer attempt automatic fixes:

```
@reviewer review feature ENG-42-1 --auto-fix
```

⚠️ **Warning:** Review auto-fixes carefully before committing.

---

## Common Pitfalls

### Reviewer Finds Issues That Aren't Real

**Problem:** False positives in code quality checks  
**Solution:** Adjust review settings or ignore specific rules:

```
// Add comment to suppress:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = await fetchData();
```

### Acceptance Criteria Too Vague

**Problem:** Reviewer can't verify criteria like "UI looks good"  
**Solution:** Make criteria objective and testable:

**Vague:** "UI looks good"  
**Specific:** "Settings page renders without console errors, theme toggle changes CSS variables"

### Review Takes Too Long

**Problem:** Reviewer analyzes too many files  
**Solution:** Link only relevant files to the feature:

```
@spectree link file to feature ENG-42-1 "packages/api/src/routes/preferences.ts"
```

### Reviewer Reports Completed

**Problem:** All checks pass but feature still has issues  
**Solution:** Add more validation checks and acceptance criteria. The reviewer is only as good as the criteria defined.

---

## Best Practices

### 1. Define Clear Acceptance Criteria

Before implementation, write specific, testable criteria:

**Good:**
- "GET /api/v1/preferences returns 200 with valid JSON"
- "PUT validates theme enum: ['light', 'dark', 'system']"
- "Unauthorized requests return 401"

**Bad:**
- "API works correctly"
- "User can update preferences"

### 2. Link All Modified Files

Use `spectree__link_code_file` during implementation:

```
@spectree link file to task ENG-42-1-1 "packages/api/prisma/schema.prisma"
```

Helps reviewer understand scope.

### 3. Review Early and Often

Don't wait until the end:

- **After each task** — Quick review catches issues early
- **After each feature** — Ensures feature cohesion
- **Before merge** — Final check before PR

### 4. Address Blockers First

Prioritize issues:
1. 🔴 Blockers (Must Fix)
2. ⚠️ Recommendations (Should Fix)
3. 💡 Suggestions (Consider)

### 5. Log Decisions

If you disagree with reviewer feedback, log why:

```
@spectree log decision for feature ENG-42-1 "Decided not to add rate limiting in this PR" with rationale "Out of scope, will be addressed in separate epic"
```

---

## Expected Output

After successful review:

✅ All validation checks passed  
✅ Code quality issues addressed or documented  
✅ Acceptance criteria met  
✅ Review notes logged in SpecTree  
✅ Feature ready to merge  

**Time saved:** 20-30 minutes per feature vs. manual code review

---

## Next Steps

- **[Updating Skill Packs](./update-packs.md)** — Keep reviewer up-to-date with latest features
- **[Creating a Custom Skill Pack](./custom-pack.md)** — Customize reviewer rules for your team

---

## What You Learned

✅ How to invoke the reviewer agent for features and epics  
✅ Interpreting review reports (validation, quality, criteria)  
✅ Fixing issues and re-running reviews  
✅ Best practices for clear, testable acceptance criteria  

**Pro Tip:** Use the reviewer during implementation, not just at the end. It catches issues early when they're easier to fix.
