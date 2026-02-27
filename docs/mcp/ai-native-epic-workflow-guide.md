# AI-Native Epic Development Guide

This guide explains how to work with Copilot CLI on Dispatcher projects. The key insight: **you prompt minimally, the AI handles the rest**.

---

## The Philosophy: Minimal Prompting, Maximum Automation

Dispatcher's AI tools are designed so that **you describe what you want, and the AI automatically**:
- Creates structured epics, features, and tasks
- Sets up execution order, dependencies, and parallelization
- Tracks all context across sessions
- Links code artifacts as it works
- Logs decisions with rationale
- Runs validations before completing work
- Creates proper session handoffs

**You don't need to prompt for each tool call.** The AI should use these tools proactively.

---

## What You Need to Prompt (And What the AI Handles)

### You Prompt | AI Automatically Does
|--------------|----------------------|
| Describe your epic idea | Creates epic, features, tasks with metadata |
| "Continue working on [epic]" | Starts session, gets context, picks next task |
| "I'm done for today" | Ends session with full handoff |
| Answer clarifying questions | Everything else |

---

## The Three Prompts You'll Actually Use

### Prompt 1: "Create a New Epic"

**What you say:**
```
I want to build [description of what you want]. 

Key requirements:
- [requirement 1]
- [requirement 2]
- [requirement 3]
```

**Example:**
```
I want to build a User Activity Dashboard for Dispatcher.

Key requirements:
- Track all user activity (features, tasks, sessions, git, validations)
- Support flexible time periods (today, this week, custom, rolling)
- Aggregate at all levels (user → team → epic → feature)
- Export to Markdown, PDF, JSON/CSV, shareable links
- Web UI with real-time updates via WebSocket
- MCP tools for AI access
```

**What the AI does automatically:**
1. Asks clarifying questions if needed
2. Creates the epic with description
3. Breaks down into features with:
   - Logical execution order
   - Dependencies between features
   - Parallel groups where appropriate
   - Complexity estimates
4. Creates tasks for each feature
5. Sets structured descriptions with:
   - AI instructions for future sessions
   - Acceptance criteria
   - Files likely to be involved
   - Risk levels
6. Shows you the execution plan for review

**What you see:**
```
I've created the "User Activity Dashboard" epic with 8 features and 32 tasks.

Execution Plan:
  Phase 1: Activity Data Model (foundation)
  Phase 2: Aggregation Engine  
  Phase 3: REST API + MCP Tools (parallel)
  Phase 4: Export System
  Phase 5: WebSocket Updates
  Phase 6: Web Dashboard UI
  Phase 7: Documentation

Ready to start implementation?
```

---

### Prompt 2: "Continue Working"

**What you say:**
```
Continue working on [epic name]
```

Or simply:
```
Let's work on the Activity Dashboard
```

