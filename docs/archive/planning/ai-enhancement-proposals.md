# Dispatcher AI Enhancement Proposals

> **Author:** Copilot CLI Analysis Session  
> **Date:** February 2026  
> **Status:** Proposal  

This document captures comprehensive proposals for transforming Dispatcher into an AI-native collaboration platform with tools designed specifically for how AI agents think and work.

---

## Executive Summary

### Problem Statement

When using Dispatcher as a scratchpad for AI-assisted implementation planning, several pain points emerge:

1. **Manual Context Transfer** - Must explain Dispatcher to each AI session and ensure descriptions have enough detail for other sessions to understand
2. **No Execution Ordering** - Must manually ask AI for task sequence and parallelization opportunities
3. **Manual Status Updates** - Must explicitly remind AI to update statuses after completing work
4. **Session Fragmentation** - Creating new sessions for each task loses continuity and context

### Goals

1. Make Dispatcher **AI-aware** - tools designed for how AI agents think and work
2. Enable **seamless session handoffs** - context transfers automatically between AI sessions
3. Provide **intelligent execution planning** - dependencies, ordering, and parallelization built-in
4. Create **natural progress tracking** - status updates become part of the workflow, not an afterthought

### Implementation Tiers

| Tier | Features | Impact | Effort |
|------|----------|--------|--------|
| **Tier 1** | Execution Metadata, AI Context Fields, Auto-Progress Tools | High | Moderate |
| **Tier 2** | Templates, Session Handoff, Rich Descriptions | High | Higher |
| **Tier 3** | Codebase Integration, Validation Checklists, Decision Logs | Advanced | Significant |

### Success Metrics

- AI sessions can retrieve execution plans without human prompting
- Context transfers between sessions require no manual explanation
- Status updates happen naturally as part of task completion
- Implementation plans can be created from templates in one command

---

## Feature 1: Structured Execution Metadata

### Problem Being Solved

Currently, AI agents have no way to know:
- What order tasks should be executed in
- Which tasks can run in parallel
- What dependencies exist between tasks
- How complex a task is expected to be

This forces the user to manually ask the AI for execution order and parallelization opportunities each time.

### Proposed Solution

#### Database Schema Changes

Add to `packages/api/prisma/schema.prisma` for both Feature and Task models:

```prisma
model Feature {
  // ... existing fields ...
  executionOrder     Int?      @map("execution_order")    // Suggested sequence (1, 2, 3...)
  canParallelize     Boolean   @default(false) @map("can_parallelize")  // Can run alongside other features?
  parallelGroup      String?   @map("parallel_group")     // Features in same group can run together
  dependencies       String?   @map("dependencies")       // JSON array of feature IDs that must complete first
  estimatedComplexity String?  @map("estimated_complexity") // trivial | simple | moderate | complex
}

model Task {
  // Same fields as above
}
```

#### New MCP Tools

1. **dispatcher__get_execution_plan** - Returns ordered list of features/tasks with parallel groups
   - Input: `{ epicId: string }`
   - Output: `{ phases: [{ order: 1, items: [feature1, feature2], canRunInParallel: true }] }`

2. **dispatcher__mark_blocked** - Mark a feature/task as blocked by another
   - Input: `{ id, blockedById }`
   - Updates dependencies field

3. **dispatcher__mark_unblocked** - Remove a dependency
   - Input: `{ id, unblockedFromId }`

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add new fields to Feature and Task |
| `packages/api/src/schemas/feature.ts` | Add Zod validation for new fields |
| `packages/api/src/schemas/task.ts` | Same |
| `packages/api/src/services/featureService.ts` | Handle new fields in CRUD |
| `packages/api/src/services/taskService.ts` | Same |
| `packages/api/src/routes/features.ts` | Accept new fields in endpoints |
| `packages/api/src/routes/tasks.ts` | Same |
| `packages/mcp/src/tools/features.ts` | Update tool input schemas |
| `packages/mcp/src/tools/tasks.ts` | Same |
| `packages/mcp/src/tools/execution.ts` | **NEW**: Create execution plan tools |
| `packages/mcp/src/api-client.ts` | Add new API methods |

#### Tasks

1. Add execution metadata fields to Prisma schema
2. Add Zod validation for execution metadata
3. Update services to handle execution metadata
4. Create `dispatcher__get_execution_plan` MCP tool

