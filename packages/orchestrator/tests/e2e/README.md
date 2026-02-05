# End-to-End (E2E) Test Procedure

> **Purpose**: Manual E2E testing procedure for the SpecTree Parallel Agent Orchestrator CLI.
>
> This document provides comprehensive test scenarios to validate the full system works correctly in real-world conditions.

---

## Prerequisites

Before running E2E tests, ensure the following environment is set up:

### 1. SpecTree API Running Locally

```bash
# From repository root
cd packages/api && pnpm dev
```

Verify the API is accessible:

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

### 2. Valid GitHub Token with Copilot Access

```bash
export GITHUB_TOKEN=ghp_xxxxx
```

Verify token works:

```bash
# The auth command should validate token access
spectree-agent auth status
```

### 3. Orchestrator Built and Linked

```bash
cd packages/orchestrator
pnpm build

# Link globally for CLI access (optional - can also use node dist/index.js)
pnpm link --global
```

Verify installation:

```bash
spectree-agent --version
# Expected: 0.1.0 (or current version)

spectree-agent --help
# Expected: Shows available commands
```

### 4. Test Repository Initialized

```bash
# Create fresh test directory
mkdir -p /tmp/spectree-e2e-test
cd /tmp/spectree-e2e-test

# Initialize git repository
git init
git config user.email "test@example.com"
git config user.name "E2E Test"

# Create initial structure
cat > README.md << 'EOF'
# E2E Test Project

A test project for SpecTree orchestrator E2E testing.
EOF

cat > package.json << 'EOF'
{
  "name": "spectree-e2e-test",
  "version": "1.0.0",
  "description": "Test project for E2E testing",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  }
}
EOF

# Commit initial state
git add .
git commit -m "Initial commit"
```

### 5. Environment Variables

Create a `.env` file or export these variables:

```bash
export SPECTREE_API_URL=http://localhost:3001
export GITHUB_TOKEN=ghp_xxxxx
export SPECTREE_DEFAULT_TEAM=OasisAI
```

---

## Test Scenarios

### Scenario 1: Basic Sequential Execution

**Goal**: Verify the basic `run` command works end-to-end with sequential task execution.

**Complexity**: Low
**Duration**: ~5 minutes

#### Steps

1. Navigate to test repository:

   ```bash
   cd /tmp/spectree-e2e-test
   ```

2. Run orchestrator with a simple prompt in sequential mode:

   ```bash
   spectree-agent run "Add a hello world endpoint to an Express app" \
     --team OasisAI \
     --sequential
   ```

3. **Verification Checklist**:

   - [ ] Epic created in SpecTree (check UI or API)
   - [ ] Features/tasks visible in SpecTree UI
   - [ ] Agent executes each task in order
   - [ ] Files created in repository (`index.js`, `package.json` updated)
   - [ ] Progress displayed in terminal (spinner, status updates)
   - [ ] Completion summary shown at end
   - [ ] Git commits created for work

4. Verify code works:

   ```bash
   npm install
   npm start
   # In another terminal:
   curl http://localhost:3000/hello
   # Expected: "Hello, World!" or similar
   ```

**Expected Result**: All tasks complete successfully, generated code compiles and runs.

**Pass Criteria**:

- Epic created with at least 1 feature and 2+ tasks
- All tasks marked as "Done" in SpecTree
- Working Express server with `/hello` endpoint

---

### Scenario 2: Parallel Agent Execution

**Goal**: Verify multiple agents can work concurrently on independent tasks.

**Complexity**: Medium
**Duration**: ~10 minutes

#### Steps

1. Reset test repository to clean state:

   ```bash
   cd /tmp/spectree-e2e-test
   git checkout .
   git clean -fd
   ```

2. Run orchestrator with a larger prompt enabling parallel execution:

   ```bash
   spectree-agent run "Build a user CRUD API with Express including:
     - GET /users - list all users
     - POST /users - create user
     - GET /users/:id - get user by id
     - PUT /users/:id - update user
     - DELETE /users/:id - delete user" \
     --team OasisAI \
     --max-agents 2
   ```