**What the AI does automatically:**
1. Starts a session (`start_session`)
2. Reads previous session handoff (summary, next steps, blockers, decisions)
3. Gets progress summary (what's done, what's blocked, what's next)
4. Reviews any AI context on the next task
5. Checks relevant decisions made previously
6. Tells you the current state and what it will work on
7. Starts work on the next task (`start_work`)
8. Begins implementation

**What you see:**
```
Resuming work on Activity Dashboard (45% complete).

Previous session completed:
- Activity Data Model schema ✓
- Activity logging service ✓

Currently blocked: Nothing

Next up: "Add activity triggers to existing operations" (COM-12-4)

I'll start by examining the existing CRUD operations to identify 
where to add activity logging calls...
```

---

### Prompt 3: "I'm Done for Today"

**What you say:**
```
I'm done for today
```

Or:
```
Let's wrap up this session
```

**What the AI does automatically:**
1. Completes any in-progress work with summary
2. Runs validations on completed tasks
3. Updates AI context on current task
4. Ends session with:
   - Summary of what was accomplished
   - Specific next steps for next session
   - Any blockers encountered
   - Key decisions made with rationale
5. Confirms the handoff is saved

**What you see:**
```
Session complete! Here's the handoff for next time:

✅ Completed:
- Activity triggers added to feature CRUD (COM-12-4)
- Activity triggers added to task CRUD (COM-12-5)

📋 Next steps:
1. Add activity triggers to session operations
2. Write integration tests for activity tracking
3. Begin aggregation engine feature

🚫 Blockers: None

📝 Decisions logged:
- Using event sourcing pattern for activity (better audit trail)
- Batch writes every 5 seconds (performance optimization)

See you next session!
```

---

## What Happens Behind the Scenes

### During Epic Creation

The AI uses these tools automatically:

```
dispatcher__create_epic_complete    → Creates entire epic atomically
   OR (if building incrementally):
dispatcher__create_epic
dispatcher__create_feature (with executionOrder, dependencies, parallelGroup)
dispatcher__create_task (with executionOrder, estimatedComplexity)
dispatcher__manage_description action='set' (AI instructions, acceptance criteria)
dispatcher__get_execution_plan (to verify and show you)
```

### During Active Work

The AI uses these tools as it works:

```
dispatcher__manage_progress action='start_work'       → When beginning a task
dispatcher__manage_code_context action='link_file'    → When modifying files
dispatcher__manage_code_context action='link_function' → When modifying specific functions
dispatcher__manage_code_context action='link_branch'  → When creating a branch
dispatcher__manage_code_context action='link_commit'  → After committing
dispatcher__log_decision                              → When making implementation choices
dispatcher__manage_ai_context action='append_note'    → When discovering important context
dispatcher__manage_progress action='log_progress'     → During longer tasks
dispatcher__manage_validations action='add'           → To define "done" criteria
dispatcher__complete_task_with_validation             → Validates & completes atomically
```

### During Session Transitions

```
dispatcher__start_session              → Reads previous handoff
dispatcher__get_progress_summary       → Gets current epic state
dispatcher__manage_ai_context action='get_context' → Gets task-specific context
dispatcher__get_decision_context       → Reviews relevant decisions
dispatcher__end_session                → Writes handoff for next session
```

---

## Real Example: Activity Dashboard Epic

### Session 1: Epic Creation

**You:**
```
I want to build a User Activity Dashboard for Dispatcher.

Key requirements:
- Track all user activity (features, tasks, sessions, git, validations)  
- Support flexible time periods (today, this week, custom, rolling)
- Aggregate at all levels (user → team → epic → feature)
- Export to Markdown, PDF, JSON/CSV, shareable links
- Web UI with real-time updates via WebSocket
- MCP tools for AI access
```

**AI creates everything, then says:**
```
Created "User Activity Dashboard" epic with 8 features:

1. Activity Data Model & Storage (foundation)
   - 5 tasks: schema, enums, service, triggers, tests
   
2. Activity Aggregation Engine
   - 4 tasks: time periods, grouping, statistics, caching
   
3. Activity REST API (can run parallel with #4)
   - 6 tasks: endpoints, filtering, pagination, tests
   
4. Activity MCP Tools (can run parallel with #3)
   - 4 tasks: tools, registration, tests
   
5. Export & Sharing System
   - 5 tasks: markdown, PDF, JSON/CSV, shareable links, tests
   
6. Real-time WebSocket Updates
   - 5 tasks: server, broadcasting, auth, reconnection, tests
   
7. Web Dashboard UI
   - 8 tasks: layout, timeline, cards, filters, charts, export, realtime, tests
   
8. Documentation & Testing
   - 4 tasks: API docs, MCP docs, user guide, integration tests

Total: 41 tasks across 8 features
Estimated complexity: Large (multi-week project)

Ready to begin with Activity Data Model?
```

### Session 2: Continue Work

**You:**
```
Continue working on the Activity Dashboard
```

**AI automatically:**
1. Calls `start_session` 
2. Calls `get_progress_summary`
3. Sees previous session completed the data model
4. Calls `start_work` on next task
5. Begins implementation

**AI says:**
```
Resuming Activity Dashboard (12% complete - 5/41 tasks done).

Last session completed the Activity Data Model feature:
✓ Schema design
✓ Event types enum  
✓ Logging service
✓ CRUD triggers
✓ Migration & tests

Starting: "Create time-period aggregation functions" (COM-15-1)

Looking at the activity service to understand the data structure...
```

### Session 3: Wrap Up

**You:**
```
I need to stop for today
```

**AI automatically:**
1. Completes current task if possible, or notes where it stopped
2. Runs any pending validations
3. Calls `end_session` with full context

**AI says:**
```
Wrapping up your session...

✅ Completed today:
- Time-period aggregation functions (COM-15-1)
- User/team/epic grouping logic (COM-15-2)

🔄 In progress (60% done):
- Statistics calculations (COM-15-3)
  - Implemented: count, average duration
  - Remaining: trends, comparisons

📋 Next session should:
1. Complete statistics calculations (COM-15-3)
2. Add caching layer (COM-15-4)
3. Start on REST API feature

📝 Decisions made today:
- Using PostgreSQL window functions for rolling aggregations
  (rationale: more efficient than application-side calculation)
- Caching aggregations for 5 minutes
  (rationale: balance between freshness and performance)

Session saved. See you next time!
```

---

## When You Might Need More Specific Prompts

### Changing Direction
```
Actually, let's skip the PDF export for now and focus on the core features
```

### Asking About Status
```
What's the current state of the WebSocket feature?
```

### Reviewing Decisions
```
What decisions have we made about the activity data model?
```

### Handling Blockers
```
I'm blocked on the WebSocket auth - we need to decide on the token format
```

### Requesting Specific Work
```
Let's work on the export feature next instead of following the execution order
```

---

## Summary

| Situation | Your Prompt | AI Does The Rest |
|-----------|-------------|------------------|
| New project | Describe what you want | Creates full epic structure |
| Start working | "Continue on [epic]" | Session init, context load, begins work |
| During work | Answer questions, provide direction | Tracks everything automatically |
| End of day | "Done for today" | Full session handoff |
| Check status | "What's the status?" | Progress summary |
| Change plans | Describe the change | Adjusts and continues |

**The goal: You think about the product, the AI handles the project management.**