#### AI Benefit

Once implemented, an AI session could:
1. Call `get_execution_plan` to understand work order
2. See which items can be parallelized
3. Know dependencies before starting work
4. Estimate effort based on complexity ratings

---

## Feature 2: AI Session Context Field

### Problem Being Solved

When an AI session works on a task and ends, the next session has no easy way to:
- Know what was tried
- Understand decisions made
- Continue from where the previous session left off
- See accumulated learnings

Currently, the user must manually explain context to each new session.

### Proposed Solution

#### Database Schema Changes

Add to Feature and Task models:

```prisma
model Feature {
  // ... existing fields ...
  aiContext        String?   @map("ai_context")          // Structured context for AI consumption
  aiNotes          String?   @map("ai_notes")            // JSON array of append-only notes
  lastAiSessionId  String?   @map("last_ai_session_id")  // Track last AI session
  lastAiUpdateAt   DateTime? @map("last_ai_update_at")
}
```

#### AI Note Structure

Each note in `aiNotes` array:

```typescript
interface AiNote {
  timestamp: string;      // ISO 8601
  sessionId?: string;     // Optional session identifier
  type: "observation" | "decision" | "blocker" | "next-step" | "context";
  content: string;
}
```

#### New MCP Tools

1. **dispatcher__append_ai_note** - Add context without overwriting
   - Input: `{ id, type, noteType, content, sessionId? }`
   - Appends to aiNotes array

2. **dispatcher__get_ai_context** - Retrieve full AI context
   - Input: `{ id, type }`
   - Returns: `{ aiContext, aiNotes, lastAiSessionId, lastAiUpdateAt }`

3. **dispatcher__set_ai_context** - Set the structured context field
   - Input: `{ id, type, context }`
   - Replaces aiContext field

#### New API Endpoints

- `POST /api/v1/features/:id/ai-note` - Append AI note
- `GET /api/v1/features/:id/ai-context` - Get AI context
- `PUT /api/v1/features/:id/ai-context` - Set AI context
- Same for tasks

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add new fields |
| `packages/api/src/routes/features.ts` | Add new endpoints |
| `packages/api/src/routes/tasks.ts` | Same |
| `packages/api/src/services/aiContextService.ts` | **NEW**: Business logic |
| `packages/api/src/schemas/aiContext.ts` | **NEW**: Validation schemas |
| `packages/mcp/src/tools/ai-context.ts` | **NEW**: MCP tools |
| `packages/mcp/src/api-client.ts` | Add new methods |

#### Tasks

1. Add AI context fields to Prisma schema
2. Create aiContextService with business logic
3. Add AI context API endpoints
4. Create AI context MCP tools

#### AI Benefit

With this feature:
- Sessions can log observations as they work
- The next session starts with full history
- No context is lost between sessions
- Decisions and blockers are preserved

---

## Feature 3: Auto-Progress Tracking Tools

### Problem Being Solved

Currently, AI sessions often forget to update task status after completing work. The user must explicitly remind the AI. Status updates feel like an afterthought rather than part of the workflow.

### Proposed Solution

#### New MCP Tools

Create tools specifically designed for progress tracking:

1. **dispatcher__start_work** - Begin working on an item
   - Input: `{ id, type: "feature" | "task" }`
   - Actions:
     - Sets status to "In Progress"
     - Records start timestamp in new `startedAt` field
     - Optionally appends AI note about starting work
   - Returns: Confirmation with item details

2. **dispatcher__complete_work** - Finish an item
   - Input: `{ id, type, summary?: string }`
   - Actions:
     - Sets status to "Done"
     - Records completion timestamp
     - Calculates and stores duration
     - Optionally appends summary as AI note
   - Returns: Confirmation with timing info

3. **dispatcher__log_progress** - Note progress without status change
   - Input: `{ id, type, message: string, percentComplete?: number }`
   - Actions:
     - Appends message to AI notes
     - Updates optional percentComplete field
   - Use case: Long-running tasks with incremental progress

4. **dispatcher__report_blocker** - Mark blocked
   - Input: `{ id, type, reason: string, blockedById?: string }`
   - Actions:
     - Sets status to "Blocked" (or adds blocked label)
     - Records blocker reason
     - Links to blocking item if provided
   - Returns: Confirmation

#### Database Changes

Add to Feature and Task models:

```prisma
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  durationMinutes Int?      @map("duration_minutes")
  percentComplete Int?      @map("percent_complete")    // 0-100
  blockerReason   String?   @map("blocker_reason")
```

#### Enhanced Tool Descriptions

Update existing tool descriptions to include progress reminders:

```typescript
// In dispatcher__update_task
description: `Update task details. 

TIP: After completing significant work on a task, consider using:
- dispatcher__complete_work to mark it done
- dispatcher__log_progress to note partial progress`
```

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add timing fields |
| `packages/api/src/routes/features.ts` | Add progress endpoints |
| `packages/api/src/routes/tasks.ts` | Same |
| `packages/api/src/services/progressService.ts` | **NEW**: Progress logic |
| `packages/mcp/src/tools/progress.ts` | **NEW**: Progress tools |
| `packages/mcp/src/tools/features.ts` | Update descriptions |
| `packages/mcp/src/tools/tasks.ts` | Update descriptions |

#### Tasks

1. Add timing fields to Prisma schema
2. Create progressService with timing logic
3. Implement `dispatcher__start_work` MCP tool
4. Implement `dispatcher__complete_work` MCP tool
5. Implement `dispatcher__log_progress` and `dispatcher__report_blocker` tools
6. Update existing tool descriptions with progress hints

#### AI Benefit

- Clear, purpose-built tools for the progress workflow
- Status updates become part of natural task lifecycle
- Timing data automatically tracked
- Blockers formally recorded

---

## Feature 4: Implementation Plan Template System

### Problem Being Solved

Every time you want to create an implementation plan, you must explain the desired structure to the AI. Common patterns like "Research → Implement → Test → Deploy" get recreated manually each time.

### Proposed Solution

#### New Data Model

```prisma
model PlanTemplate {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isBuiltIn   Boolean  @default(false)  // System templates vs user templates
  structure   String   // JSON: Template definition
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String?  // User relation
}
```

#### Template Structure Format

```typescript
interface TemplateStructure {
  epicDefaults?: {
    icon?: string;
    color?: string;
    descriptionPrompt?: string;  // Hint for what to put in description
  };
  features: TemplateFeature[];
}

interface TemplateFeature {
  titleTemplate: string;        // "Research: {{topic}}"
  descriptionPrompt?: string;
  executionOrder: number;
  canParallelize?: boolean;
  tasks?: TemplateTask[];
}

interface TemplateTask {
  titleTemplate: string;
  descriptionPrompt?: string;
  executionOrder: number;
}
```

#### Built-in Templates

1. **Code Feature** - Standard software feature implementation
   - Research & Design → Implementation → Testing → Documentation

2. **Bug Fix** - Bug investigation and fix
   - Reproduce → Investigate → Fix → Verify

3. **Refactoring** - Code refactoring project
   - Analyze → Plan → Execute → Validate

4. **API Endpoint** - New API endpoint
   - Design → Implement Route → Add Tests → Document

#### New MCP Tools

1. **dispatcher__list_templates** - Show available templates
   - Returns: `{ templates: [{ name, description, featureCount }] }`

2. **dispatcher__preview_template** - See what will be created
   - Input: `{ templateName, variables: { topic: "Payment Processing" } }`
   - Returns: Preview of epic/feature/task structure

3. **dispatcher__create_from_template** - Generate plan from template
   - Input: `{ templateName, epicName, teamId, variables: { topic: "Payment Processing" } }`
   - Creates full structure and returns epic with all features/tasks

4. **dispatcher__save_as_template** - Save current structure as template
   - Input: `{ epicId, templateName, description }`
   - Extracts structure from existing epic

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add PlanTemplate model |
| `packages/api/src/services/templateService.ts` | **NEW** |
| `packages/api/src/routes/templates.ts` | **NEW** |
| `packages/api/src/schemas/template.ts` | **NEW** |
| `packages/mcp/src/tools/templates.ts` | **NEW** |
| `packages/api/prisma/seed.ts` | Add built-in templates |

#### Tasks

1. Design and create PlanTemplate Prisma model
2. Create templateService with CRUD operations
3. Create template variable substitution engine
4. Implement `dispatcher__list_templates` and `dispatcher__preview_template`
5. Implement `dispatcher__create_from_template`
6. Implement `dispatcher__save_as_template`
7. Create built-in templates in seed data

#### AI Benefit