3. **During Execution - Verify**:

   - [ ] Multiple agents spawn (visible in status output)
   - [ ] Status shows "Agent 1: working on..." and "Agent 2: working on..."
   - [ ] Separate git branches created per agent
   - [ ] Work proceeds in parallel (timing)

4. **After Completion - Verify**:

   - [ ] All branches merged back to main
   - [ ] No code conflicts in final result
   - [ ] All CRUD endpoints present

5. Test the API:

   ```bash
   npm install
   npm start &
   
   # Test endpoints
   curl -X POST http://localhost:3000/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com"}'
   
   curl http://localhost:3000/users
   curl http://localhost:3000/users/1
   ```

**Expected Result**: Parallel execution completes faster than sequential; all endpoints work.

**Pass Criteria**:

- At least 2 agents ran concurrently
- Parallel execution time < sequential time (if comparable)
- All 5 CRUD endpoints functional
- Clean merge with no conflicts

---

### Scenario 3: Resume Interrupted Work (Continue Command)

**Goal**: Verify the `continue` command resumes work from interruption point.

**Complexity**: Medium
**Duration**: ~8 minutes

#### Steps

1. Reset and start a longer task:

   ```bash
   cd /tmp/spectree-e2e-test
   git checkout .
   git clean -fd
   ```

2. Start orchestration:

   ```bash
   spectree-agent run "Build an authentication system with:
     - User registration with email/password
     - Login endpoint
     - JWT token generation
     - Password hashing
     - Logout endpoint" \
     --team OasisAI \
     --sequential
   ```

3. **Cancel mid-execution** (after at least 1 task completes):

   Press `Ctrl+C` when you see "Completed task X of Y"

4. Verify state was saved:

   ```bash
   spectree-agent status
   # Should show: Epic "Build an authentication system..." - In Progress
   # Tasks completed: X/Y
   ```

5. Resume the work:

   ```bash
   spectree-agent continue
   ```

6. **Verification Checklist**:

   - [ ] Previous progress displayed correctly
   - [ ] Resumes from correct task (not task 1)
   - [ ] Doesn't redo already completed work
   - [ ] Completes remaining tasks
   - [ ] Final state is complete

**Expected Result**: Orchestration continues from interruption point without data loss.

**Pass Criteria**:

- Status command shows accurate progress
- Continue resumes from correct task
- No duplicate work performed
- Final result is complete

---

### Scenario 4: Error Recovery and Retry

**Goal**: Verify the system handles errors gracefully and can retry failed tasks.

**Complexity**: Medium
**Duration**: ~10 minutes

#### Steps

1. Create a scenario likely to cause an error (e.g., conflicting requirements):

   ```bash
   cd /tmp/spectree-e2e-test
   git checkout .
   git clean -fd
   ```

2. Run with intentionally vague/conflicting prompt:

   ```bash
   spectree-agent run "Add both SQLite and PostgreSQL database support" \
     --team OasisAI \
     --sequential
   ```

3. **Observe error handling**:

   - [ ] Error message displayed clearly
   - [ ] Error details logged (not swallowed)
   - [ ] System prompts for retry option
   - [ ] Status updated to reflect failure

4. Check status after error:

   ```bash
   spectree-agent status
   # Should show which task failed and why
   ```

5. Attempt retry:

   ```bash
   spectree-agent continue --retry-failed
   ```

6. **Verification Checklist**:

   - [ ] Retry attempt made
   - [ ] Different approach tried (if AI adjusts)
   - [ ] Either succeeds or fails gracefully
   - [ ] Final status reflects actual state

**Expected Result**: Errors are handled gracefully with clear feedback.

**Pass Criteria**:

- Error messages are informative
- System doesn't crash on errors
- Retry mechanism works
- State remains consistent after errors

---

### Scenario 5: Pause and Resume

**Goal**: Verify the pause command safely pauses orchestration mid-execution.

**Complexity**: Low
**Duration**: ~5 minutes

#### Steps

1. Start a multi-task orchestration:

   ```bash
   cd /tmp/spectree-e2e-test
   git checkout .
   git clean -fd
   
   spectree-agent run "Create a REST API with users, posts, and comments" \
     --team OasisAI
   ```

