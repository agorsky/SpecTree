# Running Orchestrated Implementation

The SpecTree orchestrator executes epics automatically using parallel AI agents. This guide shows you how to run orchestrated implementation, monitor progress, and handle issues.

**Time Estimate:** ~30 minutes (for your first orchestration)

---

## Prerequisites

- **Orchestrator installed:** `spectree install @spectree/orchestrator` or `@spectree/full`
- **Epic ready for execution:**
  - Features with execution order set
  - Tasks with structured descriptions and AI instructions
  - Validation checks defined (optional but recommended)
- **SpecTree API running:** http://localhost:3001
- **GitHub Copilot CLI available:** `copilot --version`

**Verify orchestrator is ready:**
```
@orchestrator help
```

---

## How Orchestration Works

The orchestrator:

1. **Loads the epic** — Retrieves features, tasks, dependencies
2. **Creates execution plan** — Groups features into phases based on dependencies
3. **Spawns worker agents** — One agent per feature (parallel execution)
4. **Monitors progress** — Tracks task completion via SpecTree MCP
5. **Runs validation** — Verifies acceptance criteria for each task
6. **Handles failures** — Retries or marks blockers
7. **Reports results** — Summarizes what was completed

---

## Execution Phases

Orchestration happens in phases:

```
Phase 1: Independent features (no dependencies)
  ├─ Feature A (3 tasks) → Worker Agent 1
  ├─ Feature B (4 tasks) → Worker Agent 2
  └─ Feature C (2 tasks) → Worker Agent 3

Phase 2: Features depending on Phase 1
  ├─ Feature D (depends on A, B) → Worker Agent 4
  └─ Feature E (depends on C) → Worker Agent 5

Phase 3: Final features
  └─ Feature F (depends on D, E) → Worker Agent 6
```

**Key points:**
- Features in the same phase run in parallel
- Phase completes when all features finish
- Next phase starts after previous phase completes
- Dependencies are respected automatically

---

## Steps

### Step 1: Prepare Your Epic

Verify the epic is ready:

```
@spectree get progress summary for epic ENG-42
```

**Check for:**
- ✅ All features have `executionOrder` set
- ✅ Tasks have structured descriptions with `aiInstructions`
- ✅ Dependencies are correct
- ✅ Validation checks defined (if applicable)

**Fix issues before starting:**

```
# Set missing execution order
@spectree set execution metadata for feature ENG-42-1 with executionOrder 1

# Add missing AI instructions
@spectree set structured description for task ENG-42-1-1 with aiInstructions "..."
```

### Step 2: Start a Session

Begin an orchestration session:

```
@orchestrator start session for epic ENG-42
```

**What happens:**
- Creates session record in SpecTree
- Retrieves epic structure and execution plan
- Shows phases and feature grouping
- Confirms before starting execution

**Expected output:**

```
🚀 Starting orchestration for ENG-42: User Preferences API

Execution Plan:
  Phase 1 (2 features, parallel):
    - ENG-42-1: Database Schema (3 tasks, ~2 hours)
    - ENG-42-2: API Endpoints (4 tasks, ~3 hours)
  
  Phase 2 (1 feature):
    - ENG-42-3: Frontend UI (5 tasks, ~4 hours)

Total: 3 features, 12 tasks
Estimated: ~5 hours (parallel execution)

Ready to start? (yes/no)
```

### Step 3: Confirm and Execute

Review the plan and confirm:

```
yes
```

**Orchestrator begins execution:**

```
✅ Phase 1 starting...

Worker 1 (ENG-42-1): Starting task ENG-42-1-1: Define Prisma schema
Worker 2 (ENG-42-2): Starting task ENG-42-2-1: Create Zod validation schemas

[Real-time progress updates appear here...]

Worker 1 (ENG-42-1): ✅ Completed task ENG-42-1-1 (validation passed)
Worker 1 (ENG-42-1): Starting task ENG-42-1-2: Run migrations

Worker 2 (ENG-42-2): ✅ Completed task ENG-42-2-1 (validation passed)
Worker 2 (ENG-42-2): Starting task ENG-42-2-2: Implement GET endpoint
```

### Step 4: Monitor Progress

While orchestration runs, monitor in real-time:

**In terminal:** Watch the live output

**In SpecTree UI:** 
1. Open http://localhost:5173/epics/ENG-42
2. See tasks moving from "Backlog" → "In Progress" → "Done"
3. View AI notes and progress updates

**Using MCP:**

```
@spectree get progress summary for epic ENG-42
```

### Step 5: Review Phase Completion

After each phase completes, the orchestrator reports:

```
✅ Phase 1 completed (2/2 features successful)

Results:
  ✅ ENG-42-1: Database Schema — 3/3 tasks complete, all validations passed
  ✅ ENG-42-2: API Endpoints — 4/4 tasks complete, all validations passed

📊 Phase 1 Metrics:
  Duration: 2h 15m (estimated: 3h)
  Tasks completed: 7
  Validations passed: 7/7
  Files modified: 8

Starting Phase 2...
```

### Step 6: Handle Failures

If a task fails validation:

```
❌ Worker 1 (ENG-42-1): Task ENG-42-1-3 validation failed
   Failed check: Unit tests pass
   Error: 2 tests failed

Orchestrator pausing Phase 1...
```

**Options:**