- One command creates complete implementation structure
- Consistent patterns across projects
- Variables allow customization
- Can save successful patterns for reuse

---

## Feature 5: Session Handoff System

### Problem Being Solved

When you end an AI session and start a new one, valuable context is lost:
- What was accomplished in the previous session
- What was tried but did not work
- What should be done next
- Decisions made and their rationale

The new session starts with a blank slate, requiring manual context reconstruction.

### Proposed Solution

#### New Data Model

```prisma
model AiSession {
  id           String    @id @default(uuid())
  epicId       String
  epic         Epic      @relation(...)
  sessionId    String?   // Optional external session ID
  startedAt    DateTime  @default(now())
  endedAt      DateTime?
  status       String    @default("active")  // active | completed | abandoned
  
  // Work tracking
  itemsWorkedOn String   // JSON array of {type, id, status} 
  summary       String?  // AI-generated summary of session work
  
  // Handoff info
  nextSteps     String?  // JSON array of recommended next actions
  blockers      String?  // JSON array of blockers encountered
  decisions     String?  // JSON array of decisions made
  contextBlob   String?  // Serialized context for next session
}
```

#### Workflow

1. **Start Session**: AI calls `dispatcher__start_session(epicId)`
   - Creates AiSession record
   - Returns previous session summary if exists
   - Returns current epic status

2. **During Session**: Work is tracked automatically
   - When items are updated, log to `session.itemsWorkedOn`
   - Decisions logged to `session.decisions`

3. **End Session**: AI calls `dispatcher__end_session(summary, nextSteps)`
   - Records session end
   - Stores handoff information
   - Returns session summary

#### New MCP Tools

1. **dispatcher__start_session**
   - Input: `{ epicId, sessionId?: string }`
   - Creates session, returns:
     - Previous session handoff (if any)
     - Epic progress summary
     - Suggested next actions

2. **dispatcher__end_session**
   - Input: `{ summary: string, nextSteps: string[], blockers?: string[], contextBlob?: string }`
   - Finalizes session record
   - Returns confirmation

3. **dispatcher__get_last_session**
   - Input: `{ epicId }`
   - Returns previous session details

4. **dispatcher__get_session_history**
   - Input: `{ epicId, limit?: number }`
   - Returns all sessions with summaries

5. **dispatcher__log_session_work**
   - Input: `{ itemId, itemType, action }`
   - Records work done (called automatically by other tools)

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add AiSession model |
| `packages/api/src/services/sessionService.ts` | **NEW** |
| `packages/api/src/routes/sessions.ts` | **NEW** |
| `packages/api/src/schemas/session.ts` | **NEW** |
| `packages/mcp/src/tools/sessions.ts` | **NEW** |
| `packages/mcp/src/tools/*.ts` | Add session tracking calls |

#### Tasks

1. Create AiSession Prisma model
2. Create sessionService with lifecycle management
3. Implement `dispatcher__start_session` MCP tool
4. Implement `dispatcher__end_session` MCP tool
5. Implement `dispatcher__get_last_session` and `get_session_history`
6. Integrate session tracking into existing tools

#### AI Benefit

- Explicit handoff protocol preserves context
- New sessions inherit full history
- Work is never lost
- Successor knows exactly where to continue

---

## Feature 6: Rich Description Schema

### Problem Being Solved

The current description field is freeform text. When an AI needs specific information like "what files are involved" or "what are the acceptance criteria", it must parse unstructured text. This is error-prone and inconsistent.

### Proposed Solution

#### Structured Description Format

Instead of/in addition to the freeform description, support structured data:

```typescript
interface StructuredDescription {
  // Human-readable summary
  summary: string;
  
  // AI-specific instructions
  aiInstructions?: string;
  
  // Clear success criteria
  acceptanceCriteria?: string[];
  
  // Code context
  filesInvolved?: string[];           // ["src/services/user.ts", "src/routes/users.ts"]
  functionsToModify?: string[];       // ["src/services/user.ts:createUser"]
  
  // Testing
  testingStrategy?: string;
  testFiles?: string[];
  
  // References
  relatedItemIds?: string[];          // Other features/tasks
  externalLinks?: { url: string; title: string }[];
  
  // Technical notes
  technicalNotes?: string;
  
  // Risk/complexity
  riskLevel?: "low" | "medium" | "high";
  estimatedEffort?: "trivial" | "small" | "medium" | "large" | "xl";
}
```

