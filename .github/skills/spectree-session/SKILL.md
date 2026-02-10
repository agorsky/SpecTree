# SpecTree Session Management Protocol

This skill defines the protocol for managing SpecTree-integrated AI sessions. Every AI session working on a SpecTree epic should follow this start/during/end workflow to maintain context continuity across sessions.

## Session Start

When beginning work on a SpecTree epic or feature, follow these steps:

### 1. Start the Session

```
spectree__start_work({
  id: "ENG-123",    // feature or task identifier
  type: "feature"   // "feature" or "task"
})
```

This sets the item's status to "In Progress" and records the start timestamp.

### 2. Check Previous Session Context

```
spectree__get_ai_context({
  id: "<epic-uuid>",
  type: "epic"
})
```

Review the returned context for:
- **previousSession.summary** - What was accomplished last time
- **previousSession.nextSteps** - What the previous session recommended doing next
- **previousSession.blockers** - Any unresolved blockers from last time
- **previousSession.decisions** - Key decisions made previously

If there is previous context, prioritize continuing from where the last session left off rather than starting fresh.

### 3. Check Current Progress

```
spectree__get_progress_summary({
  epicId: "<epic-uuid>"
})
```

Review the progress dashboard to understand:
- How many features/tasks are done vs remaining
- Which phase of execution you're in
- Overall percentage complete

### 4. Check for Blockers

```
spectree__get_blocked_summary({
  epicId: "<epic-uuid>"
})
```

If there are blocked items, assess whether you can resolve them or if they need to be escalated to the user.

### 5. Read Task Requirements

Before starting implementation, read the structured description:

```
spectree__get_structured_description({
  id: "ENG-123-1",  // task identifier
  type: "task"
})
```

This gives you the AI instructions, acceptance criteria, files involved, and technical notes you need for implementation.

---

## During Work

While implementing, use these tools to maintain context and track progress:

### Log Progress Periodically

Report progress at meaningful milestones (not after every line of code):

```
spectree__log_progress({
  type: "task",
  id: "ENG-123-1",
  message: "Completed database schema migration, moving to API route implementation",
  percentComplete: 40
})
```

Good times to log progress:
- After completing a significant sub-step
- When switching from one file/component to another
- When reaching a milestone in the acceptance criteria
- Before making a major architectural decision

### Record Important Decisions

When you make a choice between alternatives, log it:

```
spectree__log_decision({
  epicId: "<epic-uuid>",
  taskId: "<task-uuid>",      // optional - only if decision is task-specific
  question: "Which validation library to use for request bodies?",
  decision: "Use Zod",
  rationale: "Already used throughout the project for schema validation in packages/api/src/validation/",
  alternatives: ["Joi", "class-validator"],
  category: "library",  // architecture, library, approach, scope, design, tradeoff, deferral
  impact: "low"         // low, medium, high
})
```

Log decisions when:
- Choosing between implementation approaches
- Selecting libraries or patterns
- Making trade-offs (performance vs readability, etc.)
- Deviating from the original AI instructions

### Link Modified Files

Track which files you create or modify:

```
spectree__link_code_file({
  type: "task",
  id: "ENG-123-1",
  filePath: "packages/api/src/routes/preferences.ts"
})
```

Link files as you modify them, not all at once at the end.

### Report Blockers

If you encounter something that prevents progress:

```
spectree__report_blocker({
  type: "task",
  id: "ENG-123-1",
  reason: "Cannot implement API route because the database migration from task ENG-123-0 hasn't been applied yet"
})
```

### Leave Notes for Future Sessions

If you need to communicate something to the next AI session:

```
spectree__append_ai_note({
  type: "task",
  id: "ENG-123-1",
  noteType: "context",
  content: "The Prisma client needs to be regenerated after the schema change in this task. Run 'pnpm prisma generate' in packages/api/ before running tests."
})
```

---

## Session End

Before ending your session, perform these wrap-up steps:

### 1. Complete Finished Work

For each task you fully completed:

```
spectree__complete_work({
  type: "task",
  id: "ENG-123-1",
  summary: "Implemented user preferences API with GET/PUT endpoints, Zod validation, and Prisma queries. All acceptance criteria met."
})
```

This marks the item as "Done" and calculates the duration from when `start_work` was called.

### 2. Update Progress on Unfinished Work

For tasks you started but didn't finish:

```
spectree__log_progress({
  type: "task",
  id: "ENG-123-2",
  message: "Completed 3 of 5 unit tests. Remaining: error handling tests and edge case tests.",
  percentComplete: 60
})
```

### 3. Record Session Summary

Leave a summary for the next session:

```
spectree__append_ai_note({
  type: "epic",
  id: "<epic-uuid>",
  noteType: "context",
  content: "Session completed tasks ENG-123-1 and ENG-123-2 (partial). Next: finish ENG-123-2 tests, then start ENG-123-3. Key decision: using Zod for validation (logged). No blockers."
})
```

Include:
- **What was accomplished** - Which tasks were completed or progressed
- **Next steps** - What the next session should work on
- **Blockers** - Any unresolved issues
- **Decisions** - Reference any decisions logged during the session

---

## Error Handling

### When a Task Fails

If you cannot complete a task due to an error:

1. Log the failure:
   ```
   spectree__log_progress({
     type: "task",
     id: "ENG-123-1",
     message: "FAILED: TypeScript compilation errors in preferences.ts due to missing type export from shared package",
     percentComplete: 70
   })
   ```

2. Report the blocker:
   ```
   spectree__report_blocker({
     type: "task",
     id: "ENG-123-1",
     reason: "Missing type export from @spectree/shared - need UserPreferences type exported from packages/shared/src/types/index.ts"
   })
   ```

3. Do NOT mark the task as complete. Leave it in "In Progress" status.

### When Dependencies Are Missing

If a task depends on work from another task that isn't done:

1. Check the dependency:
   ```
   spectree__get_structured_description({
     id: "ENG-123-0",
     type: "task"
   })
   ```

2. If the dependency is blocked, report it and move to a different task that you can work on.