1. **Fix manually and resume:**
   - Fix the failing tests
   - Run `@spectree run validations for task ENG-42-1-3`
   - Tell orchestrator to continue: `@orchestrator resume`

2. **Skip the task:**
   - `@orchestrator skip task ENG-42-1-3`
   - Orchestrator marks it as blocked and continues

3. **Abort orchestration:**
   - `@orchestrator stop`
   - Review failures and restart later

### Step 7: Review Final Results

When orchestration completes:

```
✅ Orchestration completed for ENG-42: User Preferences API

Summary:
  Total duration: 5h 12m
  Features completed: 3/3
  Tasks completed: 12/12
  Validations passed: 12/12
  Files modified: 24
  Commits: 8

Detailed Report:
  Phase 1 (2h 15m):
    ✅ ENG-42-1: Database Schema
    ✅ ENG-42-2: API Endpoints
  
  Phase 2 (2h 57m):
    ✅ ENG-42-3: Frontend UI

🎉 Epic ENG-42 is complete!

Next steps:
  1. Review the changes in Git
  2. Run end-to-end tests
  3. Deploy to staging environment

Full report: http://localhost:5173/epics/ENG-42/report
```

### Step 8: Review and Test

After orchestration:

1. **Check Git status:**
   ```bash
   git status
   git log --oneline -10
   ```

2. **Review modified files:**
   ```
   @spectree get code context for feature ENG-42-1
   ```

3. **Run integration tests:**
   ```bash
   pnpm test:integration
   ```

4. **Manual testing:**
   - Test the features in the browser/API client
   - Verify all acceptance criteria are met

---

## Advanced Orchestration

### Parallel Execution Control

Limit parallel workers:

```
@orchestrator start session for epic ENG-42 with maxWorkers 2
```

Only 2 features run simultaneously, even if more are ready.

### Dry Run (Preview)

See what would happen without executing:

```
@orchestrator dry-run for epic ENG-42
```

Shows execution plan, estimated time, and phases.

### Resume from Checkpoint

If orchestration was interrupted:

```
@orchestrator resume epic ENG-42
```

Picks up where it left off.

### Execute Specific Phase

Run only one phase:

```
@orchestrator execute phase 2 for epic ENG-42
```

Useful for debugging or partial re-runs.

---

## Common Pitfalls

### Orchestrator Stalls (No Progress)

**Problem:** Workers aren't making progress  
**Cause:** Worker agents might be waiting for user input  
**Solution:** Check worker logs, provide input, or restart orchestration

### Tasks Fail Validation Repeatedly

**Problem:** Same task fails validation multiple times  
**Cause:** Acceptance criteria too strict or implementation incorrect  
**Solution:** Review validation checks, adjust criteria, or fix implementation manually

### Dependency Cycle Detected

**Problem:** Feature A depends on B, B depends on A  
**Cause:** Circular dependency in execution metadata  
**Solution:** Remove circular dependencies:

```
@spectree set execution metadata for feature ENG-42-2 with dependencies []
```

### Worker Agent Timeout

**Problem:** Worker stops responding after 10 minutes  
**Cause:** Complex task taking too long  
**Solution:** Break task into smaller subtasks or increase timeout (if supported)

### Git Conflicts During Orchestration

**Problem:** Multiple workers edit the same file  
**Cause:** Incorrect parallelization settings (`canParallelize: true` on conflicting features)  
**Solution:** Set `canParallelize: false` for features that modify the same files

---

## Best Practices

### 1. Start Small

First orchestration? Use a small epic (2-3 features, 5-10 tasks) to learn the workflow.

### 2. Set Realistic Estimates

Use `estimatedComplexity` accurately:
- `trivial`: <1 hour
- `simple`: 1-4 hours
- `moderate`: 1-3 days
- `complex`: >3 days

Helps the orchestrator plan and report accurately.

### 3. Test Validation Checks First

Before orchestration, manually run validation checks:

```
@spectree run all validations for task ENG-42-1-1
```

Fix any issues before automatic execution.

### 4. Review AI Instructions

Worker agents follow AI instructions blindly. Make them:
- **Specific:** "Use Fastify for routes" not "Create routes"
- **Complete:** Include all steps
- **Safe:** No destructive commands without confirmation

### 5. Monitor First Orchestration

Don't walk away during your first run. Watch for:
- Incorrect assumptions by workers
- Validation failures
- Unexpected file modifications

### 6. Use Branches

Run orchestration on a feature branch:

```bash
git checkout -b feature/orchestrated-preferences
```

Easy to review changes and rollback if needed.

---

## Expected Output

After successful orchestration:

✅ All features completed  
✅ All tasks marked "Done"  
✅ Validations passed  
✅ Files committed to Git  
✅ Epic ready for review/deployment  

**Time saved:** 60-80% vs. manual implementation (for well-structured epics)

---

## Next Steps

- **[Code Review with Reviewer Agent](./reviewer-agent.md)** — Validate the implementation
- **[Creating a Custom Skill Pack](./custom-pack.md)** — Customize worker agent behavior

---

## What You Learned

✅ How orchestrated execution works (phases, workers, dependencies)  
✅ Starting and monitoring orchestration sessions  
✅ Handling validation failures during execution  
✅ Best practices for reliable automated implementation  

**Pro Tip:** The more detailed your AI instructions and validation checks, the better orchestration results. Invest time in planning for hands-off execution.