#### Storage Strategy (Recommended: Option A)

**Option A: JSON field**
- Add `structuredDesc` JSON field alongside existing `description`
- `description` remains for human-readable summary
- `structuredDesc` contains parsed sections

#### New MCP Tools

1. **dispatcher__get_structured_description**
   - Input: `{ id, type }`
   - Returns: Parsed StructuredDescription object

2. **dispatcher__update_section**
   - Input: `{ id, type, section, value }`
   - Update specific section without touching others
   - e.g., `dispatcher__update_section(taskId, "task", "filesInvolved", ["a.ts", "b.ts"])`

3. **dispatcher__add_acceptance_criterion**
   - Input: `{ id, type, criterion }`
   - Append to acceptanceCriteria array

4. **dispatcher__link_file**
   - Input: `{ id, type, filePath }`
   - Add file to filesInvolved

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add structuredDesc JSON field |
| `packages/api/src/schemas/structuredDescription.ts` | **NEW**: Zod schema |
| `packages/api/src/services/featureService.ts` | Handle structured data |
| `packages/api/src/services/taskService.ts` | Same |
| `packages/mcp/src/tools/structured-desc.ts` | **NEW**: Section tools |

#### Tasks

1. Design StructuredDescription TypeScript interface
2. Add structuredDesc JSON field to Prisma schema
3. Create Zod schema for structured description validation
4. Implement `dispatcher__get_structured_description` tool
5. Implement `dispatcher__update_section` tool
6. Implement convenience tools for common sections

#### AI Benefit

- Extract exactly what is needed (just files, just criteria)
- Consistent data structure across all items
- Section-specific updates without full rewrites
- Type-safe data access

---

## Feature 7: Codebase Integration

### Problem Being Solved

When an AI session starts working on a task, it must separately discover:
- What files are related to this task
- What functions need to be modified
- What branch is being used
- What commits have been made

This requires separate exploration work each session.

### Proposed Solution

#### Database Changes

Add to Task model:

```prisma
model Task {
  // ... existing fields ...
  
  // File context
  relatedFiles      String?   @map("related_files")      // JSON: ["src/a.ts", "src/b.ts"]
  relatedFunctions  String?   @map("related_functions")  // JSON: ["file.ts:funcName", ...]
  
  // Git context
  gitBranch         String?   @map("git_branch")
  gitCommits        String?   @map("git_commits")        // JSON: ["abc123", "def456"]
  gitPrNumber       Int?      @map("git_pr_number")
  gitPrUrl          String?   @map("git_pr_url")
}
```

#### New MCP Tools

1. **dispatcher__link_file** - Associate file with task
   - Input: `{ taskId, filePath, reason?: string }`
   - Adds to relatedFiles

2. **dispatcher__link_function** - Associate function
   - Input: `{ taskId, filePath, functionName, reason?: string }`
   - Adds to relatedFunctions as "file:function"

3. **dispatcher__link_branch** - Set git branch
   - Input: `{ taskId, branchName }`
   - Sets gitBranch field

4. **dispatcher__link_commit** - Record commit
   - Input: `{ taskId, commitSha, message?: string }`
   - Appends to gitCommits

5. **dispatcher__link_pr** - Link pull request
   - Input: `{ taskId, prNumber, prUrl }`
   - Sets gitPrNumber and gitPrUrl

6. **dispatcher__get_code_context** - Get all linked code artifacts
   - Input: `{ taskId }`
   - Returns: `{ files, functions, branch, commits, pr }`

7. **dispatcher__auto_discover_files** (advanced)
   - Input: `{ taskId, keywords: string[] }`
   - Uses grep/glob to find related files and suggests linking

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add code context fields |
| `packages/api/src/services/codeContextService.ts` | **NEW** |
| `packages/api/src/routes/tasks.ts` | Add code context endpoints |
| `packages/api/src/schemas/codeContext.ts` | **NEW** |
| `packages/mcp/src/tools/code-context.ts` | **NEW** |
| `packages/mcp/src/api-client.ts` | Add methods |

#### Tasks

1. Add code context fields to Prisma schema
2. Create codeContextService for managing code links
3. Implement file and function linking tools
4. Implement git integration tools
5. Implement `dispatcher__get_code_context` retrieval tool
6. Add auto-discovery tool (stretch goal)