2. **While running**, send pause command (from another terminal):

   ```bash
   spectree-agent pause
   ```

3. **Verification Checklist**:

   - [ ] Current task completes (graceful pause)
   - [ ] "Paused" status displayed
   - [ ] No new tasks started after pause

4. Check status:

   ```bash
   spectree-agent status
   # Should show: Paused
   ```

5. Resume:

   ```bash
   spectree-agent resume
   ```

6. **Verify**:

   - [ ] Execution continues from paused state
   - [ ] Remaining tasks complete

**Expected Result**: Pause/resume works without data loss or corruption.

**Pass Criteria**:

- Graceful pause (current work completes)
- Clear pause status indication
- Resume continues correctly

---

### Scenario 6: Dry Run Mode

**Goal**: Verify dry run shows plan without executing.

**Complexity**: Low
**Duration**: ~3 minutes

#### Steps

1. Run with dry-run flag:

   ```bash
   spectree-agent run "Build a weather API integration" \
     --team OasisAI \
     --dry-run
   ```

2. **Verification Checklist**:

   - [ ] Plan displayed with features and tasks
   - [ ] No actual execution occurs
   - [ ] No git changes made
   - [ ] No SpecTree items created (or marked as draft)
   - [ ] Estimated time/complexity shown

**Expected Result**: Shows execution plan without side effects.

**Pass Criteria**:

- Detailed plan output
- Zero side effects
- Useful for planning validation

---

## Test Results Template

Copy this template to record your test results:

```markdown
## E2E Test Results - [DATE]

**Tester**: [Name]
**Environment**: [OS, Node version, etc.]
**Orchestrator Version**: [X.Y.Z]

### Summary

| Scenario | Result | Duration | Notes |
|----------|--------|----------|-------|
| 1. Basic Sequential | ✅ Pass / ❌ Fail | Xm Ys | |
| 2. Parallel Execution | ✅ Pass / ❌ Fail | Xm Ys | |
| 3. Continue Command | ✅ Pass / ❌ Fail | Xm Ys | |
| 4. Error Recovery | ✅ Pass / ❌ Fail | Xm Ys | |
| 5. Pause and Resume | ✅ Pass / ❌ Fail | Xm Ys | |
| 6. Dry Run Mode | ✅ Pass / ❌ Fail | Xm Ys | |

### Overall Result: ✅ PASS / ❌ FAIL

### Issues Discovered

| Issue | Severity | Description | Ticket |
|-------|----------|-------------|--------|
| | Critical/High/Medium/Low | | OAS-XXX |

### Notes

[Any additional observations, performance notes, or suggestions]
```

---

## Troubleshooting

### Common Issues

#### "SPECTREE_API_URL not configured"

```bash
export SPECTREE_API_URL=http://localhost:3001
```

#### "GitHub token invalid or expired"

```bash
# Re-authenticate
spectree-agent auth login
```

#### "Cannot find module..."

```bash
# Rebuild the orchestrator
cd packages/orchestrator
pnpm build
```

#### Agent hangs or becomes unresponsive

```bash
# Check agent status
spectree-agent status

# Force cancel if needed
spectree-agent pause --force
```

#### Git conflicts during merge

```bash
# Check current branch status
git status

# Manual resolution may be needed
git diff
```

---

## Test Environment Cleanup

After testing, clean up:

```bash
# Remove test directory
rm -rf /tmp/spectree-e2e-test

# Unlink global CLI (if linked)
cd packages/orchestrator
pnpm unlink --global

# Clean up any orphaned SpecTree test epics via API or UI
```

---

## Reporting Bugs

When filing bugs discovered during E2E testing:

1. **Title**: Clear, concise description
2. **Reproduction Steps**: Exact commands used
3. **Expected vs Actual**: What should happen vs what happened
4. **Logs**: Include relevant terminal output
5. **Environment**: OS, Node version, orchestrator version
6. **Label**: `e2e-test`, `bug`

File issues in Linear under the OasisAI team with appropriate priority.