#### AI Benefit

- Instant code context without searching
- Full audit trail of files touched
- Easy handoff (next session knows exactly what files matter)
- Git history automatically tracked

---

## Feature 8: Validation Checklists

### Problem Being Solved

Currently, "done" is subjective. An AI might mark a task complete when:
- Code compiles but tests are broken
- Feature works but documentation is not updated
- Implementation exists but acceptance criteria are not verified

No executable definition of "done" exists.

### Proposed Solution

#### Validation Check Model

```typescript
interface ValidationCheck {
  id: string;
  type: "command" | "file_exists" | "file_contains" | "test_passes" | "manual";
  description: string;
  
  // For command type
  command?: string;              // e.g., "pnpm test"
  expectedExitCode?: number;     // Default 0
  
  // For file_exists type
  filePath?: string;
  
  // For file_contains type
  searchPattern?: string;        // Regex or string to find in file
  
  // For test_passes type
  testCommand?: string;          // e.g., "pnpm test --filter userService"
  
  // Status
  status: "pending" | "passed" | "failed";
  lastCheckedAt?: string;
  lastError?: string;
}
```

#### Database Changes

```prisma
model Task {
  // ... existing fields ...
  validationChecks String?  @map("validation_checks")  // JSON array
}
```

#### New MCP Tools

1. **dispatcher__add_validation** - Add check to task
   - Input: `{ taskId, type, description, command?, filePath?, ... }`
   - Appends to validationChecks

2. **dispatcher__list_validations** - See all checks for task
   - Input: `{ taskId }`
   - Returns: `ValidationCheck[]`

3. **dispatcher__run_validation** - Execute a single check
   - Input: `{ taskId, checkId }`
   - Runs the check, updates status
   - Returns: `{ passed: boolean, error?: string }`

4. **dispatcher__run_all_validations** - Execute all checks
   - Input: `{ taskId }`
   - Runs all checks sequentially
   - Returns: `{ passed: number, failed: number, results: [...] }`

5. **dispatcher__mark_manual_validated** - Mark manual check complete
   - Input: `{ taskId, checkId, notes?: string }`
   - For checks that require human verification

#### Execution Engine

For automated checks, implement safe execution:
- Command checks: Run in subprocess, capture output, check exit code
- File checks: Use fs to verify existence/contents
- Test checks: Run test command, parse results
- Timeout handling for long-running commands
- Sandboxing considerations

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add validationChecks field |
| `packages/api/src/services/validationService.ts` | **NEW** |
| `packages/api/src/routes/validations.ts` | **NEW** |
| `packages/mcp/src/tools/validations.ts` | **NEW** |
| `packages/mcp/src/validation-executor.ts` | **NEW**: Safe command execution |

#### Tasks

1. Design ValidationCheck interface and storage
2. Create validationService with check management
3. Implement validation executor for command checks
4. Implement file existence and content checks
5. Implement `dispatcher__add_validation` and list tools
6. Implement `dispatcher__run_validation` and run_all tools
7. Add security considerations for command execution

#### AI Benefit

- Clear, executable definition of "done"
- Can verify own work before marking complete
- Catches common issues (tests broken, missing files)
- Provides confidence in completion status

---

## Feature 9: Progress Dashboard / Summary Tool

### Problem Being Solved

At the start of a session, an AI has no quick way to understand:
- Overall project progress
- What is blocked
- What is ready to work on next
- How much work remains

Currently requires multiple API calls and manual aggregation.

### Proposed Solution

#### dispatcher__get_progress_summary Tool

Single tool that returns comprehensive status:

```typescript
interface ProgressSummary {
  epic: {
    id: string;
    name: string;
    description: string;
  };
  
  // Counts
  totalFeatures: number;
  completedFeatures: number;
  inProgressFeatures: number;
  
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  
  // Calculated metrics
  overallProgress: number;          // Percentage 0-100
  estimatedRemaining: string;       // "3 features, ~8 tasks"
  
  // Actionable items
  blockedItems: {
    id: string;
    type: "feature" | "task";
    identifier: string;
    title: string;
    blockerReason: string;
  }[];
  
  nextActionable: {
    id: string;
    type: "feature" | "task";
    identifier: string;
    title: string;
    executionOrder?: number;
    complexity?: string;
  }[];
  
  recentlyCompleted: {
    id: string;
    identifier: string;
    title: string;
    completedAt: string;
  }[];
  
  // Session context
  lastSession?: {
    endedAt: string;
    summary: string;
    nextSteps: string[];
  };
}
```

#### Additional Summary Tools

1. **dispatcher__get_daily_summary**
   - Returns work done today across all epics
   - Useful for standup-style updates

2. **dispatcher__get_my_work**
   - Returns items assigned to current user/session
   - Prioritized by execution order

3. **dispatcher__get_blocked_summary**
   - All blocked items across epics with reasons

#### API Endpoint

`GET /api/v1/epics/:id/progress-summary` - Returns ProgressSummary JSON

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/src/services/summaryService.ts` | **NEW** |
| `packages/api/src/routes/epics.ts` | Add summary endpoint |
| `packages/mcp/src/tools/summary.ts` | **NEW** |
| `packages/mcp/src/api-client.ts` | Add method |

#### Tasks

1. Design ProgressSummary interface
2. Create summaryService with aggregation logic
3. Add `GET /epics/:id/progress-summary` endpoint
4. Implement `dispatcher__get_progress_summary` tool
5. Implement `dispatcher__get_my_work` tool
6. Implement `dispatcher__get_blocked_summary` tool

#### AI Benefit

- Instant orientation at session start
- Knows exactly what to work on next
- Clear visibility into blockers
- Understands overall project status

---

## Feature 10: Decision Log

### Problem Being Solved

During implementation, many decisions are made:
- "Used library X instead of Y because..."
- "Chose approach A over B due to..."
- "Skipped feature Z because..."

These decisions are typically lost. Future sessions (or humans) must reverse-engineer *why* things were done a certain way.

### Proposed Solution

#### Decision Model

```prisma
model Decision {
  id            String   @id @default(uuid())
  
  // Context
  epicId        String
  epic          Epic     @relation(...)
  featureId     String?
  feature       Feature? @relation(...)
  taskId        String?
  task          Task?    @relation(...)
  
  // Decision details
  question      String   // What was being decided
  decision      String   // The choice made
  rationale     String   // Why this choice was made
  alternatives  String?  // JSON: What else was considered
  
  // Metadata
  madeBy        String   // "AI" | "human" | user ID
  madeAt        DateTime @default(now())
  
  // Optional categorization
  category      String?  // "architecture" | "library" | "approach" | "scope"
  impact        String?  // "low" | "medium" | "high"
}
```

#### New MCP Tools

1. **dispatcher__log_decision** - Record a decision
   - Input: `{ epicId, featureId?, taskId?, question, decision, rationale, alternatives?, category? }`
   - Creates Decision record

2. **dispatcher__list_decisions** - Get decisions for context
   - Input: `{ epicId?, featureId?, taskId?, category? }`
   - Returns: `Decision[]` (newest first)

3. **dispatcher__search_decisions** - Find relevant decisions
   - Input: `{ query: string, epicId? }`
   - Full-text search in question/decision/rationale

4. **dispatcher__get_decision_context** - Get decisions related to current work
   - Input: `{ taskId }`
   - Returns decisions for the task, its feature, and epic
   - Provides full decision history context

#### API Endpoints

- `POST /api/v1/decisions` - Create decision
- `GET /api/v1/decisions` - List with filters
- `GET /api/v1/decisions/:id` - Get single decision
- `GET /api/v1/decisions/search?q=...` - Search

#### Usage Patterns

AI should log decisions when:
- Choosing between multiple libraries/approaches
- Deciding to skip or defer something
- Making assumptions about requirements
- Changing direction from original plan

#### Implementation Files

| File | Changes |
|------|---------|
| `packages/api/prisma/schema.prisma` | Add Decision model |
| `packages/api/src/services/decisionService.ts` | **NEW** |
| `packages/api/src/routes/decisions.ts` | **NEW** |
| `packages/api/src/schemas/decision.ts` | **NEW** |
| `packages/mcp/src/tools/decisions.ts` | **NEW** |

#### Tasks

1. Create Decision Prisma model
2. Create decisionService with CRUD operations
3. Add decision API endpoints
4. Implement `dispatcher__log_decision` tool
5. Implement `dispatcher__list_decisions` tool
6. Implement `dispatcher__get_decision_context` tool

#### AI Benefit

- Institutional memory of *why* choices were made
- Future sessions understand context
- Reduces repeated decision-making
- Provides audit trail for review

---

## Implementation Priority

### Phase 1: Foundation (Tier 1)
1. **Structured Execution Metadata** - Enables intelligent task ordering
2. **AI Session Context Field** - Preserves context between sessions
3. **Auto-Progress Tracking Tools** - Natural status updates

### Phase 2: Productivity (Tier 2)
4. **Progress Dashboard / Summary Tool** - Quick orientation
5. **Implementation Plan Template System** - Rapid plan creation
6. **Session Handoff System** - Explicit context transfer

### Phase 3: Advanced (Tier 3)
7. **Rich Description Schema** - Structured data extraction
8. **Codebase Integration** - Code artifact linking
9. **Decision Log** - Institutional memory
10. **Validation Checklists** - Executable "done" criteria

---

## Technical Notes

### General Implementation Guidelines

- All changes follow existing patterns in `packages/api/` and `packages/mcp/`
- Database changes use safe Prisma migration practices (see `docs/database-safety-guide.md`)
- MCP tools follow the registration pattern in `packages/mcp/src/tools/`
- Backwards compatibility maintained for existing data
- JSON fields used for flexible schema evolution
- All new endpoints require authentication

### Testing Strategy

- Unit tests for all new services
- Integration tests for API endpoints
- MCP tool tests using mock API client
- Existing test patterns in `packages/api/tests/`

### Migration Path

For existing Dispatcher data:
- New fields default to null/empty
- Existing descriptions remain unchanged
- Structured data populated on update
- No data loss during migration

---

## Appendix: MCP Tool Summary

| Tool Name | Category | Description |
|-----------|----------|-------------|
| `dispatcher__get_execution_plan` | Execution | Get ordered task list with parallel groups |
| `dispatcher__mark_blocked` | Execution | Mark item blocked by another |
| `dispatcher__mark_unblocked` | Execution | Remove dependency |
| `dispatcher__append_ai_note` | AI Context | Add note without overwriting |
| `dispatcher__get_ai_context` | AI Context | Retrieve full AI context |
| `dispatcher__set_ai_context` | AI Context | Set structured context |
| `dispatcher__start_work` | Progress | Begin working on item |
| `dispatcher__complete_work` | Progress | Finish item with summary |
| `dispatcher__log_progress` | Progress | Note incremental progress |
| `dispatcher__report_blocker` | Progress | Mark item blocked |
| `dispatcher__list_templates` | Templates | Show available templates |
| `dispatcher__preview_template` | Templates | Preview template expansion |
| `dispatcher__create_from_template` | Templates | Generate plan from template |
| `dispatcher__save_as_template` | Templates | Save structure as template |
| `dispatcher__start_session` | Sessions | Begin AI session |
| `dispatcher__end_session` | Sessions | End session with handoff |
| `dispatcher__get_last_session` | Sessions | Get previous session |
| `dispatcher__get_session_history` | Sessions | Get all sessions |
| `dispatcher__get_structured_description` | Descriptions | Get parsed description |
| `dispatcher__update_section` | Descriptions | Update specific section |
| `dispatcher__add_acceptance_criterion` | Descriptions | Add criterion |
| `dispatcher__link_file` | Code Context | Associate file with task |
| `dispatcher__link_function` | Code Context | Associate function |
| `dispatcher__link_branch` | Code Context | Set git branch |
| `dispatcher__link_commit` | Code Context | Record commit |
| `dispatcher__link_pr` | Code Context | Link pull request |
| `dispatcher__get_code_context` | Code Context | Get all linked artifacts |
| `dispatcher__add_validation` | Validation | Add check to task |
| `dispatcher__list_validations` | Validation | See all checks |
| `dispatcher__run_validation` | Validation | Execute single check |
| `dispatcher__run_all_validations` | Validation | Execute all checks |
| `dispatcher__get_progress_summary` | Summary | Get epic progress overview |
| `dispatcher__get_my_work` | Summary | Get assigned items |
| `dispatcher__get_blocked_summary` | Summary | Get all blocked items |
| `dispatcher__log_decision` | Decisions | Record a decision |
| `dispatcher__list_decisions` | Decisions | Get decisions with filters |
| `dispatcher__search_decisions` | Decisions | Search decision history |
| `dispatcher__get_decision_context` | Decisions | Get related decisions |
